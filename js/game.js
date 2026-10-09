// Atlas Drive: physics, cameras, gameplay, HUD and menu
let night = false, quality = 'high', state = 'menu', mode = 'run';
const LHT = new Set('gb ie im je gg in pk bd lk np bt mv jp au nz za my sg th id hk mo ke ug tz zw zm mw bw na ls sz mz jm tt bb bs cy mt mu sc bn pg fj ws to gy sr ky vg ai ms tc fk sh tl'.split(' '));
const PLACES = [
  { id: 'gen', name: 'Generated city', sub: 'Flyover, underpass, works offline', gen: true },
  { id: 'nyc', name: 'Times Square', sub: 'New York', lat: 40.7580, lon: -73.9855, lht: false },
  { id: 'tok', name: 'Shibuya', sub: 'Tokyo', lat: 35.6595, lon: 139.7005, lht: true },
  { id: 'par', name: 'Champs-Élysées', sub: 'Paris', lat: 48.8698, lon: 2.3078, lht: false },
  { id: 'lon', name: 'Westminster', sub: 'London', lat: 51.5007, lon: -0.1246, lht: true },
  { id: 'dxb', name: 'Downtown Dubai', sub: 'Dubai', lat: 25.1972, lon: 55.2744, lht: false },
  { id: 'lhr', name: 'Liberty Market', sub: 'Lahore', lat: 31.5106, lon: 74.3432, lht: true },
  { id: 'isb', name: 'Blue Area', sub: 'Islamabad', lat: 33.7104, lon: 73.0597, lht: true },
];
const PAINTS = ['#e2561b', '#1f52d8', '#c8141f', '#e9e6df', '#2a2e33', '#1d8a5a'];
const SUPER = { label: 'Supercar', phys: { power: 470, acc: 11, grip: 10.5, brake: 21 } };
const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;
const R = rng(Date.now() % 100000);

/* ---------- Player vehicle ---------- */
const car = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, th: 0, yaw: 0, steer: 0, vF: 0, vL: 0, aLong: 0, aLat: 0, hand: 0, pitch: 0, air: false };
const carRoot = new THREE.Group(); carRoot.rotation.order = 'YXZ'; scene.add(carRoot);
let player = { type: 'super', color: PAINTS[0], v: null };
const headL = [];
for (const sx of [-0.6, 0.6]) {
  const sp = new THREE.SpotLight(C(0xfff0d8), 0, 90, 0.42, 0.55, 1.2);
  sp.position.set(sx, 0.75, 2.2); sp.target.position.set(sx * 1.6, 0, 24); carRoot.add(sp, sp.target); headL.push(sp);
}
function playerSpec() { return player.type === 'super' ? SUPER : VSPEC[player.type]; }
function buildPlayer() {
  if (player.v) carRoot.remove(player.v.root);
  if (player.type === 'super') {
    if (HERO.model) {
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.add(HERO.model);
      HERO_PAINT.color.copy(C(player.color));
      player.v = { root, body, wheels: [], hero: true, seat: HERO.seat, lights: { head: vehMat.head, tail: HERO_TAIL }, spec: { len: 4.6, w: 1.95, r: 0.34 } };
    } else {
      // show a sedan until the detailed model arrives
      player.v = makeVehicle('sedan', player.color, { player: true, rhd: Traffic.lht });
      loadHeroModel(() => { if (player.type === 'super') buildPlayer(); });
    }
  } else player.v = makeVehicle(player.type, player.color, { player: true, rhd: Traffic.lht });
  player.v.root.traverse(o => { if (o.isMesh && o.material !== blobMat) o.castShadow = true; });
  carRoot.add(player.v.root);
  applyNightToCar();
}

