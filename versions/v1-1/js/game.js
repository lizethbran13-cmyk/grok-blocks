/* Grok Blocks - game controller: save, flow, input, host loop, HUD */
(function () {
'use strict';
const GB = window.GB, GN = window.GrokNet, Sim = GB.Sim, V = GB.View, Snd = GB.Snd;
const $ = (id) => document.getElementById(id);
const G = GB.G = {};
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window) && navigator.maxTouchPoints > 0);
G.touch = IS_TOUCH;

/* ---------- save ---------- */
const KEY = 'grokBlocks_v1';
const DEF = () => ({ v: 1, name: '', color: GN.COLORS[0], muted: false, assist: false, points: 0, stars: {}, best: {}, rescued: {}, residents: { sun: [], frost: [] }, upg: { darts: 0, range: 0, calm: 0, engine: 0, cargo: 0, flare: 0 }, tut: 0, cases: 0, stats: { rescued: 0, busted: 0 } });
let save = DEF();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) save = Object.assign(DEF(), s, { upg: Object.assign(DEF().upg, s.upg || {}), residents: Object.assign(DEF().residents, s.residents || {}), stars: s.stars || {}, best: s.best || {}, rescued: s.rescued || {}, stats: Object.assign(DEF().stats, s.stats || {}) }); } catch (e) { /* ignore */ }
if (!save.name) { const gp = GN.savedProfile(); if (gp.hasName) { save.name = gp.name; save.color = gp.color; } }
G.save = () => save;
G.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };
const PKEY = 'grokBlocks_poach_v1';
const PDEF = () => ({ v: 1, cash: 0, jobs: {}, upg: { nets: 0, quiet: 0, engine: 0, cargo: 0, flare: 0, plates: 0 }, stats: { caught: 0, sold: 0, raids: 0, busted: 0 } });
let psave = PDEF();
try { const ps = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (ps && ps.v === 1) psave = Object.assign(PDEF(), ps, { upg: Object.assign(PDEF().upg, ps.upg || {}), jobs: ps.jobs || {}, stats: Object.assign(PDEF().stats, ps.stats || {}) }); } catch (e) { /* ignore */ }
G.psave = () => psave;
G.persistP = () => { try { localStorage.setItem(PKEY, JSON.stringify(psave)); } catch (e) { /* ignore */ } };
G.myName = () => GN.cleanName(save.name || 'Ranger');
Snd.setMuted(!!save.muted);

/* ---------- state ---------- */
const GS = G.GS = { ui: 'title', pid: GN.pid(), role: 'solo', others: {}, me: null, cam: Math.PI, lastT: 0, toastQ: [], caseId: null, carry: [], run: null, night: false, tut: 0, paused: false, mode: 'ranger', jobId: null };
let hintT = 0;
const IN = { jx: 0, jz: 0, th: 0, st: 0, hb: false, aim: 0 };
G.IN = IN;
function myUpg() { return save.upg; }
Sim.init({ assist: () => GS.role !== 'client' && !!save.assist, upg: () => (GS.role === 'client' ? {} : (GS.mode === 'poacher' ? psave.upg : save.upg)), crew: () => GS.role !== 'client' && Object.keys(Wplayers()).length < 2 });
function Wplayers() { return Sim.W().players; }

/* ---------- flow ---------- */
function goMap(map, o) {
  if (!(o && o.keepHint)) { hintT = 0; const h = document.getElementById("hint"); if (h) h.classList.add("hidden"); }
  o = o || {};
  if (GS.role === 'client') return;
  const mode = o.mode || GS.mode || 'ranger';
  GS.mode = mode;
  const PW = Sim.W().players; GS.prevPlayers = {}; for (const id in PW) { const p = PW[id]; GS.prevPlayers[id] = { darts: p.darts, flares: p.flares, nets: p.nets, seat: p.onFoot ? -1 : p.seat }; }
  if (o.fresh) GS.prevPlayers = {};
  const W = Sim.load(map, { caseId: o.caseId || null, night: !!o.night, seed: o.seed, goals: o.goals, carry: GS.carry, residents: save.residents, mode: mode, jobId: o.jobId || (mode === 'poacher' ? GS.jobId : null), heat: o.heat });
  Sim.spawnTruck(); Sim.carry(GS.carry);
  const prev = GS.prevPlayers || {};
  const ids = Object.keys(prev).length ? Object.keys(prev) : [GS.pid];
  if (ids.indexOf(GS.pid) < 0) ids.unshift(GS.pid);
  ids.forEach((id) => {
    const p = Sim.addPlayer(id), q = prev[id];
    if (q) { p.darts = q.darts; p.flares = q.flares; if (q.nets != null) p.nets = q.nets; if (q.seat >= 0 && W.truck && !o.busted) { W.truck.seats[q.seat] = id; p.onFoot = false; p.seat = q.seat; } }
  });
  if (W.truck && W.truck.seats.some((q) => q)) { const t = W.truck; Object.values(Wplayers()).forEach((p) => { if (!p.onFoot) { p.x = t.x; p.z = t.z; } }); if (!t.seats[0] && t.seats.some((q) => q)) t.seats[0] = 'crew0'; }
  GS.me = Wplayers()[GS.pid];
  enterLocal(W);
  if (G.N) G.N.bcast({ t: 'map', map, o: { caseId: W.caseId, night: W.night ? 1 : 0, seed: W.seed }, snap: Sim.pack() });
}
G.goMap = goMap;
// optional day/night cycle (8 min day): visual + mood only; case nights stay fully dark
G.dark = function () { const W = Sim.W(); if (GS.night && W.map !== 'camp') return 1; if (!save.cycle) return 0; const ph = (Date.now() / 480000) % 1; return Math.max(0, Math.min(0.8, -Math.sin(ph * Math.PI * 2) * 1.6)); };
function enterLocal(W) {
  GS.me = Wplayers()[GS.pid] || Sim.addPlayer(GS.pid);
  V.buildTerrain(W.M); V.clearActors(); V.snapCam(GS.me);
  GS.cam = GS.me.ang;
  Snd.music('calm'); Snd.setRoot(W.night ? 146 : W.map === 'camp' ? 196 : 174);
  G.UI.hud();
  const b = GB.BIOMES[W.M.biome];
  G.toast(b.name + (W.night ? '  \u00b7  NIGHT' : ''));
}
G.enterLocal = enterLocal;

