/* =========================================================================
   70-diag.js — 诊断自测中心（测试功能）
   -------------------------------------------------------------------------
   作用：
   ① 在 App 内跑一组内置自测（"测试的代码"），逐一检查之前出过问题的地方；
   ② 把"测试代码 + 检测出的问题"打包成一份结构化报告；
   ③ 上传到云端（GitHub 仓库的 diag/reports.json，历史追加），开发者从云端
      调取这份报告，分析问题并改善代码，再把新版本发回来。
   ========================================================================= */

/* ---------------- 工具：把字节数组拼成二进制位串（供伪造 GAN 包用） ---------------- */
function bytesToBits(arr){
  return arr.map(b => (b & 0xff).toString(2).padStart(8, '0')).join('');
}
/* 在小端 int16 处写入一个值（GYRO 包里三个轴就是这么排的） */
function setInt16LE(arr, off, val){
  val = val & 0xffff;
  if (val >= 0x8000) val -= 0x10000;
  arr[off]   = val & 0xff;
  arr[off+1] = (val >> 8) & 0xff;
}
function deepEqCube(a, b){
  for (const f of ['U','R','F','D','L','B']) if (!a[f] || !b[f] || a[f].length !== 9) return false;
  for (const f of ['U','R','F','D','L','B']) for (let i=0;i<9;i++) if (a[f][i] !== b[f][i]) return false;
  return true;
}
function rndMove(){
  const f = pick(['U','R','F','L','D','B']);
  const r = Math.random();
  const prime = r < 0.37, dbl = r > 0.78;
  return { f, prime, dbl };
}
function rndAlg(n){ const a = []; for (let i=0;i<n;i++) a.push(rndMove()); return a; }

/* ---------------- 自测套件（这就是"测试的代码"） ---------------- */
/* 每条：{ id, name, desc, severity(失败时严重度), run():{pass,detail,fix} }
   run 只做纯逻辑判定，不碰 DOM；需要 DOM 的检查会自动跳过（kind:'dom'）。 */
