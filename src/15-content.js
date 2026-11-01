/* =========================================================================
   15-content.js — 形象化讲解（面向三年级小朋友）
   原则：先给画面 → 再给线索 → 最后给动作。少术语，多比喻。
   ========================================================================= */

/* ---------------- 记号营：每个字母怎么转 ---------------- */
const NOTE_INFO = {
  U: { name:'上', tip:'把<b>最上面那一层</b>，像拧瓶盖一样往<b>左</b>转 90°。', finger:'用右手食指从前往后一推。' },
  R: { name:'右', tip:'把<b>右边那一层</b>，往上翻 90°（右边升起来）。', finger:'右手抓住右边，往上一掰。' },
  F: { name:'前', tip:'把<b>正对这一面</b>，像翻书一样往<b>右</b>转 90°。', finger:'右手食指往右一拨。' },
  D: { name:'下', tip:'把<b>最下面那一层</b>，往<b>右</b>转 90°。', finger:'左手无名指往右推。' },
  L: { name:'左', tip:'把<b>左边那一层</b>，往上翻 90°（左边升起来）。', finger:'左手抓住左边，往上一掰。' },
  B: { name:'后', tip:'把<b>背对你这面</b>，往<b>左</b>转 90°。', finger:'一般靠整体转魔方来完成。' }
};

const NOTE_GROUPS = [
  { title:'六个基本字母', desc:'U 上 · D 下 · F 前 · B 后 · R 右 · L 左', keys:['U','D','F','B','R','L'] }
];

/* ---------------- OLL：10 个形状族的比喻 ---------------- */
const OLL_FAMILY = {
  '点': {
    emoji:'⭐',
    nick:'孤星',
    story:'顶面只有正中间一个黄点，四个边、四个角全是灰的——像夜里孤零零的一颗小星星。',
    look:'别急着拧！先转整个魔方找一找：哪个方向看起来"快要连起来"。',
    feel:'这一族招式最长，但只有 1 招，学会就赚到。'
  },
  '十字': {
    emoji:'➕',
    nick:'十字路口',
    story:'顶面 4 个边块都黄了，连成一个"十"字；4 个角还是灰的。像站在十字路口，四个角都没灯。',
    look:'只看 4 个角灰不灰。角全灰 = 十字族。',
    feel:'十字族只有 3 招，是两步 OLL 的第一招，一定要先学会！'
  },
  '小鱼': {
    emoji:'🐟',
    nick:'小鱼游泳',
    story:'4 个边块都黄了，另外还多出<b>一个角块</b>也是黄的——那个多出来的角就是"鱼头"。顶面看起来像一条小鱼。',
    look:'看鱼头朝哪边：朝左上是正小鱼（Sune），朝右下是反小鱼（AntiSune）。',
    feel:'小鱼只有 2 招，是整套 OLL 里最常用的。学会它，顶层一大半情形都能解。'
  },
  'C形': {
    emoji:'🌙',
    nick:'弯月亮',
    story:'4 个边块黄了，还有 2 个角也黄了；黄的块连起来像一个弯弯的"C"，也像一弯月亮。',
    look:'看那个"C"的开口朝哪边，开口方向决定用哪一招。',
    feel:'C 形有 9 招，慢慢来，先记"C 开口朝自己"那一招。'
  },
  'T形': {
    emoji:'🔨',
    nick:'小锤子',
    story:'顶面黄的块排成一个"T"，像一把小锤子。',
    look:'看锤子的柄朝哪边。',
    feel:'记"锤子"这个形状，比记编号好记多了。'
  },
  '马步': {
    emoji:'🐴',
    nick:'马走日',
    story:'3 个边块黄、角块基本没黄，黄的块摆得像象棋里"马走日"字的那个拐弯。',
    look:'找那个"日"字的拐角在哪。',
    feel:'马步有 7 招，形状像但方向不同，一定要看清拐角。'
  },
  '方框': {
    emoji:'🟨',
    nick:'小方框',
    story:'黄的块凑成一个 2×2 的小方块（一个田字），像一个小方框、小房子。',
    look:'找那个 2×2 的黄块在哪一角。',
    feel:'方框有 12 招，是数量最多的一族。先认"方框在哪"，再选招。'
  },
  '小闪电': {
    emoji:'⚡',
    nick:'闪电',
    story:'只有 2 个边块黄，还挨在一起，斜斜的像一道闪电劈下来。',
    look:'闪电的"头"在上还是在下、在左还是在右。',
    feel:'闪电有 12 招。它和"一字"很像，看有没有拐弯就能分开。'
  },
  'L形': {
    emoji:'📐',
    nick:'大 L',
    story:'3 个边黄 + 2 个角黄，整体看上去像一个歪着的大写字母 L，也像一把小手枪。',
    look:'L 的"长边"贴着哪一面。',
    feel:'L 形只有 2 招，很好拿。'
  },
  'P形': {
    emoji:'🚩',
    nick:'小旗子',
    story:'只有 1 个边块黄，旁边连着一串，看起来像一面小旗子（字母 P）。',
    look:'旗杆在哪一边。',
    feel:'P 形 5 招，注意和"闪电"区分：P 只有一个边是黄的。'
  },
  '角已定向': {
    emoji:'🎯',
    nick:'角全黄',
    story:'4 个角块<b>全都黄了</b>，只剩边块还没翻上来。这是最接近成功的一族！',
    look:'只数边块有几个黄：0、1、2、4 个，各对应不同招式。',
    feel:'4 招，学会就离复原只差一步。'
  }
};

