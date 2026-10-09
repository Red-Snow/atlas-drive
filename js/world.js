// Atlas Drive: map data, tile building, flyovers/underpasses, labels, streaming
const TILE = 320;
const ROAD_W = { motorway: 15, trunk: 13, primary: 12, secondary: 10.5, tertiary: 9, unclassified: 7.5, residential: 7, living_street: 6, service: 5,
  motorway_link: 7.5, trunk_link: 7.5, primary_link: 7.5, secondary_link: 7, tertiary_link: 7 };
const ROAD_SPEED = { motorway: 27, trunk: 22, primary: 16, secondary: 14, tertiary: 12, unclassified: 10, residential: 9, living_street: 5, service: 6,
  motorway_link: 14, trunk_link: 13, primary_link: 12, secondary_link: 11, tertiary_link: 10 };
const LANDMARK_TAGS = /^(place_of_worship|townhall|university|hospital|museum|stadium|palace|castle|monument|memorial|attraction|cathedral|mosque|church|temple|fort|gallery|theatre|library|courthouse|parliament|embassy)$/;
const POI_KEYS = ['tourism', 'historic', 'amenity', 'leisure', 'shop'];
const POI_COLOR = { tourism: '#ffb347', historic: '#ffb347', amenity: '#5ab4ff', leisure: '#46d98a', shop: '#ff7aa8' };

const World = {
  mode: null, tiles: new Map(), gen: null, origin: null, kx: 1, kz: 1, name: '',
  queue: [], busy: false, scanT: 0, backoff: 0, radius: Infinity, failMsg: null, pending: 0,
};

/* ---------- Coordinates ---------- */
function setOrigin(lat, lon) {
  World.origin = { lat, lon };
  World.kx = 111320 * Math.cos(lat * PI / 180); World.kz = 110540;
}
const llToWorld = (lat, lon) => [(lon - World.origin.lon) * World.kx, -(lat - World.origin.lat) * World.kz];
const worldToLL = (x, z) => [World.origin.lat - z / World.kz, World.origin.lon + x / World.kx];
const tileIJ = (x, z) => [Math.floor(x / TILE), Math.floor(z / TILE)];
const tkey = (i, j) => i + ',' + j;

/* ---------- Height profiles for flyovers and underpasses ---------- */
function profile(pts, H, fullStart, fullEnd) {
  const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1], R = Math.min(85, L * 0.42);
  return { hs: d.map(s => H * Math.min(fullStart ? 1 : smooth(0, R, s), fullEnd ? 1 : smooth(0, R, L - s))), ds: d, L };
}
function roadStyle(cls, w, oneway, lanes) {
  if (cls === 'service' || cls === 'living_street') return 'lane';
  if (oneway) return lanes >= 3 || w >= 11 ? 'multi' : 'oneway';
  if ((lanes || 0) >= 4 || w >= 12) return 'multi';
  return 'two';
}