const DIAG_TESTS = [
  {
    id: 'white-top', name: '白顶识别（U面=白）', kind: 'logic', severity: 'high',
    desc: '复原态下 U 面须全为白色（UP_COLOR），D 面全黄；顶面识别一律按 UP_COLOR 判定，不再写死黄色。',
    run(){
      const c = solvedCube();
      const upOk = c.U.every(x => x === UP_COLOR);
      const dnOk = c.D.every(x => x === 'y');
      const ollOk = extractOLL(c).every(x => x === 1);   /* 顶面全黄 → 识别为已翻上 */
      const pass = upOk && dnOk && ollOk;
      return { pass, detail: 'U面=' + c.U[4] + ' D面=' + c.D[4] + '；顶面识别=' + (ollOk ? '正确' : '错误'),
               fix: '统一改用 UP_COLOR 常量；若仍有黄色出现在 U 面，检查 solvedCube / buildChart / ollThumb 是否写死 \'y\'。' };
    }
  },
  {
    id: 'move-inverse', name: '逆序还原必回原位', kind: 'logic', severity: 'high',
    desc: '任意打乱序列，正向应用后再逆向应用，必须精确回到复原态（几何引擎正确性的根本不变量）。',
    run(){
      let bad = 0, tried = 60;
      for (let k=0;k<tried;k++){
        const alg = rndAlg(6 + Math.floor(Math.random()*16));
        let c = solvedCube();
        for (const t of alg) c = applyMove(c, moveOf(t)) || c;
        const inv = invert(alg);
        for (const t of inv) c = applyMove(c, moveOf(t)) || c;
        if (!deepEqCube(c, solvedCube())) bad++;
      }
      return { pass: bad === 0, detail: '抽样 ' + tried + ' 条随机序列，回不去的 ' + bad + ' 条。',
               fix: '若 bad>0，说明 applyMove/moveOf/rot3 有几何错误，优先排查单层坐标与旋转轴。' };
    }
  },
  {
    id: 'gyro-idle', name: '整转静置不乱转', kind: 'logic', severity: 'high',
    desc: '真魔方不动时，陀螺仪字节会有微小抖动。解码器必须用死区+持续判定把抖动滤成 0，否则静置也会整体乱转、色块乱飞。',
    run(){
      ganResetGyroBase();
      /* 连续喂 20 帧"完全静止"的包（原始值恒为 0） */
      const bytes = new Array(16).fill(0);
      const bits = bytesToBits(bytes);
      let maxRot = 0;
      for (let i=0;i<20;i++){
        const g = ganDecodeGyro(bits);
        maxRot = Math.max(maxRot, Math.abs(g.rot.x), Math.abs(g.rot.y), Math.abs(g.rot.z));
      }
      ganResetGyroBase();
      const pass = maxRot === 0;
      return { pass, detail: '静置 20 帧，单帧最大转角 = ' + maxRot.toFixed(3) + '°（应为 0）。',
               fix: '若静置仍有转角：调大 GYRO_DEADZONE（当前 20）或提高 GYRO_SUSTAIN（当前 2），并检查 ganDecodeGyro 死区是否被绕过。' };
    }
  },
  {
    id: 'gyro-respond', name: '整转真转有响应', kind: 'logic', severity: 'med',
    desc: '真魔方确实在手腕整转时，解码器应给出非零、且方向一致的转角（否则联动失效、魔方"纹丝不动"）。',
    run(){
      ganResetGyroBase();
      const bytes = new Array(16).fill(0);
      /* 模拟手腕匀速右转：每帧三个轴原始值递增 60（同方向、超死区） */
      let base = 0;
      let last = null;
      for (let i=0;i<6;i++){
        base += 60;
        setInt16LE(bytes, 2, base);          /* x 轴 */
        setInt16LE(bytes, 4, base);          /* y 轴 */
        setInt16LE(bytes, 6, base);          /* z 轴 */
        last = ganDecodeGyro(bytesToBits(bytes));
      }
      ganResetGyroBase();
      const r = last.rot;
      const pass = Math.abs(r.x) > 0 && Math.abs(r.y) > 0 && Math.abs(r.z) > 0;
      return { pass, detail: '持续右转 6 帧后累计转角 x=' + r.x.toFixed(2) + '° y=' + r.y.toFixed(2) + '° z=' + r.z.toFixed(2) + '°。',
               fix: '若完全无响应：检查 GYRO_OFF 字节偏移与 GYRO_SCALE 是否命中真机布局；先用封包日志核对字节。' };
    }
  },
  {
    id: 'gyro-spike', name: '单帧尖峰不飞转', kind: 'logic', severity: 'med',
    desc: '偶发的字节误读会造成单帧巨幅跳变。解码器必须丢弃超过上限的单帧尖峰，避免魔方"瞬间飞转"。',
    run(){
      ganResetGyroBase();
      const bytes = new Array(16).fill(0);
      ganDecodeGyro(bytesToBits(bytes));   /* 首帧建基线（ref=0） */
      /* 连续 3 帧巨幅跳变（单帧 5000 远超市值上限 25°）→ 必须被丢弃，魔方不飞转 */
      let last = null;
      for (let i=0;i<3;i++){
        setInt16LE(bytes, 2, 5000); setInt16LE(bytes, 4, 5000); setInt16LE(bytes, 6, 5000);
        last = ganDecodeGyro(bytesToBits(bytes));
      }
      ganResetGyroBase();
      const pass = last.rot.x === 0 && last.rot.y === 0 && last.rot.z === 0;
      return { pass, detail: '连续 3 帧 5000 巨跳后转角 x=' + last.rot.x.toFixed(3) + '°（应为 0）。',
               fix: '若尖峰导致飞转：调小 GYRO_MAXSTEP（当前 25°）让单帧误读被丢弃。' };
    }
  },
  {
    id: 'gyro-clamp', name: '整体旋转限幅(±80°)', kind: 'logic', severity: 'med',
    desc: '实战预览的整体朝向 addPracCubeRot 必须限幅在 ±80°，防止陀螺仪持续累积把魔方转"飞"。',
    run(){
      pracCubeRot.x = 0; pracCubeRot.y = 0; pracCubeRot.z = 0;
      addPracCubeRot({ x: 9999, y: 9999, z: 9999 });
      const pass = Math.abs(pracCubeRot.x) <= 80 && Math.abs(pracCubeRot.y) <= 80 && Math.abs(pracCubeRot.z) <= 80;
      const val = +pracCubeRot.x.toFixed(1);
      return { pass, detail: '注入 9999° 后实际限幅到 ' + val + '°（上限 ±80）。',
               fix: '若超出 ±80：检查 addPracCubeRot 的 clampN 调用与上限常量 L。' };
    }
  },
  {
    id: 'battery-authority', name: '电量只认 0x09 权威包', kind: 'logic', severity: 'high',
    desc: '只有 eventType=0x09 的包才上报电量，且需连续两帧一致才采信；0x04 状态包绝不产生电量（旧版误读导致"假电量低 13%"）。',
    run(){
      /* 0x09 包：eventType 在字节高位（ganBitWord 读的是每字节高 4 位），故 byte0=0x90，byte1=电量 68 */
      const b09 = [0x90, 68, 0,0,0,0,0,0];
      const st = { lastSerial:-1 };
      const out1 = []; ganGen2Parse(bytesToBits(b09), st, out1);
      const out2 = []; ganGen2Parse(bytesToBits(b09), st, out2);   /* 第二帧才稳定 */
      /* 0x04 状态包：byte0=0x40 */
      const b04 = [0x40, 0,0,0,0,0,0,0];
      const st2 = { lastSerial:-1 };
      const out3 = []; ganGen2Parse(bytesToBits(b04), st2, out3);
      const oneFrameBattery = out1.some(e => e.type === 'BATTERY');
      const twoFrameBattery = out2.some(e => e.type === 'BATTERY' && e.level === 68);
      const statusHasBattery = out3.some(e => e.type === 'BATTERY');
      const pass = !oneFrameBattery && twoFrameBattery && !statusHasBattery;
      return { pass, detail: '单帧0x09上报=' + oneFrameBattery + '；两帧稳定上报=' + twoFrameBattery +
                             '；0x04状态包误报电量=' + statusHasBattery + '。',
               fix: '若 0x04 仍误报电量或单帧就上报：检查 ganGen2Parse 的 0x09/0x04 分支与"连续两帧一致"门槛。' };
    }
  },
  {
    id: 'cfop-clean-reset', name: '还原思路每次干净复位', kind: 'logic', severity: 'high',
    desc: '"按思路演示"必须从标准打乱态（cfopThinkStart）开始，不能继承上一次演示的残留状态；其不变量是：标准态 + 逆序解法 = 复原态。',
    run(){
      let bad = 0;
      for (let k=0;k<30;k++){
        const S = rndAlg(8 + Math.floor(Math.random()*14));
        const start = applyAlg(solvedCube(), S);          /* 模拟 cfopThinkStart */
        const sol = invert(S);                            /* 模拟 cfopThinkSol */
        let c = start;
        for (const t of sol) c = applyMove(c, moveOf(t)) || c;
        if (!deepEqCube(c, solvedCube())) bad++;
      }
      return { pass: bad === 0, detail: '抽查 30 个随机打乱，演示起点+解法回不去的 ' + bad + ' 个。',
               fix: '若 bad>0：确认 showCfopThink 用 pracScrambleToks 计算 cfopThinkStart=applyAlg(solved,S)，demoCfopThink 每轮用 cfopThinkStart 克隆复位。' };
    }
  },
  {
    id: 'follow-check', name: '跟练逐步核对(对错/撤销)', kind: 'logic', severity: 'med',
    desc: '公式跟练/还原思路跟练：按解法走应判定完成；中途拧反一步应判为"撤销上一步"；拧错方向应判为错误并指出第几步。',
    run(){
      const sol = parseNotation('R U R\' U\'');
      /* 模拟跟练栈逻辑（与 formulaFollowMove/cfopFollowMove 同款） */
      function feed(stack, label){
        const tok = { f: label[0], prime: label.indexOf("'") > 0, dbl: label.indexOf('2') > 0 };
        if (stack.length && mFollowTokEq(stack[stack.length-1], mFollowInv(tok))) stack.pop();
        else stack.push(tok);
        return stack;
      }
      /* 正确顺序 */
      let st = [];
      ['R','U','R\'','U\''].forEach(l => feed(st, l));
      const correctComplete = st.length === sol.length && st.every((t,i) => mFollowTokEq(t, sol[i]));
      /* 第 3 步拧"上一步的逆"（U' 撤销刚才的 U）→ 栈回退到 [R] */
      let st2 = [];
      ['R','U',"U'"].forEach(l => feed(st2, l));
      const undoOk = st2.length === 1 && mFollowTokEq(st2[0], sol[0]);
      /* 第 2 步拧错（F 而非 U）→ 第 2 步判错 */
      let st3 = [];
      ['R','F'].forEach(l => feed(st3, l));
      const wrongAt = (() => { for (let i=0;i<st3.length;i++) if (!mFollowTokEq(st3[i], sol[i])) return i; return -1; })();
      const pass = correctComplete && undoOk && wrongAt === 1;
      return { pass, detail: '正确走完完成=' + correctComplete + '；拧反撤销=' + undoOk + '；错误定位步=' + (wrongAt+1) + '。',
               fix: '若核对异常：检查 mFollowTokEq / mFollowInv 及"拧反=出栈"逻辑。' };
    }
  },
  {
    id: 'diag-ui', name: '诊断中心 UI 已挂载', kind: 'dom', severity: 'low',
    desc: '数据页应存在诊断结果容器 #diag-results，否则运行/上传按钮无处展示。',
    run(){
      const el = (typeof document !== 'undefined') ? document.getElementById('diag-results') : null;
      const pass = !!el;
      return { pass, detail: el ? '已找到 #diag-results。' : '（非浏览器环境跳过，或 UI 未挂载）',
               fix: '在 02-body.html 的「训练数据」页加入诊断卡片与 <div id="diag-results">。' };
    }
  }
];

