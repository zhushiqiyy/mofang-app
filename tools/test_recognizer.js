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

      /* ⑦ GYRO 增量式 + 死区 + 限幅：造 0x1 包，验证"静置不转 / 抖动过滤 / 不跑飞" */
      const gyro = E('(function(){' +
        'function mkBuf(raw){var b=new Uint8Array(20); b[0]=0x01;' +           /* eventType=0x1 */
        'b[2]=raw[0]&255; b[3]=(raw[0]>>8)&255;' +
        'b[4]=raw[1]&255; b[5]=(raw[1]>>8)&255;' +
        'b[6]=raw[2]&255; b[7]=(raw[2]>>8)&255;' +
        'return b;}' +
        'ganGyroRef=null; ganGyroSens=1; pracCubeRot={x:0,y:0,z:0};' +
        'var bitsA=ganBits(mkBuf([100,200,-50]));' +
        'ganDecodeGyro(bitsA);' +                                     /* 首帧建基线 */
        'var bitsB=ganBits(mkBuf([100,200,-50]));' +                   /* 完全相同 = 静置 */
        'var g1=ganDecodeGyro(bitsB); addPracCubeRot(g1.rot);' +
        'var idleX=pracCubeRot.x, idleY=pracCubeRot.y, idleZ=pracCubeRot.z;' +
        'var bitsC=ganBits(mkBuf([105,203,-45]));' +                   /* 各轴 +5（<死区12） */
        'var g2=ganDecodeGyro(bitsC); addPracCubeRot(g2.rot);' +
        'var jitterX=pracCubeRot.x;' +
        'for(var i=0;i<200;i++){var bitsD=ganBits(mkBuf([100+i*100, 200, -50])); var g=ganDecodeGyro(bitsD); addPracCubeRot(g.rot);}' + /* 持续大幅变化，测试限幅 */
        'return JSON.stringify({idleX:idleX,idleY:idleY,idleZ:idleZ,jitterX:jitterX,' +
        'clampX:pracCubeRot.x,clampY:pracCubeRot.y,clampZ:pracCubeRot.z});' +
        '})()');
      const G = gyro && gyro.indexOf('ERR') < 0 ? JSON.parse(gyro) : null;
      check('GYRO 静置(完全相同)不转', !!G && G.idleX===0 && G.idleY===0 && G.idleZ===0);
      check('GYRO 小幅抖动(+5<死区)被过滤', !!G && G.jitterX===0);
      check('GYRO 单轴偏转被限幅在 ±80° 内', !!G && Math.abs(G.clampX)<=80 && Math.abs(G.clampY)<=80 && Math.abs(G.clampZ)<=80);

      /* ⑧ 电量修正：0x4 包 byte13=99(旧误报位) byte17=42(真电量)，连续两帧一致应得 42 而非 99 */
      const batt = E('(function(){' +
        'function mkBatt(lvl){var b=new Uint8Array(20); b[0]=0x40; b[13]=99; b[17]=lvl; return b;}' + /* GAN Gen2: eventType 在高半字节 */
        'var st={lastSerial:-1}; var out1=[]; ganGen2Parse(ganBits(mkBatt(42)), st, out1);' +
        'var out2=[]; ganGen2Parse(ganBits(mkBatt(42)), st, out2);' +    /* 第二帧 → 稳定 */
        'var lvl=null; out2.forEach(function(e){if(e.type==="BATTERY")lvl=e.level;});' +
        'return lvl;})()');
      check('电量从 byte17 读取(=42，非 byte13 的 99)', batt === 42);

      /* ⑨ CFOP 思路面板含 3D 预览且演示函数可运行 */
      E('pracScramble(); showCfopThink();');
      const cfop3d = doc.getElementById('cfop-3d');
      check('CFOP 思路面板含 3D 预览(cfop-3d 已渲染)', !!cfop3d && cfop3d.querySelector('svg') != null);
      const demoRun = E('(function(){try{demoCfopThink();return true;}catch(e){return "ERR:"+e.message;}})()');
      check('demoCfopThink 演示不抛错', demoRun === true);

      console.log(out.join('\n'));
      console.log('\n结果: ' + out.filter(x=>x.startsWith('PASS')).length + ' 通过, ' + out.filter(x=>x.startsWith('FAIL')).length + ' 失败');
      process.exit(out.some(x=>x.startsWith('FAIL')) ? 1 : 0);
    } catch (e) {
      console.log('测试脚本异常: ' + e.stack);
      process.exit(2);
    }
  }, 800);
}).catch(e => { console.log('加载失败: ' + e.message); process.exit(3); });