/* ---------- OpenStreetMap: fetch + parse ---------- */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
let overpassIdx = 0;
function bboxStr(b) { return `${b.s.toFixed(6)},${b.w.toFixed(6)},${b.n.toFixed(6)},${b.e.toFixed(6)}`; }
function areaBBox(x0, z0, x1, z1) { const [n, w] = worldToLL(x0, z0), [s, e] = worldToLL(x1, z1); return { s, w, n, e }; }
async function fetchOSMArea(x0, z0, x1, z1) {
  const bb = bboxStr(areaBBox(x0, z0, x1, z1)), big = bboxStr(areaBBox(x0 - 160, z0 - 160, x1 + 160, z1 + 160));
  const hw = '["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]';
  const q = `[out:json][timeout:30];(way${hw}(${bb});way${hw}["bridge"](${big});way${hw}["tunnel"](${big});` +
    `way["building"](${bb});way["leisure"~"^(park|garden|pitch|playground)$"](${bb});way["landuse"~"^(grass|park|recreation_ground|forest|meadow|village_green)$"](${bb});` +
    `way["natural"~"^(water|wood)$"](${bb});node["natural"="tree"](${bb});node["name"]["amenity"](${bb});node["name"]["tourism"](${bb});node["name"]["historic"](${bb});node["name"]["shop"](${bb}););out geom;`;
  let last;
  for (let k = 0; k < OVERPASS.length; k++) {
    const ep = OVERPASS[(overpassIdx + k) % OVERPASS.length];
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 40000);
    try {
      const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      clearTimeout(tm);
      if (res.status === 429 || res.status === 504) throw Object.assign(new Error('busy ' + res.status), { busy: true });
      if (!res.ok) throw new Error('Map server answered ' + res.status);
      const j = await res.json();
      overpassIdx = (overpassIdx + k) % OVERPASS.length;
      return j;
    } catch (e) { clearTimeout(tm); last = e; }
  }
  throw last;
}
function osmToFeatures(data, x0, z0, x1, z1) {
  const P = g => llToWorld(g.lat, g.lon);
  const out = { roads: [], buildings: [], areas: [], trees: [], pois: [] };
  const inside = p => p[0] >= x0 - 160 && p[0] <= x1 + 160 && p[1] >= z0 - 160 && p[1] <= z1 + 160;
  const ends = new Map(); const raised = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    if (el.type === 'node') {
      const p = P(el);
      if (t.natural === 'tree') { out.trees.push([p[0], p[1], 0.8 + (el.id % 7) / 12]); continue; }
      if (!t.name) continue;
      const cat = POI_KEYS.find(k => t[k]);
      if (!cat) continue;
      const lm = LANDMARK_TAGS.test(t[cat]) || !!t.wikidata;
      out.pois.push({ x: p[0], z: p[1], name: t.name, cat, landmark: lm, rank: (lm ? 0 : cat === 'shop' ? 2 : 1) });
      continue;
    }
    if (el.type !== 'way' || !el.geometry) continue;
    const pts = el.geometry.map(P);
    if (t.highway && ROAD_W[t.highway]) {
      if (t.area === 'yes' || pts.length < 2) continue;
      const lanes = parseInt(t.lanes, 10) || 0;
      let w = ROAD_W[t.highway]; if (lanes > 0) w = Math.max(w * 0.8, Math.min(lanes * 3.3, 24));
      const oneway = t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout' || /motorway/.test(t.highway) ? 1 : t.oneway === '-1' ? -1 : 0;
      const layer = parseInt(t.layer, 10) || 0;
      let kind = 'ground';
      if (t.bridge && t.bridge !== 'no') kind = 'bridge';
      else if (t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage') kind = 'trench';
      else if (t.cutting === 'yes' && layer < 0) kind = 'trench';
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (kind !== 'ground' && len < 55 && Math.abs(layer) < 2) kind = 'ground';
      const ms = parseFloat(t.maxspeed);
      const r = { id: el.id, pts, kind, w, cls: t.highway, name: t.name || t.ref || '', oneway, lanes, layer,
        speed: ms > 5 ? ms / 3.6 * 0.9 : ROAD_SPEED[t.highway], tex: roadStyle(t.highway, w, oneway, lanes) };
      out.roads.push(r);
      if (kind !== 'ground') {
        raised.push(r);
        for (const p of [pts[0], pts[pts.length - 1]]) { const k = kind + Math.round(p[0] * 5) + ',' + Math.round(p[1] * 5); ends.set(k, (ends.get(k) || 0) + 1); }
      }
      continue;
    }
    const f = pts[0], l = pts[pts.length - 1];
    if (pts.length > 1 && Math.abs(f[0] - l[0]) < 0.01 && Math.abs(f[1] - l[1]) < 0.01) pts.pop();
    if (pts.length < 3) continue;
    if (t.building && t.building !== 'roof') {
      if (Math.abs(polyArea(pts)) < 6) continue;
      const r = rng(el.id % 2147483647);
      let h = parseFloat(t.height) || (parseFloat(t['building:levels']) * 3.3 + 1.5) || (6 + r() * 11);
      h = clamp(h, 3, 460);
      let y0 = parseFloat(t.min_height) || (parseFloat(t['building:min_level']) * 3.3) || 0; if (y0 >= h - 1) y0 = 0;
      const name = t.name || '';
      const lm = !!name && (LANDMARK_TAGS.test(t.amenity || '') || LANDMARK_TAGS.test(t.tourism || '') || LANDMARK_TAGS.test(t.building || '') || !!t.historic || !!t.wikidata);
      out.buildings.push({ id: el.id, pts, h, y0, name, landmark: lm,
        col: parseColour(t['building:colour']) || WALL_COLS[(r() * WALL_COLS.length) | 0],
        rc: parseColour(t['roof:colour']) || ROOF_COLS[(r() * ROOF_COLS.length) | 0], style: r(), tinted: !!t['building:colour'] });
      continue;
    }
    let type = null;
    if (t.natural === 'water') type = 'water';
    else if (t.natural === 'wood' || t.landuse === 'forest') type = 'forest';
    else if (t.leisure || t.landuse) type = 'park';
    if (type) out.areas.push({ pts, type, name: t.name || '' });
  }
  // flyover and underpass height profiles
  for (const r of raised) {
    const H = r.kind === 'bridge' ? Math.max(1, r.layer || 1) * 6.5 : -Math.max(1, -(r.layer || -1)) * 6;
    const full = p => { const k = r.kind + Math.round(p[0] * 5) + ',' + Math.round(p[1] * 5); return (ends.get(k) || 0) > 1 || !inside(p); };
    const pr = profile(r.pts, H, full(r.pts[0]), full(r.pts[r.pts.length - 1]));
    r.hs = pr.hs; r.ds = pr.ds; r.L = pr.L;
  }
  for (const r of out.roads) if (!r.ds) { const pr = profile(r.pts, 0, true, true); r.ds = pr.ds; r.L = pr.L; r.hs = null; }
  return out;
}
// Split features into per-tile sources by position (roads by segment midpoint)
function distribute(feat, keys) {
  const src = new Map(); keys.forEach(k => src.set(k, { roads: [], buildings: [], areas: [], trees: [], pois: [] }));
  const at = (x, z) => src.get(tkey(Math.floor(x / TILE), Math.floor(z / TILE)));
  for (const r of feat.roads) {
    let run = null, runKey = null;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], k = tkey(Math.floor((a[0] + b[0]) / 2 / TILE), Math.floor((a[1] + b[1]) / 2 / TILE));
      if (k !== runKey) {
        if (run && src.get(runKey)) src.get(runKey).roads.push(run);
        runKey = k; run = Object.assign({}, r, { pts: [a], hs: r.hs ? [r.hs[i]] : null, ds: [r.ds[i]] });
      }
      run.pts.push(b); if (run.hs) run.hs.push(r.hs[i + 1]); run.ds.push(r.ds[i + 1]);
    }
    if (run && src.get(runKey)) src.get(runKey).roads.push(run);
  }
  for (const b of feat.buildings) { const c = polyCentroid(b.pts), s = at(c[0], c[1]); if (s) s.buildings.push(b); }
  for (const a of feat.areas) { const c = polyCentroid(a.pts), s = at(c[0], c[1]); if (s) s.areas.push(a); }
  for (const t of feat.trees) { const s = at(t[0], t[1]); if (s) s.trees.push(t); }
  for (const p of feat.pois) { const s = at(p.x, p.z); if (s) s.pois.push(p); }
  return src;
}

