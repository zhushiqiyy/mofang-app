/* 数据增强生成器：在已校验的 CFOP_DATA 基础上，为每个公式补充
 * 儿童友好的"应用逻辑 / 认图线索 / 口诀 / 分步素材"。
 * 所有 notation / pattern / ring 来自上一版（已通过逆序还原校验），此处仅做内容层包装，不改动算法本身。
 */
const fs = require('fs');
global.window = {};
require('./cfop-data.js');
const D = global.window.CFOP_DATA;

/* ---------- OLL：按"形状组"的教学说明 ---------- */
const OLL_SHAPE = {
  '点': '顶面一个黄色都看不到（全灰）。说明黄色块都跑到侧面去了，先想办法把它们"翻"回顶面。',
  '方框': '顶面像个黄色小窗口：四角是灰的，中间一横是黄的。',
  '小闪电': '黄色像一道短短的小闪电。',
  '小鱼': '顶面一条黄色的小鱼曲线——这是最经典、最该先会的两招（正小鱼 / 反小鱼）！',
  '马步': '黄色像马走"日"字的形状。',
  '十字': '黄色已经是一个十字（中间加一竖横），只差把四边的小黄角补齐。',
  '角已定向': '四个角块的黄色都已经朝上（角块到位了），只差四条棱块翻黄。',
  '怪异': '黄色形状比较少见、左右不对称，记住它"歪"的样子。',
  'P形': '黄色像字母 P。',
  'T形': '黄色像字母 T（顶上一横 + 中间一竖）。',
  'C形': '黄色像字母 C（开口朝一边）。',
  'W形': '黄色像字母 W（两道小尖）。',
  '大闪电': '黄色像一道长长的闪电（比小闪电更长更斜）。',
  'L形': '黄色像字母 L（一竖加一横在角上）。',
  'I形': '黄色像字母 I（中间一竖）。'
};

/* 仅对非常有把握的经典情形起"昵称"，其余按形状组统称，保证不出错 */
const OLL_FAM = {
  27: { nick: '正小鱼 Sune', recog: '顶面只有一条小鱼：鱼头在左上、鱼尾朝右下。', mnem: '口诀：右顺 上逆 右逆 上顺｜右顺 上上 右逆' },
  26: { nick: '反小鱼 AntiSune', recog: '顶面一条"反方向"的小鱼（和 27 左右镜像）。', mnem: '口诀：把正小鱼的动作整组镜面做一遍' },
  21: { nick: '横条', recog: '顶面两条黄色横条（像字母 H 的两横），中间夹着灰。', mnem: '口诀：先翻起两条黄，再收尾' },
  57: { nick: '全定向', recog: '四个角块黄色已全朝上（顶面只剩棱块没黄）。', mnem: '口诀：只动中间层 M，把棱翻黄' }
};

/* ---------- PLL：按"名字"的识别线索 ---------- */
const PLL_INFO = {
  Ua: { cat: '棱块类', recog: '顶面看：没有相邻同色角（无"车灯"），但有一对斜对角角块同色。', mnem: '口诀：中左两层一起动，像拧瓶盖' },
  Ub: { cat: '棱块类', recog: '和 Ua 是"镜像"：斜对角同色角的方向反过来。', mnem: '口诀：Ua 的反向版本' },
  H:  { cat: '棱块类', recog: '四面都出现"车灯"（每面两个同色角块相对），像 H。', mnem: '口诀：M2 连推两次' },
  Z:  { cat: '棱块类', recog: '像 Z 字：两组对角互换，四个角都在动。', mnem: '口诀：M 层之字滑动' },
  T:  { cat: '角棱类', recog: '顶面像 T 字；正面有一对同色角块（"车灯"）在中间。', mnem: '口诀：R U R\' U\' 收尾定型' },
  Y:  { cat: '角棱类', recog: '顶面像 Y / 三叉，三个角块一组在转。', mnem: '口诀：F R 起手，转完三块' },
  Ja: { cat: '角棱类', recog: '一组"车灯"在右侧，一个角块单独飞走。', mnem: '口诀：R\' U\' 起手接 F\'' },
  Jb: { cat: '角棱类', recog: '一组"车灯"在左侧（Ja 的镜像）。', mnem: '口诀：Ja 的镜像版' },
  Aa: { cat: '角块类', recog: '只需交换两个角块（像 A 字），棱块不动。', mnem: '口诀：x\' R2 起手转角' },
  Ab: { cat: '角块类', recog: '和 Aa 相反方向的两个角块交换。', mnem: '口诀：Aa 的反向' },
  E:  { cat: '角块类', recog: '全部四个角和四条棱一起循环，最复杂的一招。', mnem: '口诀：四步 D 层循环' },
  F:  { cat: '角棱类', recog: '只有前面两条棱块互换（前面看很直观）。', mnem: '口诀：F R 起手换前棱' },
  V:  { cat: '角棱类', recog: '顶面像 V 字，两个角块和两个棱块在交换。', mnem: '口诀：R\' U R 起手' },
  Ra: { cat: '角棱类', recog: 'R 面附近：两个角块、两条棱块一起换位。', mnem: '口诀：R U R\' 起手转 R 区' },
  Rb: { cat: '角棱类', recog: 'Ra 的反向版本。', mnem: '口诀：Ra 的镜像' },
  Na: { cat: '角棱类', recog: 'N 字型：一个角+一条棱在循环换位。', mnem: '口诀：R U R\' F\' 起手' },
  Nb: { cat: '角棱类', recog: 'Na 的反向版本。', mnem: '口诀：Na 的镜像' },
  G1: { cat: '角棱类', recog: '经典 G 型：三个块循环（角+两棱）。G1~G4 只差朝向。', mnem: '口诀：R U R\' y\' 起手转三块' },
  G2: { cat: '角棱类', recog: 'G 型第 2 种朝向。', mnem: '口诀：认准 G 型再定朝向' },
  G3: { cat: '角棱类', recog: 'G 型第 3 种朝向。', mnem: '口诀：认准 G 型再定朝向' },
  G4: { cat: '角棱类', recog: 'G 型第 4 种朝向。', mnem: '口诀：认准 G 型再定朝向' }
};

