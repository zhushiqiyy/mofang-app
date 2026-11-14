/* =========================================================================
   50-battle.js — 实战练习 + 人机对战
   ========================================================================= */

let pracCube = solvedCube();
let pracScrambleToks = [];
let pracMoves = 0;
let pracRunning = false;
let pracStart = 0;
let pracTimer = null;
let pracBusy = false;
const pracQueue = [];

/* 真魔方整体朝向（手腕整转），由 GAN 陀螺仪 0x1 包更新；渲染时叠加到魔方上。
   仅改渲染，不改 pracCube 贴纸状态——整转不改变魔方各块相对位置，只改变整魔方在空间中的朝向。 */
let pracCubeRot = { x:0, y:0, z:0 };
let pracRotDirty = false;
function drawPrac(opt){
  drawCube($('prac-3d'), pracCube, Object.assign({ cubeRot: pracCubeRot }, opt || {}));
}
function resetPracOrientation(){ pracCubeRot = { x:0, y:0, z:0 }; if (typeof ganResetGyroBase === 'function') ganResetGyroBase(); }
function clampN(v, lo, hi){ return v < lo ? lo : (v > hi ? hi : v); }
/* 整体旋转：增量叠加 + 限幅（防跑飞），用 rAF 合帧重绘，避免高频陀螺仪包抖得满屏重画 */
function addPracCubeRot(d){
  const L = 80;
  if (typeof d.x === 'number') pracCubeRot.x = clampN(pracCubeRot.x + d.x, -L, L);
  if (typeof d.y === 'number') pracCubeRot.y = clampN(pracCubeRot.y + d.y, -L, L);
  if (typeof d.z === 'number') pracCubeRot.z = clampN(pracCubeRot.z + d.z, -L, L);
  if (pracRotDirty) return;
  pracRotDirty = true;
  requestAnimationFrame(() => { pracRotDirty = false; if ($('prac-3d')) drawPrac(); });
}

const DIFFS = [
  { key:'easy', name:'新手', em:'🐣', ms:46000, steps:60, tip:'慢悠悠，刚学会也能赢' },
  { key:'mid',  name:'高手', em:'🐯', ms:27000, steps:56, tip:'要认真拧才追得上' },
  { key:'hard', name:'大师', em:'👑', ms:15000, steps:50, tip:'接近高手的水平' }
];
let battleDiff = 'easy';
let battle = { active:false, aiT0:0, aiTimer:null, playerWon:false, aiDone:false, aiSteps:0 };

/* ---------------- 实战练习 ---------------- */
let pracInited = false;

function renderPractice(){
  const cv = cubeView($('prac-3d'));
  drawPrac({});
  mountViewCtrl($('prac-viewctrl'), () => $('prac-3d'));

  if (!pracInited){
    pracInited = true;

    /* 手动拧按钮 */
    const host = $('prac-btns');
    host.innerHTML = '';
    ['U','R','F','L','D','B'].forEach(f => {
      const line = el('div');
      line.style.cssText = 'display:flex;gap:6px;align-items:center;margin:6px 0;';
      line.appendChild(el('div','pill', FACE_NAME[f] + ' ' + f));
      line.querySelector('.pill').style.minWidth = '56px';
      line.querySelector('.pill').style.textAlign = 'center';
      [['',f],["'",f+"'"],['2',f+'2']].forEach(([sfx,lb]) => {
        const b = el('button','btn alt sm', lb);
        b.style.cssText = 'min-width:52px;font-family:ui-monospace,Menlo,monospace;font-size:15px;';
        b.onclick = () => pracDo(lb);
        line.appendChild(b);
      });
      host.appendChild(line);
    });

    /* 难度选择 */
    const dsel = $('diff-sel');
    dsel.innerHTML = '';
    DIFFS.forEach(d => {
      const c = el('div','diff' + (battleDiff === d.key ? ' on' : ''));
      c.innerHTML = `<b>${d.em} ${d.name}</b><span>${d.tip}</span>`;
      c.onclick = () => {
        battleDiff = d.key;
        dsel.querySelectorAll('.diff').forEach(x => x.classList.remove('on'));
        c.classList.add('on');
        $('bt-aiwho').textContent = d.em + ' ' + d.name;
      };
      dsel.appendChild(c);
    });

    document.addEventListener('keydown', e => {
      if (currentPage !== 'practice') return;
      if (e.key === ' '){ e.preventDefault(); pracScramble(); return; }
      const k = e.key.toUpperCase();
      if ('URFLDB'.indexOf(k) < 0) return;
      e.preventDefault();
      pracDo(k + (e.shiftKey ? "'" : ''));
    });

    refreshBattleRecord();
  }

  refreshPracUI();
  renderPracLog();

  /* 进阶路线 + 玩伴（练习模块重点：从零到完全掌握） */
  if (typeof renderRoadmap === 'function') renderRoadmap($('roadmap-host'));
  if (typeof renderCompanion === 'function') renderCompanion($('practice-companion'));
}

