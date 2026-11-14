/* ---------- 9. KITCHEN: countertop from the plan outline, sink/hob cut-outs, auto-filled base + wall cabinets ---------- */
const CAB_WIDTHS = [0.3, 0.45, 0.6, 0.9];
const BASE_STYLES = { shutter: 'Shutter', drawer: 'Drawers', corner: 'Blind corner', tall: 'Tall unit', open: 'Open shelf', filler: 'Filler panel' };
const WALL_STYLES = { shutter: 'Shutter', open: 'Open shelf', glass: 'Glass shutter', chimney: 'Chimney hood' };
function runGeom(r) { const dx = r.to[0] - r.from[0], dy = r.to[1] - r.from[1], L = Math.hypot(dx, dy) || 1e-6, u = [dx / L, dy / L], f = [-u[1], u[0]], flip = !!r.face && (r.face[0] * f[0] + r.face[1] * f[1]) < 0; return { L, u, f: flip ? [-f[0], -f[1]] : f, flip }; }
const runPoint = (r, g, s, z) => [r.from[0] + g.u[0] * s + g.f[0] * z, r.from[1] + g.u[1] * s + g.f[1] * z];
const runRect = r => { const g = runGeom(r); return [runPoint(r, g, 0, 0), runPoint(r, g, g.L, 0), runPoint(r, g, g.L, r.depth), runPoint(r, g, 0, r.depth)]; };
const kRuns = () => D.plan.kitchen?.runs || [];
const kRun = id => kRuns().find(r => r.id === id);
function counterMat() { const c = D.mats.counter; return M(c.type === 'wood' ? 'wood' : c.type, c.color, { rep: 2 }); }
function buildKitchen() {
  disposeGroup(G.kitchen); const K = D.plan.kitchen; if (!K) return; const KU = D.kitchen, ch = K.counterHeight, ct = K.counterThickness, tag = (g, ref) => { g.userData.unit = ref; g.traverse(m => m.userData.unitRef = ref); };
  for (const r of K.runs) {
    const g = runGeom(r), grp = new THREE.Group(); grp.position.set(r.from[0], 0, r.from[1]); grp.rotation.y = -Math.atan2(g.u[1], g.u[0]); if (g.flip) grp.scale.z = -1; grp.userData = { kind: 'run', id: r.id }; G.kitchen.add(grp);
    const fx = K.fixtures.filter(f => f.run === r.id), dep = r.depth + 0.02, sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(g.L, 0); sh.lineTo(g.L, dep); sh.lineTo(0, dep); sh.closePath();
    for (const f of fx) { const x0 = clamp(f.at - f.w / 2, 0.03, g.L - 0.06), x1 = clamp(f.at + f.w / 2, x0 + 0.03, g.L - 0.03), z0 = (r.depth - f.d) / 2 + 0.02, z1 = z0 + f.d, h = new THREE.Path(); h.moveTo(x0, z0); h.lineTo(x0, z1); h.lineTo(x1, z1); h.lineTo(x1, z0); h.closePath(); sh.holes.push(h); }
    const sg = new THREE.ExtrudeGeometry(sh, { depth: ct, bevelEnabled: false }); sg.rotateX(Math.PI / 2); const slab = new THREE.Mesh(sg, counterMat()); slab.position.y = ch; slab.castShadow = slab.receiveShadow = true; slab.userData = { kind: 'counter', run: r.id }; grp.add(slab);
    const bs = boxMesh(g.L, 0.1, 0.015, counterMat(), g.L / 2, ch, 0.0075); bs.userData = { kind: 'counter', run: r.id }; grp.add(bs);
    for (const f of fx) { const sub = new THREE.Group(), zc = (r.depth - f.d) / 2 + 0.02 + f.d / 2; sub.position.set(clamp(f.at, f.w / 2 + 0.03, g.L - f.w / 2 - 0.03), 0, zc); grp.add(sub);
      if (f.type === 'sink') { const st = M('chrome', '#c9cdd2'), bd = 0.18, t = 0.012; sub.add(boxMesh(f.w, t, f.d, st, 0, ch - bd, 0));
        for (const s of [-1, 1]) { sub.add(boxMesh(t, bd, f.d, st, s * (f.w / 2 - t / 2), ch - bd, 0)); sub.add(boxMesh(f.w, bd, t, st, 0, ch - bd, s * (f.d / 2 - t / 2))); }
        sub.add(boxMesh(f.w + 0.03, 0.004, 0.02, st, 0, ch, -f.d / 2 - 0.01)); const fc = new THREE.Mesh(cylGeo(1, SEG(10)), st); fc.scale.set(0.014, 0.24, 0.014); fc.position.set(0, ch + 0.12, -f.d / 2 - 0.03); sub.add(fc); sub.add(boxMesh(0.02, 0.02, 0.16, st, 0, ch + 0.22, -f.d / 2 + 0.04)); }
      else { const k = kit({ w: f.w, d: f.d, h: 0.05, color: '#17191c', opts: { burners: f.w > 0.5 ? 4 : 2 } }); B.hob(k); k.g.position.y = ch - 0.012; sub.add(k.g); }
      tag(sub, { kind: 'fixture', id: f.id }); outlineIfSel(sub, 'fixture', f.id, f.w, 0.3, f.d, ch - 0.15); }
    for (const u of KU.baseUnits.filter(u => u.run === r.id)) { const tall = u.style === 'tall', h = tall ? 2.1 : ch - ct, d = r.depth - 0.02, col = u.color || D.mats.cabinet, k = kit({ w: u.w, d, h, color: col, opts: {} });
      if (u.style === 'filler' || u.style === 'corner') k.box(u.w, h - 0.1, 0.018, M('wood', col), 0, 0.1, d / 2 - 0.009), k.box(u.w, 0.1, d - 0.05, M('paint', shade(col, -0.45)), 0, 0, -0.02);
      else if (tall) B.tallunit(k); else carcass(k, { cols: u.w > 0.7 ? 2 : 1, rows: u.style === 'drawer' ? 3 : u.style === 'open' ? 2 : 1, drawers: u.style === 'drawer', open: u.style === 'open', plinth: 0.1 });
      k.g.position.set(u.at + u.w / 2, 0, d / 2); grp.add(k.g); tag(k.g, { kind: 'base', id: u.id }); outlineIfSel(k.g, 'base', u.id, u.w, h, d, 0); }
    for (const u of KU.wallUnits.filter(u => u.run === r.id)) { const h = KU.wallCabHeight, d = KU.wallCabDepth, col = u.color || D.mats.cabinetWall; let k;
      if (u.style === 'chimney') { k = kit({ w: u.w, d: Math.min(0.48, r.depth - 0.1), h, color: '#b8bcc2', opts: {} }); B.chimney(k); k.g.position.set(u.at + u.w / 2, KU.wallCabElev + 0.15, k.d / 2); }
      else { k = kit({ w: u.w, d, h, color: col, opts: {} }); carcass(k, { cols: u.w > 0.7 ? 2 : 1, open: u.style === 'open', rows: u.style === 'open' ? 2 : 1, glass: u.style === 'glass' }); k.g.position.set(u.at + u.w / 2, KU.wallCabElev, d / 2); }
      grp.add(k.g); tag(k.g, { kind: 'wall', id: u.id }); outlineIfSel(k.g, 'wall', u.id, u.w, h, k.d, 0); }
  }
  renderer.shadowMap.needsUpdate = true; invalidate();
}
function outlineIfSel(g, kind, id, w, h, d, y0) { if (!SEL.unit || SEL.unit.kind !== kind || SEL.unit.id !== id) return; const b = new THREE.LineSegments(EDGE_GEO, selMat); b.scale.set(w + 0.03, h + 0.03, d + 0.03); b.position.set(0, y0 + h / 2, 0); b.renderOrder = 10; g.add(b); }
/* Greedy fill of a length with standard module widths; remainder becomes a filler panel. */
function fillWidths(len, pref) {
  const out = []; let rem = len; while (rem >= pref - 1e-6) { out.push(pref); rem -= pref; }
  const fit = CAB_WIDTHS.filter(w => w <= rem + 1e-6).pop(); if (fit) { out.push(fit); rem -= fit; }
  if (rem > 0.02) { const last = out.length - 1; if (rem < 0.16 || !out.length) out.push(r3(rem)); else { const w2 = CAB_WIDTHS.filter(w => w <= out[last] + rem + 1e-6).pop(); const extra = out[last] + rem - w2; out[last] = w2; if (extra > 0.02) out.push(r3(extra)); } }
  return out;
}
function autoFillKitchen({ base = true, wall = true, pref = 0.6, openShelf = false, silent = false } = {}) {
  const K = D.plan.kitchen; if (!K) return silent || toast('No kitchen counter in the plan', 'err'); if (!silent) pushUndo(); const KU = D.kitchen;
  if (base) KU.baseUnits = []; if (wall) KU.wallUnits = [];
  const rects = K.runs.map(r => ({ id: r.id, poly: runRect(r) }));
  for (const r of K.runs) { const g = runGeom(r), fx = K.fixtures.filter(f => f.run === r.id); let at = 0, i = 0;
    for (const w of fillWidths(g.L, pref)) { const mid = at + w / 2, front = runPoint(r, g, mid, r.depth + 0.08), blind = rects.some(q => q.id !== r.id && pointInPoly(front[0], front[1], q.poly));
      const overSink = fx.some(f => f.type === 'sink' && Math.abs(f.at - mid) < (f.w + w) / 2 - 0.05), overHob = fx.find(f => f.type === 'hob' && Math.abs(f.at - mid) < Math.max(f.w, w) / 2);
      if (base) KU.baseUnits.push({ id: uid('kb'), run: r.id, at: r3(at), w, style: blind ? 'corner' : w < 0.2 ? 'filler' : overSink ? 'shutter' : (overHob || i % 3 === 1) ? 'drawer' : 'shutter' });
      if (wall && !blind && w >= 0.2) KU.wallUnits.push({ id: uid('kw'), run: r.id, at: r3(at), w, style: overHob ? 'chimney' : openShelf && i % 3 === 2 ? 'open' : 'shutter' });
      at += w; i++; } }
  SEL.unit = null; if (silent) return; changed({ kitchen: 1, ui: 1 }); toast('Kitchen cabinets generated', 'ok');
}
function clearKitchen(kind) { pushUndo(); if (kind !== 'wall') D.kitchen.baseUnits = []; if (kind !== 'base') D.kitchen.wallUnits = []; SEL.unit = null; changed({ kitchen: 1, ui: 1 }); }
function unitList(kind) { return kind === 'base' ? D.kitchen.baseUnits : kind === 'wall' ? D.kitchen.wallUnits : D.plan.kitchen.fixtures; }
function getUnit(ref) { return ref ? unitList(ref.kind).find(u => u.id === ref.id) : null; }
function selectUnit(ref) { SEL.unit = ref; SEL.ids = []; updateSelectionVisuals(); buildKitchen(); changedUI(); }
/* Re-pack the units of one run edge to edge (called after a width change so neighbours shift along). */
function repackRun(kind, runId) { let at = 0; unitList(kind).filter(u => u.run === runId).sort((a, b) => a.at - b.at).forEach(u => { u.at = r3(at); at += u.w; }); const r = kRun(runId); return r ? at - runGeom(r).L : 0; }
function setUnitProp(ref, patch) {
  const u = getUnit(ref); if (!u) return; pushUndo(); Object.assign(u, patch); for (const k in patch) if (patch[k] === undefined) delete u[k];
  if (ref.kind !== 'fixture' && ('w' in patch)) { const over = repackRun(ref.kind, u.run); if (over > 0.01) toast('Units now exceed the counter run by ' + fmtLen(over, 1), 'err'); }
  if (ref.kind === 'fixture') { const r = kRun(u.run); if (r) { const g = runGeom(r); u.w = clamp(u.w, 0.25, g.L - 0.1); u.d = clamp(u.d, 0.25, r.depth - 0.1); u.at = clamp(u.at, u.w / 2 + 0.03, g.L - u.w / 2 - 0.03); } }
  changed({ kitchen: 1, ui: 1 });
}
function deleteUnit(ref) { const l = unitList(ref.kind), i = l.findIndex(u => u.id === ref.id); if (i < 0) return; pushUndo(); l.splice(i, 1); SEL.unit = null; changed({ kitchen: 1, ui: 1 }); toast('Kitchen unit removed'); }
function addUnit(kind, runId, w = 0.6) {
  const r = kRun(runId); if (!r) return; const g = runGeom(r), l = unitList(kind), end = l.filter(u => u.run === runId).reduce((m, u) => Math.max(m, u.at + u.w), 0);
  if (end + w > g.L + 0.01) return toast('No free space left on this run — delete or shrink a unit first', 'err');
  pushUndo(); const u = { id: uid(kind === 'base' ? 'kb' : 'kw'), run: runId, at: r3(end), w, style: 'shutter' }; l.push(u); SEL.unit = { kind, id: u.id }; SEL.ids = []; changed({ kitchen: 1, ui: 1 });
}
function addFixture(type, runId) { const r = kRun(runId); if (!r) return; const g = runGeom(r); pushUndo(); const f = { id: uid('fx'), type, run: runId, at: r3(g.L / 2), w: type === 'sink' ? Math.min(0.8, g.L - 0.2) : Math.min(0.6, g.L - 0.2), d: Math.min(type === 'sink' ? 0.45 : 0.42, r.depth - 0.12) };
  D.plan.kitchen.fixtures.push(f); SEL.unit = { kind: 'fixture', id: f.id }; SEL.ids = []; changed({ kitchen: 1, ui: 1 }); }
