/* ---------- 7. OBJECT LIBRARY — builder toolkit + bedroom / living / dining builders ----------
   Every builder receives a kit `c` (dimensions w × d × h in metres, colour, options, primitive helpers) and adds meshes to c.g.
   Local frame: origin = centre of footprint on the floor, +Z = front (so the back, -Z, goes against a wall). */
const GEOS = {};
function cylGeo(ratio, seg) { const k = 'c' + ratio.toFixed(2) + '_' + seg; if (!GEOS[k]) { GEOS[k] = new THREE.CylinderGeometry(ratio, 1, 1, seg); GEOS[k].userData.shared = true; } return GEOS[k]; }
function sphGeo(seg) { const k = 's' + seg; if (!GEOS[k]) { GEOS[k] = new THREE.SphereGeometry(1, seg, Math.max(4, seg >> 1)); GEOS[k].userData.shared = true; } return GEOS[k]; }
function shade(hex, f) { const c = new THREE.Color(hex); if (f < 0) c.multiplyScalar(1 + f); else c.lerp(new THREE.Color('#ffffff'), f); return '#' + c.getHexString(); }
function kit(o) {
  const g = new THREE.Group(), c = { g, w: o.w, d: o.d, h: o.h, color: o.color, o: o.opts || {}, m: M };
  const fin = m => { m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  c.box = (w, h, d, mat, x = 0, y = 0, z = 0) => fin(boxMesh(w, h, d, mat, x, y, z));
  c.cyl = (r, h, mat, x = 0, y = 0, z = 0, rt = r, seg = 20) => { const m = new THREE.Mesh(cylGeo(rt / r, SEG(seg)), mat); m.scale.set(r, h, r); m.position.set(x, y + h / 2, z); return fin(m); };
  c.sph = (rx, ry, rz, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(sphGeo(SEG(18)), mat); m.scale.set(rx, ry, rz); m.position.set(x, y, z); return fin(m); };
  c.legs = (lh, mat, inset = 0.04, t = 0.04, W = c.w, Dp = c.d) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(t, lh, t, mat, sx * (W / 2 - inset - t / 2), 0, sz * (Dp / 2 - inset - t / 2)); };
  return c;
}
const B = {};
/* Generic carcass with doors or drawers on the front: used by wardrobes, cabinets, dressers, TV units… */
function carcass(c, { y0 = 0, hh = c.h - y0, cols = 1, rows = 1, drawers = false, plinth = 0, glass = false, open = false, handle = true, x = 0, ww = c.w, z = 0, dd = c.d, col = c.color } = {}) {
  const body = c.m('wood', col), front = c.m('wood', shade(col, 0.06)), hm = c.m('chrome', D.mats.handle), gap = 0.004, ft = 0.018;
  if (plinth) c.box(ww - 0.02, plinth, dd - 0.05, c.m('paint', shade(col, -0.45)), x, y0, z - 0.02);
  const by = y0 + plinth, bh = hh - plinth;
  if (open) { c.box(ww, bh, 0.018, body, x, by, z - dd / 2 + 0.009); for (const sx of [-1, 1]) c.box(0.018, bh, dd, body, x + sx * (ww / 2 - 0.009), by, z);
    for (let i = 0; i <= rows; i++) c.box(ww - 0.03, 0.018, dd - 0.01, body, x, by + (bh - 0.018) * i / rows, z); return; }
  c.box(ww, bh, dd - ft, body, x, by, z - ft / 2);
  const cw = ww / cols, rh = bh / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const fx = x - ww / 2 + cw * (i + 0.5), fy = by + rh * j, f = c.box(cw - gap * 2, rh - gap * 2, ft, glass ? c.m('glass', '#cfe6ee') : front, fx, fy + gap, z + dd / 2 - ft / 2);
    if (glass) f.castShadow = false; if (!handle) continue;
    if (drawers) c.box(Math.min(0.16, cw * 0.4), 0.014, 0.022, hm, fx, fy + rh * 0.62, z + dd / 2 + 0.011);
    else c.box(0.014, Math.min(0.16, rh * 0.3), 0.022, hm, fx + (i % 2 === 0 && cols > 1 ? 1 : -1) * (cw / 2 - 0.04), fy + (y0 > 1 ? 0.12 : rh - 0.14 - Math.min(0.16, rh * 0.3)) , z + dd / 2 + 0.011);
  }
}
B.bed = c => { const { w, d, h } = c, wood = c.m('wood', c.color), bh = 0.3, mh = 0.22, md = d - 0.1;
  c.legs(0.08, c.m('wood', shade(c.color, -0.3)), 0.03, 0.06); c.box(w, bh - 0.08, d - 0.07, wood, 0, 0.08, 0.035); c.box(w, h, 0.07, wood, 0, 0, -d / 2 + 0.035);
  c.box(w - 0.06, mh, md, c.m('fabric', '#f4f1ea'), 0, bh, 0.045); c.box(w - 0.02, 0.05, md * 0.62, c.m('fabric', c.o.blanket || '#7f95ad'), 0, bh + mh - 0.01, 0.045 + md * 0.19);
  const n = w > 1.25 ? 2 : 1, pw = Math.min(0.68, (w - 0.16) / n); for (let i = 0; i < n; i++) c.box(pw - 0.06, 0.11, 0.38, c.m('fabric', '#ffffff'), (i - (n - 1) / 2) * pw, bh + mh, -d / 2 + 0.3); };
