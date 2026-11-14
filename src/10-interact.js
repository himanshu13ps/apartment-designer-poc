/* ---------- 10. INTERACTION: picking, drag-move with snapping, rotate handle, measure, wall painting, drag & drop ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const TOOL = { name: 'select', a: null, b: null, paintColor: '#c2714f' };
let DRAG = null;
function setRay(ev) { const r = canvas.getBoundingClientRect(); ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, activeCam); }
function floorPoint(ev, y = 0) { setRay(ev); floorPlane.constant = -y; const p = new THREE.Vector3(); return ray.ray.intersectPlane(floorPlane, p) ? p : null; }
const isVisible = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function pick(ev, groups) { setRay(ev); return ray.intersectObjects(groups, true).filter(h => isVisible(h.object) && h.object.isMesh)[0] || null; }
function setTool(name) {
  TOOL.name = name; TOOL.a = TOOL.b = null; clearMeasure(); $('#btnMeasure').classList.toggle('on', name === 'measure'); canvas.style.cursor = name === 'select' ? '' : 'crosshair';
  setStatus(name === 'measure' ? 'Measure: click two points (Esc to finish)' : name === 'paint' ? 'Paint: click a wall face to apply the colour (Esc to finish)' : defaultStatus()); changedUI();
}
const defaultStatus = () => VIEW.mode === 'walk' ? 'Walk: WASD / arrows to move, drag to look, Esc to exit' : 'Drag to orbit · right-drag to pan · scroll to zoom · click an item to select · double-click a floor to frame the room';
/* --- snapping --- */
function aabbOf(poly) { const b = polyBounds(poly); return b; }
function snapToWall(o, maxDist) {
  let best = null; for (const c of COLLIDERS) { const r = distPtSeg(o.x, o.z, c.ax, c.ay, c.bx, c.by); if (r.d < maxDist && (!best || r.d < best.r.d)) best = { c, r }; }
  if (!best) return null; const { c, r } = best, l = Math.hypot(c.bx - c.ax, c.by - c.ay) || 1; let nx = -(c.by - c.ay) / l, ny = (c.bx - c.ax) / l; if ((o.x - r.cx) * nx + (o.z - r.cy) * ny < 0) { nx = -nx; ny = -ny; }
  const t = clamp(r.t * l, Math.min(o.w / 2, l / 2), Math.max(l - o.w / 2, l / 2)), off = c.r + o.d / 2 + 0.003;
  return { x: r3(c.ax + (c.bx - c.ax) / l * t + nx * off), z: r3(c.ay + (c.by - c.ay) / l * t + ny * off), rot: normAng(Math.atan2(nx, ny)) };
}
function snapPosition(o, x, z, skipIds) {
  if (!CFG.snap) return { x, z }; const def = defOf(o), probe = { ...o, x, z };
  if (def.mount === 'wall' && CFG.snapWalls) { const s = snapToWall(probe, 0.7); if (s) return s; }
  if (CFG.grid > 0) { x = Math.round(x / CFG.grid) * CFG.grid; z = Math.round(z / CFG.grid) * CFG.grid; }
  if (CFG.snapObjects && !def.flat) { probe.x = x; probe.z = z; const a = aabbOf(objPoly(probe)), [a0, a1] = yRange(o); let bx = 0.075, bz = 0.075, dx = 0, dz = 0;
    for (const b of D.objects) { if (skipIds.includes(b.id) || defOf(b).flat) continue; const [b0, b1] = yRange(b); if (a1 <= b0 || b1 <= a0) continue; const q = aabbOf(objPoly(b));
      if (a.y1 > q.y0 - 0.3 && q.y1 > a.y0 - 0.3) for (const v of [q.x0 - a.x1, q.x1 - a.x0, q.x0 - a.x0, q.x1 - a.x1]) if (Math.abs(v) < bx) { bx = Math.abs(v); dx = v; }
      if (a.x1 > q.x0 - 0.3 && q.x1 > a.x0 - 0.3) for (const v of [q.y0 - a.y1, q.y1 - a.y0, q.y0 - a.y0, q.y1 - a.y1]) if (Math.abs(v) < bz) { bz = Math.abs(v); dz = v; } }
    x += dx; z += dz; }
  if (CFG.snapWalls && !def.flat && def.mount !== 'ceiling') { const c0 = Math.cos(o.rot || 0), s0 = Math.sin(o.rot || 0);
    for (let pass = 0; pass < 2; pass++) for (const c of COLLIDERS) { const ex = c.bx - c.ax, ey = c.by - c.ay, l = Math.hypot(ex, ey) || 1, nx = -ey / l, ny = ex / l, ax = Math.abs(c0 * nx - s0 * ny), az = Math.abs(s0 * nx + c0 * ny);
      if (!(ax > 0.985 || ax < 0.17)) continue; const e = ax * o.w / 2 + az * o.d / 2, along = ((x - c.ax) * ex + (z - c.ay) * ey) / l, half = (1 - ax) * o.w / 2 + (1 - az) * o.d / 2; if (along < -half + 0.02 || along > l + half - 0.02) continue;
      const sd = (x - c.ax) * nx + (z - c.ay) * ny, gap = Math.abs(sd) - c.r - e; if (Math.abs(gap) < 0.16) { const k = (c.r + e + 0.002) * Math.sign(sd || 1) - sd; x += nx * k; z += ny * k; } } }
  return { x: r3(x), z: r3(z) };
}
/* --- measure tool visuals --- */
const measGroup = new THREE.Group(); G.helpers.add(measGroup);
function clearMeasure() { measGroup.traverse(o => o.geometry && !o.geometry.userData.shared && o.geometry.dispose()); measGroup.clear(); LABELS.clear('measure'); invalidate(); }
function drawMeasure(a, b) {
  clearMeasure(); const mat = new THREE.LineBasicMaterial({ color: 0x2f6fed, depthTest: false });
  for (const p of [a, b]) { if (!p) continue; const s = new THREE.Mesh(sphGeo(12), new THREE.MeshBasicMaterial({ color: 0x2f6fed, depthTest: false })); s.scale.setScalar(0.04); s.position.copy(p); s.renderOrder = 12; measGroup.add(s); }
  if (a && b) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat); l.renderOrder = 12; measGroup.add(l); const m = a.clone().lerp(b, 0.5); LABELS.set('measure', [{ pos: [m.x, m.y + 0.05, m.z], cls: 'meas', html: fmtLen(a.distanceTo(b)) + (CFG.units === 'm' ? '' : ' · ' + a.distanceTo(b).toFixed(2) + ' m') }]); }
  invalidate();
}
const PICKABLE = () => [G.objects, G.kitchen, G.walls, G.floors];
canvas.addEventListener('pointerdown', ev => {
  canvas.focus(); if (ev.button !== 0 || VIEW.mode === 'imm' || VIEW.mode === 'walk' || PE.on) return;
  DRAG = { type: 'none', sx: ev.clientX, sy: ev.clientY, moved: false };
  if (TOOL.name === 'measure' || TOOL.name === 'paint') { DRAG.type = 'tool'; return; }
  if (rotHandle) { setRay(ev); if (ray.intersectObject(rotHandle).length) { DRAG.type = 'rotate'; DRAG.id = SEL.ids[0]; controls.enabled = controls2d.enabled = false; canvas.setPointerCapture(ev.pointerId); return; } }
  const h = pick(ev, PICKABLE()), ud = h?.object.userData || {};
  if (ud.objId) { const id = ud.objId, o = objById(id); if (!o) return;
    if (ev.shiftKey) { selectObjects(SEL.ids.includes(id) ? SEL.ids.filter(i => i !== id) : [...SEL.ids, id]); DRAG.type = 'sel'; controls.enabled = controls2d.enabled = false; return; }
    if (!SEL.ids.includes(id)) selectObjects([id]);
    DRAG.type = 'move'; DRAG.id = id; DRAG.p0 = floorPoint(ev); DRAG.orig = new Map(SEL.ids.map(objById).filter(q => q && !q.locked).map(q => [q.id, { x: q.x, z: q.z }]));
    controls.enabled = controls2d.enabled = false; canvas.setPointerCapture(ev.pointerId);
  } else if (ud.unitRef) { selectUnit(ud.unitRef); DRAG.type = 'sel'; } else DRAG.clear = true;
}, { capture: true });
canvas.addEventListener('pointermove', ev => {
  if (TOOL.name === 'measure' && TOOL.a && !TOOL.b && !DRAG) { const h = pick(ev, PICKABLE()); if (h) drawMeasure(TOOL.a, h.point); return; }
  if (!DRAG) return; if (!DRAG.moved && Math.hypot(ev.clientX - DRAG.sx, ev.clientY - DRAG.sy) < 4) return;
  const first = !DRAG.moved; DRAG.moved = true;
  if (DRAG.type === 'move') { const o = objById(DRAG.id), p = floorPoint(ev); if (!o || !p || !DRAG.p0 || !DRAG.orig.size) return; if (o.locked) { if (first) toast('Item is locked'); return; } if (first) pushUndo();
    const og = DRAG.orig.get(o.id), ids = [...DRAG.orig.keys()], s = ev.altKey ? { x: og.x + p.x - DRAG.p0.x, z: og.z + p.z - DRAG.p0.z } : snapPosition(o, og.x + p.x - DRAG.p0.x, og.z + p.z - DRAG.p0.z, ids), dx = s.x - og.x, dz = s.z - og.z;
    if (s.rot != null && ids.length === 1) o.rot = s.rot;
    for (const [id, st] of DRAG.orig) { const q = objById(id); q.x = r3(st.x + dx); q.z = r3(st.z + dz); syncObject(q); } checkWarnings(); updateSelectionVisuals(); setStatus(`${o.name}: x ${fmtLen(o.x)}, y ${fmtLen(o.z)} — hold Alt to move without snapping`); }
  else if (DRAG.type === 'rotate') { const o = objById(DRAG.id), p = floorPoint(ev, objElev(o)); if (!o || !p) return; if (first) pushUndo(); let a = Math.atan2(p.x - o.x, p.z - o.z); if (!ev.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
    o.rot = normAng(a); syncObject(o); checkWarnings(); updateSelectionVisuals(); setStatus(`Rotation ${Math.round(THREE.MathUtils.radToDeg(o.rot))}° (Shift = free)`); }
});
function endDrag(ev) {
  const d = DRAG; DRAG = null; if (!d) return; setTimeout(() => { controls.enabled = VIEW.mode === '3d'; controls2d.enabled = VIEW.mode === '2d' && !PE.on; }, 0);
  if (d.type === 'tool' && !d.moved) { const h = pick(ev, TOOL.name === 'paint' ? [G.walls] : PICKABLE()); if (!h) return;
    if (TOOL.name === 'measure') { if (!TOOL.a || TOOL.b) { TOOL.a = h.point.clone(); TOOL.b = null; drawMeasure(TOOL.a, null); } else { TOOL.b = h.point.clone(); drawMeasure(TOOL.a, TOOL.b); setStatus('Distance: ' + fmtLen(TOOL.a.distanceTo(TOOL.b)) + ' — click to start a new measurement'); } }
    else { const f = h.object.userData.faces?.[h.face.materialIndex]; if (!f) return toast('Click a wall side (not its top or edge)'); pushUndo(); D.mats.wallFace[h.object.userData.wallId + '|' + f.side + '|' + (f.room || 'ext')] = TOOL.paintColor; changed({ plan: 1, ui: 1 }); }
    return; }
  if ((d.type === 'move' || d.type === 'rotate') && d.moved) { changed({ objects: 1, ui: 1 }); setStatus(defaultStatus()); }
  else if (d.clear && !d.moved && (SEL.ids.length || SEL.unit)) { const had = SEL.unit; SEL.unit = null; SEL.ids = []; updateSelectionVisuals(); if (had) buildKitchen(); changedUI(); }
}
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('dblclick', ev => { if (VIEW.mode !== '3d' && VIEW.mode !== '2d' || PE.on) return; const h = pick(ev, PICKABLE()); if (h?.object.userData.kind === 'floor') frameRoom(h.object.userData.roomId); else if (h?.object.userData.objId) frameSelection(); });
/* Drag & drop from the library */
viewEl.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('text/apt-item')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
viewEl.addEventListener('drop', ev => { const type = ev.dataTransfer.getData('text/apt-item'); if (!type) return; ev.preventDefault(); if (VIEW.mode === 'imm' || VIEW.mode === 'walk') return toast('Exit the immersive view to place items');
  const p = floorPoint(ev); if (!p) return; const probe = newObject(type, p.x, p.z), s = snapPosition(probe, p.x, p.z, []); const o = placeObject(type, s.x, s.z); if (o) toast(o.name + ' placed in ' + objRoomName(o), 'ok'); });
function placeAtTarget(type) { const t = controls.target, o = placeObject(type, r3(t.x), r3(t.z)); if (o) toast(o.name + ' placed — drag it into position', 'ok'); return o; }
/* --- keyboard --- */
const typing = ev => /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable;
window.addEventListener('keydown', ev => {
  if (typing(ev)) { if (ev.key === 'Escape') ev.target.blur(); return; }
  const k = ev.key.toLowerCase(), ctrl = ev.ctrlKey || ev.metaKey, walk = VIEW.mode === 'walk';
  if (walk || VIEW.mode === 'imm') { VIEW.keys[k] = true; if (k === 'escape') exitImmersive(); if (k.startsWith('arrow') || k === ' ') ev.preventDefault(); if (!ctrl && k !== '?') return; }
  if (ctrl && k === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); } else if (ctrl && k === 'y') { ev.preventDefault(); redo(); }
  else if (ctrl && k === 'd') { ev.preventDefault(); duplicateSelected(); } else if (ctrl && k === 'a') { ev.preventDefault(); selectObjects(D.objects.map(o => o.id)); }
  else if (ctrl && k === 's') { ev.preventDefault(); exportProject(); } else if (ctrl) return;
  else if (k === 'delete' || k === 'backspace') { ev.preventDefault(); if (PE.on) peDelete(); else deleteSelected(); }
  else if (k === 'q' || k === 'e') rotateSelected((k === 'q' ? 1 : -1) * THREE.MathUtils.degToRad(ev.shiftKey ? 1 : 15));
  else if (k === 'escape') { if ($('.modal.on')) $$('.modal.on').forEach(m => m.classList.remove('on')); else if (PE.on && PE.tool) peTool(null); else if (TOOL.name !== 'select') setTool('select'); else if (SEL.ids.length || SEL.unit) { SEL.unit = null; selectObjects([]); buildKitchen(); } }
  else if (k === 'm') setTool(TOOL.name === 'measure' ? 'select' : 'measure'); else if (k === 's') toggleSnap(); else if (k === 'u') toggleUnits();
  else if (k === 'l') { if (SEL.ids.length) { const lock = !objById(SEL.ids[0])?.locked; setObjProp(SEL.ids, { locked: lock }); toast(lock ? 'Locked' : 'Unlocked'); } }
  else if (k === '?' || (k === '/' && ev.shiftKey)) $('#helpModal').classList.toggle('on'); else if (k === 'tab') { ev.preventDefault(); togglePanel(); }
  else if (k === '1' || k === '2' || k === '3') setSkin(['lowpoly', 'standard', 'realistic'][+k - 1]); else if (k === 'f') frameSelection(); else if (k === 'g') setViewMode(VIEW.mode === '2d' ? '3d' : '2d');
  else if (k.startsWith('arrow') && SEL.ids.length) { ev.preventDefault(); const st = (CFG.grid || 0.05) * (ev.shiftKey ? 10 : 1), dx = k === 'arrowleft' ? -st : k === 'arrowright' ? st : 0, dz = k === 'arrowup' ? -st : k === 'arrowdown' ? st : 0;
    setObjProp(SEL.ids.filter(id => !objById(id)?.locked), o => ({ x: r3(o.x + dx), z: r3(o.z + dz) })); }
});
window.addEventListener('keyup', ev => { VIEW.keys[ev.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { VIEW.keys = {}; });
function toggleSnap() { CFG.snap = !CFG.snap; $('#btnSnap').classList.toggle('on', CFG.snap); toast('Snapping ' + (CFG.snap ? 'on' : 'off')); changedUI(); }
function toggleUnits() { CFG.units = CFG.units === 'ft' ? 'm' : 'ft'; $('#btnUnits').textContent = CFG.units === 'ft' ? 'ft-in' : 'metric'; updateRoomLabels(); updateSelectionVisuals(); if (TOOL.a && TOOL.b) drawMeasure(TOOL.a, TOOL.b); changed({ ui: 1 }); }
function togglePanel() { $('#panel').classList.toggle('collapsed'); setTimeout(resize, 220); }
function setSkin(s) { if (CFG.skin === s) return; CFG.skin = s; $('#selSkin').value = s; clearMaterials(); applySkin(); changed({ all: 1 }); toast('Skin: ' + { lowpoly: 'Low poly', standard: 'Standard', realistic: 'Realistic' }[s]); }
