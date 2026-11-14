/* ---------- 12. PLAN EDIT MODE: SVG overlay on the 2D view — drag wall ends / room corners / openings, calibrate, underlay ---------- */
const PE = { on: false, sel: null, tool: null, pts: [], drag: null, panel: null };
const svg = $('#planSvg'), NS = 'http://www.w3.org/2000/svg';
const peScale = () => viewEl.clientHeight * ocam.zoom / 20;
const w2s = (x, y) => { const k = peScale(); return [(x - ocam.position.x) * k + viewEl.clientWidth / 2, (y - ocam.position.z) * k + viewEl.clientHeight / 2]; };
const s2w = (px, py) => { const k = peScale(); return [(px - viewEl.clientWidth / 2) / k + ocam.position.x, (py - viewEl.clientHeight / 2) / k + ocam.position.z]; };
const evW = ev => { const r = viewEl.getBoundingClientRect(); return s2w(ev.clientX - r.left, ev.clientY - r.top); };
const snapG = (v, ev) => ev && ev.altKey ? r3(v) : r3(Math.round(v / 0.05) * 0.05);
function togglePlanEdit(on = !PE.on) {
  if (on === PE.on) return; if (on && VIEW.mode !== '2d') { if (VIEW.mode !== '3d') return toast('Exit the immersive view first'); setViewMode('2d'); }
  PE.on = on; PE.sel = null; PE.tool = null; PE.pts = []; svg.classList.toggle('on', on); $('#btnPlanEdit').classList.toggle('on', on); controls2d.enabled = VIEW.mode === '2d';
  if (on) { SEL.ids = []; SEL.unit = null; updateSelectionVisuals(); setStatus('Plan edit: drag white circles (wall ends), yellow squares (room corners) and door/window bars. Double-click a room name to rename.'); } else setStatus(defaultStatus());
  pePanel(); updateRoomLabels(); peRedraw(); changedUI();
}
function peTool(t) { PE.tool = t; PE.pts = []; svg.style.pointerEvents = t ? 'auto' : 'none'; svg.style.cursor = t ? 'crosshair' : ''; pePanel(); peRedraw();
  if (t) setStatus(t === 'calib' ? 'Calibrate: click two points whose real distance you know' : 'Add wall: click the start and end points'); }
