/* ---------- 15. PERSISTENCE: export / import (versioned + validated), autosave, snapshots, GLB, BOM — and app start-up ---------- */
/* Sample furniture following the plan's own furniture layout: [type, x ft, y ft, rotation °, extra] */
const SAMPLE = [
  ['bed_queen', 27.2, 9.1, 0], ['bedside', 23.6, 6.4, 0], ['bedside', 30.3, 6.4, 0], ['wardrobe4', 19.32, 9.4, 90], ['tvunit', 26.9, 15.97, 180, { w: 1.5 }], ['fan', 25.5, 11.3, 0],
  ['sofa3', 27.2, 18.66, 0], ['armchair', 21.9, 22.3, 90], ['armchair', 21.9, 25.4, 90], ['coffee', 27.0, 22.6, 0], ['rug', 26.6, 22.6, 0, { w: 2.6, d: 1.8 }], ['tvunit', 26.7, 28.13, 180, { w: 2.2 }], ['tv', 26.7, 28.68, 180],
  ['dining6', 13.9, 24.4, 0], ['pendant', 13.9, 24.4, 0], ['shoerack', 15.2, 14.8, 0], ['plant_tall', 30.0, 27.6, 0], ['fan', 24.5, 23, 0], ['floorlamp', 30.3, 18.0, 0],
  ['bed_single', 1.82, 25.54, 180], ['desk', 4.4, 18.16, 0], ['officechair', 4.2, 20.6, 180], ['bookshelf', 7.72, 26.4, -90], ['fan', 4.25, 23, 0],
  ['bed_queen', 31.1, 36.9, 180], ['bedside', 27.6, 39.6, 180], ['bedside', 34.6, 39.6, 180], ['wardrobe4', 27.2, 30.32, 0], ['dresser', 33.0, 30.07, 0], ['fan', 29.2, 35.2, 0],
  ['bed_queen', 25.9, 53.83, 180], ['bedside', 22.4, 56.55, 180], ['bedside', 29.4, 56.55, 180], ['wardrobe3', 19.32, 52.4, 90], ['fan', 24.7, 51.5, 0],
  ['wc', 21.4, 1.38, 0], ['vanity', 24.5, 1.04, 0], ['shower', 19.82, 1.74, 0], ['wc', 14.3, 44.62, 180], ['vanity', 16.6, 44.95, 180], ['shower', 11.82, 44.26, 0], ['wc', 26.5, 41.96, 0], ['vanity', 24.1, 41.62, 0], ['shower', 28.84, 44.26, 0],
  ['fridge1', 11.43, 39.24, 180], ['ceilinglight', 14.1, 35, 0], ['washer', 7.8, 39.3, 180], ['ceilinglight', 20.33, 37, 0],
  ['outtable', 34.6, 21.6, 0], ['outchair', 34.6, 19.6, 0], ['outchair', 34.6, 23.7, 180], ['planter', 37.05, 26.4, -90], ['outchair', 34.4, 50, 0], ['planter', 37.05, 54.5, -90]
];
function sampleObjects() { return SAMPLE.map(([type, x, y, deg, extra]) => newObject(type, x * FT, y * FT, { rot: normAng(THREE.MathUtils.degToRad(deg)), ...(extra || {}) })).filter(Boolean); }
function resetProject() {
  D = { plan: normalizePlan(DEFAULT_PLAN), objects: [], mats: DEFAULT_MATS(), kitchen: { baseUnits: [], wallUnits: [], wallCabHeight: 0.72, wallCabElev: 1.45, wallCabDepth: 0.35 } };
  D.objects = sampleObjects(); autoFillKitchen({ silent: true }); SEL.ids = []; SEL.unit = null;
}
function projectData(withSnaps = true) {
  return { app: 'apartment-designer', schemaVersion: SCHEMA, savedAt: new Date().toISOString(), plan: D.plan, objects: D.objects, mats: D.mats, kitchen: D.kitchen, settings: CFG, camera: cameraState(),
    bookmarks: EXTRA.bookmarks, prices: EXTRA.prices, customThemes: EXTRA.customThemes, underlay: EXTRA.underlay, ...(withSnaps ? { snapshots: loadSnapshots() } : {}) };
}
function exportProject() { const name = (D.plan.name || 'apartment').replace(/[^\w.-]+/g, '_') + '-design.json'; download(name, JSON.stringify(projectData(), null, 1), 'application/json'); toast('Project exported: ' + name, 'ok'); }
/* Upgrade older files to the current schema. v1 used `items` with rotDeg and a flat `colors` block. */
function migrateProject(p) {
  const v = p.schemaVersion ?? p.version ?? 1; if (v >= SCHEMA) return p; p = clone(p);
  if (p.items && !p.objects) p.objects = p.items.map(i => ({ ...i, rot: i.rot ?? THREE.MathUtils.degToRad(i.rotDeg || 0), z: i.z ?? i.y ?? 0, y: i.elev ?? 0 }));
  if (p.colors && !p.mats) { p.mats = DEFAULT_MATS(); Object.assign(p.mats.roomWall, p.colors.walls || {}); for (const k in (p.colors.floors || {})) { const f = p.colors.floors[k]; p.mats.floor[k] = typeof f === 'string' ? { type: 'vitrified', color: f, tile: 0.6 } : f; } if (p.colors.ceiling) p.mats.ceiling = p.colors.ceiling; }
  if (p.skin && !p.settings) p.settings = { skin: p.skin, units: p.units || 'ft' };
  p.schemaVersion = SCHEMA; p._migratedFrom = v; return p;
}
/* Returns { data, errors[], warnings[] } — errors are fatal and phrased for humans. */
function validateProject(raw) {
  const errors = [], warnings = [], num = v => typeof v === 'number' && isFinite(v), pt = a => Array.isArray(a) && a.length >= 2 && num(a[0]) && num(a[1]);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['This file is not an Apartment Designer project (expected a JSON object).'], warnings };
  if ((raw.schemaVersion ?? raw.version ?? 1) > SCHEMA) return { errors: [`This project was saved by a newer version of the app (schema v${raw.schemaVersion}); this app understands up to v${SCHEMA}.`], warnings };
  let p; try { p = migrateProject(raw); } catch (e) { return { errors: ['Could not upgrade this older project file: ' + e.message], warnings }; }
  if (p._migratedFrom) warnings.push(`Upgraded from schema v${p._migratedFrom} to v${SCHEMA}.`);
  if (!p.plan || typeof p.plan !== 'object') return { errors: ['The file has no floor plan (“plan” section is missing).'], warnings };
  let plan; try { plan = normalizePlan({ rooms: [], walls: [], openings: [], wallHeight: p.plan.units === 'ft' ? 10 : 3.048, ...p.plan }); } catch (e) { return { errors: ['The floor plan section is malformed: ' + e.message], warnings }; }
  if (!Array.isArray(plan.rooms) || !Array.isArray(plan.walls) || !Array.isArray(plan.openings)) return { errors: ['The plan must contain “rooms”, “walls” and “openings” lists.'], warnings };
  plan.rooms = plan.rooms.filter((r, i) => { const ok = r && Array.isArray(r.poly) && r.poly.length >= 3 && r.poly.every(pt); if (!ok) warnings.push(`Room #${i + 1} (${r?.name || 'unnamed'}) has an invalid outline and was skipped.`); else { r.id = r.id || uid('room'); r.name = String(r.name || 'Room'); r.type = FLOOR_BY_ROOM[r.type] ? r.type : 'living'; } return ok; });
  plan.walls = plan.walls.filter((w, i) => { const ok = w && pt(w.a) && pt(w.b); if (!ok) warnings.push(`Wall #${i + 1} has invalid end points and was skipped.`); else { w.id = w.id || uid('w'); w.t = num(w.t) && w.t > 0 ? w.t : 0.15; } return ok; });
  const wid = new Set(plan.walls.map(w => w.id)); plan.openings = plan.openings.filter(o => { const ok = o && wid.has(o.wall) && num(o.at) && num(o.w); if (!ok) warnings.push(`Opening “${o?.name || o?.id || '?'}” refers to a missing wall and was skipped.`); else { o.id = o.id || uid('op'); o.type = o.type === 'window' ? 'window' : 'door'; o.h = num(o.h) ? o.h : 2.1; o.sill = num(o.sill) ? o.sill : 0; } return ok; });
  if (!num(plan.wallHeight) || plan.wallHeight < 1.5 || plan.wallHeight > 8) { warnings.push('Wall height was out of range — reset to 10 ft.'); plan.wallHeight = 3.048; }
  if (plan.kitchen && (!Array.isArray(plan.kitchen.runs) || !Array.isArray(plan.kitchen.fixtures))) { warnings.push('Kitchen counter data was invalid and was dropped.'); delete plan.kitchen; }
  if (!plan.rooms.length && !plan.walls.length) return { errors: ['The floor plan is empty — no valid rooms or walls were found.'], warnings };
  const objects = []; (Array.isArray(p.objects) ? p.objects : []).forEach((o, i) => { if (!o || !num(o.x) || !num(o.z)) return warnings.push(`Item #${i + 1} has no valid position and was skipped.`); let def = LIBMAP[o.type];
    if (!def) { warnings.push(`Unknown item type “${o.type}” was imported as a custom box.`); def = LIBMAP.box; o = { ...o, type: 'box' }; }
    objects.push({ id: o.id || uid('o'), type: o.type, name: String(o.name || def.name), x: o.x, z: o.z, y: num(o.y) ? o.y : def.elev, rot: num(o.rot) ? o.rot : 0, w: num(o.w) && o.w > 0 ? o.w : def.w, d: num(o.d) && o.d > 0 ? o.d : def.d, h: num(o.h) && o.h > 0 ? o.h : def.h, color: typeof o.color === 'string' ? o.color : def.color, locked: !!o.locked, opts: o.opts && typeof o.opts === 'object' ? o.opts : clone(def.o) }); });
  const ids = new Set(); objects.forEach(o => { if (ids.has(o.id)) o.id = uid('o'); ids.add(o.id); });
  const dm = DEFAULT_MATS(), mats = { ...dm, ...(p.mats && typeof p.mats === 'object' ? p.mats : {}) }; for (const k of ['roomWall', 'wallFace', 'floor']) if (!mats[k] || typeof mats[k] !== 'object') mats[k] = {}; if (!mats.counter || !COUNTERS[mats.counter.type]) mats.counter = dm.counter;
  const k0 = { baseUnits: [], wallUnits: [], wallCabHeight: 0.72, wallCabElev: 1.45, wallCabDepth: 0.35 }, kitchen = { ...k0, ...(p.kitchen && typeof p.kitchen === 'object' ? p.kitchen : {}) }; const runIds = new Set((plan.kitchen?.runs || []).map(r => r.id));
  for (const k of ['baseUnits', 'wallUnits']) kitchen[k] = (Array.isArray(kitchen[k]) ? kitchen[k] : []).filter(u => u && runIds.has(u.run) && num(u.at) && num(u.w));
  const settings = { ...DEFAULT_CFG(), ...(p.settings && typeof p.settings === 'object' ? p.settings : {}) }; if (!['lowpoly', 'standard', 'realistic'].includes(settings.skin)) settings.skin = 'standard'; if (!['ft', 'm'].includes(settings.units)) settings.units = 'ft';
  return { errors, warnings, data: { plan, objects, mats, kitchen, settings, camera: p.camera, bookmarks: Array.isArray(p.bookmarks) ? p.bookmarks.filter(b => b && Array.isArray(b.pos)) : [], prices: p.prices && typeof p.prices === 'object' ? p.prices : {},
    customThemes: Array.isArray(p.customThemes) ? p.customThemes : [], underlay: p.underlay && p.underlay.src ? p.underlay : null, snapshots: Array.isArray(p.snapshots) ? p.snapshots : null } };
}
function applyProject(d, { undoable = false, keepView = false } = {}) {
  if (undoable) pushUndo(); stopTransition(); if (PE.on) togglePlanEdit(false);
  D = { plan: d.plan, objects: d.objects, mats: d.mats, kitchen: d.kitchen }; const skinWas = CFG.skin, nightWas = CFG.night; CFG = d.settings; EXTRA = { bookmarks: d.bookmarks, prices: d.prices, customThemes: d.customThemes, underlay: d.underlay }; SEL.ids = []; SEL.unit = null;
  if (d.snapshots && d.snapshots.length) { const have = loadSnapshots(), ids = new Set(have.map(s => s.id)); storeSnapshots([...have, ...d.snapshots.filter(s => s && s.id && s.data && !ids.has(s.id))]); }
  if (VIEW.mode !== '3d' && VIEW.mode !== '2d') { VIEW.mode = '3d'; VIEW.prev = null; controls.enabled = true; cam.fov = 50; cam.updateProjectionMatrix(); syncViewUI(); }
  if (skinWas !== CFG.skin || nightWas !== CFG.night) clearMaterials(); applySkin(); changed({ all: 1 });
  if (!keepView && d.camera && Array.isArray(d.camera.pos) && Array.isArray(d.camera.target)) { if (VIEW.mode === '2d') setViewMode('3d'); cam.position.fromArray(d.camera.pos); controls.target.fromArray(d.camera.target); controls.update(); } invalidate();
}
function importProjectText(text, label = 'Project') {
  let raw; try { raw = JSON.parse(text); } catch (e) { toast('That file is not valid JSON (' + e.message.slice(0, 60) + ').', 'err', 6000); return false; }
  const res = validateProject(raw); if (res.errors.length) { toast('Import failed: ' + res.errors[0], 'err', 7000); return false; }
  applyProject(res.data, { undoable: true }); toast(`${label} loaded — ${res.data.objects.length} items` + (res.warnings.length ? ` · ${res.warnings.length} note(s): ${res.warnings[0]}` : ''), res.warnings.length ? '' : 'ok', res.warnings.length ? 7000 : 2600); if (res.warnings.length) console.info('Import notes:', res.warnings); return true;
}
$('#fileJson').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const fr = new FileReader(); fr.onload = () => importProjectText(String(fr.result), f.name); fr.onerror = () => toast('Could not read the file', 'err'); fr.readAsText(f); });
/* Autosave + restore */
let autosaveOn = true;
function autosave() { if (!autosaveOn) return; try { const d = projectData(false); if (d.underlay && d.underlay.src.length > 1.5e6) d.underlay = null; localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) { console.warn('Autosave failed', e); } }
function offerRestore() {
  let txt = null; try { txt = localStorage.getItem(LS_KEY); } catch (e) { } if (!txt) return; let when = ''; try { when = new Date(JSON.parse(txt).savedAt).toLocaleString(); } catch (e) { return; }
  autosaveOn = false; const bar = el('div', { id: 'restoreBar', style: 'position:absolute;top:12px;left:50%;transform:translateX(-50%);background:#1d2330;color:#fff;border-radius:22px;padding:7px 8px 7px 16px;display:flex;gap:8px;align-items:center;z-index:7;white-space:nowrap' }, 'Restore last session (' + when + ')?');
  const close = () => { bar.remove(); autosaveOn = true; };
  bar.append(el('button', { class: 'btn sm pri', id: 'btnRestore', onclick: () => { close(); HIST.undo.length = 0; if (importProjectText(txt, 'Last session')) { HIST.undo.length = 0; refreshUI({ all: 1 }); } } }, 'Restore'), el('button', { class: 'btn sm', style: 'color:#1d2330', onclick: () => { close(); autosave(); } }, 'Start fresh'));
  viewEl.append(bar); onChange(w => { if (!autosaveOn && bar.isConnected && (w.objects || w.plan || w.kitchen || w.all)) close(); });
}
/* Named snapshots (design options) */
function loadSnapshots() { try { const s = JSON.parse(localStorage.getItem(LS_SNAP) || '[]'); return Array.isArray(s) ? s : []; } catch (e) { return []; } }
function storeSnapshots(list) { try { localStorage.setItem(LS_SNAP, JSON.stringify(list)); return true; } catch (e) { toast('Browser storage is full — snapshot not saved', 'err'); return false; } }
function saveSnapshot(name) { const list = loadSnapshots(); list.push({ id: uid('snap'), name: name || 'Option ' + String.fromCharCode(65 + list.length % 26), savedAt: new Date().toISOString(), count: D.objects.length, data: clone(D) }); if (storeSnapshots(list)) { toast('Snapshot saved', 'ok'); renderProject(); } }
function loadSnapshot(id) { const s = loadSnapshots().find(q => q.id === id); if (!s) return; const res = validateProject({ schemaVersion: SCHEMA, ...s.data, settings: CFG }); if (res.errors.length) return toast('Snapshot is damaged: ' + res.errors[0], 'err');
  pushUndo(); D = { plan: res.data.plan, objects: res.data.objects, mats: res.data.mats, kitchen: res.data.kitchen }; SEL.ids = []; SEL.unit = null; changed({ all: 1 }); toast('Loaded “' + s.name + '” (Ctrl+Z to go back)', 'ok'); }
