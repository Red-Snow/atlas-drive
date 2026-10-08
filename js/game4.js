/* ======================= Physics ======================= */
const STEP = 1 / 120, WHEELBASE = 2.7;
let impactShake = 0;
function step(dt, inp) {
  const c = car;
  let fx = Math.sin(c.th), fz = Math.cos(c.th);
  let vF = c.vx * fx + c.vz * fz;
  const speed = Math.abs(vF);
  // longitudinal
  let a = 0;
  if (inp.gas) a += vF < -0.5 ? 16 : Math.min(11, 470 / Math.max(speed, 1)) * inp.gas;
  if (inp.brake) { if (vF > 0.6) a -= 21; else if (vF > -15) a -= 8.5; }
  if (inp.hand && speed > 0.5) a -= Math.sign(vF) * 3.5;
  a -= 0.0012 * vF * Math.abs(vF) + 0.03 * vF + (speed > 0.2 ? Math.sign(vF) * 0.35 : 0);
  if (!inp.gas && !inp.brake && speed < 0.3) { vF = 0; a = 0; }
  const vF2 = vF + a * dt;
  if (inp.brake && vF > 0 && vF2 < 0 && vF > 0.6) vF = 0; else vF = vF2;
  c.aLong += (a - c.aLong) * Math.min(1, 8 * dt);
  // compose velocity
  const rx0 = -Math.cos(c.th), rz0 = Math.sin(c.th);
  let vL = c.vx * rx0 + c.vz * rz0;
  c.vx = fx * vF + rx0 * vL; c.vz = fz * vF + rz0 * vL;
  // yaw
  const maxSteer = 0.58 / (1 + speed / 24);
  const delta = c.steer * maxSteer;
  c.hand += ((inp.hand ? 1 : 0) - c.hand) * Math.min(1, (inp.hand ? 10 : 2.2) * dt);
  const targetYaw = -vF * Math.tan(delta) / WHEELBASE * (1 + c.hand * 0.45);
  c.yaw += (targetYaw - c.yaw) * Math.min(1, (9 - c.hand * 5.5) * dt);
  c.th += c.yaw * dt;
  // lateral grip in new frame
  fx = Math.sin(c.th); fz = Math.cos(c.th);
  const rx = -Math.cos(c.th), rz = Math.sin(c.th);
  vF = c.vx * fx + c.vz * fz; vL = c.vx * rx + c.vz * rz;
  const grip = (speed > 30 ? 7.5 : 10.5) * (1 - c.hand * 0.88);
  vL *= Math.exp(-grip * dt);
  c.vx = fx * vF + rx * vL; c.vz = fz * vF + rz * vL;
  c.vF = vF; c.vL = vL;
  c.aLat += (-vF * c.yaw - c.aLat) * Math.min(1, 8 * dt);
  // integrate + collide
  c.x += c.vx * dt; c.z += c.vz * dt;
  collide(fx, fz);
}
function collide(fx, fz) {
  const c = car;
  for (const off of [1.35, 0, -1.35]) {
    const cx = c.x + fx * off, cz = c.z + fz * off, r = 0.98;
    let px = 0, pz = 0;
    grid.query(cx, cz, r + 1, s => {
      let d, nx, nz, pen;
      if (s.r !== undefined) { d = Math.hypot(cx - s.x, cz - s.z); pen = r + s.r - d; if (pen <= 0 || d < 1e-4) return; nx = (cx - s.x) / d; nz = (cz - s.z) / d; }
      else { const q = segDist(cx, cz, s); d = q[0]; pen = r - d; if (pen <= 0 || d < 1e-4) return; nx = (cx - q[1]) / d; nz = (cz - q[2]) / d; }
      px += nx * pen; pz += nz * pen;
    });
    if (px || pz) {
      c.x += px; c.z += pz;
      const l = Math.hypot(px, pz), nx = px / l, nz = pz / l, vn = c.vx * nx + c.vz * nz;
      if (vn < 0) {
        c.vx -= nx * vn * 1.3; c.vz -= nz * vn * 1.3; c.vx *= 0.93; c.vz *= 0.93;
        if (-vn > 4) { impactShake = Math.min(1, -vn / 25); sfx('hit', -vn); drift.pts = 0; drift.t = 0; }
        c.yaw *= 0.6;
      }
    }
  }
  const d = Math.hypot(c.x, c.z), R = WORLD.radius;
  if (d > R) { const nx = c.x / d, nz = c.z / d; c.x = nx * R; c.z = nz * R; const vn = c.vx * nx + c.vz * nz; if (vn > 0) { c.vx -= nx * vn * 1.5; c.vz -= nz * vn * 1.5; } }
}

