/* 验证：① 白顶修复 ② 顶层 OLL/PLL 识别 ③ 整体转动回调不报错 ④ 还原思路生成 */
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
  const check = (n, c) => out.push((c ? 'PASS' : 'FAIL') + ' :: ' + n + (c ? '' : '  <-- 见上'));
  const E = s => { try { return w.eval(s); } catch (e) { return 'ERR:' + e.message; } };

  setTimeout(() => {
    try {
      check('boot 无 JS 错误', errors.length === 0);
      if (errors.length) out.push('  ' + errors.join('\n  '));

      /* ① 白顶修复：solvedCube 的 U 全是白 */
      const U = E('JSON.stringify(solvedCube().U)');
      check('U 面 = 全白 (w)', U === JSON.stringify(Array(9).fill('w')));

      /* ② OLL 识别：用一条 OLL 公式的逆，造出它的情形，应被识别回来 */
      const oll = E('DATA.OLL.find(x=>x.pattern)');
      const ollCase = E('applyAlg(solvedCube(), invert(parseNotation(' + JSON.stringify(oll.notation) + ')))');
      const m = E('(function(){var c=' + JSON.stringify(ollCase) + ';return matchOLL(c);})()');
      check('matchOLL 能识别 OLL 第' + oll.num + '式', m && m.num === oll.num);

      /* ③ PLL 识别 */
      const pll = E('DATA.PLL.find(x=>x.ring)');
      const pllCase = E('applyAlg(solvedCube(), invert(parseNotation(' + JSON.stringify(pll.notation) + ')))');
      const pm = E('(function(){var c=' + JSON.stringify(pllCase) + ';return matchPLL(c);})()');
      check('matchPLL 能识别 PLL 第' + pll.num + '式', pm && pm.num === pll.num);

      /* isLastLayer 在复原态为真，打乱态为假 */
      check('isLastLayer(复原态)=true', E('isLastLayer(solvedCube())') === true);
      const scr = E('randomScramble(20)');
      const scrambled = E('(function(){var c=solvedCube();' + JSON.stringify(scr) + '.forEach(function(t){c=applyMove(c,moveOf(t));});return c;})()');
      check('isLastLayer(打乱态)=false', E('(function(){var c=' + JSON.stringify(scrambled) + ';return isLastLayer(c);})()') === false);

      /* ④ 还原思路：设置程序打乱并生成思路面板 */
      E('pracScrambleToks = ' + JSON.stringify(scr) + '; pracCube = ' + JSON.stringify(scrambled) + ';');
      E('showCfopThink()');
      const panel = doc.getElementById('cfop-think');
      check('CFOP 思路面板已生成且含 OLL/PLL', !!panel && /OLL|PLL/.test(panel.textContent));

      /* ⑤ 整体旋转渲染：drawCube 带 cubeRot 不应抛错 */
      const rotOK = E('(function(){try{drawCube(document.getElementById("prac-3d"), solvedCube(), {cubeRot:{x:30,y:20,z:10}});return true;}catch(e){return "ERR:"+e.message;}})()');
      check('drawCube(cubeRot) 渲染不报错', rotOK === true);

      /* ⑥ 数据页渲染：go("data") + renderData 不应抛错 */
      const dataOK = E('(function(){try{go("data");renderData();return document.getElementById("data-summary").textContent.length>0;}catch(e){return "ERR:"+e.message;}})()');
      check('数据页 renderData 不报错', dataOK === true);

      console.log(out.join('\n'));
      console.log('\n结果: ' + out.filter(x=>x.startsWith('PASS')).length + ' 通过, ' + out.filter(x=>x.startsWith('FAIL')).length + ' 失败');
      process.exit(out.some(x=>x.startsWith('FAIL')) ? 1 : 0);
    } catch (e) {
      console.log('测试脚本异常: ' + e.stack);
      process.exit(2);
    }
  }, 800);
}).catch(e => { console.log('加载失败: ' + e.message); process.exit(3); });