function peRedraw() {
  if (!PE.on) return; const k = peScale(), P = D.plan, out = [], U = EXTRA.underlay, f = n => n.toFixed(1);
  if (U) { const [x, y] = w2s(U.x, U.y); out.push(`<image href="${U.src}" x="${f(x)}" y="${f(y)}" width="${f(U.w * k)}" height="${f(U.w * U.aspect * k)}" opacity="${U.opacity}" preserveAspectRatio="none" style="pointer-events:none"/>`); }
  for (const w of P.walls) { const a = w2s(...w.a), b = w2s(...w.b); out.push(`<line class="w${PE.sel?.type === 'wall' && PE.sel.id === w.id ? ' sel' : ''}" data-wall="${w.id}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke-width="${f(Math.max(4, w.t * k))}"/>`); }
  for (const o of P.openings) { const w = wallById(o.wall); if (!w) continue; const g = wallGeom(w), hw = Math.max(5, w.t * k / 2 + 2) / k, sel = PE.sel?.type === 'opening' && PE.sel.id === o.id;
    const pt = (s, d) => w2s(w.a[0] + g.u[0] * s + g.n[0] * d, w.a[1] + g.u[1] * s + g.n[1] * d).map(f).join(','), s0 = o.at - o.w / 2, s1 = o.at + o.w / 2;
    out.push(`<polygon class="op ${o.type}${sel ? ' sel' : ''}" data-op="${o.id}" points="${pt(s0, -hw)} ${pt(s1, -hw)} ${pt(s1, hw)} ${pt(s0, hw)}"/>`);
    if (sel) for (const [i, s] of [[0, s0], [1, s1]]) { const c = w2s(w.a[0] + g.u[0] * s, w.a[1] + g.u[1] * s); out.push(`<circle class="oph" data-oph="${o.id}" data-end="${i}" cx="${f(c[0])}" cy="${f(c[1])}" r="5"/>`); } }
  for (const r of P.rooms) { r.poly.forEach((p, i) => { const c = w2s(...p); out.push(`<rect class="rv" data-room="${r.id}" data-i="${i}" x="${f(c[0] - 4)}" y="${f(c[1] - 4)}" width="8" height="8"/>`); });
    const c = w2s(...insidePoint(r)); out.push(`<text data-roomname="${r.id}" x="${f(c[0])}" y="${f(c[1])}" style="pointer-events:auto">${r.name.replace(/[<&>]/g, '')}</text><text x="${f(c[0])}" y="${f(c[1] + 15)}" style="font-weight:400;font-size:11px;pointer-events:none">${fmtArea(polyArea(r.poly))}</text>`); }
  for (const w of P.walls) for (const e of ['a', 'b']) { const c = w2s(...w[e]); out.push(`<circle class="ep" data-ep="${w.id}" data-end="${e}" cx="${f(c[0])}" cy="${f(c[1])}" r="5.5"/>`); }
  if (PE.pts.length) { const a = w2s(...PE.pts[0]), b = w2s(...(PE.pts[1] || PE.hover || PE.pts[0])); out.push(`<line class="cal" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/><circle cx="${f(a[0])}" cy="${f(a[1])}" r="4" fill="#e03131"/>`); }
  svg.innerHTML = out.join('');
}
controls2d.addEventListener('change', peRedraw);
svg.addEventListener('wheel', ev => { ev.preventDefault(); canvas.dispatchEvent(new WheelEvent('wheel', ev)); }, { passive: false });
svg.addEventListener('pointerdown', ev => {
  const t = ev.target, ds = t.dataset || {}, p = evW(ev);
  if (PE.tool) { const q = [snapG(p[0], ev), snapG(p[1], ev)];
    if (PE.tool === 'addwall') for (const w of D.plan.walls) for (const e of [w.a, w.b]) if (Math.hypot(e[0] - p[0], e[1] - p[1]) < 0.15) { q[0] = e[0]; q[1] = e[1]; }
    PE.pts.push(PE.tool === 'calib' ? p : q); if (PE.pts.length === 2) peFinishTool(); else peRedraw(); return; }
  let d = null;
  if (ds.ep) { const w = wallById(ds.ep), pt = w[ds.end].slice(); d = { kind: 'ep', wall: w, end: ds.end, o: pt, ends: [], verts: [] };
    for (const q of D.plan.walls) for (const e of ['a', 'b']) if (Math.hypot(q[e][0] - pt[0], q[e][1] - pt[1]) < 0.03) d.ends.push({ q, e });
    for (const r of D.plan.rooms) r.poly.forEach((v, i) => { if (Math.hypot(v[0] - pt[0], v[1] - pt[1]) < 0.3) d.verts.push({ r, i, o: v.slice() }); }); PE.sel = { type: 'wall', id: w.id }; }
  else if (ds.room) d = { kind: 'rv', r: roomById(ds.room), i: +ds.i };
  else if (ds.oph) { PE.sel = { type: 'opening', id: ds.oph }; d = { kind: 'oph', o: D.plan.openings.find(o => o.id === ds.oph), end: +ds.end }; }
  else if (ds.op) { PE.sel = { type: 'opening', id: ds.op }; d = { kind: 'op', o: D.plan.openings.find(o => o.id === ds.op) }; }
  else if (ds.wall) PE.sel = { type: 'wall', id: ds.wall };
  else if (ds.roomname) PE.sel = { type: 'room', id: ds.roomname };
  if (d) { PE.drag = d; d.moved = false; svg.setPointerCapture(ev.pointerId); } pePanel(); peRedraw(); ev.stopPropagation();
});
svg.addEventListener('pointermove', ev => {
  const p = evW(ev), d = PE.drag; if (PE.tool && PE.pts.length === 1) { PE.hover = p; peRedraw(); return; } if (!d) return; if (!d.moved) { d.moved = true; pushUndo(); }
  if (d.kind === 'ep') { let x = snapG(p[0], ev), y = snapG(p[1], ev); const other = d.wall[d.end === 'a' ? 'b' : 'a']; if (Math.abs(x - other[0]) < (ev.shiftKey ? 1e9 : 0.09) && Math.abs(x - other[0]) <= Math.abs(y - other[1])) x = other[0]; else if (Math.abs(y - other[1]) < (ev.shiftKey ? 1e9 : 0.09)) y = other[1];
    const dx = x - d.o[0], dy = y - d.o[1]; d.ends.forEach(({ q, e }) => { q[e] = [r3(x), r3(y)]; }); d.verts.forEach(v => { v.r.poly[v.i] = [r3(v.o[0] + dx), r3(v.o[1] + dy)]; }); }
  else if (d.kind === 'rv') d.r.poly[d.i] = [snapG(p[0], ev), snapG(p[1], ev)];
  else if (d.o) { const w = wallById(d.o.wall), g = wallGeom(w), s = clamp((p[0] - w.a[0]) * g.u[0] + (p[1] - w.a[1]) * g.u[1], 0.03, g.L - 0.03);
    if (d.kind === 'op') d.o.at = r3(clamp(s, d.o.w / 2 + 0.03, Math.max(d.o.w / 2 + 0.03, g.L - d.o.w / 2 - 0.03)));
    else { const fixed = d.end === 0 ? d.o.at + d.o.w / 2 : d.o.at - d.o.w / 2, e = snapG(s, ev); if (Math.abs(e - fixed) > 0.3) { d.o.at = r3((e + fixed) / 2); d.o.w = r3(Math.abs(e - fixed)); } } }
  peRedraw();
});
svg.addEventListener('pointerup', () => { const d = PE.drag; PE.drag = null; if (d?.moved) { changed({ plan: 1, kitchen: 1, objects: 1, ui: 1 }); pePanel(); } });
svg.addEventListener('dblclick', ev => { const id = ev.target.dataset?.roomname; if (!id) return; const r = roomById(id), n = prompt('Room name', r.name); if (n && n.trim()) { pushUndo(); r.name = n.trim().slice(0, 40); changed({ plan: 1, ui: 1 }); } });
function scalePlan(f) {
  const P = D.plan, S = p => [r3(p[0] * f), r3(p[1] * f)]; P.rooms.forEach(r => r.poly = r.poly.map(S)); P.walls.forEach(w => { w.a = S(w.a); w.b = S(w.b); }); P.openings.forEach(o => { o.at = r3(o.at * f); o.w = r3(o.w * f); });
  if (P.kitchen) { P.kitchen.runs.forEach(r => { r.from = S(r.from); r.to = S(r.to); }); P.kitchen.fixtures.forEach(x => x.at = r3(x.at * f)); D.kitchen.baseUnits.concat(D.kitchen.wallUnits).forEach(u => u.at = r3(u.at * f)); }
  D.objects.forEach(o => { o.x = r3(o.x * f); o.z = r3(o.z * f); });
}
function peFinishTool() {
  const [a, b] = PE.pts, len = Math.hypot(b[0] - a[0], b[1] - a[1]), tool = PE.tool; peTool(null); if (len < 0.05) return toast('Points are too close together', 'err');
  if (tool === 'addwall') { pushUndo(); const w = { id: uid('w'), a, b, t: 0.15 }; D.plan.walls.push(w); PE.sel = { type: 'wall', id: w.id }; changed({ plan: 1, ui: 1 }); return; }
  const ans = prompt(`Measured ${fmtLen(len)} (${len.toFixed(3)} m).\nEnter the REAL distance between the two points (e.g. 12'6" or 3.81m):`, fmtLen(len)); if (ans == null) return; const real = parseLen(ans); if (!(real > 0.05)) return toast('Could not read that distance — try 12\'6" or 3.81m', 'err');
  const f = real / len, U = EXTRA.underlay, onlyU = U && !confirm(`Scale factor ${f.toFixed(4)}.\nOK = rescale the PLAN geometry (walls, rooms, furniture positions).\nCancel = rescale only the underlay image.`);
  if (onlyU) { U.x = r3(a[0] + (U.x - a[0]) * f); U.y = r3(a[1] + (U.y - a[1]) * f); U.w = r3(U.w * f); } else { pushUndo(); scalePlan(f); if (U) { U.x = r3(U.x * f); U.y = r3(U.y * f); U.w = r3(U.w * f); } }
  changed({ all: 1 }); fit2d(planBounds()); toast(`Scale re-calibrated ×${f.toFixed(3)}`, 'ok');
}
function peDelete() { const s = PE.sel, P = D.plan; if (!s) return toast('Select a wall, door/window or room name first'); pushUndo();
  if (s.type === 'wall') { P.walls = P.walls.filter(w => w.id !== s.id); P.openings = P.openings.filter(o => o.wall !== s.id); } else if (s.type === 'opening') P.openings = P.openings.filter(o => o.id !== s.id);
  else { if (!confirm('Delete this room (floor + ceiling)? Walls stay.')) { HIST.undo.pop(); return; } P.rooms = P.rooms.filter(r => r.id !== s.id); }
  PE.sel = null; changed({ plan: 1, kitchen: 1, objects: 1, ui: 1 }); pePanel(); }
