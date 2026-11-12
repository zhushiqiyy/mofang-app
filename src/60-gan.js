/* =========================================================================
   60-gan.js — GAN 智能魔方协议（Gen2 / Gen3 / Gen4）+ 应用层连接流程
   协议要点（来自社区逆向的 GAN 通用协议，与 gan-web-bluetooth / cstimer 对齐）：
     · 所有数据帧都是 AES-128 加密的，密钥由魔方 MAC 地址派生：
         salt = MAC 六字节倒序；key[i] = (keyBase[i] + salt[i]) % 255（i<6，IV 同理）
     · 加解密按 16 字节块进行：首块 + （长消息时）末块，各做一遍 AES-128-CBC
     · Gen2（GAN356i 等）：无 magic，eventType 为前 4 位；MOVE=0x02，
         一条消息最多带 7 步（8 位环形序号 + 滑动窗口），面序号直接查 "URFDLB"，
         方向 0=顺时针 1=逆时针
     · Gen3（GAN356 i Carry 2 等）：magic 0x55，eventType 8 位，MOVE=0x01
     · Gen4（GAN12/13/14 等）：eventType 8 位，MOVE=0x01
     · 连接后必须先请求一次面块状态（REQUEST_FACELETS），之后魔方才上报转动
   ========================================================================= */

/* ---------------- AES-128（自包含实现） ---------------- */
const AES_SBOX = (function () {
  /* 标准 AES S-box 生成算法（GF(2^8) 上求逆 + 仿射变换）。
     注意 q 的除法必须顺序累乘（q ^= q<<1; q ^= q<<2; q ^= q<<4），不能并行异或 */
  const sbox = new Array(256).fill(0);
  let p = 1, q = 1;
  do {
    p = (p ^ ((p << 1) & 0xff) ^ ((p & 0x80) ? 0x1b : 0)) & 0xff;   /* p ×= 3 */
    q = (q ^ ((q << 1) & 0xff)) & 0xff;                              /* q ÷= 3（顺序进行） */
    q = (q ^ ((q << 2) & 0xff)) & 0xff;
    q = (q ^ ((q << 4) & 0xff)) & 0xff;
    if (q & 0x80) q ^= 0x09;
    const rot1 = ((q << 1) | (q >> 7)) & 0xff;
    const rot2 = ((q << 2) | (q >> 6)) & 0xff;
    const rot3 = ((q << 3) | (q >> 5)) & 0xff;
    const rot4 = ((q << 4) | (q >> 4)) & 0xff;
    sbox[p] = (q ^ rot1 ^ rot2 ^ rot3 ^ rot4 ^ 0x63) & 0xff;
  } while (p !== 1);
  sbox[0] = 0x63;
  return sbox;
})();
const AES_INV_SBOX = (function () {
  const inv = new Array(256).fill(0);
  for (let i = 0; i < 256; i++) inv[AES_SBOX[i]] = i;
  return inv;
})();
const AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function aesGmul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p & 0xff;
}
function aesExpandKey(key) {
  const w = new Uint8Array(176);
  for (let i = 0; i < 16; i++) w[i] = key[i];
  for (let i = 16; i < 176; i += 4) {
    let t0 = w[i - 4], t1 = w[i - 3], t2 = w[i - 2], t3 = w[i - 1];
    if (i % 16 === 0) {
      const r = i / 16 - 1;
      const tmp = t0;
      t0 = AES_SBOX[t1] ^ AES_RCON[r];
      t1 = AES_SBOX[t2];
      t2 = AES_SBOX[t3];
      t3 = AES_SBOX[tmp];
    }
    w[i]     = w[i - 16] ^ t0;
    w[i + 1] = w[i - 15] ^ t1;
    w[i + 2] = w[i - 14] ^ t2;
    w[i + 3] = w[i - 13] ^ t3;
  }
  return w;
}
function aesEncryptBlock(inp, rk) {
  const s = new Uint8Array(16);
  for (let i = 0; i < 16; i++) s[i] = inp[i] ^ rk[i];
  for (let round = 1; round <= 10; round++) {
    for (let i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
    const t = new Uint8Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) t[4 * c + r] = s[4 * ((c + r) % 4) + r];
    s.set(t);
    if (round !== 10) {
      for (let c = 0; c < 4; c++) {
        const a0 = s[4 * c], a1 = s[4 * c + 1], a2 = s[4 * c + 2], a3 = s[4 * c + 3];
        s[4 * c]     = aesGmul(a0, 2) ^ aesGmul(a1, 3) ^ a2 ^ a3;
        s[4 * c + 1] = a0 ^ aesGmul(a1, 2) ^ aesGmul(a2, 3) ^ a3;
        s[4 * c + 2] = a0 ^ a1 ^ aesGmul(a2, 2) ^ aesGmul(a3, 3);
        s[4 * c + 3] = aesGmul(a0, 3) ^ a1 ^ a2 ^ aesGmul(a3, 2);
      }
    }
    const off = round * 16;
    for (let i = 0; i < 16; i++) s[i] ^= rk[off + i];
  }
  return s;
}
function aesDecryptBlock(inp, rk) {
  const s = new Uint8Array(16);
  for (let i = 0; i < 16; i++) s[i] = inp[i] ^ rk[160 + i];
  for (let round = 9; round >= 0; round--) {
    const t = new Uint8Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) t[4 * c + r] = s[4 * ((c - r + 4) % 4) + r];
    s.set(t);
    for (let i = 0; i < 16; i++) s[i] = AES_INV_SBOX[s[i]];
    const off = round * 16;
    for (let i = 0; i < 16; i++) s[i] ^= rk[off + i];
    if (round !== 0) {
      for (let c = 0; c < 4; c++) {
        const a0 = s[4 * c], a1 = s[4 * c + 1], a2 = s[4 * c + 2], a3 = s[4 * c + 3];
        s[4 * c]     = aesGmul(a0, 14) ^ aesGmul(a1, 11) ^ aesGmul(a2, 13) ^ aesGmul(a3, 9);
        s[4 * c + 1] = aesGmul(a0, 9)  ^ aesGmul(a1, 14) ^ aesGmul(a2, 11) ^ aesGmul(a3, 13);
        s[4 * c + 2] = aesGmul(a0, 13) ^ aesGmul(a1, 9)  ^ aesGmul(a2, 14) ^ aesGmul(a3, 11);
        s[4 * c + 3] = aesGmul(a0, 11) ^ aesGmul(a1, 13) ^ aesGmul(a2, 9)  ^ aesGmul(a3, 14);
      }
    }
  }
  return s;
}