/* ---------- Physics ---------- */
const STEP = 1 / 120;
let impactShake = 0;
function groundHeight(x, z, y) {
  if (G.active && G.calibrated) { const g = googleGround(x, z, y + 2.5); if (g != null) return g; }
  return surfaceAt(x, z, y);
}
function step(dt, inp) {
  const c = car, P = playerSpec().phys;
  let fx = Math.sin(c.th), fz = Math.cos(c.th);
  let vF = c.vx * fx + c.vz * fz;
  const speed = Math.abs(vF);
  let a = 0;
  if (!c.air) {
    if (inp.gas) a += vF < -0.5 ? 16 : Math.min(P.acc, P.power / Math.max(speed, 1)) * inp.gas;
    if (inp.brake) { if (vF > 0.6) a -= P.brake; else if (vF > -14) a -= 8.5; }
    if (inp.hand && speed > 0.5) a -= Math.sign(vF) * 3.5;
    a -= 9.81 * Math.sin(c.pitch);
  }
  a -= 0.0012 * vF * Math.abs(vF) + 0.03 * vF + (speed > 0.2 && !c.air ? Math.sign(vF) * 0.35 : 0);
  if (!inp.gas && !inp.brake && speed < 0.3 && Math.abs(c.pitch) < 0.05) { vF = 0; a = 0; }
  const vF2 = vF + a * dt;
  if (inp.brake && vF > 0 && vF2 < 0 && vF > 0.6) vF = 0; else vF = vF2;
  c.aLong += (a - c.aLong) * Math.min(1, 8 * dt);
  const rx0 = -Math.cos(c.th), rz0 = Math.sin(c.th);
  let vL = c.vx * rx0 + c.vz * rz0;
  c.vx = fx * vF + rx0 * vL; c.vz = fz * vF + rz0 * vL;
  const maxSteer = 0.58 / (1 + speed / 24), delta = c.steer * maxSteer;
  c.hand += ((inp.hand ? 1 : 0) - c.hand) * Math.min(1, (inp.hand ? 10 : 2.2) * dt);
  if (!c.air) {
    const targetYaw = -vF * Math.tan(delta) / 2.7 * (1 + c.hand * 0.45);
    c.yaw += (targetYaw - c.yaw) * Math.min(1, (9 - c.hand * 5.5) * dt);
  }
  c.th += c.yaw * dt;
  fx = Math.sin(c.th); fz = Math.cos(c.th);
  const rx = -Math.cos(c.th), rz = Math.sin(c.th);
  vF = c.vx * fx + c.vz * fz; vL = c.vx * rx + c.vz * rz;
  if (!c.air) vL *= Math.exp(-(speed > 30 ? 0.72 : 1) * P.grip * (1 - c.hand * 0.88) * dt);
  c.vx = fx * vF + rx * vL; c.vz = fz * vF + rz * vL;
  c.vF = vF; c.vL = vL;
  c.aLat += (-vF * c.yaw - c.aLat) * Math.min(1, 8 * dt);
  c.x += c.vx * dt; c.z += c.vz * dt;
  collide(fx, fz);
}
function pushOut(px, pz, strength) {
  const c = car;
  c.x += px; c.z += pz;
  const l = Math.hypot(px, pz), nx = px / l, nz = pz / l, vn = c.vx * nx + c.vz * nz;
  if (vn < 0) {
    c.vx -= nx * vn * 1.3; c.vz -= nz * vn * 1.3; c.vx *= 0.93; c.vz *= 0.93;
    if (-vn > 4) { impactShake = Math.min(1, -vn / 25); sfx('hit', -vn * (strength || 1)); drift.pts = 0; drift.t = 0; }
    c.yaw *= 0.6;
  }
}
function collide(fx, fz) {
  const c = car, len = (player.v && player.v.spec.len) || 4.6, off = len / 2 - 1.0;
  for (const o of [off, 0, -off]) {
    const cx = c.x + fx * o, cz = c.z + fz * o, r = 0.98;
    let px = 0, pz = 0;
    forTilesNear(cx, cz, r + 2, t => t.grid.query(cx, cz, r + 1, s => {
      let d, nx, nz, pen;
      if (s.r !== undefined) {
        if (c.y > s.top - 0.3) return;
        d = Math.hypot(cx - s.x, cz - s.z); pen = r + s.r - d; if (pen <= 0 || d < 1e-4) return; nx = (cx - s.x) / d; nz = (cz - s.z) / d;
      } else {
        const q = segDist(cx, cz, s);
        if (s.rail) { const h = s.ha + (s.hb - s.ha) * q[3]; if (s.rail === 'bridge' ? !(c.y > 1.0 && Math.abs(c.y - h) < 1.6) : !(c.y < -0.8)) return; }
        else if (s.wall && (c.y > 4 || c.y > s.top - 0.5)) return;
        d = q[0]; pen = r - d; if (pen <= 0 || d < 1e-4) return; nx = (cx - q[1]) / d; nz = (cz - q[2]) / d;
      }
      px += nx * pen; pz += nz * pen;
    }));
    if (px || pz) pushOut(px, pz);
  }
  // traffic
  for (const t of Traffic.cars) {
    if (Math.abs(t.y - c.y) > 2 || Math.hypot(t.x - c.x, t.z - c.z) > t.len / 2 + 4) continue;
    const tfx = Math.sin(t.yaw), tfz = Math.cos(t.yaw), tr = t.v.spec.w / 2 + 0.1, th = t.len / 2 - tr;
    for (const o of [off, 0, -off]) {
      const cx = c.x + fx * o, cz = c.z + fz * o;
      for (const k of [th, 0, -th]) {
        const ox = t.x + tfx * k, oz = t.z + tfz * k, d = Math.hypot(cx - ox, cz - oz), pen = 0.98 + tr - d;
        if (pen > 0 && d > 1e-4) { pushOut((cx - ox) / d * pen, (cz - oz) / d * pen, 1.4); t.sp *= 0.4; t.stop = 1.6; }
      }
    }
  }
  if (World.mode === 'gen') { const d = Math.hypot(c.x, c.z), Rm = World.radius; if (d > Rm) { const nx = c.x / d, nz = c.z / d; c.x = nx * Rm; c.z = nz * Rm; const vn = c.vx * nx + c.vz * nz; if (vn > 0) { c.vx -= nx * vn * 1.5; c.vz -= nz * vn * 1.5; } } }
}
function verticalUpdate(dt) {
  const c = car, fx = Math.sin(c.th), fz = Math.cos(c.th), half = 1.3;
  const sC = groundHeight(c.x, c.z, c.y), sF = groundHeight(c.x + fx * half, c.z + fz * half, c.y), sR = groundHeight(c.x - fx * half, c.z - fz * half, c.y);
  if (c.y - sC < 0.45 && c.vy <= 0.5) { c.y = sC; c.vy = 0; c.air = false; }
  else {
    c.vy -= 9.81 * dt; c.y += c.vy * dt; c.air = true;
    if (c.y <= sC) { if (c.vy < -6) { impactShake = Math.min(1, -c.vy / 14); sfx('hit', -c.vy * 2); } c.y = sC; c.vy = 0; c.air = false; }
  }
  const pt = c.air ? c.pitch * 0.98 : Math.atan2(sF - sR, half * 2);
  c.pitch += (clamp(pt, -0.35, 0.35) - c.pitch) * Math.min(1, 10 * dt);
}

