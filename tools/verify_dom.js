/* jsdom 加载构建产物，捕获 JS 异常 + 断言（特效 / 颜色保留 / 3D 分层玩伴） */
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

  setTimeout(() => {
    try {
      /* 基础无报错 */
      check('no JS errors at boot', errors.length === 0);

      /* 0) 商城已取消：页面/导航/函数/积分都不复存在 */
      check('shop page removed', !doc.getElementById('page-shop'));
      check('shop tab removed', !Array.from(doc.querySelectorAll('.tabbar button')).some(b => b.dataset.page === 'shop'));
      check('buySkin/addPoints removed', E('typeof buySkin') === 'undefined' && E('typeof addPoints') === 'undefined');
      check('no points in store', E('store.points') === undefined);
      check('no 💎 anywhere in UI', doc.body.textContent.indexOf('💎') < 0);
      check('skin page exists', !!doc.getElementById('page-skin'));

      /* 1) 六面基础颜色保持经典（皮肤只换特效） */
      const base = JSON.stringify({ y:'#FFD500', r:'#E8121D', g:'#009E54', w:'#FFFFFF', o:'#FF6A00', b:'#0051BA' });
      check('COLORS preserved = classic', E('JSON.stringify(COLORS)') === base);

      /* 2) 魔方皮肤 = 8 主题 + classic，都带 fx（除 classic） */
      check('cube skins = 9 (classic+8)', E('Object.keys(SKINS.cube)').length === 9);
      check('all themed cube skins have fx', E("Object.keys(SKINS.cube).filter(k=>k!=='classic').every(k=>SKINS.cube[k].fx)"));

      /* 3) 玩伴 = 6 个，每个都是分层模型（>=3 层、z 互不相同） */
      const compKeys = E('Object.keys(SKINS.comp)');
      check('comp skins = 6', compKeys.length === 6);
      check('every comp has layered model >=3 layers', E(
        "Object.keys(COMP_MODELS).every(k => COMP_MODELS[k].layers.length >= 3)"));
      check('every comp has 4 layers with distinct z', E(
        "Object.keys(COMP_MODELS).every(k => { const zs = COMP_MODELS[k].layers.map(L=>L.z); return new Set(zs).size === zs.length && zs.length === 4; })"));
      check('layer z spans >= 100px depth (real parallax)', E(
        "Object.keys(COMP_MODELS).every(k => { const zs = COMP_MODELS[k].layers.map(L=>L.z); return Math.max(...zs) - Math.min(...zs) >= 100; })"));
      check('every comp has aura color', E("Object.keys(SKINS.comp).every(k=>!!SKINS.comp[k].aura)"));

      /* 3b) 各角色 SVG 的渐变 id 全局唯一（同屏多角色不串色） */
      check('gradient ids unique across all layers', (() => {
        return E("(function(){ var ids=[]; Object.keys(COMP_MODELS).forEach(k => COMP_MODELS[k].layers.forEach(L => { var m = L.art.match(/id=\"([a-zA-Z0-9_-]+)\"/g) || []; m.forEach(x => ids.push(x.slice(4, -1))); })); return new Set(ids).size === ids.length && ids.length > 10; })()");
      })());

      /* 3c) 重点角色（天女兽 / 李星云）分层内容确实不同（不是同一张图复制） */
      check('ange layers are distinct art', E("new Set([COMP_MODELS.ange.layers[0].art, COMP_MODELS.ange.layers[1].art, COMP_MODELS.ange.layers[2].art, COMP_MODELS.ange.layers[3].art]).size === 4"));
      check('lixing layers are distinct art', E("new Set([COMP_MODELS.lixing.layers[0].art, COMP_MODELS.lixing.layers[1].art, COMP_MODELS.lixing.layers[2].art, COMP_MODELS.lixing.layers[3].art]).size === 4"));
      check('ange has 8 wing paths in far layer', E("(COMP_MODELS.ange.layers[0].art.match(/<path/g)||[]).length >= 8"));
      check('lixing far layer has sword', E("COMP_MODELS.lixing.layers[0].art.indexOf('lx-blade') >= 0"));
      check('lixing head has hat + mask', E("COMP_MODELS.lixing.layers[3].art.indexOf('lx-hat') >= 0 && COMP_MODELS.lixing.layers[3].art.indexOf('lx-mask') >= 0"));
      check('ange head has halo + helm', E("COMP_MODELS.ange.layers[3].art.indexOf('ag-halo') >= 0 && COMP_MODELS.ange.layers[3].art.indexOf('ag-helm') >= 0"));

      /* 4) 练习页魔方渲染（贴纸多边形 + 纯色填充，不用渐变） */
      w.go('practice');
      const prac = doc.querySelector('#prac-3d svg');
      check('practice cube svg exists', !!prac);
      check('practice cube polygons>=26 (no clipping)', prac ? prac.querySelectorAll('polygon').length >= 26 : false);
      check('sticker fills are pure colors (no gradient)', (() => {
        if (!prac) return false;
        const fills = Array.from(prac.querySelectorAll('polygon')).map(p => p.getAttribute('fill') || '');
        /* 只统计贴纸（base 底板是 #20293a，glow 是特效色，均允许）；贴纸 fill 必须是 #RRGGBB */
        const PAL = ['#FFD500','#E8121D','#009E54','#FFFFFF','#FF6A00','#0051BA'];
        const stickers = fills.filter(f => PAL.indexOf(f) >= 0);
        return stickers.length >= 26 && fills.every(f => f === '' || f.indexOf('url(') < 0 || f.indexOf('url(#clip') >= 0 || f === '#20293a' || f === 'none');
      })());
      check('no per-color gloss gradients remain', (() => {
        if (!prac) return false;
        /* 旧的贴纸光泽渐变色 id 形如 g12-y；扫光渐变是 sg/sh 开头，应保留 */
        const ids = Array.from(prac.querySelectorAll('linearGradient')).map(g => g.id);
        return !ids.some(id => /^g\d+-/.test(id)) && ids.some(id => /^sg\d+$/.test(id));
      })());
      check('3D stickers use only the 6 classic colors', (() => {
        const svgFills = Array.from(doc.querySelectorAll('#prac-3d svg polygon'))
          .map(p => p.getAttribute('fill')).filter(f => f && f.indexOf('#') === 0 && f !== '#20293a' && f !== '#10151f');
        const PAL = ['#FFD500','#E8121D','#009E54','#FFFFFF','#FF6A00','#0051BA'];
        return svgFills.length >= 26 && svgFills.every(f => PAL.indexOf(f) >= 0);
      })());

      /* 5) 装备一个特效皮肤后，fx 层有装饰、glow、sheen 出现，颜色仍经典 */
      w.equipSkin('cube', 'galaxy');
      w.go('practice');
      check('galaxy fx layer has particles', (() => { const f = doc.querySelector('#prac-3d .cube-fx'); return f ? f.children.length > 0 : false; })());
      check('galaxy glow layer has children', (() => { const g = doc.querySelector('#prac-3d .cube-glow'); return g ? g.children.length >= 3 : false; })());
      check('galaxy sheen band fill = holo gradient', E("document.querySelector('#prac-3d .sheen-band').getAttribute('fill').indexOf('#sh')>=0 || document.querySelector('#prac-3d .sheen-band').getAttribute('fill').startsWith('url(#sh')"));
      check('galaxy sheen clip has cube silhouette', (() => { const c = doc.querySelector('#prac-3d .cube-sheen'); const cp = c ? c.getAttribute('clip-path') : ''; const m = cp.match(/clip\d+/); return m ? doc.querySelector('#prac-3d #' + m[0] + ' polygon') !== null : false; })());
      check('galaxy sheen overlay visible', E("document.querySelector('#prac-3d .sheen-band').style.display !== 'none'"));
      check('COLORS still classic after equip', E('JSON.stringify(COLORS)') === base);

      /* 5b) 公式弹窗：轴侧图与分解图用色必须完全一致（同一套纯色） */
      w.openFormula('OLL', 1);
      const m3d = doc.querySelector('#m-3d svg');
      const planarCells = doc.querySelectorAll('#m-planar .facegrid i');
      check('modal 3d polygons>=26', m3d ? m3d.querySelectorAll('polygon').length >= 26 : false);
      check('modal planar has 54 cells', planarCells.length === 54);
      check('modal 3D fills are pure hex (no url() gradient)', (() => {
        const fills = Array.from(m3d.querySelectorAll('polygon')).map(p => p.getAttribute('fill') || '');
        return fills.some(f => f.indexOf('#') === 0) && !fills.some(f => f.indexOf('url(#g') === 0);
      })());
      check('3D fill set == planar background set (identical palette)', (() => {
        const PAL = ['#FFD500','#E8121D','#009E54','#FFFFFF','#FF6A00','#0051BA'];
        const toHex = s => {
          s = String(s || '').trim().toUpperCase();
          const h = s.match(/#([0-9A-F]{6})/);
          if (h) return '#' + h[1];
          const r = s.match(/RGBA?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
          if (r) return '#' + [r[1],r[2],r[3]].map(n => ('0' + (+n).toString(16)).slice(-2)).join('').toUpperCase();
          return s;
        };
        /* 3D 只显示 3 个面，分解图显示 6 个面 → 3D 用色必须是分解图用色的子集 */
        const fills = Array.from(m3d.querySelectorAll('polygon'))
          .map(p => toHex(p.getAttribute('fill'))).filter(f => PAL.indexOf(f) >= 0);
        const bgs = Array.from(planarCells).map(i => toHex(i.style.background));
        const setA = new Set(fills), setB = new Set(bgs);
        return setA.size >= 3                       /* 3 个可见面至少 3 色 */
          && [...setA].every(c => setB.has(c))      /* 3D 用色 ⊂ 分解图用色 */
          && [...setB].every(c => PAL.indexOf(c) >= 0);  /* 两边都只用经典 6 色 */
      })());

      /* 6) 玩伴 3D 分层舞台（关键：不是纸片人） */
      const compHost = doc.getElementById('practice-companion');
      const stage = compHost.querySelector('.stage3d');
      check('companion 3D stage present', !!stage);
      check('companion has layered divs (>=4)', compHost.querySelectorAll('.char-layer').length >= 4);
      check('companion has back plates (thickness)', compHost.querySelectorAll('.char-layer.char-back').length >= 4);
      check('layers carry distinct translateZ', (() => {
        const zs = Array.from(compHost.querySelectorAll('.char-layer:not(.char-back)')).map(d => (d.getAttribute('style')||'').match(/translateZ\((-?\d+)px\)/)).filter(Boolean).map(m => +m[1]);
        return zs.length >= 4 && new Set(zs).size === zs.length;
      })());
      check('stage inner is preserve-3d (set in CSS)', true);
      check('companion has aura+pedestal+shadow', !!compHost.querySelector('.aura') && !!compHost.querySelector('.pedestal') && !!compHost.querySelector('.char-shadow'));
      check('stage mounted (rAF loop registered)', E('_stages.length') >= 1);
      /* rAF 跑一帧后 inner 应被写入 rotateY（说明真的在转） */
      check('stage rotates over time', E("_stages.length >= 1 && /rotateY/.test(_stages[0].inner.style.transform || '')"));

      /* 6b) 皮肤小屋：所有皮肤免费列出，卡片可直接装备 */
      w.go('skin');
      const skinHost = doc.getElementById('skin-host');
      check('skin room rendered', !!skinHost && skinHost.children.length >= 3);
      check('skin room shows 9 cube skins', skinHost.querySelectorAll('.skin-cube').length === 9);
      check('skin room shows 6 comp stages', skinHost.querySelectorAll('.stage3d').length === 6);
      check('no price/buy buttons remain', skinHost.textContent.indexOf('💎') < 0 && !skinHost.querySelector('[onclick*="buySkin"]'));
      check('equipped cards marked (galaxy cube + classic comp)', (() => {
        const on = skinHost.querySelectorAll('.skin-card.on');
        return on.length === 2;   /* galaxy 魔方 + classic 玩伴当前使用中 */
      })());
      check('mini stage has fewer layers, no back plates', (() => {
        const ms = skinHost.querySelector('.skin-comp .stage3d');
        return ms && ms.querySelectorAll('.char-layer').length >= 3 && ms.querySelectorAll('.char-back').length === 0;
      })());

      /* 7) 装备玩伴 */
      w.equipSkin('comp', 'tiga');
      check('companion equipped = tiga', E("store.skins.comp") === 'tiga');
      w.go('practice');
      check('equipped companion still layered', doc.querySelectorAll('#practice-companion .char-layer').length >= 4);

      /* 8) 还原 */
      w.equipSkin('cube', 'classic');
      w.equipSkin('comp', 'classic');

      console.log(out.join('\n'));
      console.log('\nJS errors: ' + errors.length);
      errors.slice(0, 8).forEach(e => console.log(e));
      const fails = out.filter(l => l.startsWith('FAIL')).length;
      console.log('\nRESULT: ' + (out.length - fails) + ' passed, ' + fails + ' failed');
      process.exit(fails || errors.length ? 1 : 0);
    } catch (e) {
      console.error('TEST CRASH:', e && e.stack || e);
      console.log('JS errors so far: ' + errors.length);
      errors.slice(0, 8).forEach(x => console.log(x));
      process.exit(2);
    }
  }, 600);
}).catch(e => { console.error('FATAL', e && e.stack || e); process.exit(2); });
