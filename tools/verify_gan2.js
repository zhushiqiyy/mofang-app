/* =========================================================================
   verify_gan2.js — GAN 蓝牙协议与双平台桥接的端到端验证
   覆盖：
     A. AES-128 正确性（FIPS-197 官方测试向量）
     B. GAN 加密器往返（16/20 字节、两遍 CBC）
     C. MAC 提取（iOS 插件十六进制格式 / Web Bluetooth Map 格式）
     D. 原生路径全流程：模拟 Capacitor BLE 插件 + 模拟魔方（用真实算法加密数据帧）
        → 扫描取 MAC → 连接 → 请求面块 → 收密文帧 → 解密解析 → 应用到转动
     E. Gen3 帧解析（magic 0x55 + 180° 转）
     F. iPad 浏览器（无蓝牙能力）给出准确指引
     G. 手动输入 MAC 的兜底流程
     H. 网页路径（Web Bluetooth mock）全流程
   ========================================================================= */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const fails = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS :: ' + name); }
  else { fail++; fails.push(name + (extra ? '  [' + extra + ']' : '')); console.log('FAIL :: ' + name + (extra ? '  [' + extra + ']' : '')); }
}

/* ---------- 位写入工具（构造协议帧） ---------- */
function setBits(bytes, start, len, value) {
  for (let i = 0; i < len; i++) {
    const bit = (value >> (len - 1 - i)) & 1;
    const pos = start + i;
    const byteIdx = pos >> 3, bitIdx = 7 - (pos & 7);
    if (bit) bytes[byteIdx] |= (1 << bitIdx);
    else bytes[byteIdx] &= ~(1 << bitIdx);
  }
}
/* Gen2 面块状态帧：eventType 0x4 @bit0-3，serial 8bit @bit4 */
function gen2Facelets(serial) {
  const m = new Uint8Array(16);
  setBits(m, 0, 4, 0x4); setBits(m, 4, 8, serial);
  return m;
}
/* Gen2 转动帧：eventType 0x2，serial @4，face @12，direction @16，elapsed @47 */
function gen2Move(serial, face, direction, elapsed) {
  const m = new Uint8Array(16);
  setBits(m, 0, 4, 0x2); setBits(m, 4, 8, serial);
  setBits(m, 12, 4, face); setBits(m, 16, 1, direction);
  setBits(m, 47, 16, elapsed || 500);
  return m;
}
/* Gen3 转动帧：magic 0x55，eventType 0x01，serial @56(16LE)，direction @72(2)，面掩码 @74(6) */
function gen3Move(serial, faceMask, direction) {
  const m = new Uint8Array(20);
  setBits(m, 0, 8, 0x55); setBits(m, 8, 8, 0x01); setBits(m, 16, 8, 0x0A);
  setBits(m, 24, 32, 123456); setBits(m, 56, 16, serial);
  setBits(m, 72, 2, direction); setBits(m, 74, 6, faceMask);
  return m;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 加载 App ---------- */
function loadApp(opts) {
  opts = opts || {};
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const m = e.detail ? e.detail.message : e.message;
    /* jsdom 未实现的 API（scrollTo 等）不影响功能，忽略 */
    if (!/Not implemented/.test(m)) errors.push('jsdomError: ' + m);
  });
  const dom = new JSDOM(require('fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole: vc,
    beforeParse(w) {
      if (opts.userAgent) {
        try { Object.defineProperty(w.navigator, 'userAgent', { value: opts.userAgent, configurable: true }); } catch (e) {}
      }
    }
  });
  return { dom, w: dom.window, errors };
}

/* ---------- 模拟 Capacitor BLE 插件 + 模拟魔方 ---------- */
const CUBE_MAC = 'AB:12:34:00:27:97';
/* GAN 广播厂商数据（去掉 2 字节公司标识后的 9 字节）：末 6 字节为反序 MAC */
function ganManufacturerHex(mac) {
  const b = mac.split(':').map(x => parseInt(x, 16));
  return '00 00 00 ' + [b[5], b[4], b[3], b[2], b[1], b[0]].map(x => x.toString(16).padStart(2, '0')).join(' ');
}

