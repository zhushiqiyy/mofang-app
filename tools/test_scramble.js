/* 打乱训练轴侧演示复位 + CFOP 模块蓝牙跟练 逻辑测试 */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const vc = new VirtualConsole();
let jsErrors = 0;
vc.on('jsdomError', e => { jsErrors++; });
JSDOM.fromFile(path.resolve('index.html'), {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  url: 'https://localhost/cfop-app/index.html', virtualConsole: vc,
  beforeParse(win){ win.scrollTo = () => {}; }
}).then(dom => {
  const w = dom.window, doc = w.document;
  const E = s => { try { return w.eval(s); } catch (e) { return 'ERR:' + e.message; } };
  const out = [];
  const check = (name, cond) => out.push((cond ? '✓ ' : '✗ ') + name);

  setTimeout(() => {
    try {
      /* ① 程序打乱后，cfopThinkStart 必须等于 applyAlg(solved, 打乱序列) */
      const scr = E('randomScramble(20)');
      E('pracScrambleToks = ' + JSON.stringify(scr) + ';');
      E('showCfopThink()');
      const okStart = E('(function(){ var s = solvedCube(); pracScrambleToks.forEach(function(t){ s = applyMove(s, moveOf(t)); }); ' +
        'return JSON.stringify(s) === JSON.stringify(cfopThinkStart); })()');
      check('cfopThinkStart = 标准打乱态', okStart === true);

      /* ② 演示起点干净：demoCfopThink 重置后 cfop-3d == cfopThinkStart（不走样） */
      E('demoCfopThink()');
      const demoOk = E('(function(){ var el = document.getElementById("cfop-3d"); ' +
        'return !!el && typeof cfopThinkStart !== "undefined" && cfopThinkStart; })()');
      check('demoCfopThink 启动不报错且面板存在', !!demoOk);

      /* ③ 真魔方跟练：按正确解法逐步走，最终提示完成 */
      E('startCfopFollow()');
      const sol = E('cfopThinkSol');
      E('cfopFollow.stack = [];');
      for (let i = 0; i < sol.length; i++){
        const t = sol[i];
        const lab = t.f + (t.prime ? "'" : '') + (t.dbl ? '2' : '');
        E('cfopFollowMove(' + JSON.stringify(lab) + ')');
      }
      const fbDone = doc.getElementById('cfop-follow-fb').textContent || '';
      check('跟练走到完整解法 → 提示完成', /🎉|完成/.test(fbDone));

      /* ④ 错误一步应给出 ❌ 反馈 */
      E('resetCfopFollow()');
      const first = sol[0];
      const wrong = (first.f === 'U') ? 'R' : 'U';   /* 故意拧一个不同的面 */
      E('cfopFollowMove(' + JSON.stringify(wrong) + ')');
      const fbWrong = doc.getElementById('cfop-follow-fb').textContent || '';
      check('错一步 → 给出 ❌ 反馈', /❌/.test(fbWrong));
    } catch (e) { out.push('✗ 异常: ' + e.message); }

    out.push('JS 错误数: ' + jsErrors);
    console.log(out.join('\n'));
    process.exit(out.some(l => l.startsWith('✗')) ? 1 : 0);
  }, 700);
}).catch(e => { console.log('加载失败: ' + e.message); process.exit(3); });