G.startCase = function (id) {
  const cs = GB.caseById(id); if (!cs) return;
  GS.caseId = id; GS.carry = []; GS.run = { id, started: Date.now(), rescued: {} };
  GS.night = !!cs.night; GS.tut = cs.tut && !save.tut ? 1 : 0;
  goMap(cs.biome, { caseId: id, night: !!cs.night });
  G.UI.closeAll(); G.UI.showCase(cs);
  if (GS.tut) setTimeout(() => G.hint('Walk with the stick. The giraffe is marked on your tracker. Get close and tap DART.', 8), 1600);
};
G.startPoacher = function () {
  GS.mode = 'poacher'; GS.jobId = null; GS.caseId = null; GS.carry = []; GS.night = false; GS.ui = 'game';
  G.UI.closeAll(); G.UI.show();
  goMap('savanna', { mode: 'poacher', fresh: 1, heat: 0 });
  G.loop();
  G.hint('You\'re the cartoon poacher. NET animals into crates, sell them alive at the hideout van, and don\'t let the rangers catch you. Heat drops when you hide.', 9);
};
G.startJob = function (id) {
  const j = GB.jobById(id); if (!j) return;
  if (GS.role === 'client') { G.toast('The host picks the contract.'); return; }
  GS.mode = 'poacher'; GS.jobId = id; GS.jobBusts = 0; GS.carry = []; GS.caseId = null; GS.night = false;
  const map = j.biome === 'camp' ? 'camp' : j.biome;
  goMap(map, { mode: 'poacher', jobId: id, heat: 0, fresh: 1 });
  G.UI.closeAll();
  G.toast('Contract: ' + j.name);
  G.hint(j.brief, 9);
};
G.play = function () {
  GS.mode = 'ranger';
  GS.ui = 'game'; G.UI.show();
  if (!Sim.W().M) G.freeRoam('camp');
  G.loop();
  if (!save.tut) setTimeout(() => G.hint('Welcome to base camp, Ranger! Follow the yellow arrow to the CASE BOARD and tap CASES.', 9), 1200);
};
G.acceptCase = function (id) {
  G.UI.closeAll();
  if (!id) { GS.night = false; GS.caseId = null; const W = Sim.W(); W.caseId = null; W.goals = []; G.toast('Free roam: drive through any gate to explore.'); G.UI.hud(); return; }
  const cs = GB.caseById(id);
  GS.caseId = id; GS.night = !!cs.night; GS.tut = cs.tut && !save.tut ? 1 : 0;
  const W = Sim.W(); W.caseId = id; W.goals = cs.goals.map((g) => ({ kind: g.kind, species: g.species || '', n: g.n, have: 0 }));
  GS.caseStart = Date.now(); GS.busts = 0; GS.rams = 0;
  G.toast('Case accepted: ' + cs.name); G.hint(cs.brief + '  Follow the arrow to the ' + GB.BIOMES[cs.biome].name + ' gate.', 9);
  if (GS.tut) setTimeout(() => G.hint('Tip: walk up to the green truck and tap BOARD. Drive with GAS + the stick, then drive through the gate.', 9), 9500);
  G.UI.hud();
};
G.freeRoam = function (map) {
  GS.caseId = null; GS.run = null; GS.carry = []; GS.night = false;
  if (GS.mode === 'poacher') goMap(map && map !== 'camp' ? map : 'savanna', { mode: 'poacher', fresh: 1, heat: 0 });
  else { GS.mode = 'ranger'; goMap(map || 'camp', { mode: 'ranger' }); }
  G.UI.closeAll();
};
G.travel = function (to) {
  const W = Sim.W(); if (W.truck) GS.carry = Sim.cargoList();
  const goals = (W.goals || []).map((q) => Object.assign({}, q));
  if (W.mode === 'poacher') { GS.jobId = W.jobId; goMap(to, { mode: 'poacher', jobId: W.jobId, goals: goals, heat: W.heat }); GS.travelLock = 1.5; return; }
  const cid = W.caseId, cs = GB.caseById(cid);
  goMap(to, { caseId: cid, night: !!(cs && cs.night && cs.biome === to), goals: goals, mode: 'ranger' });
  GS.travelLock = 1.5;
};
G.bustedToCamp = function () {
  const goals = Sim.W().goals.map((g) => Object.assign({}, g)), cid = GS.caseId;
  GS.carry = []; goMap('camp', { busted: true });
  if (cid) { const W = Sim.W(); W.caseId = cid; W.goals = goals; GS.caseId = cid; }
  const me = Wplayers()[GS.pid]; if (me) { me.darts = Sim.dartMax(); }
};
G.backToCamp = function () {
  if (Sim.W().mode === 'poacher') { G.travel('camp'); return; }
  if (Sim.W().truck) GS.carry = Sim.cargoList();
  const goals = Sim.W().goals.map((g) => Object.assign({}, g));
  const cid = GS.caseId, night = GS.night;
  goMap('camp', {});
  // keep the case active so deliveries at camp still count
  if (cid) { const W = Sim.W(); W.caseId = cid; W.goals = goals; W.night = false; GS.caseId = cid; }
  if (GS.carry.length) G.toast('Cargo secured. Drive into a sanctuary and tap UNLOAD.');
};

