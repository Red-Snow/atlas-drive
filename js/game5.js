/* ======================= Minimap ======================= */
const mini = $('mini'), mctx = mini.getContext('2d');
const MM = { c: document.createElement('canvas'), ext: 1, scale: 1 };
function prerenderMap(W) {
  const S = 1024; MM.c.width = MM.c.height = S; MM.ext = W.radius + 60; MM.scale = S / (2 * MM.ext);
  const x = MM.c.getContext('2d'), sc = MM.scale, T = p => [(p[0] + MM.ext) * sc, (p[1] + MM.ext) * sc];
  x.fillStyle = '#1b1f23'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#2f4a2a'; for (const p of W.parks) { x.beginPath(); p.forEach((q, i) => { const t = T(q); i ? x.lineTo(t[0], t[1]) : x.moveTo(t[0], t[1]); }); x.fill(); }
  x.strokeStyle = '#6c7178'; x.lineCap = x.lineJoin = 'round';
  for (const r of W.roads) { x.lineWidth = Math.max(1.5, r.w * sc); x.beginPath(); r.pts.forEach((q, i) => { const t = T(q); i ? x.lineTo(t[0], t[1]) : x.moveTo(t[0], t[1]); }); x.stroke(); }
  x.fillStyle = '#3c424a';
  for (const b of W.buildings) { if (b.y0) continue; x.beginPath(); b.pts.forEach((q, i) => { const t = T(q); i ? x.lineTo(t[0], t[1]) : x.moveTo(t[0], t[1]); }); x.closePath(); x.fill(); }
}
function drawMini() {
  const W = mini.width, H = mini.height, zoom = 1.2 / MM.scale * (W / 264);
  mctx.save(); mctx.clearRect(0, 0, W, H);
  mctx.beginPath(); mctx.arc(W / 2, H / 2, W / 2, 0, PI * 2); mctx.clip();
  mctx.fillStyle = '#1b1f23'; mctx.fillRect(0, 0, W, H);
  mctx.translate(W / 2, H / 2);
  const ang = -PI / 2 - Math.atan2(Math.cos(car.th), Math.sin(car.th));
  mctx.rotate(ang); mctx.scale(zoom, zoom);
  mctx.translate(-(car.x + MM.ext) * MM.scale, -(car.z + MM.ext) * MM.scale);
  mctx.drawImage(MM.c, 0, 0);
  if (mode === 'run' && running && route[cpIdx]) {
    const p = route[cpIdx]; mctx.fillStyle = '#ff8d24'; mctx.beginPath(); mctx.arc((p[0] + MM.ext) * MM.scale, (p[1] + MM.ext) * MM.scale, 9 / zoom, 0, PI * 2); mctx.fill();
  }
  mctx.restore();
  mctx.fillStyle = '#f4efe7'; mctx.strokeStyle = '#1a0e02'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(W / 2, H / 2 - 13); mctx.lineTo(W / 2 + 9, H / 2 + 10); mctx.lineTo(W / 2, H / 2 + 5); mctx.lineTo(W / 2 - 9, H / 2 + 10); mctx.closePath(); mctx.fill(); mctx.stroke();
}

