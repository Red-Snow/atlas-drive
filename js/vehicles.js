// Atlas Drive: vehicle models (procedural fleet + detailed supercar) with cockpit interiors
// Profiles are side silhouettes: x along the car (+ = front), y up. Built once per type, shared by all instances.
const VSPEC = {
  sedan: { label: 'Sedan', len: 4.7, w: 1.82, r: 0.33, wf: 1.45, wr: -1.42,
    body: [[-2.30, 0.32], [2.22, 0.32], [2.36, 0.50], [2.30, 0.72], [1.30, 0.86], [-1.75, 0.92], [-2.32, 0.86], [-2.36, 0.55]],
    cabin: [[1.22, 0.86], [0.35, 1.40], [-0.90, 1.42], [-1.72, 0.92]], roof: [-0.86, 0.30, 1.43], eye: 1.16, seatZ: -0.35, dashZ: 0.62,
    phys: { power: 300, acc: 7.6, grip: 9.6, brake: 19 } },
  hatch: { label: 'Hatchback', len: 4.1, w: 1.76, r: 0.31, wf: 1.28, wr: -1.30,
    body: [[-1.98, 0.32], [1.92, 0.32], [2.05, 0.50], [2.00, 0.72], [1.10, 0.88], [-1.85, 0.95], [-2.04, 0.90], [-2.06, 0.50]],
    cabin: [[1.02, 0.88], [0.25, 1.45], [-1.52, 1.47], [-1.94, 0.95]], roof: [-1.48, 0.20, 1.48], eye: 1.2, seatZ: -0.45, dashZ: 0.45,
    phys: { power: 220, acc: 7.8, grip: 9.8, brake: 19 } },
  suv: { label: 'SUV', len: 4.8, w: 1.95, r: 0.40, wf: 1.50, wr: -1.45,
    body: [[-2.36, 0.42], [2.30, 0.42], [2.42, 0.62], [2.38, 0.98], [1.45, 1.08], [-2.30, 1.12], [-2.40, 1.00], [-2.42, 0.60]],
    cabin: [[1.36, 1.08], [0.62, 1.72], [-2.08, 1.76], [-2.30, 1.12]], roof: [-2.02, 0.52, 1.77], eye: 1.55, seatZ: -0.35, dashZ: 0.75,
    phys: { power: 300, acc: 6.6, grip: 8.6, brake: 17 } },
  pickup: { label: 'Pickup', len: 5.3, w: 1.95, r: 0.40, wf: 1.66, wr: -1.62,
    body: [[-2.62, 0.42], [2.55, 0.42], [2.66, 0.65], [2.62, 1.02], [1.60, 1.10], [-2.60, 1.12], [-2.66, 0.60]],
    cabin: [[1.50, 1.10], [0.85, 1.78], [-0.50, 1.80], [-0.62, 1.10]], roof: [-0.48, 0.78, 1.81], eye: 1.55, seatZ: 0.05, dashZ: 1.05,
    phys: { power: 280, acc: 6.2, grip: 8.2, brake: 16 } },
  van: { label: 'Van', len: 5.2, w: 2.0, r: 0.36, wf: 1.75, wr: -1.65,
    body: [[-2.58, 0.38], [2.50, 0.38], [2.62, 0.60], [2.60, 1.00], [1.90, 1.15], [1.20, 2.25], [-2.55, 2.30], [-2.62, 2.20]],
    cabin: [[1.95, 1.16], [1.27, 2.17], [1.20, 2.15], [1.86, 1.14]], roof: null, windows: [-2.3, 0.85, 1.35, 1.95], eye: 1.75, seatZ: 0.55, dashZ: 1.35,
    phys: { power: 210, acc: 5.4, grip: 7.6, brake: 15 } },
  bus: { label: 'Bus', len: 11.0, w: 2.5, r: 0.5, wf: 3.9, wr: -3.1, box: [0.35, 3.1], windows: [-5.0, 4.9, 1.45, 2.55], front: 5.5, eye: 2.4, traffic: true },
  truck: { label: 'Truck', len: 8.0, w: 2.45, r: 0.5, wf: 2.9, wr: -2.5, truck: true, eye: 2.4, traffic: true },
};
VSPEC.taxi = Object.assign({}, VSPEC.sedan, { label: 'Taxi', taxi: true });
const PLAYER_TYPES = ['super', 'sedan', 'hatch', 'suv', 'pickup', 'van'];
const TRAFFIC_MIX = [['sedan', 30], ['hatch', 20], ['suv', 18], ['taxi', 8], ['van', 8], ['pickup', 6], ['bus', 5], ['truck', 5]];
const TRAFFIC_COLORS = ['#e9e7e2', '#1d1f22', '#8c9196', '#b8bcc0', '#7d1a1a', '#1f3f75', '#2f4f3a', '#c6b48c', '#9a3d1c', '#e2e2dc', '#3b3f45', '#d0d2d4'];