/* ---------- rewards ---------- */
function deliverReward(sp, stars) {
  const def = GB.SPECIES[sp]; if (!def) return;
  const bonus = 1 + (save.upg.calm || 0) * 0;
  const pts = Math.round(def.pts * (stars ? 1 : 1) * (save.assist ? 0.75 : 1));
  save.points += pts; save.stats.rescued++; save.rescued[sp] = (save.rescued[sp] || 0) + 1;
  const home = (def.biome === 'snow' || def.biome === 'wet') ? 'frost' : 'sun';
  save.residents[home].push(sp);
  G.persist(); G.UI.hud();
  return pts;
}
G.onEvents = function (list) {
  for (const e of list) {
    if (e.t === 'sleep') { Snd.fx('sleep'); G.toast(e.name + ' is calm. Load it on the truck!'); if (GS.tut === 1) { GS.tut = 2; G.hint('Stand next to the sleeping animal with the truck close by and tap LOAD.', 8); } }
    else if (e.t === 'load') { Snd.fx('load'); G.toast(e.name + ' loaded \uD83D\uDE9A'); if (GS.tut === 2) { GS.tut = 3; G.hint('Board the truck and follow the arrow to the CAMP gate, then drive into the Sunlands sanctuary and tap UNLOAD.', 9); } }
    else if (e.t === 'deliver') { const pts = deliverReward(e.sp, 0); Snd.fx('deliver'); G.toast(e.name + ' is safe at ' + e.sanct + (pts ? '  +' + pts + ' pts' : '') + ' \uD83C\uDF3F'); }
    else if (e.t === 'casewon') { finishCase(e.stars); }
    else if (e.t === 'spotted') { Snd.fx('spotted'); G.toast('Poachers spotted you! \uD83D\uDEA8', true); Snd.mood('chase'); }
    else if (e.t === 'busted') {
      if (e.poach || Sim.W().mode === 'poacher') {
        Snd.fx('busted'); if (GS.role !== 'client') { psave.stats.busted++; G.persistP(); }
        GS.jobBusts = (GS.jobBusts || 0) + 1; GS.carry = [];
        G.toast('Busted! Rangers walked your crates back out. The animals are fine, and your cash stays in your pocket.', true);
        if (!Sim.W().dealer && GS.role !== 'client') setTimeout(() => G.travel('savanna'), 80);
      } else { Snd.fx('busted'); if (GS.role !== 'client') { save.stats.busted++; G.persist(); } GS.busts = (GS.busts || 0) + 1; G.toast('Busted! The poachers took the truck\'s cargo. Back to base camp — rescued animals are safe.', true); Snd.mood('calm'); GS.carry = []; if (GS.role !== 'client') setTimeout(() => G.bustedToCamp(), 50); }
    }
    else if (e.t === 'bagged') { Snd.fx('spotted'); G.toast('Poachers grabbed the ' + e.name + '! Chase their jeep and bump it to free it.', true); }
    else if (e.t === 'caged') G.toast('They caged the ' + e.name + ' at their camp. Drive in to open the cage.', true);
    else if (e.t === 'freed') { Snd.fx('freed'); G.toast(e.name + ' is free! It is calm and ready to load.'); }
    else if (e.t === 'bolt') { Snd.fx('bolt'); G.toast(e.name + ' is running! Chase it in the truck and cut it off.'); }
    else if (e.t === 'herd') G.toast(e.name + ' is tired of running. Dart it now!');
    else if (e.t === 'windup') { Snd.fx('windup'); G.toast(e.name + ' is about to charge! Back up or tap CREW.', true); }
    else if (e.t === 'knock') { Snd.fx('knock'); if (e.pid === GS.pid) { G.toast(e.name + ' knocked you down! You are fine.', true); const me = Sim.W().players[GS.pid]; if (GS.role === 'client' && me && me.onFoot) { me.knock = 1.2; me.x += Math.sin(e.a || 0) * 2; me.z += Math.cos(e.a || 0) * 2; } } }
    else if (e.t === 'jeepstall') G.toast('The poacher jeep stalls!');
    else if (e.t === 'rammed') { GS.rams = (GS.rams || 0) + 1; Snd.fx('knock'); G.toast('Too rough! ' + e.name + ' bolted. Herd it, don\u2019t ram it.', true); }
    else if (e.t === 'flare') Snd.fx('flare');
    else if (e.t === 'dart') Snd.fx('dart');
    else if (e.t === 'hit') Snd.fx('hit');
    else if (e.t === 'siren') { Snd.fx('siren'); G.toast('The crew cuts the poachers off!'); }
    else if (e.t === 'scared') G.toast('Poachers scatter from the flare!');
    else if (e.t === 'horn') Snd.fx('horn');
    else if (e.t === 'distract') G.toast('Crew is distracting the ' + e.name + '.');
    else if (e.t === 'nodart') G.toast('Out of darts! Restock at camp.', true);
    else if (e.t === 'noflare') G.toast('No flares left.', true);
    else if (e.t === 'noload') G.toast('Nothing calm to load. Dart it first.');
    else if (e.t === 'needtruck') { G.toast(Sim.W().mode === 'poacher' ? 'Bring the truck closer to crate it.' : 'Bring the truck closer.'); if (Sim.W().mode === 'poacher' && GS.me && GS.me.nets != null) GS.me.nets = Math.min(Sim.netMax(), GS.me.nets + 1); }
    else if (e.t === 'cargofull') { G.toast(Sim.W().mode === 'poacher' ? 'No empty crates. Sell at the van first.' : 'The truck is full. Deliver first.'); if (Sim.W().mode === 'poacher' && GS.me && GS.me.nets != null) GS.me.nets = Math.min(Sim.netMax(), GS.me.nets + 1); }
    else if (e.t === 'nocargo') G.toast('The truck is empty.');
    else if (e.t === 'nosanct') G.toast('Drive inside a sanctuary fence to unload.');
    else if (e.t === 'recharge') { Snd.fx('restock'); G.toast(Sim.W().mode === 'poacher' ? 'Nets restocked at the van.' : 'Darts and flares restocked.'); }
    else if (e.t === 'board') Snd.fx('ui');
    else if (e.t === 'dronelaunch') { Snd.fx('dart'); G.toast(e.mode === 'follow' ? ('Drone locked on the ' + e.name + '. Freeze ray slowing it.') : 'Drone up. Fly with the stick. Battery is limited.'); }
    else if (e.t === 'dronemode') G.toast(e.mode === 'recon' ? 'You have the drone. Fly a recon sweep, then tap RETURN.' : e.mode === 'return' ? 'Drone heading back.' : 'Drone following.');
    else if (e.t === 'dronebat') G.toast('Drone battery is empty. It\'s flying home.', true);
    else if (e.t === 'droneret') G.toast('Drone is back. Marks stay on your map for a bit.');
    else if (e.t === 'dronebusy') G.toast('Your friend has the drone right now.');
    else if (e.t === 'recon') { Snd.fx('sleep'); G.toast('Poacher camp marked. It\'s on your map.'); }
    else if (e.t === 'crated') { Snd.fx('load'); if (GS.role !== 'client') { psave.stats.caught++; G.persistP(); } G.toast(e.name + ' is crated and calm. Sell it at the hideout van.'); }
    else if (e.t === 'sold') { Snd.fx('buy'); if (GS.role !== 'client') { psave.cash += e.pay || 0; psave.stats.sold += e.n || 0; G.persistP(); } G.toast('Collector paid $' + e.pay + ' for the crated ' + e.name + '. Off to a private ranch, alive.'); G.UI.hud(); }
    else if (e.t === 'unlocked') { Snd.fx('freed'); if (GS.role !== 'client') { psave.stats.raids++; G.persistP(); } G.toast(e.name + ' lock is open. Net an animal inside.'); }
    else if (e.t === 'needcrouch') G.toast('Crouch before you pick the pen lock.', true);
    else if (e.t === 'guarded') G.toast('A ranger is watching. Hide, or wait until they look away.', true);
    else if (e.t === 'locked') { G.toast('The pen is still locked. Sneak to the gate and tap UNLOCK.', true); if (Sim.W().mode === 'poacher' && GS.me && GS.me.nets != null) GS.me.nets = Math.min(Sim.netMax(), GS.me.nets + 1); }
    else if (e.t === 'toofast') { G.toast(e.name + ' is too fast. Tire it out with the truck, then net it.', true); if (Sim.W().mode === 'poacher' && GS.me && GS.me.nets != null) GS.me.nets = Math.min(Sim.netMax(), GS.me.nets + 1); }
    else if (e.t === 'nonet') { G.toast('Nothing close enough to net.'); if (Sim.W().mode === 'poacher' && GS.me && GS.me.nets != null) GS.me.nets = Math.min(Sim.netMax(), GS.me.nets + 1); }
    else if (e.t === 'jobwon') finishJob(e.stars);
  }
};
function finishJob(stars) {
  const id = Sim.W().jobId || GS.jobId; if (!id || GS.role === 'client') return;
  stars = 3 - ((GS.jobBusts || 0) > 0 ? 1 : 0) - ((GS.jobBusts || 0) > 2 ? 1 : 0);
  stars = Math.max(1, Math.min(3, stars));
  psave.jobs[id] = Math.max(psave.jobs[id] || 0, stars);
  const bonus = [0, 40, 80, 130][stars] || 40;
  psave.cash += bonus; G.persistP();
  GS.jobId = null;
  const W = Sim.W(); W.jobId = null; W.goals = []; W.done = false;
  Snd.fx('win');
  G.UI.jobDone(id, stars, bonus);
}
function finishCase(stars) {
  const id = GS.caseId || Sim.W().caseId; if (!id) return;
  const mins = (Date.now() - (GS.caseStart || Date.now())) / 60000;
  stars = 3 - ((GS.busts || 0) > 0 ? 1 : 0) - (mins > 14 ? 1 : 0) - ((GS.rams || 0) > 1 ? 1 : 0);
  stars = Math.max(1, Math.min(3, stars));
  Snd.fx('win'); Snd.mood('calm');
  const prev = save.stars[id] || 0;
  if (stars > prev) save.stars[id] = stars;
  save.best[id] = Math.max(save.best[id] || 0, stars);
  save.cases++; save.tut = 1; GS.tut = 0;
  const bonus = [0, 60, 120, 200][stars] || 0; save.points += bonus;
  G.persist(); GS.caseId = null; GS.run = null; GS.carry = [];
  const W = Sim.W(); W.caseId = null; W.goals = [];
  G.UI.caseDone(id, stars, bonus);
}

