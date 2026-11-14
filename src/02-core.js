/* =====================================================================
   APARTMENT INTERIOR DESIGNER — single-file three.js app
   Sections: 1 Core/utils · 2 Plan data · 3 State/undo · 4 Materials/skins
   5 Scene/render · 6 Plan geometry · 7 Library · 8 Objects · 9 Kitchen
   10 Interaction · 11 Cameras · 12 Plan edit · 13-14 UI · 15 Persistence
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ---------- 1. CORE UTILITIES ---------- */
const FT = 0.3048, SCHEMA = 2, LS_KEY = 'aptDesigner.autosave.v2', LS_SNAP = 'aptDesigner.snapshots.v2';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
const uid = p => p + '_' + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const r3 = v => Math.round(v * 1000) / 1000;
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) { const v = attrs[k];
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
function toast(msg, type = '', ms = 2600) { const box = $('#toasts'), t = el('div', { class: 'toast ' + type }, msg); while (box.children.length >= 3) box.firstChild.remove(); box.append(t); setTimeout(() => t.remove(), ms); }
function capturePointer(elm, ev) { try { elm.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ } }
function setStatus(s) { $('#status').textContent = s; }
function download(name, data, mime = 'application/octet-stream') {
  const url = data instanceof Blob ? URL.createObjectURL(data) : (typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(new Blob([data], { type: mime })));
  const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 4000);
  window.__lastDownload = { name, data };            // exposed for automated checks
}
/* Units: all internal lengths are METRES. */
function fmtLen(m, short) {
  if (CFG.units === 'm') return (Math.abs(m) < 1 && short ? Math.round(m * 100) + ' cm' : (Math.round(m * 100) / 100).toFixed(2) + ' m');
  let inches = Math.round(m / FT * 12), sign = inches < 0 ? '-' : ''; inches = Math.abs(inches);
  return sign + Math.floor(inches / 12) + "'" + (inches % 12) + '"';
}
function fmtArea(m2) { return CFG.units === 'm' ? m2.toFixed(1) + ' m²' : Math.round(m2 / (FT * FT)) + ' sq ft'; }
/* Accepts 12'6", 12' 6, 12ft, 150in, 3.8m, 380cm, 3800mm, or a bare number in the current unit. Returns metres or NaN. */
function parseLen(str) {
  const s = String(str).trim().toLowerCase().replace(/,/g, '.'); let m;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/))) return (parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0) * Math.sign(parseFloat(m[1]) || 1)) * FT;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/))) return parseFloat(m[1]) / 12 * FT;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*mm$/))) return parseFloat(m[1]) / 1000;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*cm$/))) return parseFloat(m[1]) / 100;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*m$/))) return parseFloat(m[1]);
  if ((m = s.match(/^-?\d+(?:\.\d+)?$/))) return parseFloat(s) * (CFG.units === 'm' ? 1 : FT);
  return NaN;
}
/* 2D geometry helpers (plan space: x → world X, y → world Z) */
function pointInPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function polyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); }
function polyCentroid(p) { let a = 0, cx = 0, cy = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]; a += f; cx += (p[j][0] + p[i][0]) * f; cy += (p[j][1] + p[i][1]) * f; } if (Math.abs(a) < 1e-9) return p[0].slice(); return [cx / (3 * a), cy / (3 * a)]; }
function polyBounds(p) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }
function distPtSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1); const cx = ax + t * dx, cy = ay + t * dy; return { d: Math.hypot(px - cx, py - cy), t, cx, cy }; }

/* ---------- 2. PLAN DATA (source of truth — edit here or in "Plan edit" mode) ----------
   Extracted from the attached "3.5 BHK FLAT" plan. Authored in FEET (units:"ft"), origin at the outer
   north-west corner of the top attached toilet's wall line; x → east (right on the sheet), y → south (down).
   Walls are centre-lines with thickness `t`; openings sit on a wall, `at` = distance from wall start `a`
   to the opening centre. `opensTo` (+1/-1) = side of the wall the leaf swings into (left-hand normal of a→b = +1),
   `hinge` = which jamb carries the hinge. Rooms are clear INTERIOR polygons.
   ASSUMPTIONS are listed in PLAN.assumptions and shown on screen (View → Plan assumptions). */