const vehMat = {
  glass: new THREE.MeshPhysicalMaterial({ color: C(0x0d1218), metalness: 0.25, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.86, envMapIntensity: 1.7 }),
  trim: new THREE.MeshStandardMaterial({ color: C(0x16181b), metalness: 0.3, roughness: 0.55 }),
  tire: new THREE.MeshStandardMaterial({ color: C(0x18191b), roughness: 0.92 }),
  rim: new THREE.MeshStandardMaterial({ color: C(0xb7bcc2), metalness: 0.95, roughness: 0.22 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: C(0xfff1d2), emissiveIntensity: 1.4 }),
  tail: new THREE.MeshStandardMaterial({ color: C(0x400000), emissive: C(0xff1a12), emissiveIntensity: 0.8 }),
  interior: new THREE.MeshStandardMaterial({ color: C(0x232528), roughness: 0.8 }),
  seat: new THREE.MeshStandardMaterial({ color: C(0x3a2f2a), roughness: 0.7 }),
  cargo: new THREE.MeshStandardMaterial({ color: C(0xe6e6e2), roughness: 0.6, metalness: 0.1 }),
  taxiSign: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: C(0xffd23a), emissiveIntensity: 0.6 }),
};
const paintCache = new Map();
function paintFor(hex, player) {
  const k = hex + (player ? 'p' : '');
  if (!paintCache.has(k)) paintCache.set(k, player
    ? new THREE.MeshPhysicalMaterial({ color: C(hex), metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 })
    : new THREE.MeshStandardMaterial({ color: C(hex), metalness: 0.5, roughness: 0.32, envMapIntensity: 1.1 }));
  return paintCache.get(k);
}
const geoCache = {};
function extrudeSide(points, depth, bevel) {
  const sh = new THREE.Shape(); sh.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) sh.lineTo(points[i][0], points[i][1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2); g.rotateY(-PI / 2); return g;
}
const wheelGeoCache = {};
function wheelGeos(r) {
  if (!wheelGeoCache[r]) wheelGeoCache[r] = {
    tire: new THREE.CylinderGeometry(r, r, r * 0.8, 20).rotateZ(PI / 2),
    rim: new THREE.CylinderGeometry(r * 0.68, r * 0.68, r * 0.82, 14).rotateZ(PI / 2),
  };
  return wheelGeoCache[r];
}
function typeGeo(type) {
  if (geoCache[type]) return geoCache[type];
  const s = VSPEC[type], out = {};
  if (s.body) {
    out.body = extrudeSide(s.body, s.w - 0.16, 0.08);
    out.cabin = extrudeSide(s.cabin, s.w - 0.34, 0.05);
    if (s.roof) out.roof = new THREE.BoxGeometry(s.w - 0.42, 0.05, s.roof[1] - s.roof[0]).translate(0, s.roof[2] + 0.02, (s.roof[0] + s.roof[1]) / 2);
    if (s.windows) out.win = new THREE.BoxGeometry(s.w + 0.02, s.windows[3] - s.windows[2], s.windows[1] - s.windows[0]).translate(0, (s.windows[2] + s.windows[3]) / 2, (s.windows[0] + s.windows[1]) / 2);
  } else if (s.box) {
    out.body = new THREE.BoxGeometry(s.w, s.box[1] - s.box[0], s.len).translate(0, (s.box[0] + s.box[1]) / 2, 0);
    out.win = new THREE.BoxGeometry(s.w + 0.03, s.windows[3] - s.windows[2], s.windows[1] - s.windows[0]).translate(0, (s.windows[2] + s.windows[3]) / 2, (s.windows[0] + s.windows[1]) / 2);
    out.screen = new THREE.BoxGeometry(s.w - 0.2, 1.5, 0.06).translate(0, 2.0, s.len / 2 + 0.01);
  } else if (s.truck) {
    out.body = new THREE.BoxGeometry(s.w, 2.4, 1.9).translate(0, 1.7, 3.0); // cab
    out.cargo = new THREE.BoxGeometry(s.w + 0.05, 2.9, 5.7).translate(0, 1.95, -1.15);
    out.screen = new THREE.BoxGeometry(s.w - 0.25, 1.0, 0.06).translate(0, 2.2, 3.96);
    out.chassis = new THREE.BoxGeometry(s.w - 0.4, 0.35, s.len - 0.4).translate(0, 0.55, 0);
  }
  out.head = new THREE.BoxGeometry(0.36, 0.1, 0.06); out.tail = new THREE.BoxGeometry(0.38, 0.12, 0.05);
  out.blob = new THREE.PlaneGeometry(s.w * 1.25, s.len * 1.15).rotateX(-PI / 2).translate(0, 0.03, 0);
  return (geoCache[type] = out);
}
// Build a vehicle. Returns { root, body, wheels, steer, seat, spec, lights }
function makeVehicle(type, hex, opts = {}) {
  const s = VSPEC[type], gg = typeGeo(type), paint = paintFor(hex, opts.player);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mesh = (geo, mat, shadow) => { const m = new THREE.Mesh(geo, mat); m.castShadow = !!shadow; body.add(m); return m; };
  const sh = !!opts.player;
  mesh(gg.body, paint, sh);
  if (gg.cabin) mesh(gg.cabin, vehMat.glass, false);
  if (gg.roof) mesh(gg.roof, paint, sh);
  if (gg.win) mesh(gg.win, vehMat.glass, false);
  if (gg.screen) mesh(gg.screen, vehMat.glass, false);
  if (gg.cargo) mesh(gg.cargo, vehMat.cargo, sh);
  if (gg.chassis) mesh(gg.chassis, vehMat.trim, false);
  const fz = s.len / 2, lights = { head: opts.player ? vehMat.head.clone() : vehMat.head, tail: opts.player ? vehMat.tail.clone() : vehMat.tail };
  const hy = s.box ? 0.75 : s.truck ? 0.9 : (s.body[2][1] + s.body[3][1]) / 2, ty = s.box ? 0.8 : s.truck ? 0.8 : s.body[s.body.length - 2][1] - 0.1;
  for (const side of [-1, 1]) {
    const h = mesh(gg.head, lights.head); h.position.set(side * (s.w / 2 - 0.3), hy, (s.truck ? 3.97 : fz) + 0.01);
    const t = mesh(gg.tail, lights.tail); t.position.set(side * (s.w / 2 - 0.28), ty, -fz - 0.01);
  }
  if (s.taxi) { const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.22), vehMat.taxiSign); sign.position.set(0, s.roof[2] + 0.12, (s.roof[0] + s.roof[1]) / 2); body.add(sign); }
  // wheels
  const wg = wheelGeos(s.r), wheels = [];
  const axles = s.truck ? [s.wf, s.wr, s.wr - 1.3] : [s.wf, s.wr];
  for (const z of axles) for (const side of [-1, 1]) {
    const g = new THREE.Group(), spin = new THREE.Group(); g.position.set(side * (s.w / 2 - s.r * 0.35), s.r, z); g.add(spin);
    const t = new THREE.Mesh(wg.tire, vehMat.tire); t.castShadow = sh; spin.add(t, new THREE.Mesh(wg.rim, vehMat.rim));
    root.add(g); wheels.push({ g, spin, front: z === s.wf });
  }
  const blob = new THREE.Mesh(gg.blob, blobMat); blob.renderOrder = 3; root.add(blob);
  // cockpit interior (player only)
  let steer = null, seat = null;
  if (opts.player && s.body) {
    const sideX = opts.rhd ? -0.38 : 0.38, belt = s.body[4][1];
    const dash = new THREE.Mesh(new THREE.BoxGeometry(s.w - 0.32, 0.14, 0.55), vehMat.interior); dash.position.set(0, belt - 0.02, s.dashZ); body.add(dash);
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 2.0), vehMat.interior); door.position.set(sx * (s.w / 2 - 0.16), belt - 0.12, s.seatZ + 0.2); body.add(door);
      const seatM = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.15), vehMat.seat); seatM.position.set(sx * 0.38, s.eye - 0.55, s.seatZ - 0.35); seatM.rotation.x = -0.15; body.add(seatM);
    }
    if (s.roof) { const liner = new THREE.Mesh(new THREE.BoxGeometry(s.w - 0.46, 0.03, s.roof[1] - s.roof[0] - 0.1), vehMat.interior); liner.position.set(0, s.roof[2] - 0.03, (s.roof[0] + s.roof[1]) / 2); body.add(liner); }
    const col = new THREE.Group(); col.position.set(sideX, s.eye - 0.36, s.seatZ + 0.5); col.rotation.x = -0.45; body.add(col);
    steer = new THREE.Group(); col.add(steer);
    steer.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 28), vehMat.trim));
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.02), vehMat.trim); steer.add(spoke);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12).rotateX(PI / 2), vehMat.trim); steer.add(hub);
    // A-pillars and rear-view mirror frame the windscreen from the driver's seat
    const cf = s.cabin[0], ct = s.cabin[1], plen = Math.hypot(ct[0] - cf[0], ct[1] - cf[1]);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, plen, 0.1), vehMat.interior);
      p.position.set(sx * (s.w / 2 - 0.24), (cf[1] + ct[1]) / 2, (cf[0] + ct[0]) / 2); p.rotation.x = Math.atan2(ct[0] - cf[0], ct[1] - cf[1]); body.add(p);
    }
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.03), vehMat.trim); mir.position.set(0, ct[1] - 0.1, ct[0] - 0.15); body.add(mir);
    seat = [sideX, s.eye, s.seatZ];
  }
  return { root, body, wheels, steer, seat, spec: s, type, lights, paint };
}
function pickTrafficType(r) {
  const tot = TRAFFIC_MIX.reduce((a, b) => a + b[1], 0); let x = r() * tot;
  for (const [t, w] of TRAFFIC_MIX) { if ((x -= w) < 0) return t; }
  return 'sedan';
}

