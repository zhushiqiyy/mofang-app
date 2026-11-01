/* tools/shot.js — 用 CDP 精确模拟设备并截图（可执行交互脚本）
   用法: node tools/shot.js <url> <w> <h> <out.png> [js表达式]
*/
const fs = require('fs');
const http = require('http');

function getJSON(url){
  return new Promise((res, rej) => {
    http.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e){ rej(e); } });
    }).on('error', rej);
  });
}

async function main(){
  const [url, w, h, out, js] = process.argv.slice(2);
  const list = await getJSON('http://127.0.0.1:9222/json');
  const target = list.find(t => t.type === 'page');
  if (!target) throw new Error('no page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];

  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)){ pending.get(msg.id)(msg); pending.delete(msg.id); }
    else events.push(msg);
  };
  await new Promise(r => { ws.onopen = r; });

  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, m => m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: parseInt(w, 10),
    height: parseInt(h, 10),
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: parseInt(w, 10),
    screenHeight: parseInt(h, 10)
  });

  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 1600));

  if (js){
    const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) console.error('JS ERROR:', JSON.stringify(r.exceptionDetails.exception));
    else if (r.result && r.result.value !== undefined) console.log('JS:', JSON.stringify(r.result.value));
    await new Promise(r => setTimeout(r, 900));
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out);

  /* 顺带收集控制台错误 */
  const errs = events.filter(e => e.method === 'Runtime.exceptionThrown');
  if (errs.length) console.error('PAGE EXCEPTIONS:', errs.length);
  ws.close();
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
