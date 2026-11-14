/* ---------- 6. PLAN GEOMETRY BUILDER (floors, walls with openings, doors/windows, ceilings) ---------- */
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const WALLINFO = [];     // runtime: { wall, group, full, low, mid:[x,y], n:[nx,ny] }
const COLLIDERS = [];    // solid wall stretches for walk collision: { ax, ay, bx, by, r }
const SWINGS = [];       // door swing zones for the clearance check: { id, name, poly }
const LOW_H = 1.0;
function disposeGroup(g) { g.traverse(o => { if (o.geometry && o.geometry !== UNIT_BOX && !o.geometry.userData.shared) o.geometry.dispose(); }); g.clear(); }
function boxMesh(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(UNIT_BOX, mat); m.scale.set(Math.max(w, 1e-4), Math.max(h, 1e-4), Math.max(d, 1e-4)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; return m; }
function shapeOf(poly, flipY) { const s = new THREE.Shape(); poly.forEach((p, i) => i ? s.lineTo(p[0], flipY ? -p[1] : p[1]) : s.moveTo(p[0], flipY ? -p[1] : p[1])); s.closePath(); return s; }
function wallFaceColor(w, side, room) {
  const k = w.id + '|' + side + '|' + (room ? room.id : 'ext'), m = D.mats;
  return m.wallFace[k] || (room ? (m.roomWall[room.id] || (room.outdoor ? m.exterior : m.wallDefault)) : m.exterior);
}
function wallGeom(w) { const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy) || 1e-6, u = [dx / L, dy / L]; return { L, u, n: [-u[1], u[0]] }; }
/* How far a wall end should extend into the wall it meets (fills corner notches). */
function endExtension(w, pt) {
  let ext = 0; for (const o of D.plan.walls) { if (o === w) continue; const r = distPtSeg(pt[0], pt[1], o.a[0], o.a[1], o.b[0], o.b[1]); if (r.d < 0.03) ext = Math.max(ext, o.t / 2 - 0.002); } return ext;
}
function buildWallPieces(w, H, target, cutMat) {
  const { L, u, n } = wallGeom(w), t = w.t, extA = endExtension(w, w.a), extB = endExtension(w, w.b);
  const ops = D.plan.openings.filter(o => o.wall === w.id).map(o => ({ o, s0: clamp(o.at - o.w / 2, 0.02, L - 0.02), s1: clamp(o.at + o.w / 2, 0.02, L - 0.02) })).filter(q => q.s1 - q.s0 > 0.05);
  const cuts = new Set([-extA, L + extB]); ops.forEach(q => { cuts.add(q.s0); cuts.add(q.s1); });
  for (const o of D.plan.walls) { if (o === w) continue; for (const p of [o.a, o.b]) { const r = distPtSeg(p[0], p[1], w.a[0], w.a[1], w.b[0], w.b[1]); if (r.d < 0.03 && r.t > 0.01 && r.t < 0.99) { cuts.add(r.t * L - o.t / 2); cuts.add(r.t * L + o.t / 2); } } }
  const cs = [...cuts].filter(s => s >= -extA - 1e-6 && s <= L + extB + 1e-6).sort((a, b) => a - b);
  for (let i = 0; i < cs.length - 1; i++) {
    const s0 = cs[i], s1 = cs[i + 1], len = s1 - s0; if (len < 0.004) continue; const sm = clamp((s0 + s1) / 2, 0.01, L - 0.01);
    const px = w.a[0] + u[0] * sm, py = w.a[1] + u[1] * sm, off = t / 2 + 0.12;
    const rP = roomAt(px + n[0] * off, py + n[1] * off), rN = roomAt(px - n[0] * off, py - n[1] * off);
    const mP = M('paint', wallFaceColor(w, 1, rP)), mN = M('paint', wallFaceColor(w, -1, rN)), mats = [cutMat, cutMat, cutMat, cutMat, mP, mN];
    const op = ops.find(q => sm > q.s0 && sm < q.s1), spans = [];
    if (!op) spans.push([0, H]); else { if (op.o.sill > 0.02) spans.push([0, Math.min(op.o.sill, H)]); if (op.o.sill + op.o.h < H - 0.02) spans.push([op.o.sill + op.o.h, H]); }
    for (const [y0, y1] of spans) { if (y1 - y0 < 0.005) continue; const m = boxMesh(len, y1 - y0, t, mats, (s0 + s1) / 2, y0, 0);
      m.userData = { kind: 'wall', wallId: w.id, faces: { 4: { side: 1, room: rP?.id || null }, 5: { side: -1, room: rN?.id || null } } }; target.add(m); }
  }
  return { L, u, n, ops };
}
function buildOpening(o, w, L, target) {
  const t = w.t, fw = 0.05, dep = t + 0.03, x0 = clamp(o.at - o.w / 2, 0.02, L - 0.02), x1 = clamp(o.at + o.w / 2, 0.02, L - 0.02), W = x1 - x0, cx = (x0 + x1) / 2, g = new THREE.Group();
  g.userData = { kind: 'opening', id: o.id }; const tag = m => { m.userData = { kind: 'opening', id: o.id }; g.add(m); return m; };
  const glassy = o.type === 'window' || o.glass, fm = M(glassy ? 'metal' : 'wood', glassy ? D.mats.frame : D.mats.door), frameM = M('paint', D.mats.frame), H = Math.min(o.h, (w.h || D.plan.wallHeight) - o.sill);
  tag(boxMesh(fw, H, dep, frameM, x0 + fw / 2, o.sill, 0)); tag(boxMesh(fw, H, dep, frameM, x1 - fw / 2, o.sill, 0)); tag(boxMesh(W, fw, dep, frameM, cx, o.sill + H - fw, 0));
  if (o.type === 'window') {
    tag(boxMesh(W, fw, dep + 0.04, frameM, cx, o.sill, 0)); if (W > 0.9) tag(boxMesh(0.035, H - 2 * fw, 0.04, frameM, cx, o.sill + fw, 0));
    const gl = tag(boxMesh(W - 2 * fw, H - 2 * fw, 0.012, M('glass', '#bfe3f2'), cx, o.sill + fw, 0)); gl.castShadow = false;
  } else if (o.style === 'sliding') {
    const pw = (W - 2 * fw) / 2 + 0.03, ph = H - fw;
    for (const k of [0, 1]) { const zz = (k ? 0.025 : -0.025), px = x0 + fw + pw / 2 + (k ? pw * 0.18 : 0);
      if (o.glass) { for (const sx of [-1, 1]) tag(boxMesh(0.04, ph, 0.03, fm, px + sx * (pw / 2 - 0.02), 0, zz)); tag(boxMesh(pw, 0.05, 0.03, fm, px, 0, zz)); tag(boxMesh(pw, 0.05, 0.03, fm, px, ph - 0.05, zz));
        const gl = tag(boxMesh(pw - 0.08, ph - 0.1, 0.01, M('glass', '#bfe3f2'), px, 0.05, zz)); gl.castShadow = false; }
      else tag(boxMesh(pw, ph, 0.035, M('wood', D.mats.door), px, 0, zz)); }
  } else if (o.style !== 'open') {
    const lw = W - 2 * fw, piv = new THREE.Group(), hingeStart = o.hinge !== 'end', side = o.opensTo >= 0 ? 1 : -1;
    piv.position.set(hingeStart ? x0 + fw : x1 - fw, 0, side * (t / 2 - 0.02)); const leaf = boxMesh(lw, H - fw, 0.04, M('wood', D.mats.door), (hingeStart ? 1 : -1) * lw / 2, 0, 0); leaf.userData = { kind: 'opening', id: o.id };
    const knob = boxMesh(0.03, 0.12, 0.09, M('chrome', D.mats.handle), (hingeStart ? 1 : -1) * (lw - 0.08), 0.95, 0); piv.add(leaf, knob);
    piv.rotation.y = (hingeStart ? -1 : 1) * side * THREE.MathUtils.degToRad(82); piv.userData = { kind: 'opening', id: o.id }; g.add(piv);
  }
  target.add(g);
}
function buildPlan() {
  const P = D.plan, H = P.wallHeight;
  ['floors', 'walls', 'ceilings'].forEach(k => disposeGroup(G[k])); WALLINFO.length = COLLIDERS.length = SWINGS.length = 0;
  const sillMat = M('paint', '#b9b4aa');   // thin strip under every wall = door thresholds
  for (const r of P.rooms) {
    if (r.poly.length < 3) continue;
    const geo = new THREE.ShapeGeometry(shapeOf(r.poly, true)); geo.rotateX(-Math.PI / 2); const f = new THREE.Mesh(geo, floorMaterial(floorSpec(r))); f.receiveShadow = true; f.position.y = 0.001; f.userData = { kind: 'floor', roomId: r.id }; G.floors.add(f);
    if (!r.outdoor) { const cg = new THREE.ShapeGeometry(shapeOf(r.poly, false)); cg.rotateX(Math.PI / 2); const c = new THREE.Mesh(cg, M('paint', D.mats.ceiling)); c.position.y = H; c.castShadow = true; c.userData = { kind: 'ceiling', roomId: r.id }; G.ceilings.add(c); }
  }
  const cutMat = M('paint', '#7d828c');
  for (const w of P.walls) {
    const wh = Math.min(w.h || H, H), group = new THREE.Group(), full = new THREE.Group(), low = new THREE.Group(); group.add(full, low);
    const info = buildWallPieces(w, wh, full, cutMat); buildWallPieces(w, Math.min(wh, LOW_H), low, cutMat);
    info.ops.forEach(q => buildOpening(q.o, w, info.L, full));
    group.position.set(w.a[0], 0, w.a[1]); group.rotation.y = -Math.atan2(info.u[1], info.u[0]); low.visible = false; G.walls.add(group);
    const th = boxMesh(info.L + w.t, 0.1, w.t, sillMat, info.L / 2, -0.1, 0); th.castShadow = false; th.userData = { kind: 'slab' }; group.add(th);
    WALLINFO.push({ wall: w, group, full, low, n: info.n, mid: [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2], short: wh <= LOW_H + 0.3 });
    // colliders: wall stretches that are not door openings
    const doors = info.ops.filter(q => q.o.type === 'door').sort((a, c) => a.s0 - c.s0); let s = 0;
    const seg = (s0, s1) => { if (s1 - s0 > 0.02) COLLIDERS.push({ ax: w.a[0] + info.u[0] * s0, ay: w.a[1] + info.u[1] * s0, bx: w.a[0] + info.u[0] * s1, by: w.a[1] + info.u[1] * s1, r: w.t / 2 }); };
    doors.forEach(q => { seg(s, q.s0); s = q.s1; }); seg(s, info.L);
    for (const q of doors) { if (q.o.style !== 'hinged') continue; const sd = q.o.opensTo >= 0 ? 1 : -1, d0 = w.t / 2, d1 = w.t / 2 + (q.s1 - q.s0), pt = (ss, dd) => [w.a[0] + info.u[0] * ss + info.n[0] * dd * sd, w.a[1] + info.u[1] * ss + info.n[1] * dd * sd];
      SWINGS.push({ id: q.o.id, name: q.o.name || 'door', poly: [pt(q.s0, d0), pt(q.s1, d0), pt(q.s1, d1), pt(q.s0, d1)] }); }
  }
  updateWallVisibility(true); updateRoomLabels(); updateSun();
}
/* Dollhouse cutaway: lower every wall that stands between the camera and what it is looking at. */
let lastWallKey = '';
function updateWallVisibility(force) {
  const mode = VIEW.mode, wm = CFG.wallMode, cp = activeCam.position, tg = controls.target;
  const key = mode + wm + CFG.ceiling + cp.x.toFixed(1) + cp.y.toFixed(1) + cp.z.toFixed(1) + tg.x.toFixed(1) + tg.z.toFixed(1); if (!force && key === lastWallKey) return; lastWallKey = key;
  const inside = mode === 'imm' || mode === 'walk';
  for (const wi of WALLINFO) {
    let low = false;
    if (inside) low = false; else if (mode === '2d' || wm === 'low') low = true; else if (wm === 'auto') {
      const mx = wi.mid[0], my = wi.mid[1]; let nx = wi.n[0], ny = wi.n[1]; if (nx * (mx - tg.x) + ny * (my - tg.z) < 0) { nx = -nx; ny = -ny; }
      const cx = cp.x - mx, cy = cp.z - my, cl = Math.hypot(cx, cy) || 1; low = (nx * cx + ny * cy) / cl > 0.18; }
    if (wi.short) low = false;
    wi.full.visible = !low; wi.low.visible = low;
  }
  const H = D.plan.wallHeight; G.ceilings.visible = inside || (CFG.ceiling === 'show' && mode !== '2d') || (CFG.ceiling === 'auto' && mode === '3d' && cp.y < H - 0.05);
  renderer.shadowMap.needsUpdate = true; invalidate();
}
FRAME_HOOKS.push(() => updateWallVisibility(false));
function roomDims(r) { const b = polyBounds(r.poly); return { b, area: polyArea(r.poly), c: polyCentroid(r.poly) }; }
function updateRoomLabels() {
  const two = VIEW.mode === '2d', show = two || (CFG.roomLabels && VIEW.mode === '3d'); if (!show || PE.on) return LABELS.clear('rooms');
  LABELS.set('rooms', D.plan.rooms.map(r => { const q = roomDims(r); return { pos: [q.b.cx, two ? 0.2 : 0.05, q.b.cy], cls: 'room', html: r.name + (two ? `<small>${fmtLen(q.b.w)} × ${fmtLen(q.b.h)} · ${fmtArea(q.area)}</small>` : '') }; }));
}
/* Room hover highlight */
let hoverMesh = null;
function highlightRoom(id) {
  if (hoverMesh) { G.helpers.remove(hoverMesh); hoverMesh.geometry.dispose(); hoverMesh = null; } SEL.hoverRoom = id; const r = id && roomById(id);
  if (r) { const g = new THREE.ShapeGeometry(shapeOf(r.poly, true)); g.rotateX(-Math.PI / 2); hoverMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2f6fed, transparent: true, opacity: 0.28, depthWrite: false })); hoverMesh.position.y = 0.03; hoverMesh.renderOrder = 5; G.helpers.add(hoverMesh); }
  invalidate();
}
