/* Grok Blocks - DOM UI, touch controls, screens */
(function () {
'use strict';
const GB = window.GB, GN = window.GrokNet, G = GB.G, GS = G.GS, Sim = GB.Sim, V = GB.View, Snd = GB.Snd;
const $ = (id) => document.getElementById(id);
const UI = G.UI = {};
const SCREENS = ['scrTitle', 'scrOnline', 'scrHow', 'scrPause', 'scrBoard', 'scrShop', 'scrJobs', 'scrMap', 'scrDone'];
UI.show = function () { const u = GS.ui; SCREENS.forEach((id) => $(id).classList.toggle('hidden', id !== ({ title: 'scrTitle', online: 'scrOnline' }[u]))); $('hud').classList.toggle('hidden', u !== 'game'); };
UI.closeAll = function () { ['scrBoard', 'scrShop', 'scrJobs', 'scrMap', 'scrDone', 'scrPause', 'scrHow'].forEach((id) => $(id).classList.add('hidden')); GS.paused = false; };
UI.codeBadge = function (code) { const b = $('codeBadge'); if (!code) { b.classList.add('hidden'); return; } b.textContent = 'ROOM ' + code; b.classList.remove('hidden'); };
function stars(n) { return '\u2605'.repeat(n || 0) + '\u2606'.repeat(3 - (n || 0)); }
UI.stars = stars;

function goalLine(g) {
  const done = g.have >= g.n;
  let t = g.kind;
  if (g.kind === 'free') t = 'Free the captured animal';
  else if (g.kind === 'recon') t = 'Recon the poacher camp';
  else if (g.kind === 'raid') t = 'Raid a sanctuary pen';
  else if (g.kind === 'sell') t = g.species ? ('Sell a ' + GB.SPECIES[g.species].name) : 'Sell a crate';
  else if (g.kind === 'rescue') t = 'Rescue a ' + GB.SPECIES[g.species].name;
  return (done ? '\u2705 ' : '\u25fb\ufe0f ') + t + ' ' + g.have + '/' + g.n;
}
UI.hud = function () {
  const s = G.save(), W = Sim.W(), poach = W.mode === 'poacher';
  document.body.classList.toggle('mode-poach', poach);
  if (document.body.dataset.play !== (poach ? 'poach' : 'ranger')) {
    document.body.dataset.play = poach ? 'poach' : 'ranger';
    $('ammoPill').innerHTML = poach ? '&#129514; <b id="nDarts">4</b>' : '&#127919; <b id="nDarts">6</b>';
    $('ptsPill').innerHTML = poach ? '&#128176; <b id="nPts">0</b>' : '&#11088; <b id="nPts">0</b>';
    $('cargoPill').innerHTML = poach ? '&#128230; <b id="nCargo">0</b>' : '&#128666; <b id="nCargo">0</b>';
  }
  const pu = poach ? G.psave().upg : s.upg;
  $('nPts').textContent = poach ? G.psave().cash : s.points;
  const dMax = poach ? (4 + (pu.nets || 0) * 2) : (6 + (s.upg.darts || 0) * 2);
  $('nDarts').textContent = (GS.me && (poach ? GS.me.nets : GS.me.darts) != null ? (poach ? GS.me.nets : GS.me.darts) : dMax) + '/' + dMax;
  $('nFlare').textContent = GS.me && GS.me.flares != null ? GS.me.flares : (poach ? 1 : 2);
  const cargo = W.truck ? W.truck.cargo.length : 0, cap = 2 + (pu.cargo || 0);
  $('nCargo').textContent = cargo + '/' + cap;
  const hp = $('nHeat'); if (hp) { const hv = Math.round(W.heat || 0); hp.textContent = hv; $('heatP').classList.toggle('hot', hv >= 70); $('heatP').classList.toggle('warm', hv >= 35 && hv < 70); }
  $('biomeName').textContent = W.M ? (GB.BIOMES[W.M.biome].name + (W.night && W.map !== 'camp' ? ' \u00b7 NIGHT' : '')) : '';
  const cs = GB.caseById(W.caseId || GS.caseId);
  const job = poach ? GB.jobById(W.jobId) : null;
  $('obj').innerHTML = (poach ? job : cs) ? '<b>' + (poach ? job.name : cs.name) + '</b><br>' + (W.goals || []).map(goalLine).join('<br>') : (poach ? 'Poacher free roam \u00b7 NET crates, SELL them at the van' : 'Free roam \u00b7 pick a case at the Case Board');
  const seats = W.truck ? W.truck.seats : [];
  const mode = !GS.me || GS.me.onFoot ? 'm-foot' : (seats[0] === GS.pid ? 'm-drive' : 'm-gun');
  if (document.body.dataset.mode !== mode) { document.body.classList.remove('m-foot', 'm-drive', 'm-gun'); document.body.classList.add(mode); document.body.dataset.mode = mode; }
  const reconNow = W.drone && W.drone.mode === 'recon' && W.drone.owner === GS.pid;
  const seat = mode === 'm-drive' ? 'DRIVING' : mode === 'm-gun' ? 'IN THE BACK' : (GS.me && GS.me.crouch ? 'SNEAKING' : 'ON FOOT');
  $('seatInfo').textContent = W.drone ? ((reconNow ? 'RECON ' : 'DRONE ') + Math.max(0, Math.round(W.drone.bat)) + '%') : seat;
};
UI.tick = function (dt) {
  G.tickHint(dt);
  UI._ht = (UI._ht || 0) - dt; if (UI._ht < 0) { UI._ht = 0.25; UI.hud(); }
  const W = Sim.W(); if (!W.M || !GS.me) return;
  // minimap (north-up, centred on you)
  const c = $('mini'), g = c.getContext('2d'), w = 150, h = 150;
  g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,20,14,.75)'; g.fillRect(0, 0, w, h);
  const me = (W.drone && W.drone.mode === 'recon') ? W.drone : (!GS.me.onFoot && W.truck ? W.truck : GS.me);
  const scale = W.map === 'camp' ? 1.2 : 0.8, cx = w / 2 - me.x * scale, cy = h / 2 - me.z * scale;
  const dot = (x, z, col, r) => { g.fillStyle = col; g.fillRect(cx + x * scale - r, cy + z * scale - r, r * 2, r * 2); };
  (W.M.sanct || []).forEach((s) => { g.strokeStyle = '#7dffb0'; g.lineWidth = 2; g.strokeRect(cx + s.x0 * scale, cy + s.z0 * scale, s.w * scale, s.d * scale); });
  if (W.M.pcamp) { g.strokeStyle = '#ff4d4d'; g.beginPath(); g.arc(cx + W.M.pcamp.x * scale, cy + W.M.pcamp.z * scale, 9 * scale, 0, 7); g.stroke(); }
  (W.M.gates || []).forEach((gt) => dot(gt.x, gt.z, '#f0c24b', 4));
  if (W.M.board) dot(W.M.board.x, W.M.board.z, '#e25b4a', 3);
  W.ents.forEach((e) => { if (e.st === 'safe' || e.st === 'cargo') return; dot(e.x, e.z, e.st === 'caged' ? '#ff4d4d' : e.caseAnimal ? '#ffd23f' : '#9ad0f0', e.caseAnimal ? 3.5 : 2); });
  W.poachers.forEach((p) => dot(p.x, p.z, p.st === 'chase' ? '#ff2d4d' : '#b0503a', 2.5));
  W.jeeps.forEach((j) => dot(j.x, j.z, j.cargo ? '#ff2d4d' : '#8a5a3a', 3));
  if (W.truck) dot(W.truck.x, W.truck.z, '#3aff6a', 3.5);
  if (W.dealer) dot(W.dealer.x, W.dealer.z, '#c86bff', 4);
  (W.marks || []).forEach((m) => dot(m.x, m.z, m.k === 'camp' ? '#7af0ff' : m.k === 'poacher' ? '#ffb080' : '#d0f4ff', 2.5));
  if (W.drone) dot(W.drone.x, W.drone.z, '#bff6ff', 3);
  for (const id in GS.others) { const o = GS.others[id]; if (o.s) dot(o.s.x, o.s.z, o.color || '#3ff0ff', 3); }
  dot(me.x, me.z, '#ffffff', 3);
  // wind arrow (points where the wind blows, relative to your view)
  $('windA').style.transform = 'rotate(' + (-(W.wind || 0) + V.camYaw()) + 'rad)';
  // objective pointer
  const tg = UI.target(W);
  const ar = $('arrow');
  if (!tg) ar.classList.add('hidden');
  else {
    const dx = tg.x - me.x, dz = tg.z - me.z, d = Math.hypot(dx, dz);
    if (d < 6) ar.classList.add('hidden');
    else { let ang = Math.atan2(dx, dz) - V.camYaw(); ar.classList.remove('hidden'); ar.style.transform = 'rotate(' + (-ang) + 'rad)'; $('arrowTxt').textContent = tg.label + '  ' + Math.round(d) + 'm'; }
  }
  // name tags
  const tags = $('tags'); let html = '';
  for (const id in GS.others) { const o = GS.others[id]; if (!o.s) continue; const p = V.project(o.s.x, W.M.h(o.s.x, o.s.z) + 2.8, o.s.z); if (p.z > 1 || p.z < -1) continue; html += '<div class="tag" style="left:' + p.x + 'px;top:' + p.y + 'px;color:' + GN.esc(o.color || '#fff') + '">' + GN.esc(o.name || 'Ranger') + '</div>'; }
  tags.innerHTML = html;
  relabel();
};
// where the yellow arrow should point
function poachTarget(W) {
  const tr = W.truck, cargo = tr ? tr.cargo.length : 0, me = GS.me || { x: 0, z: 0 };
  if (cargo && W.dealer) return { x: W.dealer.x, z: W.dealer.z, label: 'SELL AT THE VAN' };
  if (cargo) { const gt = (W.M.gates || []).find((q) => q.to === 'savanna') || (W.M.gates || [])[0]; if (gt) return { x: gt.x, z: gt.z, label: 'BACK TO HIDEOUT' }; }
  const goal = (W.goals || []).find((q) => q.have < q.n);
  if (goal && goal.kind === 'raid' && W.map !== 'camp') { const gt = W.M.gates.find((q) => q.to === 'camp'); if (gt) return { x: gt.x, z: gt.z, label: 'RAID THE SANCTUARY' }; }
  if (goal && goal.kind === 'recon' && W.M.pcamp) return { x: W.M.pcamp.x, z: W.M.pcamp.z, label: 'RECON THE CAMP' };
  if (W.map === 'camp' && W.ents.some((e) => e.st === 'penned' && !(W.pens && W.pens[e.sanct]))) {
    const sc = W.M.sanct && W.M.sanct[0]; if (sc) return { x: sc.gate === 'e' ? sc.x1 : sc.x0, z: 12, label: 'SNEAK \u00b7 UNLOCK PEN' };
  }
  const penned = W.ents.find((e) => e.caseAnimal && e.st === 'penned');
  if (penned) return { x: penned.x, z: penned.z, label: 'NET ' + penned.name.toUpperCase() };
  const wild = W.ents.filter((e) => e.caseAnimal && e.st !== 'cargo' && e.st !== 'safe' && e.st !== 'penned');
  if (wild.length) { wild.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z)); return { x: wild[0].x, z: wild[0].z, label: wild[0].name.toUpperCase() }; }
  if (W.dealer) return { x: W.dealer.x, z: W.dealer.z, label: 'HIDEOUT VAN' };
  return null;
}
UI.target = function (W) {
  if (W.mode === 'poacher') return poachTarget(W);
  const tr = W.truck, cargo = tr ? tr.cargo.length : 0;
  if (W.map === 'camp') {
    if (cargo) { const e = W.ents.find((q) => q.id === tr.cargo[0]); const home = e && (GB.SPECIES[e.sp].biome === 'snow' || GB.SPECIES[e.sp].biome === 'wet') ? 1 : 0; const s = W.M.sanct[home]; return { x: s.x, z: s.z, label: 'UNLOAD AT ' + (home ? 'FROSTMARSH' : 'SUNLANDS') }; }
    const cs = GB.caseById(W.caseId);
    if (cs) { const gt = W.M.gates.find((q) => q.to === cs.biome); return { x: gt.x, z: gt.z, label: GB.BIOMES[cs.biome].name.toUpperCase() + ' GATE' }; }
    return { x: W.M.board.x, z: W.M.board.z, label: 'CASE BOARD' };
  }
  const goal = (W.goals || []).find((q) => q.have < q.n);
  const caseCargo = cargo && tr.cargo.some((id) => { const e = W.ents.find((q) => q.id === id); return e && e.caseAnimal; });
  const remaining = W.ents.filter((e) => e.caseAnimal && e.st !== 'cargo' && e.st !== 'safe');
  if (cargo && (!remaining.length || tr.cargo.length >= Sim.cargoMax() || !goal)) { const gt = W.M.gates.find((q) => q.to === 'camp'); return { x: gt.x, z: gt.z, label: 'BACK TO CAMP' }; }
  const jeep = W.jeeps.find((j) => j.cargo);
  if (jeep && W.ents.some((e) => e.id === jeep.cargo && e.caseAnimal)) return { x: jeep.x, z: jeep.z, label: 'STOP THE JEEP' };
  const caged = W.ents.find((e) => e.caseAnimal && e.st === 'caged');
  if (caged) return { x: caged.x, z: caged.z, label: 'FREE ' + caged.name.toUpperCase() };
  const asleep = remaining.find((e) => e.st === 'asleep');
  if (asleep) return { x: asleep.x, z: asleep.z, label: 'LOAD ' + asleep.name.toUpperCase() };
  if (remaining.length) { const me = GS.me; remaining.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z)); const e = remaining[0]; return { x: e.x, z: e.z, label: e.name.toUpperCase() }; }
  if (caseCargo) { const gt = W.M.gates.find((q) => q.to === 'camp'); return { x: gt.x, z: gt.z, label: 'BACK TO CAMP' }; }
  return null;
};
function relabel() {
  const W = Sim.W(), b = $('bUse'); if (!b || !GS.me) return;
  const p = GS.me.onFoot ? GS.me : W.truck; if (!p) return;
  const db = $('bDrone');
  if (db) {
    let dt = 'DRONE';
    if (!W.drone) dt = W.ents.some((e) => e.st === 'bolt') ? 'LAUNCH' : 'RECON';
    else if (W.drone.mode === 'follow') dt = 'RECON';
    else if (W.drone.mode === 'recon') dt = 'RETURN';
    else dt = 'RECALL';
    const bb = db.querySelector('b'); if (bb && bb.textContent !== dt) bb.textContent = dt;
  }
  const fb = $('bFlare'); if (fb && fb.querySelector('b')) fb.querySelector('b').textContent = W.mode === 'poacher' ? 'DECOY' : 'FLARE';
  let t = 'USE';
  if (W.mode === 'poacher') {
    if (Sim.nearDealer(p.x, p.z)) t = (W.truck && W.truck.cargo.length) ? 'SELL' : 'JOBS';
    else if (Sim.penGateAt(p.x, p.z) && !(W.pens && W.pens[Sim.penGateAt(p.x, p.z).id])) t = 'UNLOCK';
    else if (GS.me.onFoot && W.truck && Math.hypot(GS.me.x - W.truck.x, GS.me.z - W.truck.z) < 4.6) t = 'BOARD';
    else if (!GS.me.onFoot) t = 'EXIT';
    else t = 'NET';
    if (b.dataset.t !== t) { b.dataset.t = t; b.querySelector('b').textContent = t; }
    const recon = W.drone && W.drone.mode === 'recon' && W.drone.owner === GS.pid;
    $('seatInfo').textContent = recon ? 'DRONE RECON' : (document.body.dataset.mode === 'm-drive' ? 'DRIVING' : document.body.dataset.mode === 'm-gun' ? 'IN THE BACK' : (GS.me.crouch ? 'SNEAKING' : 'ON FOOT'));
    return;
  }
  if (Sim.gateAt(p.x, p.z)) t = 'TRAVEL';
  else if (Sim.nearBoard(p.x, p.z)) t = 'CASES';
  else if (Sim.nearShop(p.x, p.z)) t = 'SHOP';
  else if (Sim.nearSupply(p.x, p.z)) t = 'RESTOCK';
  else if (!GS.me.onFoot && W.truck && W.truck.cargo.length && Sim.sanctuaryAt(W.truck.x, W.truck.z)) t = 'UNLOAD';
  else if (GS.me.onFoot && W.ents.some((e) => e.st === 'caged' && e.cage && Math.hypot(e.x - p.x, e.z - p.z) < 3.2)) t = 'FREE';
  else if (GS.me.onFoot && W.ents.some((e) => e.st === 'asleep' && Math.hypot(e.x - GS.me.x, e.z - GS.me.z) < 4.2)) t = 'LOAD';
  else if (GS.me.onFoot && W.truck && Math.hypot(GS.me.x - W.truck.x, GS.me.z - W.truck.z) < 4.6) t = 'BOARD';
  else if (!GS.me.onFoot) t = 'EXIT';
  if (b.dataset.t !== t) { b.dataset.t = t; b.querySelector('b').textContent = t; }
}