/* ---------- Effects ---------- */
const smoke = [];
for (let i = 0; i < 46; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); smoke.push({ s, life: 0, vx: 0, vy: 0, vz: 0 }); }
let smokeIdx = 0, smokeTimer = 0;
function puff(x, y, z) { const p = smoke[smokeIdx++ % smoke.length]; p.life = 1; p.s.visible = true; p.s.position.set(x, y + 0.4, z); p.vx = (Math.random() - 0.5) * 1.5; p.vy = 0.8 + Math.random() * 0.8; p.vz = (Math.random() - 0.5) * 1.5; }
const SKID_N = 1400, skidPos = new Float32Array(SKID_N * 18), skidGeo = new THREE.BufferGeometry();
skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3));
const skidMesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
skidMesh.frustumCulled = false; skidMesh.renderOrder = 3; scene.add(skidMesh);
let skidIdx = 0; const skidLast = [null, null];
function skidQuad(a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz); if (l < 0.05 || l > 4) return;
  const px = -dz / l * 0.14, pz = dx / l * 0.14, ya = a[1] + 0.05, yb = b[1] + 0.05, o = (skidIdx++ % SKID_N) * 18;
  skidPos.set([a[0] + px, ya, a[2] + pz, a[0] - px, ya, a[2] - pz, b[0] - px, yb, b[2] - pz, a[0] + px, ya, a[2] + pz, b[0] - px, yb, b[2] - pz, b[0] + px, yb, b[2] + pz], o);
  skidGeo.attributes.position.needsUpdate = true;
}
function clearSkids() { skidPos.fill(0); skidGeo.attributes.position.needsUpdate = true; skidLast[0] = skidLast[1] = null; }

/* ---------- Checkpoints ---------- */
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  uniforms: { col: { value: new THREE.Color(0xff8d24) }, t: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 col; uniform float t; varying vec2 vUv; void main(){ float a = pow(max(1.0 - vUv.y, 0.0001), 2.2) * (0.55 + 0.15 * sin(t * 4.0 + vUv.y * 20.0)); gl_FragColor = vec4(col * a, a); }'
});
const cpGroup = new THREE.Group();
const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 70, 40, 1, true).translate(0, 35, 0), beamMat);
const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.22, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffb060 }));
ring.rotation.x = PI / 2; ring.position.y = 0.3; cpGroup.add(beam, ring); cpGroup.visible = false; scene.add(cpGroup);

/* ---------- Input ---------- */
const touch = { left: 0, right: 0, gas: 0, brake: 0, hand: 0 }, keys = {};
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = 1;
  if (state === 'drive') { if (e.code === 'KeyR') respawn(); if (e.code === 'KeyC') cycleCamera(); if (e.code === 'KeyL') toggleLabels(); }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = 0; });
function bindBtn(id, k) {
  const el = $(id);
  const on = e => { e.preventDefault(); touch[k] = 1; el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { touch[k] = 0; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, off));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindBtn('cLeft', 'left'); bindBtn('cRight', 'right'); bindBtn('cGas', 'gas'); bindBtn('cBrake', 'brake'); bindBtn('cHand', 'hand');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function readInput() {
  const k = c => keys[c] ? 1 : 0;
  return { steer: Math.max(touch.right, k('ArrowRight'), k('KeyD')) - Math.max(touch.left, k('ArrowLeft'), k('KeyA')),
    gas: Math.max(touch.gas, k('ArrowUp'), k('KeyW')), brake: Math.max(touch.brake, k('ArrowDown'), k('KeyS')), hand: Math.max(touch.hand, k('Space')) };
}

/* ---------- Audio ---------- */
let AC = null, eng = null, muted = false;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    const g = AC.createGain(); g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(AC.destination); o1.start(); o2.start();
    const buf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = AC.createBufferSource(); n.buffer = buf; n.loop = true;
    const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1700; nf.Q.value = 0.9;
    const ng = AC.createGain(); ng.gain.value = 0; n.connect(nf); nf.connect(ng); ng.connect(AC.destination); n.start();
    const tf = AC.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 500; const tg = AC.createGain(); tg.gain.value = 0;
    const n2 = AC.createBufferSource(); n2.buffer = buf; n2.loop = true; n2.connect(tf); tf.connect(tg); tg.connect(AC.destination); n2.start();
    eng = { o1, o2, f, g, ng, tg, buf };
  } catch (e) { AC = null; }
}
function sfx(kind, strength) {
  if (!AC || !eng || muted) return;
  const t = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
  if (kind === 'hit') {
    const s = AC.createBufferSource(); s.buffer = eng.buf; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    s.connect(lp); lp.connect(g); g.gain.setValueAtTime(Math.min(0.6, strength * 0.03), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); s.start(t); s.stop(t + 0.4);
  } else {
    const o = AC.createOscillator(); o.type = 'triangle'; o.connect(g);
    o.frequency.setValueAtTime(kind === 'finish' ? 660 : 880, t); o.frequency.setValueAtTime(kind === 'finish' ? 990 : 1320, t + 0.09);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'finish' ? 0.7 : 0.35)); o.start(t); o.stop(t + 0.8);
  }
}

