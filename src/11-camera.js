/* ---------- 11. CAMERAS: animated framing, 2D plan view, immersive room view, walk mode, bookmarks ---------- */
const EYE = 1.6;
function stopTransition() { if (VIEW.transition) { VIEW.transition.cancel(); VIEW.transition = null; } }
function flyTo(pos, target, ms = 700, done) {
  stopTransition(); const p0 = cam.position.clone(), t0 = controls.target.clone(), p1 = new THREE.Vector3(...pos), t1 = new THREE.Vector3(...target);
  VIEW.transition = tween(ms, t => { cam.position.lerpVectors(p0, p1, t); controls.target.lerpVectors(t0, t1, t); cam.lookAt(controls.target); }, () => { VIEW.transition = null; done && done(); });
}
function resetView(ms = 800) { const b = planBounds(), R = Math.max(b.w, b.h); if (VIEW.mode === '2d') return fit2d(b, ms); if (VIEW.mode !== '3d') return; flyTo([b.cx + R * 0.3, R * 1.0, b.cy + R * 0.85], [b.cx, 0, b.cy], ms); }
function fit2d(b, ms = 600) {
  const a = viewEl.clientWidth / viewEl.clientHeight, z1 = Math.min(20 * a / (b.w + 2.5), 20 / (b.h + 2.5)), z0 = ocam.zoom, c0 = controls2d.target.clone(), c1 = new THREE.Vector3(b.cx, 0, b.cy); stopTransition();
  VIEW.transition = tween(ms, t => { ocam.zoom = lerp(z0, z1, t); controls2d.target.lerpVectors(c0, c1, t); ocam.position.set(controls2d.target.x, 60, controls2d.target.z); ocam.updateProjectionMatrix(); peRedraw(); }, () => { VIEW.transition = null; });
}
function frameRoom(id) {
  const r = roomById(id); if (!r) return; const q = roomDims(r).b;
  if (VIEW.mode === '2d') return fit2d(q);
  if (VIEW.mode !== '3d') return enterImmersive(id);
  const dir = cam.position.clone().sub(controls.target); dir.y = 0; if (dir.lengthSq() < 0.01) dir.set(0.5, 0, 1); dir.normalize(); const dist = Math.max(q.w, q.h) * 0.9 + 3.2;
  flyTo([q.cx + dir.x * dist * 0.62, dist * 0.95, q.cy + dir.z * dist * 0.62], [q.cx, 0.6, q.cy]);
}
function frameSelection() {
  const os = SEL.ids.map(objById).filter(Boolean); if (!os.length) return resetView(); if (VIEW.mode !== '3d') return;
  const b = polyBounds(os.flatMap(o => objPoly(o))), dir = cam.position.clone().sub(controls.target).normalize(), dist = Math.max(b.w, b.h) * 1.6 + 2.6; if (dir.y < 0.35) { dir.y = 0.5; dir.normalize(); }
  flyTo([b.cx + dir.x * dist, Math.max(1.2, dir.y * dist), b.cy + dir.z * dist], [b.cx, 0.5, b.cy]);
}
function setViewMode(m) {
  if (m === VIEW.mode) return; if (m === 'walk') return enterWalk();
  if (VIEW.mode === 'imm' || VIEW.mode === 'walk' || VIEW.mode === 'trans') { exitImmersive(m === '2d' ? () => setViewMode('2d') : null); if (m === '2d') return; return; }
  stopTransition(); if (m !== '2d' && PE.on) togglePlanEdit(false);
  VIEW.mode = m; activeCam = m === '2d' ? ocam : cam; controls.enabled = m === '3d'; controls2d.enabled = m === '2d';
  if (m === '2d') { ocam.position.set(controls2d.target.x, 60, controls2d.target.z); fit2d(planBounds(), 1); }
  syncViewUI(); applySkin(); updateWallVisibility(true); updateRoomLabels(); updateSelectionVisuals(); setStatus(m === '2d' ? '2D plan: drag to pan, scroll to zoom. Items can be selected and dragged here too.' : defaultStatus()); invalidate();
}
function syncViewUI() { const m = VIEW.mode === 'imm' || VIEW.mode === 'trans' ? '3d' : VIEW.mode; $$('#segView button').forEach(b => b.classList.toggle('on', b.dataset.v === m)); $('#immBar').classList.toggle('on', VIEW.mode === 'imm' || VIEW.mode === 'walk');
  $('#immHint').textContent = VIEW.mode === 'walk' ? 'Walk: W A S D / arrows · drag to look · Shift = faster' : 'Drag to look around 360° · scroll to zoom'; $('#btnExitImm').textContent = VIEW.mode === 'walk' ? '✕ Exit walk mode (Esc)' : '✕ Exit immersive view (Esc)'; }