function refreshPracUI(){
  $('prac-time').textContent = ((pracRunning ? (performance.now() - pracStart) : 0) / 1000).toFixed(1);
  $('prac-stepspill').textContent = pracMoves + ' 步';
  $('prac-state').textContent = pracRunning ? '计时中…' : (isSolved(pracCube) ? '已复原' : '待打乱');
}

function pracDo(label){
  /* label 形如 "R" / "R'" / "R2" */
  const f = label[0];
  const prime = label.indexOf("'") > 0;
  const dbl = label.indexOf('2') > 0;
  pracQueue.push({ f, prime, dbl });
  if (!pracBusy) pracFlush();
}

function pracFlush(){
  if (!pracQueue.length){ pracBusy = false; return; }
  pracBusy = true;
  const t = pracQueue.shift();
  const tok = { f:t.f, prime:t.prime, dbl:t.dbl };

  animateAlg($('prac-3d'), pracCube, [tok], {
    speed: 3,
    opt: { cubeRot: pracCubeRot },
    onDone: cube => {
      pracCube = cube;
      pracMoves++;
      if (battle.active && !pracRunning) startPracTimer();
      drawPrac({});
      refreshPracUI();
      pracFlush();

      /* 对战判定 */
      if (battle.active && !battle.playerWon && isSolved(pracCube)) battlePlayerWin();
      /* 普通挑战判定 */
      if (!battle.active && pracRunning && isSolved(pracCube)) pracStop(true);
    }
  });
}

function startPracTimer(){
  pracRunning = true;
  pracStart = performance.now();
  clearInterval(pracTimer);
  pracTimer = setInterval(() => {
    if (!pracRunning) return;
    $('prac-time').textContent = ((performance.now() - pracStart)/1000).toFixed(1);
  }, 80);
}

function pracReset(){
  pracStop(false);
  pracQueue.length = 0;
  const sp = $('scramble-steps'); if (sp) sp.style.display = 'none';
  pracCube = solvedCube();
  pracMoves = 0;
  pracScrambleToks = [];
  drawPrac({});
  refreshPracUI();
  $('prac-time').textContent = '0.0';
  toast('已复原');
}

function pracStop(win){
  clearInterval(pracTimer);
  pracTimer = null;
  if (!pracRunning) return;
  pracRunning = false;
  const secs = (performance.now() - pracStart) / 1000;
  $('prac-time').textContent = secs.toFixed(1);
  if (win){
    pushLog('实战复原 ' + secs.toFixed(1) + ' 秒 / ' + pracMoves + ' 步');
    if (typeof recordTraining === 'function')
      recordTraining({ kind:'practice', secs:+secs.toFixed(1), moves:pracMoves });
    toast('🎉 ' + secs.toFixed(1) + ' 秒复原！用了 ' + pracMoves + ' 步');
  }
}

function pracScramble(){
  /* 默认：先出打乱步骤，让小朋友照着把手中魔方打乱，再进入复原（不再直接甩出打乱好的样子） */
  pracScrambleSteps(false);
}