UI.board = function () {
  const s = G.save();
  if (GS.role === 'client') { G.toast('The host picks the case. Suggest one in chat!'); return; }
  $('boardList').innerHTML = GB.CASES.map((c, i) => {
    const st = s.stars[c.id] || 0; let open = i === 0 || st || s.stars[GB.CASES[i - 1].id] || s.tut; if (c.id === 'c9') open = !!(st || s.stars.c1 || s.stars.c2 || s.tut);
    return '<button class="casebtn' + (open ? '' : ' lock') + '" data-case="' + c.id + '"' + (open ? '' : ' disabled') + '><b>' + (open ? '' : '\uD83D\uDD12 ') + c.name + '</b><small>' + GB.BIOMES[c.biome].name + (c.night ? ' \u00b7 NIGHT' : '') + ' \u00b7 ' + stars(st) + '</small><span>' + c.brief + '</span></button>';
  }).join('') + '<button class="casebtn roam" id="bRoam"><b>FREE ROAM</b><span>No case, no timer. Explore every biome and rescue any animal for points.</span></button>';
  $('scrBoard').classList.remove('hidden');
  $('boardList').querySelectorAll('[data-case]').forEach((b) => b.addEventListener('click', () => { Snd.fx('ui'); G.acceptCase(b.dataset.case); }));
  $('bRoam').addEventListener('click', () => { Snd.fx('ui'); G.acceptCase(null); });
};
UI.jobs = function () {
  if (GS.role === 'client') { G.toast('The host picks the contract.'); return; }
  const ps = G.psave();
  $('jobList').innerHTML = GB.JOBS.map((c, i) => {
    const st = ps.jobs[c.id] || 0, prev = i === 0 || ps.jobs[GB.JOBS[i - 1].id];
    const open = !!(st || prev);
    return '<button class="casebtn' + (open ? '' : ' lock') + '" data-job="' + c.id + '"' + (open ? '' : ' disabled') + '><b>' + (open ? '' : '\uD83D\uDD12 ') + c.name + '</b><small>' + (c.biome === 'camp' ? 'Sanctuary raid' : GB.BIOMES[c.biome].name) + ' \u00b7 ' + stars(st) + '</small><span>' + c.brief + '</span></button>';
  }).join('');
  $('scrJobs').classList.remove('hidden');
  $('jobList').querySelectorAll('[data-job]').forEach((b) => b.addEventListener('click', () => { Snd.fx('ui'); $('scrJobs').classList.add('hidden'); G.startJob(b.dataset.job); }));
};
UI.jobDone = function (id, n, bonus) { const j = GB.jobById(id); $('doneBody').innerHTML = '<h2>\uD83D\uDCB0 CONTRACT DONE</h2><p class="sub">' + (j ? j.name : '') + '</p><div class="bigstars">' + stars(n) + '</div><p class="sub">+$' + bonus + ' extra from the collector. The animals left alive in their crates. Pick another job at the van.</p>'; $('scrDone').classList.remove('hidden'); };
UI.shop = function () {
  const poach = Sim.W().mode === 'poacher';
  const s = poach ? G.psave() : G.save();
  const list = poach ? GB.PUPGRADES : GB.UPGRADES;
  const bank = poach ? s.cash : s.points;
  $('shopList').innerHTML = '<p class="sub">You have <b>' + (poach ? '$' + bank : bank + ' rescue points') + '</b></p>' + list.map((u) => { const lvl = (s.upg[u.id] || 0); const cost = lvl >= u.max ? null : u.costs[lvl]; return '<div class="shopitem"><div><b>' + u.name + '</b> ' + '\u25a0'.repeat(lvl) + '<i>' + '\u25a1'.repeat(u.max - lvl) + '</i><small>' + u.desc + '</small></div><button class="btn small ' + (cost && bank >= cost ? 'primary' : 'alt') + '" data-up="' + u.id + '"' + (cost ? '' : ' disabled') + '>' + (cost ? (poach ? '$' + cost : cost + ' pts') : 'MAX') + '</button></div>'; }).join('');
  $('scrShop').classList.remove('hidden');
  $('shopList').querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => G.buy(b.dataset.up)));
};
UI.caseDone = function (id, n, bonus) { const cs = GB.caseById(id); $('doneBody').innerHTML = '<h2>\uD83C\uDFC5 CASE CLOSED</h2><p class="sub">' + (cs ? cs.name : '') + '</p><div class="bigstars">' + stars(n) + '</div><p class="sub">+' + bonus + ' bonus rescue points. Your animals are living in the sanctuaries at base camp \u2014 go say hi!</p>'; $('scrDone').classList.remove('hidden'); };
UI.mapScreen = function () {
  const W = Sim.W(), s = G.save();
  $('mapInfo').textContent = (W.M ? GB.BIOMES[W.M.biome].name + ' \u00b7 ' : '') + 'Animals rescued: ' + s.stats.rescued;
  $('guideList').innerHTML = Object.values(GB.SPECIES).map((d) => '<div class="gitem ' + d.temp + '"><b>' + d.emoji + ' ' + d.name + '</b>' + GB.BIOMES[d.biome].name + '<br>' + ({ chill: 'Chill: walk up and dart', feisty: 'Feisty: sneak or use crew', runner: 'Runner: drone freeze ray, or chase' })[d.temp] + '<br>Rescued: ' + (s.rescued[d.id] || 0) + '</div>').join('');
  $('scrMap').classList.remove('hidden');
};