const applyLook = () => { cam.rotation.set(VIEW.pitch, VIEW.yaw, 0, 'YXZ'); invalidate(); };
function insidePoint(r) { let c = polyCentroid(r.poly); if (!pointInPoly(c[0], c[1], r.poly)) { const b = polyBounds(r.poly); c = [b.cx, b.cy]; if (!pointInPoly(c[0], c[1], r.poly)) c = [(r.poly[0][0] + r.poly[1][0] + r.poly[2][0]) / 3, (r.poly[0][1] + r.poly[1][1] + r.poly[2][1]) / 3]; } return c; }
/* Enter a first-person view at (x,z). mode = 'imm' (rooted, look only) or 'walk'. Safe to call mid-transition. */
function enterFirstPerson(x, z, mode, label) {
  stopTransition(); if (VIEW.mode === '2d') { if (PE.on) togglePlanEdit(false); activeCam = cam; controls2d.enabled = false; }
  if (VIEW.mode === '3d' || VIEW.mode === '2d' || !VIEW.prev) VIEW.prev = { pos: cam.position.toArray(), target: controls.target.toArray() };
  controls.enabled = false; VIEW.mode = mode; setTool('select'); syncViewUI(); setupComposer(); updateSun(); updateRoomLabels(); updateSelectionVisuals(); updateWallVisibility(true);
  const p0 = cam.position.clone(), q0 = cam.quaternion.clone(), f0 = cam.fov, p1 = new THREE.Vector3(x, EYE, z), d = new THREE.Vector3(); cam.getWorldDirection(d);
  VIEW.yaw = Math.abs(d.x) + Math.abs(d.z) < 0.05 ? 0 : Math.atan2(-d.x, -d.z); VIEW.pitch = 0; const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, VIEW.yaw, 0, 'YXZ'));
  VIEW.transition = tween(900, t => { cam.position.lerpVectors(p0, p1, t); cam.quaternion.slerpQuaternions(q0, q1, t); cam.fov = lerp(f0, 70, t); cam.updateProjectionMatrix(); }, () => { VIEW.transition = null; applyLook(); });
  setStatus(label);
}
function enterImmersive(roomId) { const r = roomById(roomId); if (!r) return; const c = insidePoint(r); VIEW.immRoom = roomId; enterFirstPerson(c[0], c[1], 'imm', 'Immersive view — ' + r.name); }
function enterWalk() { let x = controls.target.x, z = controls.target.z; if (VIEW.mode === 'imm' || VIEW.mode === 'walk') { x = cam.position.x; z = cam.position.z; } if (!roomAt(x, z)) { const r = D.plan.rooms[0]; if (!r) return; [x, z] = insidePoint(r); } enterFirstPerson(x, z, 'walk', defaultStatus()); setStatus('Walk: WASD / arrows to move, drag to look, Esc to exit'); }
function exitImmersive(after) {
  if (VIEW.mode !== 'imm' && VIEW.mode !== 'walk' && VIEW.mode !== 'trans') return; stopTransition();
  const b = planBounds(), prev = VIEW.prev || { pos: [b.cx + 8, 14, b.cy + 12], target: [b.cx, 0, b.cy] }, p0 = cam.position.clone(), q0 = cam.quaternion.clone(), f0 = cam.fov, p1 = new THREE.Vector3(...prev.pos), tg = new THREE.Vector3(...prev.target);
  const q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p1, tg, cam.up));
  VIEW.mode = 'trans'; VIEW.keys = {}; syncViewUI(); updateSun(); updateWallVisibility(true);
  VIEW.transition = tween(800, t => { cam.position.lerpVectors(p0, p1, t); cam.quaternion.slerpQuaternions(q0, q1, t); cam.fov = lerp(f0, 50, t); cam.updateProjectionMatrix(); }, () => {
    VIEW.transition = null; VIEW.mode = '3d'; VIEW.prev = null; controls.target.copy(tg); cam.position.copy(p1); cam.lookAt(tg); controls.enabled = true; controls.update(); syncViewUI(); setupComposer(); updateWallVisibility(true); updateRoomLabels(); updateSelectionVisuals(); setStatus(defaultStatus()); after && after(); });
}
/* Look-around (immersive + walk): mouse / touch drag, wheel = field-of-view zoom */
let LOOK = null;
canvas.addEventListener('pointerdown', ev => { if (VIEW.mode !== 'imm' && VIEW.mode !== 'walk') return; LOOK = { x: ev.clientX, y: ev.clientY }; capturePointer(canvas, ev); });
canvas.addEventListener('pointermove', ev => { if (!LOOK || VIEW.transition) return; const k = 0.0045 * cam.fov / 70; VIEW.yaw += (ev.clientX - LOOK.x) * k; VIEW.pitch = clamp(VIEW.pitch + (ev.clientY - LOOK.y) * k, -1.45, 1.45); LOOK.x = ev.clientX; LOOK.y = ev.clientY; applyLook(); });
canvas.addEventListener('pointerup', () => { LOOK = null; }); canvas.addEventListener('pointercancel', () => { LOOK = null; });
canvas.addEventListener('wheel', ev => { if (VIEW.mode !== 'imm' && VIEW.mode !== 'walk') return; ev.preventDefault(); cam.fov = clamp(cam.fov + Math.sign(ev.deltaY) * 3, 25, 95); cam.updateProjectionMatrix(); invalidate(); }, { passive: false });
/* Walk: keyboard movement with wall collision (doors are passable) */
FRAME_HOOKS.push(dt => {
  if (VIEW.mode !== 'walk' || VIEW.transition) return; const K = VIEW.keys; let f = 0, s = 0, turn = 0;
  if (K.w || K.arrowup) f += 1; if (K.s || K.arrowdown) f -= 1; if (K.a) s -= 1; if (K.d) s += 1; if (K.arrowleft) turn += 1; if (K.arrowright) turn -= 1;
  if (turn) { VIEW.yaw += turn * dt * 1.8; applyLook(); } if (!f && !s) return;
  const sp = (K.shift ? 3.2 : 1.7) * dt / Math.hypot(f, s), sy = Math.sin(VIEW.yaw), cy = Math.cos(VIEW.yaw); let x = cam.position.x + (-sy * f + cy * s) * sp, z = cam.position.z + (-cy * f - sy * s) * sp;
  for (let it = 0; it < 3; it++) for (const c of COLLIDERS) { const r = distPtSeg(x, z, c.ax, c.ay, c.bx, c.by), min = c.r + 0.22; if (r.d < min && r.d > 1e-5) { x += (x - r.cx) / r.d * (min - r.d); z += (z - r.cy) / r.d * (min - r.d); } }
  cam.position.set(x, EYE, z); const rm = roomAt(x, z); setStatus('Walk — ' + (rm ? rm.name : 'outside') + ' · WASD / arrows, drag to look, Esc to exit'); invalidate();
});
/* Camera bookmarks */
function cameraState() { return { mode: VIEW.mode === '2d' ? '2d' : '3d', pos: (VIEW.prev && VIEW.mode !== '3d' && VIEW.mode !== '2d' ? VIEW.prev.pos : cam.position.toArray()).map(r3), target: (VIEW.prev && VIEW.mode !== '3d' && VIEW.mode !== '2d' ? VIEW.prev.target : controls.target.toArray()).map(r3) }; }
function saveBookmark(name) { const live = VIEW.mode === 'imm' || VIEW.mode === 'walk' ? { pos: cam.position.toArray().map(r3), yaw: r3(VIEW.yaw), pitch: r3(VIEW.pitch), fp: true } : { pos: cam.position.toArray().map(r3), target: controls.target.toArray().map(r3) };
  EXTRA.bookmarks.push({ id: uid('bm'), name: name || 'View ' + (EXTRA.bookmarks.length + 1), ...live }); changed({ ui: 1 }); toast('Viewpoint saved', 'ok'); }
function gotoBookmark(id) {
  const b = EXTRA.bookmarks.find(q => q.id === id); if (!b) return;
  if (b.fp) { enterFirstPerson(b.pos[0], b.pos[2], 'walk', 'Bookmark — ' + b.name); const tr = VIEW.transition, done = tr.done; tr.done = () => { done(); VIEW.yaw = b.yaw; VIEW.pitch = b.pitch; applyLook(); }; return; }
  const go = () => { if (VIEW.mode === '2d') setViewMode('3d'); flyTo(b.pos, b.target); };
  if (VIEW.mode === 'imm' || VIEW.mode === 'walk' || VIEW.mode === 'trans') { VIEW.prev = { pos: b.pos, target: b.target }; exitImmersive(); } else go();
}
function deleteBookmark(id) { EXTRA.bookmarks = EXTRA.bookmarks.filter(b => b.id !== id); changed({ ui: 1 }); }
$('#btnExitImm').addEventListener('click', () => exitImmersive());
$$('#segView button').forEach(b => b.addEventListener('click', () => setViewMode(b.dataset.v)));