/* ---------- shop ---------- */
G.buy = function (id) {
  if (GS.mode === 'poacher' || (Sim.W() && Sim.W().mode === 'poacher')) {
    const u = GB.PUPGRADES.find((q) => q.id === id); if (!u) return;
    const lvl = psave.upg[id] || 0; if (lvl >= u.max) return;
    const cost = u.costs[lvl]; if (psave.cash < cost) { G.toast('Need $' + cost + ' from the van.', true); return; }
    psave.cash -= cost; psave.upg[id] = lvl + 1; G.persistP(); Snd.fx('buy'); G.toast(u.name + ' bought.'); G.UI.shop(); G.UI.hud();
    return;
  }
  const u = GB.UPGRADES.find((q) => q.id === id); if (!u) return;
  const lvl = save.upg[id] || 0; if (lvl >= u.max) return;
  const cost = u.costs[lvl]; if (save.points < cost) { G.toast('Need ' + cost + ' rescue points.', true); return; }
  save.points -= cost; save.upg[id] = lvl + 1; G.persist(); Snd.fx('buy'); G.toast(u.name + ' upgraded!'); G.UI.shop(); G.UI.hud();
};

/* ---------- interaction ---------- */
function myPos() { const W = Sim.W(); return (!GS.me || !GS.me.onFoot) && W.truck ? W.truck : GS.me; }
function flushAct(pid, a) {
  if (GS.role === 'client') { G.N.send({ t: 'act', a: a }); return; }
  Sim.act(pid, a);
  const ev = Sim.takeEvents(); if (ev.length) { G.onEvents(ev); if (G.N) G.N.bcast({ t: 'ev', l: ev }); }
}
function poachUse(pid) {
  const W = Sim.W(), local = pid === GS.pid;
  const me = W.players[pid]; if (!me) return;
  const p = !me.onFoot && W.truck ? W.truck : me;
  if (Sim.nearDealer(p.x, p.z)) {
    if (W.truck && W.truck.cargo.length) { flushAct(pid, 'sell'); return; }
    if (local) { if (GS.role === 'client') { G.toast('The host picks the contract.'); return; } Sim.recharge(pid); G.onEvents(Sim.takeEvents()); G.UI.jobs(); }
    else Sim.recharge(pid);
    return;
  }
  const gate = Sim.penGateAt(p.x, p.z);
  if (gate && !(W.pens && W.pens[gate.id])) { flushAct(pid, 'unlock'); return; }
  if (me.onFoot && W.truck && Math.hypot(me.x - W.truck.x, me.z - W.truck.z) < 4.6) flushAct(pid, 'board');
  else if (!me.onFoot) flushAct(pid, 'exit');
  else if (local) G.toast('NET an animal, or drive to the hideout van.');
}
G.interact = function (who) {
  const W = Sim.W(), pid = who || GS.pid, local = pid === GS.pid;
  const me = W.players[pid]; if (!me) return;
  if (W.mode === 'poacher') {
    if (GS.role === 'client' && local) {
      const p = !me.onFoot && W.truck ? W.truck : me;
      if (Sim.nearDealer(p.x, p.z) && !(W.truck && W.truck.cargo.length)) { G.toast('The host picks the contract.'); return; }
      G.N.send({ t: 'act', a: 'interact' });
      return;
    }
    poachUse(pid); return;
  }
  const p = !me.onFoot && W.truck ? W.truck : me;
  if (local) {
    if (Sim.nearBoard(p.x, p.z)) { G.UI.board(); return; }
    if (Sim.nearShop(p.x, p.z)) { G.UI.shop(); return; }
    if (Sim.nearSupply(p.x, p.z)) { Sim.recharge(pid); if (GS.role === 'client') G.onEvents([{ t: 'recharge' }]); else G.onEvents(Sim.takeEvents()); return; }
    if (GS.role === 'client') { G.N.send({ t: 'act', a: 'interact' }); return; }
  }
  const g = Sim.gateAt(p.x, p.z);
  if (g) { if (g.to === 'camp') G.backToCamp(); else G.travel(g.to); return; }
  if (me.onFoot && W.ents.some((e) => e.st === 'caged' && e.cage && Math.hypot(e.x - me.x, e.z - me.z) < 3.2)) Sim.act(pid, 'free');
  else if (me.onFoot && W.truck && Math.hypot(me.x - W.truck.x, me.z - W.truck.z) < 4.6) {
    const asleep = W.ents.some((e) => e.st === 'asleep' && Math.hypot(e.x - me.x, e.z - me.z) < 4.2);
    Sim.act(pid, asleep ? 'load' : 'board');
  } else if (!me.onFoot && W.truck.cargo.length && Sim.sanctuaryAt(W.truck.x, W.truck.z)) Sim.act(pid, 'unload');
  else if (!me.onFoot) Sim.act(pid, 'exit');
  else Sim.act(pid, 'load');
  const ev = Sim.takeEvents(); if (ev.length) { G.onEvents(ev); if (G.N) G.N.bcast({ t: 'ev', l: ev }); }
};
G.driveInput = function () { return { th: IN.th || (IN.jz > 0.25 ? IN.jz : IN.jz < -0.5 ? -1 : 0), st: -(IN.st || (Math.abs(IN.jx) > 0.12 ? IN.jx : 0)), hb: IN.hb ? 1 : 0 }; };
// aim: darts go where the camera looks, snapping to an animal near the crosshair (with lead on runners)
const lastPos = {};
G.aim = function () {
  const W = Sim.W(), me = GS.me; if (!me) return { ang: V.camYaw(), tgt: null };
  const o = !me.onFoot && W.truck ? W.truck : me, yaw = V.camYaw();
  let best = null, bd = 0.26;
  for (const e of W.ents) {
    if (e.st === 'asleep' || e.st === 'cargo' || e.st === 'safe' || e.st === 'caged') continue;
    const d = Math.hypot(e.x - o.x, e.z - o.z); if (d > 30 + (save.upg.range || 0) * 9 || d < 0.5) continue;
    let da = Math.atan2(e.x - o.x, e.z - o.z) - yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const sc = Math.abs(da) * (1 + d / 60); if (sc < bd) { bd = sc; best = e; }
  }
  if (!best) return { ang: yaw, tgt: null };
  const lp = lastPos[best.id], spd = 30 + (save.upg.range || 0) * 8;
  let tx = best.x, tz = best.z;
  if (lp) { const t = Math.hypot(best.x - o.x, best.z - o.z) / spd; tx += (best.x - lp.x) * 60 * t * 0.5; tz += (best.z - lp.z) * 60 * t * 0.5; }
  return { ang: Math.atan2(tx - o.x, tz - o.z), tgt: best };
};
G.lockMark = function (t) { const el = document.getElementById('lockMark'); if (!el) return; if (!t) { el.classList.add('hidden'); return; } const W = Sim.W(), sz = (GB.SPECIES[t.sp] || {}).size || 1; const p = V.project(t.x, W.M.h(t.x, t.z) + 1.3 * sz, t.z); if (p.z > 1 || p.z < -1) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.lastChild.textContent = t.name; };
G.trackAim = function () { const W = Sim.W(); for (const e of W.ents) { const l = lastPos[e.id] || (lastPos[e.id] = {}); l.x = e.x; l.z = e.z; } };
G.press = function (a) {
  if (a === 'dart' || a === 'flare') { const am = G.aim(); if (GS.me && GS.me.onFoot) GS.me.ang = am.ang; if (GS.role === 'client') { G.N.send({ t: 'act', a, ang: am.ang }); return; } Snd.unlock(); Sim.act(GS.pid, a, { ang: am.ang }); const ev = Sim.takeEvents(); if (ev.length) { G.onEvents(ev); if (G.N) G.N.bcast({ t: 'ev', l: ev }); } return; }
  Snd.unlock();
  if (a === 'use') { G.interact(); return; }
  if (GS.role === 'client') { const ang = GS.me ? GS.me.ang : 0; G.N.send({ t: 'act', a, ang }); return; }
  Sim.act(GS.pid, a, { ang: GS.me ? GS.me.ang : 0 });
  const ev = Sim.takeEvents(); if (ev.length) { G.onEvents(ev); if (G.N) G.N.bcast({ t: 'ev', l: ev }); }
};