/* ======================= Game state ======================= */
let state = 'menu', mode = 'run', route = [], cpIdx = 0, runTime = 0, running = false, freeScore = 0;
const drift = { pts: 0, t: 0, show: 0 };
const ROUTE_LEN = 8;
let bestKey = 'gen';
function placeCar(x, z, th) {
  Object.assign(car, { x, z, th, vx: 0, vz: 0, yaw: 0, steer: 0, vF: 0, vL: 0, aLong: 0, aLat: 0, hand: 0 });
}
function makeRoute() {
  const nodes = WORLD.nodes, r = Math.random, out = [];
  let cx = car.x, cz = car.z;
  for (let k = 0; k < ROUTE_LEN && nodes.length; k++) {
    let pick = null;
    for (let t = 0; t < 120; t++) {
      const n = nodes[(r() * nodes.length) | 0], d = Math.hypot(n[0] - cx, n[1] - cz);
      if (d > 130 && d < 330 && Math.hypot(n[0], n[1]) < WORLD.radius - 70 && !out.includes(n)) { pick = n; break; }
    }
    if (!pick) pick = nodes[(r() * nodes.length) | 0];
    out.push(pick); cx = pick[0]; cz = pick[1];
  }
  return out;
}
function startRun() {
  const s = WORLD.spawn; placeCar(s.x, s.z, s.th); clearSkids();
  drift.pts = 0; freeScore = 0;
  $('finish').hidden = true;
  if (mode === 'run') { route = makeRoute(); cpIdx = 0; runTime = 0; running = true; }
  else { route = []; running = false; }
  updateModeHud();
}
function updateModeHud() {
  $('arrow').hidden = mode !== 'run';
  cpGroup.visible = mode === 'run' && running;
  if (mode === 'run') { $('cpCount').textContent = `Checkpoint ${cpIdx} / ${route.length}`; }
  else { $('timer').textContent = Math.round(freeScore).toLocaleString(); $('cpCount').textContent = 'Drift score'; }
}
function respawn() {
  let best = null, bd = 1e9;
  for (const n of WORLD.nodes) { const d = Math.hypot(n[0] - car.x, n[1] - car.z); if (d < bd) { bd = d; best = n; } }
  if (!best) best = [WORLD.spawn.x, WORLD.spawn.z];
  placeCar(best[0], best[1], car.th); skidLast[0] = skidLast[1] = null;
  toast('Back on the road');
}
const fmtTime = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
let toastT = 0;
function toast(msg, secs) { const el = $('toast'); el.textContent = msg; el.hidden = false; toastT = secs || 2.2; }
function loadBest() { try { return parseFloat(localStorage.getItem('atlasdrive.best.' + bestKey)) || 0; } catch (e) { return 0; } }
function saveBest(t) { try { localStorage.setItem('atlasdrive.best.' + bestKey, String(t)); } catch (e) {} }
function finishRun() {
  running = false; cpGroup.visible = false; sfx('finish');
  const prev = loadBest(), isBest = !prev || runTime < prev;
  if (isBest) saveBest(runTime);
  $('finKicker').textContent = isBest ? 'New best time' : 'Run complete';
  $('finTime').textContent = fmtTime(runTime);
  $('finSub').textContent = `${route.length} checkpoints in ${WORLD.name}` + (prev && !isBest ? ` · Best ${fmtTime(prev)}` : '');
  $('finish').hidden = false;
}
$('againBtn').onclick = () => { mode = 'run'; startRun(); };
$('roamBtn').onclick = () => { mode = 'free'; $('finish').hidden = true; running = false; route = []; updateModeHud(); };

