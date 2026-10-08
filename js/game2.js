/* ======================= World sources ======================= */
function generatedCity(seed) {
  const r = rng(seed || 7), S = 72, N = 5, E = S * N + 36;
  const roads = [], buildings = [], trees = [], parks = [], nodes = [];
  for (let i = -N; i <= N; i++) {
    roads.push({ pts: [[i * S, -E], [i * S, E]], w: i === 0 ? 16 : 12 });
    roads.push({ pts: [[-E, i * S], [E, i * S]], w: i === 0 ? 16 : 12 });
  }
  roads.push({ pts: [[-E, E], [E, -E]], w: 16 });
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) { nodes.push([i * S, j * S]); if (i < N) nodes.push([i * S + S / 2, j * S]); }
  const nearDiag = (x, z, m) => Math.abs(x + z) / Math.SQRT2 < m;
  for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
    const x0 = i * S + 10, z0 = j * S + 10, x1 = i * S + S - 10, z1 = j * S + S - 10;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // sidewalk trees
    for (let t = 6; t < S - 6; t += 14) {
      const a = i * S + t;
      for (const [tx, tz] of [[a, j * S + 8.5], [a, j * S + S - 8.5], [i * S + 8.5, j * S + t], [i * S + S - 8.5, j * S + t]])
        if (!nearDiag(tx, tz, 11) && r() < 0.8) trees.push([tx, tz, 0.8 + r() * 0.5]);
    }
    if (r() < 0.12 && !nearDiag(cx, cz, 50)) {
      parks.push([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
      for (let k = 0; k < 22; k++) trees.push([x0 + 3 + r() * (x1 - x0 - 6), z0 + 3 + r() * (z1 - z0 - 6), 0.9 + r() * 0.8]);
      continue;
    }
    const sx = x0 + (x1 - x0) * (0.35 + r() * 0.3), sz = z0 + (z1 - z0) * (0.35 + r() * 0.3);
    const lots = r() < 0.25 ? [[x0, z0, x1, z1]] : [[x0, z0, sx, sz], [sx, z0, x1, sz], [x0, sz, sx, z1], [sx, sz, x1, z1]];
    for (const [a0, b0, a1, b1] of lots) {
      const lx0 = a0 + 1.5, lz0 = b0 + 1.5, lx1 = a1 - 1.5, lz1 = b1 - 1.5;
      const lcx = (lx0 + lx1) / 2, lcz = (lz0 + lz1) / 2;
      if (nearDiag(lcx, lcz, 12 + Math.hypot(lx1 - lx0, lz1 - lz0) / 2)) continue;
      const d = Math.hypot(lcx, lcz), hmax = 14 + 120 * Math.exp(-d / 190);
      const h = 9 + r() * (hmax - 9);
      const col = WALL_COLS[(r() * WALL_COLS.length) | 0], rc = ROOF_COLS[(r() * ROOF_COLS.length) | 0], style = r();
      if (h > 42) {
        buildings.push({ pts: [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]], h: 11, col, rc, style: 0.9 });
        const ins = Math.min(4, (lx1 - lx0) / 4, (lz1 - lz0) / 4);
        buildings.push({ pts: [[lx0 + ins, lz0 + ins], [lx1 - ins, lz0 + ins], [lx1 - ins, lz1 - ins], [lx0 + ins, lz1 - ins]], y0: 11, h, col: WALL_COLS[(r() * WALL_COLS.length) | 0], rc, style });
      } else buildings.push({ pts: [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]], h, col, rc, style });
    }
  }
  return { name: 'Generated city', roads, buildings, trees, parks, nodes, radius: E - 10, spawn: { x: 0, z: 30, th: PI } };
}