/* ---------- loop ---------- */
let raf = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (GS.lastT || now)) / 1000); GS.lastT = now;
  if (GS.ui !== 'game' || GS.paused) { V.render(G.dark()); return; }
  const W = Sim.W();
  if (GS.role !== 'client') {
    const driving = GS.me && !GS.me.onFoot && W.truck && W.truck.seats[0] === GS.pid;
    const cam = V.camYaw();
    GS.cam = cam;
    const recon = !!(W.drone && W.drone.mode === 'recon' && W.drone.owner === GS.pid);
    if (recon && !GS._reconCam) { V.setCam({ dist: 22, pitch: 1.05 }); GS._reconCam = 1; }
    if (!recon && GS._reconCam) { V.setCam({ dist: 11, pitch: 0.42 }); GS._reconCam = 0; }
    if (recon) Sim.input(GS.pid, { jx: IN.jx, jz: IN.jz, cam });
    else if (driving) { Sim.input(GS.pid, G.driveInput()); V.follow(W.truck.ang, dt); }
    else { Sim.input(GS.pid, { jx: IN.jx, jz: IN.jz, cam }); Sim.moveFoot(GS.me, { jx: IN.jx, jz: IN.jz, cam }, dt); }
    // crew drives when you ride but are not in the driver seat and nobody else drives
    if (W.truck && W.truck.seats[0] && String(W.truck.seats[0]).indexOf('crew') === 0) crewDrive(dt);
    Sim.step(dt);
    const ev = Sim.takeEvents(); if (ev.length) { G.onEvents(ev); if (G.N) G.N.bcast({ t: 'ev', l: ev }); }
    if (G.N) G.N.tick(dt);
    GS.travelLock = Math.max(0, (GS.travelLock || 0) - dt);
    const tr = W.truck;
    if (tr && !GS.travelLock && tr.seats[0] && String(tr.seats[0]).indexOf('crew') !== 0 && Math.abs(tr.speed) > 1) { const g = Sim.gateAt(tr.x, tr.z); if (g) { if (g.to === 'camp') G.backToCamp(); else G.travel(g.to); GS.travelLock = 2; } }
  } else if (G.N) {
    const cam = V.camYaw();
    const di = G.driveInput();
    G.N.send({ t: 'in', jx: IN.jx, jz: IN.jz, cam, th: di.th, st: di.st, hb: di.hb });
    const me = Sim.W().players[GS.pid];
    const reconC = !!(W.drone && W.drone.mode === 'recon' && W.drone.owner === GS.pid);
    if (reconC && !GS._reconCam) { V.setCam({ dist: 22, pitch: 1.05 }); GS._reconCam = 1; }
    if (!reconC && GS._reconCam) { V.setCam({ dist: 11, pitch: 0.42 }); GS._reconCam = 0; }
    if (me && me.onFoot && !reconC) { Sim.moveFoot(me, { jx: IN.jx, jz: IN.jz, cam }, dt); G.N.send({ t: 'pos', x: me.x, z: me.z, a: me.ang, c: me.crouch ? 1 : 0 }); }
    if (W.truck && W.truck.seats[0] === GS.pid) V.follow(W.truck.ang, dt);
  }
  if (save.assist && GS.me && GS.me.darts < Sim.dartMax()) { GS.regen = (GS.regen || 0) + dt; if (GS.regen > 20) { GS.regen = 0; GS.me.darts++; } }
  // riders sit in the truck; host mirrors remote players for tags + minimap
  if (W.truck) for (const id in W.players) { const p = W.players[id]; if (!p.onFoot) { p.x = W.truck.x; p.z = W.truck.z; } }
  if (GS.role === 'host') for (const id in GS.others) { const p = W.players[id]; if (p) GS.others[id].s = { x: p.x, z: p.z, a: p.ang, f: p.onFoot ? 1 : 0, c: p.crouch ? 1 : 0 }; }
  // camera target
  const reconCam = !!(W.drone && W.drone.mode === 'recon' && W.drone.owner === GS.pid);
  const tgt = reconCam ? { x: W.drone.x, z: W.drone.z, ang: W.drone.ang || 0 } : ((GS.me && !GS.me.onFoot && W.truck) ? { x: W.truck.x, z: W.truck.z, ang: W.truck.ang } : GS.me);
  if (tgt) V.frame(tgt, dt);
  V.sync(W, GS.me, GS.others);
  const am = G.aim(); const rt = document.getElementById('reticle'); rt.classList.toggle('lock', !!am.tgt); rt.dataset.n = am.tgt ? am.tgt.name : ''; G.lockMark(am.tgt); G.trackAim();
  Snd.engine(W.truck ? W.truck.speed : 0, !!(W.truck && Math.abs(W.truck.speed) > 1));
  moodCheck();
  V.render(G.dark());
  G.UI.tick(dt);
}
function crewDrive(dt) {
  const W = Sim.W(), tr = W.truck; if (!tr) return;
  let tx = null, tz = null, stop = 6, cap = 13;
  const full = tr.cargo.length >= Sim.cargoMax();
  const wild = W.ents.filter((e) => e.caseAnimal && e.st !== 'cargo' && e.st !== 'safe' && e.st !== 'penned');
  if (W.mode === 'poacher') {
    if (tr.cargo.length && W.dealer) { tx = W.dealer.x; tz = W.dealer.z; stop = 5; cap = 11; }
    else if (tr.cargo.length) { const g = (W.M.gates || []).find((q) => q.to === 'savanna') || (W.M.gates || [])[0]; if (g) { tx = g.x; tz = g.z; stop = 0; } }
    else if (wild.length) {
      const bolt = wild.find((e) => e.st === 'bolt');
      const e = bolt || wild[0];
      if (bolt) { tx = bolt.x + Math.sin(bolt.ang) * 9; tz = bolt.z + Math.cos(bolt.ang) * 9; stop = 0; cap = 12; }
      else { tx = e.x; tz = e.z; stop = GB.SPECIES[e.sp].temp === 'runner' ? 0 : 12; cap = 9; }
    }
  } else if (W.map === 'camp') {
    if (tr.cargo.length) { const s = W.M.sanct[0]; tx = s.x; tz = s.z; stop = 3; }
  } else if (tr.cargo.length && (full || !wild.length)) { const g = W.M.gates.find((q) => q.to === 'camp'); tx = g.x; tz = g.z; stop = 0; }
  else {
    const jeep = W.jeeps.find((j) => j.cargo);
    const bolt = W.ents.find((e) => e.st === 'bolt' && Math.hypot(e.x - tr.x, e.z - tr.z) < 60);
    const sleep = wild.find((e) => e.st === 'asleep');
    if (jeep) { tx = jeep.x + Math.sin(jeep.ang) * 3; tz = jeep.z + Math.cos(jeep.ang) * 3; stop = 0; }
    else if (bolt) { tx = bolt.x + Math.sin(bolt.ang) * 9; tz = bolt.z + Math.cos(bolt.ang) * 9; stop = 0; cap = Math.hypot(bolt.x - tr.x, bolt.z - tr.z) < 14 ? 8 : 13; }
    else if (sleep) { tx = sleep.x; tz = sleep.z; stop = 5; cap = 6; }
    else if (wild.length) { const e = wild[0]; tx = e.x; tz = e.z; stop = GB.SPECIES[e.sp].temp === 'runner' ? 0 : 13; cap = 9; }
  }
  if (tx == null) { Sim.input('crew0', { th: tr.speed > 0.5 ? -0.6 : 0, st: 0 }); return; }
  const d = Math.hypot(tx - tr.x, tz - tr.z);
  let a = Math.atan2(tx - tr.x, tz - tr.z) - tr.ang; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
  let th = d < stop ? (tr.speed > 0.5 ? -0.8 : 0) : (Math.abs(a) > 1.2 ? 0.35 : 1);
  if (tr.speed > cap) th = -0.4;
  // unstick
  GS.stuck = (th > 0 && Math.abs(tr.speed) < 0.6) ? (GS.stuck || 0) + dt : 0;
  if (GS.stuck > 1.2) { GS.unstick = 1; GS.stuck = 0; }
  if (GS.unstick > 0) { GS.unstick -= dt; Sim.input('crew0', { th: -1, st: a > 0 ? -1 : 1 }); return; }
  Sim.input('crew0', { th, st: Math.max(-1, Math.min(1, a * 2)), hb: 0 });
}
let moodT = 0;
function moodCheck() { moodT -= 0.016; if (moodT > 0) return; moodT = 1; const W = Sim.W(); const chase = W.poachers && W.poachers.some((p) => p.st === 'chase') || W.ents.some((e) => e.st === 'bolt'); Snd.mood(chase ? 'chase' : (G.dark() > 0.5 ? 'night' : 'calm')); }
G.loop = () => { cancelAnimationFrame(raf); GS.lastT = 0; raf = requestAnimationFrame(frame); };

