/* =========================================================================
   60-gan.js — GAN356i 蓝牙接入（Web Bluetooth）
   说明：不同固件的数据包格式略有差异，这里实现的是 GAN 通用协议（0x55 0x01 头）。
        连上后若转动无反应，请把浏览器控制台里的十六进制日志反馈出来。
   ========================================================================= */

const GAN_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
];
/* GAN 面序号 -> 我们的记号（可被「校准」改写） */
const GAN_FACE = ['U','R','F','D','L','B'];

/* 校准：不同固件上报的"面序号"顺序可能不同，这里让用户可以重新对应 */
function loadGanMap(){
  try {
    const a = JSON.parse(localStorage.getItem('gan_face_map'));
    if (Array.isArray(a) && a.length === 6) return a;
  } catch(e){}
  return GAN_FACE.slice();
}
let ganFaceMap = loadGanMap();
function saveGanMap(){ try { localStorage.setItem('gan_face_map', JSON.stringify(ganFaceMap)); } catch(e){} }

let ganDevice = null;
let ganChars = null;

function ganSetStatus(html){
  const e = $('gan-status');
  if (e) e.innerHTML = html;
}

function ganSupported(){
  return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
}

function pracConnectGAN(){
  if (!ganSupported()){
    const msg = '这个浏览器不支持网页蓝牙（iPhone / iPad 的 Safari 是<b>不支持</b>的）。' +
                '请用 <b>Chrome / Edge</b> 打开，或者直接用官方 CubeStation App 计时。';
    ganSetStatus(msg);
    toast('此浏览器不支持蓝牙');
    return;
  }
  if (!/^https?:/.test(location.protocol)){
    ganSetStatus('现在是用"文件"方式打开的，浏览器会禁用蓝牙。请用附带的 <b>启动服务器.bat</b> 通过 http:// 打开。');
    toast('请用 http:// 方式打开');
    return;
  }

  ganSetStatus('正在搜索魔方…（请在弹窗里选中你的 GAN356i）');

  navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: 'GAN' }, { namePrefix: 'Gan' }, { namePrefix: 'MG' },
      { namePrefix: 'Mi' },  { namePrefix: 'Moyu' }, { namePrefix: 'QYSC' }
    ],
    optionalServices: GAN_SERVICES
  }).then(device => {
    ganDevice = device;
    ganSetStatus('找到 ' + (device.name || '魔方') + '，正在连接…');
    return device.gatt.connect();
  }).then(server => {
    /* 依次尝试已知 service */
    const tryNext = (i) => {
      if (i >= GAN_SERVICES.length) throw new Error('没有找到可用的蓝牙服务');
      return server.getPrimaryService(GAN_SERVICES[i]).then(svc => {
        return svc.getCharacteristics().then(list => {
          const notify = list.find(c => c.properties.notify || c.properties.indicate);
          const write  = list.find(c => c.properties.write || c.properties.writeWithoutResponse);
          if (!notify) throw new Error('no notify');
          return { notify, write };
        });
      }).catch(() => tryNext(i + 1));
    };
    return tryNext(0);
  }).then(chars => {
    ganChars = chars;
    return chars.notify.startNotifications().then(() => chars);
  }).then(chars => {
    chars.notify.addEventListener('characteristicvaluechanged', ganOnPacket);

    if (ganDevice.addEventListener){
      ganDevice.addEventListener('gattserverdisconnected', () => {
        ganSetStatus('⚠️ 魔方断开了。点"连接魔方"重新连一次。');
      });
    }

    ganSetStatus('✅ 已连接 <b>' + (ganDevice.name || 'GAN356i') + '</b>！<br>' +
                 '现在拧真魔方，屏幕上的魔方会跟着转，并自动开始计时。');
    toast('已连接，拧一下试试');

    /* 若当前是已复原状态，先打乱，方便观察 */
    if (isSolved(pracCube) && currentPage === 'practice') pracScramble();
  }).catch(err => {
    ganSetStatus('❌ 连接失败：' + (err && err.message ? err.message : err) + '<br>' +
                 '常见原因：① 魔方没开机 ② 被 CubeStation 占用 ③ 不是 Chrome/Edge ④ 没用 http:// 打开');
  });
}