/* ---------- Game state ---------- */
let route = [], cpIdx = 0, runTime = 0, running = false, freeScore = 0, toastT = 0;
const drift = { pts: 0, t: 0, show: 0 };
const ROUTE_LEN = 8;
let bestKey = 'gen';
function placeCar(x, z, th, y) { Object.assign(car, { x, z, th, y: y || 0, vx: 0, vz: 0, vy: 0, yaw: 0, steer: 0, vF: 0, vL: 0, aLong: 0, aLat: 0, hand: 0, pitch: 0, air: false }); car.y = surfaceAt(x, z, (y || 0) + 0.5); }
function nearbyNodes(x, z, rMin, rMax) {
  const out = []; allTiles(t => { for (const n of t.nodes) { const d = Math.hypot(n[0] - x, n[1] - z); if (d > rMin && d < rMax && n[2] > -1) out.push(n); } });
  return out;
}
function nextCheckpoint(fromX, fromZ) {
  const c = nearbyNodes(fromX, fromZ, 130, 330); if (!c.length) return null;
  const p = c[(R() * c.length) | 0]; return [p[0], p[1], p[2]];
}
function startRun() {
  clearSkids(); drift.pts = 0; freeScore = 0; $('finish').hidden = true;
  if (mode === 'run') { route = []; const p = nextCheckpoint(car.x, car.z); if (p) route.push(p); cpIdx = 0; runTime = 0; running = !!p; }
  else { route = []; running = false; }
  updateModeHud();
}
function updateModeHud() {
  $('arrow').hidden = mode !== 'run'; cpGroup.visible = mode === 'run' && running;
  if (mode === 'run') $('cpCount').textContent = `Checkpoint ${cpIdx} / ${ROUTE_LEN}`;
  else { $('timer').textContent = Math.round(freeScore).toLocaleString(); $('cpCount').textContent = 'Drift score'; }
}
function respawn() {
  let best = null, bd = 1e9;
  allTiles(t => { for (const n of t.nodes) { const d = Math.hypot(n[0] - car.x, n[1] - car.z) + Math.abs(n[2] - car.y) * 3; if (d < bd) { bd = d; best = n; } } });
  if (!best) return;
  placeCar(best[0], best[1], car.th, best[2]); skidLast[0] = skidLast[1] = null; toast('Back on the road');
}
const fmtTime = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function toast(msg, secs) { const el = $('toast'); el.textContent = msg; el.hidden = false; toastT = secs || 2.2; }
function loadBest() { try { return parseFloat(localStorage.getItem('atlasdrive.best.' + bestKey)) || 0; } catch (e) { return 0; } }
function saveBest(t) { try { localStorage.setItem('atlasdrive.best.' + bestKey, String(t)); } catch (e) {} }
function finishRun() {
  running = false; cpGroup.visible = false; sfx('finish');
  const prev = loadBest(), isBest = !prev || runTime < prev; if (isBest) saveBest(runTime);
  $('finKicker').textContent = isBest ? 'New best time' : 'Run complete';
  $('finTime').textContent = fmtTime(runTime);
  $('finSub').textContent = `${ROUTE_LEN} checkpoints in ${World.name}` + (prev && !isBest ? ` · Best ${fmtTime(prev)}` : '');
  $('finish').hidden = false;
}
$('againBtn').onclick = () => { mode = 'run'; startRun(); };
$('roamBtn').onclick = () => { mode = 'free'; $('finish').hidden = true; running = false; route = []; updateModeHud(); };

/* ---------- Cameras ---------- */
const CAMS = [['chase', 'Chase'], ['far', 'Far chase'], ['hood', 'Hood'], ['cockpit', 'Driver'], ['cinema', 'Cinematic'], ['drone', 'Drone']];
let camIdx = 0, camAnchor = null;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function cycleCamera() { camIdx = (camIdx + 1) % CAMS.length; camAnchor = null; $('camBtn').textContent = 'View: ' + CAMS[camIdx][1]; snapCam = true; }
let snapCam = true, menuOrbit = 0;
function setNear(n) { if (camera.near !== n) { camera.near = n; camera.updateProjectionMatrix(); } }
function updateCamera(dt) {
  const fx = Math.sin(car.th), fz = Math.cos(car.th), sp = Math.abs(car.vF);
  if (state === 'menu') {
    menuOrbit += dt * 0.12; setNear(0.3);
    camera.position.set(car.x + Math.sin(menuOrbit) * 11, car.y + 3.2, car.z + Math.cos(menuOrbit) * 11);
    camera.lookAt(car.x, car.y + 0.9, car.z); if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
    return;
  }
  const cam = CAMS[camIdx][0];
  let fov = 60 + clamp(sp / 65, 0, 1) * 16;
  if (cam === 'cockpit' || cam === 'hood') {
    setNear(0.05);
    const v = player.v, body = v.body;
    body.updateMatrixWorld(true);
    if (cam === 'cockpit') { const s = v.seat || [0.38, 1.15, -0.3]; tmpV.set(s[0], s[1], s[2]); tmpV2.set(s[0] * 0.6, s[1] - 0.1, s[2] + 12); fov = 72; }
    else { const s = player.v.hero ? [0, 1.02, 0.9] : [0, (v.spec.body ? v.spec.body[4][1] : 1.2) + 0.32, (v.spec.dashZ || 1) + 0.7]; tmpV.set(s[0], s[1], s[2]); tmpV2.set(0, s[1] - 0.25, s[2] + 14); fov = 66 + clamp(sp / 65, 0, 1) * 10; }
    body.localToWorld(tmpV); body.localToWorld(tmpV2);
    camera.position.copy(tmpV); camera.lookAt(tmpV2);
  } else if (cam === 'cinema') {
    setNear(0.3);
    const rel = camAnchor ? (camAnchor.x - car.x) * fx + (camAnchor.z - car.z) * fz : -999;
    if (!camAnchor || rel < -28 || Math.hypot(camAnchor.x - car.x, camAnchor.z - car.z) > 90) {
      const side = R() < 0.5 ? -1 : 1, ahead = 45 + R() * 20;
      camAnchor = new THREE.Vector3(car.x + fx * ahead - fz * side * 8, car.y + 1.4 + R() * 2.5, car.z + fz * ahead + fx * side * 8);
    }
    camera.position.copy(camAnchor); camera.lookAt(car.x, car.y + 0.8, car.z); fov = clamp(70 - Math.hypot(camAnchor.x - car.x, camAnchor.z - car.z) * 0.5, 22, 60);
  } else {
    setNear(0.3);
    let dx = fx, dz = fz; const v = Math.hypot(car.vx, car.vz);
    if (v > 3 && car.vF > 0) { dx = fx * 0.65 + car.vx / v * 0.35; dz = fz * 0.65 + car.vz / v * 0.35; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const big = player.v && player.v.spec.len > 5 ? 1.2 : 1;
    const dist = (cam === 'far' ? 10.5 : cam === 'drone' ? 20 : 6.6) * big + sp * 0.03, h = (cam === 'far' ? 3.6 : cam === 'drone' ? 12 : 2.3) * big + sp * 0.008;
    tmpV.set(car.x - dx * dist, car.y + h, car.z - dz * dist);
    if (snapCam) camPos.copy(tmpV); else camPos.lerp(tmpV, 1 - Math.exp(-7 * dt));
    camLook.set(car.x + dx * 4, car.y + 1.0, car.z + dz * 4);
    camera.position.copy(camPos);
    if (impactShake > 0) { camera.position.x += (Math.random() - 0.5) * impactShake * 0.5; camera.position.y += (Math.random() - 0.5) * impactShake * 0.3; }
    camera.lookAt(camLook);
  }
  snapCam = false;
  impactShake = Math.max(0, impactShake - dt * 2.5);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, 4 * dt); camera.updateProjectionMatrix(); }
}