/* 打乱流程（两步式）：
   ① 生成随机打乱序列，把"步骤"展示出来，屏幕魔方保持已复原（参照）；
      小朋友照着步骤把<b>自己的</b>魔方拧乱——这样屏幕与实际始终一致。
   ② 点「我已打乱完成」才把屏幕魔方切到打乱态、开始计时。 */
let pracScrambleThenThink = false;
function pracScrambleSteps(withThink){
  if (battle.active) battleQuit();
  pracScrambleThenThink = !!withThink;
  pracStop(false);
  pracQueue.length = 0;
  const scr = randomScramble(20);
  pracScrambleToks = scr;
  showScrambleSteps(scr);
  /* 屏幕保持复原态作为参照，不提前展示打乱结果 */
  pracCube = solvedCube();
  pracMoves = 0;
  pracRunning = false;
  clearInterval(pracTimer);
  $('prac-time').textContent = '0.0';
  drawPrac({});
  refreshPracUI();
  $('prac-state').textContent = '请照步骤打乱';
  toast('照着步骤把魔方打乱');
}
function showScrambleSteps(scr){
  const host = $('scramble-steps');
  if (!host) return;
  host.style.display = 'block';
  host.innerHTML =
    '<div class="sub" style="margin-bottom:6px;">🎲 <b>打乱步骤</b>：照着下面每一步，把你的魔方拧乱（顺序从左到右）。拧完点「我已打乱完成」。</div>'
    + '<div class="chunks">' + scr.map(t => '<span class="chunk">' + fmtTok2(t) + '</span>').join('') + '</div>'
    + '<div class="row center" style="margin-top:10px;gap:8px;">'
    + '<button class="btn blue sm" onclick="pracFinishScramble()">✅ 我已打乱完成，开始复原</button>'
    + '<button class="btn alt sm" onclick="pracSkipScramble()">跳过（直接打乱）</button>'
    + '</div>';
}
function pracApplyScrambleToScreen(){
  let c = solvedCube();
  pracScrambleToks.forEach(t => { c = applyMove(c, moveOf(t)); });
  pracCube = c;
  pracMoves = 0;
  pracRunning = false;
  clearInterval(pracTimer);
  $('prac-time').textContent = '0.0';
  drawPrac({});
  refreshPracUI();
  $('prac-state').textContent = '已打乱，开始拧';
}
function pracFinishScramble(){
  const host = $('scramble-steps'); if (host) host.style.display = 'none';
  pracApplyScrambleToScreen();
  if (typeof recordTraining === 'function') recordTraining({ kind:'scramble', moves: pracScrambleToks.length, by:'程序' });
  toast('打乱好了！拧一步就开始计时');
  if (pracScrambleThenThink){ pracScrambleThenThink = false; showCfopThink(); }
}
function pracSkipScramble(){
  const host = $('scramble-steps'); if (host) host.style.display = 'none';
  pracApplyScrambleToScreen();
  toast('已打乱');
}

/* ---------------- 人机对战 ---------------- */
function refreshBattleRecord(){
  $('bt-record').textContent = store.battle.w + ' 胜 / ' + store.battle.l + ' 负';
}

