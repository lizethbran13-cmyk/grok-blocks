/* Grok Blocks - deterministic voxel world generator (shared by sim + view on every client) */
(function () {
'use strict';
const GB = window.GB;
const World = GB.World = {};
// materials
const M = World.MAT = { GRASS: 0, ROAD: 1, SAND: 2, SNOW: 3, ROCK: 4, MUD: 5, BED: 6, DGRASS: 7, RED: 8, ICE: 9, PLANK: 10, DRY: 11, MOSS: 12, PAD: 13, GATE: 14 };

function hash3(x, z, s) { let n = (x * 374761393 + z * 668265263 + s * 2147483647) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function vnoise(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iz, s), b = hash3(ix + 1, iz, s), c = hash3(ix, iz + 1, s), d = hash3(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm(x, z, s) { return vnoise(x, z, s) * 0.6 + vnoise(x * 2.1, z * 2.1, s + 11) * 0.28 + vnoise(x * 4.3, z * 4.3, s + 23) * 0.12; }
World.hash = hash3;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
World.rng = rng;

World.GATES = [
  { to: 'savanna', x: -40, label: 'SAVANNA' }, { to: 'jungle', x: -20, label: 'JUNGLE' }, { to: 'snow', x: 0, label: 'SNOW PEAKS' },
  { to: 'wet', x: 20, label: 'WETLANDS' }, { to: 'desert', x: 40, label: 'CANYON' }
];
World.MAPS = ['camp', 'savanna', 'jungle', 'snow', 'wet', 'desert'];
const SEED = { camp: 7, savanna: 101, jungle: 202, snow: 303, wet: 404, desert: 505 };
const cache = {};
World.get = function (id) { return cache[id] || (cache[id] = build(id)); };

function mk(id, N) {
  const m = { id, N, half: N / 2, H: new Int16Array(N * N), Mt: new Uint8Array(N * N), S: new Uint8Array(N * N), cover: new Uint8Array(N * N), props: [], wl: -10, gates: [], sanct: [], trail: [], seed: SEED[id] };
  m.idx = (x, z) => { const i = Math.floor(x + m.half), k = Math.floor(z + m.half); if (i < 0 || k < 0 || i >= N || k >= N) return -1; return k * N + i; };
  m.h = (x, z) => { const j = m.idx(x, z); return j < 0 ? 40 : m.H[j]; };
  m.solid = (x, z) => { const j = m.idx(x, z); return j < 0 ? 1 : m.S[j]; };
  m.water = (x, z) => { const j = m.idx(x, z); return j >= 0 && m.H[j] < m.wl; };
  m.inCover = (x, z) => { const j = m.idx(x, z); return j >= 0 && m.cover[j] > 0; };
  // smooth ground height for visuals
  m.hs = (x, z) => {
    const fx = x + m.half - 0.5, fz = z + m.half - 0.5, i = Math.floor(fx), k = Math.floor(fz), tx = fx - i, tz = fz - k;
    const g = (a, b) => (a < 0 || b < 0 || a >= N || b >= N ? 40 : m.H[b * N + a]);
    const a = g(i, k), b = g(i + 1, k), c = g(i, k + 1), d = g(i + 1, k + 1);
    // keep the voxel feel: snap toward the column you stand on
    const own = m.h(x, z), sm = a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
    return Math.abs(sm - own) > 1.2 ? own : own * 0.65 + sm * 0.35;
  };
  // can an entity of radius r standing at height fromH move to (x,z)?
  m.can = (x, z, r, fromH, climb) => {
    const pts = [[0, 0], [r, r], [-r, r], [r, -r], [-r, -r]];
    for (const p of pts) {
      const j = m.idx(x + p[0], z + p[1]); if (j < 0) return false;
      if (m.S[j]) return false;
      if (m.H[j] - fromH > climb) return false;
    }
    return true;
  };
  return m;
}
function setCol(m, i, k, h, mt) { if (i < 0 || k < 0 || i >= m.N || k >= m.N) return; const j = k * m.N + i; if (h != null) m.H[j] = h; if (mt != null) m.Mt[j] = mt; }
function solidRect(m, x0, z0, x1, z1, v) { for (let z = Math.floor(z0); z <= Math.floor(z1); z++) for (let x = Math.floor(x0); x <= Math.floor(x1); x++) { const j = m.idx(x + 0.5, z + 0.5); if (j >= 0) m.S[j] = v == null ? 2 : v; } }
function clearRect(m, x0, z0, x1, z1) { solidRect(m, x0, z0, x1, z1, 0); }
function addProp(m, p, solidR) {
  m.props.push(p);
  if (solidR != null && solidR >= 0) { for (let dz = -solidR; dz <= solidR; dz++) for (let dx = -solidR; dx <= solidR; dx++) { const j = m.idx(p.x + dx, p.z + dz); if (j >= 0) m.S[j] = 1; } }
}
function roadLine(m, pts, w, mat, closed) {
  const N = m.N, segs = closed ? pts.length : pts.length - 1;
  for (let s = 0; s < segs; s++) {
    const a = pts[s], b = pts[(s + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= L; t += 0.5) {
      const x = a[0] + (b[0] - a[0]) * t / L, z = a[1] + (b[1] - a[1]) * t / L;
      for (let dz = -w; dz <= w; dz++) for (let dx = -w; dx <= w; dx++) {
        if (dx * dx + dz * dz > w * w + 1) continue;
        const j = m.idx(x + dx, z + dz); if (j < 0) continue;
        m.Mt[j] = mat; m.S[j] = 0; m.cover[j] = 0; m.road = m.road || new Uint8Array(N * N); m.road[j] = 1;
      }
    }
  }
}
// smooth road heights so trucks can always drive them
function smoothRoads(m) {
  if (!m.road) return;
  const N = m.N, src = m.H.slice();
  for (let pass = 0; pass < 3; pass++) {
    const cur = m.H.slice();
    for (let k = 1; k < N - 1; k++) for (let i = 1; i < N - 1; i++) {
      const j = k * N + i; if (!m.road[j]) continue;
      let s = 0, n = 0;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const a = i + dx, b = k + dz; if (a < 0 || b < 0 || a >= N || b >= N) continue; s += cur[b * N + a]; n++; }
      m.H[j] = Math.round(s / n);
    }
  }
  // clamp road neighbours to a 1-block step
  for (let it = 0; it < 6; it++) for (let k = 1; k < N - 1; k++) for (let i = 1; i < N - 1; i++) {
    const j = k * N + i; if (!m.road[j]) continue;
    const nb = [j - 1, j + 1, j - N, j + N];
    for (const q of nb) { if (m.road[q] && m.H[q] - m.H[j] > 1) m.H[q] = m.H[j] + 1; }
  }
  // soften the shoulders next to roads
  for (let k = 1; k < N - 1; k++) for (let i = 1; i < N - 1; i++) {
    const j = k * N + i; if (m.road[j]) continue;
    const nb = [j - 1, j + 1, j - N, j + N];
    for (const q of nb) if (m.road[q] && m.H[j] - m.H[q] > 1 && m.H[j] - m.H[q] < 4) { m.H[j] = m.H[q] + 1; }
  }
  void src;
}
function flatten(m, cx, cz, r, h, mat) {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dz * dz > r * r) continue; const j = m.idx(cx + dx, cz + dz); if (j < 0) continue; m.H[j] = h; if (mat != null) m.Mt[j] = mat; m.S[j] = 0; m.cover[j] = 0; }
}

/* ---------------- CAMP ---------------- */
function buildCamp() {
  const m = mk('camp', 112), N = m.N, h0 = 2;
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
    const x = i - m.half, z = k - m.half, j = k * N + i;
    const edge = Math.min(i, k, N - 1 - i, N - 1 - k);
    m.H[j] = edge < 3 ? h0 + 4 : h0; m.Mt[j] = edge < 3 ? M.DGRASS : (hash3(i, k, 7) < 0.15 ? M.DGRASS : M.GRASS);
    if (edge < 3) m.S[j] = 1;
  }
  // roads: plaza + to gates + to sanctuaries
  const pl = [];
  for (let a = 0; a < 24; a++) pl.push([Math.cos(a / 24 * Math.PI * 2) * 9, Math.sin(a / 24 * Math.PI * 2) * 9 - 2]);
  roadLine(m, pl, 2, M.ROAD, true);
  World.GATES.forEach((g) => roadLine(m, [[0, -2], [g.x * 0.4, -24], [g.x, -44], [g.x, -53]], 2, M.ROAD));
  roadLine(m, [[0, -2], [0, 30]], 2, M.ROAD);
  roadLine(m, [[-9, 8], [-24, 12], [-36, 12]], 2, M.ROAD);
  roadLine(m, [[9, 8], [24, 12], [36, 12]], 2, M.ROAD);
  // gates in the north wall
  World.GATES.forEach((g) => {
    m.gates.push({ to: g.to, x: g.x, z: -52, r: 3.6, label: g.label });
    for (let z = -N / 2; z < -50; z++) for (let x = g.x - 3; x <= g.x + 3; x++) { const j = m.idx(x + 0.5, z + 0.5); if (j >= 0) { m.S[j] = 0; m.H[j] = h0; m.Mt[j] = M.GATE; } }
    solidRect(m, g.x - 5, -52, g.x - 4, -51, 2); solidRect(m, g.x + 4, -52, g.x + 5, -51, 2);
    m.props.push({ k: 'arch', x: g.x, z: -51.5, to: g.to, label: g.label });
  });
  // HQ cabin + case board + shop + supply
  solidRect(m, -6, -21, 5, -14, 2); m.props.push({ k: 'hq', x: -0.5, z: -17.5 });
  m.board = { x: -9, z: -11 }; m.props.push({ k: 'board', x: -9, z: -11.6 }); solidRect(m, -11, -12, -7, -12, 2);
  m.shop = { x: 12, z: -11 }; solidRect(m, 10, -18, 16, -13, 2); m.props.push({ k: 'shed', x: 13, z: -15.5 });
  m.supply = { x: -16, z: -12, r: 5 }; solidRect(m, -19, -17, -14, -15, 2); m.props.push({ k: 'supply', x: -16.5, z: -16 });
  m.props.push({ k: 'fire', x: 0, z: -2 }); solidRect(m, -1, -3, 0, -2, 1);
  m.props.push({ k: 'flag', x: 3, z: -11 });
  [[-14, 22], [-8, 26], [8, 26], [14, 22]].forEach((p) => { m.props.push({ k: 'tent', x: p[0], z: p[1] }); solidRect(m, p[0] - 2, p[1] - 1, p[0] + 1, p[1] + 1, 2); });
  // sanctuaries (fenced, with a gap facing camp)
  const S1 = { id: 'sun', name: 'Sunlands Sanctuary', x0: -51, x1: -24, z0: -6, z1: 30, gate: 'e', habitat: ['savanna', 'jungle', 'desert'], color: 0xf0c24b };
  const S2 = { id: 'frost', name: 'Frostmarsh Sanctuary', x0: 24, x1: 51, z0: -6, z1: 30, gate: 'w', habitat: ['snow', 'wet'], color: 0x7eb6e0 };
  [S1, S2].forEach((s) => {
    s.x = (s.x0 + s.x1) / 2; s.z = (s.z0 + s.z1) / 2; s.w = s.x1 - s.x0; s.d = s.z1 - s.z0;
    for (let z = s.z0; z <= s.z1; z++) for (let x = s.x0; x <= s.x1; x++) {
      const j = m.idx(x + 0.5, z + 0.5); if (j < 0) continue;
      const onEdge = x === s.x0 || x === s.x1 || z === s.z0 || z === s.z1;
      const gateGap = (s.gate === 'e' && x === s.x1 && z >= 8 && z <= 16) || (s.gate === 'w' && x === s.x0 && z >= 8 && z <= 16);
      if (onEdge && !gateGap) m.S[j] = 3;
      if (!onEdge) {
        if (s.id === 'sun') m.Mt[j] = hash3(x, z, 3) < 0.3 ? M.DRY : M.SAND;
        else m.Mt[j] = (x - s.x) * (x - s.x) + (z - s.z - 6) * (z - s.z - 6) < 30 ? M.ICE : (hash3(x, z, 4) < 0.4 ? M.SNOW : M.MOSS);
      }
    }
    // a little pond / trees inside
    const r = rng(s.id === 'sun' ? 31 : 32);
    for (let n = 0; n < 6; n++) { const x = s.x0 + 3 + r() * (s.w - 6), z = s.z0 + 3 + r() * (s.d - 6); if (Math.abs(z - 12) < 4 && Math.abs(x - (s.gate === 'e' ? s.x1 : s.x0)) < 6) continue; addProp(m, { k: s.id === 'sun' ? 'acacia' : 'pine', x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5, s: 0.8 + r() * 0.4 }, 0); }
    m.props.push({ k: 'sign', x: s.gate === 'e' ? s.x1 + 2 : s.x0 - 2, z: 6, label: s.name, color: s.color });
    m.sanct.push(s);
  });
  // trees around the edge
  const r = rng(77);
  for (let n = 0; n < 70; n++) {
    const x = (r() * 2 - 1) * 50, z = (r() * 2 - 1) * 50;
    const j = m.idx(x, z); if (j < 0 || m.S[j] || m.Mt[j] === M.ROAD || m.Mt[j] === M.GATE) continue;
    if (Math.abs(x) < 22 && z > -24 && z < 32) continue;
    if (m.sanct.some((s) => x > s.x0 - 3 && x < s.x1 + 3 && z > s.z0 - 3 && z < s.z1 + 3)) continue;
    if (z < -40) continue;
    addProp(m, { k: 'tree', x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5, s: 0.8 + r() * 0.5 }, 0);
  }
  m.spawn = { x: 0, z: 4, ang: Math.PI };
  m.truckSpawn = { x: 5, z: 6, ang: Math.PI };
  m.biome = 'camp';
  return m;
}

/* ---------------- BIOMES ---------------- */
function buildBiome(id) {
  const m = mk(id, 192), N = m.N, s = m.seed, r = rng(s * 13 + 1);
  m.biome = id;
  if (id === 'wet') m.wl = 2; else if (id === 'jungle') m.wl = 2; else if (id === 'snow') m.wl = 3;
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
    const x = i - m.half, z = k - m.half, j = k * N + i;
    const n = fbm(x / 38, z / 38, s), n2 = fbm(x / 22 + 50, z / 22, s + 5), rnd = hash3(i, k, s);
    let h = 3, mt = M.GRASS;
    if (id === 'savanna') {
      h = 3 + Math.round(n * 3.2);
      mt = rnd < 0.18 ? M.DRY : (n2 > 0.62 ? M.SAND : M.GRASS);
      if (n2 > 0.74) { h += Math.round((n2 - 0.74) * 40); mt = M.RED; }
    } else if (id === 'jungle') {
      h = 3 + Math.round(n * 5);
      mt = rnd < 0.2 ? M.MOSS : M.DGRASS;
      const riv = Math.abs(Math.sin(x / 26 + Math.sin(z / 33) * 1.6) * 30 - z * 0.12 + 4);
      if (riv < 2.6 && Math.abs(z) < 80) { h = 1; mt = M.BED; }
    } else if (id === 'snow') {
      const d = Math.hypot(x, z * 0.9);
      h = 4 + Math.round(n * 4);
      if (n2 > 0.66) h += Math.round((n2 - 0.66) * 46);
      if (d > 72) h += Math.round((d - 72) / 2.2);
      mt = h > 8 ? M.SNOW : (rnd < 0.25 ? M.ROCK : M.SNOW);
      if (n < 0.28) { h = 2; mt = M.ICE; }
    } else if (id === 'wet') {
      h = 2 + Math.round(n * 2.6);
      if (n2 < 0.42) { h = 1; mt = M.BED; } else mt = rnd < 0.3 ? M.MUD : M.MOSS;
    } else if (id === 'desert') {
      h = 3 + Math.round(n * 1.6);
      mt = rnd < 0.12 ? M.RED : M.SAND;
      if (n2 > 0.6) { h += 7 + Math.round((n2 - 0.6) * 12); mt = M.RED; }
    }
    const edge = Math.min(i, k, N - 1 - i, N - 1 - k);
    if (edge < 5) { h = Math.max(h, 14 - edge); mt = id === 'snow' ? M.SNOW : id === 'desert' ? M.RED : M.ROCK; m.S[j] = 1; }
    m.H[j] = h; m.Mt[j] = mt;
  }
  // trail loop (runners flee along it, trucks drive it) + spur to the camp gate
  const loop = [];
  const R = 60;
  for (let a = 0; a < 20; a++) {
    const t = a / 20 * Math.PI * 2, w = 1 + (vnoise(a * 0.7, 3, s) - 0.5) * 0.45;
    loop.push([Math.round(Math.cos(t) * R * w), Math.round(Math.sin(t) * R * 0.95 * w - 6)]);
  }
  m.trail = loop;
  roadLine(m, loop, 2, M.ROAD, true);
  roadLine(m, [[0, 93], [0, 70], [0, 52]], 2, M.ROAD);
  roadLine(m, [[-50, -6], [-20, -10], [0, -6], [20, -2], [50, -6]], 2, M.ROAD);
  // poacher camp
  const pc = { x: (r() < 0.5 ? -1 : 1) * 38, z: -50 };
  m.pcamp = pc;
  roadLine(m, [[pc.x, pc.z], [pc.x * 0.8, -40], [loop[15][0], loop[15][1]]], 2, M.ROAD);
  smoothRoads(m);
  const ph = m.H[m.idx(pc.x, pc.z)];
  flatten(m, pc.x, pc.z, 10, ph, M.DRY);
  pc.cages = [{ x: pc.x - 4, z: pc.z - 3 }, { x: pc.x + 4, z: pc.z - 3 }, { x: pc.x, z: pc.z + 4 }];
  m.props.push({ k: 'ptent', x: pc.x - 6, z: pc.z + 5 }); solidRect(m, pc.x - 8, pc.z + 4, pc.x - 5, pc.z + 6, 2);
  m.props.push({ k: 'ptent', x: pc.x + 6, z: pc.z + 5 }); solidRect(m, pc.x + 4, pc.z + 4, pc.x + 7, pc.z + 6, 2);
  m.props.push({ k: 'crates', x: pc.x, z: pc.z - 7 }); solidRect(m, pc.x - 1, pc.z - 8, pc.x + 1, pc.z - 7, 2);
  pc.cages.forEach((c) => m.props.push({ k: 'cage', x: c.x, z: c.z }));
  // gate back to camp (south)
  flatten(m, 0, 86, 7, m.H[m.idx(0, 80)], M.ROAD);
  for (let z = 86; z < m.half; z++) for (let x = -3; x <= 3; x++) { const j = m.idx(x + 0.5, z + 0.5); if (j >= 0) { m.S[j] = 0; m.H[j] = m.H[m.idx(0, 84)]; m.Mt[j] = M.GATE; } }
  m.gates.push({ to: 'camp', x: 0, z: 92, r: 3.8, label: 'BASE CAMP' });
  m.props.push({ k: 'arch', x: 0, z: 89.5, to: 'camp', label: 'BASE CAMP', rot: Math.PI });
  // flora
  const counts = { savanna: [['acacia', 70], ['bush', 80], ['rock', 18], ['mound', 14], ['grass', 260]], jungle: [['jtree', 190], ['bush', 160], ['fern', 200], ['rock', 12]],
    snow: [['pine', 120], ['rock', 30], ['bush', 30], ['grass', 60]], wet: [['mangrove', 60], ['reed', 260], ['bush', 90], ['lily', 90]], desert: [['cactus', 70], ['rock', 40], ['bush', 60], ['bones', 14]] };
  (counts[id] || []).forEach(([k, n]) => {
    for (let c = 0; c < n; c++) {
      const x = Math.floor((r() * 2 - 1) * 86) + 0.5, z = Math.floor((r() * 2 - 1) * 86) + 0.5, j = m.idx(x, z);
      if (j < 0 || m.S[j] || (m.road && m.road[j])) continue;
      if (Math.hypot(x, z - 84) < 12 || Math.hypot(x - pc.x, z - pc.z) < 12) continue;
      const wet = m.H[j] < m.wl;
      if ((k === 'reed' || k === 'lily') !== wet && id === 'wet' && (k === 'reed' || k === 'lily')) continue;
      if (wet && !(k === 'reed' || k === 'lily' || k === 'mangrove')) continue;
      const solidK = { acacia: 0, jtree: 0, pine: 0, cactus: 0, rock: 1, mound: 0, mangrove: 0 };
      const p = { k, x, z, s: 0.75 + r() * 0.6, y: m.H[j] };
      if (k === 'bush' || k === 'fern') { m.props.push(p); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const q = m.idx(x + dx, z + dz); if (q >= 0) m.cover[q] = 1; } continue; }
      addProp(m, p, solidK[k] != null ? solidK[k] : -1);
    }
  });
  m.spawn = { x: 0, z: 80, ang: Math.PI };
  m.truckSpawn = { x: 4, z: 82, ang: Math.PI };
  // reachable animal spots: near the trail, on open ground
  m.spots = [];
  for (let c = 0; c < 400 && m.spots.length < 60; c++) {
    const p = loop[(r() * loop.length) | 0], a = r() * Math.PI * 2, d = 6 + r() * 22;
    const x = p[0] + Math.cos(a) * d, z = p[1] + Math.sin(a) * d, j = m.idx(x, z);
    if (j < 0 || m.S[j] || Math.abs(m.H[j] - m.H[m.idx(p[0], p[1])]) > 2 || Math.hypot(x - pc.x, z - pc.z) < 16 || z > 60) continue;
    if (id !== 'wet' && m.H[j] < m.wl) continue;
    m.spots.push({ x, z });
  }
  return m;
}
function build(id) { return id === 'camp' ? buildCamp() : buildBiome(id); }
})();