/* ---------- Minimap ---------- */
const mini = $('mini'), mctx = mini.getContext('2d');
function drawMini() {
  const W = mini.width, H = mini.height, k = (W / 2) / 120; // pixels per metre (radius 120 m)
  mctx.save(); mctx.clearRect(0, 0, W, H);
  mctx.beginPath(); mctx.arc(W / 2, H / 2, W / 2, 0, PI * 2); mctx.clip();
  mctx.fillStyle = '#1b1f23'; mctx.fillRect(0, 0, W, H);
  mctx.translate(W / 2, H / 2); mctx.rotate(-PI / 2 - Math.atan2(Math.cos(car.th), Math.sin(car.th)));
  allTiles(t => { const m = t.mini; if (!m) return; if (Math.abs(m.x0 + m.size / 2 - car.x) > m.size / 2 + 200 || Math.abs(m.z0 + m.size / 2 - car.z) > m.size / 2 + 200) return; mctx.drawImage(m.c, (m.x0 - car.x) * k, (m.z0 - car.z) * k, m.size * k, m.size * k); });
  if (mode === 'run' && running && route[cpIdx]) { const p = route[cpIdx]; mctx.fillStyle = '#ff8d24'; mctx.beginPath(); mctx.arc((p[0] - car.x) * k, (p[1] - car.z) * k, 8, 0, PI * 2); mctx.fill(); }
  mctx.fillStyle = '#e9e6df'; for (const t of Traffic.cars) { mctx.fillRect((t.x - car.x) * k - 2, (t.z - car.z) * k - 2, 4, 4); }
  // north marker
  mctx.fillStyle = '#ff8d24'; mctx.font = '700 22px Barlow, sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText('N', 0, -W / 2 + 18);
  mctx.restore();
  mctx.fillStyle = '#f4efe7'; mctx.strokeStyle = '#1a0e02'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(W / 2, H / 2 - 13); mctx.lineTo(W / 2 + 9, H / 2 + 10); mctx.lineTo(W / 2, H / 2 + 5); mctx.lineTo(W / 2 - 9, H / 2 + 10); mctx.closePath(); mctx.fill(); mctx.stroke();
}

