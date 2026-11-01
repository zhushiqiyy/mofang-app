// 修复 @capacitor-community/bluetooth-le 在 iOS 上的空服务扫描问题：
// CoreBluetooth 的 scanForPeripherals(withServices:) 传空数组 [] 会扫不到任何设备，
// 必须传 nil 才扫描全部。本脚本在 npm install 后（postinstall）自动把这一行改成 nil。
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'node_modules',
  '@capacitor-community', 'bluetooth-le', 'ios', 'Plugin', 'DeviceManager.swift');

try {
  let src = fs.readFileSync(FILE, 'utf8');
  const before = 'withServices: serviceUUIDs,';
  const after = 'withServices: serviceUUIDs.isEmpty ? nil : serviceUUIDs,';
  if (src.indexOf(before) >= 0) {
    src = src.replace(before, after);
    fs.writeFileSync(FILE, src);
    console.log('[patch-ble] 已修补 iOS 空服务扫描（[] → nil）');
  } else if (src.indexOf(after) >= 0) {
    console.log('[patch-ble] 已修补过，跳过');
  } else {
    console.log('[patch-ble] 未找到目标行，跳过（可能插件版本变化）');
  }
} catch (e) {
  console.log('[patch-ble] 跳过（未安装蓝牙插件）: ' + e.message);
}