/* ---------------- GAN 加密器（MAC 派生密钥 + 两遍 CBC） ---------------- */
const GAN_KEY_BASE = [0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07, 0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53];
const GAN_IV_BASE  = [0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27, 0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43];

function ganMakeEncrypter(macStr) {
  const parts = String(macStr || '').split(/[:-\s]+/).filter(x => x);
  if (parts.length !== 6) throw new Error('MAC 格式不对');
  const salt = new Uint8Array(parts.map(c => parseInt(c, 16)).reverse());
  const key = GAN_KEY_BASE.slice();
  const iv = GAN_IV_BASE.slice();
  for (let i = 0; i < 6; i++) {
    key[i] = (key[i] + salt[i]) % 255;
    iv[i] = (iv[i] + salt[i]) % 255;
  }
  const rk = aesExpandKey(new Uint8Array(key));
  const ivArr = new Uint8Array(iv);
  function encChunk(buf, off) {
    const x = new Uint8Array(16);
    for (let i = 0; i < 16; i++) x[i] = buf[off + i] ^ ivArr[i];
    buf.set(aesEncryptBlock(x, rk), off);
  }
  function decChunk(buf, off) {
    const c = new Uint8Array(16);
    for (let i = 0; i < 16; i++) c[i] = buf[off + i];
    const p = aesDecryptBlock(c, rk);
    for (let i = 0; i < 16; i++) buf[off + i] = p[i] ^ ivArr[i];
  }
  return {
    encrypt: function (data) {
      if (data.length < 16) throw new Error('消息太短');
      const res = new Uint8Array(data);
      encChunk(res, 0);
      if (res.length > 16) encChunk(res, res.length - 16);
      return res;
    },
    decrypt: function (data) {
      if (data.length < 16) throw new Error('消息太短');
      const res = new Uint8Array(data);
      if (res.length > 16) decChunk(res, res.length - 16);
      decChunk(res, 0);
      return res;
    }
  };
}