function deleteSnapshot(id) { storeSnapshots(loadSnapshots().filter(s => s.id !== id)); renderProject(); }
/* glTF binary export of the visible model */
function exportGLB() {
  const vis = WALLINFO.map(w => [w.full.visible, w.low.visible]), cv = G.ceilings.visible; WALLINFO.forEach(w => { w.full.visible = true; w.low.visible = false; }); G.ceilings.visible = false; toast('Building GLB…');
  const done = () => { WALLINFO.forEach((w, i) => { w.full.visible = vis[i][0]; w.low.visible = vis[i][1]; }); G.ceilings.visible = cv; invalidate(); };
  try { new GLTFExporter().parse(world, buf => { done(); download('apartment-model.glb', new Blob([buf], { type: 'model/gltf-binary' })); toast('GLB exported', 'ok'); }, err => { done(); toast('GLB export failed: ' + (err?.message || err), 'err'); }, { binary: true, onlyVisible: true }); }
  catch (e) { done(); toast('GLB export failed: ' + e.message, 'err'); }
}
/* Furniture list / bill of materials */
function bomRows() {
  const rows = D.objects.map(o => ({ key: o.id, room: objRoomName(o), name: o.name, cat: defOf(o).cat, w: o.w, d: o.d, h: o.h }));
  const K = D.plan.kitchen, kr = roomById(K?.roomId)?.name || 'Kitchen'; if (K) { for (const u of D.kitchen.baseUnits) rows.push({ key: u.id, room: kr, name: 'Base cabinet — ' + BASE_STYLES[u.style], cat: 'Kitchen', w: u.w, d: (kRun(u.run)?.depth || 0.6) - 0.02, h: u.style === 'tall' ? 2.1 : K.counterHeight - K.counterThickness });
    for (const u of D.kitchen.wallUnits) rows.push({ key: u.id, room: kr, name: 'Wall cabinet — ' + WALL_STYLES[u.style], cat: 'Kitchen', w: u.w, d: D.kitchen.wallCabDepth, h: D.kitchen.wallCabHeight });
    for (const r of K.runs) rows.push({ key: 'ct_' + r.id, room: kr, name: `Countertop (${D.mats.counter.type}) — ${r.id} run`, cat: 'Kitchen', w: runGeom(r).L, d: r.depth, h: K.counterThickness }); }
  return rows.sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
}
function openBOM() {
  const rows = bomRows(), body = $('#bomBody'); body.innerHTML = ''; const tot = el('b', {}), sum = () => { tot.textContent = 'Total: ' + rows.reduce((a, r) => a + (+EXTRA.prices[r.key] || 0), 0).toLocaleString(); };
  let last = null; const tb = el('tbody'); for (const r of rows) { if (r.room !== last) { last = r.room; tb.append(el('tr', {}, el('th', { colspan: 5, style: 'background:#f3f5f9' }, r.room + ' — ' + rows.filter(q => q.room === r.room).length + ' items'))); }
    tb.append(el('tr', {}, el('td', {}, r.name), el('td', {}, r.cat), el('td', {}, `${fmtLen(r.w)} × ${fmtLen(r.d)} × ${fmtLen(r.h)}`), el('td', {}, `${Math.round(r.w * 1000)} × ${Math.round(r.d * 1000)} × ${Math.round(r.h * 1000)}`),
      el('td', {}, el('input', { type: 'number', min: 0, step: 100, value: EXTRA.prices[r.key] ?? '', placeholder: '0', oninput: e => { const v = parseFloat(e.target.value); if (v > 0) EXTRA.prices[r.key] = v; else delete EXTRA.prices[r.key]; sum(); clearTimeout(autosaveTimer); autosaveTimer = setTimeout(autosave, 700); } })))); }
  body.append(rows.length ? el('table', { class: 'bom' }, el('thead', {}, el('tr', {}, ['Item', 'Category', 'W × D × H', 'mm', 'Price'].map(h => el('th', {}, h)))), tb) : el('div', { class: 'hint' }, 'No items placed yet.'), el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:8px' }, tot)); sum(); $('#bomModal').classList.add('on');
}
$('#btnBomCsv').onclick = () => { const q = s => '"' + String(s).replace(/"/g, '""') + '"', rows = bomRows(), lines = [['Room', 'Item', 'Category', 'Width (mm)', 'Depth (mm)', 'Height (mm)', 'Size', 'Price'].map(q).join(',')]; let t = 0;
  rows.forEach(r => { const pr = +EXTRA.prices[r.key] || 0; t += pr; lines.push([r.room, r.name, r.cat, Math.round(r.w * 1000), Math.round(r.d * 1000), Math.round(r.h * 1000), `${fmtLen(r.w)} x ${fmtLen(r.d)} x ${fmtLen(r.h)}`, pr || ''].map(q).join(',')); }); lines.push(['', 'TOTAL', '', '', '', '', '', t].map(q).join(','));
  download('furniture-list.csv', lines.join('\r\n'), 'text/csv'); toast('CSV exported', 'ok'); };

/* ---------- START-UP ---------- */
onChange(w => {
  if (w.all || w.plan) buildPlan(); if (w.all || w.plan || w.kitchen) buildKitchen(); if (w.all || w.plan || w.objects) buildObjects(); else if (w.all || w.ui) updateSelectionVisuals();
  if (PE.on) peRedraw(); if (w.all || w.ui || w.plan) updateRoomLabels(); if (w.all || w.objects) updateNightLights(); refreshUI(w); invalidate();
});
resetProject(); resize(); applySkin(); changed({ all: 1 }); renderLibrary();
{ const b = planBounds(), R = Math.max(b.w, b.h); cam.position.set(b.cx + R * 0.55, R * 0.95, b.cy + R * 0.8); controls.target.set(b.cx, 0, b.cy); controls.update(); }
setStatus(defaultStatus()); requestAnimationFrame(loop); offerRestore();
try { if (!localStorage.getItem('aptDesigner.tourDone')) setTimeout(() => tourShow(0), 900); } catch (e) { }
window.addEventListener('error', e => console.error('App error:', e.message));
/* Small debugging / automation surface */
window.APP = { get D() { return D; }, get CFG() { return CFG; }, get VIEW() { return VIEW; }, get SEL() { return SEL; }, get EXTRA() { return EXTRA; }, HIST, LIB, THREE, cam, controls, G, WARN, QUAL,
  placeObject, selectObjects, deleteSelected, duplicateSelected, rotateSelected, setObjProp, undo, redo, setSkin, setViewMode, frameRoom, enterImmersive, exitImmersive, projectData, importProjectText, validateProject, exportProject,
  autoFillKitchen, selectUnit, setUnitProp, togglePlanEdit, setTool, applyTheme, THEMES, saveSnapshot, loadSnapshots, loadSnapshot, exportGLB, openBOM, screenshot, setNight, resetProject, changed, pushUndo, w2s, objById, roomAt, makeObjectGroup, setMat, toggleUnits, fmtLen, parseLen };
