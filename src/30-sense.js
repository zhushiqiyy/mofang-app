/* =========================================================================
   30-sense.js — 色块位置感知训练（学习地图第 1 阶段）
   三种关卡：认面 / 找块 / 中心。全部用 3D 轴测图出题，随机视角。
   ========================================================================= */

/* 通用：随机打乱序列 */
function randomScramble(n){
  n = n || 20;
  const faces = ['U','R','F','D','L','B'];
  const axisOf = { U:'z', D:'z', R:'x', L:'x', F:'y', B:'y' };
  const out = [];
  let lastAxis = '', lastFace = '';
  for (let i=0;i<n;i++){
    let f;
    do { f = pick(faces); } while (axisOf[f] === lastAxis || f === lastFace);
    const r = Math.random();
    out.push({ f, prime: r < 0.34, dbl: r >= 0.34 && r < 0.5 });
    lastAxis = axisOf[f];
    lastFace = f;
  }
  return out;
}

/* 读取某个 cubie 位置上的所有贴纸 */
function cubieStickers(cube, pos){
  const out = [];
  for (const f in FACES){
    for (let r=0;r<3;r++) for (let c=0;c<3;c++){
      if (eqv(posOf(f,r,c), pos)) out.push({ face:f, r, c, color:cube[f][r*3+c] });
    }
  }
  return out;
}

/* 某面可见的视角列表 */
const VIS_YAW = {
  U:[45,135,225,315], D:[45,135,225,315],
  F:[45,315], B:[135,225], R:[45,135], L:[225,315]
};
const CORNER_POS = [];
(function(){
  for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) CORNER_POS.push([x,y,z]);
})();

let senseState = null;

function renderSenseEntry(){
  if (senseState && senseState.active) return;
  $('sense-intro').classList.remove('hidden');
  $('sense-play').classList.add('hidden');
  $('sense-result').classList.add('hidden');
}

function senseStart(mode){
  senseState = {
    mode, active:true, i:0, score:0, wrong:0,
    total:10, t0: performance.now(), timer:null, locked:false,
    qs: []
  };
  $('sense-intro').classList.add('hidden');
  $('sense-result').classList.add('hidden');
  $('sense-play').classList.remove('hidden');

  senseState.timer = setInterval(() => {
    if (!senseState) return;
    const s = (performance.now() - senseState.t0) / 1000;
    $('sense-time').textContent = s.toFixed(1) + ' 秒';
  }, 100);

  senseNext();
}

function senseNext(){
  const st = senseState;
  if (!st) return;
  if (st.i >= st.total){ senseFinish(); return; }

  st.locked = false;
  $('sense-prog').textContent = '第 ' + (st.i+1) + ' / ' + st.total + ' 题';
  $('sense-score').textContent = '✅ ' + st.score;
  $('sense-fb').textContent = '';

  const dots = [];
  for (let k=0;k<st.total;k++) dots.push('<i class="' + (k < st.i ? (st.results[k] ? 'ok' : 'bad') : '') + '"></i>');
  $('sense-prog').insertAdjacentHTML('afterend', '');

  if (!st.results) st.results = [];

  if (st.mode === 'face')      senseQFace();
  else if (st.mode === 'piece') senseQPiece();
  else                          senseQCenter();
}

/* ---------- ① 认面：高亮一个面的中心，问是哪个面 ---------- */
function senseQFace(){
  const st = senseState;
  const target = pick(['U','D','F','B','R','L']);
  const yaw = pick(VIS_YAW[target]) * Math.PI / 180;
  const pitch = target === 'U' ? 0.55 : target === 'D' ? -0.55 : 0.28;

  const cv = cubeView($('sense-3d'));
  cv.yaw = yaw; cv.pitch = pitch;

  const posMap = { U:[0,0,1], D:[0,0,-1], F:[0,1,0], B:[0,-1,0], R:[1,0,0], L:[-1,0,0] };
  const pos = posMap[target];

  drawCube($('sense-3d'), solvedCube(), {
    hl: [{ pos, color:'#ff2d55', ring:true, r:31 }]
  });
  mountViewCtrl($('sense-viewctrl'), () => $('sense-3d'));

  $('sense-q').innerHTML = '🔴 红色框住的这个中心，是<b>哪一面</b>？';

  const opts = [target];
  shuffle(['U','D','F','B','R','L'].filter(x => x !== target)).slice(0,3).forEach(x => opts.push(x));
  senseRenderOpts(shuffle(opts), target, x => FACE_NAME[x] + ' ' + x, 'face');
}

/* ---------- ② 找块：给颜色组合，在 3 个高亮角块里选 ---------- */
function senseQPiece(){
  const st = senseState;
  const scr = randomScramble(18);
  const cube = applyAlg(solvedCube(), scr);

  const pickPos = shuffle(CORNER_POS).slice(0, 3);
  const labels = ['A','B','C'];
  const colors = ['#ff2d55','#0a84ff','#ff9f0a'];

  /* 目标 = 随机的其中一个 */
  const targetIdx = Math.floor(Math.random() * 3);
  const targetPos = pickPos[targetIdx];
  const targetStickers = cubieStickers(cube, targetPos);
  const targetColors = targetStickers.map(s => s.color);

  /* 视角：确保三个点都能看到（默认视角即可，角块都在外侧） */
  const cv = cubeView($('sense-3d'));
  cv.yaw = Math.PI/4; cv.pitch = Math.PI/6;

  drawCube($('sense-3d'), cube, {
    hl: pickPos.map((p, i) => ({ pos:p, color:colors[i], label:labels[i] }))
  });
  mountViewCtrl($('sense-viewctrl'), () => $('sense-3d'));

  const cn = targetColors.map(c => COLOR_NAME[c]).join('、');
  $('sense-q').innerHTML = '🔎 <b>'+cn+'</b> 这个角块，是 <span class="hl">A / B / C</span> 里的哪一个？';

  senseRenderOpts(['A','B','C'], labels[targetIdx], x => x, 'piece', targetIdx);
}