B.cabinet = c => carcass(c, { cols: c.o.cols || 1, rows: c.o.rows || 1, drawers: c.o.drawers, plinth: c.o.plinth ?? 0.06, glass: c.o.glass, open: c.o.open });
B.wardrobe = c => { const n = c.o.doors || 2, { w, d, h } = c;
  if (!c.o.sliding) return carcass(c, { cols: n, plinth: 0.08 });
  c.box(w, h, d - 0.05, c.m('wood', c.color), 0, 0, -0.025); const pw = w / n + 0.02;
  for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5), z = d / 2 - 0.04 + (i % 2) * 0.022; c.box(pw, h - 0.1, 0.02, i === 1 ? c.m('mirror', '#dfe6ea') : c.m('wood', shade(c.color, 0.08)), x, 0.08, z);
    c.box(0.02, h - 0.1, 0.024, c.m('metal', '#9a9fa6'), x - pw / 2 + 0.01, 0.08, z); } c.box(w, 0.08, d - 0.06, c.m('paint', shade(c.color, -0.45)), 0, 0, -0.02); };
B.dresser = c => { const { w, d, h } = c, bh = Math.min(0.78, h); carcass(c, { hh: bh, cols: 2, rows: 3, drawers: true, plinth: 0.06 });
  if (h > bh + 0.2) { c.box(w * 0.7, h - bh - 0.04, 0.03, c.m('wood', c.color), 0, bh + 0.02, -d / 2 + 0.03); c.box(w * 0.7 - 0.06, h - bh - 0.1, 0.008, c.m('mirror', '#e3e9ec'), 0, bh + 0.05, -d / 2 + 0.05); } };
B.mirror = c => { const { w, d, h } = c; c.box(w, h, d * 0.6, c.m('wood', c.color), 0, 0, -d * 0.2); c.box(w - 0.06, h - 0.06, d * 0.3, c.m('mirror', '#e3e9ec'), 0, 0.03, d * 0.2); };
B.sofa = c => { const { w, d, h } = c, n = c.o.seats || 3, f = c.m('fabric', c.color), f2 = c.m('fabric', shade(c.color, 0.1)), arm = Math.min(0.18, w * 0.12), sh = 0.42, back = 0.2, L = c.o.L;
  const md = L ? Math.min(0.95, d * 0.55) : d, mz = L ? -d / 2 + md / 2 : 0;
  c.legs(0.06, c.m('wood', '#3a2f28'), 0.04, 0.05, w, L ? md : d);
  c.box(w, sh - 0.06 - 0.12, md, f, 0, 0.06, mz); c.box(w, h - 0.06, back, f, 0, 0.06, mz - md / 2 + back / 2);
  c.box(arm, 0.62 - 0.06, md, f, -w / 2 + arm / 2, 0.06, mz); if (!L) c.box(arm, 0.62 - 0.06, md, f, w / 2 - arm / 2, 0.06, mz);
  const inner = w - arm * (L ? 1 : 2), cw = inner / n, x0 = -w / 2 + arm;
  for (let i = 0; i < n; i++) { c.box(cw - 0.02, 0.14, md - back - 0.02, f2, x0 + cw * (i + 0.5), sh - 0.14, mz + back / 2); c.box(cw - 0.04, h - sh - 0.08, 0.14, f2, x0 + cw * (i + 0.5), sh, mz - md / 2 + back + 0.07); }
  if (L) { const cwid = Math.min(0.95, w * 0.38), cd = d - md; c.box(cwid, sh - 0.2, cd, f, w / 2 - cwid / 2, 0.06, mz + md / 2 + cd / 2); c.box(cwid - 0.02, 0.14, cd - 0.02, f2, w / 2 - cwid / 2, sh - 0.14, mz + md / 2 + cd / 2); } };