/* ---------------- PLL：21 个名字的比喻 ---------------- */
const PLL_STORY = {
  Ua:{ emoji:'🔄', nick:'三块转圈（顺）', story:'三个棱块像小朋友排队，一起往一边挪一个位置——顺时针转圈。', look:'看那三个"没回家"的棱块往哪边转。', feel:'超好用！两步 PLL 必备第一招。' },
  Ub:{ emoji:'🔃', nick:'三块转圈（逆）', story:'和 Ua 一样是三个棱块转圈，只是方向反过来——逆时针。', look:'和 Ua 是"镜像"，看转的方向。', feel:'和 Ua 一起记，一对儿学最快。' },
  H:{ emoji:'🪜', nick:'十字对换', story:'四个棱块两两对换：前面的跑到后面，左边的跑到右边。像一个"十"字交叉换位。', look:'四个棱全都不对，四个角全对。', feel:'很好认：角全对、棱全错，就是 H。' },
  Z:{ emoji:'⚡', nick:'Z 字换', story:'两组相邻的棱块各自对换，走位像字母 Z。', look:'四个棱错、四个角对，但换的方式和 H 不同。', feel:'H 和 Z 长得很像，记：H 是正对着换，Z 是斜着换。' },
  Aa:{ emoji:'🔺', nick:'三个角转圈（顺）', story:'三个角块转圈圈，棱块都乖乖待着。', look:'三个角不对、棱都对。', feel:'先找"哪个角是好的"，好的那个角不动。' },
  Ab:{ emoji:'🔻', nick:'三个角转圈（逆）', story:'Aa 的反方向版本。', look:'和 Aa 互为镜像。', feel:'Aa、Ab 一起练，别搞反方向。' },
  E:{ emoji:'👀', nick:'眼睛对换', story:'两组<b>斜对角</b>的角块互相换位置，像两只眼睛在眨。', look:'四个角全错，而且都是斜对着错。', feel:'E 的手感很特别，记住了就不会忘。' },
  T:{ emoji:'🔨', nick:'锤子', story:'两个角块对换 + 两个棱块对换，整体像一把小锤子。', look:'看有没有一组"车灯"（同色角）。', feel:'经典招，一定要会。' },
  Ja:{ emoji:'🪝', nick:'钩子', story:'一对角 + 一对棱挨在一起换位，像一个小钩子。', look:'车灯只有一个面有。', feel:'J 有两招，看钩子朝左还是朝右。' },
  Jb:{ emoji:'🪝', nick:'钩子（反）', story:'Ja 的反方向。', look:'和 Ja 互为镜像。', feel:'两招一起背，效率翻倍。' },
  Y:{ emoji:'🌳', nick:'树杈', story:'对角的两个角块互换，同时两个棱块也换。形状像树杈 Y。', look:'四个角都错、棱也错。', feel:'Y 很好用，很多情形能一次搞定。' },
  Na:{ emoji:'🔀', nick:'对角全换', story:'两组角 + 两组棱同时换，是"大换位"。', look:'四个角全错，车灯有两个面。', feel:'稍难，先把角的位置找对再动手。' },
  Nb:{ emoji:'🔀', nick:'对角全换（反）', story:'Na 的反方向。', look:'和 Na 互为镜像。', feel:'和 Na 一起练。' },
  Ra:{ emoji:'🏎️', nick:'赛车过弯', story:'三个角 + 一个棱一起换位，像赛车急转弯。', look:'只有一个面有车灯。', feel:'手顺很长，先慢练再加速。' },
  Rb:{ emoji:'🏎️', nick:'赛车过弯（反）', story:'Ra 的反方向。', look:'和 Ra 互为镜像。', feel:'两招一起记。' },
  V:{ emoji:'✌️', nick:'胜利', story:'两角 + 两棱换位，形状像一个 V 字胜利手势。', look:'看"V"的两个尖朝哪。', feel:'名字就是形状，好记。' },
  F:{ emoji:'🅵', nick:'F 字', story:'两角 + 两棱换位，摆出来像字母 F。', look:'注意和 V 区分。', feel:'和 V 是邻居，练的时候放一起对比。' },
  G1:{ emoji:'🌀', nick:'螺旋 1', story:'三个角 + 三个棱一起换，是最绕的一族（G 家族）。', look:'先找车灯，再看车灯在哪一面。', feel:'G 家族 4 招最容易混，最后再学。' },
  G2:{ emoji:'🌀', nick:'螺旋 2', story:'G 家族第二招。', look:'车灯位置和 G1 不同。', feel:'和 G1、G3、G4 排在一起对比练。' },
  G3:{ emoji:'🌀', nick:'螺旋 3', story:'G 家族第三招。', look:'车灯位置又换了一面。', feel:'先别背，等其它 17 招熟了再来。' },
  G4:{ emoji:'🌀', nick:'螺旋 4', story:'G 家族第四招。', look:'四招里最后一个。', feel:'四招放一起，找规律就不难。' }
};