function battleStart(){
  if (battle.active) return;

  /* 一起打乱 */
  pracReset();
  const scr = randomScramble(20);
  pracScrambleToks = scr;
  let c = solvedCube();
  scr.forEach(t => { c = applyMove(c, moveOf(t)); });
  pracCube = c;
  pracMoves = 0;
  drawPrac({});

  const d = DIFFS.find(x => x.key === battleDiff);

  battle = {
    active:true, aiT0: performance.now(), aiTimer:null,
    playerWon:false, aiDone:false, aiSteps:0, diff:d
  };

  $('bt-start').textContent = '比赛中…';
  $('bt-start').disabled = true;
  $('bt-msg').textContent = '🔔 开始！你拧第一步就计时，电脑也同时在拧。';
  $('bt-my').textContent = '0.0';
  $('bt-ai').textContent = '0.0';
  $('bt-mymv').textContent = '0 步';
  $('bt-aimv').textContent = '0 步';
  $('bt-aiwho').textContent = d.em + ' ' + d.name;

  $('prac-state').textContent = '对战进行中';

  battle.aiTimer = setInterval(() => {
    if (!battle.active) return;
    const el = performance.now() - battle.aiT0;
    const prog = Math.min(1, el / battle.diff.ms);
    $('bt-ai').textContent = (el/1000).toFixed(1);
    battle.aiSteps = Math.floor(prog * battle.diff.steps);
    $('bt-aimv').textContent = battle.aiSteps + ' 步';
    if (prog >= 1 && !battle.aiDone){
      battle.aiDone = true;
      battleAiWin();
    }
  }, 100);

  /* 玩家侧时间显示 */
  const myTick = setInterval(() => {
    if (!battle.active){ clearInterval(myTick); return; }
    if (pracRunning) $('bt-my').textContent = ((performance.now() - pracStart)/1000).toFixed(1);
    $('bt-mymv').textContent = pracMoves + ' 步';
  }, 100);
}

function battlePlayerWin(){
  if (!battle.active || battle.playerWon) return;
  battle.playerWon = true;
  clearInterval(battle.aiTimer);
  battle.active = false;
  const secs = (performance.now() - pracStart) / 1000;
  pracRunning = false;
  clearInterval(pracTimer);

  store.battle.w++;
  saveStore();
  pushLog('战胜 ' + battle.diff.name + '（' + secs.toFixed(1) + 's / ' + pracMoves + ' 步）');
  refreshBattleRecord();

  $('bt-msg').innerHTML = '🏆 <b>你赢了！</b>用时 ' + secs.toFixed(1) + ' 秒，' + pracMoves + ' 步。电脑才走到 ' + battle.aiSteps + ' 步。';
  if (typeof recordTraining === 'function')
    recordTraining({ kind:'battle', win:true, secs:+secs.toFixed(1), moves:pracMoves, opp:battle.diff.name });
  $('bt-start').textContent = '⚔️ 再打一场';
  $('bt-start').disabled = false;
  $('bt-my').textContent = secs.toFixed(1);
  toast('🏆 赢了！');
}

function battleAiWin(){
  if (!battle.active) return;
  battle.active = false;
  clearInterval(battle.aiTimer);
  store.battle.l++;
  saveStore();
  pushLog('输给 ' + battle.diff.name);
  refreshBattleRecord();

  $('bt-msg').innerHTML = '🤖 <b>电脑先完成了。</b>别灰心 —— 你还有 ' +
    solvedCubies(pracCube) + ' / 26 块已经归位，再练几次就追上了。';
  if (typeof recordTraining === 'function')
    recordTraining({ kind:'battle', win:false, moves:pracMoves, opp:battle.diff.name });
  $('bt-start').textContent = '⚔️ 再打一场';
  $('bt-start').disabled = false;
  $('bt-ai').textContent = (battle.diff.ms/1000).toFixed(1);
  toast('电脑赢了，再来一次！');
}

function battleQuit(){
  if (!battle.active){
    $('bt-msg').textContent = '准备好了就开打！';
    $('bt-start').textContent = '⚔️ 开始比赛';
    $('bt-start').disabled = false;
    return;
  }
  battle.active = false;
  clearInterval(battle.aiTimer);
  pracRunning = false;
  clearInterval(pracTimer);
  $('bt-msg').textContent = '已结束。';
  $('bt-start').textContent = '⚔️ 开始比赛';
  $('bt-start').disabled = false;
  $('prac-state').textContent = '对战已结束';
}