/* ======================= Frame update ======================= */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let menuOrbit = 0, acc = 0, lastT = performance.now(), hudT = 0;
const GEARS = [0, 11, 21, 31, 42, 54, 99];
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const driving = state === 'drive' && $('finish').hidden;
  const inp = driving ? readInput() : { steer: 0, gas: 0, brake: state === 'drive' ? 1 : 0, hand: 0 };
  if (state === 'drive') {
    const target = inp.steer;
    car.steer += clamp(target - car.steer, -(target === 0 ? 6 : 4) * dt, (target === 0 ? 6 : 4) * dt);
    acc += dt;
    while (acc >= STEP) { step(STEP, inp); acc -= STEP; }
    gameplay(dt, inp);
  }
  updateCarVisual(dt, inp);
  updateCamera(dt);
  // sun & shadow follow car
  sun.target.position.set(car.x, 0, car.z);
  sun.position.set(car.x + SUN_DIR.x * 220, SUN_DIR.y * 220, car.z + SUN_DIR.z * 220);
  sky.position.copy(camera.position);
  beamMat.uniforms.t.value = now / 1000; ring.rotation.z += dt * 0.8;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').hidden = true; }
  if (state === 'drive') { hudT += dt; drawMini(); updateHud(inp); }
  renderer.render(scene, camera);
}
function gameplay(dt, inp) {
  const sp = Math.abs(car.vF);
  // drift scoring
  if (Math.abs(car.vL) > 3.2 && sp > 8) { drift.pts += Math.abs(car.vL) * sp * dt * 0.6; drift.t = 0.7; drift.show = 1; }
  else if (drift.t > 0) { drift.t -= dt; if (drift.t <= 0) { if (drift.pts > 30) { freeScore += drift.pts; if (mode === 'free') toast(`+${Math.round(drift.pts)} drift`, 1.2); } drift.pts = 0; drift.show = 0; } }
  if (mode === 'run' && running) {
    runTime += dt;
    const p = route[cpIdx];
    if (p) {
      cpGroup.position.set(p[0], 0, p[1]);
      if (Math.hypot(car.x - p[0], car.z - p[1]) < 8.5) {
        cpIdx++; sfx('cp');
        if (cpIdx >= route.length) finishRun(); else { toast(`Checkpoint ${cpIdx} · ${fmtTime(runTime)}`, 1.4); $('cpCount').textContent = `Checkpoint ${cpIdx} / ${route.length}`; }
      }
    }
  }
  // audio
  if (AC && eng) {
    const kmh = sp * 3.6; let g = 1; while (g < GEARS.length - 1 && sp > GEARS[g]) g++;
    const lo = GEARS[g - 1], hi = GEARS[g], rpm = 1000 + clamp((sp - lo) / (hi - lo), 0, 1) * 6400 * (kmh < 3 ? 0.1 : 1) + inp.gas * 600;
    car.rpm = rpm; car.gear = kmh < 1 ? 'N' : (car.vF < -0.3 ? 'R' : String(g));
    const t = AC.currentTime, f = rpm / 60 * 2;
    eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    eng.f.frequency.setTargetAtTime(300 + rpm * 0.22, t, 0.05);
    eng.g.gain.setTargetAtTime(muted ? 0 : 0.035 + inp.gas * 0.035, t, 0.08);
    eng.ng.gain.setTargetAtTime(muted ? 0 : clamp((Math.abs(car.vL) - 3) * 0.025, 0, 0.14), t, 0.06);
  }
}
const tmpV = new THREE.Vector3();
function updateCarVisual(dt, inp) {
  carRoot.position.set(car.x, 0, car.z);
  carRoot.rotation.y = car.th;
  carBody.rotation.z = clamp(-car.aLat * 0.009, -0.07, 0.07);
  carBody.rotation.x = clamp(-car.aLong * 0.0045, -0.05, 0.05);
  const delta = car.steer * 0.58 / (1 + Math.abs(car.vF) / 24);
  for (const w of wheels) { w.spin.rotation.x += car.vF / 0.36 * dt; if (w.front) w.g.rotation.y = -delta; }
  if (modelWheels) for (const w of modelWheels) { w.node.rotation.x -= car.vF / 0.34 * dt; w.node.rotation.y = w.front ? -delta : 0; }
  tailMat.emissiveIntensity = inp.brake && state === 'drive' ? 3.2 : 0.8;
  // smoke + skids from rear wheels
  const fx = Math.sin(car.th), fz = Math.cos(car.th), rx = -Math.cos(car.th), rz = Math.sin(car.th);
  const sliding = state === 'drive' && ((Math.abs(car.vL) > 2.6 && Math.abs(car.vF) > 4) || (inp.brake && car.vF > 14));
  [-1, 1].forEach((side, i) => {
    const wx = car.x + fx * -1.32 + rx * side * 0.86, wz = car.z + fz * -1.32 + rz * side * 0.86;
    if (sliding) { if (skidLast[i]) skidQuad(skidLast[i], [wx, wz]); skidLast[i] = [wx, wz]; } else skidLast[i] = null;
  });
  smokeTimer -= dt;
  if (Math.abs(car.vL) > 4.5 && Math.abs(car.vF) > 5 && smokeTimer <= 0 && state === 'drive') {
    smokeTimer = 0.035;
    for (const side of [-1, 1]) puff(car.x - fx * 1.4 + rx * side * 0.86, car.z - fz * 1.4 + rz * side * 0.86);
  }
  for (const p of smoke) {
    if (p.life <= 0) continue;
    p.life -= dt * 0.9;
    if (p.life <= 0) { p.s.visible = false; continue; }
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    const k = 1 - p.life; p.s.scale.setScalar(1.2 + k * 5); p.s.material.opacity = 0.42 * p.life;
  }
}
function updateCamera(dt) {
  const fx = Math.sin(car.th), fz = Math.cos(car.th);
  if (state === 'menu') {
    menuOrbit += dt * 0.12;
    const r = 11;
    camera.position.set(car.x + Math.sin(menuOrbit) * r, 3.2, car.z + Math.cos(menuOrbit) * r);
    camera.lookAt(car.x, 0.9, car.z);
    camera.fov = 50; camera.updateProjectionMatrix();
    return;
  }
  const sp = Math.abs(car.vF);
  // blend heading with travel direction for a cinematic drift camera
  let dx = fx, dz = fz;
  const v = Math.hypot(car.vx, car.vz);
  if (v > 3 && car.vF > 0) { dx = fx * 0.65 + car.vx / v * 0.35; dz = fz * 0.65 + car.vz / v * 0.35; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
  const dist = 6.6 + sp * 0.03, h = 2.3 + sp * 0.008;
  tmpV.set(car.x - dx * dist, h, car.z - dz * dist);
  camPos.lerp(tmpV, 1 - Math.exp(-7 * dt));
  camLook.set(car.x + dx * 4, 1.0, car.z + dz * 4);
  camera.position.copy(camPos);
  if (impactShake > 0) { camera.position.x += (Math.random() - 0.5) * impactShake * 0.5; camera.position.y += (Math.random() - 0.5) * impactShake * 0.3; impactShake = Math.max(0, impactShake - dt * 2.5); }
  if (sp > 40) camera.position.y += (Math.random() - 0.5) * 0.02 * (sp - 40) / 30;
  camera.lookAt(camLook);
  const fov = 60 + clamp(sp / 65, 0, 1) * 16;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, 4 * dt); camera.updateProjectionMatrix(); }
}
function updateHud(inp) {
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
}

