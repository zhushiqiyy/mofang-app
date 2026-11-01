/* =========================================================================
   66-roadmap.js — 从零入门到完全掌握的「进阶学习系统」
   -------------------------------------------------------------------------
   小朋友的强项是：想象力丰富、空间想象力强。
   所以这条路线特别强调：先练「眼睛和手指的本能」→ 再练「脑子里的空间想象」
   → 最后补满 119 招。每一步都有明确的「过关标准」。
   ========================================================================= */

/* 统计某 stage 里「属于某个 group 且已点亮」的招数 */
function countDoneGroup(stage, group, need){
  const arr = DATA[stage.toUpperCase()] || [];
  let n = 0;
  arr.forEach(it => { if (it.group === group && isDone(stage, it.num)) n++; });
  return n >= need;
}

/* 统计某 stage 里「属于某几个形状族且已点亮」的招数 */
function countDoneShape(stage, shapes, need){
  const arr = DATA[stage.toUpperCase()] || [];
  let n = 0;
  arr.forEach(it => {
    const fam = it.shape ? it.shape[0] : '';
    if (shapes.indexOf(fam) >= 0 && isDone(stage, it.num)) n++;
  });
  return n >= need;
}

/* PLL 指定的 6 招是否全亮 */
function pllLit6(){
  const want = ['Ua','Ub','H','Z','T','Y'];
  return want.every(nm => {
    const it = DATA.PLL.find(x => x.name === nm);
    return it && isDone('pll', it.num);
  });
}

/* 某闯关阶段是否至少通关一关 */
function questAnyDone(stageKey){
  return ALL_LEVELS.some(lv => lv.stageKey === stageKey && questStars(lv.id) >= 1);
}

const ROADMAP = [
  { id:'sense',   icon:'👀', title:'火眼金睛',   goal:'色块感知训练拿 2 星',
    act:()=>go('sense'),                                  done:()=> (store.sense.stars||0) >= 2 },
  { id:'notes',   icon:'🔤', title:'记号本能',   goal:'记号营连续答对 3 次',
    act:()=>go('notes'),                                  done:()=> (store.notes && store.notes.streak >= 3) },
  { id:'f2l6',    icon:'🟦', title:'标准配对',   goal:'F2L「标准插入」点亮 6 招',
    act:()=>{ libStage='F2L'; go('lib'); },              done:()=> countDoneGroup('f2l','标准插入',6) },
  { id:'oll9',    icon:'🟨', title:'两步 OLL',   goal:'点亮 9 招（十字3＋小鱼2＋角全黄4）',
    act:()=>{ libStage='OLL'; go('lib'); },              done:()=> countDoneShape('oll',['十字','小鱼','角已定向'],9) },
  { id:'pll6',    icon:'🟥', title:'两步 PLL',   goal:'点亮 6 招（Ua Ub H Z T Y）',
    act:()=>{ libStage='PLL'; go('lib'); },              done:()=> pllLit6() },
  { id:'imag',    icon:'🧠', title:'空间想象',   goal:'用「遮住图凭想象」练 3 次',
    act:()=>{ libStage='OLL'; go('lib'); },              done:()=> (store.imagine && store.imagine.count >= 3) },
  { id:'forest',  icon:'🌲', title:'闯过森林',   goal:'通关任意一个森林关（F2L）',
    act:()=>go('quest'),                                  done:()=> questAnyDone('forest') },
  { id:'win',     icon:'🏆', title:'人机首胜',   goal:'在人机对战里赢 1 次',
    act:()=>go('practice'),                               done:()=> (store.battle.w||0) >= 1 },
  { id:'castle',  icon:'👑', title:'城堡之王',   goal:'PLL 全部 21 招点亮',
    act:()=>{ libStage='PLL'; go('lib'); },              done:()=> countDone('pll') >= 21 }
];

/* 渲染进阶路线到某个容器（竖向路线） */
function renderRoadmap(host){
  if (!host) return;
  host.innerHTML = '';

  const total = ROADMAP.length;
  let curIdx = ROADMAP.findIndex(r => !r.done());

  const head = el('div','road-head');
  head.innerHTML = '🎓 <b>我的进阶路线</b> <span class="sub">第 '
    + (curIdx < 0 ? total : curIdx + 1) + ' / ' + total + ' 关</span>';
  host.appendChild(head);

  const list = el('div','road-list');
  ROADMAP.forEach((r, i) => {
    const done = r.done();
    const isCur = (i === curIdx);
    const node = el('div','road-node ' + (done ? 'done' : (isCur ? 'cur' : 'locked')));

    let action = '';
    if (done) action = '<span class="road-tag ok">✅ 已完成</span>';
    else if (isCur) action = '<button class="btn green sm road-go" onclick="roadGo(' + i + ')">去完成 ▶</button>';
    else action = '<span class="road-tag">🔒 先完成上一关</span>';

    node.innerHTML =
      '<div class="road-dot">' + (done ? '✓' : r.icon) + '</div>'
      + '<div class="road-body">'
        + '<div class="road-title">' + r.title + '</div>'
        + '<div class="road-goal">' + r.goal + '</div>'
        + action
      + '</div>';
    if (i < total - 1){
      const line = el('div','road-line ' + (done ? 'on' : ''));
      list.appendChild(node);
      list.appendChild(line);
    } else {
      list.appendChild(node);
    }
  });
  host.appendChild(list);

  if (curIdx < 0){
    const done = el('div','road-finish');
    done.innerHTML = '🏆 太棒了！整条路线都走通了，你已经是真正的魔方小将！';
    host.appendChild(done);
  }
}

function roadGo(i){
  const r = ROADMAP[i];
  if (r && !r.done()) r.act();
}
