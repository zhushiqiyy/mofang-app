/* =========================================================================
   mascot3d.js — 魔方小将 · 真 3D 玩伴引擎（ES module，本地离线）
   -------------------------------------------------------------------------
   · 复用展厅验证过的 three.js + GLTFLoader
   · 4 个助手 GLB 按需加载、跨实例共享几何/贴图缓存
   · 自动旋转 + 拖拽 360° 查看；滚轮缩放关闭（避免误触）
   · WebGL 不可用 / 加载失败时，回调让上层降级到原 SVG 分层玩伴
   ========================================================================= */
import * as THREE from 'three';
import { OrbitControls } from './controls/OrbitControls.js';
import { GLTFLoader } from './loaders/GLTFLoader.js';

/* 角色 -> 模型文件。key 与 65-skins.js 的 SKINS.comp 一致 */
const MODEL = {
  conan:   { file: './models/conan.glb',   name: '柯南' },
  ange:    { file: './models/ange.glb',    name: '天女兽' },
  pika:    { file: './models/pika.glb',    name: '皮卡丘' },
  nailong: { file: './models/nailong.glb', name: '奶龙' }
};

const loader = new GLTFLoader();
const modelCache = new Map();   // roleId -> Promise<THREE.Object3D 原型>
const live = new WeakMap();     // host -> 生命周期对象

function getModel(roleId){
  if (modelCache.has(roleId)) return modelCache.get(roleId);
  const p = new Promise((resolve, reject) => {
    loader.load(
      MODEL[roleId].file,
      gltf => resolve(gltf.scene),
      ev => { /* 进度由各实例自行显示 */ },
      err => reject(err)
    );
  });
  modelCache.set(roleId, p);
  return p;
}

/* 统一归一化：高度缩放到 target，居中到原点 */
function normalizeObject(src, target){
  const g = new THREE.Group();
  const clone = src.clone(true);                    // 共享 geometry/material，省显存
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const s = target / (size.y || 1);
  clone.scale.setScalar(s);
  clone.position.copy(ctr).multiplyScalar(-s);
  g.add(clone);
  return g;
}

/* 在 host 上挂载一个 3D 玩伴。opts: {mini, noAuto, onFail} */
function mount(host, roleId, opts){
  opts = opts || {};
  if (!host || !MODEL[roleId]) { if (opts.onFail) opts.onFail(); return; }
  dispose(host);                                     // 先清掉旧的（避免多实例堆积）

  const mini = !!opts.mini;
  const W = host.clientWidth  || (mini ? 140 : 200);
  const H = host.clientHeight || (mini ? 150 : 210);

  const canvas = document.createElement('canvas');
  canvas.className = 'm3d-canvas';
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
  host.appendChild(canvas);

  const badge = document.createElement('div');
  badge.className = 'm3d-badge';
  badge.textContent = '加载 ' + MODEL[roleId].name + '…';
  host.appendChild(badge);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    badge.textContent = '此设备不支持 3D';
    if (opts.onFail) opts.onFail();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mini ? 40 : 38, W / H, 0.1, 1000);
  camera.position.set(0, 0.15, mini ? 4.6 : 4.2);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.target.set(0, 0.05, 0);
  controls.autoRotate = !opts.noAuto;
  controls.autoRotateSpeed = 1.5;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ec, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(4, 7, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9); fill.position.set(-5, 3, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xeaf0ff, 1.0); rim.position.set(0, 4, -6); scene.add(rim);

  const st = { renderer, scene, camera, controls, canvas, badge, raf: 0, disposed: false };
  live.set(host, st);

  let alive = true;
  getModel(roleId).then(src => {
    if (!alive || st.disposed) return;
    const model = normalizeObject(src, 2.2);
    scene.add(model);
    st.model = model;
    badge.style.display = 'none';
  }).catch(() => {
    if (!alive || st.disposed) return;
    badge.textContent = '3D 加载失败';
    if (opts.onFail) opts.onFail();
  });

  const loop = () => {
    if (st.disposed) return;
    st.raf = requestAnimationFrame(loop);
    if (!canvas.isConnected || canvas.offsetParent === null) return;  // 不可见则跳过渲染
    controls.update();
    renderer.render(scene, camera);
  };
  loop();
  return st;
}

/* 卸载 host 上的 3D 实例，释放 GPU 资源 */
function dispose(host){
  const st = live.get(host);
  if (!st) return;
  st.disposed = true;
  cancelAnimationFrame(st.raf);
  try { st.controls.dispose(); } catch (e) {}
  try { st.renderer.dispose(); } catch (e) {}
  live.delete(host);
}

/* 供上层判断某角色是否有 3D 模型 */
function has3D(roleId){ return !!MODEL[roleId]; }
function preload(roleId){ if (MODEL[roleId]) getModel(roleId).catch(() => {}); }

window.Mascot3D = { mount, dispose, has3D, preload, MODEL };
window.dispatchEvent(new Event('mascot3d-ready'));