/* ---------- hints / toasts ---------- */
G.hint = function (txt, sec) { const h = $('hint'); h.textContent = txt; h.classList.remove('hidden'); hintT = sec || 6; };
G.toast = function (txt, bad) {
  const box = $('toasts');
  // dedupe: a repeat just refreshes the visible toast
  for (const d of box.children) if (d.dataset.txt === txt) { clearTimeout(d._t); d._t = setTimeout(() => drop(d), 2400); return; }
  const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = txt; d.dataset.txt = txt;
  box.insertBefore(d, box.firstChild); // newest on top
  while (box.children.length > 2) box.removeChild(box.lastChild);
  setTimeout(() => d.classList.add('show'), 10);
  d._t = setTimeout(() => drop(d), 2400);
};
function drop(d) { d.classList.remove('show'); setTimeout(() => d.remove(), 300); }
G.tickHint = function (dt) { if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').classList.add('hidden'); } };

/* ---------- boot ---------- */
G.boot = function () {
  V.boot(); G.UI.bind(); G.N.bind();
  Snd.setMuted(!!save.muted);
  if (!G.N.hubCheck()) { GS.ui = 'title'; G.UI.show(); }
  // preload worlds
  setTimeout(() => { GB.World.MAPS.forEach((id) => GB.World.get(id)); }, 400);
};
G.applySnap = function (s) { Sim.unpack(s); if (s && s.mode) GS.mode = s.mode; const W = Sim.W(); if (!V.map || V.map.id !== W.map) { V.buildTerrain(W.M); V.clearActors(); } };
})();