/* ---------------- 协议帧解析 ---------------- */
const GAN_FACE = ['U', 'R', 'F', 'D', 'L', 'B'];   /* GAN 面序号 -> 我们的记号（可被「校准」改写 */

function ganBits(msg) {
  let bits = '';
  for (let i = 0; i < msg.length; i++) bits += (msg[i] + 0x100).toString(2).slice(1);
  return bits;
}
function ganBitWord(bits, start, len, littleEndian) {
  if (len <= 8) return parseInt(bits.substr(start, len), 2);
  const n = len / 8;
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = parseInt(bits.substr(8 * i + start, 8), 2);
  const dv = new DataView(buf.buffer);
  return len === 16 ? dv.getUint16(0, !!littleEndian) : dv.getUint32(0, !!littleEndian);
}

/* Gen2：无 magic，eventType = 前 4 位 */
function ganGen2Parse(bits, st, out) {
  const eventType = ganBitWord(bits, 0, 4);
  if (eventType === 0x02) {           /* MOVE：滑动窗口，最多 7 步 */
    if (st.lastSerial !== -1) {
      const serial = ganBitWord(bits, 4, 8);
      const diff = Math.min((serial - st.lastSerial) & 0xFF, 7);
      st.lastSerial = serial;
      for (let i = diff - 1; i >= 0; i--) {
        const face = ganBitWord(bits, 12 + 5 * i, 4);
        const direction = ganBitWord(bits, 16 + 5 * i, 1);
        out.push({ type: 'MOVE', face: face, direction: direction });
      }
    }
  } else if (eventType === 0x04) {    /* FACELETS：状态同步，之后才接受转动 */
    st.lastSerial = ganBitWord(bits, 4, 8);
  } else if (eventType === 0x09) {    /* BATTERY */
    out.push({ type: 'BATTERY', level: Math.min(ganBitWord(bits, 8, 8), 100) });
  } else if (eventType === 0x0D) {    /* DISCONNECT */
    out.push({ type: 'DISCONNECT' });
  }
}

/* Gen3：magic 0x55，eventType 8 位 @8 */
function ganGen3Parse(bits, st, out) {
  if (ganBitWord(bits, 0, 8) !== 0x55) return;
  const eventType = ganBitWord(bits, 8, 8);
  if (eventType === 0x01) {           /* MOVE：面为 6 位掩码，方向 0=顺 1=逆 2=180° */
    const serial = ganBitWord(bits, 56, 16, true);
    const direction = ganBitWord(bits, 72, 2);
    const face = [2, 32, 8, 1, 16, 4].indexOf(ganBitWord(bits, 74, 6));
    st.lastSerial = serial;
    if (face >= 0) out.push({ type: 'MOVE', face: face, direction: direction });
  } else if (eventType === 0x10) {    /* BATTERY */
    out.push({ type: 'BATTERY', level: Math.min(ganBitWord(bits, 24, 8), 100) });
  } else if (eventType === 0x11) {    /* DISCONNECT */
    out.push({ type: 'DISCONNECT' });
  }
}

/* Gen4：eventType 8 位 @0，dataLength 8 位 @8 */
function ganGen4Parse(bits, st, out) {
  const eventType = ganBitWord(bits, 0, 8);
  const dataLength = ganBitWord(bits, 8, 8);
  if (eventType === 0x01) {           /* MOVE：面为 6 位掩码，方向 0=顺 1=逆 2=180° */
    const direction = ganBitWord(bits, 64, 2);
    const face = [2, 32, 8, 1, 16, 4].indexOf(ganBitWord(bits, 66, 6));
    if (face >= 0) out.push({ type: 'MOVE', face: face, direction: direction });
  } else if (eventType === 0xEF) {    /* BATTERY（电量在消息末尾） */
    out.push({ type: 'BATTERY', level: Math.min(ganBitWord(bits, 8 + dataLength * 8, 8), 100) });
  } else if (eventType === 0xEA) {    /* DISCONNECT */
    out.push({ type: 'DISCONNECT' });
  }
}

