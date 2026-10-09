/* Grok Blocks - DOM UI, touch controls, screens */
(function () {
'use strict';
const GB = window.GB, GN = window.GrokNet, G = GB.G, GS = G.GS, Sim = GB.Sim, V = GB.View, Snd = GB.Snd;
const $ = (id) => document.getElementById(id);
const UI = G.UI = {};
const SCREENS = ['scrTitle', 'scrOnline', 'scrHow', 'scrPause', 'scrBoard', 'scrShop', 'scrMap', 'scrDone'];
UI.show = function () { const u = GS.ui; SCREENS.forEach((id) => $(id).classList.toggle('hidden', id !== ({ title: 'scrTitle', online: 'scrOnline' }[u]))); $('hud').classList.toggle('hidden', u !== 'game'); };
UI.closeAll = function () { ['scrBoard', 'scrShop', 'scrMap', 'scrDone', 'scrPause', 'scrHow'].forEach((id) => $(id).classList.add('hidden')); GS.paused = false; };
UI.codeBadge = function (code) { const b = $('codeBadge'); if (!code) { b.classList.add('hidden'); return; } b.textContent = 'ROOM ' + code; b.classList.remove('hidden'); };
function stars(n) { return '\u2605'.repeat(n || 0) + '\u2606'.repeat(3 - (n || 0)); }
UI.stars = stars;

UI.hud = function () {
  const s = G.save(), W = Sim.W();
  $('nPts').textContent = s.points;
  const dMax = 6 + (s.upg.darts || 0) * 2;
  $('nDarts').textContent = (GS.me && GS.me.darts != null ? GS.me.darts : dMax) + '/' + dMax;
  $('nFlare').textContent = GS.me && GS.me.flares != null ? GS.me.flares : 2;
  const cargo = W.truck ? W.truck.cargo.length : 0, cap = 2 + (s.upg.cargo || 0);
  $('nCargo').textContent = cargo + '/' + cap;
  $('biomeName').textContent = W.M ? (GB.BIOMES[W.M.biome].name + (W.night && W.map !== 'camp' ? ' \u00b7 NIGHT' : '')) : '';
  const cs = GB.caseById(W.caseId || GS.caseId);
  $('obj').innerHTML = cs ? '<b>' + cs.name + '</b><br>' + (W.goals || []).map((g) => (g.have >= g.n ? '\u2705 ' : '\u25fb\ufe0f ') + (g.kind === 'free' ? 'Free the captured animal' : 'Rescue a ' + GB.SPECIES[g.species].name) + ' ' + g.have + '/' + g.n).join('<br>') : 'Free roam \u00b7 pick a case at the Case Board';
  const seats = W.truck ? W.truck.seats : [];
  const mode = !GS.me || GS.me.onFoot ? 'm-foot' : (seats[0] === GS.pid ? 'm-drive' : 'm-gun');
  if (document.body.dataset.mode !== mode) { document.body.classList.remove('m-foot', 'm-drive', 'm-gun'); document.body.classList.add(mode); document.body.dataset.mode = mode; }
  $('seatInfo').textContent = mode === 'm-drive' ? 'DRIVING' : mode === 'm-gun' ? 'IN THE BACK \u00b7 CREW DRIVES' : (GS.me && GS.me.crouch ? 'SNEAKING' : 'ON FOOT');
};
UI.tick = function (dt) {
  G.tickHint(dt);
  UI._ht = (UI._ht || 0) - dt; if (UI._ht < 0) { UI._ht = 0.25; UI.hud(); }
  const W = Sim.W(); if (!W.M || !GS.me) return;
  // minimap (north-up, centred on you)
  const c = $('mini'), g = c.getContext('2d'), w = 150, h = 150;
  g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,20,14,.75)'; g.fillRect(0, 0, w, h);
  const me = !GS.me.onFoot && W.truck ? W.truck : GS.me;
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
UI.target = function (W) {
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
  let t = 'USE';
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
    const st = s.stars[c.id] || 0, open = i === 0 || st || s.stars[GB.CASES[i - 1].id] || s.tut;
    return '<button class="casebtn' + (open ? '' : ' lock') + '" data-case="' + c.id + '"' + (open ? '' : ' disabled') + '><b>' + (open ? '' : '\uD83D\uDD12 ') + c.name + '</b><small>' + GB.BIOMES[c.biome].name + (c.night ? ' \u00b7 NIGHT' : '') + ' \u00b7 ' + stars(st) + '</small><span>' + c.brief + '</span></button>';
  }).join('') + '<button class="casebtn roam" id="bRoam"><b>FREE ROAM</b><span>No case, no timer. Explore every biome and rescue any animal for points.</span></button>';
  $('scrBoard').classList.remove('hidden');
  $('boardList').querySelectorAll('[data-case]').forEach((b) => b.addEventListener('click', () => { Snd.fx('ui'); G.acceptCase(b.dataset.case); }));
  $('bRoam').addEventListener('click', () => { Snd.fx('ui'); G.acceptCase(null); });
};
UI.shop = function () {
  const s = G.save();
  $('shopList').innerHTML = '<p class="sub">You have <b>' + s.points + '</b> rescue points</p>' + GB.UPGRADES.map((u) => { const lvl = s.upg[u.id] || 0; const cost = lvl >= u.max ? null : u.costs[lvl]; return '<div class="shopitem"><div><b>' + u.name + '</b> ' + '\u25a0'.repeat(lvl) + '<i>' + '\u25a1'.repeat(u.max - lvl) + '</i><small>' + u.desc + '</small></div><button class="btn small ' + (cost && s.points >= cost ? 'primary' : 'alt') + '" data-up="' + u.id + '"' + (cost ? '' : ' disabled') + '>' + (cost ? cost + ' pts' : 'MAX') + '</button></div>'; }).join('');
  $('scrShop').classList.remove('hidden');
  $('shopList').querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => G.buy(b.dataset.up)));
};
UI.caseDone = function (id, n, bonus) { const cs = GB.caseById(id); $('doneBody').innerHTML = '<h2>\uD83C\uDFC5 CASE CLOSED</h2><p class="sub">' + (cs ? cs.name : '') + '</p><div class="bigstars">' + stars(n) + '</div><p class="sub">+' + bonus + ' bonus rescue points. Your animals are living in the sanctuaries at base camp \u2014 go say hi!</p>'; $('scrDone').classList.remove('hidden'); };
UI.mapScreen = function () {
  const W = Sim.W(), s = G.save();
  $('mapInfo').textContent = (W.M ? GB.BIOMES[W.M.biome].name + ' \u00b7 ' : '') + 'Animals rescued: ' + s.stats.rescued;
  $('guideList').innerHTML = Object.values(GB.SPECIES).map((d) => '<div class="gitem ' + d.temp + '"><b>' + d.emoji + ' ' + d.name + '</b>' + GB.BIOMES[d.biome].name + '<br>' + ({ chill: 'Chill: walk up and dart', feisty: 'Feisty: sneak or use crew', runner: 'Runner: chase in the truck' })[d.temp] + '<br>Rescued: ' + (s.rescued[d.id] || 0) + '</div>').join('');
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
  tap($('bOnline'), () => { saveName(); $('scrOnline').classList.remove('hidden'); $('scrTitle').classList.add('hidden'); });
  tap($('bOnlineBack'), () => { G.N.leave(); $('scrOnline').classList.add('hidden'); $('scrTitle').classList.remove('hidden'); });
  tap($('bHost'), () => { saveName(); G.N.host(); });
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
  tap($('bPause'), () => { GS.paused = true; $('assistT2').checked = !!G.save().assist; $('cycleT').checked = !!G.save().cycle; $('scrPause').classList.remove('hidden'); });
  tap($('bResume'), () => { GS.paused = false; $('scrPause').classList.add('hidden'); });
  tap($('bPQuit'), () => { G.N.leave(true); GS.ui = 'title'; UI.closeAll(); UI.show(); });
  tap($('bMute'), () => { G.save().muted = !G.save().muted; G.persist(); Snd.setMuted(G.save().muted); $('bMute').textContent = G.save().muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'; });
  $('bMute').textContent = G.save().muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
  tap($('bMap'), () => UI.mapScreen());
  tap($('bMapBack'), () => $('scrMap').classList.add('hidden'));
  tap($('bBoardBack'), () => $('scrBoard').classList.add('hidden'));
  tap($('bShopBack'), () => $('scrShop').classList.add('hidden'));
  tap($('bDoneGo'), () => $('scrDone').classList.add('hidden'));
  tap($('bPBoard'), () => { if (Sim.W().map !== 'camp') { G.toast('Case board is at base camp. Radio back first.'); return; } UI.board(); });
  tap($('bPShop'), () => UI.shop());
  tap($('bPCamp'), () => { UI.closeAll(); if (GS.role === 'client') { G.toast('Only the host can radio back to camp.', true); return; } if (Sim.W().map === 'camp') { G.toast('You are already at camp.'); return; } G.backToCamp(); });
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