function renderPracLog(){
  const host = $('prac-log');
  host.innerHTML = '';
  const items = store.log.slice(0, 12);
  if (!items.length){ host.innerHTML = '<div><span>还没有记录</span></div>'; return; }
  items.forEach(x => {
    const d = el('div');
    const dt = new Date(x.t);
    d.innerHTML = '<span>' + x.txt + '</span><span class="sub">' +
      (dt.getMonth()+1) + '/' + dt.getDate() + '</span>';
    host.appendChild(d);
  });
}

/* ---------------- 主动接替 / CFOP 还原思路 + 顶层情形识别 ---------------- */
let cfopThinkSol = null;   /* 当前"还原思路"的完整解法序列（供演示） */
let cfopThinkMeta = null;  /* 各阶段临界点（供演示时高亮当前阶段） */
let cfopThinkStart = null; /* 标准打乱态（解法起点）：演示/跟练都从这里开始，保证每次干净复位 */

/* 底层两层是否已复原（只剩顶层待处理） */
function isLastLayer(cube){
  if (!cube.D.every(c => c === cube.D[4])) return false;
  for (const f of ['F','R','B','L']){
    for (let i = 3; i < 9; i++) if (cube[f][i] !== cube[f][4]) return false;
  }
  return true;
}
function isTopOriented(cube){ return cube.U.every(c => c === UP_COLOR); }

/* 从当前魔方读出顶面 9 格（1=顶面已翻上）与四侧顶条，按 DATA 的约定 */
function extractOLL(cube){ return cube.U.map(c => c === UP_COLOR ? 1 : 0); }
function extractRing(cube){
  return {
    U: cube.U.slice(),
    F: [cube.F[0], cube.F[1], cube.F[2]],
    R: [cube.R[0], cube.R[1], cube.R[2]],
    B: [cube.B[0], cube.B[1], cube.B[2]],
    L: [cube.L[0], cube.L[1], cube.L[2]]
  };
}
function arrEq(a, b){ return a.length === b.length && a.every((x,i) => x === b[i]); }
function ringEq(r1, r2){
  return ['F','R','B','L'].every(f => arrEq(r1[f], r2[f]));
}

/* 顶层 OLL 情形识别（带 4 种整体 U 转向归一化） */
function matchOLL(cube){
  const oll = (DATA.OLL || []);
  for (let k = 0; k < 4; k++){
    const ck = applyAlg(cube, parseNotation('U'.repeat(k)));
    const p = extractOLL(ck);
    for (const it of oll){
      if (it.pattern && arrEq(p, it.pattern))
        return { num: it.num, notation: it.notation, shape: (it.shape && it.shape[0]) || '' };
    }
  }
  return null;
}
/* 顶层 PLL 情形识别 */
function matchPLL(cube){
  const pll = (DATA.PLL || []);
  for (let k = 0; k < 4; k++){
    const ck = applyAlg(cube, parseNotation('U'.repeat(k)));
    const r = extractRing(ck);
    for (const it of pll){
      if (it.ring && ringEq(r, it.ring))
        return { num: it.num, notation: it.notation, group: it.group || '' };
    }
  }
  return null;
}

function fmtTok2(t){ return t.f + (t.prime ? "'" : '') + (t.dbl ? '2' : ''); }