/* ---------- Detailed supercar (glTF) ---------- */
const HERO = { model: null, loading: false, wheels: [], steer: null, steerQ0: null, seat: [0.36, 1.08, -0.32] };
function loadHeroModel(onReady) {
  if (HERO.model) { onReady && onReady(); return; }
  if (HERO.loading || !THREE.GLTFLoader) return;
  HERO.loading = true;
  const done = gltf => {
    const m = gltf.scene; m.rotation.y = PI;
    m.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false;
        const n = o.material && o.material.name;
        if (n === 'Body_Color') o.material = HERO_PAINT;
        else if (n === 'Glass_Gray') o.material = vehMat.glass;
        else if (n === 'metal_chrome') { o.material.metalness = 1; o.material.roughness = 0.12; }
        else if (n === 'Taillight_Glass') o.material = HERO_TAIL;
        if (o.material && o.material !== HERO_PAINT) o.material.envMapIntensity = 1.0;
      }
      if (/^wheel_(fl|fr|rl|rr)$/.test(o.name)) { o.rotation.order = 'YXZ'; HERO.wheels.push({ node: o, front: o.name[6] === 'f' }); }
      if (o.name === 'steering_wheel') { HERO.steer = o; HERO.steerQ0 = o.quaternion.clone(); }
    });
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4), new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(HERO_AO), blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, depthWrite: false }));
    ao.rotation.x = -PI / 2; ao.position.y = 0.02; ao.renderOrder = 4; m.add(ao);
    HERO.model = m; HERO.loading = false; onReady && onReady();
  };
  const base = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/';
  const add = src => new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
  (THREE.DRACOLoader ? Promise.resolve() : add(base + 'js/loaders/DRACOLoader.js')).then(() => {
    const draco = new THREE.DRACOLoader(); draco.setDecoderPath(base + 'js/libs/draco/gltf/');
    const loader = new THREE.GLTFLoader(); loader.setDRACOLoader(draco);
    loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/ferrari.glb', done, undefined, () => { HERO.loading = false; });
  }).catch(() => { HERO.loading = false; });
}
const HERO_AO = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/ferrari_ao.png';
const HERO_PAINT = new THREE.MeshPhysicalMaterial({ color: C('#e2561b'), metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
const HERO_TAIL = vehMat.tail.clone();