/* 数据包解析：GAN 通用 0x55 0x01 头，第 3~9 字节每字节含两个 nibble 动作 */
function ganOnPacket(ev){
  const dv = ev.target.value;
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  const moves = ganDecode(bytes);
  moves.forEach(m => pracDo(m));
}

function ganDecode(bytes){
  const out = [];
  /* 找到 0x55 0x01 起始 */
  let start = -1;
  for (let i=0;i<bytes.length-2;i++){
    if (bytes[i] === 0x55 && bytes[i+1] === 0x01){ start = i; break; }
  }
  if (start < 0) return out;

  const base = start + 3;
  for (let i=0;i<7;i++){
    const b = bytes[base + i];
    if (b === undefined) break;
    /* 每个字节两个动作 */
    [ (b >> 4) & 0x0f, b & 0x0f ].forEach(nib => {
      if (nib === 0x0f || nib === 0x00) return;
      const faceIdx = (nib >> 1) & 0x07;
      const dir = nib & 0x01;
      if (faceIdx > 5) return;
      const f = ganFaceMap[faceIdx] || GAN_FACE[faceIdx];
      out.push(f + (dir ? "'" : ''));
    });
  }
  return out;
}

/* 模拟一步：用于验证"转动 → 计时 → 复原判定"这条链路是否正常 */
function ganSimMove(){
  if (currentPage !== 'practice'){ go('practice'); }
  if (isSolved(pracCube)) pracScramble();
  const f = pick(['U','R','F','L','D','B']);
  pracDo(f);
  toast('已模拟一步 ' + f + '（说明程序本身的链路是通的）');
}

/* 校准方向：把「GAN 第 N 面」对应到你魔方上真正的那一面 */
function ganCalibrate(){
  const faces = ['U','R','F','D','L','B'];
  let rows = '';
  for (let i=0;i<6;i++){
    const cur = ganFaceMap[i] || GAN_FACE[i];
    const opts = faces.map(f =>
      '<option value="' + f + '"' + (f === cur ? ' selected' : '') + '>' + FACE_NAME[f] + ' ' + f + '</option>'
    ).join('');
    rows += '<div class="cal-row"><span>GAN 第 ' + (i+1) + ' 面 →</span><select id="ganmap-' + i + '">' + opts + '</select></div>';
  }
  $('sheet').innerHTML =
    '<div class="sheet-head"><h3>🧭 校准方向</h3><button class="closex" onclick="closeModal()">✕</button></div>'
    + '<div class="sub">连上魔方后，如果每拧一个面，屏幕上转的方向和手里的<b>不一样</b>，就把「GAN 第 N 面」对应到你魔方上真正的那一面。</div>'
    + '<div class="card" style="margin-top:10px;">' + rows + '</div>'
    + '<div class="sub" style="margin-top:8px;">改完点下面「应用并归零」，屏幕魔方会跟真魔方重新对齐。</div>'
    + '<div class="row center" style="margin-top:14px;gap:10px;">'
      + '<button class="btn" onclick="ganApplyCalib()">应用并归零</button>'
      + '<button class="btn alt" onclick="closeModal()">取消</button>'
    + '</div>';
  $('modal').classList.add('show');
}

function ganApplyCalib(){
  const next = [];
  for (let i=0;i<6;i++){
    const v = $('ganmap-' + i);
    if (v) next.push(v.value);
  }
  if (new Set(next).size !== 6){ toast('每个面要对应不同的方向哦'); return; }
  ganFaceMap = next;
  saveGanMap();
  ganZero();
  closeModal();
  ganSetStatus('✅ 已校准方向并归零。现在拧真魔方，屏幕会朝正确的方向转。');
  toast('✅ 已校准并归零');
}

/* 归零/重置：把屏幕魔方重置成复原状态，与真魔方重新同步
   （前提是此时真魔方也处于复原状态；若不是，请先把真魔方拧回原样再点） */
function ganZero(){
  pracCube = solvedCube();
  pracMoves = 0;
  pracScrambleToks = [];
  if (typeof drawCube === 'function' && $('prac-3d')) drawCube($('prac-3d'), pracCube, {});
  if (typeof refreshPracUI === 'function') refreshPracUI();
  toast('↺ 已归零：请把真魔方也拧回复原状态，二者就同步了');
}
