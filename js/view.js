/* Grok Blocks - three.js voxel renderer */
(function () {
'use strict';
const GB = window.GB, THREE = window.THREE;
const V = GB.View = {};
let renderer, scene, cam, sun, amb, hemi, clock;
const TEX = {};
const groups = {};
let ground = null, water = null;
const dummy = new THREE.Object3D();
const CAM = { yaw: 0, dist: 11, pitch: 0.42 };

V.boot = function () {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight);
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 420);
  hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a8a4a, 0.55); scene.add(hemi);
  amb = new THREE.AmbientLight(0xffffff, 0.35); scene.add(amb);
  sun = new THREE.DirectionalLight(0xfff4d2, 0.95); sun.position.set(40, 80, 20); scene.add(sun);
  clock = new THREE.Clock();
  addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  V.scene = scene; V.cam = cam; V.clock = clock;
};
function tex(color, noise) {
  const key = color + ':' + noise;
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
  g.fillStyle = '#' + (color >>> 0).toString(16).padStart(6, '0'); g.fillRect(0, 0, 16, 16);
  if (noise) { for (let i = 0; i < 34; i++) { const v = (Math.random() * 50 - 25) | 0; g.fillStyle = 'rgba(' + (v > 0 ? '255,255,255' : '0,0,0') + ',' + (Math.abs(v) / 90) + ')'; g.fillRect((Math.random() * 16) | 0, (Math.random() * 16) | 0, 2, 2); } }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return TEX[key] = t;
}
const MC = {};
function mat(color, noise) { const k = color + ':' + (noise !== false); return MC[k] || (MC[k] = new THREE.MeshLambertMaterial({ map: tex(color, noise !== false) })); }
const COL = { grass: 0x7da84a, dgrass: 0x3f7a38, dry: 0xc2a24a, sand: 0xe2c27a, snow: 0xf4f7fb, rock: 0x8a8078, mud: 0x8a6a42, bed: 0x3a6a8a, red: 0xc45a3a, ice: 0xc9e6f2, road: 0x6d6256, plank: 0x9a6a3a, moss: 0x5d8a46, pad: 0xd8d2c4, gate: 0xf0c24b };
const MATS = {};
function M(name) { return MATS[name] || (MATS[name] = mat(COL[name] || 0x888888)); }
const MAT_ORDER = ['grass', 'road', 'sand', 'snow', 'rock', 'mud', 'bed', 'dgrass', 'red', 'ice', 'plank', 'dry', 'moss', 'pad', 'gate'];

