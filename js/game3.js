/* ======================= Effects: smoke & skid marks ======================= */
const smoke = [];
for (let i = 0; i < 46; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
  s.visible = false; scene.add(s); smoke.push({ s, life: 0, vx: 0, vy: 0, vz: 0 });
}
let smokeIdx = 0, smokeTimer = 0;
function puff(x, z) {
  const p = smoke[smokeIdx++ % smoke.length];
  p.life = 1; p.s.visible = true; p.s.position.set(x, 0.4, z);
  p.vx = (Math.random() - 0.5) * 1.5; p.vy = 0.8 + Math.random() * 0.8; p.vz = (Math.random() - 0.5) * 1.5;
}
const SKID_N = 1400;
const skidPos = new Float32Array(SKID_N * 18);
const skidGeo = new THREE.BufferGeometry(); skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3));
const skidMesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
skidMesh.frustumCulled = false; skidMesh.renderOrder = 3; scene.add(skidMesh);
let skidIdx = 0; const skidLast = [null, null];
function skidQuad(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 0.05 || l > 4) return;
  const px = -dz / l * 0.14, pz = dx / l * 0.14, y = 0.045, o = (skidIdx++ % SKID_N) * 18;
  const v = [a[0] + px, y, a[1] + pz, a[0] - px, y, a[1] - pz, b[0] - px, y, b[1] - pz, a[0] + px, y, a[1] + pz, b[0] - px, y, b[1] - pz, b[0] + px, y, b[1] + pz];
  skidPos.set(v, o); skidGeo.attributes.position.needsUpdate = true;
}
function clearSkids() { skidPos.fill(0); skidGeo.attributes.position.needsUpdate = true; skidLast[0] = skidLast[1] = null; }

/* ======================= Checkpoints ======================= */
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  uniforms: { col: { value: new THREE.Color(0xff8d24) }, t: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 col; uniform float t; varying vec2 vUv; void main(){ float a = pow(max(1.0 - vUv.y, 0.0001), 2.2) * (0.55 + 0.15 * sin(t * 4.0 + vUv.y * 20.0)); gl_FragColor = vec4(col * a, a); }'
});
const cpGroup = new THREE.Group();
const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 70, 40, 1, true).translate(0, 35, 0), beamMat);
const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.22, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffb060 }));
ring.rotation.x = PI / 2; ring.position.y = 0.3;
cpGroup.add(beam, ring); cpGroup.visible = false; scene.add(cpGroup);

/* ======================= Input ======================= */
const touch = { left: 0, right: 0, gas: 0, brake: 0, hand: 0 };
const keys = {};
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = 1;
  if (e.code === 'KeyR' && state === 'drive') respawn();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = 0; });
function bindBtn(id, k) {
  const el = $(id);
  const on = e => { e.preventDefault(); touch[k] = 1; el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { touch[k] = 0; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, off));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindBtn('cLeft', 'left'); bindBtn('cRight', 'right'); bindBtn('cGas', 'gas'); bindBtn('cBrake', 'brake'); bindBtn('cHand', 'hand');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function readInput() {
  const k = c => keys[c] ? 1 : 0;
  return {
    steer: Math.max(touch.right, k('ArrowRight'), k('KeyD')) - Math.max(touch.left, k('ArrowLeft'), k('KeyA')),
    gas: Math.max(touch.gas, k('ArrowUp'), k('KeyW')),
    brake: Math.max(touch.brake, k('ArrowDown'), k('KeyS')),
    hand: Math.max(touch.hand, k('Space')),
  };
}

/* ======================= Audio ======================= */
let AC = null, eng = null, muted = false;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    const g = AC.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(AC.destination); o1.start(); o2.start();
    const buf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = AC.createBufferSource(); n.buffer = buf; n.loop = true;
    const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1700; nf.Q.value = 0.9;
    const ng = AC.createGain(); ng.gain.value = 0; n.connect(nf); nf.connect(ng); ng.connect(AC.destination); n.start();
    eng = { o1, o2, f, g, ng, buf };
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