B.recliner = c => { const { w, d, h } = c, f = c.m('leather', c.color), f2 = c.m('leather', shade(c.color, 0.1)), arm = 0.16;
  c.box(w, 0.36, d * 0.72, f, 0, 0.04, -d * 0.14); for (const s of [-1, 1]) c.box(arm, 0.6, d * 0.72, f, s * (w / 2 - arm / 2), 0.04, -d * 0.14);
  const bk = c.box(w - arm * 2, h - 0.38, 0.2, f2, 0, 0.4, -d / 2 + 0.16); bk.rotation.x = -0.22; c.box(w - arm * 2 - 0.02, 0.12, d * 0.5, f2, 0, 0.36, -d * 0.08); c.box(w - arm * 2, 0.1, d * 0.26, f2, 0, 0.3, d / 2 - d * 0.13); };
B.table = c => { const { w, d, h } = c, top = c.m(c.o.topKind || 'wood', c.color), lg = c.m(c.o.metalLegs ? 'metal' : 'wood', c.o.metalLegs ? '#3b3e44' : shade(c.color, -0.25)), tt = c.o.tt || 0.04;
  if (c.o.round) { c.cyl(w / 2, tt, top, 0, h - tt, 0, w / 2, 32); c.cyl(0.05, h - tt - 0.03, lg, 0, 0.03, 0); c.cyl(w * 0.28, 0.03, lg, 0, 0, 0, w * 0.26); }
  else { c.box(w, tt, d, top, 0, h - tt, 0); c.legs(h - tt, lg, 0.03, c.o.legT || 0.05); if (c.o.shelf) c.box(w - 0.12, 0.02, d - 0.12, top, 0, h * 0.3, 0); } };
B.tv = c => { const { w, d, h } = c; c.box(w, h, d * 0.5, c.m('plastic', '#17191c'), 0, 0, -d * 0.25); c.box(w - 0.03, h - 0.03, 0.006, c.m('screen', '#0c1118'), 0, 0.015, 0.003); };
B.tvunit = c => { const { w, d, h } = c; carcass(c, { cols: Math.max(2, Math.round(w / 0.6)), plinth: 0.05, drawers: true }); c.box(w + 0.02, 0.025, d + 0.01, c.m('wood', shade(c.color, -0.2)), 0, h - 0.025, 0); };
B.bookshelf = c => { const { w, d, h } = c, rows = Math.max(2, Math.round(h / 0.36)); carcass(c, { open: true, rows });
  const cols = ['#b5523b', '#3f6b8a', '#d8b44a', '#5d7d5a', '#7a4f7a', '#e0d8c8', '#2f3b4c'], r = rng(Math.round(w * 100 + h * 10)), rh = (h - 0.018) / rows;
  for (let j = 0; j < rows && !c.o.empty; j++) { let x = -w / 2 + 0.04; while (x < w / 2 - 0.1) { const bw = 0.025 + r() * 0.035, bh = rh * (0.55 + r() * 0.3); if (r() > 0.25) c.box(bw, bh, d * 0.7, c.m('paint', cols[(r() * cols.length) | 0]), x + bw / 2, 0.018 + rh * j, -0.02); x += bw + 0.004; } } };