/* ---------- terrain ---------- */
V.buildTerrain = function (map) {
  for (const k in groups) { scene.remove(groups[k]); groups[k].traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  for (const k in groups) delete groups[k];
  if (ground) { scene.remove(ground); ground.geometry.dispose(); ground = null; }
  if (water) { scene.remove(water); water.geometry.dispose(); water = null; }
  const m = map, N = m.N, cell = 1;
  // group heights into chunks of columns with the same material, merged boxes per height band
  const geo = new THREE.BufferGeometry();
  const verts = [], norms = [], uvs = [], idx = [];
  let base = 0;
  const H = m.H, Mt = m.Mt;
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
    const j = k * N + i, h = H[j]; if (h <= 0) continue;
    const x0 = i - m.half, z0 = k - m.half, y0 = 0, y1 = h;
    const top = h >= m.wl;
    // only emit faces that border a lower neighbour (plus top)
    const faces = [];
    faces.push([0, 1, 0]); // top
    const nb = [[i - 1, k, -1, 0], [i + 1, k, 1, 0], [i, k - 1, 0, -1], [i, k + 1, 0, 1]];
    for (const b of nb) { const hh = (b[0] < 0 || b[1] < 0 || b[0] >= N || b[1] >= N) ? -1 : H[b[1] * N + b[0]]; if (hh < h - 0.01) faces.push([b[2], 0, b[3], hh]); }
    const mt = MAT_ORDER[Mt[j]] || 'grass';
    for (const f of faces) {
      const nx = f[0], ny = f[1], nz = f[2];
      let p;
      if (ny) p = [[x0, y1, z0], [x0 + 1, y1, z0], [x0 + 1, y1, z0 + 1], [x0, y1, z0 + 1]];
      else if (nx) { const x = x0 + (nx > 0 ? 1 : 0), yb = Math.max(0, f[3]); p = [[x, yb, z0], [x, y1, z0], [x, y1, z0 + 1], [x, yb, z0 + 1]]; if (nx < 0) p.reverse(); }
      else { const z = z0 + (nz > 0 ? 1 : 0), yb = Math.max(0, f[3]); p = [[x0, yb, z], [x0 + 1, yb, z], [x0 + 1, y1, z], [x0, y1, z]]; if (nz < 0) p.reverse(); }
      for (const q of p) { verts.push(q[0], q[1], q[2]); norms.push(nx, ny, nz); }
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3); base += 4;
      void mt; void top;
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setIndex(idx);
  // vertex colors by material
  const cols = new Float32Array((verts.length / 3) * 3);
  let vi = 0, fi2 = 0;
  const tmp = new THREE.Color();
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
    const j = k * N + i, h = H[j]; if (h <= 0) continue;
    const nb = [[i - 1, k], [i + 1, k], [i, k - 1], [i, k + 1]];
    let faces = 1; for (const b of nb) { const hh = (b[0] < 0 || b[1] < 0 || b[0] >= N || b[1] >= N) ? -1 : H[b[1] * N + b[0]]; if (hh < h - 0.01) faces++; }
    tmp.set(COL[MAT_ORDER[Mt[j]]] || 0x888888);
    const shade = 0.82 + GB.World.hash(i, k, 99) * 0.28;
    for (let f = 0; f < faces; f++) { const s = f === 0 ? shade : shade * 0.78; for (let q = 0; q < 4; q++) { cols[vi++] = tmp.r * s; cols[vi++] = tmp.g * s; cols[vi++] = tmp.b * s; } fi2++; }
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  ground.position.y = 0; scene.add(ground);
  if (m.wl > 0 && m.id !== 'camp') {
    const g2 = new THREE.PlaneGeometry(N, N); g2.rotateX(-Math.PI / 2);
    water = new THREE.Mesh(g2, new THREE.MeshLambertMaterial({ color: 0x3a88b0, transparent: true, opacity: 0.72 }));
    water.position.y = m.wl - 0.25; scene.add(water);
  }
  buildProps(m);
  const b = GB.BIOMES[m.biome] || GB.BIOMES.camp;
  scene.background = new THREE.Color(b.sky); scene.fog = new THREE.Fog(b.fog, 30, m.id === 'camp' ? 130 : 150);
  V.map = m;
};
function buildProps(m) {
  const grp = groups.props = new THREE.Group(); scene.add(grp);
  const P = [], N = [], C = [], I = []; let base = 0; const col = new THREE.Color();
  const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let G0 = null;
  function box(w, h, d, color, x, y, z, g) {
    const ox = g.x + x, oy = g.y + y, oz = g.z + z, hw = w / 2, hh = h / 2, hd = d / 2;
    col.set(color); const sh = 0.9 + Math.random() * 0.2;
    for (const f of FACES) {
      const [nx, ny, nz] = f; let q;
      if (nx) q = [[nx * hw, -hh, -hd * nx], [nx * hw, -hh, hd * nx], [nx * hw, hh, hd * nx], [nx * hw, hh, -hd * nx]];
      else if (ny) q = [[-hw, ny * hh, -hd * ny], [-hw, ny * hh, hd * ny], [hw, ny * hh, hd * ny], [hw, ny * hh, -hd * ny]];
      else q = [[hw * nz, -hh, nz * hd], [-hw * nz, -hh, nz * hd], [-hw * nz, hh, nz * hd], [hw * nz, hh, nz * hd]];
      const k = (ny > 0 ? 1 : ny < 0 ? 0.6 : nx ? 0.85 : 0.75) * sh;
      for (const v of q) { P.push(ox + v[0], oy + v[1], oz + v[2]); N.push(nx, ny, nz); C.push(col.r * k, col.g * k, col.b * k); }
      I.push(base, base + 2, base + 1, base, base + 3, base + 2); base += 4;
    }
  }
  for (const p of m.props) {
    const s = p.s || 1, g = { x: p.x, y: m.h(p.x, p.z), z: p.z }; G0 = g;
    if (p.k === 'tree') { box(0.5, 2.4 * s, 0.5, 0x6b4423, 0, 1.2 * s, 0, g); box(2.2 * s, 1.6 * s, 2.2 * s, 0x3f8a3a, 0, 2.6 * s, 0, g); box(1.4 * s, 1.1 * s, 1.4 * s, 0x58b24a, 0, 3.6 * s, 0, g); }
    else if (p.k === 'jtree') { box(0.6, 3.4 * s, 0.6, 0x5a3a22, 0, 1.7 * s, 0, g); box(2.6 * s, 1.2 * s, 2.6 * s, 0x1f6b30, 0, 3.4 * s, 0, g); box(1.8 * s, 1 * s, 1.8 * s, 0x2f8a40, 0.4, 4.2 * s, 0, g); }
    else if (p.k === 'pine') { box(0.4, 2.6 * s, 0.4, 0x6b4a2a, 0, 1.3 * s, 0, g); box(1.8 * s, 1 * s, 1.8 * s, 0x2f6b4a, 0, 2.2 * s, 0, g); box(1.2 * s, 1.4 * s, 1.2 * s, 0xeaf2f6, 0, 3.2 * s, 0, g); }
    else if (p.k === 'acacia') { box(0.4, 2.2 * s, 0.4, 0x8a5a2a, 0, 1.1 * s, 0, g); box(3 * s, 0.6 * s, 3 * s, 0x7a9a3a, 0.4, 2.6 * s, 0, g); }
    else if (p.k === 'mangrove') { box(0.35, 2 * s, 0.35, 0x6b4a2a, 0, s, 0, g); box(1.8 * s, 0.9 * s, 1.8 * s, 0x2f7a44, 0, 2.2 * s, 0, g); }
    else if (p.k === 'cactus') { box(0.6, 2.4 * s, 0.6, 0x3a8a44, 0, 1.2 * s, 0, g); box(0.9, 0.4, 0.4, 0x3a8a44, 0.6, 1.6 * s, 0, g); box(0.35, 0.8, 0.35, 0x3a8a44, 0.95, 2.0 * s, 0, g); }
    else if (p.k === 'bush') box(1.3 * s, 0.9 * s, 1.3 * s, 0x4a8a3a, 0, 0.45 * s, 0, g);
    else if (p.k === 'fern') box(1 * s, 0.6 * s, 1 * s, 0x2f8a4a, 0, 0.3, 0, g);
    else if (p.k === 'reed') { box(0.15, 1.3 * s, 0.15, 0xc2b45a, 0, 0.65, 0, g); box(0.15, 1.0 * s, 0.15, 0xa8a04a, 0.3, 0.5, 0.2, g); }
    else if (p.k === 'lily') box(0.7, 0.1, 0.7, 0x5aa04a, 0, m.wl - g.y - 0.2, 0, g);
    else if (p.k === 'rock') { box(1.6 * s, 1.1 * s, 1.4 * s, 0x8a8278, 0, 0.55 * s, 0, g); box(0.9 * s, 0.7 * s, 0.9 * s, 0x9a948a, 0.3, 1.3 * s, 0.1, g); }
    else if (p.k === 'mound') box(1.2 * s, 1.6 * s, 1.2 * s, 0xb8884a, 0, 0.8 * s, 0, g);
    else if (p.k === 'bones') { box(0.9, 0.2, 0.3, 0xeee6d4, 0, 0.1, 0, g); box(0.2, 0.2, 0.7, 0xeee6d4, 0.4, 0.1, 0, g); }
    else if (p.k === 'grass') box(0.3, 0.5 * s, 0.3, 0x9aba4a, 0, 0.25, 0, g);
    else if (p.k === 'tent') { box(3, 1.4, 2.4, 0xf2f2ea, 0, 0.7, 0, g); box(3.1, 0.2, 2.5, 0xe25b4a, 0, 1.45, 0, g); }
    else if (p.k === 'ptent') { box(2.8, 1.4, 2.2, 0x5a6a3a, 0, 0.7, 0, g); box(0.8, 0.9, 0.1, 0x222222, 0, 0.5, 1.12, g); }
    else if (p.k === 'cage') { for (const dx of [-0.9, 0.9]) for (const dz of [-0.9, 0.9]) box(0.15, 1.6, 0.15, 0x7a8a9a, dx, 0.8, dz, g); box(1.95, 0.15, 1.95, 0x7a8a9a, 0, 1.6, 0, g); for (const dz of [-0.45, 0, 0.45]) { box(0.08, 1.6, 0.08, 0x9aa8b8, -0.9, 0.8, dz, g); box(0.08, 1.6, 0.08, 0x9aa8b8, 0.9, 0.8, dz, g); } }
    else if (p.k === 'crates') { box(1, 1, 1, 0x8a5a2a, -0.4, 0.5, 0, g); box(0.8, 0.8, 0.8, 0xa8723a, 0.5, 0.4, 0.2, g); }
    else if (p.k === 'hq') { box(11, 3.2, 7, 0xd8d2c2, 0, 1.6, 0, g); box(11.6, 0.6, 7.6, 0x2f6b4a, 0, 3.5, 0, g); box(1.6, 2, 0.2, 0x6b4423, 0, 1, 3.55, g); box(3, 0.8, 0.2, 0xf0c24b, 0, 2.6, 3.6, g); box(1.2, 0.9, 0.2, 0x9ad0f0, -3, 1.8, 3.55, g); box(1.2, 0.9, 0.2, 0x9ad0f0, 3, 1.8, 3.55, g); }
    else if (p.k === 'shed') { box(6, 2.8, 5, 0xc2b48a, 0, 1.4, 0, g); box(6.4, 0.4, 5.4, 0x8a4a2a, 0, 3, 0, g); box(2.4, 1.8, 0.2, 0x6b4423, 0, 0.9, 2.55, g); }
    else if (p.k === 'supply') { box(5, 2.2, 3, 0xb8c8d2, 0, 1.1, 0, g); box(1.2, 0.8, 0.8, 0xf0c24b, -1, 0.4, 2, g); box(1, 0.6, 0.8, 0xe25b4a, 1, 0.3, 2, g); }
    else if (p.k === 'board') { box(4.4, 2.6, 0.3, 0x6b4423, 0, 1.6, 0, g); box(4, 2, 0.2, 0xf4f0e2, 0, 1.7, 0.2, g); box(0.8, 0.6, 0.1, 0xe25b4a, -1, 2, 0.32, g); box(0.8, 0.6, 0.1, 0x3a8ad2, 0.4, 1.4, 0.32, g); box(0.8, 0.6, 0.1, 0x2f8a4a, 1.2, 2.1, 0.32, g); }
    else if (p.k === 'fire') { box(1.2, 0.3, 1.2, 0x6b4423, 0, 0.15, 0, g); box(0.5, 0.8, 0.5, 0xff8a2a, 0, 0.6, 0, g); box(0.3, 0.5, 0.3, 0xffd24a, 0, 1, 0, g); }
    else if (p.k === 'flag') { box(0.15, 4, 0.15, 0x999999, 0, 2, 0, g); box(1.6, 0.9, 0.08, 0x2f8a4a, 0.8, 3.4, 0, g); }
    else if (p.k === 'arch') { box(0.8, 4, 0.8, 0x6b4423, -4.4, 2, 0, g); box(0.8, 4, 0.8, 0x6b4423, 4.4, 2, 0, g); box(9.6, 0.8, 0.9, 0xf0c24b, 0, 4.2, 0, g); }
    else if (p.k === 'sign') { box(0.2, 1.4, 3, p.color || 0xf4f0e2, 0, 1.6, 0, g); box(0.2, 1.6, 0.2, 0x6b4423, 0, 0.6, -1.2, g); box(0.2, 1.6, 0.2, 0x6b4423, 0, 0.6, 1.2, g); }
  }
  void G0;
  // sanctuary fences
  for (const sc of (m.sanct || [])) {
    for (let x = sc.x0; x <= sc.x1; x++) for (let z = sc.z0; z <= sc.z1; z++) {
      const edge = x === sc.x0 || x === sc.x1 || z === sc.z0 || z === sc.z1; if (!edge) continue;
      const j = m.idx(x + 0.5, z + 0.5); if (j < 0 || m.S[j] !== 3) continue;
      const g = { x: x + 0.5, y: m.H[j], z: z + 0.5 };
      box(0.25, 1.4, 0.25, 0x8a5a2a, 0, 0.7, 0, g); box(x === sc.x0 || x === sc.x1 ? 0.12 : 1, 0.15, x === sc.x0 || x === sc.x1 ? 1 : 0.12, 0xb8884a, 0, 1.1, 0, g);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I);
  grp.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  // floating labels for gates / sanctuaries / camp spots
  const lab = (text, x, y, z, color, w) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,30,20,0.78)'; g.fillRect(0, 0, 512, 128); g.strokeStyle = color || '#f0c24b'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 118);
    g.fillStyle = '#fff'; g.font = 'bold 54px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false })); sp.scale.set(w || 7, (w || 7) / 4, 1); sp.position.set(x, y, z); grp.add(sp);
  };
  m.gates.forEach((gt) => lab(gt.label, gt.x, m.h(gt.x, gt.z) + 6.5, gt.z + (m.id === 'camp' ? 1 : -1)));
  (m.sanct || []).forEach((sc) => lab(sc.name.toUpperCase(), sc.x, 7, sc.z, '#' + sc.color.toString(16), 12));
  if (m.board) lab('CASE BOARD', m.board.x, 5, m.board.z - 0.5, '#e25b4a', 6);
  if (m.shop) lab('UPGRADES', m.shop.x + 1, 5.6, m.shop.z - 4, '#3fc8ff', 6);
  if (m.supply) lab('DART SUPPLY', m.supply.x - 0.5, 5, m.supply.z - 4, '#f0c24b', 6);
  if (m.pcamp) lab('POACHER CAMP', m.pcamp.x, m.h(m.pcamp.x, m.pcamp.z) + 6, m.pcamp.z, '#ff4d4d', 8);
}