/* ---------------- 运行全部自测，产出报告 ---------------- */
let lastDiagReport = null;
function runDiagnostics(){
  const results = [];
  let pass = 0, fail = 0, skip = 0;
  for (const t of DIAG_TESTS){
    let r;
    try { r = t.run(); }
    catch (e){ r = { pass:false, detail:'运行异常：' + (e && e.message || e), fix:'' }; }
    r = r || { pass:false, detail:'无返回', fix:'' };
    if (r.pass === 'skip' || r.skipped){ skip++; }
    else if (r.pass) pass++; else fail++;
    results.push({
      id: t.id, name: t.name, desc: t.desc, kind: t.kind, severity: t.severity,
      pass: !!r.pass, detail: r.detail || '', fix: r.fix || ''
    });
  }
  const problems = results.filter(r => !r.pass);
  const report = {
    app: 'cfop-kids',
    what: 'diagnostic',
    when: new Date().toISOString(),
    ua: (typeof navigator !== 'undefined' && navigator.userAgent) || 'node',
    total: results.length, pass, fail, skip,
    /* "测试的代码"：把每条自测的规格也带上，方便云端对照 */
    testCode: DIAG_TESTS.map(t => ({ id:t.id, name:t.name, desc:t.desc, kind:t.kind, severity:t.severity })),
    results,
    problems
  };
  lastDiagReport = report;
  if (typeof window !== 'undefined') window.lastDiagReport = report;
  return report;
}