/* ---------------- F2L：5 类结构 ---------------- */
const F2L_GROUP_INFO = {
  '标准插入': {
    emoji:'🧩', nick:'标准配对',
    story:'角块和棱块已经像两块拼图一样对好了，只差把它们一起推进槽里。',
    look:'先看这一对是不是已经"手拉手"贴在一起。',
    feel:'这是最省事的一类，直接插就行。'
  },
  '经典前右槽 R U R\' 起手': {
    emoji:'🎯', nick:'前右槽起手',
    story:'这对拼图在"右前方"这个最常见的位置。很多招式都是从 R U R\' 这个动作开始。',
    look:'先认准"右前"这个槽，再看角块朝哪。',
    feel:'F2L 的手感基本都在这一族练出来。'
  },
  '先 U 调角再插': {
    emoji:'🎡', nick:'先转顶再插',
    story:'拼图位置不太对，先把顶层转一下（U），把角块送到顺手的位置，再插进去。',
    look:'先看顶层能不能一转就对上。',
    feel:'记住：卡住就先 U，别硬拧。'
  },
  '需要整体转魔方(y)换视角': {
    emoji:'🔄', nick:'换个方向看',
    story:'这一对在别的侧面。把整个魔方转个方向（y），让它变成"右前方"的情形，再用熟悉的招。',
    look:'先找这一对在哪一面，然后整只手转魔方。',
    feel:'别怕转魔方！这是 F2L 最正常的操作。'
  },
  '用了内层切片(f/l/r)高级插法': {
    emoji:'🚀', nick:'切片高手',
    story:'用了内层一起转的高级手法，手更快，但对手指要求高一点。',
    look:'先学会普通版，再回来学这招加速。',
    feel:'进阶招，先跳过也没关系。'
  }
};