const ROAD_W = { motorway: 16, trunk: 14, primary: 12, secondary: 10.5, tertiary: 9, unclassified: 7.5, residential: 7, living_street: 6, service: 5, pedestrian: 6,
  motorway_link: 8, trunk_link: 8, primary_link: 8, secondary_link: 7.5, tertiary_link: 7 };
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const FETCH_R = 600;
async function fetchOSM(lat, lon) {
  const dLat = FETCH_R / 110540, dLon = FETCH_R / (111320 * Math.cos(lat * PI / 180));
  const bb = `${(lat - dLat).toFixed(6)},${(lon - dLon).toFixed(6)},${(lat + dLat).toFixed(6)},${(lon + dLon).toFixed(6)}`;
  const q = `[out:json][timeout:25];(way["highway"](${bb});way["building"](${bb}););out geom;`;
  let last;
  for (const ep of OVERPASS) {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 35000);
    try {
      const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      clearTimeout(tm);
      if (!res.ok) throw new Error('Map server answered ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(tm); last = e; }
  }
  throw last;
}
async function geocode(q) {
  const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q));
  if (!res.ok) throw new Error('Search server answered ' + res.status);
  const j = await res.json();
  if (!j.length) return null;
  return { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name.split(',').slice(0, 2).join(',') };
}
function worldFromOSM(data, lat, lon, name) {
  const kx = 111320 * Math.cos(lat * PI / 180), kz = 110540;
  const P = g => [(g.lon - lon) * kx, -(g.lat - lat) * kz];
  const roads = [], buildings = [], parks = [];
  for (const el of data.elements || []) {
    if (el.type !== 'way' || !el.geometry) continue;
    const t = el.tags || {};
    if (t.building && t.building !== 'roof' && buildings.length < 7000) {
      const pts = el.geometry.map(P);
      const f = pts[0], l = pts[pts.length - 1];
      if (pts.length > 1 && Math.abs(f[0] - l[0]) < 0.01 && Math.abs(f[1] - l[1]) < 0.01) pts.pop();
      if (pts.length < 3 || Math.abs(polyArea(pts)) < 6) continue;
      const r = rng(el.id % 2147483647);
      let h = parseFloat(t.height) || (parseFloat(t['building:levels']) * 3.3 + 1.5) || (6 + r() * 11);
      h = clamp(h, 3, 420);
      buildings.push({ pts, h, col: WALL_COLS[(r() * WALL_COLS.length) | 0], rc: ROOF_COLS[(r() * ROOF_COLS.length) | 0], style: r() });
    } else if (t.highway && ROAD_W[t.highway] && t.tunnel !== 'yes' && t.area !== 'yes') {
      let w = ROAD_W[t.highway];
      const lanes = parseInt(t.lanes, 10); if (lanes > 0) w = Math.max(w, Math.min(lanes * 3.4, 24));
      roads.push({ pts: el.geometry.map(P), w });
    }
  }
  roads.sort((a, b) => a.w - b.w);
  const nodes = [];
  let spawn = { x: 0, z: 0, th: 0 }, best = 1e9;
  for (const rd of roads) {
    if (rd.w < 6) continue;
    rd.pts.forEach((p, i) => {
      if (Math.hypot(p[0], p[1]) < FETCH_R - 60) nodes.push(p);
      const d = Math.hypot(p[0], p[1]) - rd.w * 3;
      if (d < best && rd.pts.length > 1) {
        best = d; const q = rd.pts[i + 1] || rd.pts[i - 1];
        const dx = (rd.pts[i + 1] ? 1 : -1) * (q[0] - p[0]), dz = (rd.pts[i + 1] ? 1 : -1) * (q[1] - p[1]);
        spawn = { x: p[0], z: p[1], th: Math.atan2(dx, dz) };
      }
    });
  }
  return { name, roads, buildings, trees: null, parks, nodes, radius: FETCH_R + 40, spawn, osm: true };
}

