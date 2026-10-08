/* Grok Blocks - host-authoritative rescue simulation (plain data, no three.js) */
(function () {
'use strict';
const GB = window.GB;
const Sim = GB.Sim = {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hypot = Math.hypot;
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

const W = { t: 0, map: 'camp', caseId: null, night: false, ents: [], poachers: [], jeeps: [], flares: [], darts: [], players: {},
  truck: null, goals: [], freed: 0, done: false, stars: 0, events: [], seq: 1, seed: 1, M: null, rescued: {}, caged: {},
  mode: 'ranger', drone: null, marks: [], heat: 0, dealer: null, jobId: null, pens: { sun: false, frost: false } };
let hooks = { assist: () => false, upg: () => ({}) };
Sim.W = () => W;
Sim.init = (h) => { hooks = Object.assign(hooks, h || {}); };
const nid = () => 'e' + (W.seq++);
function pushEv(e) { W.events.push(e); if (W.events.length > 30) W.events.shift(); }
Sim.takeEvents = function () { const e = W.events; W.events = []; return e; };

function upg() { return hooks.upg(); }
const dartMax = (u) => 6 + (u.darts || 0) * 2;
const cargoMax = (u) => 2 + (u.cargo || 0);
const topSpeed = (u) => 13 + (u.engine || 0) * 2.6;
const netMax = () => 4 + (upg().nets || 0) * 2;
Sim.dartMax = () => dartMax(upg());
Sim.cargoMax = () => cargoMax(upg());
Sim.netMax = () => netMax();

/* ---------- load a map ---------- */
Sim.load = function (map, o) {
  o = o || {};
  W.t = 0; W.map = map; W.M = GB.World.get(map); W.caseId = o.caseId || null; W.night = !!o.night; W.seed = o.seed || (Math.random() * 1e9 | 0);
  W.ents = []; W.poachers = []; W.jeeps = []; W.flares = []; W.darts = []; W.events = []; W.done = false; W.freed = 0; W.stars = 0;
  W.rescued = {}; W.caged = {};
  W.wind = ((W.seed % 628) / 100);
  W.mode = o.mode === 'poacher' ? 'poacher' : 'ranger';
  W.drone = null; W.marks = []; W.dealer = null; W.jobId = null; W.pens = { sun: false, frost: false };
  W.heat = W.mode === 'poacher' ? clamp(+o.heat || 0, 0, 100) : 0;
  const cs = GB.caseById(W.caseId);
  W.goals = o.goals ? o.goals.map((g) => ({ kind: g.kind, species: g.species || '', n: g.n, have: g.have || 0 })) : (cs ? cs.goals.map((g) => ({ kind: g.kind, species: g.species || '', n: g.n, have: 0 })) : []);
  if (W.mode === 'poacher') { loadPoacher(map, o); W.truck = null; return W; }
  const carried = {}; (o.carry || []).forEach((c) => { if (c.caseAnimal) carried[c.sp] = (carried[c.sp] || 0) + 1; });
  const rnd = GB.World.rng((W.seed ^ 0x9e3779b9) >>> 0);
  if (map !== 'camp') {
    const spots = W.M.spots.slice();
    const takeSpot = () => spots.length ? spots.splice((rnd() * spots.length) | 0, 1)[0] : { x: (rnd() * 40 - 20), z: (rnd() * 40 - 20) };
    const counts = {};
    const caseHere = cs && cs.biome === map;
    if (caseHere) W.goals.forEach((g) => { if (g.kind === 'rescue') counts[g.species] = (counts[g.species] || 0) + Math.max(0, g.n - g.have); });
    const freeGoal = caseHere && W.goals.find((g) => g.kind === 'free' && g.have < g.n);
    for (const sp in carried) counts[sp] = Math.max(0, (counts[sp] || 0) - carried[sp]);
    if (freeGoal && counts.camel) counts.camel--;
    for (const sp in counts) for (let i = 0; i < counts[sp]; i++) { const s = takeSpot(); spawnAnimal(sp, s.x, s.z, { caseAnimal: true }); }
    const pool = Object.keys(GB.SPECIES).filter((k) => GB.SPECIES[k].biome === (cs ? cs.biome : map));
    for (let i = 0; i < 5; i++) { const s = takeSpot(); spawnAnimal(pool[(rnd() * pool.length) | 0], s.x, s.z, { ambient: true }); }
    // poachers + jeeps
    const np = cs && cs.id === 'c7' ? 4 : 3;
    for (let i = 0; i < np; i++) { const a = rnd() * TAU, d = 24 + rnd() * 30; spawnPoacher(Math.cos(a) * d, Math.sin(a) * d - 8); }
    for (let i = 0; i < 2; i++) spawnJeep((rnd() * 2 - 1) * 30, -20 - rnd() * 20);
    if (freeGoal) {
      // the convoy: a poacher jeep already hauling a caged camel around the trail
      const j = spawnJeep(W.M.trail[5][0], W.M.trail[5][1]); j.convoy = true;
      const an = spawnAnimal('camel', j.x, j.z, { caseAnimal: true }); an.st = 'caged'; j.cargo = an.id;
    }
  }
  if (map === 'camp' && o.residents) {
    for (const s of W.M.sanct) (o.residents[s.id] || []).slice(-14).forEach((sp) => {
      if (!GB.SPECIES[sp]) return;
      const e = spawnAnimal(sp, s.x + (rnd() - 0.5) * (s.w - 8), s.z + (rnd() - 0.5) * (s.d - 8), { st: 'safe', sanct: s.id, resident: true });
      void e;
    });
  }
  W.truck = null;
  return W;
};

function loadPoacher(map, o) {
  const job = GB.jobById(o.jobId || null);
  W.jobId = job ? job.id : (o.jobId || null);
  if (!o.goals) W.goals = job ? job.goals.map((g) => ({ kind: g.kind, species: g.species || '', n: g.n, have: 0 })) : [];
  const rnd = GB.World.rng((W.seed ^ 0x51ed) >>> 0);
  const carried = {};
  (o.carry || []).forEach((c) => { carried[c.sp] = (carried[c.sp] || 0) + 1; });
  if (map === 'camp') {
    const pens = [['giraffe', 'sun'], ['zebra', 'sun'], ['flamingo', 'frost'], ['panda', 'frost']];
    pens.forEach((pair) => {
      const sc = W.M.sanct.find((q) => q.id === pair[1]);
      if (!sc) return;
      const raid = job && job.id === 'j3' && pair[1] === 'sun';
      spawnAnimal(pair[0], sc.x + (rnd() - 0.5) * 12, sc.z + (rnd() - 0.5) * 10, { st: 'penned', penned: true, sanct: pair[1], caseAnimal: !!raid });
    });
    [[-18, 22], [-32, 24], [30, 22], [42, 4]].forEach((pt) => spawnPoacher(pt[0], pt[1]));
    spawnJeep(8, -20); spawnJeep(-8, 28);
    return;
  }
  const pc = W.M.pcamp;
  W.dealer = pc ? { x: pc.x, z: pc.z + 2 } : { x: 0, z: 0 };
  const counts = {};
  W.goals.forEach((g) => { if (g.kind === 'sell' && g.species) counts[g.species] = (counts[g.species] || 0) + Math.max(0, g.n - g.have); });
  for (const sp in counts) counts[sp] = Math.max(0, counts[sp] - (carried[sp] || 0));
  const spots = (W.M.spots || []).slice();
  const take = () => spots.length ? spots.splice((rnd() * spots.length) | 0, 1)[0] : { x: (rnd() * 30 - 15), z: (rnd() * 30 - 15) };
  for (const sp in counts) for (let i = 0; i < counts[sp]; i++) { const pt = take(); spawnAnimal(sp, pt.x, pt.z, { caseAnimal: true }); }
  const pool = Object.keys(GB.SPECIES).filter((k) => GB.SPECIES[k].biome === map);
  for (let i = 0; i < 4 && pool.length; i++) { const pt = take(); spawnAnimal(pool[(rnd() * pool.length) | 0], pt.x, pt.z, { ambient: true }); }
  for (let i = 0; i < 3; i++) { const a = rnd() * TAU, d = 30 + rnd() * 26; spawnPoacher(Math.cos(a) * d, Math.sin(a) * d); }
  for (let i = 0; i < 2; i++) spawnJeep((rnd() * 2 - 1) * 34, -8 - rnd() * 24);
  if (W.dealer) W.poachers.forEach((q) => { if (hypot(q.x - W.dealer.x, q.z - W.dealer.z) < 18) { q.x += 26; q.z -= 12; } });
}
Sim.carry = function (list) {
  if (!W.truck) return;
  (list || []).forEach((c) => { const e = spawnAnimal(c.sp, W.truck.x, W.truck.z, { st: 'cargo', cargo: true, caseAnimal: !!c.caseAnimal }); W.truck.cargo.push(e.id); });
};
Sim.cargoList = function () { if (!W.truck) return []; return W.truck.cargo.map((id) => W.ents.find((e) => e.id === id)).filter(Boolean).map((e) => ({ sp: e.sp, caseAnimal: !!e.caseAnimal })); };
Sim.spawnTruck = function (x, z, ang) {
  let s = W.M.truckSpawn;
  if (x == null && W.mode === 'poacher' && W.dealer) s = { x: W.dealer.x + 4, z: W.dealer.z + 1, ang: Math.PI };
  W.truck = { x: x != null ? x : s.x, z: z != null ? z : s.z, ang: ang != null ? ang : s.ang, speed: 0, seats: [null, null, null], cargo: [], handbrake: false };
};
function spawnAnimal(sp, x, z, extra) {
  const def = GB.SPECIES[sp];
  const e = { id: nid(), kind: 'animal', sp, name: def.name, x, z, ang: Math.random() * TAU, st: 'roam', calm: 0, fear: 0, cargo: false, sanct: null, cage: null,
    wander: 1, wa: 0, telegraph: 0, chargeT: 0, distracted: 0, rest: 0, caseAnimal: false, ambient: false };
  Object.assign(e, extra || {});
  e.y = W.M.h(e.x, e.z);
  W.ents.push(e); return e;
}
function spawnPoacher(x, z) {
  const p = { id: nid(), kind: 'poacher', x, z, ang: 0, st: 'patrol', alert: 0, scared: 0, grab: null, patrol: 1, pa: 0, jeep: null };
  p.y = W.M.h(x, z); W.poachers.push(p); return p;
}
function spawnJeep(x, z) { const j = { id: nid(), kind: 'jeep', x, z, ang: Math.PI, speed: 0, cargo: null, home: false }; W.jeeps.push(j); return j; }

/* ---------- players ---------- */
Sim.addPlayer = function (pid) {
  let s = W.M.spawn, n = Object.keys(W.players).length;
  if (W.mode === 'poacher' && W.map !== 'camp' && W.M.pcamp) s = { x: W.M.pcamp.x + 1.5, z: W.M.pcamp.z + 6, ang: Math.PI };
  const flares = W.mode === 'poacher' ? (1 + (upg().flare || 0)) : (2 + (upg().flare || 0));
  const p = { id: pid, x: s.x + n * 1.3, z: s.z, ang: s.ang, onFoot: true, seat: -1, crouch: false, inv: W.mode === 'poacher' ? 3 : 0, darts: dartMax(upg()), flares, nets: netMax(), cargoLost: 0 };
  p.y = W.M.h(p.x, p.z); W.players[pid] = p; return p;
};
Sim.removePlayer = function (pid) { const p = W.players[pid]; if (!p) return; if (!p.onFoot) exitTruck(p); delete W.players[pid]; };
Sim.recharge = function (pid) {
  const p = W.players[pid]; if (!p) return;
  p.darts = dartMax(upg());
  p.flares = W.mode === 'poacher' ? (1 + (upg().flare || 0)) : (2 + (upg().flare || 0));
  p.nets = netMax();
  pushEv({ t: 'recharge' });
};

/* ---------- movement helpers ---------- */
function tryMove(ent, nx, nz, r, climb) {
  const M = W.M, h = M.h(ent.x, ent.z);
  if (M.can(nx, ent.z, r, h, climb)) ent.x = nx; else nx = ent.x;
  if (M.can(ent.x, nz, r, M.h(ent.x, ent.z), climb)) ent.z = nz;
  ent.y = M.h(ent.x, ent.z);
}
function steer(ent, tx, tz, spd, dt, r, climb) {
  const a = Math.atan2(tx - ent.x, tz - ent.z);
  ent.ang += clamp(angDiff(a, ent.ang), -dt * 4, dt * 4);
  tryMove(ent, ent.x + Math.sin(ent.ang) * spd * dt, ent.z + Math.cos(ent.ang) * spd * dt, r, climb);
}
function wander(ent, dt, spd, r) {
  ent.wander -= dt;
  if (ent.wander <= 0) { ent.wander = 2 + Math.random() * 4; ent.wa = Math.random() * TAU; }
  ent.ang += clamp(angDiff(ent.wa, ent.ang), -dt * 2, dt * 2);
  tryMove(ent, ent.x + Math.sin(ent.ang) * spd * dt, ent.z + Math.cos(ent.ang) * spd * dt, r, 1);
}

/* ---------- actions ---------- */
const inputs = {};
Sim.input = (pid, inp) => { inputs[pid] = inp || {}; };
Sim.act = function (pid, a, d) {
  const p = W.players[pid]; if (!p) return; d = d || {};
  if (a === 'board') { if (p.onFoot && W.truck && hypot(p.x - W.truck.x, p.z - W.truck.z) < 4.6) boardTruck(p); return; }
  if (a === 'exit') { if (!p.onFoot) exitTruck(p); return; }
  if (a === 'seat') {
    if (p.onFoot || !W.truck) return; const tr = W.truck, i = tr.seats.indexOf(p.id);
    if (i === 0) { const k = tr.seats[1] == null ? 1 : tr.seats[2] == null ? 2 : -1; if (k < 0) return; tr.seats[0] = 'crew0'; tr.seats[k] = p.id; p.seat = k; pushEv({ t: 'seat', pid: p.id, seat: k }); }
    else if (tr.seats[0] == null || String(tr.seats[0]).indexOf('crew') === 0) { tr.seats[i] = null; tr.seats[0] = p.id; p.seat = 0; pushEv({ t: 'seat', pid: p.id, seat: 0 }); }
    return;
  }
  if (a === 'crouch') { if (p.onFoot) p.crouch = !p.crouch; return; }
  if (a === 'dart') { fireDart(p, +d.ang || aimAng(p)); return; }
  if (a === 'flare') { if (typeof d.ang === 'number') p.ang = d.ang; fireFlare(p); return; }
  if (a === 'load') { tryLoad(p); return; }
  if (a === 'unload') { tryUnload(); return; }
  if (a === 'distract') { doDistract(p); return; }
  if (a === 'free') { const e = nearest(W.ents, p.x, p.z, (q) => q.st === 'caged' && q.cage, 3.2); if (e) freeAnimal(e, null); return; }
  if (a === 'horn') { pushEv({ t: 'horn' }); herdPulse(); return; }
  if (a === 'drone') { droneAct(pid); return; }
  if (a === 'net') { tryNet(p); return; }
  if (a === 'sell') { trySell(); return; }
  if (a === 'unlock') { tryUnlock(p); return; }
};
function aimAng(p) { const inp = inputs[p.id]; return inp && typeof inp.aim === 'number' ? inp.aim : p.ang; }
function boardTruck(p) { const i = W.truck.seats.indexOf(null); if (i < 0) { pushEv({ t: 'full' }); return; } W.truck.seats[i] = p.id; p.onFoot = false; p.seat = i; p.crouch = false; pushEv({ t: 'board', seat: i, pid: p.id }); }
function exitTruck(p) { const i = W.truck.seats.indexOf(p.id); if (i >= 0) W.truck.seats[i] = null; if (!W.truck.seats.some((q) => q && W.players[q])) W.truck.seats = W.truck.seats.map((q) => (q && String(q).indexOf('crew') === 0 ? null : q)); const side = i === 1 ? 1 : -1; p.onFoot = true; p.seat = -1; p.x = W.truck.x + Math.cos(W.truck.ang) * side * 2.4; p.z = W.truck.z - Math.sin(W.truck.ang) * side * 2.4; if (!W.M.can(p.x, p.z, 0.3, W.M.h(W.truck.x, W.truck.z), 2)) { p.x = W.truck.x - Math.sin(W.truck.ang) * 3; p.z = W.truck.z - Math.cos(W.truck.ang) * 3; } p.y = W.M.h(p.x, p.z); }
function fireDart(p, ang) {
  const u = upg(), spd = 30 + (u.range || 0) * 8;
  const x = p.onFoot ? p.x : W.truck.x + Math.cos(W.truck.ang) * 1.1, z = p.onFoot ? p.z : W.truck.z - Math.sin(W.truck.ang) * 1.1;
  W.darts.push({ x, z, vx: Math.sin(ang) * spd, vz: Math.cos(ang) * spd, life: 1.15 + (u.range || 0) * 0.3 });
  pushEv({ t: 'dart' });
}
function fireFlare(p) {
  const x = (p.onFoot ? p.x : W.truck.x) + Math.sin(p.ang) * 7, z = (p.onFoot ? p.z : W.truck.z) + Math.cos(p.ang) * 7;
  W.flares.push({ x, z, life: 7 }); pushEv({ t: 'flare' });
}
function nearest(list, x, z, pred, r) { let b = null, bd = r; for (const e of list) { if (pred && !pred(e)) continue; const d = hypot(e.x - x, e.z - z); if (d < bd) { bd = d; b = e; } } return b; }
function tryLoad(p) {
  if (!W.truck) return;
  if (W.truck.cargo.length >= cargoMax(upg())) { pushEv({ t: 'cargofull' }); return; }
  const x = p.onFoot ? p.x : W.truck.x, z = p.onFoot ? p.z : W.truck.z;
  const e = nearest(W.ents, x, z, (q) => q.st === 'asleep' && !q.cargo && !q.cage, 4.2);
  if (!e) { pushEv({ t: 'noload' }); return; }
  if (hypot(e.x - W.truck.x, e.z - W.truck.z) > 6.5) { pushEv({ t: 'needtruck' }); return; }
  e.cargo = true; e.st = 'cargo'; W.truck.cargo.push(e.id); pushEv({ t: 'load', sp: e.sp, name: e.name });
}
function sanctuaryAt(x, z) { if (!W.M.sanct) return null; for (const s of W.M.sanct) if (x > s.x0 + 1 && x < s.x1 - 1 && z > s.z0 + 1 && z < s.z1 - 1) return s; return null; }
function tryUnload() {
  if (!W.truck || !W.truck.cargo.length) { pushEv({ t: 'nocargo' }); return; }
  const s = sanctuaryAt(W.truck.x, W.truck.z); if (!s) { pushEv({ t: 'nosanct' }); return; }
  const id = W.truck.cargo.shift(), e = W.ents.find((q) => q.id === id);
  if (!e) return;
  e.cargo = false; e.st = 'safe'; e.sanct = s.id;
  const rnd = Math.random;
  e.x = clamp(s.x + (rnd() - 0.5) * (s.w * 0.6), s.x0 + 3, s.x1 - 3);
  e.z = clamp(s.z + (rnd() - 0.5) * (s.d * 0.6), s.z0 + 3, s.z1 - 3);
  credit(e); pushEv({ t: 'deliver', sp: e.sp, name: e.name, sanct: s.name }); checkDone();
}
function credit(e) { for (const g of W.goals) if (g.kind === 'rescue' && g.species === e.sp && g.have < g.n) { g.have++; W.rescued[e.sp] = (W.rescued[e.sp] || 0) + 1; return; } W.rescued[e.sp] = (W.rescued[e.sp] || 0) + 1; }
function checkDone() { if (W.goals.length && !W.done && W.goals.every((g) => g.have >= g.n)) { W.done = true; W.stars = rate(); pushEv({ t: W.mode === 'poacher' ? 'jobwon' : 'casewon', stars: W.stars, job: W.jobId || '' }); } }
function rate() { let s = 3; if (W.t > 480) s--; if (W.t > 780) s--; for (const p of Object.values(W.players)) if (p.cargoLost) s--; return clamp(s, 1, 3); }
function doDistract(p) {
  const x = p.onFoot ? p.x : W.truck.x, z = p.onFoot ? p.z : W.truck.z;
  const chasers = W.poachers.filter((q) => (q.st === 'chase' || q.st === 'alert') && hypot(q.x - x, q.z - z) < 26);
  if (!chasers.length && W.jeeps.some((j) => j.chase && hypot(j.x - x, j.z - z) < 26)) chasers.push({ x: 1e5, z: 1e5 });
  if (chasers.length) { chasers.forEach((q) => { q.scared = 5; q.st = 'flee'; q.ang = Math.atan2(q.x - x, q.z - z); }); W.jeeps.forEach((j) => { if (hypot(j.x - x, j.z - z) < 26) { j.scared = 4; j.chase = 0; } }); pushEv({ t: 'siren' }); return; }
  const e = nearest(W.ents, x, z, (q) => q.st === 'roam' || q.st === 'alert' || q.st === 'windup' || q.st === 'tired', 18);
  if (!e) return;
  e.distracted = 6; e.st = e.st === 'windup' ? 'roam' : e.st; e.ang = Math.atan2(x - e.x, z - e.z) + Math.PI; pushEv({ t: 'distract', name: e.name });
}
function herdPulse() {
  if (!W.truck) return;
  for (const e of W.ents) if (e.st === 'bolt' && hypot(e.x - W.truck.x, e.z - W.truck.z) < 14) e.fear = Math.max(0, e.fear - 1.5);
}

/* ---------- animal AI ---------- */
function seenBy(e, r) {
  let best = null, bd = r;
  for (const p of Object.values(W.players)) {
    const d = hypot(p.x - e.x, p.z - e.z);
    // wind: upwind of the animal it smells you sooner, downwind you can sneak closer
    const wd = Math.abs(angDiff(Math.atan2(e.x - p.x, e.z - p.z), W.wind || 0)), wf = wd < 0.8 ? 1.4 : wd > 2.3 ? 0.65 : 1;
    const rr = (p.crouch ? r * 0.5 : r) * wf;
    const cover = p.crouch && W.M.inCover(p.x, p.z) ? 0.45 : 1;
    if (d < rr * cover && d < bd) { bd = d; best = p; }
  }
  if (W.truck && Math.abs(W.truck.speed) > 3 && hypot(W.truck.x - e.x, W.truck.z - e.z) < r + 2) return { x: W.truck.x, z: W.truck.z, truck: true };
  return best;
}
function animalsTick(dt) {
  const u = upg();
  for (const e of W.ents) {
    const sp = GB.SPECIES[e.sp];
    if (e.st === 'cargo') { e.x = W.truck.x - Math.sin(W.truck.ang) * 2; e.z = W.truck.z - Math.cos(W.truck.ang) * 2; e.y = W.M.h(e.x, e.z); continue; }
    if (e.st === 'caged') { if (e.cage) { e.x = e.cage.x; e.z = e.cage.z; } else { const j = W.jeeps.find((q) => q.cargo === e.id); if (j) { e.x = j.x; e.z = j.z; } } e.y = W.M.h(e.x, e.z); continue; }
    if (e.st === 'safe' || e.st === 'penned') {
      const sc = W.M.sanct && W.M.sanct.find((q) => q.id === e.sanct);
      if (sc && (e.x < sc.x0 + 3 || e.x > sc.x1 - 3 || e.z < sc.z0 + 3 || e.z > sc.z1 - 3)) steer(e, sc.x, sc.z, 1, dt, 0.4, 1); else wander(e, dt, 0.9, 0.4);
      continue;
    }
    e.distracted = Math.max(0, e.distracted - dt);
    const sense = (sp.temp === 'runner' ? 12 : sp.temp === 'feisty' ? 9 : 6.5) * (W.night ? 0.75 : 1);
    const who = e.distracted > 0 ? null : seenBy(e, sense);
    if (e.st === 'roam' || e.st === 'alert' || e.st === 'tired') {
      if (e.st === 'tired') { e.rest -= dt; wander(e, dt, 1.3, 0.5); if (e.rest <= 0) e.st = 'roam'; }
      else if (e.st === 'alert' && who) steer(e, who.x, who.z, 0.8, dt, 0.5, 1);
      else wander(e, dt, sp.temp === 'chill' ? 1.2 : 1.7, 0.5);
      if (who && e.st !== 'tired') {
        if (sp.temp === 'chill') e.st = 'alert';
        else if (sp.temp === 'feisty') { e.st = 'windup'; e.telegraph = 0.75; e.ang = Math.atan2(who.x - e.x, who.z - e.z); pushEv({ t: 'windup', name: e.name }); }
        else { e.st = 'bolt'; e.fear = sp.fly ? 9 : 7; e.ang = Math.atan2(e.x - who.x, e.z - who.z); pushEv({ t: 'bolt', name: e.name }); }
      } else if (!who && e.st === 'alert') e.st = 'roam';
    } else if (e.st === 'windup') {
      e.telegraph -= dt;
      if (e.telegraph <= 0) { e.st = 'charge'; e.chargeT = 1.5; }
    } else if (e.st === 'charge') {
      e.chargeT -= dt;
      const tgt = Object.values(W.players).filter((p) => p.onFoot)[0] || Object.values(W.players)[0];
      if (tgt) steer(e, tgt.x, tgt.z, 9, dt, 0.6, 1);
      for (const p of Object.values(W.players)) {
        if (p.inv <= 0 && hypot(p.x - e.x, p.z - e.z) < 1.2 + sp.size * 0.35) {
          p.inv = 1.3; const a = Math.atan2(p.x - e.x, p.z - e.z);
          if (p.onFoot) { tryMove(p, p.x + Math.sin(a) * 2, p.z + Math.cos(a) * 2, 0.3, 1); p.knock = 1.2; }
          pushEv({ t: 'knock', pid: p.id, name: e.name, a: Math.round(a * 100) / 100 });
          e.chargeT = Math.min(e.chargeT, 0.2);
        }
      }
      if (e.chargeT <= 0) e.st = 'roam';
    } else if (e.st === 'bolt') {
      e.fear -= dt * (hooks.assist() ? 1.35 : 1);
      const beamed = !!(W.drone && W.drone.mode === 'follow' && W.drone.beam && W.drone.target === e.id);
      if (beamed) e.fear -= dt * 1.2;
      e.frost = beamed ? 1 : 0;
      // flee along the trail: pick the trail point most "ahead" of the threat
      const tr = W.M.trail;
      let best = null, bs = -1e9;
      const threat = W.truck || { x: 0, z: 0 };
      for (let i = 0; i < tr.length; i += 2) {
        const d = hypot(tr[i][0] - e.x, tr[i][1] - e.z);
        const away = hypot(tr[i][0] - threat.x, tr[i][1] - threat.z);
        const sc = away * 1.4 - d;
        if (sc > bs) { bs = sc; best = tr[i]; }
      }
      const runSpd = (sp.fly ? 12.5 : 10) * (e.frost ? 0.36 : 1);
      steer(e, best[0], best[1], runSpd, dt, 0.4, 2);
      if (W.truck) {
        const ahead = hypot(W.truck.x - (e.x + Math.sin(e.ang) * 7), W.truck.z - (e.z + Math.cos(e.ang) * 7));
        const close = hypot(W.truck.x - e.x, W.truck.z - e.z);
        if (ahead < 6 && close < 11 && Math.abs(W.truck.speed) < 9) { e.st = 'tired'; e.rest = 4; e.fear = 0; pushEv({ t: 'herd', name: e.name }); }
      }
      if (e.fear <= 0 && e.st === 'bolt') { e.st = 'tired'; e.rest = 3.5; }
    }
    if (e.st !== 'bolt') e.frost = 0;
    if (e.calm > 0 && e.st !== 'asleep' && e.st !== 'caged' && e.st !== 'safe' && e.st !== 'cargo' && e.st !== 'penned') {
      e.calm -= dt * 0.22;
      const need = sp.calm * (1 - (u.calm || 0) * 0.2);
      if (e.calm >= need) { e.st = 'asleep'; pushEv({ t: 'sleep', name: e.name, sp: e.sp }); }
    }
  }
}

/* ---------- poachers ---------- */
function poachersTick(dt) {
  const assist = hooks.assist();
  for (const f of W.flares) for (const p of W.poachers) if (hypot(p.x - f.x, p.z - f.z) < 14 && p.scared < 1) { p.scared = 5; p.ang = Math.atan2(p.x - f.x, p.z - f.z); p.st = 'flee'; pushEv({ t: 'scared' }); }
  for (const p of W.poachers) {
    p.scared = Math.max(0, p.scared - dt); p.alert = Math.max(0, p.alert - dt);
    if (p.scared > 0) { tryMove(p, p.x + Math.sin(p.ang) * 6 * dt, p.z + Math.cos(p.ang) * 6 * dt, 0.4, 1); continue; }
    let seen = null, sd = (W.night ? 10 : 15) * (assist ? 0.75 : 1);
    if (W.mode === 'poacher') sd *= (1 - (upg().quiet || 0) * 0.18);
    for (const pl of Object.values(W.players)) {
      if (pl.crouch && W.M.inCover(pl.x, pl.z)) continue;
      const d = hypot(pl.x - p.x, pl.z - p.z) * (pl.crouch ? 1.6 : 1);
      if (d < sd) { sd = d; seen = pl; }
    }
    if (!seen && W.truck && Math.abs(W.truck.speed) > 4 && hypot(W.truck.x - p.x, W.truck.z - p.z) < sd + 4) seen = { x: W.truck.x, z: W.truck.z };
    if (seen && p.st !== 'chase' && p.st !== 'alert') { p.st = 'alert'; p.alert = assist ? 1.3 : 0.85; p.ang = Math.atan2(seen.x - p.x, seen.z - p.z); if (W.mode === 'poacher') W.heat = clamp(W.heat + 10, 0, 100); pushEv({ t: 'spotted', x: p.x, z: p.z }); }
    if (p.st === 'alert') { if (p.alert <= 0) p.st = 'chase'; continue; }
    if (p.st === 'chase' && seen) {
      let psp = assist ? 4.6 : 6;
      if (W.mode === 'poacher' && W.heat > 65) psp += 1.2;
      steer(p, seen.x, seen.z, psp, dt, 0.4, 1);
      for (const pl of Object.values(W.players)) if (W.t > 4 && pl.inv <= 0 && (pl.onFoot || !W.truck || Math.abs(W.truck.speed) < 2) && hypot(pl.x - p.x, pl.z - p.z) < 1.6) busted(pl);
      if (!seen) { /* keep */ }
    } else if (W.mode === 'poacher') {
      p.patrol -= dt; if (p.patrol <= 0) { p.patrol = 3 + Math.random() * 4; p.pa = Math.random() * TAU; }
      p.ang += clamp(angDiff(p.pa, p.ang), -dt * 2, dt * 2);
      tryMove(p, p.x + Math.sin(p.ang) * 2.3 * dt, p.z + Math.cos(p.ang) * 2.3 * dt, 0.4, 1);
    } else if (p.grab) {
      const v = W.ents.find((e) => e.id === p.grab);
      if (!v || v.cargo || v.st === 'safe' || v.st === 'caged') p.grab = null;
      else { steer(p, v.x, v.z, 5, dt, 0.4, 1); if (hypot(v.x - p.x, v.z - p.z) < 1.7) bagAnimal(p, v); }
    } else {
      p.patrol -= dt; if (p.patrol <= 0) { p.patrol = 3 + Math.random() * 4; p.pa = Math.random() * TAU; }
      p.ang += clamp(angDiff(p.pa, p.ang), -dt * 2, dt * 2);
      tryMove(p, p.x + Math.sin(p.ang) * 2.3 * dt, p.z + Math.cos(p.ang) * 2.3 * dt, 0.4, 1);
      if (W.t > (assist ? 220 : 150) && W.caseId) {
        const v = nearest(W.ents, p.x, p.z, (e) => e.caseAnimal && !e.cargo && e.st !== 'caged' && e.st !== 'safe' && e.st !== 'bolt', 9);
        if (v) p.grab = v.id;
      }
    }
    if (p.st === 'chase' && !seen) { p.lost = (p.lost || 0) + dt; if (p.lost > 5) { p.st = 'patrol'; p.lost = 0; } } else p.lost = 0;
  }
  // jeeps
  for (const j of W.jeeps) {
    j.scared = Math.max(0, (j.scared || 0) - dt);
    for (const f of W.flares) if (hypot(j.x - f.x, j.z - f.z) < 14 && (j.cargo || j.chase) && !j.scared) { j.scared = j.cargo ? 3 : 5; j.chase = 0; pushEv({ t: 'jeepstall' }); }
    const tr = W.M.trail || [];
    if (tr.length && j.wp == null) { let b = 0, bd = 1e9; tr.forEach((p, i) => { const d = hypot(p[0] - j.x, p[1] - j.z); if (d < bd) { bd = d; b = i; } }); j.wp = b; }
    let tx, tz, spd;
    // patrol jeeps chase rangers they spot
    if (!j.cargo && !j.convoy && !j.scared) {
      let tgt = null, bd = (W.night ? 14 : 19) * (assist ? 0.8 : 1);
      for (const pl of Object.values(W.players)) { if (pl.inv > 0 || (pl.crouch && W.M.inCover(pl.x, pl.z))) continue; const d = hypot(pl.x - j.x, pl.z - j.z); if (d < bd) { bd = d; tgt = pl; } }
      if (tgt && !j.chase) { j.chase = 14; j.alert = 0.9; pushEv({ t: 'spotted', x: j.x, z: j.z, jeep: 1 }); }
      if (j.chase) {
        j.chase -= dt; j.alert = Math.max(0, (j.alert || 0) - dt);
        const pl = tgt || Object.values(W.players).sort((a, b) => hypot(a.x - j.x, a.z - j.z) - hypot(b.x - j.x, b.z - j.z))[0];
        if (!pl || j.chase <= 0 || hypot(pl.x - j.x, pl.z - j.z) > 45) { j.chase = 0; j.wp = null; }
        else {
          if (j.alert <= 0) { tx = pl.x; tz = pl.z; spd = assist ? 9 : 11.5; }
          else spd = 0.01;
          if (W.t > 4 && hypot(pl.x - j.x, pl.z - j.z) < 2.8 && pl.inv <= 0 && j.alert <= 0 && (pl.onFoot || !W.truck || Math.abs(W.truck.speed) < 6)) { j.chase = 0; busted(pl); }
        }
      }
    }
    if (spd != null) { /* chasing */ }
    else if (j.scared > 0) { spd = 0; }
    else if (j.cargo && !j.convoy && W.M.pcamp && hypot(j.x - W.M.pcamp.x, j.z - W.M.pcamp.z) < 40) { tx = W.M.pcamp.x; tz = W.M.pcamp.z; spd = 7; }
    else if (tr.length) { if (j.wp == null) { let b = 0, bd = 1e9; tr.forEach((q, i) => { const d = hypot(q[0] - j.x, q[1] - j.z); if (d < bd) { bd = d; b = i; } }); j.wp = b; } const p = tr[j.wp]; if (p) { tx = p[0]; tz = p[1]; spd = j.cargo ? (assist ? 6 : 8) : 5; if (hypot(tx - j.x, tz - j.z) < 5) j.wp = (j.wp + 1) % tr.length; } }
    else spd = 0;
    if (spd && tx != null) {
      j.speed += (spd - j.speed) * Math.min(1, dt * 2);
      const a = Math.atan2(tx - j.x, tz - j.z); j.ang += clamp(angDiff(a, j.ang), -dt * 1.8, dt * 1.8);
      const nx = j.x + Math.sin(j.ang) * j.speed * dt, nz = j.z + Math.cos(j.ang) * j.speed * dt;
      if (W.M.can(nx, nz, 0.9, W.M.h(j.x, j.z), 1)) { j.x = nx; j.z = nz; } else { j.ang += dt * 3; j.speed *= 0.5; }
    } else j.speed *= 0.8;
    // reached the poacher camp: the animal goes into a cage there
    if (j.cargo && !j.convoy && W.M.pcamp && hypot(j.x - W.M.pcamp.x, j.z - W.M.pcamp.z) < 6) {
      const e = W.ents.find((q) => q.id === j.cargo); j.cargo = null;
      const spot = W.M.pcamp.cages.find((c) => !W.ents.some((q) => q.cage === c && q.st === 'caged')) || W.M.pcamp.cages[0];
      if (e) { cageAnimal(e, spot); pushEv({ t: 'caged', name: e.name }); }
    }
  }
  // truck crew: a crew seat honks herding help automatically during chases
  if (hooks.crew && hooks.crew() && W.truck) {
    for (const e of W.ents) if (e.st === 'bolt' && hypot(e.x - W.truck.x, e.z - W.truck.z) < 16) e.fear -= dt * 0.5;
  }
}
function cageAnimal(e, spot) { e.st = 'caged'; e.cage = spot; e.x = spot.x; e.z = spot.z; W.caged[e.id] = 1; }
function bagAnimal(p, v) {
  const j = W.jeeps.find((q) => !q.cargo && !q.convoy) || spawnJeep(p.x, p.z);
  j.cargo = v.id; j.x = p.x + 1.5; j.z = p.z; j.wp = null; v.st = 'caged'; v.cage = null; v.calm = 0;
  p.grab = null; pushEv({ t: 'bagged', name: v.name, sp: v.sp });
}
function busted(pl) {
  if (W.mode === 'poacher') { bustPoacher(pl); return; }
  pl.inv = 4; pl.cargoLost++;
  if (W.truck) {
    W.truck.cargo.forEach((id) => { const e = W.ents.find((q) => q.id === id); if (e) { e.cargo = false; const pc = W.M.pcamp; cageAnimal(e, pc.cages[W.truck.cargo.indexOf(id) % pc.cages.length]); } });
    W.truck.cargo = [];
  }
  const s = W.M.spawn;
  for (const q of Object.values(W.players)) { if (!q.onFoot) exitTruck(q); q.x = s.x + (Math.random() - 0.5) * 2; q.z = s.z; q.inv = 2.5; q.y = W.M.h(q.x, q.z); }
  if (W.truck) { const t = W.M.truckSpawn; W.truck.x = t.x; W.truck.z = t.z; W.truck.ang = t.ang; W.truck.speed = 0; }
  for (const p of W.poachers) { p.st = 'patrol'; p.lost = 0; }
  pushEv({ t: 'busted', pid: pl.id });
}
// intercept: bump a jeep or open a cage
function interceptTick() {
  if (!W.truck) return;
  for (const j of W.jeeps) if (j.cargo && hypot(j.x - W.truck.x, j.z - W.truck.z) < 3.4 && (Math.abs(W.truck.speed) > 2 || j.scared > 0)) { j.scared = 6; freeAnimal(W.ents.find((e) => e.id === j.cargo), j); }
  if (Math.abs(W.truck.speed) < 4) return;
  if (W.M.pcamp && hypot(W.truck.x - W.M.pcamp.x, W.truck.z - W.M.pcamp.z) < 9) {
    for (const e of W.ents) if (e.st === 'caged' && e.cage && hypot(e.x - W.truck.x, e.z - W.truck.z) < 4) freeAnimal(e, null);
  }
}
function freeAnimal(e, jeep) {
  if (!e) return;
  if (jeep) { jeep.cargo = null; jeep.convoy = false; e.x = jeep.x + Math.cos(jeep.ang) * 2.5; e.z = jeep.z - Math.sin(jeep.ang) * 2.5; }
  delete W.caged[e.id];
  e.cage = null; e.st = 'asleep'; e.calm = GB.SPECIES[e.sp].calm;
  for (const g of W.goals) if (g.kind === 'free' && g.have < g.n) g.have++;
  W.freed++; pushEv({ t: 'freed', name: e.name, sp: e.sp }); checkDone();
}

/* ---------- darts ---------- */
function dartsTick(dt) {
  const u = upg();
  for (let i = W.darts.length - 1; i >= 0; i--) {
    const d = W.darts[i]; d.life -= dt; d.x += d.vx * dt; d.z += d.vz * dt;
    let dead = d.life <= 0 || !W.M.can(d.x, d.z, 0.1, 0, 99);
    if (!dead) for (const e of W.ents) {
      if (e.st === 'cargo' || e.st === 'safe' || e.st === 'caged') continue;
      if (hypot(e.x - d.x, e.z - d.z) < 0.8 + GB.SPECIES[e.sp].size * 0.5) {
        e.calm += (hooks.assist() ? 1.15 : 0.8) * (1 + (u.calm || 0) * 0.35);
        if (e.st === 'bolt') e.fear = Math.max(0, e.fear - 2);
        if (e.st === 'charge' || e.st === 'windup') { e.st = 'roam'; }
        pushEv({ t: 'hit', name: e.name, sp: e.sp }); dead = true; break;
      }
    }
    if (dead) W.darts.splice(i, 1);
  }
  for (let i = W.flares.length - 1; i >= 0; i--) { W.flares[i].life -= dt; if (W.flares[i].life <= 0) W.flares.splice(i, 1); }
}

/* ---------- truck ---------- */
function driveTick(dt) {
  const tr = W.truck; if (!tr) return;
  const driver = tr.seats[0] || null;
  const inp = driver ? inputs[driver] : null;
  const u = upg(), maxS = topSpeed(u);
  if (inp) {
    const th = clamp(+inp.th || 0, -1, 1), st = clamp(+inp.st || 0, -1, 1);
    tr.speed += th * (th > 0 ? 18 : 26) * dt;
    tr.speed -= tr.speed * (inp.hb ? 3.2 : 0.55) * dt;
    tr.speed = clamp(tr.speed, -maxS * 0.4, maxS);
    if (Math.abs(tr.speed) > 0.4) tr.ang += st * (2 + (u.engine || 0) * 0.3) * dt * clamp(tr.speed / 5, -1, 1);
  } else tr.speed -= tr.speed * 0.9 * dt;
  const nx = tr.x + Math.sin(tr.ang) * tr.speed * dt, nz = tr.z + Math.cos(tr.ang) * tr.speed * dt;
  const h = W.M.h(tr.x, tr.z);
  if (W.M.can(nx, tr.z, 1.1, h, 1)) tr.x = nx; else tr.speed *= 0.4;
  if (W.M.can(tr.x, nz, 1.1, W.M.h(tr.x, tr.z), 1)) tr.z = nz; else tr.speed *= 0.4;
  tr.y = W.M.h(tr.x, tr.z);
  // ramming an animal spoils it
  if (Math.abs(tr.speed) > 7) for (const e of W.ents) {
    if (e.st === 'cargo' || e.st === 'safe' || e.st === 'caged') continue;
    if (hypot(e.x - tr.x, e.z - tr.z) < 1.9 + GB.SPECIES[e.sp].size * 0.3) {
      tr.speed *= 0.25;
      if (String(tr.seats[0] || '').indexOf('crew') === 0) continue; // the crew always swerves in time
      if (e.st === 'asleep') { e.st = 'bolt'; e.calm = 0; e.fear = 6; pushEv({ t: 'rammed', name: e.name }); }
      else if (e.st !== 'bolt') { e.st = 'bolt'; e.fear = 5; pushEv({ t: 'rammed', name: e.name }); }
    }
  }
  for (const pid of tr.seats) { const p = pid && W.players[pid]; if (p) { p.x = tr.x; p.z = tr.z; p.y = tr.y; p.ang = tr.ang; } }
}

/* ---------- step ---------- */
Sim.moveFoot = function (p, inp, dt) {
  if (!p || !p.onFoot || !inp || (p.knock || 0) > 0) { if (p) p.knock = Math.max(0, (p.knock || 0) - dt); return; }
  const jx = clamp(+inp.jx || 0, -1, 1), jz = clamp(+inp.jz || 0, -1, 1), mag = Math.min(1, hypot(jx, jz));
  if (mag > 0.1) {
    const c = +inp.cam || 0;
    const wx = -jx * Math.cos(c) + jz * Math.sin(c), wz = jx * Math.sin(c) + jz * Math.cos(c);
    p.ang = Math.atan2(wx, wz);
    const spd = (p.crouch ? 3.4 : 6.4) * (hooks.assist() ? 1.1 : 1) * mag;
    tryMove(p, p.x + Math.sin(p.ang) * spd * dt, p.z + Math.cos(p.ang) * spd * dt, 0.35, 1);
    p.moving = 1;
  } else p.moving = 0;
};
Sim.step = function (dt) {
  dt = clamp(dt, 0.001, 0.05); W.t += dt;
  for (const p of Object.values(W.players)) p.inv = Math.max(0, p.inv - dt);
  driveTick(dt);
  droneTick(dt);
  if (W.map !== 'camp') { animalsTick(dt); poachersTick(dt); interceptTick(); }
  else { animalsTick(dt); if (W.mode === 'poacher') poachersTick(dt); }
  if (W.mode === 'poacher') heatTick(dt);
  dartsTick(dt);
};

/* ---------- queries ---------- */
Sim.gateAt = function (x, z) { if (!W.M) return null; for (const g of W.M.gates) if (hypot(x - g.x, z - g.z) < g.r + 1) return g; return null; };
Sim.nearBoard = (x, z) => W.M && W.M.board && hypot(x - W.M.board.x, z - W.M.board.z) < 4;
Sim.nearShop = (x, z) => W.M && W.M.shop && hypot(x - W.M.shop.x, z - W.M.shop.z) < 5;
Sim.nearSupply = (x, z) => W.M && W.M.supply && hypot(x - W.M.supply.x, z - W.M.supply.z) < 4.5;
Sim.nearDealer = (x, z) => !!(W.dealer && hypot(x - W.dealer.x, z - W.dealer.z) < 7.5);
Sim.penGateAt = penGateAt;
Sim.sanctuaryAt = sanctuaryAt;

/* ---------- sync ---------- */
const r2 = (v) => Math.round(v * 100) / 100;
Sim.pack = function () {
  return {
    t: r2(W.t), map: W.map, wind: r2(W.wind || 0), night: W.night ? 1 : 0, caseId: W.caseId, done: W.done ? 1 : 0, stars: W.stars | 0, freed: W.freed | 0, seed: W.seed,
    goals: W.goals.map((g) => [g.kind, g.species, g.n, g.have]),
    truck: W.truck ? { x: r2(W.truck.x), z: r2(W.truck.z), a: r2(W.truck.ang), v: r2(W.truck.speed), seats: W.truck.seats.slice(), cargo: W.truck.cargo.slice() } : null,
    ents: W.ents.map((e) => [e.id, e.sp, r2(e.x), r2(e.z), r2(e.ang), e.st, r2(e.calm), e.sanct || '', e.caseAnimal ? 1 : 0]),
    poachers: W.poachers.map((p) => [p.id, r2(p.x), r2(p.z), r2(p.ang), p.st]),
    jeeps: W.jeeps.map((j) => [j.id, r2(j.x), r2(j.z), r2(j.ang), j.cargo || '', j.chase ? 1 : 0]),
    flares: W.flares.map((f) => [r2(f.x), r2(f.z)]), darts: W.darts.map((d) => [r2(d.x), r2(d.z)]),
    mode: W.mode || 'ranger', heat: Math.round(W.heat || 0), jobId: W.jobId || '',
    pens: W.pens || { sun: 0, frost: 0 },
    dealer: W.dealer ? [r2(W.dealer.x), r2(W.dealer.z)] : null,
    drone: W.drone ? { o: W.drone.owner, x: r2(W.drone.x), z: r2(W.drone.z), a: r2(W.drone.ang), m: W.drone.mode, tg: W.drone.target || '', bat: Math.round(W.drone.bat), beam: W.drone.beam ? 1 : 0 } : null,
    marks: (W.marks || []).slice(-12).map((m) => [r2(m.x), r2(m.z), m.k])
  };
};
Sim.unpack = function (s) {
  if (!s) return;
  if (s.map !== W.map || !W.M) { W.map = s.map; W.M = GB.World.get(s.map); }
  W.t = s.t; W.wind = s.wind || 0; W.night = !!s.night; W.caseId = s.caseId; W.done = !!s.done; W.stars = s.stars | 0; W.freed = s.freed | 0; W.seed = s.seed;
  W.mode = s.mode === 'poacher' ? 'poacher' : 'ranger';
  W.heat = s.heat || 0; W.jobId = s.jobId || null;
  W.pens = s.pens || { sun: false, frost: false };
  W.dealer = s.dealer ? { x: s.dealer[0], z: s.dealer[1] } : null;
  if (s.drone) W.drone = { owner: s.drone.o, x: s.drone.x, z: s.drone.z, ang: s.drone.a, mode: s.drone.m, target: s.drone.tg || null, bat: s.drone.bat, beam: s.drone.beam ? 1 : 0 };
  else W.drone = null;
  W.marks = (s.marks || []).map((m) => ({ x: m[0], z: m[1], k: m[2], t: W.t }));
  W.goals = (s.goals || []).map((g) => ({ kind: g[0], species: g[1], n: g[2], have: g[3] }));
  if (s.truck) { if (!W.truck) Sim.spawnTruck(); Object.assign(W.truck, { x: s.truck.x, z: s.truck.z, ang: s.truck.a, speed: s.truck.v, seats: s.truck.seats, cargo: s.truck.cargo }); }
  const keep = {};
  W.ents = (s.ents || []).map((e) => { keep[e[0]] = 1; return { id: e[0], kind: 'animal', sp: e[1], name: GB.SPECIES[e[1]].name, x: e[2], z: e[3], ang: e[4], st: e[5], calm: e[6], sanct: e[7] || null, cargo: e[5] === 'cargo', caseAnimal: !!e[8], penned: e[5] === 'penned', frost: 0, y: W.M.h(e[2], e[3]), cage: null, fear: 0, telegraph: 0, wander: 2, wa: 0, distracted: 0, rest: 0, chargeT: 0 }; });
  W.poachers = (s.poachers || []).map((p) => ({ id: p[0], kind: 'poacher', x: p[1], z: p[2], ang: p[3], st: p[4], alert: p[4] === 'chase' ? 1 : 0, scared: 0, y: W.M.h(p[1], p[2]) }));
  W.jeeps = (s.jeeps || []).map((j) => ({ id: j[0], kind: 'jeep', x: j[1], z: j[2], ang: j[3], cargo: j[4] || null, chase: j[5] || 0, speed: 0 }));
  W.flares = (s.flares || []).map((f) => ({ x: f[0], z: f[1], life: 3 }));
  W.darts = (s.darts || []).map((d) => ({ x: d[0], z: d[1], vx: 0, vz: 0, life: 0.3 }));
};

/* ---------- drone (ranger) ---------- */
function flyXY(d, nx, nz) {
  const h = W.M.half - 4;
  if (nx > -h && nx < h) d.x = nx;
  if (nz > -h && nz < h) d.z = nz;
}
function flyToward(d, tx, tz, spd, dt) {
  const dist = hypot(tx - d.x, tz - d.z);
  if (dist < 0.05) return;
  const a = Math.atan2(tx - d.x, tz - d.z);
  d.ang = a;
  const step = Math.min(dist, spd * dt);
  flyXY(d, d.x + Math.sin(a) * step, d.z + Math.cos(a) * step);
}
function addMark(x, z, k) {
  const key = k + ':' + (x | 0) + ':' + (z | 0);
  if ((W.marks || []).some((m) => m.key === key)) return;
  W.marks.push({ x, z, k, key, t: W.t });
  if (W.marks.length > 14) W.marks.shift();
}
function creditRecon() {
  let hit = false;
  for (const g of W.goals) if (g.kind === 'recon' && g.have < g.n) { g.have++; hit = true; break; }
  if (hit) { pushEv({ t: 'recon' }); checkDone(); }
}
function droneAct(pid) {
  if (W.mode === 'poacher') return;
  const p = W.players[pid]; if (!p) return;
  if (!W.drone) {
    const bolt = nearest(W.ents, p.x, p.z, (e) => e.st === 'bolt', 90);
    const x = p.onFoot ? p.x : (W.truck ? W.truck.x : p.x);
    const z = p.onFoot ? p.z : (W.truck ? W.truck.z : p.z);
    W.drone = { owner: pid, x, z, ang: p.ang || 0, mode: bolt ? 'follow' : 'recon', target: bolt ? bolt.id : null, bat: 100, beam: 0, sawCamp: 0 };
    pushEv({ t: 'dronelaunch', mode: W.drone.mode, name: bolt ? bolt.name : '' });
    return;
  }
  if (W.drone.owner !== pid && W.players[W.drone.owner]) { pushEv({ t: 'dronebusy' }); return; }
  W.drone.owner = pid;
  if (W.drone.mode === 'follow') W.drone.mode = 'recon';
  else if (W.drone.mode === 'recon') W.drone.mode = 'return';
  else W.drone.mode = 'recon';
  W.drone.beam = 0;
  pushEv({ t: 'dronemode', mode: W.drone.mode });
}
function droneScan(d) {
  for (const q of W.poachers) if (hypot(q.x - d.x, q.z - d.z) < 22) addMark(q.x, q.z, 'poacher');
  for (const e of W.ents) if (e.st !== 'cargo' && e.st !== 'safe' && hypot(e.x - d.x, e.z - d.z) < 18) addMark(e.x, e.z, 'animal');
  if (W.M.pcamp && hypot(W.M.pcamp.x - d.x, W.M.pcamp.z - d.z) < 18) {
    addMark(W.M.pcamp.x, W.M.pcamp.z, 'camp');
    if (!d.sawCamp) { d.sawCamp = 1; creditRecon(); }
  }
}
function droneTick(dt) {
  const d = W.drone; if (!d || W.mode === 'poacher') return;
  d.bat -= dt * (d.mode === 'recon' ? 7 : 3.4);
  if (d.bat <= 0 && d.mode !== 'return') { d.mode = 'return'; d.beam = 0; pushEv({ t: 'dronebat' }); }
  W.marks = (W.marks || []).filter((m) => W.t - (m.t || 0) < 55);
  const owner = W.players[d.owner];
  if (d.mode === 'follow') {
    let e = d.target ? W.ents.find((q) => q.id === d.target && q.st === 'bolt') : null;
    if (!e) e = nearest(W.ents, d.x, d.z, (q) => q.st === 'bolt', 70);
    if (e) {
      d.target = e.id;
      flyToward(d, e.x - Math.sin(e.ang) * 1.5, e.z - Math.cos(e.ang) * 1.5, 18, dt);
      d.beam = hypot(d.x - e.x, d.z - e.z) < 12 ? 1 : 0;
    } else d.beam = 0;
  } else if (d.mode === 'recon') {
    d.beam = 0;
    const inp = inputs[d.owner] || {};
    const jx = clamp(+inp.jx || 0, -1, 1), jz = clamp(+inp.jz || 0, -1, 1), cam = +inp.cam || 0;
    if (hypot(jx, jz) > 0.12) {
      const wx = -jx * Math.cos(cam) + jz * Math.sin(cam);
      const wz = jx * Math.sin(cam) + jz * Math.cos(cam);
      d.ang = Math.atan2(wx, wz);
      flyXY(d, d.x + Math.sin(d.ang) * 16 * dt, d.z + Math.cos(d.ang) * 16 * dt);
    }
    droneScan(d);
  } else if (d.mode === 'return') {
    d.beam = 0;
    if (!owner) { W.drone = null; return; }
    const tx = owner.onFoot || !W.truck ? owner.x : W.truck.x;
    const tz = owner.onFoot || !W.truck ? owner.z : W.truck.z;
    flyToward(d, tx, tz, 24, dt);
    if (hypot(d.x - tx, d.z - tz) < 2.6) { W.drone = null; pushEv({ t: 'droneret' }); }
  }
}

/* ---------- poacher mode ---------- */
function penGateAt(x, z) {
  if (W.mode !== 'poacher' || !W.M || !W.M.sanct) return null;
  for (const sc of W.M.sanct) {
    const gx = sc.gate === 'e' ? sc.x1 : sc.x0;
    if (Math.abs(x - gx) < 3.4 && z > 7 && z < 17) return sc;
  }
  return null;
}
function tryUnlock(p) {
  const here = !p.onFoot && W.truck ? W.truck : p;
  const gate = penGateAt(here.x, here.z);
  if (!gate) { pushEv({ t: 'nolock' }); return; }
  if (W.pens && W.pens[gate.id]) { pushEv({ t: 'openpen', name: gate.name }); return; }
  if (p.onFoot && !p.crouch) { pushEv({ t: 'needcrouch' }); return; }
  const hot = W.poachers.some((q) => (q.st === 'chase' || q.st === 'alert') && hypot(q.x - here.x, q.z - here.z) < 12);
  if (hot) { pushEv({ t: 'guarded' }); return; }
  W.pens[gate.id] = true;
  W.heat = clamp((W.heat || 0) + 12, 0, 100);
  pushEv({ t: 'unlocked', name: gate.name });
}
function nettable(e) {
  if (!e || e.cargo || e.st === 'cargo' || e.st === 'safe' || e.st === 'caged') return false;
  const sp = GB.SPECIES[e.sp]; if (!sp) return false;
  if (e.st === 'penned' || e.st === 'asleep' || e.st === 'tired') return true;
  if (e.frost && e.st !== 'charge' && e.st !== 'windup') return true;
  if (sp.temp === 'chill' && (e.st === 'roam' || e.st === 'alert')) return true;
  if (sp.temp === 'feisty' && (e.st === 'roam' || e.st === 'alert')) return true;
  return false;
}
function tryNet(p) {
  if (W.mode !== 'poacher' || !p) return;
  if (!W.truck) { pushEv({ t: 'nonet' }); return; }
  if (W.truck.cargo.length >= cargoMax(upg())) { pushEv({ t: 'cargofull' }); return; }
  const x = p.onFoot ? p.x : W.truck.x, z = p.onFoot ? p.z : W.truck.z;
  const e = nearest(W.ents, x, z, nettable, 3.3);
  if (!e) {
    const fast = nearest(W.ents, x, z, (q) => q.st === 'bolt' || q.st === 'charge', 4);
    pushEv(fast ? { t: 'toofast', name: fast.name } : { t: 'nonet' });
    return;
  }
  if (hypot(e.x - W.truck.x, e.z - W.truck.z) > 8) { pushEv({ t: 'needtruck' }); return; }
  if (e.st === 'penned') {
    if (!W.pens || !W.pens[e.sanct]) { pushEv({ t: 'locked', name: e.name }); return; }
    for (const g of W.goals) if (g.kind === 'raid' && g.have < g.n) { g.have++; break; }
    W.heat = clamp((W.heat || 0) + 14, 0, 100);
    e.penned = false;
  } else W.heat = clamp((W.heat || 0) + 8, 0, 100);
  e.cargo = true; e.st = 'cargo'; e.calm = 0; W.truck.cargo.push(e.id);
  pushEv({ t: 'crated', sp: e.sp, name: e.name });
  checkDone();
}
function creditSell(e) {
  for (const g of W.goals) if (g.kind === 'sell' && g.have < g.n && (!g.species || g.species === e.sp)) { g.have++; return; }
}
function trySell() {
  if (W.mode !== 'poacher' || !W.truck || !W.truck.cargo.length) { pushEv({ t: 'nocargo' }); return; }
  if (!W.dealer || hypot(W.truck.x - W.dealer.x, W.truck.z - W.dealer.z) > 8) { pushEv({ t: 'nodealer' }); return; }
  let pay = 0, n = 0; const names = [];
  while (W.truck.cargo.length) {
    const id = W.truck.cargo.shift();
    const e = W.ents.find((q) => q.id === id);
    if (!e) continue;
    const val = Math.round((GB.SPECIES[e.sp].pts || 80) * 0.5);
    pay += val; n++; names.push(e.name);
    creditSell(e);
    W.ents = W.ents.filter((q) => q.id !== e.id);
  }
  pushEv({ t: 'sold', pay, n, name: names[0] || 'crate' });
  checkDone();
}
function bustPoacher(pl) {
  pl.inv = 3.5; pl.cargoLost = (pl.cargoLost || 0) + 1;
  if (W.truck) {
    W.truck.cargo.forEach((id) => {
      const e = W.ents.find((q) => q.id === id);
      if (!e) return;
      e.cargo = false; e.st = 'bolt'; e.fear = 5; e.penned = false;
      e.x = W.truck.x + (Math.random() * 6 - 3); e.z = W.truck.z + 4; e.y = W.M.h(e.x, e.z);
    });
    W.truck.cargo = [];
  }
  const dest = W.dealer || { x: W.M.spawn.x, z: W.M.spawn.z };
  for (const q of Object.values(W.players)) {
    if (!q.onFoot && W.truck) exitTruck(q);
    q.x = dest.x + (Math.random() - 0.5) * 2; q.z = dest.z + 5; q.inv = 3.2; q.crouch = false; q.y = W.M.h(q.x, q.z);
  }
  if (W.truck) { W.truck.x = dest.x + 4; W.truck.z = dest.z + 1; W.truck.ang = Math.PI; W.truck.speed = 0; }
  for (const q of W.poachers) {
    q.st = 'patrol'; q.lost = 0; q.alert = 0;
    if (hypot(q.x - dest.x, q.z - dest.z) < 16) { q.x += 28; q.z -= 8; }
  }
  W.jeeps.forEach((j) => { j.chase = 0; j.scared = 2; });
  W.heat = 28;
  pushEv({ t: 'busted', pid: pl.id, poach: 1 });
}
function heatTick(dt) {
  const pls = Object.values(W.players);
  const seen = W.poachers.some((p) => p.st === 'chase' || p.st === 'alert') || W.jeeps.some((j) => j.chase);
  const hide = pls.some((p) => (p.crouch && W.M.inCover && W.M.inCover(p.x, p.z)) || (W.dealer && hypot(p.x - W.dealer.x, p.z - W.dealer.z) < 12));
  const plates = upg().plates || 0;
  if (seen) W.heat = clamp(W.heat + dt * 7 * (1 - plates * 0.22), 0, 100);
  else if (hide) W.heat = clamp(W.heat - dt * 8, 0, 100);
  else W.heat = clamp(W.heat - dt * 1.4, 0, 100);
}

Sim.spawnAnimal = spawnAnimal; Sim.busted = busted; Sim.freeAnimal = freeAnimal;
})();