/* ======================= Time of day ======================= */
function setNight(on) {
  night = on;
  const u = sky.material.uniforms;
  u.top.value.set(on ? 0x04060d : 0x2f62ad); u.hz.value.set(on ? 0x1a2132 : 0xf2c193);
  u.sun.value = on ? new THREE.Vector3(0, -1, 0) : SUN_DIR;
  scene.environment = on ? ENV.night : ENV.day;
  scene.fog.color.copy(on ? C(0x111725) : C(0xd9b596)); scene.fog.near = on ? 40 : 160; scene.fog.far = on ? 620 : 950;
  sun.intensity = on ? 0.35 : 2.3; sun.color.copy(on ? C(0x8fa8d8) : C(0xffd2a6));
  hemi.intensity = on ? 0.12 : 0.55;
  renderer.toneMappingExposure = on ? 1.25 : 1.05;
  for (const m of [wallMat, towerMat, brickMat]) m.emissive.setRGB(on ? 1 : 0, on ? 1 : 0, on ? 1 : 0);
  roadMat.roughness = on ? 0.45 : 0.82; roadMat.envMapIntensity = on ? 0.9 : 0.3;
  headL.forEach(h => { h.intensity = on ? 2.6 : 0; });
  headMat.emissiveIntensity = on ? 4 : 2.2;
  if (nightGroup) nightGroup.visible = on;
}

/* ======================= Sizing & quality ======================= */
function resize() {
  const pr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
function setQuality(q) {
  quality = q;
  const size = q === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resize();
}
addEventListener('resize', resize);

/* ======================= Menu wiring ======================= */
let selected = PLACES[0];
const placesEl = $('places');
function renderPlaces(extra) {
  placesEl.innerHTML = '';
  const list = extra ? [extra, ...PLACES] : PLACES;
  for (const p of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'place' + (p.gen ? ' gen' : '') + (p === selected ? ' on' : '');
    b.innerHTML = `<b></b><small></small>`;
    b.querySelector('b').textContent = p.name;
    b.querySelector('small').textContent = p.gen ? p.sub : `${p.sub} · ${fmtCoord(p.lat, p.lon)}`;
    b.onclick = () => { selected = p; renderPlaces(extra); setStatus(''); };
    placesEl.appendChild(b);
  }
}
let customPlace = null;
renderPlaces();
const swEl = $('swatches');
PAINTS.forEach((hex, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (i === 0 ? ' on' : ''); b.style.background = hex; b.setAttribute('aria-label', 'Paint ' + (i + 1));
  b.onclick = () => { paintMat.color.copy(C(hex)); swEl.querySelectorAll('.sw').forEach(s => s.classList.remove('on')); b.classList.add('on'); };
  swEl.appendChild(b);
});
function segWire(id, attr, cb) {
  const el = $(id);
  el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cb(b.dataset[attr]); });
}
segWire('modeSeg', 'mode', v => { mode = v; });
segWire('qualSeg', 'q', v => setQuality(v));
segWire('timeSeg', 't', v => setNight(v === 'night'));
function setStatus(msg, warn) { const s = $('status'); s.textContent = msg; s.classList.toggle('warn', !!warn); }
const BLOCKED_MSG = 'Could not reach the map server. Check your connection and try again. Loaded the generated city for now.';