function makeMockNative(w, opts) {
  opts = opts || {};
  const listeners = {};
  const state = {
    deviceId: 'CUBE-1',
    name: 'GANic2dT',
    notifyCallback: null,
    written: [],
    cubeEnc: null
  };
  const P = {
    async initialize() {},
    async isEnabled() { return { value: true }; },
    async addListener(key, cb) { (listeners[key] = listeners[key] || []).push(cb); return { async remove() {} }; },
    async startLEScan() {
      setTimeout(() => {
        const md = opts.noManufacturerData ? {} : { '1': ganManufacturerHex(CUBE_MAC) };
        (listeners['onScanResult'] || []).forEach(cb => cb({
          device: { deviceId: state.deviceId, name: state.name },
          localName: state.name,
          manufacturerData: md
        }));
      }, 40);
    },
    async stopLEScan() {},
    async connect(deviceId, onDisconnect) { state.onDisconnect = onDisconnect; },
    async disconnect() {},
    async getServices() {
      return [{ uuid: '6e400001-b5a3-f393-e0a9-e50e24dc4179', characteristics: [
        { uuid: '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4', properties: { write: true, writeWithoutResponse: true, notify: false } },
        { uuid: '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4', properties: { notify: true, write: false } }
      ] }];
    },
    async startNotifications(deviceId, service, characteristic, callback) { state.notifyCallback = callback; },
    async writeWithoutResponse(deviceId, service, characteristic, dv) { await handleWrite(state, dv); },
    async write(deviceId, service, characteristic, dv) { await handleWrite(state, dv); }
  };
  async function handleWrite(state, dv) {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    state.written.push(bytes);
    if (!state.cubeEnc) state.cubeEnc = w.eval("ganMakeEncrypter('" + CUBE_MAC + "')");
    const plain = state.cubeEnc.decrypt(bytes);
    if (plain[0] === 0x04) {
      /* 魔方回应面块状态（之后才上报转动） */
      setTimeout(() => state.notifyCallback && state.notifyCallback(new DataView(state.cubeEnc.encrypt(gen2Facelets(0)).buffer)), 30);
      setTimeout(() => state.notifyCallback && state.notifyCallback(new DataView(state.cubeEnc.encrypt(gen2Move(1, 1, 1, 640)).buffer)), 80);
      setTimeout(() => state.notifyCallback && state.notifyCallback(new DataView(state.cubeEnc.encrypt(gen2Move(2, 2, 0, 700)).buffer)), 130);
      setTimeout(() => state.notifyCallback && state.notifyCallback(new DataView(state.cubeEnc.encrypt(gen2Move(3, 0, 0, 660)).buffer)), 180);
    }
  }
  w.capacitorCommunityBluetoothLe = { BluetoothLe: P };
  w.Capacitor = { isNativePlatform: () => true, Plugins: {} };
  return state;
}