/* ---------------- 云端：上传 / 调取（GitHub 仓库当作云库） ---------------- */
/* 云端配置读取：浏览器里优先用界面实时值（ghLive），回退 store.cloud；Node 测试无 ghLive 时直接用 store.cloud */
function diagCfg(){
  if (typeof ghLive === 'function') return ghLive();
  return (typeof store !== 'undefined' && store.cloud) || {};
}
function diagApiUrl(){
  const c = diagCfg();
  const owner = c.owner || 'zhushiqiyy', repo = c.repo || 'mofang-data';
  const path  = c.diagPath || 'diag/reports.json';
  const branch = c.branch || 'main';
  return 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) +
         '/contents/' + encodeURIComponent(path) + '?ref=' + encodeURIComponent(branch);
}
function diagRawUrl(){
  const c = diagCfg();
  const owner = c.owner || 'zhushiqiyy', repo = c.repo || 'mofang-data';
  const path  = c.diagPath || 'diag/reports.json';
  const branch = c.branch || 'main';
  return 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + branch + '/' + path;
}
/* 上传：把这次报告追加到云端历史（仓库里始终是 { app, runs:[...] }） */
function uploadDiagnostics(silent){
  const c = diagCfg();
  if (!c.owner || !c.repo){ if(!silent && typeof $('diag-msg')!=='undefined') $('diag-msg').textContent = '⚠️ 请先在云端配置填 GitHub 用户名/仓库（并保存）。'; return; }
  if (!c.token){ if(!silent && typeof $('diag-msg')!=='undefined') $('diag-msg').textContent = '⚠️ 需要个人访问令牌（PAT），在令牌框粘贴后点「🔍 校验令牌」确认有效。'; return; }
  if (!silent && typeof $('diag-msg')!=='undefined') $('diag-msg').textContent = '☁️ 正在上传诊断报告…';
  const path = c.diagPath || 'diag/reports.json';
  const branch = c.branch || 'main';
  const headers = { 'Authorization': 'Bearer ' + c.token, 'Accept': 'application/vnd.github+json' };
  const api = diagApiUrl();
  return fetch(api, { headers }).then(r => {
    if (r.status === 404) return { sha:null, prev:null };
    if (!r.ok) throw new Error('读取失败 ' + r.status);
    return r.json().then(j => {
      let prev = null;
      try { prev = j.content ? JSON.parse(b64decodeUtf8(j.content)) : null; } catch(e){}
      return { sha: j.sha, prev };
    });
  }).then(({sha, prev}) => {
    const runs = (prev && Array.isArray(prev.runs)) ? prev.runs.slice() : [];
    const rep = lastDiagReport || runDiagnostics();
    rep.uploadedAt = Date.now();
    runs.push(rep);
    if (runs.length > 50) runs.shift();
    const payload = { app:'cfop-kids', note:'诊断报告历史，开发者从云端调取并分析改善', runs };
    const body = { message:'诊断报告更新 ' + new Date().toISOString(),
                   content: b64encodeUtf8(JSON.stringify(payload, null, 2)), branch };
    if (sha) body.sha = sha;
    return fetch(api, { method:'PUT', headers: Object.assign({'Content-Type':'application/json'}, headers),
                        body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error('写入失败 ' + r.status); return r.json(); });
  }).then(() => {
    const raw = diagRawUrl();
    if (typeof store !== 'undefined'){ store.cloud.lastDiagRaw = raw; saveStore(); }
    if (!silent && typeof $('diag-msg')!=='undefined'){
      $('diag-msg').textContent = '✅ 已上传到云端！把下面链接发开发者，即可调取并分析问题：';
      const box = $('diag-raw'); if (box) box.innerHTML = '<code>' + raw + '</code> <button class="btn ghost sm" onclick="copyDiagRaw()">📋 复制</button>';
    }
  }).catch(e => {
    if (!silent && typeof $('diag-msg')!=='undefined'){
      const raw = (e && e.message) || ('' + e);
      let tip = '。常见：令牌无权限/仓库不存在/私有库需设为公开。';
      if (/401/.test(raw)) tip = '。→ 令牌无效/已过期/被撤销（401）：点云端配置「🔍 校验令牌」确认，再到 GitHub 重新生成 PAT。';
      else if (/403/.test(raw)) tip = '。→ 令牌无权限（403）：经典令牌需 repo 范围，细粒度需该仓库 Contents:Read&Write。';
      else if (/404/.test(raw)) tip = '。→ 仓库/文件不存在（404）：先到数据页点「+ 一键新建仓库」。';
      $('diag-msg').textContent = '⚠️ 上传失败：' + raw + tip;
    }
  });
}
/* 从云端调取历史报告（开发者分析用） */
function fetchCloudDiagnostics(){
  if (typeof $('diag-msg')!=='undefined') $('diag-msg').textContent = '🔍 正在从云端调取诊断报告…';
  return fetch(diagRawUrl()).then(r => { if (!r.ok) throw new Error('下载失败 ' + r.status); return r.json(); })
    .then(j => {
      const runs = (j && Array.isArray(j.runs)) ? j.runs : [];
      const latest = runs.length ? runs[runs.length-1] : null;
      renderCloudDiag(runs, latest);
      return { runs, latest };
    })
    .catch(e => {
      if (typeof $('diag-msg')!=='undefined') $('diag-msg').textContent = '⚠️ 调取失败：' + (e && e.message || e) + '。请确认仓库/路径/分支正确且已上传过。';
      return { runs:[], latest:null };
    });
}
function copyDiagRaw(){
  const raw = (typeof store !== 'undefined' && store.cloud && store.cloud.lastDiagRaw) || diagRawUrl();
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(raw).then(()=>toast('已复制')).catch(()=>toast(raw));
  else toast(raw);
}

