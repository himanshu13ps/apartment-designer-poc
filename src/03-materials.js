/* ---------- 4. MATERIALS, PROCEDURAL TEXTURES, SKINS, PALETTES, THEMES ---------- */
const PAINTS = [['Soft White', '#f4f1ea'], ['Ivory', '#f1ede4'], ['Cream', '#efe4cf'], ['Warm Beige', '#dccdb4'], ['Greige', '#c9c2b6'], ['Dove Grey', '#bfc3c7'],
  ['Slate', '#6f7a86'], ['Charcoal', '#3d4249'], ['Sage', '#a9b8a0'], ['Olive', '#7d8461'], ['Teal', '#3f7f85'], ['Sky', '#bcd7e6'], ['Navy', '#2e3f5c'],
  ['Blush', '#e8c9c1'], ['Terracotta', '#c2714f'], ['Mustard', '#d6a53c'], ['Peach', '#f2c9a5'], ['Lavender', '#c9c2df'], ['Mint', '#cfe6d8'], ['Wine', '#7a3340']];
const FLOOR_TYPES = { vitrified: { name: 'Vitrified tile', tile: 0.8, color: '#e9e3d6' }, laminate: { name: 'Wooden laminate', tile: 1.2, color: '#b98d5f' }, marble: { name: 'Marble', tile: 0.9, color: '#f0ece6' },
  stone: { name: 'Stone', tile: 0.45, color: '#a39d92' }, antiskid: { name: 'Anti-skid bath tile', tile: 0.3, color: '#9fb0b5' } };
const FLOOR_BY_ROOM = { living: { type: 'vitrified', color: '#e9e3d6', tile: 0.8 }, passage: { type: 'vitrified', color: '#e9e3d6', tile: 0.8 }, bedroom: { type: 'laminate', color: '#b98d5f', tile: 1.2 },
  study: { type: 'laminate', color: '#a98058', tile: 1.2 }, kitchen: { type: 'vitrified', color: '#d9d6cf', tile: 0.6 }, bath: { type: 'antiskid', color: '#9fb0b5', tile: 0.3 }, balcony: { type: 'stone', color: '#a39d92', tile: 0.45 } };
const COUNTERS = { granite: { name: 'Granite', color: '#2b2b2e' }, quartz: { name: 'Quartz', color: '#e9e7e2' }, marble: { name: 'Marble', color: '#f0ece6' }, wood: { name: 'Wood', color: '#9a6b3f' } };
const THEMES = [
  { name: 'Warm Modern', wall: '#efe4cf', accent: '#c2714f', ceiling: '#fbf8f2', door: '#7b5a3c', frame: '#3d3a36', cabinet: '#d9c7a8', cabinetWall: '#f3ede0', counter: { type: 'granite', color: '#2b2b2e' },
    floors: { living: { type: 'vitrified', color: '#e6dccb', tile: 0.8 }, bedroom: { type: 'laminate', color: '#a8744a', tile: 1.2 }, study: { type: 'laminate', color: '#a8744a', tile: 1.2 }, kitchen: { type: 'vitrified', color: '#d8cfc0', tile: 0.6 } } },
  { name: 'Scandinavian', wall: '#f4f1ea', accent: '#a9b8a0', ceiling: '#ffffff', door: '#d9c3a1', frame: '#ffffff', cabinet: '#f1f1ee', cabinetWall: '#ffffff', counter: { type: 'wood', color: '#c79b6a' },
    floors: { living: { type: 'laminate', color: '#d8bd95', tile: 1.2 }, bedroom: { type: 'laminate', color: '#d8bd95', tile: 1.2 }, study: { type: 'laminate', color: '#d8bd95', tile: 1.2 }, kitchen: { type: 'vitrified', color: '#eceae5', tile: 0.6 } } },
  { name: 'Classic', wall: '#e9dfc9', accent: '#7a3340', ceiling: '#faf6ec', door: '#5a3a25', frame: '#5a3a25', cabinet: '#6b4a30', cabinetWall: '#7a573a', counter: { type: 'marble', color: '#f0ece6' },
    floors: { living: { type: 'marble', color: '#f0ece6', tile: 0.9 }, bedroom: { type: 'laminate', color: '#7d5233', tile: 1.2 }, study: { type: 'laminate', color: '#7d5233', tile: 1.2 }, kitchen: { type: 'marble', color: '#e7e2d8', tile: 0.6 } } },
  { name: 'Cool Minimal', wall: '#eceef0', accent: '#2e3f5c', ceiling: '#ffffff', door: '#f1f1f1', frame: '#2a2d33', cabinet: '#3d4249', cabinetWall: '#eceef0', counter: { type: 'quartz', color: '#e9e7e2' },
    floors: { living: { type: 'vitrified', color: '#d5d7d9', tile: 1.2 }, bedroom: { type: 'vitrified', color: '#d5d7d9', tile: 1.2 }, study: { type: 'vitrified', color: '#d5d7d9', tile: 1.2 }, kitchen: { type: 'vitrified', color: '#c3c6c9', tile: 0.6 } } }
];
function floorSpec(room) { return D.mats.floor[room.id] || FLOOR_BY_ROOM[room.type] || FLOOR_BY_ROOM.living; }
function applyTheme(t) {
  pushUndo(); const m = D.mats; m.roomWall = {}; m.wallFace = {}; m.floor = {};
  m.wallDefault = t.wall; m.ceiling = t.ceiling; m.door = t.door; m.frame = t.frame; m.cabinet = t.cabinet; m.cabinetWall = t.cabinetWall; m.counter = clone(t.counter);
  D.plan.rooms.forEach(r => { const f = t.floors[r.type] || (r.type === 'passage' ? t.floors.living : null); if (f) m.floor[r.id] = clone(f); });
  if (t.wallFace) m.wallFace = clone(t.wallFace); if (t.roomWall) m.roomWall = clone(t.roomWall);
  D.kitchen.baseUnits.forEach(u => delete u.color); D.kitchen.wallUnits.forEach(u => delete u.color);
  changed({ plan: 1, kitchen: 1, ui: 1 }); toast('Theme applied: ' + t.name, 'ok');
}
function themeFromCurrent(name) { const m = D.mats, floors = {}; D.plan.rooms.forEach(r => floors[r.type] = clone(floorSpec(r)));
  return { name, wall: m.wallDefault, ceiling: m.ceiling, door: m.door, frame: m.frame, cabinet: m.cabinet, cabinetWall: m.cabinetWall, counter: clone(m.counter), floors, roomWall: clone(m.roomWall), wallFace: clone(m.wallFace) }; }