$('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('searchInput').value.trim(); if (!q) return;
  setStatus(`Searching for “${q}”…`);
  try {
    const g = await geocode(q);
    if (!g) { setStatus(`No place found for “${q}”. Try a landmark or street name.`, true); return; }
    customPlace = { id: 'c' + Date.now(), name: g.label.split(',')[0], sub: g.label.split(',')[1] ? g.label.split(',')[1].trim() : 'Search result', lat: g.lat, lon: g.lon };
    selected = customPlace; renderPlaces(customPlace); setStatus(`Found ${g.label}. Tap Drive.`);
  } catch (err) { setStatus('Place search is not responding. Check your connection, or pick one of the cities above.', true); }
});

$('locBtn').onclick = () => {
  if (!navigator.geolocation) { setStatus('This browser cannot share your location.', true); return; }
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    customPlace = { id: 'me' + lat.toFixed(4) + lon.toFixed(4), name: 'My street', sub: 'Your location', lat, lon };
    selected = customPlace; renderPlaces(customPlace); setStatus('Got it. Tap Drive to race around your own neighbourhood.');
  }, err => {
    setStatus(err.code === 1 ? 'Location permission was declined. Search for your area by name instead.' : 'Could not get your location. Search for your area by name instead.', true);
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
};
let loadedId = 'gen', busy = false;
$('driveBtn').onclick = async () => {
  if (busy) return;
  initAudio();
  if (selected.id !== loadedId) {
    busy = true; $('driveBtn').disabled = true;
    if (selected.gen) { buildWorld(generatedCity(7)); loadedId = 'gen'; bestKey = 'gen'; }
    else {
      setStatus(`Downloading streets and buildings around ${selected.name}…`);
      try {
        const data = await fetchOSM(selected.lat, selected.lon);
        setStatus(`Building ${selected.name}…`);
        await new Promise(r => setTimeout(r, 30));
        const W = worldFromOSM(data, selected.lat, selected.lon, selected.name);
        if (W.roads.length < 3) throw new Error('No roads in this area');
        buildWorld(W); loadedId = selected.id; bestKey = selected.id;
        setStatus(`${W.buildings.length.toLocaleString()} buildings and ${W.roads.length.toLocaleString()} streets loaded.`);
      } catch (err) {
        const blocked = err && (err.name === 'TypeError' || /fetch|network/i.test(String(err.message)));
        if (loadedId !== 'gen') { buildWorld(generatedCity(7)); loadedId = 'gen'; bestKey = 'gen'; }
        selected = PLACES[0]; renderPlaces(customPlace);
        setStatus(blocked ? BLOCKED_MSG : `The map server didn't answer (${err && err.message ? err.message : 'timeout'}). Loaded the generated city; try again in a minute.`, true);
        busy = false; $('driveBtn').disabled = false;
        return;
      }
    }
    busy = false; $('driveBtn').disabled = false;
  }
  enterDrive();
};
function enterDrive() {
  state = 'drive';
  $('menu').hidden = true; $('hud').hidden = false; $('controls').hidden = !isTouch;
  camPos.set(car.x - Math.sin(car.th) * 8, 3, car.z - Math.cos(car.th) * 8);
  startRun();
  if (AC && AC.state === 'suspended') AC.resume();
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
}
$('menuBtn').onclick = () => {
  state = 'menu'; $('menu').hidden = false; $('hud').hidden = true; $('controls').hidden = true; cpGroup.visible = false;
  if (eng) { eng.g.gain.value = 0; eng.ng.gain.value = 0; }
  for (const k in touch) touch[k] = 0;
};
$('respawnBtn').onclick = () => respawn();
$('muteBtn').onclick = () => { muted = !muted; $('muteBtn').textContent = muted ? 'Sound off' : 'Sound on'; if (eng && muted) { eng.g.gain.value = 0; eng.ng.gain.value = 0; } };

/* ======================= Boot ======================= */
loadCarModel();
buildWorld(generatedCity(7));
placeCar(WORLD.spawn.x, WORLD.spawn.z, WORLD.spawn.th);
resize();
requestAnimationFrame(t => { lastT = t; frame(t); });