/* ======================= World build ======================= */
let worldGroup = null, grid = null, roadGrid = null, WORLD = null, nightGroup = null, night = false;
function disposeWorld() {
  if (!worldGroup) return;
  scene.remove(worldGroup);
  worldGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  worldGroup = null;
}
function buildWorld(W) {
  disposeWorld();
  worldGroup = new THREE.Group();
  grid = new Grid(16); roadGrid = new Grid(24);
  const bGrid = new Grid(24);
  const wb = new GB(), tb = new GB(), bb = new GB(), rb = new GB(), roadB = new GB(), parkB = new GB();
  for (const b of W.buildings) {
    const style = b.h > 34 ? tb : (b.h < 16 && (b.style || 0) < 0.4 ? bb : wb);
    const col = style === tb ? GLASS_TINTS[(b.style * 10 | 0) % GLASS_TINTS.length] : style === bb ? WHITE : b.col;
    addBuilding(style, rb, b.pts, b.y0 || 0, b.h, col, b.rc);
    if (!b.y0) {
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (let i = 0; i < b.pts.length; i++) {
        const a = b.pts[i], c = b.pts[(i + 1) % b.pts.length];
        grid.add({ ax: a[0], az: a[1], bx: c[0], bz: c[1] }, Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1]));
        x0 = Math.min(x0, a[0]); z0 = Math.min(z0, a[1]); x1 = Math.max(x1, a[0]); z1 = Math.max(z1, a[1]);
      }
      bGrid.add({ pts: b.pts }, x0, z0, x1, z1);
    }
  }
  for (const rd of W.roads) {
    addRoad(roadB, rd.pts, rd.w, WHITE);
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const a = rd.pts[i], c = rd.pts[i + 1];
      roadGrid.add({ ax: a[0], az: a[1], bx: c[0], bz: c[1], hw: rd.w / 2 }, Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1]));
    }
  }
  const grass = C(0x5f7d3c);
  for (const p of W.parks) {
    try { for (const t of THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), [])) parkB.tri([p[t[0]][0], 0.02, p[t[0]][1]], [p[t[1]][0], 0.02, p[t[1]][1]], [p[t[2]][0], 0.02, p[t[2]][1]], UP, [0, 0], [0, 0], [0, 0], grass); } catch (e) {}
  }
  const walls = wb.mesh(wallMat), towers = tb.mesh(towerMat), bricks = bb.mesh(brickMat), roofs = rb.mesh(roofMat), roadsM = roadB.mesh(roadMat), parksM = parkB.mesh(parkMat);
  for (const m of [walls, towers, bricks]) { m.castShadow = m.receiveShadow = true; worldGroup.add(m); } roofs.castShadow = roofs.receiveShadow = true;
  roadsM.receiveShadow = true; roadsM.renderOrder = 2; parksM.receiveShadow = true; parksM.renderOrder = 1;
  worldGroup.add(walls, roofs, roadsM, parksM);

  // trees
  let trees = W.trees;
  const blocked = (x, z, pad) => {
    let bad = false;
    roadGrid.query(x, z, 14, s => { if (!bad && segDist(x, z, s)[0] < s.hw + pad) bad = true; });
    if (!bad) grid.query(x, z, 4, s => { if (!bad && segDist(x, z, s)[0] < 3) bad = true; });
    if (!bad) bGrid.query(x, z, 1, b => { if (!bad && pointInPoly(x, z, b.pts)) bad = true; });
    return bad;
  };
  if (!trees) {
    trees = []; const r = rng(99);
    for (const rd of W.roads) {
      if (rd.w < 6.5 || rd.w > 11 || trees.length > 1400) continue;
      for (let i = 0; i < rd.pts.length - 1; i++) {
        const a = rd.pts[i], c = rd.pts[i + 1], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const dx = (c[0] - a[0]) / len, dz = (c[1] - a[1]) / len;
        for (let s = 8; s < len - 4; s += 20) for (const side of [-1, 1]) {
          const off = rd.w / 2 + 2.8;
          const x = a[0] + dx * s + dz * off * side, z = a[1] + dz * s - dx * off * side;
          if (r() < 0.75 && Math.hypot(x, z) < W.radius && !blocked(x, z, 1.2)) trees.push([x, z, 0.8 + r() * 0.5]);
        }
      }
    }
  }
  if (trees.length) {
    const n = trees.length, r = rng(5);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6).translate(0, 1.2, 0), trunkMat, n);
    const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 3.6, 0), leafMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3();
    const greens = ['#4f7a35', '#5f8a3a', '#6b8f3d', '#3f6a33', '#7a9445'].map(C);
    trees.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * PI * 2);
      s.set(t[2], t[2] * (0.9 + r() * 0.35), t[2]); pv.set(t[0], 0, t[1]);
      m.compose(pv, q, s); trunk.setMatrixAt(i, m); leaf.setMatrixAt(i, m);
      leaf.setColorAt(i, greens[(r() * greens.length) | 0]);
      grid.add({ x: t[0], z: t[1], r: 0.35 * t[2] }, t[0] - 1, t[1] - 1, t[0] + 1, t[1] + 1);
    });
    trunk.castShadow = leaf.castShadow = true; leaf.receiveShadow = true;
    worldGroup.add(trunk, leaf);
  }
  // streetlights: poles always, lamp glow + light pools at night
  const lamps = []; const lr = rng(42);
  for (const rd of W.roads) {
    if (rd.w < 7 || lamps.length > 900) continue;
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const a = rd.pts[i], c = rd.pts[i + 1], len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 6) continue;
      const dx = (c[0] - a[0]) / len, dz = (c[1] - a[1]) / len;
      for (let st = 10 + lr() * 8, k = 0; st < len - 5; st += 34, k++) {
        const side = k % 2 ? 1 : -1, off = rd.w / 2 + 1.2;
        const x = a[0] + dx * st + dz * off * side, z = a[1] + dz * st - dx * off * side;
        if (Math.hypot(x, z) < W.radius && !blocked(x, z, 0.4)) lamps.push([x, z, -dz * side, dx * side]);
      }
    }
  }
  nightGroup = new THREE.Group(); nightGroup.visible = night;
  if (lamps.length) {
    const n = lamps.length, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 7.5, 6).translate(0, 3.75, 0), poleMat, n);
    const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(0, 7.4, 0.8), poleMat, n);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.12, 0.6).translate(0, 7.32, 1.5), lampMat, n);
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-PI / 2).translate(0, 0.06, 1.8), poolMat, n);
    lamps.forEach((L, i) => {
      q.setFromAxisAngle(Y, Math.atan2(L[2], L[3])); pv.set(L[0], 0, L[1]); m4.compose(pv, q, one);
      pole.setMatrixAt(i, m4); arm.setMatrixAt(i, m4); head.setMatrixAt(i, m4); pool.setMatrixAt(i, m4);
      grid.add({ x: L[0], z: L[1], r: 0.15 }, L[0] - 1, L[1] - 1, L[0] + 1, L[1] + 1);
    });
    pole.castShadow = true; pool.renderOrder = 3;
    worldGroup.add(pole, arm); nightGroup.add(head, pool);
  }
  worldGroup.add(nightGroup);
  scene.add(worldGroup);
  WORLD = W;
  prerenderMap(W);
}