/* ---------------- 通用：把一条数据翻译成"小朋友能懂"的讲解 ---------------- */
function explainOf(stage, it){
  if (stage === 'OLL'){
    const fam = OLL_FAMILY[it.shape ? it.shape[0] : ''] || null;
    return {
      fam,
      title: fam ? fam.emoji + ' ' + fam.nick : it.title,
      story: fam ? fam.story : '',
      look: fam ? fam.look : '',
      feel: fam ? fam.feel : '',
      extra: it.recog
    };
  }
  if (stage === 'PLL'){
    const s = PLL_STORY[it.name] || null;
    return {
      fam: s,
      title: s ? s.emoji + ' ' + s.nick + ' ' + it.name : it.name,
      story: s ? s.story : '',
      look: s ? s.look : '',
      feel: s ? s.feel : '',
      extra: it.recog
    };
  }
  const g = F2L_GROUP_INFO[it.group] || null;
  return {
    fam: g,
    title: g ? g.emoji + ' ' + g.nick : it.title,
    story: g ? g.story : '',
    look: g ? g.look : '',
    feel: g ? g.feel : '',
    extra: it.recog
  };
}

/* 给每个公式一个"孩子记得住"的短名 */
function shortName(stage, it){
  if (stage === 'OLL'){
    const fam = OLL_FAMILY[it.shape ? it.shape[0] : ''];
    return fam ? fam.nick : 'OLL';
  }
  if (stage === 'PLL'){
    return it.name;
  }
  const g = F2L_GROUP_INFO[it.group];
  return g ? g.nick : 'F2L';
}

/* =========================================================================
   对比教学 / 想象训练 / 口诀
   -------------------------------------------------------------------------
   三年级小朋友最容易被"长得像的两招"搞混。这里把两招放在一起，
   指出"哪几步一样、在哪里分岔、靠什么特征选"。
   ========================================================================= */

