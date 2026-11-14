/* ---------- 14. UI — Kitchen tool, Materials/Colours, View, Project tabs, toolbar, help, onboarding tour ---------- */
const UIS = { matRoom: null, kPref: 0.6, kOpen: false, kRun: null };
const setMat = (fn, what = { plan: 1, kitchen: 1, ui: 1 }) => { pushUndo(); fn(D.mats); changed(what); };
const selectEl = (val, opts, on, attrs = {}) => el('select', { ...attrs, onchange: e => on(e.target.value) }, opts.map(([v, t]) => el('option', { value: v, selected: String(v) === String(val) }, t)));
function renderKitchenTool(p) {
  const K = D.plan.kitchen; if (!K || !K.runs.length) return; const KU = D.kitchen, m = D.mats; if (!kRun(UIS.kRun)) UIS.kRun = K.runs[0].id;
  p.append(el('h3', {}, 'Kitchen cabinets'), el('div', { class: 'card', id: 'kitchenTool' },
    row('Countertop', selectEl(m.counter.type, Object.entries(COUNTERS).map(([k, v]) => [k, v.name]), v => setMat(q => q.counter = { type: v, color: COUNTERS[v].color })), el('input', { type: 'color', value: m.counter.color, onchange: e => setMat(q => q.counter.color = e.target.value) })),
    row('Counter height', lenInput(K.counterHeight, v => { pushUndo(); K.counterHeight = r3(clamp(v, 0.6, 1.1)); changed({ kitchen: 1, ui: 1 }); })),
    row('Module width', selectEl(UIS.kPref, CAB_WIDTHS.map(w => [w, Math.round(w * 1000) + ' mm']), v => { UIS.kPref = +v; }), el('label', { style: 'flex:none' }, el('input', { type: 'checkbox', checked: UIS.kOpen, onchange: e => UIS.kOpen = e.target.checked }), ' open shelves')),
    el('div', { class: 'row wrap' }, btn('Auto-fill base', () => autoFillKitchen({ base: true, wall: false, pref: UIS.kPref }), 'pri', 'Fill base cabinets under every counter run'), btn('Auto-fill wall', () => autoFillKitchen({ base: false, wall: true, pref: UIS.kPref, openShelf: UIS.kOpen })), btn('Both', () => autoFillKitchen({ pref: UIS.kPref, openShelf: UIS.kOpen })), btn('Clear', () => clearKitchen(), 'danger')),
    row('Wall cab. height', lenInput(KU.wallCabHeight, v => { pushUndo(); KU.wallCabHeight = r3(clamp(v, 0.3, 1.2)); changed({ kitchen: 1, ui: 1 }); })), row('Wall cab. bottom', lenInput(KU.wallCabElev, v => { pushUndo(); KU.wallCabElev = r3(clamp(v, 1.1, 2.2)); changed({ kitchen: 1, ui: 1 }); })),
    row('Base colour', el('input', { type: 'color', value: m.cabinet, onchange: e => setMat(q => q.cabinet = e.target.value) }), el('label', { style: 'flex:none' }, 'Wall'), el('input', { type: 'color', value: m.cabinetWall, onchange: e => setMat(q => q.cabinetWall = e.target.value) })),
    row('Add to run', selectEl(UIS.kRun, K.runs.map(r => [r.id, r.id + ' · ' + fmtLen(runGeom(r).L)]), v => { UIS.kRun = v; })), el('div', { class: 'row wrap' }, btn('+ Base unit', () => addUnit('base', UIS.kRun, UIS.kPref)), btn('+ Wall unit', () => addUnit('wall', UIS.kRun, UIS.kPref)), btn('+ Sink', () => addFixture('sink', UIS.kRun)), btn('+ Hob', () => addFixture('hob', UIS.kRun))),
    el('div', { class: 'hint' }, `${KU.baseUnits.length} base · ${KU.wallUnits.length} wall units · ${K.fixtures.length} cut-outs. Click any unit in the view to resize, swap or recolour it.`)));
}
function renderMats() {
  const p = $('#tab-mats'), m = D.mats; p.innerHTML = ''; if (!roomById(UIS.matRoom)) UIS.matRoom = D.plan.rooms[0]?.id; const r = roomById(UIS.matRoom);
  p.append(el('h3', {}, 'Themes (whole apartment)'), el('div', { class: 'row wrap' }, [...THEMES, ...EXTRA.customThemes].map((t, i) => el('span', { style: 'display:inline-flex;gap:2px' }, btn(t.name, () => applyTheme(t), '', 'Apply theme'), i >= THEMES.length ? btn('✕', () => { EXTRA.customThemes.splice(i - THEMES.length, 1); changed({ ui: 1 }); }) : null))),
    el('div', { class: 'row' }, btn('＋ Save current look as theme', () => { const n = prompt('Theme name', 'My theme ' + (EXTRA.customThemes.length + 1)); if (n) { EXTRA.customThemes.push(themeFromCurrent(n.slice(0, 30))); changed({ ui: 1 }); toast('Theme saved', 'ok'); } })));
  if (!r) return;
  const fs = floorSpec(r), paintedHere = Object.keys(m.wallFace).filter(k => k.endsWith('|' + r.id)).length;
  p.append(el('h3', {}, 'Room'), row('Room', selectEl(r.id, D.plan.rooms.map(q => [q.id, q.name]), v => { UIS.matRoom = v; renderMats(); highlightRoom(v); setTimeout(() => highlightRoom(null), 900); })),
    colorRow('Wall colour', m.roomWall[r.id] || (r.outdoor ? m.exterior : m.wallDefault), c => setMat(q => q.roomWall[r.id] = c)),
    el('div', { class: 'row wrap' }, btn('Apply to all rooms', () => setMat(q => { q.wallDefault = q.roomWall[r.id] || q.wallDefault; q.roomWall = {}; })), btn('Reset room', () => setMat(q => { delete q.roomWall[r.id]; }))),
    el('h3', {}, 'Accent wall / single wall'), row('Paint colour', el('input', { type: 'color', value: TOOL.paintColor, onchange: e => { TOOL.paintColor = e.target.value; renderMats(); } }), btn(TOOL.name === 'paint' ? '✓ Painting — Esc to stop' : '🖌 Click a wall to paint', () => setTool(TOOL.name === 'paint' ? 'select' : 'paint'), TOOL.name === 'paint' ? 'on' : '')),
    el('div', { class: 'swatches' }, PAINTS.map(c => el('div', { class: 'sw', style: 'background:' + c[1], title: c[0], onclick: () => { TOOL.paintColor = c[1]; if (TOOL.name !== 'paint') setTool('paint'); renderMats(); } }))),
    el('div', { class: 'row' }, btn(`Clear painted walls in this room (${paintedHere})`, () => setMat(q => { for (const k of Object.keys(q.wallFace)) if (k.endsWith('|' + r.id)) delete q.wallFace[k]; }))),
    el('h3', {}, 'Floor — ' + r.name), row('Material', selectEl(fs.type, Object.entries(FLOOR_TYPES).map(([k, v]) => [k, v.name]), v => setMat(q => q.floor[r.id] = { type: v, color: FLOOR_TYPES[v].color, tile: FLOOR_TYPES[v].tile }))),
    row(fs.type === 'laminate' ? 'Plank length' : 'Tile size', selectEl(fs.tile, [...new Set([0.3, 0.45, 0.6, 0.8, 0.9, 1.2, fs.tile])].sort((a, b) => a - b).map(v => [v, Math.round(v * 1000) + ' mm' + (CFG.units === 'ft' ? ' (' + fmtLen(v) + ')' : '')]), v => setMat(q => q.floor[r.id] = { ...fs, tile: +v }))),
    colorRow('Colour / tint', fs.color, c => setMat(q => q.floor[r.id] = { ...fs, color: c }), ['#f0ece6', '#e9e3d6', '#d9d6cf', '#c3c6c9', '#9fb0b5', '#a39d92', '#d8bd95', '#b98d5f', '#a8744a', '#7d5233', '#4a3a2c', '#3d4249']),
    el('div', { class: 'row' }, btn('Use this floor in all rooms of this type', () => setMat(q => D.plan.rooms.filter(x => x.type === r.type).forEach(x => q.floor[x.id] = clone(fs))))),
    el('h3', {}, 'Ceiling, doors, frames'), row('Ceiling', el('input', { type: 'color', value: m.ceiling, onchange: e => setMat(q => q.ceiling = e.target.value) }), el('label', { style: 'flex:none' }, 'Exterior'), el('input', { type: 'color', value: m.exterior, onchange: e => setMat(q => q.exterior = e.target.value) })),
    row('Doors', el('input', { type: 'color', value: m.door, onchange: e => setMat(q => q.door = e.target.value) }), el('label', { style: 'flex:none' }, 'Frames'), el('input', { type: 'color', value: m.frame, onchange: e => setMat(q => q.frame = e.target.value) })),
    el('div', { class: 'hint' }, 'Countertop and cabinet finishes are in Properties → Kitchen cabinets. Each placed item has its own colour in Properties.'));
}
function renderView() {
  const p = $('#tab-view'); p.innerHTML = ''; const chk = (label, key, after) => el('label', { class: 'row', style: 'cursor:pointer' }, el('input', { type: 'checkbox', checked: CFG[key], onchange: e => { CFG[key] = e.target.checked; after && after(); changed({ ui: 1 }); } }), label);
  const hh = h => { const H = Math.floor(h), mm = Math.round((h - H) * 60); return (H % 12 || 12) + ':' + String(mm).padStart(2, '0') + (H < 12 ? ' am' : ' pm'); }, tl = el('span', { style: 'flex:0 0 62px;text-align:right' }, hh(CFG.sunTime));
  p.append(el('h3', {}, 'Render skin'), el('div', { class: 'seg', style: 'display:flex' }, [['lowpoly', 'Low poly'], ['standard', 'Standard'], ['realistic', 'Realistic']].map(([v, t]) => el('button', { class: CFG.skin === v ? 'on' : '', style: 'flex:1', onclick: () => setSkin(v) }, t))),
    chk('Shadows', 'shadows', applySkin), chk('Ambient occlusion (SSAO, Realistic skin)', 'ssao', applySkin), chk('Lower quality automatically if the frame rate drops', 'autoQuality'),
    el('h3', {}, 'Lighting'), el('div', { class: 'row' }, el('label', {}, 'Time of day'), el('input', { type: 'range', id: 'sunSlider', min: 6, max: 19, step: 0.25, value: CFG.sunTime, oninput: e => { CFG.sunTime = +e.target.value; tl.textContent = hh(CFG.sunTime); updateSun(); } }), tl),
    el('div', { class: 'row' }, el('label', {}, 'Day / night'), el('div', { class: 'seg' }, el('button', { class: CFG.night ? '' : 'on', onclick: () => setNight(false) }, '☀ Day'), el('button', { class: CFG.night ? 'on' : '', id: 'btnNight', onclick: () => setNight(true) }, '🌙 Night'))),
    el('div', { class: 'hint' }, 'Night switches on placed lamps, ceiling/pendant lights and coves. Enter a room to see sunlight coming through the windows.'),
    el('h3', {}, 'Walls & ceiling'), row('Walls', selectEl(CFG.wallMode, [['auto', 'Dollhouse (auto cut-away)'], ['full', 'Full height'], ['low', 'Low walls']], v => setWallMode(v))), row('Ceiling', selectEl(CFG.ceiling, [['auto', 'Auto (hidden from above)'], ['show', 'Always show'], ['hide', 'Always hidden']], v => { CFG.ceiling = v; updateWallVisibility(true); changed({ ui: 1 }); })),
    row('Wall height', lenInput(D.plan.wallHeight, v => { pushUndo(); D.plan.wallHeight = r3(clamp(v, 2.2, 4.5)); changed({ all: 1 }); })), chk('Room name labels in 3D', 'roomLabels', updateRoomLabels),
    row('Units', el('div', { class: 'seg' }, el('button', { class: CFG.units === 'ft' ? 'on' : '', onclick: () => CFG.units !== 'ft' && toggleUnits() }, 'Feet-inches'), el('button', { class: CFG.units === 'm' ? 'on' : '', onclick: () => CFG.units !== 'm' && toggleUnits() }, 'Metric'))),
    el('h3', {}, 'Camera bookmarks'), el('div', { class: 'row' }, el('input', { type: 'text', id: 'bmName', placeholder: 'Viewpoint name', style: 'flex:1' }), btn('＋ Save view', () => saveBookmark($('#bmName').value.trim()), 'pri')),
    EXTRA.bookmarks.map(b => el('div', { class: 'roomitem', onclick: () => gotoBookmark(b.id) }, el('span', { class: 'nm' }, (b.fp ? '👁 ' : '🎥 ') + b.name), el('button', { class: 'btn sm', onclick: e => { e.stopPropagation(); deleteBookmark(b.id); } }, '✕'))),
    EXTRA.bookmarks.length ? null : el('div', { class: 'hint' }, 'Save the current camera position to come back to it later (works in 3D, immersive and walk views).'),
    el('h3', {}, 'Floor plan'), el('div', { class: 'row wrap' }, btn('✎ Plan edit mode', () => togglePlanEdit(true)), btn('ⓘ Plan assumptions', () => toggleAssumptions()), btn('Reset camera', () => resetView())));
}
function setNight(n) { CFG.night = n; clearMaterials(); applySkin(); changed({ all: 1 }); }
function setWallMode(v) { CFG.wallMode = v; $('#selWalls').value = v; updateWallVisibility(true); changed({ ui: 1 }); }
function renderProject() {
  const p = $('#tab-project'); p.innerHTML = ''; const snaps = loadSnapshots();
  p.append(el('h3', {}, 'Save / load'), el('div', { class: 'row wrap' }, btn('⭳ Export project JSON', exportProject, 'pri'), btn('⭱ Import JSON…', () => $('#fileJson').click())),
    el('div', { class: 'hint' }, 'The JSON holds the plan, furniture, colours, kitchen, skin and bookmarks. Work is also autosaved in this browser.'),
    el('h3', {}, 'Export'), el('div', { class: 'row wrap' }, btn('📷 Screenshot PNG', screenshot), btn('🧊 3D model (GLB)', exportGLB), btn('📋 Furniture list / BOM', openBOM)),
    el('h3', {}, 'Design options (snapshots)'), el('div', { class: 'row' }, el('input', { type: 'text', id: 'snapName', placeholder: 'e.g. Option A sofa layout', style: 'flex:1' }), btn('＋ Save', () => saveSnapshot($('#snapName').value.trim()), 'pri')),
    snaps.map(s => el('div', { class: 'roomitem', title: 'Saved ' + new Date(s.savedAt).toLocaleString() }, el('div', { style: 'flex:1;min-width:0' }, el('div', { class: 'nm' }, s.name), el('div', { class: 'ar' }, `${s.count} items · ${new Date(s.savedAt).toLocaleDateString()}`)), btn('Load', () => loadSnapshot(s.id)), btn('✕', () => deleteSnapshot(s.id)))),
    snaps.length ? null : el('div', { class: 'hint' }, 'Save named versions of the design and switch between them to compare layouts. Loading a snapshot can be undone.'),
    el('h3', {}, 'Start over'), el('div', { class: 'row wrap' }, btn('Clear all furniture', () => { if (!D.objects.length) return; pushUndo(); D.objects = []; SEL.ids = []; changed({ objects: 1, ui: 1 }); toast('Furniture cleared (Ctrl+Z to undo)'); }), btn('Reset to original plan + sample furniture', () => { if (confirm('Reset the whole project to the original floor plan and sample furniture? (You can undo this.)')) { pushUndo(); resetProject(); changed({ all: 1 }); } }, 'danger')),
    el('div', { class: 'hint' }, `Schema v${SCHEMA} · ${D.objects.length} items placed · ${HIST.undo.length} undo steps available.`));
}
/* --- help + tour --- */
const KEYS = [['Left-drag / right-drag / wheel', 'Orbit / pan / zoom'], ['Click · Shift+click', 'Select · add to selection'], ['Drag item', 'Move on the floor (Alt = no snapping)'], ['Q / E', 'Rotate 15° (Shift = 1° fine steps); orange handle = drag-rotate'], ['Arrow keys', 'Nudge selection (Shift = ×10)'],
  ['Delete', 'Delete selection'], ['Ctrl+D', 'Duplicate'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+A', 'Select all items'], ['L', 'Lock / unlock selection'], ['F', 'Focus selection (or whole flat)'], ['G', 'Toggle 2D plan / 3D'], ['M', 'Measure tool'], ['S', 'Snapping on/off'], ['U', 'Feet-inches / metric'],
  ['1 / 2 / 3', 'Low poly / Standard / Realistic skin'], ['Tab', 'Collapse side panel'], ['Ctrl+S', 'Export project JSON'], ['Esc', 'Cancel tool · deselect · exit immersive view'], ['W A S D / arrows', 'Walk (in Walk mode); drag to look'], ['Double-click floor', 'Frame that room'], ['?', 'This help']];
$('#helpKeys').append(...KEYS.flatMap(([k, t]) => [el('div', {}, k.split(' / ').flatMap((s, i) => [i ? ' / ' : '', el('kbd', {}, s)])), el('div', {}, t)]));
const TOUR = [['#tab-rooms', 'Your rooms', 'Every room from the floor plan is listed here. Click one to fly to it, or “Enter room” to stand inside and look around.'], ['#tabs button[data-tab=library]', 'Furniture library', 'Drag furniture, kitchen units and fixtures into the view — or click to drop them at the centre.'],
  ['#tabs button[data-tab=mats]', 'Colours & materials', 'Paint rooms or single accent walls, change floors, or apply a whole-apartment theme in one click.'], ['#segView', 'Views', '3D dollhouse, 2D plan with dimensions, or a first-person walk-through.'], ['#selSkin', 'Render skins', 'Switch between Low poly, Standard and Realistic rendering at any time.'], ['#btnSave', 'Save your work', 'Export the project as JSON (and import it later). Work is also autosaved. Press ? for all shortcuts.']];
let tourI = -1;
function tourShow(i) { const t = $('#tour'); tourI = i; if (i < 0 || i >= TOUR.length) { t.classList.remove('on'); try { localStorage.setItem('aptDesigner.tourDone', '1'); } catch (e) { } return; } const [sel, title, text] = TOUR[i], r = ($(sel) || document.body).getBoundingClientRect();
  $('#tourTitle').textContent = title; $('#tourText').textContent = text; $('#tourStep').textContent = `${i + 1} / ${TOUR.length}`; $('#tourNext').textContent = i === TOUR.length - 1 ? 'Done' : 'Next'; t.classList.add('on'); t.style.left = clamp(r.left + Math.min(r.width, 320) / 2 - 20, 8, innerWidth - 300) + 'px'; t.style.top = clamp(r.bottom + 10, 8, innerHeight - 170) + 'px'; }
$('#tourNext').onclick = () => tourShow(tourI + 1); $('#tourSkip').onclick = () => tourShow(-1); $('#btnTourAgain').onclick = () => { $('#helpModal').classList.remove('on'); showTab('rooms'); tourShow(0); };
/* --- toolbar --- */
$('#btnPanel').onclick = togglePanel; $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo; $('#btnMeasure').onclick = () => setTool(TOOL.name === 'measure' ? 'select' : 'measure'); $('#btnSnap').onclick = toggleSnap; $('#btnUnits').onclick = toggleUnits;
$('#btnShot').onclick = screenshot; $('#btnSave').onclick = () => exportProject(); $('#btnHelp').onclick = () => $('#helpModal').classList.add('on'); $('#btnHelpClose').onclick = () => $('#helpModal').classList.remove('on'); $('#btnBomClose').onclick = () => $('#bomModal').classList.remove('on');
$('#selWalls').onchange = e => setWallMode(e.target.value); $('#selSkin').onchange = e => setSkin(e.target.value);
$$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) m.classList.remove('on'); }));
function refreshUI(w = {}) {
  if (w.all || w.plan || w.ui) renderRooms(); renderProps(); if (w.all || w.plan || w.ui || w.kitchen) renderMats(); if (w.all || w.ui) { renderView(); renderProject(); }
  $('#btnUndo').disabled = !HIST.undo.length; $('#btnRedo').disabled = !HIST.redo.length; $('#selSkin').value = CFG.skin; $('#selWalls').value = CFG.wallMode; $('#btnSnap').classList.toggle('on', CFG.snap); $('#btnUnits').textContent = CFG.units === 'ft' ? 'ft-in' : 'metric';
}