/* ======================= Car ======================= */
const car = { x: 0, z: 0, vx: 0, vz: 0, th: 0, yaw: 0, steer: 0, vF: 0, vL: 0, aLong: 0, aLat: 0, grip: 1, hand: 0, throttle: 0, brake: 0 };
const paintMat = new THREE.MeshPhysicalMaterial({ color: C(PAINTS[0]), metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
const trimMat = new THREE.MeshStandardMaterial({ color: C(0x14161a), metalness: 0.3, roughness: 0.5 });
const glassMat = new THREE.MeshPhysicalMaterial({ color: C(0x0c1218), metalness: 0.2, roughness: 0.03, clearcoat: 1, envMapIntensity: 1.8 });
const tireMat = new THREE.MeshStandardMaterial({ color: C(0x18191b), roughness: 0.92 });
const rimMat = new THREE.MeshStandardMaterial({ color: C(0xb7bcc2), metalness: 0.95, roughness: 0.22 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: C(0xfff1d2), emissiveIntensity: 2.2 });
const tailMat = new THREE.MeshStandardMaterial({ color: C(0x400000), emissive: C(0xff1a12), emissiveIntensity: 0.7 });

const carRoot = new THREE.Group(), carBody = new THREE.Group();
carRoot.add(carBody); scene.add(carRoot);
const wheels = [];
(function buildCar() {
  const shadowed = m => { m.castShadow = true; m.receiveShadow = true; return m; };
  const sh = new THREE.Shape();
  sh.moveTo(-2.18, 0.36); sh.lineTo(2.12, 0.36);
  sh.quadraticCurveTo(2.34, 0.38, 2.32, 0.58); sh.quadraticCurveTo(2.29, 0.79, 1.95, 0.85);
  sh.lineTo(1.05, 0.97); sh.lineTo(-1.6, 1.01);
  sh.quadraticCurveTo(-2.24, 1.0, -2.26, 0.79); sh.lineTo(-2.26, 0.5); sh.quadraticCurveTo(-2.26, 0.36, -2.18, 0.36);
  const bodyGeo = new THREE.ExtrudeGeometry(sh, { depth: 1.56, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 4, curveSegments: 10 });
  bodyGeo.translate(0, 0, -0.78); bodyGeo.rotateY(-PI / 2);
  carBody.add(shadowed(new THREE.Mesh(bodyGeo, paintMat)));

  const gh = new THREE.Shape();
  gh.moveTo(1.14, 0.95); gh.quadraticCurveTo(0.62, 1.29, 0.2, 1.36); gh.lineTo(-0.72, 1.37);
  gh.quadraticCurveTo(-1.38, 1.3, -1.78, 0.98); gh.lineTo(1.14, 0.95);
  const ghGeo = new THREE.ExtrudeGeometry(gh, { depth: 1.24, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 10 });
  ghGeo.translate(0, 0, -0.62); ghGeo.rotateY(-PI / 2);
  carBody.add(shadowed(new THREE.Mesh(ghGeo, glassMat)));
  const roof = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 1.02), paintMat)); roof.position.set(0, 1.42, -0.25); carBody.add(roof);

  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); carBody.add(m); return m; };
  box(1.5, 0.06, 0.35, trimMat, 0, 0.31, 2.2);          // front splitter
  box(1.1, 0.16, 0.06, trimMat, 0, 0.52, 2.38);         // grille
  for (const s of [-1, 1]) {
    box(0.4, 0.09, 0.08, headMat, s * 0.58, 0.7, 2.3);   // headlights
    box(0.42, 0.1, 0.06, tailMat, s * 0.56, 0.82, -2.33); // taillights
    box(0.06, 0.25, 0.06, trimMat, s * 0.55, 1.19, -1.95); // spoiler posts
    const mir = box(0.2, 0.1, 0.12, paintMat, s * 0.98, 1.0, 0.85); mir.castShadow = true;
  }
  shadowed(box(1.62, 0.05, 0.34, trimMat, 0, 1.32, -2.0)); // wing
  box(1.5, 0.14, 0.12, trimMat, 0, 0.36, -2.32);          // diffuser

  const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 28).rotateZ(PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.31, 24).rotateZ(PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.04, 0.22, 0.07).translate(0, 0.11, 0);
  for (const [x, z, front] of [[-0.86, 1.38, 1], [0.86, 1.38, 1], [-0.86, -1.32, 0], [0.86, -1.32, 0]]) {
    const w = new THREE.Group(), spin = new THREE.Group();
    w.position.set(x, 0.36, z); w.add(spin);
    spin.add(shadowed(new THREE.Mesh(tireGeo, tireMat)), new THREE.Mesh(rimGeo, rimMat));
    for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(spokeGeo, rimMat); sp.position.x = Math.sign(x) * 0.15; sp.rotation.x = k * PI / 3; spin.add(sp); }
    carRoot.add(w); wheels.push({ g: w, spin, front, side: Math.sign(x), z });
  }
})();

