/* ============================================================================
   gan-cube-plugin — 极简 GAN 魔方蓝牙插件 JS 入口
   依赖 window.Capacitor（capacitor.js 提供），原生 App 里自动注册。
   暴露 window.GanCubePlugin，方法：
     initialize()            -> { state }
     getState()              -> { state }
     scan() / stopScan()     -> 扫描（结果走 onScan 事件）
     connect({id})           -> 连接（成功后 resolve）
     disconnect({id})
     discover({id})          -> { services:[{uuid, characteristics:[{uuid, properties}]}] }
     subscribe({id, service, characteristic})
     write({id, service, characteristic, data: "AA BB ..."})
   事件（addListener）：
     onScan       { deviceId, name, rssi, mac, manufacturerData }
     onNotify     { deviceId, service, characteristic, data }
     onConnect / onDisconnect / onState / onError
   ============================================================================ */
(function () {
  var C = (typeof window !== 'undefined') ? window.Capacitor : null;
  if (!C || !C.registerPlugin) {
    console.warn('[gan-cube-plugin] Capacitor runtime 未加载');
    return;
  }
  var GanCube = C.registerPlugin('GanCube');
  if (typeof window !== 'undefined') {
    window.GanCubePlugin = GanCube;
  }
})();