/* ---------- Generated demo city (with a flyover and an underpass) ---------- */
function generatedCity(seed) {
  const r = rng(seed || 7), S = 72, N = 5, E = S * N + 36;
  const out = { roads: [], buildings: [], areas: [], trees: [], pois: [] };
  const street = ['Mall Road', 'Canal Bank', 'Jail Road', 'Ferozepur Rd', 'Davis Road', 'Queens Road', 'Park Lane', 'Market St', 'Station Rd', 'College Rd', 'River Walk'];
  const avenue = ['1st Avenue', '2nd Avenue', '3rd Avenue', 'Central Ave', '5th Avenue', '6th Avenue', '7th Avenue', 'Garden Ave', '9th Avenue', 'Harbour Ave', 'Liberty Ave'];
  const mk = (pts, w, name, extra) => { const o = Object.assign({ id: out.roads.length + 1, pts, kind: 'ground', w, cls: w >= 14 ? 'primary' : 'secondary', name, oneway: 0, lanes: w >= 14 ? 4 : 2, speed: w >= 14 ? 15 : 12, tex: w >= 14 ? 'multi' : 'two' }, extra || {}); const pr = profile(pts, 0, true, true); o.ds = pr.ds; o.L = pr.L; o.hs = null; out.roads.push(o); return o; };
  for (let i = -N; i <= N; i++) {
    const vpts = [[i * S, -E]]; for (let j = -N; j <= N; j++) vpts.push([i * S, j * S]); vpts.push([i * S, E]);
    mk(vpts, i === 0 ? 16 : 12, avenue[i + N]);
    if (i === 0) { // main boulevard: ground west/east, underpass in the middle
      mk([[-E, 0], [-360, 0], [-288, 0], [-216, 0]], 16, street[i + N]);
      mk([[216, 0], [288, 0], [360, 0], [E, 0]], 16, street[i + N]);
      const tp = [[-216, 0]]; for (let x = -180; x <= 180; x += 72) tp.push([x, 0.7]); tp.push([216, 0]);
      const o = mk(tp, 16, street[i + N] + ' Underpass', { kind: 'trench', layer: -1 });
      const pr = profile(tp, -6, false, false); o.hs = pr.hs;
    } else { const hp = [[-E, i * S]]; for (let x = -N; x <= N; x++) hp.push([x * S, i * S]); hp.push([E, i * S]); mk(hp, 12, street[i + N]); }
  }
  // flyover above Central Ave from z=-216 to z=216
  // intermediate vertices sit 0.7 m off the grid so they never share a node with the streets below
  const fp = [[0, -216]]; for (let z = -180; z <= 180; z += 36) fp.push([0.7, z]); fp.push([0, 216]);
  const fo = mk(fp, 13, 'Central Flyover', { kind: 'bridge', layer: 1, cls: 'trunk', speed: 20, tex: 'multi', oneway: 0, lanes: 4 });
  const fpr = profile(fp, 7, false, false); fo.hs = fpr.hs;
  const names = ['Grand Hotel', 'City Museum', 'Union Bank Tower', 'Central Library', 'Crescent Mall', 'Harbour View', 'Liberty Plaza', 'Old Town Hall', 'Metro Center', 'Skyline Tower'];
  let ni = 0;
  for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
    const x0 = i * S + 11, z0 = j * S + 11, x1 = i * S + S - 11, z1 = j * S + S - 11;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (r() < 0.12) {
      out.areas.push({ pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], type: r() < 0.25 ? 'water' : 'park', name: '' });
      for (let k = 0; k < 16; k++) out.trees.push([x0 + 3 + r() * (x1 - x0 - 6), z0 + 3 + r() * (z1 - z0 - 6), 0.9 + r() * 0.8]);
      continue;
    }
    const sx = x0 + (x1 - x0) * (0.35 + r() * 0.3), sz = z0 + (z1 - z0) * (0.35 + r() * 0.3);
    const lots = r() < 0.25 ? [[x0, z0, x1, z1]] : [[x0, z0, sx, sz], [sx, z0, x1, sz], [x0, sz, sx, z1], [sx, sz, x1, z1]];
    for (const [a0, b0, a1, b1] of lots) {
      const lx0 = a0 + 1.5, lz0 = b0 + 1.5, lx1 = a1 - 1.5, lz1 = b1 - 1.5;
      const lcx = (lx0 + lx1) / 2, lcz = (lz0 + lz1) / 2;
      const d = Math.hypot(lcx, lcz), hmax = 14 + 120 * Math.exp(-d / 190);
      const h = 9 + r() * (hmax - 9);
      const col = WALL_COLS[(r() * WALL_COLS.length) | 0], rc = ROOF_COLS[(r() * ROOF_COLS.length) | 0], style = r();
      const name = h > 38 && ni < names.length && r() < 0.5 ? names[ni++] : '';
      out.buildings.push({ pts: [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]], h, y0: 0, col, rc, style, name, landmark: /Museum|Hall|Library/.test(name) });
    }
    if (r() < 0.3) out.pois.push({ x: cx, z: z0 - 3, name: ['Cafe Aroma', 'City Pharmacy', 'Fuel Stop', 'Book Corner', 'Burger Point', 'Bakery'][(r() * 6) | 0], cat: ['amenity', 'shop'][(r() * 2) | 0], rank: 1 });
  }
  return out;
}