/* ---------- actors ---------- */
const actors = {};
function ensure(key, build) { if (!actors[key]) { actors[key] = build(); scene.add(actors[key]); } return actors[key]; }
function blocky(parts) { const g = new THREE.Group(); for (const p of parts) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(p[0], p[1], p[2]), mat(p[3], false)); mesh.position.set(p[4], p[5], p[6]); g.add(mesh); } return g; }
V.clearActors = function () { for (const k in actors) { scene.remove(actors[k]); } for (const k in actors) delete actors[k]; };

function ranger(color) { return blocky([[0.7, 0.8, 0.4, 0x3a3a3a, 0, 0.9, 0], [0.8, 0.7, 0.5, color, 0, 1.55, 0], [0.5, 0.5, 0.5, 0xf2c8a2, 0, 2.1, 0], [0.62, 0.25, 0.62, 0xf0c24b, 0, 2.45, 0]]); }
function animalMesh(sp) {
  const d = GB.SPECIES[sp], c = d.color, c2 = d.color2, s = d.size;
  if (sp === 'giraffe') return blocky([[0.5, 2.6, 0.5, c, -0.3, 1.5, 0.2], [0.5, 2.6, 0.5, c, 0.3, 1.5, 0.2], [0.5, 2.4, 0.5, c, -0.3, 1.4, -0.7], [0.5, 2.4, 0.5, c, 0.3, 1.4, -0.7], [1.3, 1.2, 2.2, c, 0, 3.1, -0.3], [0.45, 1.5, 0.45, c, 0, 4.2, 0.9], [0.55, 0.7, 0.9, c, 0, 4.7, 1.4], [0.1, 0.5, 0.1, c2, -0.15, 5.2, 1.3], [0.1, 0.5, 0.1, c2, 0.15, 5.2, 1.3]]);
  if (sp === 'elephant') return blocky([[0.7, 1.6, 0.7, c, -0.6, 0.9, 0.4], [0.7, 1.6, 0.7, c, 0.6, 0.9, 0.4], [0.7, 1.5, 0.7, c, -0.6, 0.85, -0.8], [0.7, 1.5, 0.7, c, 0.6, 0.85, -0.8], [2.2, 1.8, 3, c, 0, 2.2, -0.2], [1.4, 1.3, 1.4, c, 0, 3, 1.3], [0.5, 1.4, 0.5, c, 0, 1.6, 2], [0.9, 0.3, 0.7, c2, -0.9, 3.2, 0.2], [0.9, 0.3, 0.7, c2, 0.9, 3.2, 0.2]]);
  if (sp === 'zebra') return blocky([[0.3, 1, 0.3, c, -0.3, 0.6, 0.4], [0.3, 1, 0.3, c2, 0.3, 0.6, 0.4], [0.3, 1, 0.3, c, -0.3, 0.6, -0.5], [0.3, 1, 0.3, c2, 0.3, 0.6, -0.5], [1, 0.9, 1.8, c, 0, 1.4, -0.1], [0.5, 0.5, 0.4, c2, 0, 1.5, 0.5], [0.45, 0.7, 0.7, c, 0, 1.9, 0.9], [0.15, 0.7, 0.15, c2, 0, 1.6, -1.1]]);
  if (sp === 'lion') return blocky([[0.35, 0.9, 0.35, c, -0.3, 0.5, 0.35], [0.35, 0.9, 0.35, c, 0.3, 0.5, 0.35], [0.35, 0.9, 0.35, c, -0.3, 0.5, -0.4], [0.35, 0.9, 0.35, c, 0.3, 0.5, -0.4], [1, 0.9, 1.8, c, 0, 1.2, 0], [0.7, 0.7, 0.7, c, 0, 1.7, 0.9], [1.3, 1.3, 0.5, c2, 0, 1.9, 0.7], [0.2, 0.9, 0.2, c2, 0, 1.2, -1]]);
  if (sp === 'rhino') return blocky([[0.55, 1, 0.55, c, -0.5, 0.6, 0.5], [0.55, 1, 0.55, c, 0.5, 0.6, 0.5], [0.55, 1, 0.55, c, -0.5, 0.6, -0.6], [0.55, 1, 0.55, c, 0.5, 0.6, -0.6], [1.7, 1.3, 2.6, c, 0, 1.6, -0.1], [1, 0.9, 1.1, c, 0, 1.7, 1.3], [0.25, 0.7, 0.25, c2, 0, 2.2, 1.9]]);
  if (sp === 'gorilla') return blocky([[0.5, 0.9, 0.5, c, -0.4, 0.5, 0.2], [0.5, 0.9, 0.5, c, 0.4, 0.5, 0.2], [1.6, 1.3, 1.1, c, 0, 1.3, 0], [0.9, 0.9, 0.9, c2, 0, 2.2, 0.3], [0.4, 1.1, 0.4, c, -0.9, 0.9, 0.4], [0.4, 1.1, 0.4, c, 0.9, 0.9, 0.4]]);
  if (sp === 'parrot') return blocky([[0.5, 0.5, 0.8, c, 0, 0.9, 0], [0.25, 0.4, 0.7, c2, -0.45, 1, -0.1], [0.25, 0.4, 0.7, 0x2a6ad4, 0.45, 1, -0.1], [0.3, 0.3, 0.4, 0xf2c24b, 0, 1.2, 0.5], [0.1, 0.4, 0.1, c2, 0, 0.5, 0]]);
  if (sp === 'croc') return blocky([[0.4, 0.4, 0.7, c, -0.4, 0.3, 0.6], [0.4, 0.4, 0.7, c, 0.4, 0.3, 0.6], [0.4, 0.4, 0.7, c, -0.4, 0.3, -0.8], [0.4, 0.4, 0.7, c, 0.4, 0.3, -0.8], [1.1, 0.6, 2.6, c, 0, 0.6, -0.2], [0.7, 0.5, 1.4, c2, 0, 0.7, 1.4], [0.9, 0.3, 1.2, c, 0, 0.5, -1.8]]);
  if (sp === 'flamingo') return blocky([[0.1, 1.1, 0.1, c, -0.1, 0.6, 0], [0.1, 1.1, 0.1, c, 0.1, 0.6, 0], [0.5, 0.5, 0.7, c, 0, 1.3, 0], [0.15, 0.5, 0.15, c, 0, 1.7, 0.4], [0.25, 0.2, 0.4, c2, 0, 1.6, 0.7]]);
  if (sp === 'leopard') return blocky([[0.25, 0.7, 0.25, c, -0.25, 0.4, 0.3], [0.25, 0.7, 0.25, c2, 0.25, 0.4, 0.3], [0.25, 0.7, 0.25, c, -0.25, 0.4, -0.35], [0.25, 0.7, 0.25, c2, 0.25, 0.4, -0.35], [0.8, 0.7, 1.5, c, 0, 1, 0], [0.55, 0.5, 0.55, c, 0, 1.3, 0.8], [0.7, 0.15, 0.4, c2, 0, 1.1, -0.9]]);
  if (sp === 'fox') return blocky([[0.2, 0.5, 0.2, c, -0.15, 0.3, 0.2], [0.2, 0.5, 0.2, c, 0.15, 0.3, 0.2], [0.2, 0.5, 0.2, c, -0.15, 0.3, -0.25], [0.2, 0.5, 0.2, c, 0.15, 0.3, -0.25], [0.6, 0.5, 0.9, c, 0, 0.7, 0], [0.45, 0.4, 0.45, c, 0, 1.05, 0.45], [0.12, 0.45, 0.12, c, -0.15, 1.4, 0.45], [0.12, 0.45, 0.12, c, 0.15, 1.4, 0.45], [0.3, 0.3, 0.4, c2, 0, 0.6, -0.6]]);
  if (sp === 'camel') return blocky([[0.35, 1.4, 0.35, c, -0.35, 0.8, 0.5], [0.35, 1.4, 0.35, c, 0.35, 0.8, 0.5], [0.35, 1.4, 0.35, c, -0.35, 0.8, -0.6], [0.35, 1.4, 0.35, c, 0.35, 0.8, -0.6], [1.2, 1.1, 2.2, c, 0, 2, -0.1], [0.5, 0.7, 0.5, c2, -0.2, 2.7, 0], [0.5, 0.7, 0.5, c2, 0.2, 2.7, -0.5], [0.5, 0.8, 0.6, c, 0, 2.4, 1.2]]);
  // generic blocky quadruped
  const L = sp === 'panda' || sp === 'capy' ? 0.45 : 0.9, bw = 0.8 * s, bl = 1.6 * s, bh = 0.8 * s;
  const parts = [[0.28, L, 0.28, c2, -bw / 3, L / 2, bl / 3], [0.28, L, 0.28, c2, bw / 3, L / 2, bl / 3], [0.28, L, 0.28, c2, -bw / 3, L / 2, -bl / 3], [0.28, L, 0.28, c2, bw / 3, L / 2, -bl / 3],
    [bw, bh, bl, c, 0, L + bh / 2, 0], [0.55 * s, 0.55 * s, 0.6 * s, c, 0, L + bh + 0.1, bl / 2 + 0.2]];
  if (sp === 'ibex') parts.push([0.12, 0.7, 0.12, c2, -0.15, L + bh + 0.6, bl / 2], [0.12, 0.7, 0.12, c2, 0.15, L + bh + 0.6, bl / 2]);
  if (sp === 'oryx') parts.push([0.08, 1.1, 0.08, c2, -0.12, L + bh + 0.8, bl / 2], [0.08, 1.1, 0.08, c2, 0.12, L + bh + 0.8, bl / 2], [bw + 0.02, 0.15, bl * 0.8, c2, 0, L + bh * 0.3, 0]);
  if (sp === 'okapi') parts.push([0.3, 0.2, 0.3, c2, -bw / 3, L * 0.7, -bl / 3], [0.3, 0.2, 0.3, c2, bw / 3, L * 0.7, -bl / 3], [0.4 * s, 0.6 * s, 0.4 * s, c, 0, L + bh + 0.3, bl / 2]);
  if (sp === 'panda') parts.push([0.3, 0.3, 0.9, c, 0, L + 0.5, -bl / 2 - 0.3], [0.62 * s, 0.2, 0.2, 0xf2f2f2, 0, L + bh + 0.2, bl / 2 + 0.5]);
  if (sp === 'tapir') parts.push([0.25, 0.25, 0.4, c, 0, L + bh - 0.1, bl / 2 + 0.6], [bw + 0.02, bh * 0.9, 0.5 * s, c2, 0, L + bh / 2, -0.05]);
  return blocky(parts);
}
function truckMesh() {
  return blocky([
    [2.1, 0.7, 4.4, 0x2f6b4a, 0, 0.8, 0], [2, 0.5, 1.5, 0xd8efe2, 0, 1.5, 0.9], [1.9, 0.9, 2.2, 0x24563a, 0, 1.5, -1.1],
    [0.5, 0.5, 0.3, 0x222, -0.8, 0.45, 1.5], [0.5, 0.5, 0.3, 0x222, 0.8, 0.45, 1.5], [0.5, 0.5, 0.3, 0x222, -0.8, 0.45, -1.5], [0.5, 0.5, 0.3, 0x222, 0.8, 0.45, -1.5],
    [0.3, 0.3, 0.1, 0xf2e27a, -0.6, 1.1, 2.2], [0.3, 0.3, 0.1, 0xf2e27a, 0.6, 1.1, 2.2]
  ]);
}
function poacherMesh() { return blocky([[0.6, 0.8, 0.4, 0x2a2a2a, 0, 0.8, 0], [0.8, 0.8, 0.5, 0x6a4a2a, 0, 1.5, 0], [0.5, 0.5, 0.5, 0xf2c8a2, 0, 2.05, 0], [0.7, 0.3, 0.7, 0x222, 0, 2.4, 0]]); }
function jeepMesh() { return blocky([[1.8, 0.6, 3.2, 0x5a4632, 0, 0.7, 0], [1.6, 0.7, 1.2, 0x3a3228, 0, 1.3, 0.4], [0.4, 0.4, 0.2, 0x222, -0.7, 0.4, 1.1], [0.4, 0.4, 0.2, 0x222, 0.7, 0.4, 1.1], [0.4, 0.4, 0.2, 0x222, -0.7, 0.4, -1.1], [0.4, 0.4, 0.2, 0x222, 0.7, 0.4, -1.1]]); }