/* Procedural canvas textures. All are near-white "detail" maps that get multiplied by material.color. */
const TEX = {};
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296); }
function makeTex(key, size, draw) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size, rng(key.length * 7919 + 13));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return TEX[key] = t;
}
const grey = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
const TEXGEN = {
  wood: () => makeTex('wood', 256, (g, s, r) => { g.fillStyle = grey(232); g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { g.strokeStyle = grey(150 + r() * 80, 0.25 + r() * 0.3); g.lineWidth = 0.6 + r() * 1.6; const y = r() * s, a = (r() - 0.5) * 8; g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + a, s * 0.6, y - a, s, y + (r() - 0.5) * 4); g.stroke(); } }),
  laminate: () => makeTex('laminate', 512, (g, s, r) => { const rows = 4, ph = s / rows;
    for (let j = 0; j < rows; j++) { const off = (j % 2) * s * 0.4 + r() * 40; for (let k = -1; k < 2; k++) { const v = 205 + r() * 45; g.fillStyle = grey(v); g.fillRect(off + k * s * 0.8 - s * 0.3, j * ph, s * 0.8, ph);
        g.strokeStyle = grey(120, 0.55); g.lineWidth = 1.5; g.strokeRect(off + k * s * 0.8 - s * 0.3, j * ph, s * 0.8, ph); }
      for (let i = 0; i < 26; i++) { g.strokeStyle = grey(140 + r() * 60, 0.22); g.lineWidth = 0.5 + r(); const y = j * ph + r() * ph; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + (r() - 0.5) * 5); g.stroke(); } } }),
  tile: () => makeTex('tile', 256, (g, s, r) => { g.fillStyle = grey(246); g.fillRect(0, 0, s, s); for (let i = 0; i < 500; i++) { g.fillStyle = grey(225 + r() * 30, 0.35); g.fillRect(r() * s, r() * s, 2, 2); }
    g.strokeStyle = grey(150); g.lineWidth = 4; g.strokeRect(0, 0, s, s); }),
  marble: () => makeTex('marble', 512, (g, s, r) => { g.fillStyle = grey(248); g.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) { g.strokeStyle = grey(130 + r() * 70, 0.12 + r() * 0.22); g.lineWidth = 0.5 + r() * 2.4; let x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 9; k++) { x += (r() - 0.3) * 90; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = grey(170, 0.8); g.lineWidth = 2; g.strokeRect(0, 0, s, s); }),
  granite: () => makeTex('granite', 256, (g, s, r) => { g.fillStyle = grey(205); g.fillRect(0, 0, s, s); for (let i = 0; i < 5200; i++) { const v = r(); g.fillStyle = v > 0.7 ? grey(255, 0.8) : grey(90 + r() * 100, 0.6); g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2); } }),
  quartz: () => makeTex('quartz', 256, (g, s, r) => { g.fillStyle = grey(248); g.fillRect(0, 0, s, s); for (let i = 0; i < 1500; i++) { g.fillStyle = grey(190 + r() * 50, 0.5); g.fillRect(r() * s, r() * s, 1.5, 1.5); } }),
  stone: () => makeTex('stone', 256, (g, s, r) => { g.fillStyle = grey(232); g.fillRect(0, 0, s, s); for (let i = 0; i < 2600; i++) { g.fillStyle = grey(170 + r() * 80, 0.4); g.fillRect(r() * s, r() * s, 2 + r() * 3, 2 + r() * 3); }
    g.strokeStyle = grey(110); g.lineWidth = 5; g.strokeRect(0, 0, s, s); }),
  antiskid: () => makeTex('antiskid', 128, (g, s, r) => { g.fillStyle = grey(240); g.fillRect(0, 0, s, s); for (let y = 8; y < s; y += 16) for (let x = 8; x < s; x += 16) { g.fillStyle = grey(205); g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    g.strokeStyle = grey(140); g.lineWidth = 4; g.strokeRect(0, 0, s, s); }),
  fabric: () => makeTex('fabric', 128, (g, s, r) => { g.fillStyle = grey(236); g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 2) for (let x = 0; x < s; x += 2) { g.fillStyle = grey(205 + r() * 50, 0.55); g.fillRect(x, y, 1, 1); } })
};
const MATDEF = { // kind → [roughness, metalness, texture key, repeat]
  paint: [0.92, 0], wood: [0.58, 0, 'wood', 1], fabric: [0.96, 0, 'fabric', 4], leather: [0.5, 0], rug: [1, 0, 'fabric', 6], metal: [0.38, 0.85], chrome: [0.14, 1], plastic: [0.5, 0],
  ceramic: [0.18, 0], marble: [0.22, 0, 'marble', 1], granite: [0.28, 0.05, 'granite', 2], quartz: [0.3, 0, 'quartz', 2], glass: [0.05, 0], mirror: [0.03, 1], leaf: [0.8, 0], screen: [0.2, 0.2], emissive: [0.6, 0], water: [0.05, 0]
};
const MATS = new Map();
function clearMaterials() { MATS.forEach(m => m.dispose()); MATS.clear(); }
/* Material factory — the single place where the three skins differ. */
function M(kind, color = '#ffffff', opt = {}) {
  const skin = CFG.skin, key = skin + '|' + kind + '|' + color + '|' + (opt.rep || '') + (opt.side || '') + (opt.on ? 1 : 0);
  let m = MATS.get(key); if (m) return m;
  const d = MATDEF[kind] || MATDEF.paint, transparent = kind === 'glass' || kind === 'water';
  if (skin === 'lowpoly') { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); }
  else { m = new THREE.MeshStandardMaterial({ color, roughness: d[0], metalness: skin === 'realistic' ? d[1] : d[1] * 0.5 });
    if (skin === 'realistic' && d[2]) { const t = TEXGEN[d[2]]().clone(); t.needsUpdate = true; const rp = opt.rep || d[3] || 1; t.repeat.set(rp, rp); m.map = t; }
    if (skin === 'realistic') m.envMapIntensity = kind === 'paint' ? 0.35 : 0.9; }
  if (transparent) { m.transparent = true; m.opacity = kind === 'glass' ? 0.22 : 0.55; m.depthWrite = false; if (m.roughness !== undefined) m.roughness = 0.05; }
  if (kind === 'emissive') { m.emissive = new THREE.Color(color); m.emissiveIntensity = opt.on ? 1.6 : 0.25; }
  if (kind === 'screen') { m.emissive = new THREE.Color('#0b1622'); m.emissiveIntensity = 0.6; }
  if (opt.side) m.side = THREE.DoubleSide;
  MATS.set(key, m); return m;
}
/* Floor material: world-space UVs (1 unit = 1 m), so repeat = 1 / tile size. */
function floorMaterial(spec) {
  const skin = CFG.skin, key = 'floor|' + skin + '|' + spec.type + '|' + spec.color + '|' + spec.tile; let m = MATS.get(key); if (m) return m;
  if (skin === 'lowpoly') m = new THREE.MeshLambertMaterial({ color: spec.color, flatShading: true });
  else { const rough = { vitrified: 0.25, laminate: 0.55, marble: 0.15, stone: 0.85, antiskid: 0.7 }[spec.type] ?? 0.5;
    const gen = { vitrified: 'tile', laminate: 'laminate', marble: 'marble', stone: 'stone', antiskid: 'antiskid' }[spec.type] || 'tile';
    const t = TEXGEN[gen]().clone(); t.needsUpdate = true; const ts = Math.max(0.1, spec.tile || 0.6);
    if (spec.type === 'laminate') t.repeat.set(1 / (ts * 1.25), 1 / (ts * 0.6)); else t.repeat.set(1 / ts, 1 / ts);
    m = new THREE.MeshStandardMaterial({ color: spec.color, roughness: skin === 'realistic' ? rough : Math.max(rough, 0.5), map: t }); if (skin === 'realistic') m.envMapIntensity = 0.7; }
  MATS.set(key, m); return m;
}
const SEG = n => CFG.skin === 'lowpoly' ? Math.max(6, Math.round(n / 3)) : n;   // radial segments per skin