/* 各代「请求面块状态 / 请求电量」指令（20 字节，加密后写入） */
function ganCommand(gen, type) {
  const msg = new Uint8Array(20).fill(0);
  if (gen === 2) {
    if (type === 'REQUEST_FACELETS') msg[0] = 0x04;
    else if (type === 'REQUEST_BATTERY') msg[0] = 0x09;
    else return null;
  } else if (gen === 3) {
    if (type === 'REQUEST_FACELETS') { msg[0] = 0x68; msg[1] = 0x01; }
    else if (type === 'REQUEST_BATTERY') { msg[0] = 0x68; msg[1] = 0x07; }
    else return null;
  } else {
    if (type === 'REQUEST_FACELETS') msg.set([0xDD, 0x04, 0x00, 0xED, 0x00, 0x00]);
    else if (type === 'REQUEST_BATTERY') msg.set([0xDD, 0x04, 0x00, 0xEF, 0x00, 0x00]);
    else return null;
  }
  return msg;
}

/* ---------------- 校准：面序号 -> 实际方向 ---------------- */
function loadGanMap() {
  try {
    const a = JSON.parse(localStorage.getItem('gan_face_map'));
    if (Array.isArray(a) && a.length === 6) return a;
  } catch (e) {}
  return GAN_FACE.slice();
}
let ganFaceMap = loadGanMap();
function saveGanMap() { try { localStorage.setItem('gan_face_map', JSON.stringify(ganFaceMap)); } catch (e) {} }

/* MAC 记忆：按设备名存，下次同一条魔方不用再输 */
function loadGanMac(name) {
  try { const m = JSON.parse(localStorage.getItem('gan_mac_map') || '{}'); return m[name] || null; } catch (e) { return null; }
}
function saveGanMac(name, mac) {
  try {
    const m = JSON.parse(localStorage.getItem('gan_mac_map') || '{}');
    m[name] = mac;
    localStorage.setItem('gan_mac_map', JSON.stringify(m));
  } catch (e) {}
}

/* ---------------- 连接状态 ---------------- */
let ganConn = null;                 /* BLE 连接（见 55-ble.js） */
let ganEnc = null;                  /* 加解密器 */
let ganGen = 2;                     /* 协议代际 2/3/4 */
let ganParseState = { lastSerial: -1 };
let ganBattery = -1;
let ganFaceletsTimer = null;
let ganLastHandle = null;           /* 记住上次连过的设备，用于前后台自动重连 */
let ganBackgroundRelease = false;   /* 后台主动断开标记（避免误报"断开了"） */

function ganSetStatus(html) {
  const e = $('gan-status');
  if (e) e.innerHTML = html;
}

/* 环境诊断：显示当前蓝牙通道是否可用（排查「连不上」用） */
function ganShowEnv(){
  const e = $('gan-env');
  if (!e) return;
  const hasPlugin = !!window.GanCubePlugin;
  const isNat = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  e.textContent = '环境：蓝牙通道=' + BLE.kind() + ' · 插件=' + (hasPlugin ? '已加载' : '未加载') + ' · 原生=' + (isNat ? '是' : '否');
}

function ganSupported() { return BLE.isSupported(); }

