// Atlas Drive: optional Google Photorealistic 3D Tiles (needs the player's own Map Tiles API key)
const G = { active: false, tiles: null, wrap: null, key: '', calibrated: false, credits: new Map(), ray: new THREE.Raycaster(), startT: 0, failed: false, visible: 0 };
G.ray.firstHitOnly = true;
try { G.key = localStorage.getItem('atlasdrive.gkey') || ''; } catch (e) {}
function googleAvailable() { return !!(window.Tiles3D && Tiles3D.TilesRenderer); }
function googleStart(lat, lon) {
  googleStop();
  if (!googleAvailable() || !G.key) return false;
  const { TilesRenderer, WGS84_ELLIPSOID } = Tiles3D, key = G.key;
  const t = new TilesRenderer(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`);
  t.fetchOptions.mode = 'cors';
  t.parseQueue.maxJobs = 6; t.downloadQueue.maxJobs = 16;
  t.lruCache.minSize = 700; t.lruCache.maxSize = 1400;
  t.errorTarget = quality === 'high' ? 18 : 36;
  const onRoot = () => {
    let session = null;
    t.traverse(tile => { if (tile.content && tile.content.uri) { session = new URL(tile.content.uri).searchParams.get('session'); return true; } return false; });
    t.preprocessURL = uri => {
      const u = new URL(uri);
      if (/^http/.test(u.protocol)) { if (session && !u.searchParams.has('session')) u.searchParams.append('session', session); if (!u.searchParams.has('key')) u.searchParams.append('key', key); }
      return u.toString();
    };
    t.removeEventListener('load-tile-set', onRoot);
  };
  t.addEventListener('load-tile-set', onRoot);
  t.addEventListener('load-model', e => e.scene.traverse(o => {
    if (o.material) { o.material.toneMapped = false; o.material.fog = false; if (night) o.material.color.setScalar(0.32); }
    o.castShadow = false; o.receiveShadow = false;
  }));
  t.addEventListener('tile-visibility-change', e => {
    const md = e.tile.cached && e.tile.cached.metadata, cr = md && md.asset && md.asset.copyright;
    G.visible += e.visible ? 1 : -1;
    if (!cr) return;
    for (const part of cr.split(';').map(s => s.trim()).filter(Boolean)) {
      const n = (G.credits.get(part) || 0) + (e.visible ? 1 : -1);
      if (n > 0) G.credits.set(part, n); else G.credits.delete(part);
    }
  });
  // place the globe so the chosen lat/lon is our origin: x east, y up, z south
  const F = new THREE.Matrix4();
  WGS84_ELLIPSOID.constructLatLonFrame(lat * PI / 180, lon * PI / 180, F);
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0));
  F.multiply(M).invert().decompose(t.group.position, t.group.quaternion, t.group.scale);
  const wrap = new THREE.Group(); wrap.add(t.group); scene.add(wrap);
  t.setCamera(camera); t.setResolutionFromRenderer(camera, renderer);
  Object.assign(G, { tiles: t, wrap, active: true, calibrated: false, startT: performance.now(), failed: false, visible: 0 });
  G.credits.clear();
  return true;
}
function googleStop() {
  if (G.tiles) { scene.remove(G.wrap); try { G.tiles.dispose(); } catch (e) {} }
  Object.assign(G, { tiles: null, wrap: null, active: false, calibrated: false });
}
// first hit straight down from (x, yFrom, z) against the photoreal mesh
function googleGround(x, z, yFrom) {
  if (!G.tiles || !G.calibrated) return null;
  G.ray.set(new THREE.Vector3(x, yFrom, z), new THREE.Vector3(0, -1, 0)); G.ray.far = 40;
  const hit = G.ray.intersectObject(G.tiles.group, true)[0];
  return hit ? hit.point.y : null;
}
let gCalT = 0;
function googleUpdate(dt, carX, carZ) {
  if (!G.active) return;
  camera.updateMatrixWorld();
  G.tiles.update();
  if (!G.calibrated) {
    gCalT -= dt; if (gCalT > 0) return; gCalT = 0.5;
    // align the photoreal ground with our street level at the car
    G.ray.set(new THREE.Vector3(carX, 4000, carZ), new THREE.Vector3(0, -1, 0)); G.ray.far = 9000;
    G.wrap.updateMatrixWorld(true);
    const hit = G.ray.intersectObject(G.tiles.group, true)[0];
    if (hit) { G.wrap.position.y -= hit.point.y; G.wrap.updateMatrixWorld(true); G.calibrated = true; onGoogleReady(); }
    else if (!G.failed && performance.now() - G.startT > 20000) { G.failed = true; onGoogleFail(); }
  }
}
function googleCredits() {
  const parts = [...G.credits.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  return 'Google Maps' + (parts.length ? ' · ' + parts.join('; ') : '');
}
function googleSetNight(on) {
  if (!G.tiles) return;
  G.tiles.group.traverse(o => { if (o.material && o.material.color) o.material.color.setScalar(on ? 0.32 : 1); });
}