/* ---------- input ---------- */
function joy(zone, knob, on) {
  let id = null, rect = null;
  const pick = (e) => (e.changedTouches ? [...e.changedTouches] : [e]).find((q) => (q.identifier == null ? 'm' : q.identifier) === id);
  const move = (e) => { const t = pick(e); if (!t || !rect) return; let x = (t.clientX - rect.left) / rect.width * 2 - 1, y = (t.clientY - rect.top) / rect.height * 2 - 1; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } knob.style.transform = 'translate(' + (x * 40) + 'px,' + (y * 40) + 'px)'; on(x, y); };
  const start = (e) => { const t = e.changedTouches ? e.changedTouches[0] : e; id = t.identifier == null ? 'm' : t.identifier; rect = zone.getBoundingClientRect(); move(e); e.preventDefault(); };
  const end = (e) => { if (!pick(e)) return; id = null; knob.style.transform = ''; on(0, 0); };
  zone.addEventListener('touchstart', start, { passive: false }); zone.addEventListener('touchmove', move, { passive: false }); zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  zone.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; start(e); try { zone.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } });
  zone.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e); });
  zone.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(e); });
}
UI.bind = function () {
  const nameIn = $('nameIn'); nameIn.value = G.save().name || '';
  const row = $('colorRow');
  GN.COLORS.forEach((c) => { const b = document.createElement('button'); b.style.background = c; b.type = 'button'; if (c === G.save().color) b.classList.add('on'); b.addEventListener('click', () => { G.save().color = c; G.persist(); row.querySelectorAll('button').forEach((q) => q.classList.remove('on')); b.classList.add('on'); }); row.appendChild(b); });
  const saveName = () => { G.save().name = GN.cleanName(nameIn.value || 'Ranger'); G.persist(); };
  const tap = (el, fn) => { el.addEventListener('click', (e) => { e.preventDefault(); Snd.unlock(); fn(); }); };
  tap($('bPlay'), () => { saveName(); Snd.fx('ui'); G.play(); });
  tap($('bPoach'), () => { saveName(); Snd.fx('ui'); G.startPoacher(); });
  tap($('bOnline'), () => { saveName(); $('scrOnline').classList.remove('hidden'); $('scrTitle').classList.add('hidden'); });
  tap($('bOnlineBack'), () => { G.N.leave(); $('scrOnline').classList.add('hidden'); $('scrTitle').classList.remove('hidden'); });
  tap($('bHost'), () => { saveName(); GS.mode = ($('poachT') && $('poachT').checked) ? 'poacher' : 'ranger'; G.N.host(); });
  tap($('bJoin'), () => { saveName(); G.N.join($('codeIn').value); });
  tap($('bHow'), () => $('scrHow').classList.remove('hidden'));
  tap($('bHowBack'), () => $('scrHow').classList.add('hidden'));
  $('assistT').checked = !!G.save().assist; $('assistT').addEventListener('change', () => { G.save().assist = $('assistT').checked; G.persist(); });
  // hold buttons (driving)
  const hold = (el, down, up) => {
    const d = (e) => { e.preventDefault(); Snd.unlock(); el.classList.add('on'); down(); }, u = () => { el.classList.remove('on'); up(); };
    el.addEventListener('touchstart', d, { passive: false }); el.addEventListener('touchend', u); el.addEventListener('touchcancel', u);
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') d(e); }); el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') u(); }); el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') u(); });
  };
  hold($('bGo'), () => { G.IN.th = 1; }, () => { if (G.IN.th > 0) G.IN.th = 0; });
  hold($('bBack'), () => { G.IN.th = -1; }, () => { if (G.IN.th < 0) G.IN.th = 0; });
  hold($('bLeft'), () => { G.IN.st = -1; }, () => { G.IN.st = 0; });
  hold($('bRight'), () => { G.IN.st = 1; }, () => { G.IN.st = 0; });
  hold($('bHb'), () => { G.IN.hb = true; }, () => { G.IN.hb = false; });
  tap($('bSeat'), () => G.press('seat'));
  tap($('bDart'), () => { if (GS.me && GS.me.darts <= 0) { G.toast('Out of darts! Restock at the camp Dart Supply.', true); Snd.fx('click'); return; } if (GS.me) GS.me.darts--; G.press('dart'); UI.hud(); });
  tap($('bFlare'), () => { if (GS.me && GS.me.flares <= 0) { G.toast('No flares left. Restock at camp.', true); return; } if (GS.me) GS.me.flares--; G.press('flare'); UI.hud(); });
  tap($('bUse'), () => G.press('use'));
  tap($('bCrouch'), () => G.press('crouch'));
  tap($('bCrew'), () => G.press('distract'));
  tap($('bHorn'), () => G.press('horn'));
  tap($('bDrone'), () => G.press('drone'));
  tap($('bNet'), () => { if (GS.me && GS.me.nets <= 0) { G.toast('Out of nets. Restock at the hideout van.', true); return; } if (GS.me) GS.me.nets--; G.press('net'); UI.hud(); });
  tap($('bPause'), () => { GS.paused = true; $('assistT2').checked = !!G.save().assist; $('cycleT').checked = !!G.save().cycle; $('bPBoard').textContent = GS.mode === 'poacher' ? '\uD83D\uDCCB JOBS' : '\uD83D\uDCCB CASES'; $('bPShop').textContent = GS.mode === 'poacher' ? '\uD83D\uDCB0 GEAR' : '\u2B50 UPGRADES'; $('bPCamp').textContent = GS.mode === 'poacher' ? '\uD83D\uDCE1 BACK TO HIDEOUT' : '\uD83C\uDFD5\uFE0F RADIO BACK TO CAMP'; $('scrPause').classList.remove('hidden'); });
  tap($('bResume'), () => { GS.paused = false; $('scrPause').classList.add('hidden'); });
  tap($('bPQuit'), () => { G.N.leave(true); GS.mode = 'ranger'; GS.ui = 'title'; UI.closeAll(); UI.show(); });
  tap($('bMute'), () => { G.save().muted = !G.save().muted; G.persist(); Snd.setMuted(G.save().muted); $('bMute').textContent = G.save().muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'; });
  $('bMute').textContent = G.save().muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
  tap($('bMap'), () => UI.mapScreen());
  tap($('bMapBack'), () => $('scrMap').classList.add('hidden'));
  tap($('bBoardBack'), () => $('scrBoard').classList.add('hidden'));
  tap($('bShopBack'), () => $('scrShop').classList.add('hidden'));
  tap($('bJobsBack'), () => $('scrJobs').classList.add('hidden'));
  tap($('bDoneGo'), () => $('scrDone').classList.add('hidden'));
  tap($('bPBoard'), () => { if (GS.mode === 'poacher' || Sim.W().mode === 'poacher') { UI.jobs(); return; } if (Sim.W().map !== 'camp') { G.toast('Case board is at base camp. Radio back first.'); return; } UI.board(); });
  tap($('bPShop'), () => UI.shop());
  tap($('bPCamp'), () => { UI.closeAll(); if (GS.role === 'client') { G.toast('Only the host can radio back.', true); return; } if (GS.mode === 'poacher') { if (Sim.W().map === 'savanna' && Sim.W().dealer) { const d = Sim.W().dealer, t = Sim.W().truck; if (t) { t.x = d.x + 4; t.z = d.z; } const m = GS.me; if (m && m.onFoot) { m.x = d.x + 1; m.z = d.z + 5; } G.toast('Back at the hideout van.'); return; } G.travel('savanna'); return; } if (Sim.W().map === 'camp') { G.toast('You are already at camp.'); return; } G.backToCamp(); });
  $('cycleT').addEventListener('change', () => { G.save().cycle = $('cycleT').checked; G.persist(); });
  $('assistT2').addEventListener('change', () => { G.save().assist = $('assistT2').checked; $('assistT').checked = G.save().assist; G.persist(); });
  joy($('joybase'), $('joyknob'), (x, y) => { G.IN.jx = x; G.IN.jz = -y; });
  // drag to look anywhere that isn't a control
  let lookId = null, lx = 0;
  const isCtl = (t) => t && t.closest && t.closest('#btns,#hudR,#mini,#joyzone,#steer,.screen,.gn-modal');
  const lookStart = (e) => { if (GS.ui !== 'game') return; const t = e.changedTouches ? e.changedTouches[0] : e; if (isCtl(e.target)) return; lookId = t.identifier == null ? 'm' : t.identifier; lx = t.clientX; };
  const lookMove = (e) => { if (lookId == null) return; const t = (e.changedTouches ? [...e.changedTouches] : [e]).find((q) => (q.identifier == null ? 'm' : q.identifier) === lookId); if (!t) return; V.orbit(t.clientX - lx); lx = t.clientX; };
  const lookEnd = (e) => { if ((e.changedTouches ? [...e.changedTouches] : [e]).some((q) => (q.identifier == null ? 'm' : q.identifier) === lookId)) lookId = null; };
  document.addEventListener('touchstart', lookStart, { passive: true }); document.addEventListener('touchmove', lookMove, { passive: true }); document.addEventListener('touchend', lookEnd);
  document.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') lookStart(e); }); document.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') lookMove(e); }); document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') lookEnd(e); });
  // keyboard
  const KD = {};
  const keys = () => {
    G.IN.jx = (KD.d || KD.arrowright ? 1 : 0) - (KD.a || KD.arrowleft ? 1 : 0);
    G.IN.jz = (KD.w || KD.arrowup ? 1 : 0) - (KD.s || KD.arrowdown ? 1 : 0);
    G.IN.th = 0; G.IN.st = 0; G.IN.hb = !!KD.shift;
  };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase(); if (e.repeat) return; KD[k] = 1;
    if (GS.ui === 'game') {
      if (k === 'e' || k === 'enter') $('bUse').click();
      if (k === ' ' || k === 'f') { e.preventDefault(); $('bDart').click(); }
      if (k === 'q') $('bFlare').click();
      if (k === 'c') $('bCrouch').click();
      if (k === 'r') $('bCrew').click();
      if (k === 'h') $('bHorn').click();
      if (k === 'v') { const d = $('bDrone'); if (d) d.click(); }
      if (k === 'n') { const n = $('bNet'); if (n) n.click(); }
      if (k === 't') $('bSeat').click();
      if (k === 'escape') $('bPause').click();
      if (k === 'm') $('bMute').click();
      if (k === 'z') V.orbit(40); if (k === 'x') V.orbit(-40);
    }
    keys();
  });
  addEventListener('keyup', (e) => { KD[e.key.toLowerCase()] = 0; keys(); });
  if (!G.touch) document.body.classList.add('desktop');
  document.body.classList.add('m-foot');
};
})();