/* 蓝牙诊断：在真机上直接显示插件注册 / 蓝牙状态，定位"连不上"的根源 */
async function ganDiagnose() {
  ganSetStatus('🔍 正在诊断蓝牙环境…');
  try {
    const r = await BLE.diagnose();
    const text = BLE.diagnoseText(r);
    ganSetStatus('<b>🔍 蓝牙诊断</b><br><pre style="white-space:pre-wrap;font-size:12px;line-height:1.5;margin:6px 0 0;">' +
      text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>');
  } catch (e) {
    ganSetStatus('诊断出错：' + (e && e.message || e));
  }
}

/* ---------------- 连接流程 ---------------- */
async function pracConnectGAN() {
  if (!ganSupported()) {
    /* 跑在浏览器里且没有网页蓝牙能力 */
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    ganSetStatus(isIOS
      ? 'iPad / iPhone 的 Safari、Chrome、Edge 都被苹果禁止使用网页蓝牙。<b>请使用原生 App 版「魔方小将」</b>（安装方法见随附说明），'
        + '或者用官方 <b>CubeStation</b> App 计时、再对照本程序的进度。'
      : '这个浏览器不支持网页蓝牙。请用 <b>Chrome / Edge</b> 打开，或者直接用官方 CubeStation App 计时。');
    toast('此浏览器不支持蓝牙');
    return;
  }
  if (BLE.kind() === 'web' && !/^https?:/.test(location.protocol)) {
    ganSetStatus('现在是用"文件"方式打开的，浏览器会禁用蓝牙。请用附带的 <b>启动服务器.bat</b> 通过 http:// 打开。');
    toast('请用 http:// 方式打开');
    return;
  }

  ganSetStatus('正在搜索魔方…<br>先<b>拧一下白色面</b>唤醒魔方（白灯闪 3 下），并拿近一点。');

  let handle;
  try {
    handle = await BLE.scan(stage => {
      if (stage === 'rescan') ganSetStatus('还在找…把魔方拿近一点，拧一下白面唤醒它');
      if (stage === 'mac') ganSetStatus('正在读取魔方信息…');
    });
  } catch (err) {
    const m = (err && err.message) || String(err);
    let base;
    if (m.indexOf('SCAN_TIMEOUT') === 0) {
      base = '❌ 没找到魔方。' + m.slice('SCAN_TIMEOUT|'.length) +
        '<br>检查：① 拧白面唤醒（白灯闪3下）② 彻底退出 CubeStation ③ 蓝牙已开 '
        + '④ 设置→隐私与安全性→蓝牙，确认「魔方小将」有权限';
    } else if (m === 'BLUETOOTH_OFF') {
      base = '❌ 蓝牙没开：请到「设置 → 蓝牙」里打开';
    } else if (/cancel|NotFound/i.test(m)) {
      base = '已取消。再点一次「连接魔方」试试。';
    } else {
      base = '❌ 搜索失败：' + m;
    }
    ganSetStatus(base);
    /* 顺带把诊断结果贴出来，直接在真机上定位根源（插件注册 / 蓝牙状态） */
    try {
      const r = await BLE.diagnose();
      ganSetStatus(base + '<br><br><b>🔍 诊断</b><br>' +
        BLE.diagnoseText(r).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'));
    } catch (e) {}
    return;
  }

  ganSetStatus('找到 <b>' + (handle.name || '魔方') + '</b>，正在连接…');
  ganLastHandle = handle;

  /* MAC 获取链：广播自动读取 → 历史记录 → 手动输入 */
  let mac = handle.mac || loadGanMac(handle.name);
  if (!mac) mac = await ganAskMac(handle.name);
  if (!mac) { ganSetStatus('已取消。没有 MAC 就无法解密魔方数据。'); return; }
  saveGanMac(handle.name, mac);

  try {
    ganEnc = ganMakeEncrypter(mac);
  } catch (e) {
    ganSetStatus('❌ MAC 格式不对：' + e.message);
    return;
  }

  try {
    ganConn = await BLE.connect(handle, onGanPacket, onGanDisconnect);
  } catch (err) {
    const m = (err && err.message) || String(err);
    const hint = m === 'NO_GAN_SERVICE'
      ? '连上了，但找不到魔方的数据服务（可能不是 GAN 魔方，或魔方需要重新唤醒）'
      : m === 'NO_CHARACTERISTICS'
        ? '连上了，但数据通道为空（魔方可能睡着了，拧一下白面再连一次）'
        : m;
    ganSetStatus('❌ 连接失败：' + hint +
      '<br>常见原因：① 魔方被 <b>CubeStation</b> 占用——要「彻底退出」那个 App（从后台也划掉），必要时关一下再开蓝牙；② 魔方睡着了，拧一下白面唤醒。');
    return;
  }

  /* 按 GATT 服务判断协议代际（默认按最常见的 Gen2 处理） */
  const svc = (ganConn.service || '').toLowerCase();
  ganGen = svc === BLE.GAN_GEN2_SERVICE ? 2
        : (svc === BLE.GAN_GEN3_SERVICE ? 3
        : (svc === BLE.GAN_GEN4_SERVICE ? 4 : 2));
  ganParseState = { lastSerial: -1 };
  ganBattery = -1;

  /* 请求一次面块状态：GAN 协议必须先同步状态，之后才上报转动 */
  try {
    const cmd = ganCommand(ganGen, 'REQUEST_FACELETS');
    if (cmd) await ganConn.write(ganEnc.encrypt(cmd));
  } catch (e) {}

  /* 兜底：3 秒还没同步到状态就提示 */
  if (ganFaceletsTimer) clearTimeout(ganFaceletsTimer);
  ganFaceletsTimer = setTimeout(() => {
    if (ganParseState.lastSerial === -1 && ganConn) {
      ganSetStatus('⏳ 已连接，但魔方还没同步状态…拧一下魔方，或关掉 CubeStation 再连一次。');
    }
  }, 3000);

  ganSetStatus('✅ 已连接 <b>' + (handle.name || '魔方') + '</b>！<br>' +
               '现在拧真魔方，屏幕上的魔方会跟着转，并自动开始计时。');
  toast('已连接，拧一下试试');

  if (isSolved(pracCube) && currentPage === 'practice') pracScramble();
}

/* 数据包：解密 → 解析 → 应用 */
function onGanPacket(bytes) {
  if (!ganEnc) return;
  let plain;
  try { plain = ganEnc.decrypt(bytes); } catch (e) { return; }
  const bits = ganBits(plain);
  const out = [];
  try {
    if (ganGen === 2) ganGen2Parse(bits, ganParseState, out);
    else if (ganGen === 3) ganGen3Parse(bits, ganParseState, out);
    else ganGen4Parse(bits, ganParseState, out);
  } catch (e) { return; }

  for (const ev of out) {
    if (ev.type === 'MOVE') {
      const faceIdx = ev.face;
      if (faceIdx > 5) continue;
      const f = ganFaceMap[faceIdx] || GAN_FACE[faceIdx];
      /* 方向：0=顺时针 1=逆时针 2=180° */
      pracDo(f + (ev.direction === 2 ? '2' : (ev.direction === 1 ? "'" : '')));
    } else if (ev.type === 'BATTERY') {
      if (ev.level !== ganBattery) {
        ganBattery = ev.level;
        if (ganBattery <= 20) toast('🔋 魔方电量低了（' + ganBattery + '%），该换电池啦');
      }
    } else if (ev.type === 'DISCONNECT') {
      ganSetStatus('⚠️ 魔方主动断开了（可能关机了）。点「连接魔方」重新连一次。');
    }
  }
}

function onGanDisconnect() {
  ganConn = null;
  ganEnc = null;
  if (ganFaceletsTimer) { clearTimeout(ganFaceletsTimer); ganFaceletsTimer = null; }
  if (ganBackgroundRelease) { ganBackgroundRelease = false; return; }   /* 后台主动断开，不提示 */
  ganSetStatus('⚠️ 魔方断开了。点「连接魔方」重新连一次。');
  toast('魔方断开了');
}

/* ---------------- 手动输入 MAC（自动读取失败时的兜底） ---------------- */
function ganAskMac(name) {
  return new Promise((resolve) => {
    $('sheet').innerHTML =
      '<div class="sheet-head"><h3>🔑 需要魔方 MAC 地址</h3><button class="closex" onclick="ganMacCancel()">✕</button></div>'
      + '<div class="sub">每条 GAN 魔方的数据都是加密的，密钥由它的 <b>MAC 地址</b>生成。'
      + ' App 会尝试自动读取；读不到时才需要你手动输一次（以后同一条魔方会自动记住）。</div>'
      + '<div class="card" style="margin-top:10px;">'
      + '<div class="sub"><b>怎么找 MAC？</b></div>'
      + '<div class="sub">① 用另一部手机/电脑装 <b>nRF Connect</b> 或 LightBlue，连上魔方看设备详情<br>'
      + '② 或在电脑浏览器打开 <b>csTimer</b>（cstimer.de）用 GAN 魔方功能查看<br>'
      + '③ 格式：六组两位字符，如 <b>AB:12:34:00:27:97</b></div>'
      + '</div>'
      + '<input id="gan-mac-input" type="text" placeholder="AB:12:34:00:27:97" '
      + 'style="width:100%;margin-top:10px;padding:10px;border-radius:10px;border:1px solid #ccd;font-size:16px;" '
      + 'onkeydown="if(event.key===\'Enter\')ganMacConfirm()">'
      + '<div class="row center" style="margin-top:14px;gap:10px;">'
      + '<button class="btn" onclick="ganMacConfirm()">确定</button>'
      + '<button class="btn alt" onclick="ganMacCancel()">取消</button>'
      + '</div>';
    $('modal').classList.add('show');
    window._ganMacResolve = resolve;
    setTimeout(() => { const el = $('gan-mac-input'); if (el) el.focus(); }, 50);
  });
}
function ganMacConfirm() {
  const v = (($('gan-mac-input') || {}).value || '').trim().toUpperCase();
  if (!/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(v)) { toast('MAC 格式像 AB:12:34:00:27:97'); return; }
  closeModal();
  const r = window._ganMacResolve;
  window._ganMacResolve = null;
  if (r) r(v);
}
function ganMacCancel() {
  closeModal();
  const r = window._ganMacResolve;
  window._ganMacResolve = null;
  if (r) r(null);
}

/* ---------------- 模拟一步：验证「转动 → 计时 → 复原判定」链路 ---------------- */
function ganSimMove() {
  if (currentPage !== 'practice') { go('practice'); }
  if (isSolved(pracCube)) pracScramble();
  const f = pick(['U', 'R', 'F', 'L', 'D', 'B']);
  pracDo(f);
  toast('已模拟一步 ' + f + '（说明程序本身的链路是通的）');
}

/* ---------------- 校准方向 ---------------- */
const FACE_COLOR = { U:'#FFFFFF', D:'#FFD500', F:'#009E54', B:'#0051BA', R:'#E8121D', L:'#FF6A00' };

function ganCalibrate() {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
  const iso = '<div id="gan-iso-cube" style="width:230px;max-width:80%;margin:0 auto;"></div>'
    + '<div class="sub center" style="margin-top:8px;">六面颜色：<b>U 上</b>白 · <b>F 前</b>绿 · <b>R 右</b>红 · <b>D 下</b>黄 · <b>L 左</b>橙 · <b>B 后</b>蓝</div>';

  let rows = '';
  for (let i = 0; i < 6; i++) {
    const cur = ganFaceMap[i] || GAN_FACE[i];
    const opts = faces.map(f =>
      '<option value="' + f + '"' + (f === cur ? ' selected' : '') + '>' + FACE_NAME[f] + ' ' + f + '</option>'
    ).join('');
    rows += '<div class="row" style="align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef;">'
      + '<span class="sub">GAN 第 ' + (i + 1) + ' 面</span>'
      + '<span style="display:inline-flex;align-items:center;gap:8px;">'
      + '<i class="facesw" id="gan-swatch-' + i + '" style="background:' + FACE_COLOR[cur]
      + (cur === 'U' ? ';border:1px solid #ccc' : '') + '"></i>'
      + '<select id="ganmap-' + i + '" onchange="ganSwatch(' + i + ')">' + opts + '</select>'
      + '</span></div>';
  }

  $('sheet').innerHTML =
    '<div class="sheet-head"><h3>🧭 校准方向</h3><button class="closex" onclick="closeModal()">✕</button></div>'
    + '<div class="sub">对照下面的<b>轴测图</b>：上=白、前=绿、右=红。连上魔方后如果拧一个面，屏幕转的方向和手里<b>对不上</b>，就把「GAN 第 N 面」改成你魔方上<b>真正对应颜色</b>的那一面。</div>'
    + '<div class="card" style="margin-top:10px;">' + iso + '</div>'
    + '<div class="card" style="margin-top:10px;">' + rows + '</div>'
    + '<div class="sub" style="margin-top:8px;">改完点下面「应用并归零」，屏幕魔方会跟真魔方重新对齐。</div>'
    + '<div class="row center" style="margin-top:14px;gap:10px;">'
    + '<button class="btn" onclick="ganApplyCalib()">应用并归零</button>'
    + '<button class="btn alt" onclick="closeModal()">取消</button>'
    + '</div>';
  $('modal').classList.add('show');
  /* 渲染真实 3×3 魔方（每个面 9 格），供对照校准 */
  try { drawCube($('gan-iso-cube'), solvedCube(), { yaw: Math.PI/4, pitch: Math.PI/6 }); } catch (e) {}
}

function ganSwatch(i) {
  const sel = $('ganmap-' + i);
  const sw = $('gan-swatch-' + i);
  if (sel && sw) {
    const f = sel.value;
    sw.style.background = FACE_COLOR[f] || '#fff';
    sw.style.border = (f === 'U') ? '1px solid #ccc' : '1px solid #e0e0e0';
  }
}

function ganApplyCalib() {
  const next = [];
  for (let i = 0; i < 6; i++) {
    const v = $('ganmap-' + i);
    if (v) next.push(v.value);
  }
  if (new Set(next).size !== 6) { toast('每个面要对应不同的方向哦'); return; }
  ganFaceMap = next;
  saveGanMap();
  ganZero();
  closeModal();
  ganSetStatus('✅ 已校准方向并归零。现在拧真魔方，屏幕会朝正确的方向转。');
  toast('✅ 已校准并归零');
}

/* ---------------- 归零 / 重置 ---------------- */
function ganZero() {
  pracCube = solvedCube();
  pracMoves = 0;
  pracScrambleToks = [];
  if (typeof drawCube === 'function' && $('prac-3d')) drawCube($('prac-3d'), pracCube, {});
  if (typeof refreshPracUI === 'function') refreshPracUI();
  toast('↺ 已归零：请把真魔方也拧回复原状态，二者就同步了');
}

/* ---------------- 前后台自动连接 / 释放 ----------------
   目标：魔方只跟「正在前台使用」的这个 App 连。
   - 切到后台：主动断开，把魔方让给别的 App（或让魔方休眠）
   - 回到前台：用记住的设备直接重连（无需再扫描） */
async function ganReconnect(handle) {
  let mac = handle.mac || loadGanMac(handle.name);
  if (!mac) { pracConnectGAN(); return; }        /* 没记住 MAC → 走完整流程（会弹 MAC 框） */
  try { ganEnc = ganMakeEncrypter(mac); } catch (e) { pracConnectGAN(); return; }
  try {
    ganConn = await BLE.connect(handle, onGanPacket, onGanDisconnect);
  } catch (e) {
    ganConn = null;
    pracConnectGAN();                             /* 直接连失败（魔方睡着/ID 失效）→ 退回扫描 */
    return;
  }
  const svc = (ganConn.service || '').toLowerCase();
  ganGen = svc === BLE.GAN_GEN2_SERVICE ? 2
        : (svc === BLE.GAN_GEN3_SERVICE ? 3
        : (svc === BLE.GAN_GEN4_SERVICE ? 4 : 2));
  ganParseState = { lastSerial: -1 };
  ganBattery = -1;
  try {
    const cmd = ganCommand(ganGen, 'REQUEST_FACELETS');
    if (cmd) await ganConn.write(ganEnc.encrypt(cmd));
  } catch (e) {}
  if (ganFaceletsTimer) clearTimeout(ganFaceletsTimer);
  ganFaceletsTimer = setTimeout(() => {
    if (ganParseState.lastSerial === -1 && ganConn) {
      ganSetStatus('⏳ 已连接，但魔方还没同步状态…拧一下魔方，或关掉 CubeStation 再连一次。');
    }
  }, 3000);
  ganSetStatus('✅ 已重新连接 <b>' + (handle.name || '魔方') + '</b>！拧真魔方试试。');
  toast('已重新连接');
  if (isSolved(pracCube) && currentPage === 'practice') pracScramble();
}

function ganAppStateSetup() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      /* 切到后台：主动断开，释放魔方 */
      if (ganConn) {
        ganBackgroundRelease = true;
        try { ganConn.close(); } catch (e) {}
        ganConn = null;
        ganEnc = null;
        if (ganFaceletsTimer) { clearTimeout(ganFaceletsTimer); ganFaceletsTimer = null; }
        ganSetStatus('已切到后台，魔方已释放。回到前台会自动重连。');
      }
    } else {
      /* 回到前台：之前连过就自动重连 */
      if (ganLastHandle && !ganConn) {
        ganSetStatus('正在重新连接魔方…');
        ganReconnect(ganLastHandle);
      }
    }
  });
}
ganAppStateSetup();
