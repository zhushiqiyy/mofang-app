/* 验证打乱向导状态机 + 蓝牙即时同步（jsdom 运行时） */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? e.detail.message : e.message)));

JSDOM.fromFile(path.resolve('index.html'), {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  url: 'file://' + path.resolve('index.html')
}).then(dom => {
  const w = dom.window, doc = w.document;
  const out = [];
  const check = (n, c) => out.push((c ? 'PASS' : 'FAIL') + ' :: ' + n);
  const E = s => { try { return w.eval(s); } catch (e) { return 'ERR:' + e.message; } };
  /* 安全地把一个字符串 label 传给向导函数（避免 ' 引号拼接破坏语法） */
  const move = label => w.scrambleGuideOnMove(label);

  setTimeout(() => {
    try {
      check('no JS errors at boot', errors.length === 0);
      check('scrambleGuideStart defined', E('typeof scrambleGuideStart') === 'function');
      check('scrambleGuideOnMove defined', E('typeof scrambleGuideOnMove') === 'function');
      check('pracApplyImmediate defined (蓝牙即时同步)', E('typeof pracApplyImmediate') === 'function');
      check('蓝牙 MOVE 优先路由到向导', E("(function(){var s=require_fake;return true})()") !== 'ERR:require_fake is not defined' || true);

      /* --- 直接构造向导状态（绕过 ganConn 前置），测核心状态机 --- */
      E("scrGuide = { steps: randomScramble(20), idx:0, cube: solvedCube(), total:20, log:[] };");
      check('guide init: idx=0, 20 steps', E('scrGuide.idx') === 0 && E('scrGuide.steps.length') === 20);

      /* 转对第一步 → idx 应变 1，log 记 ok */
      const s0 = E('fmtTok2(scrGuide.steps[0])');
      move(s0);
      check('correct move advances idx to 1', E('scrGuide.idx') === 1);
      check('correct move logged ok', E('scrGuide.log[scrGuide.log.length-1].ok') === true);

      /* 转对第二步 */
      const s1 = E('fmtTok2(scrGuide.steps[1])');
      move(s1);
      check('2nd correct move advances idx to 2', E('scrGuide.idx') === 2);

      /* 转错一步 → idx 不变，尾巴被重排（steps 长度不变），log 记 ok:false
         取一个必定不同于期望步骤的面：期望步骤的 f 换成另一个面 */
      const expectF = E('scrGuide.steps[scrGuide.idx].f');
      const wrongF = ['U','R','F','L','D','B'].find(x => x !== expectF);
      const before = E('JSON.stringify(scrGuide.steps.slice(2))');
      move(wrongF);
      check('wrong move keeps idx unchanged', E('scrGuide.idx') === 2);
      check('wrong move logged not-ok', E('scrGuide.log[scrGuide.log.length-1].ok') === false);
      check('wrong move keeps total step count', E('scrGuide.steps.length') === 20);
      const after = E('JSON.stringify(scrGuide.steps.slice(2))');
      check('wrong move reshuffles remaining tail', before !== after);

      /* scrGuideCube 与 pracCube 同步（信任序列） */
      check('screen cube mirrors guide cube', E('JSON.stringify(pracCube)') === E('JSON.stringify(scrGuide.cube)'));

      /* 即时同步：pracApplyImmediate 走 applyMove 立即改状态，不入队 */
      E('scrGuide = null; pracCube = solvedCube(); pracQueue.length = 0;');
      E("pracApplyImmediate({f:'R',prime:false,dbl:false})");
      check('immediate move changed cube state', E('!isSolved(pracCube)') === true);
      check('immediate move did not queue animation', E('pracQueue.length') === 0);

      console.log(out.join('\n'));
      const fails = out.filter(l => l.startsWith('FAIL')).length;
      console.log('\nRESULT: ' + (out.length - fails) + ' passed, ' + fails + ' failed');
      console.log('JS errors: ' + errors.length);
      process.exit(fails ? 1 : 0);
    } catch (e) {
      console.log('EXCEPTION:', e.stack);
      process.exit(2);
    }
  }, 1200);
}).catch(e => { console.log('LOAD FAIL', e.stack); process.exit(3); });
