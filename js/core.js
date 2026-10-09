// Atlas Drive: renderer, sky, textures, shared materials, geometry helpers
const $ = id => document.getElementById(id);
const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- Renderer & scene ---------- */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const C = hex => new THREE.Color(hex).convertSRGBToLinear();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 3000);
scene.add(camera);

const SUN_DIR = new THREE.Vector3(-0.55, 0.36, -0.75).normalize();
function makeSkyMesh(radius) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f62ad) }, hz: { value: new THREE.Color(0xf2c193) }, sun: { value: SUN_DIR.clone() }, glow: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hz; uniform vec3 sun; uniform float glow; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0001, 1.0);
        vec3 c = mix(hz, top, pow(h, 0.5));
        c = mix(c, hz * 0.82, clamp(-d.y * 5.0, 0.0, 1.0));
        float s = max(dot(d, sun), 0.0001);
        c += glow * (vec3(1.0, 0.72, 0.42) * pow(s, 10.0) * 0.38 + vec3(1.0, 0.92, 0.75) * pow(s, 900.0) * 5.0);
        gl_FragColor = vec4(c, 1.0); }`
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
}
const sky = makeSkyMesh(2400);
sky.renderOrder = -10; sky.frustumCulled = false;
scene.add(sky);
scene.fog = new THREE.Fog(C(0xd9b596), 180, 1100);

const hemi = new THREE.HemisphereLight(C(0xbfd4f2), C(0x6e5a48), 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(C(0xffd2a6), 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 500 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

/* ---------- Random ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- Textures ---------- */
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  return t;
}
function noise(ctx, w, h, n, a, light) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
const groundTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#8b8378'; x.fillRect(0, 0, w, h);
  noise(x, w, h, 5000, 0.12, false); noise(x, w, h, 3000, 0.10, true);
  x.strokeStyle = 'rgba(60,52,44,.22)'; x.lineWidth = 2;
  for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 128); x.lineTo(w, i * 128); x.stroke(); }
});
groundTex.repeat.set(1000, 1000);
// road textures: one repeat = road width (u) x 8 m (v)
function roadTexture(kind) {
  return canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#2d2f33'; x.fillRect(0, 0, w, h);
    noise(x, w, h, 6000, 0.18, false); noise(x, w, h, 2500, 0.07, true);
    // tyre polish lanes
    x.fillStyle = 'rgba(0,0,0,.10)'; x.fillRect(w * 0.18, 0, w * 0.12, h); x.fillRect(w * 0.70, 0, w * 0.12, h);
    const white = 'rgba(236,232,222,.88)', yellow = '#e7b03a';
    if (kind !== 'lane') { x.fillStyle = white; x.fillRect(3, 0, 3, h); x.fillRect(w - 6, 0, 3, h); }
    if (kind === 'two') { x.fillStyle = yellow; x.fillRect(w / 2 - 2, 0, 4, h * 0.5); }
    if (kind === 'multi') {
      x.fillStyle = yellow; x.fillRect(w / 2 - 4, 0, 3, h); x.fillRect(w / 2 + 1, 0, 3, h);
      x.fillStyle = white; x.fillRect(w * 0.25 - 1.5, 0, 3, h * 0.4); x.fillRect(w * 0.75 - 1.5, 0, 3, h * 0.4);
    }
    if (kind === 'oneway') { x.fillStyle = white; x.fillRect(w / 2 - 1.5, 0, 3, h * 0.4); }
  });
}
const ROAD_TEX = { two: roadTexture('two'), multi: roadTexture('multi'), oneway: roadTexture('oneway'), lane: roadTexture('lane') };
const walkTex = canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#b4ab9e'; x.fillRect(0, 0, w, h); noise(x, w, h, 2500, 0.10, false);
  x.strokeStyle = 'rgba(70,62,54,.35)'; x.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); }
  x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
  x.fillStyle = '#d7d0c4'; x.fillRect(w - 10, 0, 10, h); // kerb edge (u = 1 side)
});
const concreteTex = canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#a7a39b'; x.fillRect(0, 0, w, h); noise(x, w, h, 4000, 0.14, false); noise(x, w, h, 1500, 0.08, true);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, w, 3);
});
const smokeTex = canvasTex(64, 64, (x, w, h) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(235,230,224,1)'); g.addColorStop(0.6, 'rgba(225,220,214,.45)'); g.addColorStop(1, 'rgba(220,215,210,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const blobTex = canvasTex(64, 64, (x, w, h) => {
  const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}, false);

function makeEnv(night) {
  const eq = document.createElement('canvas'); eq.width = 1024; eq.height = 512; const x = eq.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  if (night) { g.addColorStop(0, '#05070e'); g.addColorStop(0.45, '#141b2c'); g.addColorStop(0.5, '#2a2a33'); g.addColorStop(0.51, '#0d0e12'); g.addColorStop(1, '#050506'); }
  else { g.addColorStop(0, '#2c5ea8'); g.addColorStop(0.38, '#8fb0d6'); g.addColorStop(0.49, '#f0c597'); g.addColorStop(0.5, '#7b6a5a'); g.addColorStop(1, '#2e2924'); }
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  if (!night) {
    const su = Math.atan2(SUN_DIR.z, SUN_DIR.x) / (2 * PI) + 0.5, sv = 1 - (Math.asin(SUN_DIR.y) / PI + 0.5);
    const rg = x.createRadialGradient(su * 1024, sv * 512, 0, su * 1024, sv * 512, 160);
    rg.addColorStop(0, 'rgba(255,248,230,1)'); rg.addColorStop(0.08, 'rgba(255,214,160,.9)'); rg.addColorStop(1, 'rgba(255,190,130,0)');
    x.fillStyle = rg; x.fillRect(0, 0, 1024, 512);
  }
  const r = rng(3);
  for (let i = 0; i < 90; i++) {
    const w = 8 + r() * 26, h = 8 + r() * 70, px = r() * 1024, c = night ? 14 + r() * 14 : 70 + r() * 60;
    x.fillStyle = `rgb(${c},${c + 4},${c + 10})`; x.fillRect(px, 256 - h, w, h);
    if (night) for (let k = 0; k < w * h / 18; k++) { x.fillStyle = r() < 0.7 ? 'rgba(255,205,130,.9)' : 'rgba(180,215,255,.9)'; x.fillRect(px + r() * w, 256 - r() * h, 2, 2); }
  }
  if (night) for (let k = 0; k < 40; k++) { const px = r() * 1024, py = 260 + r() * 40, rg = x.createRadialGradient(px, py, 0, px, py, 14); rg.addColorStop(0, 'rgba(255,190,110,.9)'); rg.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = rg; x.fillRect(px - 14, py - 14, 28, 28); }
  const t = new THREE.CanvasTexture(eq); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
  const pm = new THREE.PMREMGenerator(renderer);
  const out = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
  return out;
}
const ENV = { day: makeEnv(false), night: makeEnv(true) };
scene.environment = ENV.day;

function facade(kind, seed) {
  // one texture = 4 bays wide x 4 floors tall (14 m x 12.8 m): day colour map + night emissive map
  const S = 512, B = 128, r = rng(seed);
  const lit = []; for (let i = 0; i < 16; i++) lit.push(r() < (kind === 'tower' ? 0.55 : 0.4) ? 0.55 + r() * 0.45 : 0);
  const day = canvasTex(S, S, (x) => {
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
      const ox = bx * B, oy = by * B;
      if (kind === 'tower') {
        const g = x.createLinearGradient(ox, oy, ox + B, oy + B); g.addColorStop(0, '#6683a2'); g.addColorStop(1, '#2b3e54');
        x.fillStyle = g; x.fillRect(ox, oy, B, B);
        x.fillStyle = 'rgba(215,225,235,.55)'; x.fillRect(ox, oy, B, 5); x.fillRect(ox, oy, 4, B);
      } else if (kind === 'brick') {
        x.fillStyle = '#a65d40'; x.fillRect(ox, oy, B, B);
        for (let yy = 0; yy < B; yy += 8) for (let xx = (yy / 8 % 2) * 8; xx < B; xx += 16) { const c = 150 + r() * 45; x.fillStyle = `rgb(${c},${c * 0.52 | 0},${c * 0.38 | 0})`; x.fillRect(ox + xx, oy + yy, 15, 7); }
        x.fillStyle = '#5e5248'; x.fillRect(ox + 22, oy + 24, 84, 80);
        const g = x.createLinearGradient(0, oy + 26, 0, oy + 102); g.addColorStop(0, '#a8bdd2'); g.addColorStop(1, '#2c3644');
        x.fillStyle = g; x.fillRect(ox + 26, oy + 28, 76, 72); x.fillStyle = '#e8e0d4'; x.fillRect(ox + 18, oy + 102, 92, 6);
      } else {
        x.fillStyle = '#ece5da'; x.fillRect(ox, oy, B, B);
        const g = x.createLinearGradient(0, oy + 26, 0, oy + 102); g.addColorStop(0, '#9cb3cc'); g.addColorStop(0.5, '#4d6178'); g.addColorStop(1, '#2b3746');
        x.fillStyle = '#6f675c'; x.fillRect(ox + 20, oy + 24, 88, 80);
        x.fillStyle = g; x.fillRect(ox + 23, oy + 27, 82, 74);
        x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(ox + 62, oy + 27, 3, 74);
        x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(ox, oy + 118, B, 10);
      }
    }
    noise(x, S, S, 6000, 0.06, false);
  });
  const night = canvasTex(S, S, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 16; i++) {
      if (!lit[i]) continue;
      const ox = (i % 4) * B, oy = (i / 4 | 0) * B, k = lit[i];
      x.fillStyle = r() < 0.75 ? `rgba(255,${190 + r() * 40 | 0},${110 + r() * 40 | 0},${k})` : `rgba(${170 + r() * 40 | 0},${205 + r() * 30 | 0},255,${k})`;
      if (kind === 'tower') x.fillRect(ox + 5, oy + 6, B - 6, B - 8); else x.fillRect(ox + 24, oy + 28, 80, 72);
    }
  });
  return { day, night };
}
const FAC = { wall: facade('wall', 11), tower: facade('tower', 12), brick: facade('brick', 13) };

/* ---------- Shared materials ---------- */
// The ground is hidden wherever an underpass cut writes stencil value 1.
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0, envMapIntensity: 0.3,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp });
const cutMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp });
const facMat = (f, o) => new THREE.MeshStandardMaterial(Object.assign({ map: f.day, emissiveMap: f.night, emissive: new THREE.Color(0, 0, 0), vertexColors: true }, o));
const wallMat = facMat(FAC.wall, { roughness: 0.75, metalness: 0.0, envMapIntensity: 0.45 });
const towerMat = facMat(FAC.tower, { roughness: 0.12, metalness: 0.65, envMapIntensity: 1.25 });
const brickMat = facMat(FAC.brick, { roughness: 0.85, metalness: 0.0, envMapIntensity: 0.35 });
const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.4 });
const decal = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.3 }, o));
const ROAD_MAT = {}; for (const k in ROAD_TEX) ROAD_MAT[k] = decal({ map: ROAD_TEX[k], roughness: 0.82 });
const DECK_MAT = {}; for (const k in ROAD_TEX) DECK_MAT[k] = new THREE.MeshStandardMaterial({ map: ROAD_TEX[k], vertexColors: true, roughness: 0.82, envMapIntensity: 0.3 });
const walkMat = decal({ map: walkTex, roughness: 0.9, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
const parkMat = decal({ roughness: 1, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
const waterMat = decal({ color: 0xffffff, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.1, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, vertexColors: true, roughness: 0.85, envMapIntensity: 0.35, side: THREE.DoubleSide });
const poleMat = new THREE.MeshStandardMaterial({ color: C(0x3a3d42), metalness: 0.6, roughness: 0.4 });
const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: C(0xffc777), emissiveIntensity: 3 });
const poolTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,196,120,.55)'); g.addColorStop(0.5, 'rgba(255,170,90,.18)'); g.addColorStop(1, 'rgba(255,160,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const trunkMat = new THREE.MeshStandardMaterial({ color: C(0x5a4232), roughness: 1 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), groundMat);
ground.rotation.x = -PI / 2; ground.receiveShadow = true;
scene.add(ground);

/* ---------- Palettes ---------- */
const WALL_COLS = ['#ddd2c2', '#cbb89c', '#b9a58b', '#e6e1d8', '#a9b6c2', '#c9a78b', '#a3aca6', '#d8c4a4', '#bfb3a6'].map(C);
const ROOF_COLS = ['#7e7a74', '#8f867b', '#6f6c68', '#9a9286'].map(C);
const WHITE = new THREE.Color(1, 1, 1);
const GLASS_TINTS = ['#ffffff', '#cfe0ee', '#d8d4c8', '#b9cbd9', '#e0e8e8'].map(C);
const NAMED_COLOURS = { white: '#f0ede6', black: '#3a3a3a', grey: '#9a9a9a', gray: '#9a9a9a', red: '#b5543f', brown: '#8a6a50', beige: '#d8c8a8', yellow: '#e2cc7a', blue: '#7f9fc0', green: '#8fae86', orange: '#d9945a', pink: '#d9a8a8', cream: '#efe6cf', tan: '#c9ad85', silver: '#c0c4c8' };
function parseColour(v) {
  if (!v) return null;
  v = String(v).trim().toLowerCase();
  if (NAMED_COLOURS[v]) return C(NAMED_COLOURS[v]);
  if (/^#[0-9a-f]{6}$/.test(v) || /^#[0-9a-f]{3}$/.test(v)) { const c = C(v); const l = (c.r + c.g + c.b) / 3; if (l < 0.04) c.multiplyScalar(2.5); return c; }
  return null;
}

/* ---------- Geometry builder ---------- */
class GB {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  get empty() { return this.p.length === 0; }
  tri(a, b, c, n, ua, ub, uc, col) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { const t = b; b = c; c = t; const tu = ub; ub = uc; uc = tu; }
    const V = [a, b, c], U = [ua, ub, uc];
    for (let i = 0; i < 3; i++) {
      this.p.push(V[i][0], V[i][1], V[i][2]); this.n.push(n[0], n[1], n[2]);
      this.u.push(U[i][0], U[i][1]); this.c.push(col.r, col.g, col.b);
    }
  }
  quad(a, b, c, d, n, ua, ub, uc, ud, col) { this.tri(a, b, c, n, ua, ub, uc, col); this.tri(a, c, d, n, ua, uc, ud, col); }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
const UP = [0, 1, 0];
function polyArea(pts) { let A = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; A += a[0] * b[1] - b[0] * a[1]; } return A / 2; }
function polyCentroid(pts) { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; }
function addBuilding(wb, rb, pts, y0, y1, col, roofCol) {
  if (polyArea(pts) < 0) pts = pts.slice().reverse();
  let per = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const n = [dz / len, 0, -dx / len];
    const u0 = per / 14, u1 = (per + len) / 14, v0 = y0 / 12.8, v1 = y1 / 12.8;
    wb.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], n, [u0, v0], [u1, v0], [u1, v1], [u0, v1], col);
    per += len;
  }
  fillPoly(rb, pts, y1, roofCol);
}
function fillPoly(gb, pts, y, col) {
  try {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const t of tris) {
      const A = pts[t[0]], B = pts[t[1]], Cc = pts[t[2]];
      gb.tri([A[0], y, A[1]], [B[0], y, B[1]], [Cc[0], y, Cc[1]], UP, [A[0] / 10, A[1] / 10], [B[0] / 10, B[1] / 10], [Cc[0] / 10, Cc[1] / 10], col);
    }
  } catch (e) { /* skip degenerate polygon */ }
}
function addDisc(gb, x, z, r, y, col, uv) {
  const seg = 12, u = uv || [0.25, 0.75];
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * PI * 2, a1 = (i + 1) / seg * PI * 2;
    gb.tri([x, y, z], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], UP, u, u, u, col);
  }
}
function norm2(x, z) { const l = Math.hypot(x, z); return l < 1e-6 ? null : [x / l, z / l]; }
// Offset a polyline sideways; returns per-vertex left/right points with mitre and distance along.
function ribbonFrame(pts, hw) {
  const n = pts.length, L = [], R = [], D = [], corners = [];
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (i > 0) dist += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    let tx, tz, ml = hw;
    const d1 = i > 0 ? norm2(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : null;
    const d2 = i < n - 1 ? norm2(pts[i + 1][0] - p[0], pts[i + 1][1] - p[1]) : null;
    if (d1 && d2) {
      const t = norm2(d1[0] + d2[0], d1[1] + d2[1]) || d1;
      tx = t[0]; tz = t[1];
      const cosHalf = tx * d1[0] + tz * d1[1];
      ml = hw / Math.max(0.45, cosHalf);
      corners.push(cosHalf < 0.9);
    } else { const t = d1 || d2 || [1, 0]; tx = t[0]; tz = t[1]; corners.push(true); }
    const px = tz, pz = -tx;
    L.push([p[0] + px * ml, p[1] + pz * ml]); R.push([p[0] - px * ml, p[1] - pz * ml]); D.push(dist);
  }
  return { L, R, D, corners };
}
// Flat or elevated road ribbon; hs = per-vertex heights (null = ground decal at y0)
function addRibbon(gb, pts, w, hs, y0, col, vScale, discs) {
  if (pts.length < 2) return;
  const f = ribbonFrame(pts, w / 2), H = i => (hs ? hs[i] : 0) + y0;
  for (let i = 0; i < pts.length; i++) if (discs && f.corners[i]) addDisc(gb, pts[i][0], pts[i][1], w / 2, H(i), col);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = f.L[i], b = f.R[i], c = f.R[i + 1], d = f.L[i + 1];
    gb.quad([a[0], H(i), a[1]], [b[0], H(i), b[1]], [c[0], H(i + 1), c[1]], [d[0], H(i + 1), d[1]], UP,
      [0, f.D[i] / vScale], [1, f.D[i] / vScale], [1, f.D[i + 1] / vScale], [0, f.D[i + 1] / vScale], col);
  }
}
// Vertical wall strip along one side of a polyline between y = top(i) and y = bot(i)
function addWallStrip(gb, side, f, top, bot, col, outward) {
  for (let i = 0; i < side.length - 1; i++) {
    const a = side[i], b = side[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
    let n = [dz / len, 0, -dx / len];
    if (outward) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if ((m[0] - outward[i][0]) * n[0] + (m[1] - outward[i][1]) * n[2] < 0) n = [-n[0], 0, -n[2]]; }
    gb.quad([a[0], bot(i), a[1]], [b[0], bot(i + 1), b[1]], [b[0], top(i + 1), b[1]], [a[0], top(i), a[1]], n,
      [f.D[i] / 6, bot(i) / 6], [f.D[i + 1] / 6, bot(i + 1) / 6], [f.D[i + 1] / 6, top(i + 1) / 6], [f.D[i] / 6, top(i) / 6], col);
  }
}

/* ---------- Spatial grid ---------- */
class Grid {
  constructor(cs) { this.cs = cs; this.m = new Map(); this.q = 0; }
  add(item, x0, z0, x1, z1) {
    const cs = this.cs;
    for (let i = Math.floor(x0 / cs); i <= Math.floor(x1 / cs); i++)
      for (let j = Math.floor(z0 / cs); j <= Math.floor(z1 / cs); j++) {
        const k = i + ',' + j; let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(item);
      }
  }
  addSeg(s) { this.add(s, Math.min(s.ax, s.bx), Math.min(s.az, s.bz), Math.max(s.ax, s.bx), Math.max(s.az, s.bz)); }
  query(x, z, r, cb) {
    const cs = this.cs; this.q++;
    for (let i = Math.floor((x - r) / cs); i <= Math.floor((x + r) / cs); i++)
      for (let j = Math.floor((z - r) / cs); j <= Math.floor((z + r) / cs); j++) {
        const a = this.m.get(i + ',' + j); if (!a) continue;
        for (const it of a) { if (it._q === this.q) continue; it._q = this.q; cb(it); }
      }
  }
}
// distance from point to segment; returns [dist, closestX, closestZ, t]
function segDist(px, pz, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - s.ax) * dx + (pz - s.az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  const cx = s.ax + dx * t, cz = s.az + dz * t;
  return [Math.hypot(px - cx, pz - cz), cx, cz, t];
}
function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}

/* ---------- Text labels (sprites) ---------- */
const LABEL_STYLE = {
  landmark: { font: '700 44px Barlow, sans-serif', fg: '#fff6e8', bg: 'rgba(26,18,8,.82)', bar: '#ffb347', h: 3.4 },
  building: { font: '600 38px Barlow, sans-serif', fg: '#f4efe7', bg: 'rgba(16,18,22,.74)', bar: null, h: 2.4 },
  poi: { font: '600 34px Barlow, sans-serif', fg: '#f4efe7', bg: 'rgba(16,18,22,.70)', bar: '#46d98a', h: 1.7 },
  street: { font: '700 34px Barlow, sans-serif', fg: '#ffffff', bg: '#16613a', bar: null, h: 1.25, border: '#e9f2ec' },
};
function makeLabel(text, kind, accent) {
  const st = LABEL_STYLE[kind];
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = st.font;
  const tw = Math.min(900, Math.ceil(x.measureText(text).width));
  const pad = 22, bar = st.bar ? 12 : 0, H = 64;
  c.width = tw + pad * 2 + bar; c.height = H;
  x.font = st.font;
  x.fillStyle = st.bg;
  const r = kind === 'street' ? 8 : 14;
  x.beginPath(); x.moveTo(r, 0); x.lineTo(c.width - r, 0); x.quadraticCurveTo(c.width, 0, c.width, r); x.lineTo(c.width, H - r); x.quadraticCurveTo(c.width, H, c.width - r, H);
  x.lineTo(r, H); x.quadraticCurveTo(0, H, 0, H - r); x.lineTo(0, r); x.quadraticCurveTo(0, 0, r, 0); x.fill();
  if (st.border) { x.strokeStyle = st.border; x.lineWidth = 3; x.stroke(); }
  if (st.bar) { x.fillStyle = accent || st.bar; x.fillRect(10, 14, 6, H - 28); }
  x.fillStyle = st.fg; x.textBaseline = 'middle';
  x.fillText(text, pad + bar, H / 2 + 2, tw);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.userData.base = [st.h * c.width / H, st.h];
  s.scale.set(s.userData.base[0], s.userData.base[1], 1);
  s.center.set(0.5, 0);
  s.userData.kind = kind;
  return s;
}
function disposeObject(o) {
  o.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    if (c.isSprite && c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); }
  });
}