/* ---------- Tile building ---------- */
function newTile(key) { return { key, state: 'new', group: null, vis: null, labelGroup: null, nightGroup: null, grid: null, roadGrid: null, nodes: [], labels: [], edges: [], mini: null, cx: 0, cz: 0 }; }
function buildTile(tile, src, bounds) {
  const g = new THREE.Group(), vis = new THREE.Group(), labelGroup = new THREE.Group(), nightGroup = new THREE.Group();
  g.add(vis, labelGroup); vis.add(nightGroup); nightGroup.visible = night; vis.visible = !(G.active && G.calibrated);
  const grid = new Grid(16), roadGrid = new Grid(24), bGrid = new Grid(24);
  const wb = new GB(), tb = new GB(), bb = new GB(), rb = new GB();
  const roadB = {}, deckB = {}; for (const k in ROAD_TEX) { roadB[k] = new GB(); deckB[k] = new GB(); }
  const walkB = new GB(), conB = new GB(), cutB = new GB(), parkB = new GB(), waterB = new GB();
  const labels = [], nodes = [], edges = [];
  // buildings
  for (const b of src.buildings) {
    const style = b.tinted ? wb : b.h > 34 ? tb : (b.h < 16 && (b.style || 0) < 0.4 ? bb : wb);
    const col = style === tb ? GLASS_TINTS[(b.style * 10 | 0) % GLASS_TINTS.length] : style === bb ? WHITE : b.col;
    addBuilding(style, rb, b.pts, b.y0 || 0, b.h, col, b.rc);
    if ((b.y0 || 0) < 3) {
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (let i = 0; i < b.pts.length; i++) {
        const a = b.pts[i], c = b.pts[(i + 1) % b.pts.length];
        grid.addSeg({ ax: a[0], az: a[1], bx: c[0], bz: c[1], top: b.h, wall: 1 });
        x0 = Math.min(x0, a[0]); z0 = Math.min(z0, a[1]); x1 = Math.max(x1, a[0]); z1 = Math.max(z1, a[1]);
      }
      bGrid.add({ pts: b.pts }, x0, z0, x1, z1);
    }
    if (b.name) {
      const c = polyCentroid(b.pts), s = makeLabel(b.name, b.landmark ? 'landmark' : 'building');
      s.position.set(c[0], b.h + 2.5, c[1]); labelGroup.add(s);
      labels.push({ s, x: c[0], z: c[1], kind: b.landmark ? 'landmark' : 'building', name: b.name });
    }
  }
  // roads
  const walkW = r => r.cls === 'service' || r.cls === 'living_street' || /motorway/.test(r.cls) ? 0 : 2.6;
  for (const r of src.roads) {
    const hw = r.w / 2, n = r.pts.length;
    const H = i => (r.hs ? r.hs[i] : 0);
    for (let i = 0; i < n - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      roadGrid.addSeg({ ax: a[0], az: a[1], bx: b[0], bz: b[1], hw, ha: H(i), hb: H(i + 1), kind: r.kind, name: r.name, cls: r.cls });
    }
    if (r.kind === 'ground') {
      const ww = walkW(r);
      if (ww) addRibbon(walkB, r.pts, r.w + ww * 2, null, 0.02, WHITE, 4, true);
      addRibbon(roadB[r.tex], r.pts, r.w, null, 0.04, WHITE, 8, true);
      if (r.w >= 6.5) for (const p of r.pts) nodes.push([p[0], p[1], 0]);
    } else {
      const f = ribbonFrame(r.pts, hw);
      if (r.kind === 'bridge') {
        addRibbon(deckB[r.tex], r.pts, r.w, r.hs, 0.04, WHITE, 8, false);
        // underside, fascia, parapets
        for (let i = 0; i < n - 1; i++) {
          const a = f.L[i], b = f.R[i], c = f.R[i + 1], d = f.L[i + 1], y0 = H(i) - 1.1, y1 = H(i + 1) - 1.1;
          conB.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [c[0], y1, c[1]], [d[0], y1, d[1]], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1], WHITE);
        }
        for (const side of [f.L, f.R]) addWallStrip(conB, side, f, i => H(i) + 0.95, i => H(i) - 1.1, WHITE, r.pts);
        // pillars every ~28 m where the deck is high enough
        for (let i = 0; i < n - 1; i++) {
          const a = r.pts[i], b = r.pts[i + 1], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let s = (28 - (r.ds[i] % 28)) % 28; s < seg; s += 28) {
            const t = s / seg, h = H(i) + (H(i + 1) - H(i)) * t; if (h < 3.2) continue;
            const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, q = 0.8;
            for (const [dx, dz, nx, nz] of [[1, 0, 1, 0], [-1, 0, -1, 0], [0, 1, 0, 1], [0, -1, 0, -1]]) {
              const px = x + dx * q, pz = z + dz * q, ex = -dz * q, ez = dx * q;
              conB.quad([px - ex, 0, pz - ez], [px + ex, 0, pz + ez], [px + ex, h - 1.1, pz + ez], [px - ex, h - 1.1, pz - ez], [nx, 0, nz], [0, 0], [1, 0], [1, h / 6], [0, h / 6], WHITE);
            }
            grid.add({ x, z, r: 1.1, top: h - 1.1 }, x - 2, z - 2, x + 2, z + 2);
          }
        }
        // railings (collision while on the deck), skipped near the ends of the way so forks stay open
        for (const side of [f.L, f.R]) for (let i = 0; i < n - 1; i++) {
          if (r.ds[i] < 14 || r.ds[i + 1] > r.L - 14) continue;
          grid.addSeg({ ax: side[i][0], az: side[i][1], bx: side[i + 1][0], bz: side[i + 1][1], ha: H(i), hb: H(i + 1), rail: 'bridge' });
        }
      } else { // underpass: sunken road, retaining walls, ground cut-out
        addRibbon(deckB[r.tex], r.pts, r.w, r.hs, 0.04, WHITE, 8, false);
        for (const side of [f.L, f.R]) {
          addWallStrip(conB, side, f, () => 0.02, i => H(i), WHITE, null);
          for (let i = 0; i < n - 1; i++) grid.addSeg({ ax: side[i][0], az: side[i][1], bx: side[i + 1][0], bz: side[i + 1][1], ha: H(i), hb: H(i + 1), rail: 'trench' });
        }
        addRibbon(cutB, r.pts, r.w + 0.3, null, 0.0, WHITE, 8, false);
      }
      for (let i = 0; i < n; i++) nodes.push([r.pts[i][0], r.pts[i][1], H(i)]);
    }
    // street name signs every 170 m along named roads
    if (r.name && r.w >= 6) {
      for (let i = 0; i < n - 1; i++) {
        const s0 = r.ds[i], s1 = r.ds[i + 1];
        const m = Math.ceil((s0 + 40) / 170) * 170 - 40; if (m < s0 || m >= s1 || labels.length > 220) continue;
        const t = (m - s0) / (s1 - s0), a = r.pts[i], b = r.pts[i + 1];
        const dir = norm2(b[0] - a[0], b[1] - a[1]) || [1, 0];
        const x = a[0] + (b[0] - a[0]) * t + dir[1] * (hw + 0.8), z = a[1] + (b[1] - a[1]) * t - dir[0] * (hw + 0.8);
        const s = makeLabel(r.name, 'street'); s.position.set(x, H(i) + 4.6, z); labelGroup.add(s);
        labels.push({ s, x, z, kind: 'street', name: r.name });
      }
    }
    // traffic graph edges
    if (r.w >= 5 && r.cls !== 'service') {
      for (let i = 0; i < n - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        if (r.oneway >= 0) edges.push(makeEdge(a, b, H(i), H(i + 1), r, tile.key));
        if (r.oneway <= 0) edges.push(makeEdge(b, a, H(i + 1), H(i), r, tile.key));
      }
    }
  }
  // areas
  const grass = C(0x5c7a3a), forest = C(0x46612f), water = C(0x2f5f7a);
  for (const a of src.areas) {
    if (a.type === 'water') fillPoly(waterB, a.pts, 0.012, water);
    else fillPoly(parkB, a.pts, 0.015, a.type === 'forest' ? forest : grass);
    if (a.type === 'forest') {
      const rr = rng(a.pts.length * 977 + Math.round(a.pts[0][0])); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of a.pts) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
      const nT = Math.min(160, ((x1 - x0) * (z1 - z0)) / 90);
      for (let k = 0; k < nT; k++) { const x = x0 + rr() * (x1 - x0), z = z0 + rr() * (z1 - z0); if (pointInPoly(x, z, a.pts)) src.trees.push([x, z, 0.9 + rr() * 0.9]); }
    }
  }
  const blocked = (x, z, pad) => {
    let bad = false;
    roadGrid.query(x, z, 14, s => { if (!bad && segDist(x, z, s)[0] < s.hw + pad) bad = true; });
    if (!bad) grid.query(x, z, 4, s => { if (!bad && s.wall && segDist(x, z, s)[0] < 2.5) bad = true; });
    if (!bad) bGrid.query(x, z, 1, b => { if (!bad && pointInPoly(x, z, b.pts)) bad = true; });
    return bad;
  };
  // street trees and lamps along ground roads
  const trees = src.trees.filter(t => !blocked(t[0], t[1], 0.8));
  const lamps = []; const rr = rng(hashStr(tile.key));
  for (const r of src.roads) {
    if (r.kind !== 'ground' || r.w < 6.5) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 8) continue;
      const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
      for (let s = (34 - (r.ds[i] % 34)) % 34; s < len - 4; s += 34) {
        const k = Math.floor((r.ds[i] + s) / 34), side = k % 2 ? 1 : -1, off = r.w / 2 + 1.0;
        const x = a[0] + dx * s + dz * off * side, z = a[1] + dz * s - dx * off * side;
        if (!blocked(x, z, 0.3)) lamps.push([x, z, -dz * side, dx * side]);
      }
      if (r.w <= 12 && trees.length < 900) for (let s = 9; s < len - 4; s += 19) for (const side of [-1, 1]) {
        const off = r.w / 2 + 2.6, x = a[0] + dx * s + dz * off * side, z = a[1] + dz * s - dx * off * side;
        if (rr() < 0.6 && !blocked(x, z, 1.4)) trees.push([x, z, 0.8 + rr() * 0.5]);
      }
    }
  }
  // meshes
  const add = (gb, mat, o) => { if (gb.empty) return null; const m = gb.mesh(mat); Object.assign(m, o || {}); vis.add(m); return m; };
  for (const [gbx, mat] of [[wb, wallMat], [tb, towerMat], [bb, brickMat], [rb, roofMat]]) add(gbx, mat, { castShadow: true, receiveShadow: true });
  add(walkB, walkMat, { renderOrder: 1, receiveShadow: true });
  add(parkB, parkMat, { renderOrder: 1, receiveShadow: true });
  add(waterB, waterMat, { renderOrder: 1 });
  for (const k in ROAD_TEX) { add(roadB[k], ROAD_MAT[k], { renderOrder: 2, receiveShadow: true }); add(deckB[k], DECK_MAT[k], { castShadow: true, receiveShadow: true }); }
  add(conB, concreteMat, { castShadow: true, receiveShadow: true });
  const cut = add(cutB, cutMat, { renderOrder: -5 }); if (cut) cut.frustumCulled = false;
  if (trees.length) {
    const n = trees.length, r2 = rng(5);
    const trunk = new THREE.InstancedMesh(TREE_GEO.trunk, trunkMat, n), leaf = new THREE.InstancedMesh(TREE_GEO.leaf, leafMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    trees.forEach((t, i) => {
      q.setFromAxisAngle(Y, r2() * PI * 2); s.set(t[2], t[2] * (0.9 + r2() * 0.35), t[2]); pv.set(t[0], 0, t[1]);
      m.compose(pv, q, s); trunk.setMatrixAt(i, m); leaf.setMatrixAt(i, m); leaf.setColorAt(i, TREE_GREENS[(r2() * TREE_GREENS.length) | 0]);
      grid.add({ x: t[0], z: t[1], r: 0.35 * t[2], top: 3 }, t[0] - 1, t[1] - 1, t[0] + 1, t[1] + 1);
    });
    trunk.castShadow = leaf.castShadow = true; leaf.receiveShadow = true; vis.add(trunk, leaf);
  }
  if (lamps.length) {
    const n = lamps.length, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const pole = new THREE.InstancedMesh(LAMP_GEO.pole, poleMat, n), arm = new THREE.InstancedMesh(LAMP_GEO.arm, poleMat, n);
    const head = new THREE.InstancedMesh(LAMP_GEO.head, lampMat, n), pool = new THREE.InstancedMesh(LAMP_GEO.pool, poolMat, n);
    lamps.forEach((L, i) => {
      q.setFromAxisAngle(Y, Math.atan2(L[2], L[3])); pv.set(L[0], 0, L[1]); m4.compose(pv, q, one);
      pole.setMatrixAt(i, m4); arm.setMatrixAt(i, m4); head.setMatrixAt(i, m4); pool.setMatrixAt(i, m4);
      grid.add({ x: L[0], z: L[1], r: 0.15, top: 7 }, L[0] - 1, L[1] - 1, L[0] + 1, L[1] + 1);
    });
    pole.castShadow = true; pool.renderOrder = 3; vis.add(pole, arm); nightGroup.add(head, pool);
  }
  // points of interest
  const pois = src.pois.slice().sort((a, b) => a.rank - b.rank).slice(0, 45);
  for (const p of pois) {
    const kind = p.landmark ? 'landmark' : 'poi', s = makeLabel(p.name, kind, POI_COLOR[p.cat]);
    s.position.set(p.x, p.landmark ? 14 : 5.5, p.z); labelGroup.add(s);
    labels.push({ s, x: p.x, z: p.z, kind, name: p.name });
  }
  Object.assign(tile, { group: g, vis, labelGroup, nightGroup, grid, roadGrid, nodes, labels, edges, state: 'ready' });
  tile.mini = drawTileMini(src, bounds);
  scene.add(g);
  edges.forEach(registerEdge);
}
const TREE_GEO = { trunk: new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6).translate(0, 1.2, 0), leaf: new THREE.IcosahedronGeometry(1.9, 1).translate(0, 3.6, 0) };
const TREE_GREENS = ['#4f7a35', '#5f8a3a', '#6b8f3d', '#3f6a33', '#7a9445'].map(C);
const LAMP_GEO = {
  pole: new THREE.CylinderGeometry(0.07, 0.11, 7.5, 6).translate(0, 3.75, 0), arm: new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(0, 7.4, 0.8),
  head: new THREE.BoxGeometry(0.35, 0.12, 0.6).translate(0, 7.32, 1.5), pool: new THREE.PlaneGeometry(13, 13).rotateX(-PI / 2).translate(0, 0.06, 1.8),
};
function drawTileMini(src, b) {
  const S = b.size > TILE * 1.5 ? 1024 : 200, sc = S / b.size;
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const T = p => [(p[0] - b.x0) * sc, (p[1] - b.z0) * sc];
  const poly = pts => { x.beginPath(); pts.forEach((q, i) => { const t = T(q); i ? x.lineTo(t[0], t[1]) : x.moveTo(t[0], t[1]); }); x.closePath(); x.fill(); };
  for (const a of src.areas) { x.fillStyle = a.type === 'water' ? '#24465a' : '#2c4528'; poly(a.pts); }
  x.lineCap = x.lineJoin = 'round';
  for (const kind of ['trench', 'ground', 'bridge']) for (const r of src.roads) {
    if (r.kind !== kind) continue;
    x.strokeStyle = kind === 'bridge' ? '#c9b48a' : kind === 'trench' ? '#4c5056' : '#727780';
    x.lineWidth = Math.max(1.5, r.w * sc); x.beginPath(); r.pts.forEach((q, i) => { const t = T(q); i ? x.lineTo(t[0], t[1]) : x.moveTo(t[0], t[1]); }); x.stroke();
  }
  x.fillStyle = '#3d434b'; for (const bd of src.buildings) if (!bd.y0) poly(bd.pts);
  return { c, x0: b.x0, z0: b.z0, size: b.size };
}
function disposeTile(tile) {
  if (tile.group) { scene.remove(tile.group); disposeObject(tile.group); }
  tile.edges.forEach(unregisterEdge);
  tile.edges = []; tile.labels = []; tile.state = 'gone';
}
function clearWorld() {
  for (const t of World.tiles.values()) disposeTile(t);
  World.tiles.clear(); if (World.gen) disposeTile(World.gen); World.gen = null;
  World.queue = []; World.busy = false;
}