function _toks(s){ return String(s || '').trim().split(/\s+/).filter(Boolean); }
function _base(t){ return String(t).replace(/['’2]/g, ''); }

/* 逐字比较两条公式：找到相同的前缀、相同的后缀、中间不同的部分 */
function algoDiff(a, b){
  const A = _toks(a), B = _toks(b);
  let i = 0;
  while (i < A.length && i < B.length && _base(A[i]) === _base(B[i])) i++;
  let j = 0;
  while (j < A.length - i && j < B.length - i && _base(A[A.length-1-j]) === _base(B[B.length-1-j])) j++;
  return {
    pre:  A.slice(0, i).join(' '),
    midA: A.slice(i, A.length - j).join(' '),
    midB: B.slice(i, B.length - j).join(' '),
    suf:  A.slice(A.length - j).join(' '),
    nPre: i, nSuf: j
  };
}

/* 找"最像的那一招"（同族 + 公式最接近） */
const PLL_PAIR = {
  Ua:'Ub', Ub:'Ua', Aa:'Ab', Ab:'Aa', Ja:'Jb', Jb:'Ja',
  Na:'Nb', Nb:'Na', Ra:'Rb', Rb:'Ra', H:'Z', Z:'H', T:'F', V:'F', F:'T',
  E:'T', Y:'V', G1:'G2', G2:'G1', G3:'G4', G4:'G3'
};

function siblingOf(stage, it){
  const list = DATA[stage] || [];
  if (!list.length) return null;

  if (stage === 'PLL'){
    const nm = PLL_PAIR[it.name];
    const hit = list.filter(x => x.name === nm)[0];
    if (hit) return hit;
  }
  if (stage === 'OLL'){
    const fam = it.shape ? it.shape[0] : '';
    const same = list.filter(x => x.num !== it.num && x.shape && x.shape[0] === fam);
    if (same.length){
      same.sort((a,b) => Math.abs(a.num - it.num) - Math.abs(b.num - it.num));
      return same[0];
    }
  }
  if (stage === 'F2L'){
    const same = list.filter(x => x.num !== it.num && x.group === it.group);
    if (same.length){
      same.sort((a,b) => Math.abs(a.num - it.num) - Math.abs(b.num - it.num));
      return same[0];
    }
  }
  /* 兜底：编号相邻 */
  const idx = list.findIndex(x => x.num === it.num);
  return list[idx + 1] || list[idx - 1] || null;
}

/* 生成"对比教学"内容 */
function contrastOf(stage, it){
  const other = siblingOf(stage, it);
  if (!other) return null;
  const d = algoDiff(it.notation, other.notation);
  const myNick = shortName(stage, it);
  const otNick = shortName(stage, other);

  let how;
  if (d.nPre >= 2){
    how = '前 <b>' + d.nPre + '</b> 步一模一样，从这里分岔：<b>' + myNick + '</b> 接 <span class="mono">' + (d.midA || '—') + '</span>，<b>' + otNick + '</b> 接 <span class="mono">' + (d.midB || '—') + '</span>。';
  } else if (d.nSuf >= 2){
    how = '结尾 <b>' + d.nSuf + '</b> 步一样（都是 <span class="mono">' + d.suf + '</span>），开头不同：一个从 <span class="mono">' + (d.midA || '—') + '</span> 起手，一个从 <span class="mono">' + (d.midB || '—') + '</span> 起手。';
  } else {
    how = '两条公式<b>从头就不一样</b>，所以千万别靠手感记，要靠<b>看形状</b>来分。';
  }

  /* 选招依据：优先用数据里自带的认图说明 */
  let pick = (it.recog || '').replace(/^认图：/, '');
  if (!pick) pick = '看清楚"哪一块是好的、哪一块还没归位"，两者一定有一个明显不同。';

  return { other, diff: d, how, pick, myNick, otNick };
}

/* 空间想象提示：先想，再看 */
function imagineOf(stage, it){
  const nick = shortName(stage, it);
  const first = _toks(it.notation)[0] || 'R';
  if (stage === 'F2L'){
    return '第 1 步是 <span class="mono">' + first + '</span>。先<b>别动手</b>，在脑子里转一遍：这一下之后，带白色的那个<b>角块</b>会跑到哪一层？想好了再点「▶ 播放」验证。';
  }
  if (stage === 'OLL'){
    return '这一招属于<b>' + nick + '</b>。先想象：转完之后，顶面的黄块会连成<b>一片</b>还是先变成<b>十字</b>？猜一下，再用播放验证——猜对了说明你的脑子里已经在"转魔方"了。';
  }
  return '先数一数：<b>有几个面有车灯</b>（相邻两个角块同色）？把答案记在心里，再看转的时候车灯往哪一面跑。';
}

/* 口诀：按公式的分段自动生成，读起来有节奏 */
function rhymeOf(stage, it){
  const toks = _toks(it.notation);
  const nick = shortName(stage, it);
  if (!toks.length) return '';
  const half = Math.ceil(toks.length / 2);
  const a = toks.slice(0, half).join(' ');
  const b = toks.slice(half).join(' ');
  const lines = [
    '<b>' + nick + '</b>先站好，看清再动手，',
    '前半句：<span class="mono">' + a + '</span>',
    '后半句：<span class="mono">' + b + '</span>',
    '念一遍，拧一遍，手比脑子快。'
  ];
  return lines.join('<br>');
}
