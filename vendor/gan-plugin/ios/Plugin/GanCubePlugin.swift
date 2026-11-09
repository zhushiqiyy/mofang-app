import Foundation
import CoreBluetooth
import CoreLocation
import Capacitor

// ============================================================================
// GanCubePlugin — 极简 GAN 智能魔方蓝牙插件
// 只做魔方需要的几件事：全量扫描、提取 MAC、连接、发现服务、订阅通知、写入。
// 关键点（对照 CubeStation 的原生实现）：
//   1) CBCentralManager 必须在主线程创建，否则 centralManagerDidUpdateState 不回调
//   2) 扫描用 scanForPeripherals(withServices: nil)，nil 才是"全量扫描"（GAN 魔方
//      广播不带服务 UUID，传空数组会一个都扫不到）
//   3) iOS 17+ 所有 BLE 扫描都需要定位权限，须主动 requestWhenInUseAuthorization
//   4) GAN 魔方把 MAC 反序放在广播 manufacturerData 的末尾 6 字节
// ============================================================================

@objc(GanCubePlugin)
public class GanCubePlugin: CAPPlugin {

    private var centralManager: CBCentralManager!
    private var locationManager: CLLocationManager?
    private var peripherals: [String: CBPeripheral] = [:]   // deviceId -> peripheral

    // 待完成的 connect / discover 调用（异步等待原生回调）
    private var pendingConnect: CAPPluginCall?
    private var pendingDiscover: CAPPluginCall?
    private var pendingDiscoverPeripheral: CBPeripheral?
    private var pendingServices: Set<CBUUID> = []

    // MARK: - 生命周期

    public override func load() {
        // CBCentralManager 必须在主线程创建
        let createCentral = { [weak self] in
            guard let self = self else { return }
            self.centralManager = CBCentralManager(delegate: self, queue: DispatchQueue.main)
        }
        if Thread.isMainThread {
            createCentral()
        } else {
            DispatchQueue.main.sync(execute: createCentral)
        }
    }

    // MARK: - 诊断

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve(["state": stateString()])
    }

    // MARK: - 扫描

    @objc func initialize(_ call: CAPPluginCall) {
        // iOS 17+ 蓝牙扫描需要定位权限，主动请求
        if locationManager == nil {
            let lm = CLLocationManager()
            self.locationManager = lm
            lm.requestWhenInUseAuthorization()
        }
        call.resolve(["state": stateString()])
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard centralManager != nil else {
            call.reject("蓝牙管理器未初始化")
            return
        }
        guard centralManager.state == .poweredOn else {
            call.reject("蓝牙未开启：" + stateString())
            return
        }
        peripherals.removeAll()
        // nil 才是全量扫描；不要传空数组
        centralManager.scanForPeripherals(withServices: nil, options: nil)
        call.resolve()
    }

    @objc func stopScan(_ call: CAPPluginCall) {
        if centralManager != nil && centralManager.isScanning {
            centralManager.stopScan()
        }
        call.resolve()
    }

    // MARK: - 连接

    @objc func connect(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let p = peripherals[id] else {
            call.reject("设备不存在")
            return
        }
        pendingConnect = call
        p.delegate = self
        centralManager.connect(p, options: nil)
        // 连接超时兜底
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            guard let self = self, let c = self.pendingConnect else { return }
            self.pendingConnect = nil
            c.reject("连接超时")
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        if let id = call.getString("id"), let p = peripherals[id] {
            centralManager.cancelPeripheralConnection(p)
        }
        call.resolve()
    }

    // MARK: - 服务发现

    @objc func discover(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let p = peripherals[id] else {
            call.reject("设备不存在")
            return
        }
        pendingDiscover = call
        pendingDiscoverPeripheral = p
        pendingServices = []
        p.delegate = self
        p.discoverServices(nil)
        // 兜底超时
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            self?.finishDiscover()
        }
    }

    // MARK: - 订阅 / 写入

    @objc func subscribe(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let p = peripherals[id] else {
            call.reject("设备不存在")
            return
        }
        let serviceUuid = call.getString("service") ?? ""
        let charUuid = call.getString("characteristic") ?? ""
        guard let service = findService(p, uuid: serviceUuid),
              let ch = findCharacteristic(service, uuid: charUuid) else {
            call.reject("服务或特征值不存在")
            return
        }
        p.setNotifyValue(true, for: ch)
        call.resolve()
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let p = peripherals[id] else {
            call.reject("设备不存在")
            return
        }
        let serviceUuid = call.getString("service") ?? ""
        let charUuid = call.getString("characteristic") ?? ""
        let dataHex = call.getString("data") ?? ""
        guard let service = findService(p, uuid: serviceUuid),
              let ch = findCharacteristic(service, uuid: charUuid) else {
            call.reject("服务或特征值不存在")
            return
        }
        let data = hexToData(dataHex)
        let type: CBCharacteristicWriteType = ch.properties.contains(.writeWithoutResponse)
            ? .withoutResponse : .withResponse
        p.writeValue(data, for: ch, type: type)
        call.resolve()
    }

    // MARK: - 工具

    private func stateString() -> String {
        guard centralManager != nil else { return "unknown(未初始化)" }
        switch centralManager.state {
        case .poweredOn: return "poweredOn(已开启)"
        case .poweredOff: return "poweredOff(蓝牙关闭)"
        case .unauthorized: return "unauthorized(权限被拒)"
        case .unsupported: return "unsupported(设备不支持)"
        case .resetting: return "resetting(重置中)"
        case .unknown: return "unknown(未知)"
        @unknown default: return "other"
        }
    }

    private func findService(_ p: CBPeripheral, uuid: String) -> CBService? {
        return (p.services ?? []).first { $0.uuid.uuidString.caseInsensitiveCompare(uuid) == .orderedSame }
    }

    private func findCharacteristic(_ s: CBService, uuid: String) -> CBCharacteristic? {
        return (s.characteristics ?? []).first { $0.uuid.uuidString.caseInsensitiveCompare(uuid) == .orderedSame }
    }

    private func propertiesList(_ ch: CBCharacteristic) -> [String] {
        var list: [String] = []
        if ch.properties.contains(.read) { list.append("read") }
        if ch.properties.contains(.write) { list.append("write") }
        if ch.properties.contains(.writeWithoutResponse) { list.append("writeWithoutResponse") }
        if ch.properties.contains(.notify) { list.append("notify") }
        if ch.properties.contains(.indicate) { list.append("indicate") }
        if ch.properties.contains(.broadcast) { list.append("broadcast") }
        return list
    }

    private func buildServicesResult(_ p: CBPeripheral) -> [[String: Any]] {
        return (p.services ?? []).map { service in
            let chars = (service.characteristics ?? []).map { ch -> [String: Any] in
                return ["uuid": ch.uuid.uuidString, "properties": propertiesList(ch)]
            }
            return ["uuid": service.uuid.uuidString, "characteristics": chars]
        }
    }

    private func finishDiscover() {
        guard let c = pendingDiscover, let p = pendingDiscoverPeripheral else { return }
        pendingDiscover = nil
        pendingDiscoverPeripheral = nil
        pendingServices = []
        c.resolve(["services": buildServicesResult(p)])
    }
}

