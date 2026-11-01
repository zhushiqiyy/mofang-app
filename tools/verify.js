/* tools/verify.js — 用 CDP 驱动整个 App，逐页校验渲染与无报错
   用法: node tools/verify.js
   输出 JSON 汇总 + 每页截图到 shots/verify-*.png
*/
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = __dirname.replace(/[\\/]tools$/, '');
const URL = 'http://127.0.0.1:8080/index.html?diag=1';
const W = 430, H = 932;

function getJSON(u){ return new Promise((res,rej)=>{ http.get(u,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})}).on('error',rej); }); }

(async () => {
  const list = await getJSON('http://127.0.0.1:9222/json');
  const target = list.find(t => t.type === 'page') || list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const exceptions = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown'){ exceptions.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || 'exception'); }
  };
  await new Promise(r => ws.onopen = r);

  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, m => m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:2, mobile:true, screenWidth:W, screenHeight:H });

  await send('Page.navigate', { url: URL });
  await sleep(1800);

  // 注入辅助函数
  await send('Runtime.evaluate', { expression: `
    window.__cube = function(sel){
      const host = document.querySelector(sel);
      if(!host) return {found:false};
      const svg = host.querySelector('svg');
      if(!svg) return {found:true, svg:false};
      const polys = svg.querySelectorAll('polygon');
      let base=0, sticker=0;
      polys.forEach(p=>{ if(p.getAttribute('fill')==='#20293a') base++; else sticker++; });
      return {found:true, svg:true, total:polys.length, base, sticker};
    };
    window.__planar = function(sel){
      const host = document.querySelector(sel);
      if(!host) return {found:false};
      return {found:true, cells: host.querySelectorAll('.facegrid > i').length};
    };
    window.__chart = function(sel){
      const host = document.querySelector(sel);
      if(!host) return {found:false};
      return {found:true, cellbox: host.querySelectorAll('.cellbox').length, label: host.querySelectorAll('.chart-label').length, divs: host.querySelectorAll('div').length};
    };
    window.__overflow = function(){
      const W = document.documentElement.clientWidth;
      const bad = [];
      document.querySelectorAll('*').forEach(el=>{
        const r = el.getBoundingClientRect();
        if (r.width > W + 1.5 && r.height > 0) bad.push((el.id||el.className||el.tagName)+':'+Math.round(r.width));
      });
      return { view:W, body:document.body.scrollWidth, doc:document.documentElement.scrollWidth, bad:bad.slice(0,8) };
    };
    window.__opts = function(sel){ const h=document.querySelector(sel); return h?h.querySelectorAll('.opt,button.opt').length:0; };
    window.__count = function(sel){ const h=document.querySelector(sel); return h?h.querySelectorAll('*').length:0; };
  `});

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails){ const d = (r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text; exceptions.push('['+expr.slice(0,40)+'] '+d); }
    return r.result ? r.result.value : null;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format:'png' });
    fs.writeFileSync(path.join(ROOT,'shots',name), Buffer.from(r.data,'base64'));
  };

  const R = {};
  const nav = async (page) => { await ev(`go('${page}')`); await sleep(700); };

  // 0. 启动后首页
  R.home = await ev(`(function(){ go('home'); return window.__overflow(); })()`);
  await shot('verify-home.png');

  // 1. 地图
  await nav('map');
  R.map = await ev(`(function(){ return {cards: document.querySelectorAll('#map-phases .card').length, overflow: window.__overflow()}; })()`);
  await shot('verify-map.png');

  // 2. 记号营 (双视图)
  await nav('notes');
  await sleep(300);
  R.notes = await ev(`(function(){
    return {
      cube: window.__cube('#note-3d'),
      planar: window.__planar('#note-planar'),
      quiz: window.__cube('#note-quiz-3d'),
      opts: window.__opts('#note-quiz-opts'),
      overflow: window.__overflow()
    };
  })()`);
  await shot('verify-notes.png');

  // 3. 公式库 + 弹窗（F2L / OLL / PLL）
  await nav('lib');
  await sleep(300);
  R.lib = await ev(`(function(){ return { cards: document.querySelectorAll('#lib-grid .gcard').length, overflow: window.__overflow() }; })()`);
  await shot('verify-lib.png');

  await ev(`openFormula('F2L', 1)`); await sleep(500);
  R.modalF2L = await ev(`(function(){ return { cube: window.__cube('#m-3d'), planar: window.__planar('#m-planar'), chunks: document.querySelectorAll('#m-chunks .chunk').length, overflow: window.__overflow() }; })()`);
  await shot('verify-modal-f2l.png');
  await ev(`closeModal()`); await sleep(300);

  await ev(`openFormula('OLL', 1)`); await sleep(500);
  R.modalOLL = await ev(`(function(){ return { cube: window.__cube('#m-3d'), chart: window.__chart('#m-chart'), chunks: document.querySelectorAll('#m-chunks .chunk').length, overflow: window.__overflow() }; })()`);
  await shot('verify-modal-oll.png');
  await ev(`closeModal()`); await sleep(300);

  await ev(`openFormula('PLL', DATA.PLL.find(x=>x.name==='Ua').num)`); await sleep(500);
  R.modalPLL = await ev(`(function(){ return { cube: window.__cube('#m-3d'), chart: window.__chart('#m-chart'), chunks: document.querySelectorAll('#m-chunks .chunk').length, overflow: window.__overflow() }; })()`);
  await shot('verify-modal-pll.png');
  await ev(`closeModal()`); await sleep(300);

  // 4. 关联练习 (易混对子)
  await nav('relate');
  await sleep(500);
  R.relate = await ev(`(function(){
    return {
      main: window.__cube('#relate-3d'),
      pair0: window.__cube('#pair-0'),
      pair1: window.__cube('#pair-1'),
      opts: window.__opts('#relate-opts'),
      overflow: window.__overflow()
    };
  })()`);
  await shot('verify-relate.png');

  // 5. 闯关之路
  await nav('quest');
  await sleep(400);
  R.quest = await ev(`(function(){ return { levels: document.querySelectorAll('#quest-stages .lv').length, stages: document.querySelectorAll('#quest-stages .stage').length, overflow: window.__overflow() }; })()`);
  await shot('verify-quest.png');
  // 打开第一关并进入答题
  await ev(`questIntro(ALL_LEVELS[0]); questStart('forest-1')`); await sleep(700);
  R.questPlay = await ev(`(function(){ return { cube: window.__cube('#q-3d'), opts: window.__opts('#q-opts'), prog: (document.querySelector('#q-prog')||{}).textContent, overflow: window.__overflow() }; })()`);
  await shot('verify-quest-play.png');
  await ev(`questQuit()`); await sleep(300);

  // 6. 实战 + 人机对战
  await nav('practice');
  await sleep(500);
  R.practice = await ev(`(function(){ return { cube: window.__cube('#prac-3d'), diffs: document.querySelectorAll('#diff-sel .diff').length, overflow: window.__overflow() }; })()`);
  await shot('verify-practice.png');
  await ev(`battleStart()`); await sleep(800);
  R.battle = await ev(`(function(){ return { active: (typeof battle!=='undefined' && battle.active), aiText: (document.querySelector('#bt-ai')||{}).textContent, startDisabled: (document.querySelector('#bt-start')||{}).disabled, overflow: window.__overflow() }; })()`);
  await shot('verify-battle.png');
  await ev(`battleQuit()`); await sleep(300);

  // 7. 感知训练（三种）
  await nav('sense');
  await sleep(300);
  R.senseEntry = await ev(`(function(){ return { overflow: window.__overflow() }; })()`);
  await ev(`senseStart('face')`); await sleep(600);
  R.senseFace = await ev(`(function(){ return { cube: window.__cube('#sense-3d'), opts: window.__opts('#sense-opts'), q: (document.querySelector('#sense-q')||{}).textContent.slice(0,30), overflow: window.__overflow() }; })()`);
  await shot('verify-sense-face.png');
  await ev(`if(senseState&&senseState.timer)clearInterval(senseState.timer); senseState=null;`);
  await ev(`senseStart('piece')`); await sleep(600);
  R.sensePiece = await ev(`(function(){ return { cube: window.__cube('#sense-3d'), opts: window.__opts('#sense-opts'), overflow: window.__overflow() }; })()`);
  await ev(`if(senseState&&senseState.timer)clearInterval(senseState.timer); senseState=null;`);
  await ev(`senseStart('center')`); await sleep(600);
  R.senseCenter = await ev(`(function(){ return { cube: window.__cube('#sense-3d'), opts: window.__opts('#sense-opts'), overflow: window.__overflow() }; })()`);
  await ev(`if(senseState&&senseState.timer)clearInterval(senseState.timer); senseState=null;`);

  // 8. 成就
  await nav('ach');
  await sleep(300);
  R.ach = await ev(`(function(){ return { badges: document.querySelectorAll('#ach-badges .badge').length, overflow: window.__overflow() }; })()`);
  await shot('verify-ach.png');

  // 8. GAN 页 + 安装页
  await nav('gan');
  await sleep(300);
  R.gan = await ev(`(function(){ return { btn: document.querySelectorAll('#page-gan button').length, status: (document.querySelector('#gan-status')||{}).textContent, overflow: window.__overflow() }; })()`);
  await shot('verify-gan.png');
  await nav('install');
  await sleep(300);
  R.install = await ev(`(function(){ return { overflow: window.__overflow() }; })()`);
  await shot('verify-install.png');

  // 9. PWA 可达性
  R.pwa = await ev(`(function(){ return { manifest: !!document.querySelector('link[rel=manifest]'), SW: 'serviceWorker' in navigator, https: /^https?:/.test(location.protocol) }; })()`);

  console.log('\n===== VERIFY RESULT =====');
  console.log(JSON.stringify(R, null, 2));
  console.log('\n===== EXCEPTIONS (' + exceptions.length + ') =====');
  exceptions.slice(0,30).forEach(e => console.log(' - ' + e));

  // 简单通过判定
  const pass = [];
  const fail = [];
  const ok = (c, name) => (c ? pass : fail).push(name);
  const cubeOK = c => c && c.found && c.base===3 && c.sticker===54;
  ok(cubeOK(R.notes && R.notes.cube) && R.notes.planar.cells===54, '记号营-双视图(3D+平面54格)');
  ok(cubeOK(R.notes && R.notes.quiz) && R.notes.opts===4, '记号营-小测(3D+4选项)');
  ok(cubeOK(R.modalF2L && R.modalF2L.cube) && R.modalF2L.planar.cells===54, 'F2L弹窗-双视图');
  ok(cubeOK(R.modalOLL && R.modalOLL.cube) && R.modalOLL.chart.divs>=9 && R.modalOLL.chart.label>=1, 'OLL弹窗-认图9格');
  ok(cubeOK(R.modalPLL && R.modalPLL.cube) && R.modalPLL.chart.cellbox===21 && R.modalPLL.chart.label>=1, 'PLL弹窗-车灯检测(21格)');
  ok(cubeOK(R.relate && R.relate.main) && cubeOK(R.relate.pair0) && cubeOK(R.relate.pair1) && R.relate.opts===4, '关联-易混对子双图+4选项');
  ok(R.quest && R.quest.levels===30 && R.quest.stages===3, '闯关-森林/山顶/城堡共30关');
  ok(cubeOK(R.questPlay && R.questPlay.cube) && R.questPlay.opts===4 && R.questPlay.prog==='第 1 / 5 题', '闯关-答题界面(3D+4选项)');
  ok(cubeOK(R.practice && R.practice.cube) && R.practice.diffs===3, '实战-可拧+3难度');
  ok(R.battle && R.battle.active===true && R.battle.startDisabled===true, '人机对战-开始(共享打乱,AI计时)');
  ok(cubeOK(R.senseFace && R.senseFace.cube) && R.senseFace.opts===4, '感知-认面(3D+4选项)');
  ok(cubeOK(R.sensePiece && R.sensePiece.cube) && R.sensePiece.opts===3, '感知-找块(3D+3选项)');
  ok(cubeOK(R.senseCenter && R.senseCenter.cube) && R.senseCenter.opts===4, '感知-中心色(3D+4选项)');
  ok(R.ach && R.ach.badges===12, '成就-12枚徽章');
  ok(R.pwa && R.pwa.manifest && R.pwa.SW && R.pwa.https, 'PWA-manifest+SW注册');
  ok(R.gan && R.gan.btn>=2 && R.gan.overflow.bad.length===0, 'GAN页-连接按钮+无溢出');
  ok(R.install && R.install.overflow.bad.length===0, '安装页-无溢出');
  ok(exceptions.length===0, '全程无JS异常');
  ok(R.home && R.home.bad.length===0 && R.quest.overflow.bad.length===0, '各页无横向溢出');

  console.log('\n===== PASS (' + pass.length + ') =====');
  pass.forEach(p => console.log('  ✅ ' + p));
  if (fail.length){ console.log('\n===== FAIL (' + fail.length + ') ====='); fail.forEach(f => console.log('  ❌ ' + f)); }
  else console.log('  全部通过 ✨');

  ws.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