/* ---------- World modes ---------- */
function startGenerated() {
  clearWorld(); World.mode = 'gen'; World.name = 'Generated city'; World.radius = 5 * 72 + 26;
  const src = generatedCity(7), t = newTile('gen');
  buildTile(t, src, { x0: -400, z0: -400, size: 800 });
  World.gen = t;
  return { x: 4.5, z: 40, th: PI };
}
async function startOSM(lat, lon, name, onProgress) {
  clearWorld(); setOrigin(lat, lon); World.mode = 'osm'; World.name = name; World.radius = Infinity; World.backoff = 0;
  // first load: a 4 x 4 tile block (1.28 km) around the start point in one request
  const keys = []; for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) keys.push(tkey(i, j));
  onProgress && onProgress('Downloading streets and buildings…');
  const data = await fetchOSMArea(-2 * TILE, -2 * TILE, 2 * TILE, 2 * TILE);
  onProgress && onProgress('Building the city…');
  await new Promise(r => setTimeout(r, 20));
  const feat = osmToFeatures(data, -2 * TILE, -2 * TILE, 2 * TILE, 2 * TILE);
  if (feat.roads.length < 3) throw new Error('No roads in this area');
  const src = distribute(feat, keys);
  for (const k of keys) { const [i, j] = k.split(',').map(Number), t = newTile(k); t.cx = (i + 0.5) * TILE; t.cz = (j + 0.5) * TILE; World.tiles.set(k, t); buildTile(t, src.get(k), { x0: i * TILE, z0: j * TILE, size: TILE }); }
  // spawn on the biggest ground road near the start
  let spawn = { x: 0, z: 0, th: 0 }, best = 1e9;
  for (const r of feat.roads) {
    if (r.kind !== 'ground' || r.w < 6) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const p = r.pts[i], q = r.pts[i + 1], d = Math.hypot(p[0], p[1]) - r.w * 2;
      if (d < best) { best = d; spawn = { x: p[0] + (q[0] - p[0]) * 0.3, z: p[1] + (q[1] - p[1]) * 0.3, th: Math.atan2(q[0] - p[0], q[1] - p[1]) }; }
    }
  }
  return spawn;
}
// Streaming: keep the area around (and ahead of) the car loaded
function streamUpdate(dt, cx, cz, vx, vz) {
  if (World.mode !== 'osm') return;
  World.scanT -= dt; if (World.scanT > 0) return; World.scanT = 0.6;
  const lx = cx + clamp(vx * 7, -220, 220), lz = cz + clamp(vz * 7, -220, 220);
  const [ci, cj] = tileIJ(cx, cz);
  const want = [];
  for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
    const i = ci + di, j = cj + dj, x = (i + 0.5) * TILE, z = (j + 0.5) * TILE;
    const d = Math.hypot(x - cx, z - cz), dl = Math.hypot(x - lx, z - lz);
    if (d < 560 || dl < 420) { const k = tkey(i, j), t = World.tiles.get(k); if (!t || (t.state === 'failed' && performance.now() > t.retryAt)) want.push({ k, i, j, p: dl }); }
  }
  want.sort((a, b) => a.p - b.p);
  World.pending = want.length;
  // unload far tiles
  for (const [k, t] of World.tiles) if (t.state !== 'loading' && Math.hypot(t.cx - cx, t.cz - cz) > 1100) { disposeTile(t); World.tiles.delete(k); }
  if (World.busy || !want.length || performance.now() < World.backoff) return;
  const w = want[0], t = World.tiles.get(w.k) || newTile(w.k);
  t.cx = (w.i + 0.5) * TILE; t.cz = (w.j + 0.5) * TILE; t.state = 'loading'; World.tiles.set(w.k, t);
  World.busy = true;
  const x0 = w.i * TILE, z0 = w.j * TILE;
  fetchOSMArea(x0, z0, x0 + TILE, z0 + TILE).then(data => {
    if (World.mode !== 'osm' || World.tiles.get(w.k) !== t) return;
    const feat = osmToFeatures(data, x0, z0, x0 + TILE, z0 + TILE);
    buildTile(t, distribute(feat, [w.k]).get(w.k), { x0, z0, size: TILE });
  }).catch(e => {
    t.state = 'failed'; t.retryAt = performance.now() + 15000;
    if (e && e.busy) World.backoff = performance.now() + 8000;
  }).finally(() => { World.busy = false; });
}
function forTilesNear(x, z, r, cb) {
  if (World.mode === 'gen') { if (World.gen && World.gen.state === 'ready') cb(World.gen); return; }
  for (let i = Math.floor((x - r) / TILE); i <= Math.floor((x + r) / TILE); i++)
    for (let j = Math.floor((z - r) / TILE); j <= Math.floor((z + r) / TILE); j++) {
      const t = World.tiles.get(tkey(i, j)); if (t && t.state === 'ready') cb(t);
    }
}
function allTiles(cb) { if (World.mode === 'gen') { if (World.gen) cb(World.gen); } else World.tiles.forEach(t => { if (t.state === 'ready') cb(t); }); }