// MARK: - CBCentralManagerDelegate

extension GanCubePlugin: CBCentralManagerDelegate {

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        notifyListeners("onState", data: ["state": stateString()])
    }

    public func centralManager(_ central: CBCentralManager,
                               didDiscover peripheral: CBPeripheral,
                               advertisementData: [String: Any],
                               rssi RSSI: NSNumber) {
        let name = peripheral.name
            ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
            ?? ""
        var mac = ""
        var mdHex = ""
        if let md = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data {
            mdHex = md.map { String(format: "%02X", $0) }.joined(separator: " ")
            mac = extractMAC(from: md) ?? ""
        }
        let deviceId = peripheral.identifier.uuidString
        peripherals[deviceId] = peripheral
        notifyListeners("onScan", data: [
            "deviceId": deviceId,
            "name": name,
            "rssi": RSSI.intValue,
            "mac": mac,
            "manufacturerData": mdHex
        ])
    }

    public func centralManager(_ central: CBCentralManager,
                               didConnect peripheral: CBPeripheral) {
        if let c = pendingConnect {
            pendingConnect = nil
            c.resolve()
        }
        notifyListeners("onConnect", data: ["deviceId": peripheral.identifier.uuidString])
    }

    public func centralManager(_ central: CBCentralManager,
                               didFailToConnect peripheral: CBPeripheral,
                               error: Error?) {
        if let c = pendingConnect {
            pendingConnect = nil
            c.reject("连接失败：" + (error?.localizedDescription ?? "unknown"))
        }
    }

    public func centralManager(_ central: CBCentralManager,
                               didDisconnectPeripheral peripheral: CBPeripheral,
                               error: Error?) {
        notifyListeners("onDisconnect", data: ["deviceId": peripheral.identifier.uuidString])
    }
}

// MARK: - CBPeripheralDelegate

extension GanCubePlugin: CBPeripheralDelegate {

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard peripheral == pendingDiscoverPeripheral else { return }
        let services = peripheral.services ?? []
        if services.isEmpty {
            finishDiscover()
            return
        }
        pendingServices = Set(services.map { $0.uuid })
        for service in services {
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral,
                           didDiscoverCharacteristicsFor service: CBService,
                           error: Error?) {
        guard peripheral == pendingDiscoverPeripheral else { return }
        pendingServices.remove(service.uuid)
        if pendingServices.isEmpty {
            finishDiscover()
        }
    }

    public func peripheral(_ peripheral: CBPeripheral,
                           didUpdateValueFor characteristic: CBCharacteristic,
                           error: Error?) {
        if error != nil { return }
        guard let data = characteristic.value else { return }
        let hex = data.map { String(format: "%02X", $0) }.joined(separator: " ")
        notifyListeners("onNotify", data: [
            "deviceId": peripheral.identifier.uuidString,
            "service": characteristic.service?.uuid.uuidString ?? "",
            "characteristic": characteristic.uuid.uuidString,
            "data": hex
        ])
    }
}

// MARK: - 工具函数

private func extractMAC(from manufacturerData: Data) -> String? {
    // iOS 的 CBAdvertisementDataManufacturerDataKey 含 2 字节 company ID 前缀。
    // GAN 魔方把 MAC 反序放在厂商数据末尾 6 字节，所以直接取整个 Data 的最后 6 字节、反序。
    let bytes = [UInt8](manufacturerData)
    guard bytes.count >= 8 else { return nil }  // 2 字节 companyID + 至少 6 字节 MAC
    var mac: [String] = []
    for i in 1...6 {
        mac.append(String(format: "%02X", bytes[bytes.count - i]))
    }
    return mac.joined(separator: ":")
}

private func hexToData(_ hex: String) -> Data {
    let clean = hex.replacingOccurrences(of: "0x", with: "", options: .caseInsensitive)
        .filter { $0.isHexDigit }
    var data = Data()
    var idx = clean.startIndex
    while idx < clean.endIndex {
        let next = clean.index(after: idx)
        if next < clean.endIndex {
            let byte = UInt8(clean[idx...next], radix: 16) ?? 0
            data.append(byte)
            idx = clean.index(after: next)
        } else {
            break
        }
    }
    return data
}