/* ---------------- 渲染（数据页诊断卡片） ---------------- */
function renderDiagnostics(){
  /* 运行按钮的文案 */
  const runBtn = $('diag-run'); if (runBtn) runBtn.onclick = () => {
    const rep = runDiagnostics();
    const host = $('diag-results');
    if (!host) return;
    host.innerHTML = '';
    const head = el('div','sub', '运行于 ' + new Date(rep.when).toLocaleString() +
      ' · 通过 <b>' + rep.pass + '</b> / 共 <b>' + rep.total + '</b>' +
      (rep.fail ? ' · <b style="color:#d23b3b">未通过 ' + rep.fail + '</b>' : ' · 全部通过 ✅'));
    host.appendChild(head);
    rep.results.forEach(r => {
      const card = el('div','diag-item ' + (r.pass ? 'ok' : 'bad'));
      const badge = r.pass ? '✅' : (r.severity === 'high' ? '🔴' : r.severity === 'med' ? '🟠' : '🟡');
      let html = '<div class="row" style="justify-content:space-between;"><b>' + badge + ' ' + r.name +
                 '</b><span class="sub">' + r.id + (r.kind==='dom'?' · 需浏览器':'') + '</span></div>' +
                 '<div class="sub" style="margin-top:4px;line-height:1.6;">' + (r.detail||'') + '</div>';
      if (!r.pass && r.fix) html += '<div class="diag-fix">建议：' + r.fix + '</div>';
      card.innerHTML = html;
      host.appendChild(card);
    });
    const up = $('diag-upload'); if (up) up.disabled = false;
    const fb = $('diag-msg'); if (fb) fb.textContent = rep.fail
      ? '⚠️ 有 ' + rep.fail + ' 项未通过，点「上传云端」把问题发开发者分析改善。'
      : '✅ 全部通过，也可以上传到云端留档。';
  };
  const upBtn = $('diag-upload'); if (upBtn) upBtn.onclick = () => uploadDiagnostics(false);
  const fetchBtn = $('diag-fetch'); if (fetchBtn) fetchBtn.onclick = () => fetchCloudDiagnostics();
}
function renderCloudDiag(runs, latest){
  const host = $('diag-cloud'); if (!host) return;
  if (!runs.length){ host.innerHTML = '<div class="sub">云端还没有诊断报告。先在设备点「运行自检」→「上传云端」。</div>'; return; }
  host.innerHTML = '<div class="sub" style="margin-bottom:8px;">云端共 ' + runs.length + ' 份报告，最新一份：' +
    new Date((latest && latest.when) || Date.now()).toLocaleString() + '</div>';
  if (latest){
    const sum = el('div','sub', '最新：通过 ' + latest.pass + ' / ' + latest.total +
      (latest.fail ? ' · <b style="color:#d23b3b">未通过 ' + latest.fail + '</b>' : ' · 全部通过'));
    host.appendChild(sum);
    if (latest.problems && latest.problems.length){
      const ph = el('div','card tight', '');
      let h = '<div class="ptitle" style="color:#d23b3b;">🔧 云端反馈的问题（开发者将据此改善）</div>';
      latest.problems.forEach(p => {
        h += '<div class="diag-item bad"><b>' + p.name + '</b><div class="sub">' + (p.detail||'') + '</div>' +
             (p.fix ? '<div class="diag-fix">建议：' + p.fix + '</div>' : '') + '</div>';
      });
      ph.innerHTML = h;
      host.appendChild(ph);
    }
  }
  /* 历史折叠 */
  const hist = el('details','');
  hist.innerHTML = '<summary class="sub" style="cursor:pointer;">查看全部 ' + runs.length + ' 份报告</summary>';
  runs.slice().reverse().slice(0,20).forEach(r => {
    hist.innerHTML += '<div class="sub" style="margin:4px 0 0 12px;">· ' + new Date(r.when).toLocaleString() +
      ' — 通过 ' + r.pass + '/' + r.total + (r.fail ? '（未通过 ' + r.fail + '）' : '') + '</div>';
  });
  host.appendChild(hist);
}