let modelWheels = null;
const headL = [];
for (const sx of [-0.6, 0.6]) {
  const sp = new THREE.SpotLight(C(0xfff0d8), 0, 85, 0.42, 0.55, 1.2);
  sp.position.set(sx, 0.7, 2.1); sp.target.position.set(sx * 1.6, 0, 22);
  carRoot.add(sp, sp.target); headL.push(sp);
}
const carProc = carBody.children.slice();
function loadCarModel() {
  if (!THREE.GLTFLoader) return;
  const onCar = gltf => {
    const m = gltf.scene; m.rotation.y = PI; // model faces -z
    const wl = [];
    m.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false;
        const n = o.material && o.material.name;
        if (n === 'Body_Color') o.material = paintMat;
        else if (n === 'Glass_Gray') o.material = carGlass;
        else if (n === 'metal_chrome') { o.material.metalness = 1; o.material.roughness = 0.12; }
        else if (n === 'Taillight_Glass') { o.material = tailMat; }
        if (o.material) o.material.envMapIntensity = o.material === paintMat ? 1.3 : 1.0;
      }
      if (/^wheel_(fl|fr|rl|rr)$/.test(o.name)) { o.rotation.order = 'YXZ'; wl.push({ node: o, front: o.name[6] === 'f' }); }
    });
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4), new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(AO_URL), blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, depthWrite: false }));
    ao.rotation.x = -PI / 2; ao.position.y = 0.02; ao.renderOrder = 4; m.add(ao);
    carProc.forEach(c => { c.visible = false; }); wheels.forEach(w => { w.g.visible = false; });
    carBody.add(m); modelWheels = wl;
  };
  fetch('car.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j => {
    const bin = atob(j.glb), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', onCar, () => {});
  }).catch(() => loadCarFromCDN(onCar));
}
function loadCarFromCDN(onCar) {
  // hosted build: original compressed model from the three.js repo via jsDelivr
  const base = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/';
  const add = src => new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
  (THREE.DRACOLoader ? Promise.resolve() : add(base + 'js/loaders/DRACOLoader.js')).then(() => {
    const draco = new THREE.DRACOLoader(); draco.setDecoderPath(base + 'js/libs/draco/gltf/');
    const loader = new THREE.GLTFLoader(); loader.setDRACOLoader(draco);
    AO_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/ferrari_ao.png';
    loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/ferrari.glb', onCar, undefined, () => {});
  }).catch(() => {});
}
let AO_URL = 'car_ao.png';
const carGlass = new THREE.MeshPhysicalMaterial({ color: C(0x0d1218), metalness: 0.3, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.88, envMapIntensity: 1.8 });

