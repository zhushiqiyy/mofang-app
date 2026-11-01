/* 本地静态服务器：让 iPad / 手机在同一 WiFi 下访问本程序 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon',
  '.woff2':'font/woff2'
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^([\\/.])+/, ''));

  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('404'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
});

function startOn(port){
  server.listen(port, '0.0.0.0', () => {
    const ips = [];
    const nets = os.networkInterfaces();
    for (const k in nets){
      for (const n of nets[k]){
        if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
      }
    }
    console.log('');
    console.log('  🟦 魔方小将 已启动');
    console.log('  ─────────────────────────────');
    console.log('  电脑上打开:  http://localhost:' + port);
    ips.forEach(ip => console.log('  iPad 上打开: http://' + ip + ':' + port + '   ← 用这个'));
    console.log('  ─────────────────────────────');
    console.log('  iPad 要和电脑连同一个 WiFi。');
    console.log('  打开后点 Safari 的「分享 ⤴」→「添加到主屏幕」即可安装。');
    console.log('');
    console.log('  关闭窗口即停止服务。');
  });
}

let tryPort = PORT;
server.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE' && tryPort < PORT + 10){
    tryPort++;
    console.log('  端口 ' + (tryPort-1) + ' 被占用，尝试 ' + tryPort + ' ...');
    startOn(tryPort);
  } else {
    console.error('  启动失败:', e && e.message);
    process.exit(1);
  }
});
startOn(tryPort);
