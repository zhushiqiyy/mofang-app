/* 静态验收：不依赖 jsdom，直接对构建产物 index.html 做内容级断言
 * 覆盖：商城零残留 / 皮肤小屋 / 纯色贴纸 / 3D 分层玩伴 / 8 皮肤 / PWA 完整性 / 离线自包含
 * 退出码 0 = 全部通过 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0;
const fails = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fails.push(name); console.log('  ✗ ' + name); }
}
function has(s) { return html.indexOf(s) >= 0; }
function count(s) { return html.split(s).length - 1; }

console.log('== 1. 商城/积分零残留 ==');
ok('无 buySkin 函数', !has('buySkin'));
ok('无 addPoints 函数', !has('addPoints'));
ok('无 price 字段', !/price\s*:/.test(html));
ok('无 #page-shop 容器', !has('id="page-shop"'));
ok('无 🛒 商城导航', !has('🛒'));
ok('无积分 chip', !has('points-chip') && !has('💎'));
ok('无拥有权校验逻辑（delete 旧数据清理除外）', !/owned\s*\.indexOf|if\s*\(\s*!?\s*\w*\.?skins?\.owned/.test(html));

console.log('== 2. 皮肤小屋（免费换装）==');
ok('renderSkinRoom 存在', has('renderSkinRoom'));
ok('皮肤导航入口', has('🎨皮肤') || has('皮肤小屋'));
ok('免费「换上」按钮', has('换上'));

console.log('== 3. 轴侧视图纯色贴纸（无渐变反光）==');
ok('贴纸 fill 用纯色 pal[it.color]', has("node.setAttribute('fill', pal[it.color]"));
ok('无 glossGrad 渐变函数', !has('glossGrad'));
ok('无 hexToRgb 着色函数', !has('hexToRgb'));
ok('cubeView 贴纸无 url(#g 渐变引用', !/pal\[it\.color\][\s\S]{0,200}url\(#g/.test(html));
ok('默认无特效（CUBE_FX 初值 null）', /let CUBE_FX = null/.test(html));
ok('扫光带默认隐藏（display:none）', has("sheenBand.setAttribute('style', 'display:none')"));
ok('皮肤特效层保留（sheen-band-gloss/holo 仅在换装后激活）', has('sheen-band-gloss') && has('sheen-band-holo'));

console.log('== 4. 3D 分层玩伴 ==');
ok('companion3DMarkup 生成器', has('companion3DMarkup'));
ok('stage3d 舞台容器', has('stage3d'));
ok('char-layer 分层', has('char-layer'));
ok('char-back 背板（旋转 180° 立体感）', has('char-back'));
ok('applyShade 动态光照', has('applyShade'));
ok('translateZ 深度层', has('translateZ'));
ok('preserve-3d', has('preserve-3d'));

console.log('== 5. 五大 named 玩伴 + 8 皮肤 ==');
for (const c of ['迪迦', '天女兽', '柯南', '李星云', '皮卡丘']) ok('玩伴 ' + c, has(c));
ok('COMP_MODELS 模型表', has('COMP_MODELS'));
ok('SKINS 皮肤表含 8 种元素特效（不含经典）', (html.match(/fx:'(?:flame|ocean|forest|sun|galaxy|aurora|bubble|brill)'/g) || []).length === 8);
ok('SKINS 玩伴表含 5 位 named 角色', ['tiga','ange','conan','lixing','pika'].every(k => has(k + ':')));
ok('默认玩伴非纸片人（有分层模型）', has('小助手'));

console.log('== 6. PWA / iPad 安装 ==');
ok('manifest 链接', has('rel="manifest"'));
ok('apple-touch-icon', has('apple-touch-icon'));
ok('apple-mobile-web-app-capable', has('apple-mobile-web-app-capable'));
ok('serviceWorker 注册', has('serviceWorker') && has('.register'));
ok('viewport 含 viewport-fit=cover', has('viewport-fit=cover'));
ok('root 目录 manifest.webmanifest 存在', fs.existsSync(path.join(__dirname, '..', 'manifest.webmanifest')));
ok('root 目录 sw.js 存在', fs.existsSync(path.join(__dirname, '..', 'sw.js')));
ok('root 目录 icon-180.png 存在', fs.existsSync(path.join(__dirname, '..', 'icon-180.png')));
ok('root 目录 icon-192.png 存在', fs.existsSync(path.join(__dirname, '..', 'icon-192.png')));
ok('root 目录 icon-512.png 存在', fs.existsSync(path.join(__dirname, '..', 'icon-512.png')));

console.log('== 7. 离线自包含（无外网资源）==');
const extRefs = (html.match(/(?:src|href)="https?:\/\/[^"]*"/g) || []).filter(u => !u.includes('www.w3.org'));
ok('无外部 src/href 资源（w3.org 命名空间除外）', extRefs.length === 0);
if (extRefs.length) console.log('    外链: ' + extRefs.join(', '));
ok('单文件 ≤ 400KB', html.length < 400 * 1024);

console.log('== 8. 结构完整 ==');
ok('script 开闭标签配对', count('<script>') === count('</script>'));
ok('</html> 收尾', has('</html>'));
ok('无 TODO/FIXME 残留', !has('TODO') && !has('FIXME'));
ok('无 console.log 调试残留', !has('console.log'));
ok('无 alert 打断', !has('alert('));
ok('confirm 仅用于 resetAll 危险操作确认', (html.match(/confirm\(/g) || []).length === 1 && has("confirm('确定要清空所有星星和闯关记录吗？')"));
ok('无 debugger 语句', !has('debugger'));

console.log('');
console.log('== 9. 蓝牙魔方（双平台桥接 + GAN 协议）==');
ok('BLE 桥接层存在', has('const BLE = (function'));
ok('桥接层含原生路径（Capacitor）', has('capacitorCommunityBluetoothLe') && has('startLEScan'));
ok('桥接层含网页路径（Web Bluetooth）', has('navigator.bluetooth.requestDevice'));
ok('业务代码不直接调用 Web Bluetooth（只经桥接层）', (html.match(/navigator\.bluetooth\.requestDevice/g) || []).length === 1);
ok('AES-128 实现存在', has('AES_SBOX') && has('aesExpandKey') && has('aesEncryptBlock') && has('aesDecryptBlock'));
ok('GAN 加密器（MAC 派生密钥）', has('ganMakeEncrypter') && has('% 255'));
ok('GAN 三代协议解析', has('ganGen2Parse') && has('ganGen3Parse') && has('ganGen4Parse'));
ok('MAC 广播提取', has('macFromManufacturerData'));
ok('连接后请求面块状态', has('REQUEST_FACELETS'));
ok('手动输入 MAC 兜底', has('ganAskMac') && has('gan_mac_map'));

console.log('== 10. iOS 原生工程（iPad 连魔方的唯一路径）==');
const iosDir = path.join(__dirname, '..', 'ios', 'App');
ok('iOS 工程存在', fs.existsSync(iosDir));
ok('Podfile 含 BLE 插件', fs.existsSync(path.join(iosDir, 'Podfile')) &&
   fs.readFileSync(path.join(iosDir, 'Podfile'), 'utf8').includes('CapacitorCommunityBluetoothLe'));
const plist = fs.readFileSync(path.join(iosDir, 'App', 'Info.plist'), 'utf8');
ok('Info.plist 含蓝牙权限说明', plist.includes('NSBluetoothAlwaysUsageDescription'));
ok('Info.plist 支持横竖屏', plist.includes('UIInterfaceOrientationPortrait') && plist.includes('UIInterfaceOrientationLandscapeLeft') && plist.includes('UIInterfaceOrientationLandscapeRight'));
ok('共享 scheme 存在', fs.existsSync(path.join(iosDir, 'App.xcodeproj', 'xcshareddata', 'xcschemes', 'App.xcscheme')));
ok('www 含 capacitor.js 运行时', fs.existsSync(path.join(iosDir, 'App', 'public', 'capacitor.js')));
ok('www 含 bluetooth-le.js 插件', fs.existsSync(path.join(iosDir, 'App', 'public', 'bluetooth-le.js')));
ok('www/index.html 注入运行时脚本', fs.readFileSync(path.join(iosDir, 'App', 'public', 'index.html'), 'utf8').includes('<script src="bluetooth-le.js"></script>'));
ok('package.json 依赖 BLE 插件', JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).dependencies['@capacitor-community/bluetooth-le']);

console.log('');
console.log('结果: ' + pass + ' 通过, ' + fails.length + ' 失败');
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1); }
console.log('✅ 静态验收全部通过');
