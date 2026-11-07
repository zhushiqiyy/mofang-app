/* =========================================================================
   55-ble.js — 蓝牙传输桥接层（平台无关）
   桌面 Chrome / Edge ：Web Bluetooth API
   iPad / iPhone / Android 原生 App：Capacitor BLE 插件（iOS = CoreBluetooth）
   上层协议（60-gan.js）只使用本文件暴露的统一接口，不关心底层平台：

     BLE.kind()                       -> 'native' | 'web' | 'none'
     BLE.isSupported()
     BLE.scan(onStatus)               -> { id, name, mac }   （找不到会 reject）
     BLE.connect(handle, onNotify, onDisconnect)
                                       -> { service, write(bytes), close() }
     BLE.macFromManufacturerData(md)  -> 'AA:BB:CC:DD:EE:FF' | null
     BLE.hexToBytes / BLE.bytesToHex
   ========================================================================= */

const BLE = (function () {

  /* ---------------- 平台探测 ---------------- */
  function capClient() {
    /* 原生 App 里由 capacitor.js + bluetooth-le.js 提供 */
    try {
      const w = window.capacitorCommunityBluetoothLe;
      if (w && w.BluetoothLe) return w.BluetoothLe;
    } catch (e) {}
    return null;
  }
  function isNative() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (e) { return false; }
  }
  function webBT() {
    return (navigator.bluetooth && navigator.bluetooth.requestDevice) ? navigator.bluetooth : null;
  }
  function kind() {
    if (isNative() && capClient()) return 'native';
    if (webBT()) return 'web';
    return 'none';
  }
  function isSupported() { return kind() !== 'none'; }

  /* ---------------- GAN 协议家族的 GATT UUID ---------------- */
  const GAN_GEN2_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
  const GAN_GEN2_CMD     = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';
  const GAN_GEN2_STATE   = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';
  const GAN_GEN3_SERVICE = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
  const GAN_GEN3_CMD     = '8653000c-43e6-47b7-9cb0-5fc21d4ae340';
  const GAN_GEN3_STATE   = '8653000b-43e6-47b7-9cb0-5fc21d4ae340';
  const GAN_GEN4_SERVICE = '00000010-0000-fff7-fff6-fff5fff4fff0';
  const GAN_GEN4_CMD     = '0000fff5-0000-1000-8000-00805f9b34fb';
  const GAN_GEN4_STATE   = '0000fff6-0000-1000-8000-00805f9b34fb';
  const GAN_SERVICE_UUIDS = [GAN_GEN2_SERVICE, GAN_GEN3_SERVICE, GAN_GEN4_SERVICE];

  /* 魔方蓝牙名前缀（GAN 家族 + 采用 GAN 协议的 MoYu AI） */
  const NAME_PREFIXES = ['GAN', 'MG', 'AiCube', 'MoYu'];
  function nameLooksLikeCube(name) {
    if (!name) return false;
    const n = name.trim();
    for (const p of NAME_PREFIXES) {
      if (n.toLowerCase().startsWith(p.toLowerCase().trim())) return true;
    }
    return false;
  }

  /* ---------------- 十六进制工具 ---------------- */
  function bytesToHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += (i ? ' ' : '') + bytes[i].toString(16).padStart(2, '0');
    return s;
  }
  function hexToBytes(str) {
    const clean = String(str || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    const out = [];
    for (let i = 0; i + 1 < clean.length; i += 2) out.push(parseInt(clean.substr(i, 2), 16));
    return new Uint8Array(out);
  }

  /* ---------------- 从广播厂商数据提取 MAC ----------------
     GAN 魔方把 MAC 反序放在厂商数据末尾（前几个字节为固件/厂商信息，与 gan-web-bluetooth
     的 extractMAC 对齐：取前 9 字节内的最后 6 字节，反序拼成 MAC）。
     - Web Bluetooth：manufacturerData 是 Map<公司ID, DataView>，value 已不含公司 ID
     - iOS 插件    ：manufacturerData 是 { 公司ID: "12 34 56 ..." }，value 已不含公司 ID
     - Android 插件：同 iOS（十六进制字符串） */
  function macFromBytesAfterCic(bytes) {
    if (!bytes || bytes.length < 6) return null;
    const n = Math.min(bytes.length, 9);
    const mac = [];
    for (let i = 1; i <= 6; i++) mac.push(bytes[n - i].toString(16).padStart(2, '0'));
    return mac.join(':').toUpperCase();
  }
  function macFromManufacturerData(md) {
    if (!md) return null;
    try {
      /* Web Bluetooth：Map */
      if (typeof md.get === 'function' && typeof md.has === 'function') {
        for (let i = 0; i < 256; i++) {
          const cic = (i << 8) | 0x01; /* GAN 用过的公司标识列表 0x0001..0xFF01 */
          if (md.has(cic)) {
            const dv = md.get(cic);
            if (dv && dv.byteLength >= 6) {
              const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
              const mac = macFromBytesAfterCic(bytes);
              if (mac) return mac;
            }
          }
        }
        /* 退而求其次：任意公司标识 */
        for (const cic of (md.keys ? Array.from(md.keys()) : [])) {
          const dv = md.get(cic);
          if (dv && dv.byteLength >= 6) {
            const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
            const mac = macFromBytesAfterCic(bytes);
            if (mac) return mac;
          }
        }
        return null;
      }
      /* iOS / Android 插件：{ "257": "12 34 56 ..." } */
      if (typeof md === 'object') {
        const keys = Object.keys(md);
        /* 优先公司标识以 1 结尾的（GAN 的习惯） */
        keys.sort((a, b) => (a.endsWith('1') ? 0 : 1) - (b.endsWith('1') ? 0 : 1));
        for (const k of keys) {
          const v = md[k];
          let bytes = null;
          if (typeof v === 'string') bytes = hexToBytes(v);
          else if (v && v.buffer) bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
          if (bytes && bytes.length >= 6) {
            const mac = macFromBytesAfterCic(bytes);
            if (mac) return mac;
          }
        }
      }
    } catch (e) {}
    return null;
  }

  /* ---------------- 原生路径：扫描 ---------------- */
  async function nativeScan(onStatus) {
    const P = capClient();
    if (!P) throw new Error('NO_PLUGIN');
    await P.initialize();

    /* 蓝牙开关检查（iOS 只能提示，不能代开） */
    try {
      const en = await P.isEnabled();
      if (en && en.value === false) { const e = new Error('BLUETOOTH_OFF'); throw e; }
    } catch (e) { if (e && e.message === 'BLUETOOTH_OFF') throw e; }

    return new Promise((resolve, reject) => {
      let settled = false;
      let rescanTimer = null, timeoutTimer = null;
      const seen = [];
      let fallback = null;   /* 名字为空但带厂商数据的候选（部分魔方不广播名字） */
      let scanStarted = false;  /* 扫描是否真正启动（requestLEScan resolve / 收到回调） */
      let scanError = null;     /* requestLEScan 若 reject，记录错误 */

      const cleanup = async () => {
        if (rescanTimer) clearTimeout(rescanTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        try { await P.stopLEScan(); } catch (e) {}
      };

      const onResult = (r) => {
        if (settled) return;
        scanStarted = true;   /* 收到任何扫描回调都说明底层扫描在工作 */
        const name = (r.device && r.device.name) || r.localName || '';
        if (seen.indexOf(name) < 0) seen.push(name);
        const hasMD = r.manufacturerData && Object.keys(r.manufacturerData).length > 0;
        if (!name && hasMD && !fallback) {
          fallback = { id: r.device.deviceId, name: name, mac: macFromManufacturerData(r.manufacturerData) };
        }
        if (!nameLooksLikeCube(name)) return;
        const mac = macFromManufacturerData(r.manufacturerData);
        settled = true;
        cleanup().then(() => resolve({ id: r.device.deviceId, name: name, mac: mac }));
      };

      /* 第一轮：按 GAN 服务 UUID 过滤扫描。
         实测（电脑 Web Bluetooth）确认魔方在广播里带了 6e400001 服务 UUID，
         所以直接按服务过滤就能命中，完全不依赖「空数组全扫」的补丁。 */
      P.requestLEScan({ services: GAN_SERVICE_UUIDS, allowDuplicates: true }, onResult)
        .then(() => { scanStarted = true; })
        .catch((e) => { scanError = (e && e.message) || String(e); });

      /* 6 秒还没找到：换成空数组全扫兜底（依赖补丁把 [] 转 nil，覆盖不广播服务 UUID 的魔方） */
      rescanTimer = setTimeout(() => {
        if (settled) return;
        P.stopLEScan().catch(() => {}).then(() => {
          if (settled) return;
          if (onStatus) onStatus('rescan');
          P.requestLEScan({ services: [], allowDuplicates: true }, onResult)
            .then(() => { scanStarted = true; })
            .catch((e) => { scanError = (e && e.message) || String(e); });
        });
      }, 6000);

      /* 25 秒总超时 */
      timeoutTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        /* 名字匹配不到，但有带厂商数据的无名设备 → 当作魔方兜底连接 */
        if (fallback) {
          cleanup().then(() => resolve(fallback));
          return;
        }
        let info;
        if (!scanStarted && scanError) {
          info = '（扫描未能启动：' + scanError + '）';
        } else if (!scanStarted) {
          info = '（扫描未能启动，且无错误信息）';
        } else if (seen.length) {
          info = '（扫描期间看到 ' + seen.length + ' 个设备：' + seen.filter(s => s).slice(0, 8).join('、') + (seen.length > 8 ? '…' : '') + '）';
        } else {
          info = '（扫描已启动，但 25 秒内一个设备都没扫到——可能是权限被拒或魔方没广播）';
        }
        cleanup().then(() => reject(new Error('SCAN_TIMEOUT|' + info)));
      }, 25000);
    });
  }

  /* ---------------- 原生路径：连接 ---------------- */
  async function nativeConnect(handle, onNotify, onDisconnect) {
    const P = capClient();
    if (!P) throw new Error('NO_PLUGIN');

    await P.connect(handle.id, () => { if (onDisconnect) onDisconnect(); });

    /* CoreBluetooth 连接后稍等，再强制发现服务 + 特性（getServices 可能只返回服务 UUID 而没有 characteristics） */
    await new Promise(r => setTimeout(r, 500));
    try { await P.discoverServices(handle.id); } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
    let services = [];
    try { services = await P.getServices(handle.id) || []; } catch (e) {}

    /* 先按已知 GAN 服务找；找不到就退而求其次：任一同时具备通知+写入特征的服务 */
    let svc = services.find(s => GAN_SERVICE_UUIDS.indexOf((s.uuid || '').toLowerCase()) >= 0);
    if (!svc) {
      svc = services.find(s => {
        const cs = s.characteristics || [];
        const hasNotify = cs.some(c => c.properties && (c.properties.notify || c.properties.indicate));
        const hasWrite  = cs.some(c => c.properties && (c.properties.write || c.properties.writeWithoutResponse));
        return hasNotify && hasWrite;
      });
    }
    if (!svc) throw new Error('NO_GAN_SERVICE');

    const chars = svc.characteristics || [];
    const notifyChar = chars.find(c => c.properties && (c.properties.notify || c.properties.indicate));
    const writeChar  = chars.find(c => c.properties && (c.properties.write || c.properties.writeWithoutResponse));
    if (!notifyChar || !writeChar) throw new Error('NO_CHARACTERISTICS');

    await P.startNotifications(handle.id, svc.uuid, notifyChar.uuid, (dv) => {
      if (onNotify && dv) onNotify(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
    });

    const canWriteNoResp = !!(writeChar.properties && writeChar.properties.writeWithoutResponse);
    return {
      service: svc.uuid,
      writeChar: writeChar.uuid,
      notifyChar: notifyChar.uuid,
      write: async function (bytes) {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (canWriteNoResp) await P.writeWithoutResponse(handle.id, svc.uuid, writeChar.uuid, dv);
        else await P.write(handle.id, svc.uuid, writeChar.uuid, dv);
      },
      close: async function () {
        try { await P.stopNotifications(handle.id, svc.uuid, notifyChar.uuid); } catch (e) {}
        try { await P.disconnect(handle.id); } catch (e) {}
      }
    };
  }

  /* ---------------- 网页路径：请求设备 + 广播取 MAC ---------------- */
  async function webWatchMac(device) {
    if (typeof device.watchAdvertisements !== 'function') return null;
    return new Promise((resolve) => {
      let settled = false;
      const ac = new AbortController();
      const onAdv = (evt) => {
        if (settled) return;
        settled = true;
        try { device.removeEventListener('advertisementreceived', onAdv); } catch (e) {}
        try { ac.abort(); } catch (e) {}
        resolve(evt && evt.manufacturerData ? macFromManufacturerData(evt.manufacturerData) : null);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        try { device.removeEventListener('advertisementreceived', onAdv); } catch (e) {}
        try { ac.abort(); } catch (e) {}
        resolve(null);
      };
      try {
        device.addEventListener('advertisementreceived', onAdv);
        device.watchAdvertisements({ signal: ac.signal }).catch(finish);
        setTimeout(finish, 8000);
      } catch (e) { finish(); }
    });
  }

  async function webScan(onStatus) {
    const bt = webBT();
    if (!bt) throw new Error('NO_WEB_BLUETOOTH');
    const device = await bt.requestDevice({
      filters: NAME_PREFIXES.map(p => ({ namePrefix: p.trim() })),
      optionalServices: GAN_SERVICE_UUIDS,
      optionalManufacturerData: Array.from({ length: 256 }, (_, i) => (i << 8) | 0x01)
    });
    if (onStatus) onStatus('mac');
    const mac = await webWatchMac(device);
    return { id: device.id, name: device.name || '魔方', mac: mac, _device: device };
  }

  /* ---------------- 网页路径：连接 ---------------- */
  async function webConnect(handle, onNotify, onDisconnect) {
    const device = handle._device;
    if (!device || !device.gatt) throw new Error('NO_DEVICE');
    const server = await device.gatt.connect();

    let services = [];
    try { services = await server.getPrimaryServices() || []; } catch (e) {}

    let svc = services.find(s => GAN_SERVICE_UUIDS.indexOf((s.uuid || '').toLowerCase()) >= 0);
    if (!svc) {
      svc = services.find(s => true);
    }
    if (!svc) throw new Error('NO_GAN_SERVICE');

    let chars = [];
    try { chars = await svc.getCharacteristics() || []; } catch (e) {}
    const notifyChar = chars.find(c => c.properties && (c.properties.notify || c.properties.indicate));
    const writeChar  = chars.find(c => c.properties && (c.properties.write || c.properties.writeWithoutResponse));
    if (!notifyChar || !writeChar) throw new Error('NO_CHARACTERISTICS');

    await notifyChar.startNotifications();
    const onPacket = (ev) => {
      const dv = ev.target.value;
      if (dv && onNotify) onNotify(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
    };
    notifyChar.addEventListener('characteristicvaluechanged', onPacket);

    const onGattDisc = () => { if (onDisconnect) onDisconnect(); };
    if (device.addEventListener) device.addEventListener('gattserverdisconnected', onGattDisc);

    return {
      service: svc.uuid,
      writeChar: writeChar.uuid,
      notifyChar: notifyChar.uuid,
      write: async function (bytes) {
        await writeChar.writeValue(bytes);
      },
      close: async function () {
        try { notifyChar.removeEventListener('characteristicvaluechanged', onPacket); } catch (e) {}
        try { if (device.removeEventListener) device.removeEventListener('gattserverdisconnected', onGattDisc); } catch (e) {}
        try { device.gatt.disconnect(); } catch (e) {}
      }
    };
  }

  /* ---------------- 统一入口 ---------------- */
  async function scan(onStatus) {
    const k = kind();
    if (k === 'native') return nativeScan(onStatus);
    if (k === 'web') return webScan(onStatus);
    throw new Error('UNSUPPORTED');
  }
  async function connect(handle, onNotify, onDisconnect) {
    if (kind() === 'native') return nativeConnect(handle, onNotify, onDisconnect);
    return webConnect(handle, onNotify, onDisconnect);
  }

  return {
    kind: kind,
    isSupported: isSupported,
    scan: scan,
    connect: connect,
    macFromManufacturerData: macFromManufacturerData,
    macFromBytesAfterCic: macFromBytesAfterCic,
    nameLooksLikeCube: nameLooksLikeCube,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    NAME_PREFIXES: NAME_PREFIXES,
    GAN_SERVICE_UUIDS: GAN_SERVICE_UUIDS,
    GAN_GEN2_SERVICE: GAN_GEN2_SERVICE,
    GAN_GEN3_SERVICE: GAN_GEN3_SERVICE,
    GAN_GEN4_SERVICE: GAN_GEN4_SERVICE
  };
})();