V.sync = function (W, me, others) {
  // truck
  if (W.truck) { const t = ensure('truck', truckMesh); t.visible = true; t.position.set(W.truck.x, (W.truck.y || W.M.h(W.truck.x, W.truck.z)), W.truck.z); t.rotation.y = W.truck.ang; }
  // animals
  const seen = {};
  for (const e of W.ents) {
    seen['a' + e.id] = 1; const g = ensure('a' + e.id, () => animalMesh(e.sp)); g.visible = e.st !== 'cargo'; g.scale.setScalar(1);
    g.position.set(e.x, W.M.h(e.x, e.z), e.z); g.rotation.y = e.ang;
    const asleep = e.st === 'asleep'; g.rotation.z = asleep ? Math.PI / 2 : 0; g.position.y += asleep ? 0.2 : 0;
    if (e.st === 'windup') g.position.y += Math.sin(performance.now() / 60) * 0.15;
  }
  const mark = (key, kind, x, y, z) => { seen[key] = 1; const g = ensure(key, () => kind === 'warn' ? blocky([[0.3, 0.8, 0.3, 0xff2d2d, 0, 0.7, 0], [0.3, 0.3, 0.3, 0xff2d2d, 0, 0, 0]]) : kind === 'zzz' ? blocky([[0.6, 0.15, 0.15, 0x9ad0ff, 0, 0.5, 0], [0.15, 0.4, 0.15, 0x9ad0ff, 0, 0.25, 0], [0.6, 0.15, 0.15, 0x9ad0ff, 0, 0, 0]]) : (() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 14, 0.35), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.45, fog: false })); const gg = new THREE.Group(); gg.add(m); m.position.y = 7; return gg; })()); g.visible = true; g.position.set(x, y + (kind === 'beacon' ? 0 : Math.sin(performance.now() / 200) * 0.15), z); if (kind !== 'beacon') g.rotation.y = cam.rotation.y; };
  for (const e of W.ents) {
    if (e.st === 'cargo' || e.st === 'safe') continue;
    const top = W.M.h(e.x, e.z) + GB.SPECIES[e.sp].size * 2 + 1.2;
    if (e.st === 'windup' || e.st === 'charge') mark('w' + e.id, 'warn', e.x, top, e.z);
    else if (e.st === 'asleep') mark('z' + e.id, 'zzz', e.x, top - 0.6, e.z);
    if (e.caseAnimal && e.st !== 'caged') mark('b' + e.id, 'beacon', e.x, W.M.h(e.x, e.z), e.z);
  }
  for (const p of W.poachers) { if (p.st === 'alert' || p.st === 'chase') mark('w' + p.id, 'warn', p.x, W.M.h(p.x, p.z) + 3.2, p.z); }
  for (const j of W.jeeps) { if (j.chase || j.cargo) mark('w' + j.id, 'warn', j.x, W.M.h(j.x, j.z) + 3, j.z); if (j.cargo) { const e = W.ents.find((q) => q.id === j.cargo); if (e) { const ga = actors['a' + e.id]; if (ga) { ga.scale.setScalar(0.6); ga.position.y += 1.1; } } } }
  for (const p of W.poachers) { seen['p' + p.id] = 1; const g = ensure('p' + p.id, poacherMesh); g.position.set(p.x, W.M.h(p.x, p.z), p.z); g.rotation.y = p.ang; if (p.st === 'chase') g.position.y += 0.1; }
  for (const j of W.jeeps) { seen['j' + j.id] = 1; const g = ensure('j' + j.id, jeepMesh); g.position.set(j.x, W.M.h(j.x, j.z), j.z); g.rotation.y = j.ang; }
  for (const f of W.flares) { const k = 'f' + f.x.toFixed(1) + '_' + f.z.toFixed(1); seen[k] = 1; const g = ensure(k, () => blocky([[0.5, 0.8, 0.5, 0xff5a2a, 0, 0.6, 0]])); g.position.set(f.x, W.M.h(f.x, f.z) + 0.5, f.z); }
  for (let i = 0; i < W.darts.length; i++) { const d = W.darts[i]; const k = 'd' + i; seen[k] = 1; const g = ensure(k, () => blocky([[0.12, 0.12, 0.5, 0xf2e27a, 0, 0, 0]])); g.position.set(d.x, W.M.h(d.x, d.z) + 1.2, d.z); }
  // players
  if (me) { seen.me = 1; const g = ensure('me', () => ranger(0x2f8a4a)); g.visible = me.onFoot; g.position.set(me.x, W.M.h(me.x, me.z), me.z); g.rotation.y = me.ang; g.scale.y = me.crouch ? 0.65 : 1; }
  let oi = 0;
  for (const id in others) { const o = others[id]; if (!o || !o.s) continue; seen['o' + oi] = 1; const g = ensure('o' + oi, () => ranger(parseInt(o.color.slice(1), 16) || 0x3aa0d8)); g.visible = true; g.position.set(o.s.x, W.M.h(o.s.x, o.s.z), o.s.z); g.rotation.y = o.s.a; oi++; }
  // crew riders shown when seats hold crew ids
  if (W.truck) W.truck.seats.forEach((sid, i) => { const decor = !sid && i > 0 && W.truck.seats.some((q) => q); if ((sid && String(sid).indexOf('crew') === 0) || decor) { seen['c' + i] = 1; const g = ensure('c' + i, () => ranger(i ? 0xd23b6b : 0x3a6ad2)); const side = i === 1 ? 1 : i === 2 ? -1 : 0; g.position.set(W.truck.x + Math.cos(W.truck.ang) * side * 0.7, W.M.h(W.truck.x, W.truck.z) + 0.6, W.truck.z - Math.sin(W.truck.ang) * side * 0.7); g.rotation.y = W.truck.ang; } });
  for (const k in actors) if (!seen[k] && k !== 'truck') actors[k].visible = false;
};