(async () => {
  /* ============ A/B/C：算法与工具（纯函数） ============ */
  {
    const { w, errors } = loadApp();
    await sleep(120);
    const E = s => { try { return w.eval(s); } catch (e) { return 'ERR:' + e.message; } };
    w.gen3MovePublic = gen3Move;

    check('App 加载无 JS 错误（含新蓝牙模块）', errors.length === 0, errors[0] || '');

    /* AES S-box 已知值 */
    check('AES S-box 已知值正确', E("AES_SBOX[0]===0x63 && AES_SBOX[1]===0x7c && AES_SBOX[0x53]===0xed && AES_SBOX[0xff]===0x16"));
    check('AES 逆 S-box 互逆', E("(function(){for(let i=0;i<256;i++){if(AES_SBOX[AES_INV_SBOX[i]]!==i)return false;}return true;})()"));

    /* FIPS-197 官方向量 */
    check('AES-128 加密符合 FIPS-197 向量',
      E(`(function(){
        const key = new Uint8Array([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
        const pt  = new Uint8Array([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map((v,i)=>[0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff][i]));
        const ct  = aesEncryptBlock(pt, aesExpandKey(key));
        return Array.from(ct).map(b=>b.toString(16).padStart(2,'0')).join('') === '69c4e0d86a7b0430d8cdb78070b4c55a';
      })()`));
    check('AES-128 解密符合 FIPS-197 向量',
      E(`(function(){
        const key = new Uint8Array([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
        const ct  = new Uint8Array([0x69,0xc4,0xe0,0xd8,0x6a,0x7b,0x04,0x30,0xd8,0xcd,0xb7,0x80,0x70,0xb4,0xc5,0x5a]);
        const pt  = aesDecryptBlock(ct, aesExpandKey(key));
        return Array.from(pt).map(b=>b.toString(16).padStart(2,'0')).join('') === '00112233445566778899aabbccddeeff';
      })()`));

    /* GAN 加密器往返（两遍 CBC：16 字节单块 / 20 字节首尾两块） */
    check('GAN 加密器 16 字节往返一致',
      E(`(function(){
        const e = ganMakeEncrypter('AB:12:34:00:27:97');
        const p = new Uint8Array(16); for(let i=0;i<16;i++) p[i]=(i*37+11)&0xff;
        return Array.from(e.decrypt(e.encrypt(p))).join()===Array.from(p).join();
      })()`));
    check('GAN 加密器 20 字节往返一致',
      E(`(function(){
        const e = ganMakeEncrypter('AB:12:34:00:27:97');
        const p = new Uint8Array(20); for(let i=0;i<20;i++) p[i]=(i*53+7)&0xff;
        return Array.from(e.decrypt(e.encrypt(p))).join()===Array.from(p).join();
      })()`));
    check('GAN 加密器：加密后与明文不同（确实在加密）',
      E(`(function(){
        const e = ganMakeEncrypter('AB:12:34:00:27:97');
        const p = new Uint8Array(16).fill(0x41);
        return e.encrypt(p)[0] !== 0x41;
      })()`));
    check('GAN 加密器：MAC 错误则解出乱码（密钥确实与 MAC 绑定）',
      E(`(function(){
        const e1 = ganMakeEncrypter('AB:12:34:00:27:97');
        const e2 = ganMakeEncrypter('AB:12:34:00:27:98');
        const p = gen2Move(1,1,1,500);
        const c = e1.encrypt(p);
        const bad = e2.decrypt(c);
        return bad[0] !== 0x20 || bad[1] !== 0x01;   /* 首位应是 0x20/0x01，错密钥解不出 */
      })()`));

    /* MAC 提取：iOS 插件格式（十六进制字符串） */
    check('MAC 提取：iOS 插件厂商数据格式',
      E("BLE.macFromManufacturerData({'1': '" + ganManufacturerHex(CUBE_MAC) + "'})") === CUBE_MAC,
      E("BLE.macFromManufacturerData({'1': '" + ganManufacturerHex(CUBE_MAC) + "'})"));
    check('MAC 提取：公司标识排序稳健（任意键都能取到）',
      E("BLE.macFromManufacturerData({'9999': '" + ganManufacturerHex(CUBE_MAC) + "'})") === CUBE_MAC);
    check('MAC 提取：数据太短返回 null', E("BLE.macFromManufacturerData({'1': '01 02 03'})") === null);
    check('MAC 提取：空数据返回 null', E('BLE.macFromManufacturerData({})') === null && E('BLE.macFromManufacturerData(null)') === null);
    check('MAC 提取：Web Bluetooth Map 格式',
      E(`(function(){
        const bytes = new Uint8Array([0,0,0,0x97,0x27,0x00,0x34,0x12,0xab]);
        const md = new Map(); md.set(0x0001, new DataView(bytes.buffer));
        return BLE.macFromManufacturerData(md);
      })()`) === CUBE_MAC);

    /* Gen3 帧解析：magic 0x55 + 180° 转 */
    check('Gen3 帧解析：识别 magic 与面掩码、180° 转',
      E(`(function(){
        const bits = ganBits(gen3MovePublic(7, 32, 2));
        const st = { lastSerial: -1 }, out = [];
        ganGen3Parse(bits, st, out);
        return out.length===1 && out[0].type==='MOVE' && out[0].face===1 && out[0].direction===2;
      })()`));

    /* 桥接层平台探测 */
    check('桥接层：无蓝牙环境判为 none', E('BLE.kind()') === 'none');
    check('桥接层：名称识别 GAN/MG/AiCube/MoYu，排除普通设备', E("BLE.nameLooksLikeCube('GANic2dT') && BLE.nameLooksLikeCube('MG3') && BLE.nameLooksLikeCube('AiCube01') && BLE.nameLooksLikeCube('MoYu AI 2023') && !BLE.nameLooksLikeCube('AirPods')"));

    /* 协议代际指令 */
    check('Gen2 请求面块指令 = 20 字节 0x04 开头', E(`(function(){const c=ganCommand(2,'REQUEST_FACELETS');return c.length===20&&c[0]===0x04&&c[19]===0;})()`));
    check('Gen4 请求面块指令 = DD 04 00 ED', E(`(function(){const c=ganCommand(4,'REQUEST_FACELETS');return c[0]===0xDD&&c[1]===0x04&&c[3]===0xED;})()`));
    w.close();
  }

  /* ============ D：原生路径全流程（模拟 iPad 原生 App + 模拟魔方） ============ */
  {
    const { w, errors } = loadApp();
    await sleep(120);
    w.eval('window.__moves = []; pracDo = function(m){ window.__moves.push(m); };');
    const cubeState = makeMockNative(w, {});
    check('原生环境探测为 native', w.eval('BLE.kind()') === 'native');

    await w.eval('pracConnectGAN()');
    await sleep(700);

    check('原生路径：扫描到魔方并连上', w.eval("document.querySelector('#gan-status').textContent.indexOf('已连接') >= 0"),
      w.eval("document.querySelector('#gan-status').textContent").slice(0, 60));
    check('原生路径：写入了请求面块指令（加密 20 字节）', cubeState.written.length >= 1 && cubeState.written[0].length === 20);
    check('原生路径：面块状态已同步且序号随转动推进（lastSerial=3）', w.eval('ganParseState.lastSerial') === 3, String(w.eval('ganParseState.lastSerial')));
    check('原生路径：收到 3 步转动并正确解析', JSON.stringify(w.eval('window.__moves')) === JSON.stringify(["R'", 'F', 'U']),
      JSON.stringify(w.eval('window.__moves')));
    check('原生路径：全程无 JS 错误', errors.length === 0, errors[0] || '');
    check('原生路径：MAC 已按设备名记住', w.eval("JSON.parse(localStorage.getItem('gan_mac_map'))['GANic2dT']") === CUBE_MAC);

    /* 断开事件 */
    cubeState.onDisconnect && cubeState.onDisconnect();
    await sleep(50);
    check('原生路径：断开有提示', w.eval("document.querySelector('#gan-status').textContent.indexOf('断开') >= 0"));
    w.close();
  }

  /* ============ F：iPad 浏览器（无任何蓝牙能力） ============ */
  {
    const { w, errors } = loadApp({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1' });
    await sleep(120);
    check('iPad 浏览器：探测为 none', w.eval('BLE.kind()') === 'none');
    await w.eval('pracConnectGAN()');
    await sleep(100);
    const st = w.eval("document.querySelector('#gan-status').textContent");
    check('iPad 浏览器：提示使用原生 App（不再误导装 Chrome/Edge）', st.indexOf('原生 App') >= 0 && st.indexOf('请用') < 0, st.slice(0, 50));
    check('iPad 浏览器：无 JS 错误', errors.length === 0, errors[0] || '');
    w.close();
  }

  /* ============ G：手动输入 MAC 兜底（扫描不到厂商数据） ============ */
  {
    const { w, errors } = loadApp();
    await sleep(120);
    w.eval('window.__moves = []; pracDo = function(m){ window.__moves.push(m); };');
    const cubeState = makeMockNative(w, { noManufacturerData: true });
    w.eval('pracConnectGAN()');   /* 不 await：流程会停在 MAC 弹窗等待输入 */
    await sleep(200);
    check('兜底流程：弹出 MAC 输入框', !!w.document.getElementById('gan-mac-input'));
    w.eval("document.getElementById('gan-mac-input').value = '" + CUBE_MAC + "'; ganMacConfirm();");
    await sleep(700);
    check('兜底流程：输入 MAC 后完成连接', w.eval("document.querySelector('#gan-status').textContent.indexOf('已连接') >= 0"),
      w.eval("document.querySelector('#gan-status').textContent").slice(0, 60));
    check('兜底流程：转动解析正确', JSON.stringify(w.eval('window.__moves')) === JSON.stringify(["R'", 'F', 'U']),
      JSON.stringify(w.eval('window.__moves')));
    check('兜底流程：无 JS 错误', errors.length === 0, errors[0] || '');
    w.close();
  }

  /* ============ H：网页路径（Web Bluetooth mock） ============ */
  {
    const { w, errors } = loadApp();
    await sleep(120);
    /* 构造 Web Bluetooth mock */
    const notifyHandlers = [];
    const cubeEnc = w.eval("ganMakeEncrypter('" + CUBE_MAC + "')");
    const fakeDevice = {
      id: 'WEB-1', name: 'GAN356i',
      gatt: {
        async connect() { return this; },
        async getPrimaryServices() {
          return [{
            uuid: '6e400001-b5a3-f393-e0a9-e50e24dc4179',
            async getCharacteristics() {
              return [{
                properties: { notify: true, write: true },
                async startNotifications() {},
                addEventListener(t, fn) { notifyHandlers.push(fn); },
                removeEventListener() {},
                async writeValue(bytes) {
                  const plain = cubeEnc.decrypt(new Uint8Array(bytes));
                  if (plain[0] === 0x04) {
                    setTimeout(() => notifyHandlers.forEach(fn => fn({ target: { value: new DataView(cubeEnc.encrypt(gen2Facelets(0)).buffer) } })), 30);
                    setTimeout(() => notifyHandlers.forEach(fn => fn({ target: { value: new DataView(cubeEnc.encrypt(gen2Move(1, 3, 1, 640)).buffer) } })), 90);
                    setTimeout(() => notifyHandlers.forEach(fn => fn({ target: { value: new DataView(cubeEnc.encrypt(gen2Move(2, 4, 0, 700)).buffer) } })), 150);
                  }
                }
              }];
            }
          }];
        },
        disconnect() {}
      },
      addEventListener() {}, removeEventListener() {}
    };
    Object.defineProperty(w.navigator, 'bluetooth', {
      value: { async requestDevice() { return fakeDevice; } }, configurable: true
    });
    check('网页环境探测为 web', w.eval('BLE.kind()') === 'web');

    w.eval('window.__moves = []; pracDo = function(m){ window.__moves.push(m); };');
    w.eval('pracConnectGAN()');   /* 不 await：网页路径取不到 MAC，会停在弹窗 */
    await sleep(300);
    /* 网页路径取不到 MAC（watchAdvertisements 不存在）→ 应弹手动输入框 */
    check('网页路径：取不到 MAC 时弹输入框', !!w.document.getElementById('gan-mac-input'));
    w.eval("document.getElementById('gan-mac-input').value = '" + CUBE_MAC + "'; ganMacConfirm();");
    await sleep(500);
    check('网页路径：连接成功', w.eval("document.querySelector('#gan-status').textContent.indexOf('已连接') >= 0"),
      w.eval("document.querySelector('#gan-status').textContent").slice(0, 60));
    check('网页路径：D 面和 L 面转动解析正确', JSON.stringify(w.eval('window.__moves')) === JSON.stringify(["D'", 'L']),
      JSON.stringify(w.eval('window.__moves')));
    check('网页路径：无 JS 错误', errors.length === 0, errors[0] || '');
    w.close();
  }

  console.log('\n========================================');
  console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
  if (fail) { console.log('失败项:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('✅ 全部通过');
  process.exit(0);
})().catch(e => { console.error('测试运行异常:', e); process.exit(1); });