/* ---------- ③ 中心：高亮可见面的中心，问颜色 ---------- */
function senseQCenter(){
  const st = senseState;
  const face = pick(['U','F','R','B','L','D']);
  const yaw = pick(VIS_YAW[face]) * Math.PI / 180;
  const pitch = face === 'U' ? 0.5 : face === 'D' ? -0.5 : 0.25;

  const cv = cubeView($('sense-3d'));
  cv.yaw = yaw; cv.pitch = pitch;

  const posMap = { U:[0,0,1], D:[0,0,-1], F:[0,1,0], B:[0,-1,0], R:[1,0,0], L:[-1,0,0] };
  const pos = posMap[face];
  const color = solvedCube()[face][4];

  drawCube($('sense-3d'), solvedCube(), { hl: [{ pos, color:'#ff2d55', ring:true, r:31 }] });
  mountViewCtrl($('sense-viewctrl'), () => $('sense-3d'));

  $('sense-q').innerHTML = '🎨 这个面<b>中心</b>是什么颜色？<span class="sub" style="font-size:13px">（中心永远不变哦）</span>';

  const opts = [color];
  shuffle(Object.keys(COLOR_NAME).filter(c => c !== color)).slice(0,3).forEach(c => opts.push(c));
  senseRenderOpts(shuffle(opts), color, c => COLOR_NAME[c], 'center');
}

/* ---------- 选项渲染与判分 ---------- */
function senseRenderOpts(opts, correct, labelFn, mode, extra){
  const host = $('sense-opts');
  host.innerHTML = '';
  const st = senseState;

  opts.forEach(o => {
    const b = el('button','opt');
    b.innerHTML = '<span style="font-size:17px">' + labelFn(o) + '</span>';
    b.onclick = () => {
      if (st.locked) return;
      st.locked = true;
      const ok = (o === correct);
      if (ok){
        b.classList.add('ok');
        st.score++;
        st.results[st.i] = true;
        $('sense-fb').innerHTML = '<span style="color:var(--green);font-weight:800">✅ 对了！</span>';
      } else {
        b.classList.add('no');
        st.results[st.i] = false;
        host.querySelectorAll('.opt').forEach(x => {
          const t = x.textContent.trim();
          const want = labelFn(correct);
          if (t === want || t.indexOf(want) >= 0) x.classList.add('ok');
        });
        $('sense-fb').innerHTML = '<span style="color:var(--red);font-weight:800">差一点！正确答案：' + labelFn(correct) + '</span>';
      }
      $('sense-score').textContent = '✅ ' + st.score;
      st.i++;
      setTimeout(() => { if (senseState && senseState.active) senseNext(); }, ok ? 420 : 1100);
    };
    host.appendChild(b);
  });
}

function senseFinish(){
  const st = senseState;
  clearInterval(st.timer);
  st.active = false;

  const secs = (performance.now() - st.t0) / 1000;
  const acc = st.score / st.total;

  let stars = 0;
  if (acc >= 1 && secs <= 45) stars = 3;
  else if (acc >= 0.8 && secs <= 75) stars = 2;
  else if (acc >= 0.6) stars = 1;

  /* 记录 */
  const key = st.mode;
  const prev = store.sense[key] || { stars:0, best:9999 };
  if (stars > prev.stars || (stars === prev.stars && secs < prev.best)){
    store.sense[key] = { stars, best: Math.min(prev.best, Math.round(secs)) };
  }
  const tot = Object.keys(store.sense).reduce((a,k) => a + (store.sense[k].stars||0), 0);
  store.sense.stars = Math.max(store.sense.stars || 0, Math.round(tot/3));
  saveStore();
  pushLog('感知训练 ' + st.mode + ' 拿 ' + stars + ' 星');

  $('sense-play').classList.add('hidden');
  const r = $('sense-result');
  r.classList.remove('hidden');
  r.innerHTML = `
    <div class="card center">
      <div style="font-size:48px">${stars >= 3 ? '🏆' : stars >= 2 ? '🎉' : stars >= 1 ? '👍' : '💪'}</div>
      <div class="stars3">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3-stars)}</span></div>
      <div class="huge" style="margin-top:6px">${st.score} / ${st.total}</div>
      <div class="sub">用时 ${secs.toFixed(1)} 秒 · 正确率 ${Math.round(acc*100)}%</div>
      <div class="row center" style="margin-top:16px;">
        <button class="btn" onclick="senseStart('${st.mode}')">再来一次</button>
        <button class="btn alt" onclick="go('sense')">换个关卡</button>
      </div>
      <div class="sub" style="margin-top:14px;font-size:13px;">
        ${stars >= 3 ? '太快了！你已经能"一眼认出"，这就是 F2L 最强的地基。' :
          stars === 2 ? '很好！再快一点、再准一点，就能拿 3 星。' :
          stars === 1 ? '基础有了。建议先玩"中心关"把六个面的颜色记牢。' :
          '别急，先玩"中心关"——把"上黄下白、前绿后蓝、右红左橙"记住，再来。'}
      </div>
    </div>`;
  refreshTopStars();
}