/* ---------- Frame loop ---------- */
let acc = 0, lastT = performance.now(), hudT = 0, streetT = 0;
const GEARS = [0, 11, 21, 31, 42, 54, 99];
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const driving = state === 'drive' && $('finish').hidden;
  const inp = driving ? readInput() : { steer: 0, gas: 0, brake: state === 'drive' ? 1 : 0, hand: 0 };
  if (state === 'drive') {
    car.steer += clamp(inp.steer - car.steer, -(inp.steer === 0 ? 6 : 4) * dt, (inp.steer === 0 ? 6 : 4) * dt);
    acc += dt; while (acc >= STEP) { step(STEP, inp); acc -= STEP; }
    verticalUpdate(dt);
    gameplay(dt, inp);
    updateTraffic(dt, car, R);
  }
  streamUpdate(dt, car.x, car.z, car.vx, car.vz);
  updateCarVisual(dt, inp);
  updateCamera(dt);
  googleUpdate(dt, car.x, car.z);
  updateLabels(dt, camera, car.x, car.z, name => toast('Passing ' + name, 2.6));
  sun.target.position.set(car.x, car.y, car.z);
  sun.position.set(car.x + SUN_DIR.x * 240, car.y + SUN_DIR.y * 240, car.z + SUN_DIR.z * 240);
  sky.position.copy(camera.position); ground.position.x = camera.position.x - camera.position.x % 8; ground.position.z = camera.position.z - camera.position.z % 8;
  beamMat.uniforms.t.value = now / 1000; ring.rotation.z += dt * 0.8;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').hidden = true; }
  if (state === 'drive') { hudT += dt; drawMini(); updateHud(inp, dt); }
  renderer.render(scene, camera);
}
function gameplay(dt, inp) {
  const sp = Math.abs(car.vF);
  if (Math.abs(car.vL) > 3.2 && sp > 8 && !car.air) { drift.pts += Math.abs(car.vL) * sp * dt * 0.6; drift.t = 0.7; drift.show = 1; }
  else if (drift.t > 0) { drift.t -= dt; if (drift.t <= 0) { if (drift.pts > 30) { freeScore += drift.pts; if (mode === 'free') toast(`+${Math.round(drift.pts)} drift`, 1.2); } drift.pts = 0; drift.show = 0; } }
  if (mode === 'run' && running) {
    runTime += dt;
    const p = route[cpIdx];
    if (p) {
      cpGroup.position.set(p[0], p[2], p[1]);
      if (Math.hypot(car.x - p[0], car.z - p[1]) < 8.5 && Math.abs(car.y - p[2]) < 3) {
        cpIdx++; sfx('cp');
        if (cpIdx >= ROUTE_LEN) finishRun();
        else { const n = nextCheckpoint(p[0], p[1]); if (n) route.push(n); else { running = false; cpGroup.visible = false; } toast(`Checkpoint ${cpIdx} · ${fmtTime(runTime)}`, 1.4); $('cpCount').textContent = `Checkpoint ${cpIdx} / ${ROUTE_LEN}`; }
      }
    }
  }
  if (AC && eng) {
    const kmh = sp * 3.6; let g = 1; while (g < GEARS.length - 1 && sp > GEARS[g]) g++;
    const lo = GEARS[g - 1], hi = GEARS[g], rpm = 1000 + clamp((sp - lo) / (hi - lo), 0, 1) * 6400 * (kmh < 3 ? 0.1 : 1) + inp.gas * 600;
    car.rpm = rpm; car.gear = kmh < 1 ? 'N' : (car.vF < -0.3 ? 'R' : String(g));
    const t = AC.currentTime, f = rpm / 60 * 2;
    eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    eng.f.frequency.setTargetAtTime(300 + rpm * 0.22, t, 0.05);
    const cabin = CAMS[camIdx][0] === 'cockpit' ? 0.6 : 1;
    eng.g.gain.setTargetAtTime(muted ? 0 : (0.035 + inp.gas * 0.035) * cabin, t, 0.08);
    eng.ng.gain.setTargetAtTime(muted ? 0 : clamp((Math.abs(car.vL) - 3) * 0.025, 0, 0.14), t, 0.06);
    eng.tg.gain.setTargetAtTime(muted ? 0 : clamp(sp / 40, 0, 1) * 0.05, t, 0.2); // road and wind noise
  }
}
function updateCarVisual(dt, inp) {
  const v = player.v; if (!v) return;
  carRoot.position.set(car.x, car.y, car.z); carRoot.rotation.y = car.th; carRoot.rotation.x = -car.pitch;
  v.body.rotation.z = clamp(-car.aLat * 0.009, -0.07, 0.07);
  v.body.rotation.x = clamp(-car.aLong * 0.0045, -0.05, 0.05);
  const delta = car.steer * 0.58 / (1 + Math.abs(car.vF) / 24);
  for (const w of v.wheels) { w.spin.rotation.x += car.vF / v.spec.r * dt; if (w.front) w.g.rotation.y = -delta; }
  if (v.hero) {
    for (const w of HERO.wheels) { w.node.rotation.x -= car.vF / 0.34 * dt; w.node.rotation.y = w.front ? -delta : 0; }
    if (HERO.steer) { HERO.steer.quaternion.copy(HERO.steerQ0); HERO.steer.rotateOnAxis(new THREE.Vector3(0, 1, 0), -car.steer * 1.6); }
  } else if (v.steer) v.steer.rotation.z = car.steer * 1.6;
  v.lights.tail.emissiveIntensity = inp.brake && state === 'drive' ? 3.2 : night ? 1.6 : 0.8;
  const fx = Math.sin(car.th), fz = Math.cos(car.th), rx = -Math.cos(car.th), rz = Math.sin(car.th);
  const sliding = state === 'drive' && !car.air && ((Math.abs(car.vL) > 2.6 && Math.abs(car.vF) > 4) || (inp.brake && car.vF > 14));
  const rear = -(v.spec.len / 2 - 1.0);
  [-1, 1].forEach((side, i) => {
    const wx = car.x + fx * rear + rx * side * 0.86, wz = car.z + fz * rear + rz * side * 0.86;
    if (sliding) { if (skidLast[i]) skidQuad(skidLast[i], [wx, car.y, wz]); skidLast[i] = [wx, car.y, wz]; } else skidLast[i] = null;
  });
  smokeTimer -= dt;
  if (Math.abs(car.vL) > 4.5 && Math.abs(car.vF) > 5 && smokeTimer <= 0 && state === 'drive' && !car.air) {
    smokeTimer = 0.035; for (const side of [-1, 1]) puff(car.x + fx * (rear - 0.1) + rx * side * 0.86, car.y, car.z + fz * (rear - 0.1) + rz * side * 0.86);
  }
  for (const p of smoke) {
    if (p.life <= 0) continue; p.life -= dt * 0.9; if (p.life <= 0) { p.s.visible = false; continue; }
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    const k = 1 - p.life; p.s.scale.setScalar(1.2 + k * 5); p.s.material.opacity = 0.42 * p.life;
  }
}
function updateHud(inp, dt) {
  const kmh = Math.abs(car.vF) * 3.6;
  $('spd').textContent = Math.round(kmh);
  $('gear').textContent = car.gear || (kmh < 1 ? 'N' : 'D');
  $('rpmFill').style.width = (clamp(((car.rpm || 1000) - 800) / 6800, 0, 1) * 100).toFixed(1) + '%';
  if (mode === 'run') {
    if (running) $('timer').textContent = fmtTime(runTime);
    const p = route[cpIdx];
    if (running && p) {
      const dx = p[0] - car.x, dz = p[1] - car.z;
      const f = dx * Math.sin(car.th) + dz * Math.cos(car.th), r = -dx * Math.cos(car.th) + dz * Math.sin(car.th);
      $('arrow').firstElementChild.style.transform = `rotate(${Math.atan2(r, f)}rad)`;
      $('cpDist').textContent = Math.round(Math.hypot(dx, dz)) + ' m';
    }
  } else $('timer').textContent = Math.round(freeScore).toLocaleString();
  const db = $('driftBox');
  if (drift.show && drift.pts > 8) { db.hidden = false; $('driftPts').textContent = Math.round(drift.pts); } else db.hidden = true;
  streetT -= dt;
  if (streetT <= 0) {
    streetT = 0.35;
    const s = roadInfoAt(car.x, car.z, car.y);
    $('streetName').textContent = s && s.name ? s.name : (s ? 'Unnamed road' : 'Off road');
    const tag = s ? (s.kind === 'bridge' ? 'Flyover' : s.kind === 'trench' ? 'Underpass' : '') : '';
    $('streetTag').textContent = tag; $('streetTag').hidden = !tag;
    $('loading').hidden = !(World.mode === 'osm' && (World.busy || World.pending > 0));
    $('attrib').textContent = (G.active && G.calibrated ? googleCredits() + ' · ' : '') + (World.mode === 'osm' ? 'Streets, names: © OpenStreetMap contributors' : '');
  }
}

