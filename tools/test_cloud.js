/* 云端 GitHub 数据库相关逻辑测试（jsdom 运行时） */
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
      /* ① UTF-8 base64 往返（含中文/emoji） */
      const rt = E('b64decodeUtf8(b64encodeUtf8("魔方U白测试🔋abc"))');
      check('b64 UTF-8 往返正确', rt === '魔方U白测试🔋abc');

      /* ② ghRawUrl 默认拼接 */
      const raw = E('store.cloud={owner:"zhushiqiyy",repo:"mofang-data",branch:"main",path:"training-data.json"}; ghRawUrl()');
      check('ghRawUrl 默认链接正确', raw === 'https://raw.githubusercontent.com/zhushiqiyy/mofang-data/main/training-data.json');

      /* ③ 模式切换显隐 */
      doc.getElementById('cloud-mode').value = 'url';
      E('onCloudMode()');
      check('切到自定义服务器时隐藏 GitHub 区',
        doc.getElementById('cloud-github').style.display === 'none' &&
        doc.getElementById('cloud-url').style.display !== 'none');
      doc.getElementById('cloud-mode').value = 'github';
      E('onCloudMode()');
      check('切回 GitHub 时显示 GitHub 区',
        doc.getElementById('cloud-github').style.display !== 'none' &&
        doc.getElementById('cloud-url').style.display === 'none');

      /* ④ 无令牌时上传给出提示且不抛错 */
      E('store.cloud={mode:"github",owner:"x",repo:"y",token:""};');
      E('uploadGithub(false)');
      check('无令牌上传给出提示', /需要个人访问令牌/.test(doc.getElementById('data-cloud-msg').textContent));

      /* ⑤ 配置回填 */
      E('store.cloud={mode:"github",owner:"zhushiqiyy",repo:"mofang-data",path:"t.json",branch:"main",token:"abc",auto:true};');
      E('go("data")');
      const owner = doc.getElementById('gh-owner').value;
      const token = doc.getElementById('gh-token').value;
      const auto = doc.getElementById('gh-auto').checked;
      check('云端配置回填到表单', owner === 'zhushiqiyy' && token === 'abc' && auto === true);

      /* ⑥ saveDataCloud 读取 GitHub 字段 */
      doc.getElementById('gh-owner').value = 'myowner';
      doc.getElementById('gh-repo').value = 'myrepo';
      doc.getElementById('gh-path').value = 'data.json';
      doc.getElementById('gh-branch').value = 'dev';
      doc.getElementById('gh-token').value = 'tok123';
      doc.getElementById('gh-auto').checked = true;
      E('saveDataCloud()');
      const c = E('store.cloud');
      check('saveDataCloud 写入 GitHub 配置',
        c.mode === 'github' && c.owner === 'myowner' && c.repo === 'myrepo' &&
        c.path === 'data.json' && c.branch === 'dev' && c.token === 'tok123' && c.auto === true);
    } catch (e) { out.push('✗ 异常: ' + e.message); }

    out.push('JS 错误数: ' + jsErrors);
    console.log(out.join('\n'));
    process.exit(out.some(l => l.startsWith('✗')) ? 1 : 0);
  }, 700);
}).catch(e => { console.log('加载失败: ' + e.message); process.exit(3); });