function peAddOpening(type) { const s = PE.sel; if (s?.type !== 'wall') return toast('Select a wall first (click it)'); const w = wallById(s.id), L = wallGeom(w).L; pushUndo();
  const o = type === 'door' ? { id: uid('d'), type, wall: w.id, at: r3(L / 2), w: Math.min(0.9, L - 0.2), h: 2.1, sill: 0, style: 'hinged', hinge: 'start', opensTo: 1, name: 'Door' } : { id: uid('win'), type, wall: w.id, at: r3(L / 2), w: Math.min(1.2, L - 0.2), h: 1.35, sill: 0.76, name: 'Window' };
  D.plan.openings.push(o); PE.sel = { type: 'opening', id: o.id }; changed({ plan: 1, ui: 1 }); pePanel(); }
function peAddRoom() { const [cx, cy] = [controls2d.target.x, controls2d.target.z].map(v => r3(Math.round(v * 10) / 10)); pushUndo(); const r = { id: uid('room'), name: 'New room', type: 'living', poly: [[cx - 1.5, cy - 1.5], [cx + 1.5, cy - 1.5], [cx + 1.5, cy + 1.5], [cx - 1.5, cy + 1.5]] }; D.plan.rooms.push(r); PE.sel = { type: 'room', id: r.id }; changed({ plan: 1, ui: 1 }); pePanel(); }
function loadUnderlay(file) { const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const b = planBounds(); EXTRA.underlay = { src: fr.result, x: r3(b.x0), y: r3(b.y0), w: r3(b.w), aspect: img.height / img.width, opacity: 0.5 }; if (!PE.on) togglePlanEdit(true); pePanel(); peRedraw(); changed({ ui: 1 }); toast('Underlay loaded — set its position/width, or calibrate with two points', 'ok'); }; img.onerror = () => toast('Could not read that image', 'err'); img.src = fr.result; }; fr.readAsDataURL(file); }
/* Floating plan-edit toolbox */
function lenInput(val, on, w = 74) { return el('input', { type: 'text', value: fmtLen(val), style: `width:${w}px`, onchange: e => { const v = parseLen(e.target.value); if (isNaN(v)) { toast('Could not read that length', 'err'); e.target.value = fmtLen(val); } else on(v); } }); }
function pePanel() {
  PE.panel?.remove(); PE.panel = null; if (!PE.on) return; const s = PE.sel, P = D.plan, U = EXTRA.underlay, set = (fn, what = { plan: 1, kitchen: 1, objects: 1, ui: 1 }) => { pushUndo(); fn(); changed(what); pePanel(); };
  const box = el('div', { style: 'position:absolute;left:10px;top:10px;width:262px;max-height:calc(100% - 60px);overflow:auto;background:rgba(255,255,255,.96);border:1px solid var(--line);border-radius:8px;padding:8px 10px;z-index:6;font-size:12px' });
  box.append(el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', {}, 'Plan edit'), el('button', { class: 'btn sm pri', onclick: () => togglePlanEdit(false) }, 'Done')),
    el('div', { class: 'row wrap' }, el('button', { class: 'btn sm' + (PE.tool === 'calib' ? ' on' : ''), onclick: () => peTool(PE.tool === 'calib' ? null : 'calib') }, '📐 Calibrate scale'), el('button', { class: 'btn sm' + (PE.tool === 'addwall' ? ' on' : ''), onclick: () => peTool(PE.tool === 'addwall' ? null : 'addwall') }, '+ Wall'),
      el('button', { class: 'btn sm', onclick: () => peAddOpening('door') }, '+ Door'), el('button', { class: 'btn sm', onclick: () => peAddOpening('window') }, '+ Window'), el('button', { class: 'btn sm', onclick: peAddRoom }, '+ Room'), el('button', { class: 'btn sm danger', onclick: peDelete }, 'Delete')),
    el('div', { class: 'row' }, el('label', {}, 'Wall height'), lenInput(P.wallHeight, v => set(() => P.wallHeight = clamp(v, 2.2, 4.5)))),
    el('div', { class: 'row wrap' }, el('button', { class: 'btn sm', onclick: () => $('#fileImg').click() }, U ? 'Replace underlay…' : '🖼 Upload plan image…'), U && el('button', { class: 'btn sm', onclick: () => { EXTRA.underlay = null; pePanel(); peRedraw(); changed({ ui: 1 }); } }, 'Remove')));
  if (U) { const upd = () => { peRedraw(); changed({ ui: 1 }); };
    box.append(el('div', { class: 'row' }, el('label', {}, 'Opacity'), el('input', { type: 'range', min: 0.05, max: 1, step: 0.05, value: U.opacity, oninput: e => { U.opacity = +e.target.value; peRedraw(); } })),
      el('div', { class: 'row' }, el('label', {}, 'Image width'), lenInput(U.w, v => { U.w = Math.max(0.5, v); upd(); pePanel(); })), el('div', { class: 'row' }, el('label', {}, 'Offset x / y'), lenInput(U.x, v => { U.x = v; upd(); }, 60), lenInput(U.y, v => { U.y = v; upd(); }, 60))); }
  if (s?.type === 'wall') { const w = wallById(s.id); if (w) box.append(el('h3', {}, 'Wall ' + w.id), el('div', { class: 'row' }, el('label', {}, 'Length'), el('span', {}, fmtLen(wallGeom(w).L))), el('div', { class: 'row' }, el('label', {}, 'Thickness'), lenInput(w.t, v => set(() => w.t = clamp(v, 0.05, 0.6)))),
      el('div', { class: 'row' }, el('label', {}, 'Height'), lenInput(w.h || P.wallHeight, v => set(() => { if (v >= P.wallHeight - 0.01) delete w.h; else w.h = clamp(v, 0.3, P.wallHeight); })))); }
  if (s?.type === 'opening') { const o = P.openings.find(q => q.id === s.id); if (o) { const sel = (val, opts, on) => el('select', { onchange: e => set(() => on(e.target.value)) }, opts.map(([v, t]) => el('option', { value: v, selected: String(v) === String(val) }, t)));
      box.append(el('h3', {}, (o.name || o.type)), el('div', { class: 'row' }, el('label', {}, 'Name'), el('input', { type: 'text', value: o.name || '', onchange: e => set(() => o.name = e.target.value.slice(0, 40)) })),
        el('div', { class: 'row' }, el('label', {}, 'Width'), lenInput(o.w, v => set(() => o.w = clamp(v, 0.3, 6)))), el('div', { class: 'row' }, el('label', {}, 'Height'), lenInput(o.h, v => set(() => o.h = clamp(v, 0.3, P.wallHeight)))),
        el('div', { class: 'row' }, el('label', {}, 'Sill height'), lenInput(o.sill, v => set(() => o.sill = clamp(v, 0, P.wallHeight - 0.3)))), el('div', { class: 'row' }, el('label', {}, 'Position'), lenInput(o.at, v => set(() => o.at = Math.max(0.1, v)))),
        el('div', { class: 'row' }, el('label', {}, 'Type'), sel(o.type, [['door', 'Door'], ['window', 'Window']], v => { o.type = v; if (v === 'door') { o.sill = 0; o.style = o.style || 'hinged'; } })));
      if (o.type === 'door') box.append(el('div', { class: 'row' }, el('label', {}, 'Style'), sel(o.style, [['hinged', 'Hinged'], ['sliding', 'Sliding'], ['open', 'Open (no leaf)']], v => o.style = v)), el('div', { class: 'row' }, el('label', {}, 'Hinge'), sel(o.hinge, [['start', 'Start jamb'], ['end', 'End jamb']], v => o.hinge = v)),
        el('div', { class: 'row' }, el('label', {}, 'Swings to'), sel(o.opensTo, [[1, 'Side A'], [-1, 'Side B']], v => o.opensTo = +v)), el('div', { class: 'row' }, el('label', {}, 'Glass'), el('input', { type: 'checkbox', checked: !!o.glass, onchange: e => set(() => o.glass = e.target.checked) }))); } }
  if (s?.type === 'room') { const r = roomById(s.id); if (r) box.append(el('h3', {}, 'Room'), el('div', { class: 'row' }, el('label', {}, 'Name'), el('input', { type: 'text', value: r.name, onchange: e => set(() => r.name = e.target.value.trim().slice(0, 40) || r.name) })),
      el('div', { class: 'row' }, el('label', {}, 'Type'), el('select', { onchange: e => set(() => r.type = e.target.value) }, Object.keys(FLOOR_BY_ROOM).map(t => el('option', { value: t, selected: t === r.type }, t)))),
      el('div', { class: 'row' }, el('label', {}, 'Open to sky'), el('input', { type: 'checkbox', checked: !!r.outdoor, onchange: e => set(() => r.outdoor = e.target.checked) }))); }
  box.append(el('div', { class: 'hint' }, 'Tips: Shift locks a wall end square to its other end · Alt disables the 5 cm grid · all edits are undoable.'));
  viewEl.append(box); PE.panel = box;
}
$('#fileImg').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadUnderlay(f); });
$('#btnPlanEdit').addEventListener('click', () => togglePlanEdit());