/* ---------- Night, quality, sizing ---------- */
function applyNightToCar() {
  headL.forEach(h => { h.intensity = night ? 2.6 : 0; });
  vehMat.head.emissiveIntensity = night ? 4 : 1.4; vehMat.tail.emissiveIntensity = night ? 1.8 : 0.8;
  if (player.v) player.v.lights.head.emissiveIntensity = night ? 4 : 1.4;
}
function setNight(on) {
  night = on;
  const u = sky.material.uniforms;
  u.top.value.set(on ? 0x04060d : 0x2f62ad); u.hz.value.set(on ? 0x1a2132 : 0xf2c193); u.glow.value = on ? 0 : 1;
  scene.environment = on ? ENV.night : ENV.day;
  scene.fog.color.copy(on ? C(0x111725) : C(0xd9b596)); scene.fog.near = on ? 50 : 180; scene.fog.far = on ? 700 : 1100;
  sun.intensity = on ? 0.35 : 2.3; sun.color.copy(on ? C(0x8fa8d8) : C(0xffd2a6)); hemi.intensity = on ? 0.12 : 0.55;
  renderer.toneMappingExposure = on ? 1.25 : 1.05;
  for (const m of [wallMat, towerMat, brickMat]) m.emissive.setRGB(on ? 1 : 0, on ? 1 : 0, on ? 1 : 0);
  for (const k in ROAD_MAT) { ROAD_MAT[k].roughness = DECK_MAT[k].roughness = on ? 0.45 : 0.82; ROAD_MAT[k].envMapIntensity = DECK_MAT[k].envMapIntensity = on ? 0.9 : 0.3; }
  allTiles(t => { if (t.nightGroup) t.nightGroup.visible = on; });
  applyNightToCar(); googleSetNight(on);
}
function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (G.tiles) G.tiles.setResolutionFromRenderer(camera, renderer);
}
function setQuality(q) {
  quality = q; const size = q === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (G.tiles) G.tiles.errorTarget = q === 'high' ? 18 : 36;
  resize();
}
addEventListener('resize', resize);
function toggleLabels() { showLabels = !showLabels; $('labelBtn').textContent = showLabels ? 'Names on' : 'Names off'; }
function onGoogleReady() { toast('Photoreal 3D city loaded', 2.4); allTiles(t => { t.vis.visible = false; }); ground.visible = false; }
function onGoogleFail() { toast('Google 3D tiles did not load. Check the key has Map Tiles API and billing enabled.', 5); googleStop(); allTiles(t => { t.vis.visible = true; }); ground.visible = true; }

/* ---------- Menu ---------- */
let selected = PLACES[0], customPlace = null;
const placesEl = $('places');
function renderPlaces() {
  placesEl.innerHTML = '';
  const list = customPlace ? [customPlace, ...PLACES] : PLACES;
  for (const p of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'place' + (p.gen ? ' gen' : '') + (p === selected ? ' on' : '');
    b.innerHTML = '<b></b><small></small>';
    b.querySelector('b').textContent = p.name;
    b.querySelector('small').textContent = p.gen ? p.sub : `${p.sub} · ${fmtCoord(p.lat, p.lon)}`;
    b.onclick = () => { selected = p; renderPlaces(); setStatus(''); };
    placesEl.appendChild(b);
  }
}
renderPlaces();
const carsEl = $('cars');
PLAYER_TYPES.forEach(t => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = t === 'super' ? 'Supercar' : VSPEC[t].label; b.dataset.t = t;
  if (t === player.type) b.className = 'on';
  b.onclick = () => { player.type = t; carsEl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); buildPlayer(); };
  carsEl.appendChild(b);
});
const swEl = $('swatches');
PAINTS.forEach((hex, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (i === 0 ? ' on' : ''); b.style.background = hex; b.setAttribute('aria-label', 'Paint ' + (i + 1));
  b.onclick = () => { player.color = hex; HERO_PAINT.color.copy(C(hex)); swEl.querySelectorAll('.sw').forEach(s => s.classList.remove('on')); b.classList.add('on'); if (player.type !== 'super') buildPlayer(); };
  swEl.appendChild(b);
});
function segWire(id, attr, cb) { const el = $(id); el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cb(b.dataset[attr]); }); }
segWire('modeSeg', 'mode', v => { mode = v; });
segWire('qualSeg', 'q', v => setQuality(v));
segWire('timeSeg', 't', v => setNight(v === 'night'));
segWire('trafficSeg', 'n', v => { Traffic.target = (+v) * (quality === 'high' ? 1 : 0.6) | 0; });
Traffic.target = 14;
function setStatus(msg, warn) { const s = $('status'); s.textContent = msg; s.classList.toggle('warn', !!warn); }
// Google photoreal settings
const gChk = $('gOn'), gKey = $('gKey');
gKey.value = G.key; gChk.checked = !!G.key && (() => { try { return localStorage.getItem('atlasdrive.gon') === '1'; } catch (e) { return false; } })();
$('gKeyRow').hidden = !gChk.checked;
gChk.onchange = () => { $('gKeyRow').hidden = !gChk.checked; try { localStorage.setItem('atlasdrive.gon', gChk.checked ? '1' : '0'); } catch (e) {} };
gKey.oninput = () => { G.key = gKey.value.trim(); try { localStorage.setItem('atlasdrive.gkey', G.key); } catch (e) {} };

