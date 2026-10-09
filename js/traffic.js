// Atlas Drive: road graph and AI traffic that keeps to the local side of the road
const Graph = { adj: new Map() };
const nodeKey = (x, z) => Math.round(x * 10) + ',' + Math.round(z * 10);
function makeEdge(a, b, ha, hb, r, tile) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 0.01;
  return { a: nodeKey(a[0], a[1]), b: nodeKey(b[0], b[1]), ax: a[0], az: a[1], bx: b[0], bz: b[1], ha, hb, len, dx: dx / len, dz: dz / len,
    hw: r.w / 2, speed: r.speed || 11, oneway: r.oneway !== 0, lanes: r.lanes || (r.w >= 12 ? 4 : 2), tile, dead: false };
}
function registerEdge(e) { let l = Graph.adj.get(e.a); if (!l) Graph.adj.set(e.a, l = []); l.push(e); }
function unregisterEdge(e) {
  e.dead = true; const l = Graph.adj.get(e.a); if (!l) return;
  const i = l.indexOf(e); if (i >= 0) l.splice(i, 1); if (!l.length) Graph.adj.delete(e.a);
}
function clearGraph() { Graph.adj.clear(); }

const Traffic = { cars: [], target: 0, spawnT: 0, lht: false };
function laneOffset(e, car) {
  if (e.oneway) return clamp(car.laneBias * (e.hw - 1.7), -(e.hw - 1.6), e.hw - 1.6);
  const lanesEach = Math.max(1, Math.floor(e.lanes / 2));
  const lane = Math.min(lanesEach - 1, car.lane);
  const off = clamp((lane + 0.5) * (e.hw / lanesEach), 1.4, e.hw - 1.2);
  return Traffic.lht ? -off : off;
}
function nextEdge(e, r) {
  const list = (Graph.adj.get(e.b) || []).filter(n => !n.dead && n.b !== e.a);
  if (!list.length) return null;
  let tot = 0; const w = list.map(n => { const v = 0.4 + Math.max(0, e.dx * n.dx + e.dz * n.dz) * 2.5; tot += v; return v; });
  let x = r() * tot; for (let i = 0; i < list.length; i++) { if ((x -= w[i]) < 0) return list[i]; }
  return list[0];
}
function spawnTraffic(px, pz, r) {
  // pick a random edge 90-320 m from the player
  const tiles = []; allTiles(t => { if (t.edges.length) tiles.push(t); });
  if (!tiles.length) return;
  for (let tries = 0; tries < 12; tries++) {
    const t = tiles[(r() * tiles.length) | 0], e = t.edges[(r() * t.edges.length) | 0];
    if (!e || e.dead || e.len < 6) continue;
    const s = r() * e.len, x = e.ax + e.dx * s, z = e.az + e.dz * s, d = Math.hypot(x - px, z - pz);
    if (d < 90 || d > 320) continue;
    if (Traffic.cars.some(c => Math.hypot(c.x - x, c.z - z) < 14)) continue;
    const type = pickTrafficType(r), hex = type === 'taxi' ? (Traffic.lht ? '#1d1f22' : '#f2c21b') : type === 'bus' ? ['#c8372d', '#1f5fa8', '#e6e2d8'][(r() * 3) | 0] : TRAFFIC_COLORS[(r() * TRAFFIC_COLORS.length) | 0];
    const v = makeVehicle(type, hex, {});
    const car = { v, e, s, sp: e.speed * 0.8, vmax: (type === 'bus' || type === 'truck' ? 0.75 : 0.85 + r() * 0.25), lane: r() < 0.6 ? 0 : 1, laneBias: r() * 2 - 1,
      x, z, y: e.ha, yaw: Math.atan2(e.dx, e.dz), lat: 0, len: v.spec.len, gy: null, gyT: 0, stop: 0 };
    car.lat = laneOffset(e, car);
    scene.add(v.root); Traffic.cars.push(car);
    return;
  }
}
function removeTraffic(car) { scene.remove(car.v.root); car.v.root.traverse(o => { if (o.isMesh && o.material === blobMat) {} }); }
function clearTraffic() { Traffic.cars.forEach(removeTraffic); Traffic.cars = []; }
function updateTraffic(dt, player, r) {
  // keep the requested number of cars around the player
  Traffic.spawnT -= dt;
  if (Traffic.cars.length < Traffic.target && Traffic.spawnT <= 0) { Traffic.spawnT = 0.35; spawnTraffic(player.x, player.z, r); }
  const others = Traffic.cars;
  for (let k = others.length - 1; k >= 0; k--) {
    const c = others[k];
    if (c.e.dead || Math.hypot(c.x - player.x, c.z - player.z) > 420 || Traffic.cars.length > Traffic.target + 2) { removeTraffic(c); others.splice(k, 1); continue; }
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    // car-following: nearest vehicle ahead in roughly the same lane
    let gap = 99;
    const check = (ox, oz, oy, olen) => {
      const rx = ox - c.x, rz = oz - c.z, ahead = rx * fx + rz * fz, side = -rx * fz + rz * fx;
      if (ahead > 0 && ahead < 34 && Math.abs(side) < 2.3 && Math.abs(oy - c.y) < 3) gap = Math.min(gap, ahead - (c.len + olen) / 2);
    };
    for (const o of others) if (o !== c) check(o.x, o.z, o.y, o.len);
    check(player.x, player.z, player.y, 4.6);
    let vt = c.e.speed * c.vmax;
    // slow down before sharp turns
    const remain = c.e.len - c.s;
    if (remain < 22 && c.next === undefined) c.next = nextEdge(c.e, r);
    if (c.next) { const turn = 1 - (c.e.dx * c.next.dx + c.e.dz * c.next.dz); if (remain < 22) vt = Math.min(vt, 4 + (1 - clamp(turn, 0, 1)) * 12 + remain * 0.4); }
    vt = Math.min(vt, Math.max(0, (gap - 2.5) * 0.9));
    if (c.stop > 0) { c.stop -= dt; vt = 0; }
    c.sp += clamp(vt - c.sp, -8 * dt, 2.6 * dt); if (c.sp < 0) c.sp = 0;
    c.s += c.sp * dt;
    while (c.s > c.e.len) {
      const n = c.next !== undefined ? c.next : nextEdge(c.e, r); c.next = undefined;
      if (!n) { c.s = c.e.len; c.sp = 0; c.deadEnd = (c.deadEnd || 0) + dt; break; }
      c.s -= c.e.len; c.e = n;
    }
    if (c.deadEnd > 3) { removeTraffic(c); others.splice(k, 1); continue; }
    const e = c.e, latT = laneOffset(e, c);
    c.lat += (latT - c.lat) * Math.min(1, 2 * dt);
    const rx = -e.dz, rz = e.dx; // right-hand vector of the travel direction
    c.x = e.ax + e.dx * c.s + rx * c.lat; c.z = e.az + e.dz * c.s + rz * c.lat;
    let y = e.ha + (e.hb - e.ha) * (c.s / e.len);
    if (G.active) { c.gyT -= dt; if (c.gyT <= 0) { c.gyT = 0.4; const gy = googleGround(c.x, c.z, (c.gy == null ? y : c.gy) + 2); if (gy != null) c.gy = gy; } if (c.gy != null) y = c.gy; }
    c.y += (y - c.y) * Math.min(1, 10 * dt);
    let dyaw = Math.atan2(e.dx, e.dz) - c.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    c.yaw += dyaw * Math.min(1, 5 * dt);
    c.v.root.position.set(c.x, c.y, c.z); c.v.root.rotation.y = c.yaw;
    for (const w of c.v.wheels) w.spin.rotation.x += c.sp / c.v.spec.r * dt;
  }
}
