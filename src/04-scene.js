/* ---------- 5. SCENE, CAMERAS, LIGHTS, RENDER LOOP, QUALITY, LABELS ---------- */
const canvas = $('#c'), viewEl = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const world = new THREE.Group(); scene.add(world);
const G = {}; ['floors', 'walls', 'ceilings', 'openings', 'kitchen', 'objects', 'helpers', 'lights'].forEach(k => { G[k] = new THREE.Group(); G[k].name = k; (k === 'helpers' || k === 'lights' ? scene : world).add(G[k]); });
const cam = new THREE.PerspectiveCamera(50, 1, 0.05, 200); cam.position.set(14, 16, 22);
const ocam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200); ocam.position.set(0, 60, 0); ocam.up.set(0, 0, -1); ocam.lookAt(0, 0, 0);
let activeCam = cam;
const controls = new OrbitControls(cam, canvas); controls.enableDamping = true; controls.dampingFactor = 0.12; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 1; controls.maxDistance = 80; controls.screenSpacePanning = false;
const controls2d = new OrbitControls(ocam, canvas); controls2d.enableRotate = false; controls2d.screenSpacePanning = true; controls2d.enabled = false; controls2d.zoomToCursor = true;
controls2d.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }; controls2d.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
const VIEW = { mode: '3d', prev: null, immRoom: null, yaw: 0, pitch: 0, keys: {}, transition: null };

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 0.9); scene.add(hemi);
const amb = new THREE.AmbientLight(0xffffff, 0.25); scene.add(amb);
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
let pmrem = null, envTex = null, composer = null, ssaoPass = null;
const QUAL = { level: 0, pr: Math.min(window.devicePixelRatio || 1, 2), frames: 0, t0: performance.now(), fps: 60, low: 0 };
let needsRender = true; const invalidate = () => { needsRender = true; };
controls.addEventListener('change', invalidate);
/* OrbitControls fires 'change' on every update() for orthographic cameras — only react when the 2D view really moved. */
let last2d = '';
controls2d.addEventListener('change', () => { const k = ocam.zoom.toFixed(5) + '|' + ocam.position.x.toFixed(4) + '|' + ocam.position.z.toFixed(4); if (k === last2d) return; last2d = k; invalidate(); peRedraw(); });

function applySkin() {
  const s = CFG.skin, night = CFG.night;
  renderer.shadowMap.enabled = s !== 'lowpoly' && CFG.shadows && QUAL.level < 3 && VIEW.mode !== '2d';   // the 2D plan is drawn shadow-free
  renderer.shadowMap.type = s === 'realistic' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = s === 'realistic' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.toneMappingExposure = night ? 0.9 : 1.05;
  if (s === 'realistic') { if (!envTex) { pmrem = new THREE.PMREMGenerator(renderer); envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; } scene.environment = envTex; } else scene.environment = null;
  sun.castShadow = renderer.shadowMap.enabled; const sz = QUAL.level >= 2 ? 1024 : 2048;
  if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  renderer.shadowMap.needsUpdate = true; setupComposer(); updateSun(); invalidate();
}
function setupComposer() {
  const want = CFG.skin === 'realistic' && CFG.ssao && QUAL.level < 2 && VIEW.mode !== '2d';
  if (!want) { composer = null; return; }
  try { const w = viewEl.clientWidth, h = viewEl.clientHeight; composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, activeCam));
    ssaoPass = new SSAOPass(scene, activeCam, w, h); ssaoPass.kernelRadius = 0.35; ssaoPass.minDistance = 0.001; ssaoPass.maxDistance = 0.08; composer.addPass(ssaoPass); composer.addPass(new OutputPass()); composer.setSize(w, h); }
  catch (e) { console.warn('SSAO unavailable', e); composer = null; CFG.ssao = false; }
}
/* Sun from time of day (6..19h). Plan north is -X, so east = -Z … the sun travels from -Z (morning) to +Z (evening) via the south (+X). */
function updateSun() {
  const b = planBounds(), t = clamp((CFG.sunTime - 6) / 13, 0, 1), ang = t * Math.PI, elev = Math.sin(ang) * 0.95 + 0.08, s = CFG.skin;
  const dir = new THREE.Vector3(Math.sin(ang) * 0.75 + 0.15, elev, -Math.cos(ang)).normalize();
  sun.target.position.set(b.cx, 0, b.cy); sun.position.copy(sun.target.position).addScaledVector(dir, 40);
  const r = Math.max(b.w, b.h) * 0.75 + 3, c = sun.shadow.camera; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 90; c.updateProjectionMatrix();
  const warm = new THREE.Color('#ffb070').lerp(new THREE.Color('#fff4e0'), clamp(Math.sin(ang) * 1.6, 0, 1));
  if (CFG.night) { sun.color.set('#8fa6d8'); sun.intensity = 0.18; hemi.intensity = 0.16; amb.intensity = 0.1; scene.background = new THREE.Color('#141a26'); }
  else { sun.color.copy(warm); sun.intensity = (s === 'lowpoly' ? 1.4 : s === 'standard' ? 2.0 : 2.6) * (0.35 + 0.65 * Math.sin(ang)); hemi.intensity = s === 'realistic' ? 0.55 : 0.95; amb.intensity = s === 'lowpoly' ? 0.45 : 0.22;
    scene.background = new THREE.Color('#cfe0f0').lerp(new THREE.Color('#f3c9a0'), 1 - clamp(Math.sin(ang) * 1.8, 0, 1)); }
  if (VIEW.mode === 'imm' || VIEW.mode === 'walk') amb.intensity += CFG.night ? 0.12 : 0.8;   // rooms are roofed in first-person views: lift the fill light
  renderer.shadowMap.needsUpdate = true; updateNightLights(); invalidate();
}
/* Interior lights: placed light fixtures become point lights at night (capped for performance). */
function updateNightLights() {
  G.lights.clear(); if (!CFG.night) return;
  const max = CFG.skin === 'lowpoly' ? 6 : 12; let n = 0;
  for (const o of D.objects) { const def = LIBMAP[o.type]; if (!def || !def.light || n >= max) continue; n++;
    const p = new THREE.PointLight(def.lightColor || '#ffe2b8', def.light, 9, 1.6); p.position.set(o.x, (o.y || 0) + (def.lightY != null ? def.lightY * o.h : o.h * 0.5), o.z); G.lights.add(p); }
  if (!n) { D.plan.rooms.filter(r => !r.outdoor).slice(0, max).forEach(r => { const c = polyCentroid(r.poly); const p = new THREE.PointLight('#ffe2b8', 6, 9, 1.6); p.position.set(c[0], D.plan.wallHeight - 0.3, c[1]); G.lights.add(p); }); }
}
function resize() {
  const w = Math.max(50, viewEl.clientWidth), h = Math.max(50, viewEl.clientHeight);
  renderer.setPixelRatio(QUAL.pr); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  const hh = 10, a = w / h; ocam.left = -hh * a; ocam.right = hh * a; ocam.top = hh; ocam.bottom = -hh; ocam.updateProjectionMatrix();
  composer?.setSize(w, h); invalidate();
}
new ResizeObserver(resize).observe(viewEl);

