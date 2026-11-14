/* ---------- 8. PLACED OBJECTS: records → meshes, selection visuals, collision / clearance checks, dimension labels ---------- */
const OBJ3D = new Map();          // object id → THREE.Group
const WARN = new Map();           // object id → { collide: [names], clear: [messages] }
const defOf = o => LIBMAP[o.type] || LIBMAP.box;
const objElev = o => defOf(o).mount === 'ceiling' ? D.plan.wallHeight - o.h : (o.y || 0);
function newObject(type, x, z, extra = {}) {
  const d = LIBMAP[type]; if (!d) return null;
  return { id: uid('o'), type, name: d.name, x: r3(x), z: r3(z), y: d.elev || 0, rot: 0, w: d.w, d: d.d, h: d.h, color: d.color, locked: false, opts: clone(d.o), ...extra };
}
function makeObjectGroup(o) {
  const def = defOf(o), c = kit({ w: o.w, d: o.d, h: o.h, color: o.color, opts: { ...def.o, ...(o.opts || {}) } });
  try { (B[def.b] || B.box)(c); } catch (e) { console.warn('builder failed', o.type, e); c.g.clear(); B.box(c); }
  return c.g;
}
function buildObject(o) {
  const old = OBJ3D.get(o.id); if (old) { G.objects.remove(old); disposeGroup(old); }
  const g = makeObjectGroup(o); g.userData = { kind: 'object', id: o.id }; g.traverse(m => { if (m !== g) m.userData.objId = o.id; });
  OBJ3D.set(o.id, g); G.objects.add(g); syncObject(o); return g;
}
function syncObject(o) { const g = OBJ3D.get(o.id); if (!g) return; g.position.set(o.x, objElev(o), o.z); g.rotation.y = o.rot || 0; }
function buildObjects() { disposeGroup(G.objects); OBJ3D.clear(); D.objects.forEach(buildObject); checkWarnings(); updateSelectionVisuals(); renderer.shadowMap.needsUpdate = true; }
/* Plan-space footprint (4 corners), optionally grown by `g` metres. Local +X → (cos r, -sin r), local +Z → (sin r, cos r). */
function objPoly(o, g = 0) { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), hw = o.w / 2 + g, hd = o.d / 2 + g;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [o.x + lx * c + lz * s, o.z - lx * s + lz * c]); }
function convexOverlap(A, Bp) {
  for (const P of [A, Bp]) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], nx = b[1] - a[1], ny = a[0] - b[0]; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const p of A) { const v = p[0] * nx + p[1] * ny; a0 = Math.min(a0, v); a1 = Math.max(a1, v); } for (const p of Bp) { const v = p[0] * nx + p[1] * ny; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
    if (a1 <= b0 || b1 <= a0) return false; } return true;
}
function polyDist(A, Bp) { let d = 1e9; for (const [P, Q] of [[A, Bp], [Bp, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; d = Math.min(d, distPtSeg(p[0], p[1], a[0], a[1], b[0], b[1]).d); } return d; }
const yRange = o => { const y0 = objElev(o); return [y0, y0 + o.h]; };
function checkWarnings() {
  WARN.clear(); const objs = D.objects, polys = objs.map(o => objPoly(o, -0.012)), add = (o, k, msg) => { let w = WARN.get(o.id); if (!w) WARN.set(o.id, w = { collide: [], clear: [] }); w[k].push(msg); };
  for (let i = 0; i < objs.length; i++) { const a = objs[i], fa = defOf(a).flat, [a0, a1] = yRange(a);
    if (!fa) for (const c of COLLIDERS) { const dx = c.bx - c.ax, dy = c.by - c.ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * (c.r - 0.012), ny = dx / l * (c.r - 0.012);
      if (convexOverlap(polys[i], [[c.ax + nx, c.ay + ny], [c.bx + nx, c.by + ny], [c.bx - nx, c.by - ny], [c.ax - nx, c.ay - ny]])) { add(a, 'collide', 'a wall'); break; } }
    for (let j = i + 1; j < objs.length; j++) { const b = objs[j]; if (fa || defOf(b).flat) continue; const [b0, b1] = yRange(b); if (a1 <= b0 + 0.01 || b1 <= a0 + 0.01) continue;
      if (convexOverlap(polys[i], polys[j])) { add(a, 'collide', b.name); add(b, 'collide', a.name); }
      else if (CFG.clearance && a0 < 0.3 && b0 < 0.3) { const d = polyDist(polys[i], polys[j]); if (d > 0.14 && d < 0.58) { add(a, 'clear', `only ${fmtLen(d, 1)} walkway to ${b.name}`); add(b, 'clear', `only ${fmtLen(d, 1)} walkway to ${a.name}`); } } }
    if (CFG.clearance && !fa && a0 < 1.9) for (const s of SWINGS) if (convexOverlap(polys[i], s.poly)) add(a, 'clear', 'blocks the swing of ' + s.name);
  }
  for (const o of objs) { const g = OBJ3D.get(o.id); if (!g) continue; let t = g.getObjectByName('__warn'); const w = WARN.get(o.id);
    if (!w) { if (t) g.remove(t); continue; }
    if (!t) { t = new THREE.Mesh(UNIT_BOX, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false })); t.name = '__warn'; t.userData.objId = o.id; t.renderOrder = 4; g.add(t); }
    t.material.color.set(w.collide.length ? 0xff3030 : 0xff9f1a); t.scale.set(o.w + 0.02, o.h + 0.02, o.d + 0.02); t.position.set(0, o.h / 2, 0); }
  invalidate();
}
/* Selection outline boxes + rotate handle + distance-to-wall dimensions */
const selGroup = new THREE.Group(); G.helpers.add(selGroup);
const EDGE_GEO = new THREE.EdgesGeometry(UNIT_BOX); EDGE_GEO.userData.shared = true;
const selMat = new THREE.LineBasicMaterial({ color: 0x2f6fed, depthTest: false }), dimMat = new THREE.LineBasicMaterial({ color: 0x1d2330, depthTest: false });
let rotHandle = null;
function updateSelectionVisuals() {
  selGroup.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); selGroup.clear(); rotHandle = null; LABELS.clear('dims');
  const sel = SEL.ids.map(objById).filter(Boolean);
  for (const o of sel) { const b = new THREE.LineSegments(EDGE_GEO, selMat); b.scale.set(o.w + 0.03, o.h + 0.03, o.d + 0.03); b.position.set(o.x, objElev(o) + o.h / 2, o.z); b.rotation.y = o.rot || 0; b.renderOrder = 10; selGroup.add(b); }
  if (sel.length === 1 && VIEW.mode !== 'imm' && VIEW.mode !== 'walk') { const o = sel[0], y = objElev(o);
    if (!o.locked) { const r = (o.rot || 0), dist = o.d / 2 + 0.3; rotHandle = new THREE.Mesh(sphGeo(12), new THREE.MeshBasicMaterial({ color: 0xff8c00, depthTest: false })); rotHandle.scale.setScalar(0.07); rotHandle.renderOrder = 11;
      rotHandle.position.set(o.x + Math.sin(r) * dist, y + 0.05, o.z + Math.cos(r) * dist); rotHandle.userData.kind = 'rotHandle'; selGroup.add(rotHandle);
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(o.x, y + 0.05, o.z), rotHandle.position.clone()]); const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff8c00, depthTest: false })); ln.renderOrder = 10; selGroup.add(ln); }
    if (CFG.showDims) { const items = [], pts = [], c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
      for (const [lx, lz, half] of [[1, 0, o.w / 2], [-1, 0, o.w / 2], [0, 1, o.d / 2], [0, -1, o.d / 2]]) { const dx = lx * c + lz * s, dy = -lx * s + lz * c, ox = o.x + dx * half, oy = o.z + dy * half, hit = rayWalls(ox, oy, dx, dy);
        if (hit != null && hit > 0.02 && hit < 9) { const yy = Math.min(y + 0.06, 2); pts.push(new THREE.Vector3(ox, yy, oy), new THREE.Vector3(ox + dx * hit, yy, oy + dy * hit)); items.push({ pos: [ox + dx * hit / 2, yy, oy + dy * hit / 2], cls: 'dim', html: fmtLen(hit, 1) }); } }
      if (pts.length) { const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), dimMat); l.renderOrder = 9; selGroup.add(l); LABELS.set('dims', items); } } }
  invalidate();
}
/* Distance from (ox,oy) along (dx,dy) to the nearest wall face, or null. */
function rayWalls(ox, oy, dx, dy) {
  let best = null;
  for (const c of COLLIDERS) { const ex = c.bx - c.ax, ey = c.by - c.ay, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-6) continue;
    const t = ((c.ax - ox) * ey - (c.ay - oy) * ex) / den, u = ((c.ax - ox) * dy - (c.ay - oy) * dx) / den; if (t < -0.3 || u < -0.02 || u > 1.02) continue;
    const l = Math.hypot(ex, ey) || 1, cosn = Math.abs((dx * -ey + dy * ex) / l) || 1e-3, tt = t - c.r / cosn; if (tt < -0.02) continue; if (best == null || tt < best) best = Math.max(0, tt); }
  return best;
}
/* --- object operations (all undoable) --- */
function selectObjects(ids, additive) { const hadUnit = SEL.unit; SEL.unit = null; if (hadUnit) buildKitchen(); SEL.ids = additive ? [...new Set([...SEL.ids, ...ids])] : ids.slice(); updateSelectionVisuals(); changedUI(); }
function changedUI() { listeners.forEach(fn => fn({ ui: 1, selection: 1 })); }
function placeObject(type, x, z, select = true) {
  const o = newObject(type, x, z); if (!o) return null; const def = defOf(o);
  if (def.mount === 'wall') { const s = snapToWall(o, 3); if (s) { o.x = s.x; o.z = s.z; o.rot = s.rot; } }
  pushUndo(); D.objects.push(o); if (select) { SEL.ids = [o.id]; SEL.unit = null; } changed({ objects: 1, ui: 1 }); return o;
}
function deleteSelected() {
  if (SEL.unit) return deleteUnit(SEL.unit);
  const ids = SEL.ids.filter(id => !objById(id)?.locked); if (!ids.length) return SEL.ids.length && toast('Selection is locked');
  pushUndo(); D.objects = D.objects.filter(o => !ids.includes(o.id)); SEL.ids = SEL.ids.filter(id => !ids.includes(id)); changed({ objects: 1, ui: 1 }); toast(ids.length + ' item(s) deleted');
}
function duplicateSelected() {
  const src = SEL.ids.map(objById).filter(Boolean); if (!src.length) return; pushUndo();
  const cps = src.map(o => ({ ...clone(o), id: uid('o'), x: r3(o.x + 0.4), z: r3(o.z + 0.4), locked: false })); D.objects.push(...cps); SEL.ids = cps.map(o => o.id); changed({ objects: 1, ui: 1 }); toast('Duplicated');
}
function rotateSelected(delta) { const os = SEL.ids.map(objById).filter(o => o && !o.locked); if (!os.length) return; pushUndo();
  if (os.length === 1) os[0].rot = normAng(os[0].rot + delta);
  else { const cx = os.reduce((a, o) => a + o.x, 0) / os.length, cz = os.reduce((a, o) => a + o.z, 0) / os.length, c = Math.cos(delta), s = Math.sin(delta);
    os.forEach(o => { const dx = o.x - cx, dz = o.z - cz; o.x = r3(cx + dx * c + dz * s); o.z = r3(cz - dx * s + dz * c); o.rot = normAng(o.rot + delta); }); }
  changed({ objects: 1, ui: 1 }); }
const normAng = a => { a = a % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return Math.round(a * 1e5) / 1e5; };
/* Update one field of the selected objects from the Properties panel. */
function setObjProp(ids, patch) { pushUndo(); ids.map(objById).filter(Boolean).forEach(o => Object.assign(o, typeof patch === 'function' ? patch(o) : patch)); changed({ objects: 1, ui: 1 }); }
function objRoomName(o) { const r = roomAt(o.x, o.z); return r ? r.name : 'Outside'; }