B.rug = c => { c.box(c.w, c.h, c.d, c.m('rug', c.color), 0, 0, 0).castShadow = false; c.box(c.w - 0.3, c.h + 0.002, c.d - 0.3, c.m('rug', shade(c.color, 0.18)), 0, 0, 0).castShadow = false; };
B.floorlamp = c => { const { w, h } = c, mt = c.m('metal', '#33363b'); c.cyl(w * 0.4, 0.03, mt, 0, 0, 0); c.cyl(0.015, h - 0.32, mt, 0, 0.03, 0); c.cyl(w / 2, 0.3, c.m('emissive', c.color, { on: CFG.night }), 0, h - 0.3, 0, w * 0.36, 18); };
B.plant = c => { const { w, h } = c, pot = c.m('ceramic', c.color), leaf = c.m('leaf', c.o.leaf || '#4f8a4a'), ph = Math.min(0.4, h * 0.3);
  c.cyl(w * 0.3, ph, pot, 0, 0, 0, w * 0.36, 14); c.cyl(w * 0.33, 0.02, c.m('paint', '#4a3a2c'), 0, ph - 0.02, 0, w * 0.33, 14);
  if (h > 0.9) { c.cyl(0.025, h * 0.45, c.m('wood', '#6b4a2f'), 0, ph, 0, 0.02, 8); c.sph(w * 0.5, h * 0.24, w * 0.5, leaf, 0, h * 0.76, 0); c.sph(w * 0.36, h * 0.16, w * 0.36, leaf, w * 0.14, h * 0.58, 0.05); c.sph(w * 0.3, h * 0.14, w * 0.3, c.m('leaf', shade(c.o.leaf || '#4f8a4a', 0.15)), -w * 0.16, h * 0.64, -0.06); }
  else { c.sph(w * 0.48, (h - ph) * 0.6, w * 0.48, leaf, 0, ph + (h - ph) * 0.5, 0); c.sph(w * 0.3, (h - ph) * 0.4, w * 0.3, c.m('leaf', shade(c.o.leaf || '#4f8a4a', 0.15)), w * 0.15, ph + (h - ph) * 0.62, 0.06); } };
B.chair = c => { const { w, d, h } = c, wood = c.m('wood', c.color), sh = c.o.seatH || 0.45; c.legs(sh - 0.04, wood, 0.02, 0.035); c.box(w, 0.05, d, c.o.cushion ? c.m('fabric', c.o.cushion) : wood, 0, sh - 0.04, 0);
  if (h > sh + 0.1) { for (const s of [-1, 1]) c.box(0.035, h - sh, 0.035, wood, s * (w / 2 - 0.035), sh, -d / 2 + 0.03); c.box(w - 0.06, (h - sh) * 0.45, 0.025, wood, 0, sh + (h - sh) * 0.5, -d / 2 + 0.03); } };
B.barstool = c => { const { w, h } = c, mt = c.m('metal', '#3b3e44'); c.cyl(w * 0.42, 0.02, mt, 0, 0, 0); c.cyl(0.025, h - 0.08, mt, 0, 0.02, 0); c.cyl(w * 0.3, 0.012, mt, 0, h * 0.35, 0); c.cyl(w / 2, 0.07, c.m('leather', c.color), 0, h - 0.07, 0, w / 2, 20); };
/* Dining set: table + chairs arranged around it (footprint includes pulled-in chairs). */
B.dining = c => { const { w, d, h } = c, n = c.o.chairs || 4, round = c.o.round, cs = 0.44, sub = (fn, o) => { const k = kit(o); fn(k); c.g.add(k.g); return k.g; };
  const tw = round ? Math.min(w, d) - 0.5 : w - (n >= 8 ? 0.5 : 0.1), td = round ? tw : d - 0.5;
  sub(B.table, { w: tw, d: td, h, color: c.color, opts: { round, tt: 0.04 } });
  const seat = (x, z, rot) => { const g = sub(B.chair, { w: cs, d: cs, h: 0.9, color: shade(c.color, -0.12), opts: { cushion: c.o.cushion || '#d9cdb8' } }); g.position.set(x, 0, z); g.rotation.y = rot; };
  if (round) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = tw / 2 + 0.05; seat(Math.sin(a) * r, Math.cos(a) * r, a + Math.PI); }
  else { const side = n > 4 ? Math.floor((n - 2) / 2) + (n === 6 ? 1 : 0) : n / 2, per = n === 6 ? 3 : side, ends = n - per * 2;
    for (let i = 0; i < per; i++) { const x = -tw / 2 + tw * (i + 0.5) / per; seat(x, td / 2 + 0.03, Math.PI); seat(x, -td / 2 - 0.03, 0); }
    if (ends >= 1) seat(-tw / 2 - 0.03, 0, Math.PI / 2); if (ends >= 2) seat(tw / 2 + 0.03, 0, -Math.PI / 2); } };
B.crockery = c => { const { w, d, h } = c, bh = 0.85; carcass(c, { hh: bh, cols: Math.max(2, Math.round(w / 0.45)), plinth: 0.07 }); c.box(w, 0.025, d, c.m('wood', shade(c.color, -0.15)), 0, bh, 0);
  carcass(c, { y0: bh + 0.3, hh: h - bh - 0.3, cols: Math.max(2, Math.round(w / 0.45)), glass: true, dd: d * 0.7, z: -d * 0.15 }); c.box(w, 0.3, 0.018, c.m('wood', c.color), 0, bh + 0.025, -d / 2 + 0.009); };