const DEFAULT_PLAN = {
  units: 'ft', name: '3.5 BHK Flat', wallHeight: 10, north: 'left of sheet (-x)',
  assumptions: [
    'Scale set from room labels (≈27.6 px per ft on the image); every labelled room size matches within ~2".',
    'All masonry walls drawn 6" thick; balcony/dry-balcony parapets 4" thick × 3\'6" high.',
    'The middle bedroom is labelled "BEDROOM 1" on the plan a second time — treated as Bedroom 2.',
    'Wall height 10 ft; door heights 7 ft; bedroom/kitchen doors 3\'0", toilet doors 2\'6", main door 3\'6".',
    'Main entry door placed on the north wall of the entry foyer (under the entry arrow), opening inwards.',
    'Study opens to the living room through a 3 ft sliding door (the stepped line on the plan read as its track).',
    'Window sizes are not dimensioned: bedrooms 5 ft, study 6 ft wide, sill 2\'6", head 7 ft; toilet ventilators 2 ft × 1\'6" at 6\'6" sill.',
    'Kitchen window (3 ft, above counter) on the west wall is assumed — not clearly drawn.',
    'Living room and Bedroom 3 open to their 6 ft balconies through sliding glass doors (8 ft and 5 ft).',
    'Cyan cross-hatched boxes read as structural / service ledges and the three crossed boxes as duct shafts — not modelled.',
    'Kitchen counter: full north wall run (sink + hob) plus an L along the east and south walls, 2 ft deep, 34" high; fridge in the SW corner.',
    'Passage is 4\'0" wide and opens to the living room without a door.'
  ],
  rooms: [
    { id: 'living', name: 'Living + Dining', type: 'living', poly: [[8.75, 14.27], [17.83, 14.27], [17.83, 17.17], [31.08, 17.17], [31.08, 28.83], [8.75, 28.83]] },
    { id: 'study', name: 'Study Room', type: 'study', poly: [[0.25, 17.17], [8.25, 17.17], [8.25, 28.83], [0.25, 28.83]] },
    { id: 'bed1', name: 'Bedroom 1 (Master)', type: 'bedroom', poly: [[18.33, 5.67], [31.08, 5.67], [31.08, 16.67], [18.33, 16.67]] },
    { id: 'toi1', name: 'Attached Toilet 1', type: 'bath', poly: [[18.33, 0.25], [25.83, 0.25], [25.83, 5.17], [18.33, 5.17]] },
    { id: 'kitchen', name: 'Kitchen', type: 'kitchen', poly: [[10.33, 29.33], [17.83, 29.33], [17.83, 40.33], [10.33, 40.33]] },
    { id: 'dry', name: 'Dry Balcony', type: 'balcony', outdoor: true, poly: [[5.83, 33.95], [9.83, 33.95], [9.83, 40.33], [5.83, 40.33]] },
    { id: 'passage', name: 'Passage', type: 'passage', poly: [[18.33, 28.83], [22.33, 28.83], [22.33, 45.75], [18.33, 45.75]] },
    { id: 'bed2', name: 'Bedroom 2', type: 'bedroom', poly: [[22.83, 29.33], [35.5, 29.33], [35.5, 40.33], [22.83, 40.33]] },
    { id: 'comtoi', name: 'Common Toilet', type: 'bath', poly: [[10.33, 40.83], [17.83, 40.83], [17.83, 45.75], [10.33, 45.75]] },
    { id: 'toi2', name: 'Attached Toilet 2', type: 'bath', poly: [[22.83, 40.83], [30.33, 40.83], [30.33, 45.75], [22.83, 45.75]] },
    { id: 'bed3', name: 'Bedroom 3', type: 'bedroom', poly: [[18.33, 46.25], [31.08, 46.25], [31.08, 57.25], [18.33, 57.25]] },
    { id: 'bal1', name: 'Balcony 1', type: 'balcony', outdoor: true, poly: [[31.58, 17.17], [37.58, 17.17], [37.58, 28.83], [31.58, 28.83]] },
    { id: 'bal2', name: 'Balcony 2', type: 'balcony', outdoor: true, poly: [[31.58, 46.25], [37.58, 46.25], [37.58, 57.25], [31.58, 57.25]] }
  ],
  walls: [
    { id: 'w_toi1_n', a: [18.08, 0], b: [26.08, 0], t: 0.5 }, { id: 'w_shaft1_n', a: [26.08, 0], b: [31.33, 0], t: 0.5 },
    { id: 'w_toi1_e', a: [26.08, 0], b: [26.08, 5.42], t: 0.5 }, { id: 'w_bed1_n', a: [18.08, 5.42], b: [31.33, 5.42], t: 0.5 },
    { id: 'w_D_top', a: [18.08, 0], b: [18.08, 16.92], t: 0.5 }, { id: 'w_F_top', a: [31.33, 0], b: [31.33, 16.92], t: 0.5 },
    { id: 'w_foyer_n', a: [8.5, 14.02], b: [18.08, 14.02], t: 0.5 }, { id: 'w_B', a: [8.5, 14.02], b: [8.5, 29.08], t: 0.5 },
    { id: 'w_study_n', a: [0, 16.92], b: [8.5, 16.92], t: 0.5 }, { id: 'w_study_w', a: [0, 16.92], b: [0, 29.08], t: 0.5 },
    { id: 'w_bed1_s', a: [18.08, 16.92], b: [31.33, 16.92], t: 0.5 }, { id: 'w_F_mid', a: [31.33, 16.92], b: [31.33, 29.08], t: 0.5 },
    { id: 'w_liv_s_w', a: [0, 29.08], b: [18.08, 29.08], t: 0.5 }, { id: 'w_liv_s_e', a: [22.58, 29.08], b: [35.75, 29.08], t: 0.5 },
    { id: 'w_C', a: [10.08, 29.08], b: [10.08, 46], t: 0.5 }, { id: 'w_kit_s', a: [5.58, 40.58], b: [18.08, 40.58], t: 0.5 },
    { id: 'w_D_low', a: [18.08, 29.08], b: [18.08, 46], t: 0.5 }, { id: 'w_E', a: [22.58, 29.08], b: [22.58, 46], t: 0.5 },
    { id: 'w_G', a: [35.75, 29.08], b: [35.75, 46], t: 0.5 }, { id: 'w_bed2_s', a: [22.58, 40.58], b: [35.75, 40.58], t: 0.5 },
    { id: 'w_toi2_e', a: [30.58, 40.58], b: [30.58, 46], t: 0.5 }, { id: 'w_comtoi_s', a: [10.08, 46], b: [18.08, 46], t: 0.5 },
    { id: 'w_bed3_n', a: [18.08, 46], b: [35.75, 46], t: 0.5 }, { id: 'w_bed3_w', a: [18.08, 46], b: [18.08, 57.5], t: 0.5 },
    { id: 'w_bed3_s', a: [18.08, 57.5], b: [31.33, 57.5], t: 0.5 }, { id: 'w_bed3_e', a: [31.33, 46], b: [31.33, 57.5], t: 0.5 },
    { id: 'p_dry_n', a: [5.58, 33.7], b: [10.08, 33.7], t: 0.33, h: 3.5 }, { id: 'p_dry_w', a: [5.58, 33.7], b: [5.58, 40.58], t: 0.33, h: 3.5 },
    { id: 'p_bal1_n', a: [31.33, 16.92], b: [37.83, 16.92], t: 0.33, h: 3.5 }, { id: 'p_bal1_e', a: [37.83, 16.92], b: [37.83, 29.08], t: 0.33, h: 3.5 },
    { id: 'p_bal1_s', a: [35.75, 29.08], b: [37.83, 29.08], t: 0.33, h: 3.5 }, { id: 'p_bal2_n', a: [35.75, 46], b: [37.83, 46], t: 0.33, h: 3.5 },
    { id: 'p_bal2_e', a: [37.83, 46], b: [37.83, 57.5], t: 0.33, h: 3.5 }, { id: 'p_bal2_s', a: [31.33, 57.5], b: [37.83, 57.5], t: 0.33, h: 3.5 }
  ],
  openings: [
    { id: 'd_main', type: 'door', wall: 'w_foyer_n', at: 2.1, w: 3.5, h: 7, sill: 0, style: 'hinged', hinge: 'start', opensTo: 1, name: 'Main entry' },
    { id: 'd_study', type: 'door', wall: 'w_B', at: 6.68, w: 3, h: 7, sill: 0, style: 'sliding', hinge: 'start', opensTo: 1, name: 'Study door' },
    { id: 'd_bed1', type: 'door', wall: 'w_bed1_s', at: 3.67, w: 3, h: 7, sill: 0, style: 'hinged', hinge: 'start', opensTo: -1, name: 'Bedroom 1 door' },
    { id: 'd_toi1', type: 'door', wall: 'w_bed1_n', at: 3.5, w: 2.5, h: 7, sill: 0, style: 'hinged', hinge: 'end', opensTo: -1, name: 'Toilet 1 door' },
    { id: 'd_kitchen', type: 'door', wall: 'w_D_low', at: 4.5, w: 3, h: 7, sill: 0, style: 'open', hinge: 'start', opensTo: 1, name: 'Kitchen doorway' },
    { id: 'd_drybal', type: 'door', wall: 'w_C', at: 8.0, w: 2.5, h: 7, sill: 0, style: 'hinged', hinge: 'end', opensTo: 1, name: 'Dry balcony door' },
    { id: 'd_comtoi', type: 'door', wall: 'w_D_low', at: 13.0, w: 2.5, h: 7, sill: 0, style: 'hinged', hinge: 'start', opensTo: 1, name: 'Common toilet door' },
    { id: 'd_bed2', type: 'door', wall: 'w_E', at: 3.5, w: 3, h: 7, sill: 0, style: 'hinged', hinge: 'start', opensTo: -1, name: 'Bedroom 2 door' },
    { id: 'd_bed3', type: 'door', wall: 'w_bed3_n', at: 2.25, w: 3, h: 7, sill: 0, style: 'hinged', hinge: 'start', opensTo: 1, name: 'Bedroom 3 door' },
    { id: 'd_toi2', type: 'door', wall: 'w_bed3_n', at: 6.0, w: 2.5, h: 7, sill: 0, style: 'hinged', hinge: 'end', opensTo: -1, name: 'Toilet 2 door' },
    { id: 'd_bal1', type: 'door', wall: 'w_F_mid', at: 6.08, w: 8, h: 7, sill: 0, style: 'sliding', hinge: 'start', opensTo: 1, glass: true, name: 'Balcony 1 sliding door' },
    { id: 'd_bal2', type: 'door', wall: 'w_bed3_e', at: 4.5, w: 5, h: 7, sill: 0, style: 'sliding', hinge: 'start', opensTo: 1, glass: true, name: 'Balcony 2 sliding door' },
    { id: 'win_study', type: 'window', wall: 'w_study_w', at: 4.0, w: 6, h: 4.5, sill: 2.5, name: 'Study window' },
    { id: 'win_bed1', type: 'window', wall: 'w_F_top', at: 11.17, w: 5, h: 4.5, sill: 2.5, name: 'Bedroom 1 window' },
    { id: 'win_bed2', type: 'window', wall: 'w_G', at: 5.75, w: 5, h: 4.5, sill: 2.5, name: 'Bedroom 2 window' },
    { id: 'win_kit', type: 'window', wall: 'w_C', at: 2.6, w: 3, h: 3, sill: 3.75, name: 'Kitchen window' },
    { id: 'v_toi1', type: 'window', wall: 'w_toi1_n', at: 4.0, w: 2, h: 1.5, sill: 6.5, name: 'Toilet 1 ventilator' },
    { id: 'v_comtoi', type: 'window', wall: 'w_C', at: 14.2, w: 2, h: 1.5, sill: 6.5, name: 'Common toilet ventilator' },
    { id: 'v_toi2', type: 'window', wall: 'w_toi2_e', at: 2.7, w: 2, h: 1.5, sill: 6.5, name: 'Toilet 2 ventilator' }
  ],
  /* Kitchen counter: each run = rectangle from `from`→`to` along the wall (back edge), `depth` deep towards `face`. */
  kitchen: {
    counterHeight: 2.85, counterThickness: 0.13, roomId: 'kitchen',
    runs: [
      { id: 'north', from: [10.33, 29.33], to: [17.83, 29.33], depth: 2, face: [0, 1] },
      { id: 'east', from: [17.83, 35.35], to: [17.83, 38.33], depth: 2, face: [-1, 0] },
      { id: 'south', from: [17.83, 40.33], to: [12.85, 40.33], depth: 2, face: [0, -1] }
    ],
    fixtures: [{ id: 'fx_sink', type: 'sink', run: 'north', at: 2.2, w: 2.6, d: 1.5 }, { id: 'fx_hob', type: 'hob', run: 'north', at: 5.9, w: 2.0, d: 1.4 }]
  }
};
/* Convert a plan authored in feet to internal metres (idempotent for units:'m'). */
function normalizePlan(p) {
  p = clone(p); if (p.units !== 'ft') { p.units = 'm'; return p; }
  const k = FT, P = a => [r3(a[0] * k), r3(a[1] * k)];
  p.wallHeight = r3(p.wallHeight * k);
  p.rooms.forEach(r => r.poly = r.poly.map(P));
  p.walls.forEach(w => { w.a = P(w.a); w.b = P(w.b); w.t = r3(w.t * k); if (w.h) w.h = r3(w.h * k); });
  p.openings.forEach(o => ['at', 'w', 'h', 'sill'].forEach(f => o[f] = r3(o[f] * k)));
  const K = p.kitchen; if (K) { K.counterHeight = r3(K.counterHeight * k); K.counterThickness = r3(K.counterThickness * k);
    K.runs.forEach(r => { r.from = P(r.from); r.to = P(r.to); r.depth = r3(r.depth * k); });
    K.fixtures.forEach(f => ['at', 'w', 'd'].forEach(q => f[q] = r3(f[q] * k))); }
  p.units = 'm'; return p;
}