/* ---------- camera ---------- */
V.frame = function (target, dt, lookYaw) {
  const y = V.map.h(target.x, target.z);
  const behind = CAM.yaw;
  const dist = CAM.dist, pitch = CAM.pitch;
  const cx = target.x - Math.sin(behind) * dist * Math.cos(pitch);
  const cz = target.z - Math.cos(behind) * dist * Math.cos(pitch);
  const cy = y + 2.2 + Math.sin(pitch) * dist;
  cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 4);
  cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 4);
  cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 4);
  cam.lookAt(target.x, y + 1.4, target.z);
  // keep camera above ground
  const gh = V.map.h(cam.position.x, cam.position.z);
  if (cam.position.y < gh + 1.2) cam.position.y = gh + 1.2;
};
V.snapCam = function (target) { CAM.yaw = target.ang || 0; V.frame(target, 10); };
V.camYaw = () => CAM.yaw;
let dragT = 0;
V.follow = function (ang, dt) { dragT -= dt; if (dragT > 0) return; let d = ang - CAM.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; CAM.yaw += d * Math.min(1, dt * 2.5); };
V.orbit = (dx) => { CAM.yaw -= dx * 0.006; dragT = 1.5; };
V.setCam = (o) => Object.assign(CAM, o);
let lastNight = null; const _c1 = new THREE.Color(), _c2 = new THREE.Color();
V.render = function (night) {
  if (!V.map) { renderer.render(scene, cam); return; }
  const b = GB.BIOMES[V.map.biome] || GB.BIOMES.camp;
  const n = Math.max(0, Math.min(1, +night || 0)), q = Math.round(n * 40) / 40;
  if (lastNight !== q || V._fogMap !== V.map) {
    lastNight = q; V._fogMap = V.map;
    scene.fog.color.copy(_c1.set(b.fog).lerp(_c2.set(0x0c1630), q));
    if (!(scene.background && scene.background.isColor)) scene.background = new THREE.Color();
    scene.background.copy(_c1.set(b.sky).lerp(_c2.set(0x08102a), q));
    const far = V.map.id === 'camp' ? 130 : 150; scene.fog.near = 30 - 12 * q; scene.fog.far = far - (far - 90) * q;
    sun.color.copy(_c1.set(b.sun).lerp(_c2.set(0x8899cc), q));
  }
  sun.intensity = 0.9 * (1 - 0.55 * n); amb.intensity = 0.45 - 0.15 * n; hemi.intensity = 0.65 - 0.3 * n;
  renderer.render(scene, cam);
};
V.project = function (x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z }; };
})();