/* ---------- Surfaces (ground, flyover decks, underpasses) ---------- */
function surfaceAt(x, z, yRef) {
  let best = -Infinity, inTrench = false, onGround = false, lowest = 0;
  forTilesNear(x, z, 14, t => t.roadGrid.query(x, z, 12, s => {
    const q = segDist(x, z, s); if (q[0] > s.hw) return;
    if (s.kind === 'ground') { onGround = true; return; }
    const h = s.ha + (s.hb - s.ha) * q[3];
    if (s.kind === 'trench') { inTrench = true; lowest = Math.min(lowest, h); }
    if (h <= yRef + 1.3 && h > best) best = h;
  }));
  if ((!inTrench || onGround) && 0 <= yRef + 1.3 && 0 > best) best = 0;
  if (best === -Infinity) best = inTrench ? lowest : 0;
  return best;
}
function roadInfoAt(x, z, y) {
  let best = null, bd = 1e9;
  forTilesNear(x, z, 20, t => t.roadGrid.query(x, z, 16, s => {
    const q = segDist(x, z, s); if (q[0] > s.hw + 4) return;
    const h = s.ha + (s.hb - s.ha) * q[3]; if (Math.abs(h - y) > 2.5) return;
    const d = q[0] - (s.name ? 1 : 0); if (d < bd) { bd = d; best = s; }
  }));
  return best;
}

/* ---------- Labels: visibility and scale by distance ---------- */
const LABEL_RANGE = { landmark: 700, building: 300, poi: 150, street: 220 };
const announced = new Set();
let labelT = 0;
function updateLabels(dt, cam, carX, carZ, onLandmark) {
  labelT -= dt; if (labelT > 0) return; labelT = 0.2;
  const cx = cam.position.x, cz = cam.position.z;
  allTiles(t => {
    const near = World.mode === 'gen' || Math.hypot(t.cx - cx, t.cz - cz) < 900;
    t.labelGroup.visible = near && showLabels; if (!near || !showLabels) return;
    for (const L of t.labels) {
      const d = Math.hypot(L.x - cx, L.z - cz), on = d < LABEL_RANGE[L.kind];
      L.s.visible = on;
      if (on) { const k = clamp(d / 45, 1, L.kind === 'landmark' ? 6 : 3.2), b = L.s.userData.base; L.s.scale.set(b[0] * k, b[1] * k, 1); }
      if (L.kind === 'landmark' && !announced.has(L.name) && Math.hypot(L.x - carX, L.z - carZ) < 75) { announced.add(L.name); onLandmark(L.name); }
    }
  });
}
let showLabels = true;