$('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('searchInput').value.trim(); if (!q) return;
  setStatus(`Searching for “${q}”…`);
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=' + encodeURIComponent(q));
    const j = await res.json();
    if (!j.length) { setStatus(`No place found for “${q}”. Try a landmark or street name.`, true); return; }
    const label = j[0].display_name.split(',').slice(0, 2).join(','), cc = (j[0].address && j[0].address.country_code) || '';
    customPlace = { id: 'c' + Date.now(), name: label.split(',')[0], sub: label.split(',')[1] ? label.split(',')[1].trim() : 'Search result', lat: +j[0].lat, lon: +j[0].lon, lht: LHT.has(cc) };
    selected = customPlace; renderPlaces(); setStatus(`Found ${label}. Tap Drive.`);
  } catch (err) { setStatus('Place search is not responding. Check your connection, or pick one of the places above.', true); }
});
$('locBtn').onclick = () => {
  if (!navigator.geolocation) { setStatus('This browser cannot share your location.', true); return; }
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    customPlace = { id: 'me' + lat.toFixed(4) + lon.toFixed(4), name: 'My street', sub: 'Your location', lat, lon, lht: false };
    try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&addressdetails=1&lat=${lat}&lon=${lon}`); const j = await r.json(); const cc = j.address && j.address.country_code; customPlace.lht = LHT.has(cc); if (j.address) customPlace.sub = j.address.city || j.address.town || j.address.state || 'Your location'; } catch (e) {}
    selected = customPlace; renderPlaces(); setStatus('Got it. Tap Drive to race around your own neighbourhood.');
  }, err => setStatus(err.code === 1 ? 'Location permission was declined. Search for your area by name instead.' : 'Could not get your location. Search for your area by name instead.', true),
  { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
};
let loadedId = null, busy = false;
async function loadPlace(p) {
  clearTraffic(); googleStop(); ground.visible = true; announced.clear(); $('toast').hidden = true; toastT = 0;
  Traffic.lht = !!p.lht;
  let spawn;
  if (p.gen) { clearGraph(); spawn = startGenerated(); bestKey = 'gen'; }
  else {
    clearGraph();
    spawn = await startOSM(p.lat, p.lon, p.name, m => setStatus(m));
    bestKey = p.id;
    if (gChk.checked && G.key) { if (googleStart(p.lat, p.lon)) setStatus('Loading Google photoreal 3D tiles…'); }
  }
  loadedId = p.id;
  buildPlayer();
  placeCar(spawn.x, spawn.z, spawn.th, 0);
  setNight(night);
}
$('driveBtn').onclick = async () => {
  if (busy) return;
  initAudio();
  if (selected.id !== loadedId || (gChk.checked && G.key && !G.active && !selected.gen)) {
    busy = true; $('driveBtn').disabled = true;
    try { await loadPlace(selected); setStatus(''); }
    catch (err) {
      const msg = err && err.busy ? 'The map server is busy right now. Wait a minute and try again.' : err && /No roads/.test(err.message) ? 'No drivable roads were found there. Try a busier spot.' : 'Could not reach the map server. Check your connection and try again.';
      await loadPlace(PLACES[0]); selected = PLACES[0]; renderPlaces(); setStatus(msg + ' Loaded the generated city for now.', true);
    }
    busy = false; $('driveBtn').disabled = false;
  }
  enterDrive();
};
function enterDrive() {
  state = 'drive';
  $('menu').hidden = true; $('hud').hidden = false; $('controls').hidden = !isTouch;
  snapCam = true; startRun();
  if (AC && AC.state === 'suspended') AC.resume();
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
}
$('menuBtn').onclick = () => {
  state = 'menu'; $('menu').hidden = false; $('hud').hidden = true; $('controls').hidden = true; cpGroup.visible = false;
  if (eng) { eng.g.gain.value = 0; eng.ng.gain.value = 0; eng.tg.gain.value = 0; }
  for (const k in touch) touch[k] = 0;
};
$('respawnBtn').onclick = () => respawn();
$('camBtn').onclick = () => cycleCamera();
$('labelBtn').onclick = () => toggleLabels();
$('muteBtn').onclick = () => { muted = !muted; $('muteBtn').textContent = muted ? 'Sound off' : 'Sound on'; if (eng && muted) { eng.g.gain.value = 0; eng.ng.gain.value = 0; eng.tg.gain.value = 0; } };

/* ---------- Boot ---------- */
loadPlace(PLACES[0]);
loadHeroModel(() => { if (player.type === 'super') buildPlayer(); });
resize();
requestAnimationFrame(t => { lastT = t; frame(t); });