/* ---------- 3. STATE + UNDO ----------
   D   = the undoable design document (plan, objects, materials, kitchen)
   CFG = view/app settings (not undoable) */
const DEFAULT_MATS = () => ({ roomWall: {}, wallFace: {}, floor: {}, ceiling: '#fafafa', wallDefault: '#f1ede4', door: '#8b6b4a', frame: '#f4f4f2', exterior: '#e9e4d8',
  counter: { type: 'granite', color: '#2b2b2e' }, cabinet: '#e6e1d6', cabinetWall: '#f3f1ec', handle: '#8d9299' });
const DEFAULT_CFG = () => ({ units: 'ft', skin: 'standard', wallMode: 'auto', ceiling: 'auto', snap: true, grid: 0.05, snapWalls: true, snapObjects: true,
  showDims: true, clearance: false, sunTime: 14, night: false, ssao: false, autoQuality: true, roomLabels: true, shadows: true });
let D = { plan: normalizePlan(DEFAULT_PLAN), objects: [], mats: DEFAULT_MATS(), kitchen: { baseUnits: [], wallUnits: [], wallCabHeight: 0.72, wallCabElev: 1.45, wallCabDepth: 0.35 } };
let CFG = DEFAULT_CFG();
let EXTRA = { bookmarks: [], prices: {}, customThemes: [], underlay: null };
const HIST = { undo: [], redo: [], max: 400 };
const listeners = [];
const onChange = fn => listeners.push(fn);
let autosaveTimer = 0;
/* Call BEFORE mutating D. */
function pushUndo() { HIST.undo.push(JSON.stringify(D)); if (HIST.undo.length > HIST.max) HIST.undo.shift(); HIST.redo.length = 0; }
/* Call AFTER mutating D. `what`: {plan, objects, kitchen, mats, ui} flags telling which parts to rebuild. */
function changed(what = { all: 1 }) { listeners.forEach(fn => fn(what)); clearTimeout(autosaveTimer); autosaveTimer = setTimeout(autosave, 700); }
function undo() { if (!HIST.undo.length) return toast('Nothing to undo'); HIST.redo.push(JSON.stringify(D)); D = JSON.parse(HIST.undo.pop()); afterHistory(); }
function redo() { if (!HIST.redo.length) return toast('Nothing to redo'); HIST.undo.push(JSON.stringify(D)); D = JSON.parse(HIST.redo.pop()); afterHistory(); }
function afterHistory() { SEL.ids = SEL.ids.filter(id => D.objects.some(o => o.id === id)); SEL.unit = null; changed({ all: 1 }); }
const SEL = { ids: [], unit: null, hoverRoom: null };       // selected object ids / selected kitchen unit {kind,id}
const roomById = id => D.plan.rooms.find(r => r.id === id);
const wallById = id => D.plan.walls.find(w => w.id === id);
const objById = id => D.objects.find(o => o.id === id);
function roomAt(x, y) { return D.plan.rooms.find(r => pointInPoly(x, y, r.poly)) || null; }
function planBounds() { let pts = []; D.plan.walls.forEach(w => pts.push(w.a, w.b)); D.plan.rooms.forEach(r => pts.push(...r.poly)); return polyBounds(pts.length ? pts : [[0, 0], [1, 1]]); }