/* Tiny tween engine (camera transitions etc.) */
const TWEENS = new Set();
function tween(ms, step, done) { const tw = { t0: performance.now(), ms, step, done, cancel() { TWEENS.delete(tw); } }; TWEENS.add(tw); invalidate(); return tw; }
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* HTML labels projected from world space. LABELS.set('group', [{pos:[x,y,z], html, cls}]) */
const LABELS = { groups: {}, layer: $('#labels'),
  set(name, items) { this.clear(name); this.groups[name] = items.map(it => { const e = el('div', { class: 'lbl ' + (it.cls || ''), html: it.html }); this.layer.append(e); return { e, p: new THREE.Vector3(...it.pos) }; }); invalidate(); },
  clear(name) { (this.groups[name] || []).forEach(l => l.e.remove()); delete this.groups[name]; },
  update() { const w = viewEl.clientWidth, h = viewEl.clientHeight, v = new THREE.Vector3();
    for (const k in this.groups) for (const l of this.groups[k]) { v.copy(l.p).project(activeCam); const vis = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      l.e.style.display = vis ? '' : 'none'; if (vis) { l.e.style.left = ((v.x + 1) / 2 * w).toFixed(1) + 'px'; l.e.style.top = ((1 - v.y) / 2 * h).toFixed(1) + 'px'; } } }
};
const FRAME_HOOKS = [];           // functions called every rendered frame: (dt)
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  for (const tw of [...TWEENS]) { const t = clamp((now - tw.t0) / tw.ms, 0, 1); tw.step(ease(t), t); needsRender = true; if (t >= 1) { TWEENS.delete(tw); tw.done && tw.done(); } }
  if (VIEW.mode === '3d') controls.update(); else if (VIEW.mode === '2d') controls2d.update();
  for (const f of FRAME_HOOKS) f(dt);
  if (!needsRender) { QUAL.t0 = now; QUAL.frames = 0; return; }
  needsRender = false;
  if (composer) composer.render(); else renderer.render(scene, activeCam);
  LABELS.update();
  QUAL.frames++; if (now - QUAL.t0 > 1500) { QUAL.fps = QUAL.frames * 1000 / (now - QUAL.t0); QUAL.frames = 0; QUAL.t0 = now; $('#fps').textContent = Math.round(QUAL.fps) + ' fps' + (QUAL.level ? ' · quality −' + QUAL.level : ''); autoQuality(); }
}
/* Drop quality step by step when the frame rate stays low while rendering continuously. */
function autoQuality() {
  if (!CFG.autoQuality || QUAL.level >= 3) return;
  if (QUAL.fps < 28) QUAL.low++; else QUAL.low = 0;
  if (QUAL.low < 2) return; QUAL.low = 0; QUAL.level++;
  if (QUAL.level === 1) { QUAL.pr = 1; resize(); } applySkin();
  toast('Frame rate is low — reduced render quality (level ' + QUAL.level + ')');
}
function screenshot() {
  LABELS.update(); if (composer) composer.render(); else renderer.render(scene, activeCam);
  const url = canvas.toDataURL('image/png'); download('apartment-view.png', url); toast('Screenshot saved', 'ok');
}