/* 看 CFOP 还原思路：基于"程序随机打乱"的序列反推一种正确解法，并识别顶层 OLL/PLL 情形 */
function showCfopThink(){
  const panel = $('cfop-think');
  if (!panel) return;
  if (!pracScrambleToks || !pracScrambleToks.length){
    panel.style.display = 'block';
    panel.innerHTML = '<div class="sub">请先点「🤖 程序随机打乱」，再来看还原思路。</div>';
    return;
  }
  const sol = invert(pracScrambleToks);   /* 把打乱倒回去 = 一种正确解法 */
  cfopThinkSol = sol;
  cfopThinkStart = applyAlg(solvedCube(), pracScrambleToks.slice());  /* 标准打乱态：解法起点 */

  /* 模拟走一遍，找到"底层两层已好 / 顶面已翻好"的临界点 */
  let pLL = sol.length, pOLL = sol.length;
  for (let i = 0; i <= sol.length; i++){
    const st = applyAlg(pracCube, sol.slice(0, i));
    if (st && isLastLayer(st)){ pLL = i; break; }
  }
  for (let i = pLL; i <= sol.length; i++){
    const st = applyAlg(pracCube, sol.slice(0, i));
    if (st && isTopOriented(st)){ pOLL = i; break; }
  }
  cfopThinkMeta = { pLL: pLL, pOLL: pOLL };

  /* 在 LL-ready 那一刻识别 OLL/PLL 情形（教孩子"看形选招"） */
  const llState = applyAlg(pracCube, sol.slice(0, pLL));
  const ollCase = llState ? matchOLL(llState) : null;
  const pllCase = llState ? matchPLL(llState) : null;

  const phaseCards = [];
  phaseCards.push(phaseCard('① 底层十字 + F2L（前两层）',
    sol.slice(0, pLL),
    '先把白色十字搭好，再把角块和棱块<b>配对</b>一起塞进前两层。前两层搞定后，就只剩顶层了。', 'cfop-ph-1'));
  phaseCards.push(phaseCard('② OLL · 翻顶面',
    sol.slice(pLL, pOLL),
    ollCase
      ? '此时顶面是 <b>OLL 第' + ollCase.num + '式（' + ollCase.shape + '）</b>，标准公式：<span class="mono">' + ollCase.notation + '</span>。把顶面全部翻成白色。'
      : '把顶面所有块翻成白色（这就是 OLL）。', 'cfop-ph-2'));
  phaseCards.push(phaseCard('③ PLL · 摆顶层',
    sol.slice(pOLL),
    pllCase
      ? '此时顶层是 <b>PLL 第' + pllCase.num + '式（' + pllCase.group + '）</b>，标准公式：<span class="mono">' + pllCase.notation + '</span>。把顶层位置摆正，魔方就复原啦！'
      : '把顶层位置摆正（这就是 PLL），魔方就复原啦！', 'cfop-ph-3'));

  let html = '<div class="viewwrap" style="margin-bottom:10px;"><div id="cfop-3d"></div></div>'
           + '<div class="viewctrl" id="cfop-viewctrl" style="margin-bottom:8px;"></div>'
           + '<div class="sub" style="margin-bottom:8px;">这是把刚才的打乱<b>倒回去</b>的一种正确解法。真正比赛里你会换成更短的 CFOP 公式——下面按 <b>十字→F2L→OLL→PLL</b> 四步拆开给你看：</div>';
  html += phaseCards.join('');
  html += '<div class="card tight" id="cfop-follow-card" style="margin-top:12px;background:#f0f7ff;border:1.5px solid #bcd8ff;">'
        + '<div class="ptitle" style="color:var(--blue);">🔗 连真魔方跟练</div>'
        + '<div id="cfop-follow-status" class="sub" style="font-size:12.5px;min-height:18px;">点「开始跟练」连上真魔方，照着步骤把打乱态拧回原状，屏幕会实时跟步并给意见。</div>'
        + '<div class="chunks" id="cfop-follow-steps" style="margin-top:8px;"></div>'
        + '<div id="cfop-follow-fb" class="sub" style="font-size:13px;margin-top:8px;font-weight:700;"></div>'
        + '<div class="row center" style="margin-top:8px;gap:8px;">'
        + '<button class="btn blue sm" id="cfop-follow-toggle" onclick="toggleCfopFollow()">开始跟练</button>'
        + '<button class="btn alt sm" onclick="resetCfopFollow()">↺ 重来</button></div>'
        + '</div>';
  html += '<div class="row center" style="margin-top:12px;gap:8px;">'
        + '<button class="btn blue sm" onclick="demoCfopThink()">▶ 按思路演示一遍</button>'
        + '<button class="btn alt sm" onclick="hideCfopThink()">收起</button></div>';
  panel.style.display = 'block';
  panel.innerHTML = html;
  drawCube($('cfop-3d'), cfopThinkStart || pracCube, {});
  if (typeof mountViewCtrl === 'function') mountViewCtrl($('cfop-viewctrl'), () => $('cfop-3d'));
  if (typeof renderCfopFollow === 'function') renderCfopFollow();
  panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
function phaseCard(title, toks, tip, id){
  const chips = toks.length
    ? '<div class="chunks">' + toks.map(t => '<span class="chunk">' + fmtTok2(t) + '</span>').join('') + '</div>'
    : '<div class="sub">（这步在本解法里为空）</div>';
  return '<div class="card tight' + (id ? '" id="' + id + '"' : '') + '" style="margin-top:10px;background:#f8fbff;border:1px solid var(--line);">'
    + '<div class="ptitle" style="color:var(--blue);">' + title + ' · ' + toks.length + ' 步</div>'
    + chips
    + '<div class="talk" style="margin-top:6px;">' + tip + '</div>'
    + '</div>';
}
function hideCfopThink(){ const p = $('cfop-think'); if (p) p.style.display = 'none'; if (cfopFollow) cfopFollow.active = false; }

/* ---------------- 还原思路模块：连真魔方跟练（蓝牙） ----------------
   真魔方每拧一步会镜像到面板的 3D 预览，并逐步与 cfopThinkSol 核对，给出对错与训练意见。 */
let cfopFollow = null;   /* { active, started, stack, cube } */
function cloneCube(c){ return { U:c.U.slice(), R:c.R.slice(), F:c.F.slice(), D:c.D.slice(), L:c.L.slice(), B:c.B.slice() }; }
function renderCfopFollow(){
  const host = $('cfop-follow-steps');
  if (!host || !cfopFollow || !cfopThinkSol) return;
  host.innerHTML = '';
  const t = cfopThinkSol, st = cfopFollow.stack;
  t.forEach((tk, i) => {
    const b = document.createElement('button'); b.className = 'chunk'; b.textContent = fmtTok2(tk);
    if (i < st.length) b.classList.add(mFollowTokEq(st[i], tk) ? 'ok' : 'bad');
    else if (i === st.length) b.classList.add('now');
    host.appendChild(b);
  });
}
function cfopSetFb(txt, color){ const e = $('cfop-follow-fb'); if (e){ e.textContent = txt; if (color) e.style.color = color; } }
function cfopFollowSetStatus(html){ const e = $('cfop-follow-status'); if (e) e.innerHTML = html; }
function startCfopFollow(){
  if (!cfopThinkSol){ showCfopThink(); if (!cfopThinkSol) return; }
  cfopFollow = { active:true, started:true, stack:[], cube: cloneCube(cfopThinkStart || pracCube) };
  const el3 = document.getElementById('cfop-3d'); if (el3) drawCube(el3, cfopFollow.cube, {});
  renderCfopFollow();
  cfopSetFb('准备就绪！照着下面步骤，把真魔方从打乱态拧回原状，屏幕会实时跟步。', '#1a7fd2');
  const tg = $('cfop-follow-toggle'); if (tg) tg.textContent = '⏸ 暂停跟练';
  if (!ganConn) pracConnectGAN();
  else cfopFollowSetStatus('✅ 已连上真魔方，直接拧吧');
}
function toggleCfopFollow(){
  if (!cfopFollow || !cfopFollow.started){ startCfopFollow(); return; }
  cfopFollow.active = !cfopFollow.active;
  const tg = $('cfop-follow-toggle');
  if (tg) tg.textContent = cfopFollow.active ? '⏸ 暂停跟练' : '继续跟练';
  cfopSetFb(cfopFollow.active ? '继续吧！' : '已暂停，再点继续。', '#1a7fd2');
}
function resetCfopFollow(){
  if (!cfopFollow) return;
  cfopFollow.stack = [];
  cfopFollow.cube = cloneCube(cfopThinkStart || pracCube);
  const el3 = document.getElementById('cfop-3d'); if (el3) drawCube(el3, cfopFollow.cube, {});
  renderCfopFollow();
  cfopSetFb('已重来，从第一步开始。', '#1a7fd2');
}
/* 真魔方每转一步调到这里：镜像到屏幕 + 与解法逐段核对 + 给训练意见 */
function cfopFollowMove(label){
  const el3 = document.getElementById('cfop-3d');
  if (!cfopFollow || !cfopFollow.active || !el3) return;
  const tok = { f: label[0], prime: label.indexOf("'") > 0, dbl: label.indexOf('2') > 0 };
  const st = cfopFollow.stack;
  if (st.length && mFollowTokEq(st[st.length-1], mFollowInv(tok))) st.pop();   /* 拧反了＝撤销上一步 */
  else st.push(tok);
  let cube = cloneCube(cfopThinkStart || pracCube);
  st.forEach(t => { cube = applyMove(cube, moveOf(t)) || cube; });
  cfopFollow.cube = cube;
  drawCube(el3, cube, {});
  renderCfopFollow();
  const t = cfopThinkSol;
  let wrong = -1;
  for (let i = 0; i < st.length; i++){ if (!mFollowTokEq(st[i], t[i])){ wrong = i; break; } }
  if (wrong >= 0){
    cfopSetFb('❌ 第' + (wrong+1) + '步拧成了 ' + mFollowFmt(st[wrong]) + '，应该是 ' + mFollowFmt(t[wrong]) + '（方向或顺序不对，照图拧回去重来即可）', '#d23b3b');
  } else if (st.length >= t.length){
    cfopSetFb('🎉 整套还原思路跟练完成！每一步都对上了，真棒！', '#1a9e4b');
    if (typeof recordTraining === 'function')
      recordTraining({ kind:'formula', stage:'cfop', num:0, ok:true, moves: st.length, note:'CFOP思路跟练' });
  } else {
    cfopSetFb('✅ 已对 ' + st.length + ' / ' + t.length + ' 步，下一步：' + mFollowFmt(t[st.length]), '#1a7fd2');
  }
}

/* 按思路把解法在"还原思路"面板里的 3D 预览上动画演示一遍（从当前打乱态还原） */
function demoCfopThink(){
  if (!cfopThinkSol){ showCfopThink(); if (!cfopThinkSol) return; }
  const sol = cfopThinkSol;
  if (!pracScrambleToks || !pracScrambleToks.length){ toast('请先点「🤖 程序打乱并给思路」，再演示'); return; }
  const host = $('cfop-3d');
  if (!host){ toast('请先打开「还原思路」面板'); return; }
  /* 始终从"标准打乱态"开始演示，保证每次都干净复位、不走样（不依赖 pracCube 当前是否被动过） */
  const start = cfopThinkStart || pracCube;
  let cube = { U:start.U.slice(), R:start.R.slice(), F:start.F.slice(),
               D:start.D.slice(), L:start.L.slice(), B:start.B.slice() };
  drawCube(host, cube, {});
  const M = cfopThinkMeta || { pLL: sol.length, pOLL: sol.length };
  const total = sol.length;
  let i = 0;
  const tick = () => {
    /* 高亮当前所处阶段（十字+F2L / OLL / PLL） */
    let ph = i <= M.pLL ? 1 : (i <= M.pOLL ? 2 : 3);
    [1,2,3].forEach(k => { const el = $('cfop-ph-' + k); if (el) el.classList.toggle('on', k === ph && i < total); });
    if (i >= total){
      [1,2,3].forEach(k => { const el = $('cfop-ph-' + k); if (el) el.classList.remove('on'); });
      toast('🎉 演示完成，这就是 CFOP 还原思路！');
      drawCube(host, cube, {});
      return;
    }
    const t = sol[i++];
    animateAlg(host, cube, [t], {
      speed: 2.4,
      onDone: c => { cube = c; drawCube(host, cube, {}); tick(); }
    });
  };
  toast('▶ 开始按思路演示（从你现在的打乱态复原）');
  tick();
}