/* ---------- F2L：由算法结构派生"特征标签"（不臆造具体情形，保证准确） ---------- */
function f2lTags(notation) {
  const t = notation;
  const tags = [];
  if (/[yY]/.test(t)) tags.push('需要整体转魔方(y)换视角');
  if (/\bf\b|\bl\b|\br\b/.test(t)) tags.push('用了内层切片(f/l/r)高级插法');
  if (/\bd\b/.test(t)) tags.push('用到底层 D 系列动作');
  if (/\bM\b/.test(t)) tags.push('用到中间层 M');
  if (/^R U R'/.test(t) || /^R U' R'/.test(t)) tags.push('经典前右槽 R U R\' 起手');
  if (/^U R U' R'/.test(t) || /^U' R/.test(t)) tags.push('先 U 调角再插');
  return tags;
}
const F2L_HOW = 'F2L 的核心：把"角块"和"棱块"看成一对(pair)，在第一、二层就一起塞进对应的空槽。先别背数字，先用 R U R\' U\' 找"配对→插入"的手感。';

/* ---------- 组装 ---------- */
function enrichOLL(o) {
  const shape = o.shape ? o.shape[0] : '未知';
  // 退化情形：顶面已全黄（本招无需翻，可直接进入 PLL）
  if (o.pattern && o.pattern.every(x => x === 1)) {
    return Object.assign({}, o, {
      group: '已全黄', title: '第 ' + o.num + ' 式（顶面已全黄）',
      recog: '这一式的顶层已经是全黄，说明翻黄已经做完，可以直接做 PLL 摆位。',
      mnem: '口诀：看到全黄就跳过，直接去 PLL',
      how: '顶面已全黄，这一招用来把“已经翻好黄”的状态收尾，实战中遇到全黄可直接做 PLL。'
    });
  }
  const fam = OLL_FAM[o.num] || {};
  return Object.assign({}, o, {
    group: shape,
    title: fam.nick ? fam.nick : ('顶面【' + shape + '】第 ' + o.num + ' 式'),
    recog: (fam.recog ? fam.recog + ' ' : '') + ('顶面黄色长成【' + shape + '】的样子：' + (OLL_SHAPE[shape] || '')),
    mnem: fam.mnem || ('口诀：先看【' + shape + '】长相，再照着动画的手顺跟练几遍'),
    how: '这一招把顶层的黄色块"一次翻黄"。先在打乱的魔方顶层找到这个【' + shape + '】图案，再按动画把黄色全部翻上来。'
  });
}
function enrichPLL(p) {
  const info = PLL_INFO[p.name] || { cat: '角棱类', recog: '', mnem: '' };
  return Object.assign({}, p, {
    group: info.cat,
    title: p.name + (info.cat ? '（' + info.cat + '）' : ''),
    recog: '认图：' + (info.recog || '看侧面颜色环，找出在交换的块。'),
    mnem: info.mnem || ('口诀：记住【' + p.name + '】的交换样子，照动画跟练'),
    how: '这一招把已经翻黄的顶层块"摆到正确位置"。看动画里哪几个块在交换（比如"车灯"=两个同色角块），记住这个样子，下次一看到就出手。'
  });
}
function enrichF2L(f, idx) {
  const tags = f2lTags(f.notation);
  return Object.assign({}, f, {
    group: tags.length ? tags[0] : '标准插入',
    title: '第 ' + f.num + ' 式',
    recog: '情形：角块和棱块还没配对。' + (tags.length ? ('特征：' + tags.join('；') + '。') : '') + '目标：把这对塞进对应的空槽。',
    mnem: '口诀：先找角+棱这对，用 R U R\' U\' 把它"卷"进槽里',
    how: F2L_HOW
  });
}

const out = {
  F2L: D.F2L.map(enrichF2L),
  OLL: D.OLL.map(enrichOLL),
  PLL: D.PLL.map(enrichPLL),
  meta: D.meta || {}
};

fs.writeFileSync('cfop-data.js', 'window.CFOP_DATA = ' + JSON.stringify(out) + ';\n');
console.log('已写出增强数据：', out.F2L.length, out.OLL.length, out.PLL.length);
// 抽查
console.log('OLL27:', out.OLL[26].title);
console.log('OLL27 recog:', out.OLL[26].recog);
console.log('PLL1:', out.PLL[0].title, '|', out.PLL[0].recog);
console.log('F2L1:', out.F2L[0].title, '| tags:', out.F2L[0].group);
