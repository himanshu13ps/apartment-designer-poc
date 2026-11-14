/* ---------- 13. UI — tabs, Rooms, Library (with rendered thumbnails), Properties ---------- */
const row = (label, ...c) => el('div', { class: 'row' }, el('label', {}, label), ...c);
const btn = (text, onclick, cls = '', title) => el('button', { class: 'btn sm ' + cls, onclick, title }, text);
function showTab(name) { $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); $$('.tabpane').forEach(p => p.classList.toggle('on', p.id === 'tab-' + name)); if ($('#panel').classList.contains('collapsed')) togglePanel(); }
$$('#tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
function colorRow(label, value, on, palette = PAINTS.map(p => p[1])) {
  const inp = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#cccccc', onchange: e => on(e.target.value) });
  return el('div', {}, row(label, inp, el('span', { class: 'hint' }, value)), el('div', { class: 'swatches' }, palette.map(c => el('div', { class: 'sw', style: 'background:' + c, title: (PAINTS.find(p => p[1] === c) || [c])[0], onclick: () => on(c) }))));
}
const OBJ_COLORS = ['#f4f1ea', '#d9cdb8', '#b9a48a', '#8a6242', '#6f4c33', '#3a2f28', '#8d99a6', '#59636e', '#2f3b4c', '#17191c', '#a9b8a0', '#3f7f85', '#c2714f', '#d6a53c', '#7a3340', '#ffffff'];
/* --- Rooms --- */
function renderRooms() {
  const p = $('#tab-rooms'); p.innerHTML = ''; let total = 0;
  p.append(el('div', { class: 'row', style: 'justify-content:space-between' }, el('h3', { style: 'margin:0' }, D.plan.name || 'Apartment'), el('span', {}, btn('Whole flat', () => resetView(), '', 'Frame the whole apartment'), ' ', btn('ⓘ Assumptions', () => toggleAssumptions(), '', 'Plan assumptions'))));
  for (const r of D.plan.rooms) { const q = roomDims(r); if (!r.outdoor) total += q.area;
    p.append(el('div', { class: 'roomitem', 'data-room': r.id, onclick: () => frameRoom(r.id), onmouseenter: () => highlightRoom(r.id), onmouseleave: () => highlightRoom(null) },
      el('div', { style: 'flex:1;min-width:0' }, el('div', { class: 'nm' }, r.name), el('div', { class: 'ar' }, `${fmtLen(q.b.w)} × ${fmtLen(q.b.h)} · ${fmtArea(q.area)}`)),
      el('button', { class: 'btn sm', title: 'Stand in the middle of this room and look around', onclick: e => { e.stopPropagation(); highlightRoom(null); enterImmersive(r.id); } }, '👁 Enter room'))); }
  p.append(el('div', { class: 'hint' }, `Indoor carpet area ≈ ${fmtArea(total)} · ${D.plan.rooms.length} rooms. Click a room to frame it, hover to highlight, “Enter room” for the eye-level view.`));
}
function toggleAssumptions(force) { const a = $('#assume'), on = force ?? !a.classList.contains('on'); a.classList.toggle('on', on); if (on) { a.innerHTML = ''; a.append(el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', {}, 'Plan assumptions'), btn('✕', () => toggleAssumptions(false))), el('ul', {}, (D.plan.assumptions || ['None recorded.']).map(t => el('li', {}, t))), el('div', { class: 'hint' }, 'Anything wrong? Fix it in “Plan edit” or in the PLAN data at the top of the script.')); } }
/* --- Library thumbnails: rendered off-screen with the main renderer --- */
const THUMB = { cache: {}, queue: [], busy: false };
function renderThumb(def) {
  if (!THUMB.rt) { THUMB.rt = new THREE.WebGLRenderTarget(160, 120); THUMB.scene = new THREE.Scene(); THUMB.scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.5)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 3); THUMB.scene.add(dl); THUMB.cam = new THREE.PerspectiveCamera(28, 4 / 3, 0.05, 60); }
  const g = makeObjectGroup({ type: def.id, w: def.w, d: def.d, h: def.h, color: def.color, opts: def.o }), R = Math.hypot(def.w, def.d, def.h) / 2, dist = R / Math.sin(THREE.MathUtils.degToRad(14)) * 1.02; THUMB.scene.add(g);
  THUMB.cam.position.set(dist * 0.5, def.h / 2 + dist * 0.42, dist * 0.76); THUMB.cam.lookAt(0, def.h / 2, 0);
  const W = 160, H = 120, buf = new Uint8Array(W * H * 4), oc = new THREE.Color(); renderer.getClearColor(oc); const oa = renderer.getClearAlpha(), sh = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(THUMB.rt); renderer.setClearColor(0xe7ebf1, 1); renderer.clear(); renderer.render(THUMB.scene, THUMB.cam); renderer.readRenderTargetPixels(THUMB.rt, 0, 0, W, H, buf); renderer.setRenderTarget(null); renderer.setClearColor(oc, oa); renderer.shadowMap.autoUpdate = sh;
  THUMB.scene.remove(g); disposeGroup(g);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'), id = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((H - 1 - y) * W + x) * 4, t = (y * W + x) * 4; for (let k = 0; k < 3; k++) id.data[t + k] = Math.pow(buf[s + k] / 255, 1 / 2.2) * 255; id.data[t + 3] = 255; }
  ctx.putImageData(id, 0, 0); return c.toDataURL('image/png');
}
function pumpThumbs() {
  if (THUMB.busy) return; THUMB.busy = true;
  const step = () => { for (let i = 0; i < 3 && THUMB.queue.length; i++) { const id = THUMB.queue.shift(); if (THUMB.cache[id]) continue; try { THUMB.cache[id] = renderThumb(LIBMAP[id]); } catch (e) { console.warn('thumb failed', id, e); THUMB.cache[id] = 'x'; }
      $$(`img[data-thumb="${id}"]`).forEach(im => { if (THUMB.cache[id] !== 'x') im.src = THUMB.cache[id]; }); } invalidate(); if (THUMB.queue.length) setTimeout(step, 30); else THUMB.busy = false; };
  setTimeout(step, 60);
}
function renderLibrary() {
  const p = $('#tab-library'), old = $('#libSearch'), q = (old ? old.value : '').trim().toLowerCase(), focus = document.activeElement === old; p.innerHTML = '';
  const search = el('input', { type: 'search', id: 'libSearch', placeholder: 'Search furniture, fixtures…', value: q, style: 'width:100%', oninput: () => renderLibrary() }); p.append(search, el('div', { class: 'hint' }, 'Drag an item into the view, or click to place it at the centre of the view.'));
  for (const cat of LIBCATS) { const items = LIB.filter(d => d.cat === cat && (!q || (d.name + ' ' + d.cat).toLowerCase().includes(q))); if (!items.length) continue;
    p.append(el('h3', {}, cat), el('div', { class: 'libgrid' }, items.map(d => { const im = el('img', { 'data-thumb': d.id, alt: d.name, draggable: 'false', src: THUMB.cache[d.id] && THUMB.cache[d.id] !== 'x' ? THUMB.cache[d.id] : 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' });
      if (!THUMB.cache[d.id] && !THUMB.queue.includes(d.id)) THUMB.queue.push(d.id);
      return el('div', { class: 'libitem', draggable: 'true', 'data-item': d.id, title: `${d.name} — ${fmtLen(d.w)} × ${fmtLen(d.d)} × ${fmtLen(d.h)}`, ondragstart: e => { e.dataTransfer.setData('text/apt-item', d.id); e.dataTransfer.effectAllowed = 'copy'; }, onclick: () => placeAtTarget(d.id) }, im, el('span', {}, d.name)); }))); }
  if (!p.querySelector('.libitem')) p.append(el('div', { class: 'hint' }, 'No items match “' + q + '”. Try the Generic → Custom box for anything not in the library.'));
  if (focus) { search.focus(); search.setSelectionRange(q.length, q.length); } pumpThumbs();
}
/* --- Properties --- */
function renderProps() {
  const p = $('#tab-props'); p.innerHTML = ''; const os = SEL.ids.map(objById).filter(Boolean), ids = os.map(o => o.id);
  if (SEL.unit && getUnit(SEL.unit)) renderUnitProps(p);
  else if (os.length === 1) { const o = os[0], def = defOf(o), w = WARN.get(o.id), dis = o.locked;
    p.append(el('h3', {}, 'Selected item'), row('Name', el('input', { type: 'text', value: o.name, onchange: e => setObjProp(ids, { name: e.target.value.slice(0, 60) || def.name }) })), row('Type', el('span', {}, def.name + ' · ' + def.cat)), row('Room', el('span', {}, objRoomName(o))));
    if (w) p.append(el('div', { class: 'card' }, w.collide.length ? el('div', {}, el('span', { class: 'tag red' }, 'Overlap'), ' with ' + [...new Set(w.collide)].join(', ')) : null, w.clear.map(m => el('div', {}, el('span', { class: 'tag' }, 'Clearance'), ' ' + m))));
    const dim = (k, min) => lenInput(o[k], v => setObjProp(ids, { [k]: r3(clamp(v, min, 12)) }), 62);
    p.append(el('h3', {}, 'Size (W × D × H)'), el('div', { class: 'row' }, dim('w', 0.05), '×', dim('d', 0.02), '×', dim('h', 0.01), btn('↺', () => setObjProp(ids, { w: def.w, d: def.d, h: def.h }), '', 'Reset to default size')),
      el('h3', {}, 'Position'), row('X / Y (plan)', lenInput(o.x, v => setObjProp(ids, { x: r3(v) }), 70), lenInput(o.z, v => setObjProp(ids, { z: r3(v) }), 70)),
      def.mount === 'ceiling' ? row('Mounting', el('span', {}, 'Hangs from ceiling')) : row('Height off floor', lenInput(o.y || 0, v => setObjProp(ids, { y: r3(clamp(v, 0, D.plan.wallHeight)) }), 70)),
      row('Rotation °', el('input', { type: 'number', step: 15, value: Math.round(THREE.MathUtils.radToDeg(o.rot || 0) * 10) / 10, style: 'width:70px', onchange: e => setObjProp(ids, { rot: normAng(THREE.MathUtils.degToRad(+e.target.value || 0)) }) }), btn('⟲ 15°', () => rotateSelected(Math.PI / 12)), btn('⟳ 15°', () => rotateSelected(-Math.PI / 12)), btn('90°', () => rotateSelected(Math.PI / 2))),
      el('h3', {}, 'Colour / finish'), colorRow('Main colour', o.color, c => setObjProp(ids, { color: c }), OBJ_COLORS));
    if (def.b === 'box' || def.b === 'cylinder') p.append(row('Material', el('select', { onchange: e => setObjProp(ids, q => ({ opts: { ...q.opts, kind: e.target.value } })) }, ['paint', 'wood', 'fabric', 'metal', 'glass', 'marble', 'granite', 'plastic', 'ceramic'].map(k => el('option', { value: k, selected: (o.opts?.kind || 'paint') === k }, k)))));
    p.append(el('div', { class: 'row wrap', style: 'margin-top:10px' }, btn(dis ? '🔒 Unlock' : '🔓 Lock', () => setObjProp(ids, { locked: !o.locked })), btn('⧉ Duplicate', duplicateSelected), btn('🗑 Delete', deleteSelected, 'danger'), btn('◎ Focus', frameSelection))); }
  else if (os.length > 1) { p.append(el('h3', {}, os.length + ' items selected'), el('div', { class: 'hint' }, 'Drag any of them to move the group. Q / E rotate the group around its centre.'), colorRow('Colour for all', os[0].color, c => setObjProp(ids, { color: c }), OBJ_COLORS),
      el('div', { class: 'row wrap' }, btn('⧉ Duplicate', duplicateSelected), btn('🗑 Delete', deleteSelected, 'danger'), btn('🔒 Lock all', () => setObjProp(ids, { locked: true })), btn('🔓 Unlock all', () => setObjProp(ids, { locked: false })))); }
  else p.append(el('h3', {}, 'Nothing selected'), el('div', { class: 'hint' }, 'Click an item in the view to edit its size, position and colour. Shift+click selects several. Kitchen units and the sink/hob are selectable too.'));
  const chk = (label, key, after) => el('label', { class: 'row', style: 'cursor:pointer' }, el('input', { type: 'checkbox', checked: CFG[key], onchange: e => { CFG[key] = e.target.checked; after && after(); changed({ ui: 1 }); } }), label);
  p.append(el('h3', {}, 'Placement aids'), chk('Snapping on (S)', 'snap', () => $('#btnSnap').classList.toggle('on', CFG.snap)), chk('Snap to walls', 'snapWalls'), chk('Snap to other items’ edges', 'snapObjects'),
    row('Grid step', el('select', { onchange: e => { CFG.grid = +e.target.value; changed({ ui: 1 }); } }, [[0, 'Off'], [0.01, '1 cm'], [0.025, '2.5 cm / 1"'], [0.05, '5 cm / 2"'], [0.1, '10 cm / 4"'], [0.1524, '6"'], [0.3048, '1 ft']].map(([v, t]) => el('option', { value: v, selected: Math.abs(CFG.grid - v) < 1e-6 }, t)))),
    chk('Show distances to walls for the selection', 'showDims', updateSelectionVisuals), chk('Clearance check (door swings, < 2 ft walkways)', 'clearance', checkWarnings));
  renderKitchenTool(p);
}
function renderUnitProps(p) {
  const ref = SEL.unit, u = getUnit(ref), r = kRun(u.run), runs = kRuns();
  if (ref.kind === 'fixture') { p.append(el('h3', {}, u.type === 'sink' ? 'Sink (counter cut-out)' : 'Hob (counter cut-out)'), row('Counter run', el('select', { onchange: e => setUnitProp(ref, { run: e.target.value, at: runGeom(kRun(e.target.value)).L / 2 }) }, runs.map(q => el('option', { value: q.id, selected: q.id === u.run }, q.id + ' run')))),
      row('Position along', lenInput(u.at, v => setUnitProp(ref, { at: r3(v) })), btn('◀', () => setUnitProp(ref, { at: r3(u.at - 0.05) })), btn('▶', () => setUnitProp(ref, { at: r3(u.at + 0.05) }))), row('Width', lenInput(u.w, v => setUnitProp(ref, { w: r3(v) }))), row('Depth', lenInput(u.d, v => setUnitProp(ref, { d: r3(v) }))),
      row('Type', el('select', { onchange: e => setUnitProp(ref, { type: e.target.value }) }, [['sink', 'Sink'], ['hob', 'Hob / cooktop']].map(([v, t]) => el('option', { value: v, selected: v === u.type }, t)))), el('div', { class: 'row' }, btn('🗑 Remove', () => deleteUnit(ref), 'danger'))); return; }
  const styles = ref.kind === 'base' ? BASE_STYLES : WALL_STYLES, col = u.color || (ref.kind === 'base' ? D.mats.cabinet : D.mats.cabinetWall);
  p.append(el('h3', {}, (ref.kind === 'base' ? 'Base' : 'Wall') + ' cabinet · ' + u.run + ' run'), row('Width', el('select', { onchange: e => setUnitProp(ref, { w: +e.target.value }) }, [...new Set([...CAB_WIDTHS, u.w])].sort((a, b) => a - b).map(w => el('option', { value: w, selected: Math.abs(w - u.w) < 1e-6 }, Math.round(w * 1000) + ' mm'))), lenInput(u.w, v => setUnitProp(ref, { w: r3(clamp(v, 0.1, 1.5)) }), 64)),
    row('Type', el('select', { onchange: e => setUnitProp(ref, { style: e.target.value }) }, Object.entries(styles).map(([v, t]) => el('option', { value: v, selected: v === u.style }, t)))),
    colorRow('Colour', col, c => setUnitProp(ref, { color: c }), OBJ_COLORS), el('div', { class: 'row wrap' }, btn('Use default colour', () => setUnitProp(ref, { color: undefined })), btn('🗑 Remove unit', () => deleteUnit(ref), 'danger')),
    el('div', { class: 'hint' }, `Starts ${fmtLen(u.at)} along the ${fmtLen(runGeom(r).L)} run. Changing the width shifts the neighbouring units.`));
}
