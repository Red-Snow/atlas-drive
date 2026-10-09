/* 3d-tiles-renderer v0.3.33 (NASA-AMMOS), Apache License 2.0. Bundled to use the global three.js r128 build. */
var Tiles3D = (() => {
  var Pt = Object.create;
  var te = Object.defineProperty;
  var Mt = Object.getOwnPropertyDescriptor;
  var Ct = Object.getOwnPropertyNames;
  var Rt = Object.getPrototypeOf, Lt = Object.prototype.hasOwnProperty;
  var $e = (o, e) => () => (e || o((e = { exports: {} }).exports, e), e.exports), Et = (o, e) => {
    for (var t in e)
      te(o, t, { get: e[t], enumerable: !0 });
  }, Je = (o, e, t, s) => {
    if (e && typeof e == "object" || typeof e == "function")
      for (let n of Ct(e))
        !Lt.call(o, n) && n !== t && te(o, n, { get: () => e[n], enumerable: !(s = Mt(e, n)) || s.enumerable });
    return o;
  };
  var T = (o, e, t) => (t = o != null ? Pt(Rt(o)) : {}, Je(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    e || !o || !o.__esModule ? te(t, "default", { value: o, enumerable: !0 }) : t,
    o
  )), It = (o) => Je(te({}, "__esModule", { value: !0 }), o);

  // g:three
  var P = $e((is, et) => {
    et.exports = window.THREE;
  });

  // g:three/examples/jsm/loaders/GLTFLoader.js
  var st = $e((as, tt) => {
    tt.exports = { GLTFLoader: window.THREE.GLTFLoader };
  });

  // entry.js
  var Gt = {};
  Et(Gt, {
    TilesRenderer: () => Ce,
    WGS84_ELLIPSOID: () => vt
  });

  // node_modules/3d-tiles-renderer/src/utilities/urlExtension.js
  function Re(o) {
    let e;
    try {
      e = new URL(o, "http://fakehost.com/");
    } catch (r) {
      return null;
    }
    let t = e.pathname.split("/").pop(), s = t.lastIndexOf(".");
    return s === -1 || s === t.length - 1 ? null : t.substring(s + 1);
  }

  // node_modules/3d-tiles-renderer/src/utilities/LRUCache.js
  var se = class {
    constructor() {
      this.maxSize = 800, this.minSize = 600, this.unloadPercent = 0.05, this.itemSet = /* @__PURE__ */ new Map(), this.itemList = [], this.usedSet = /* @__PURE__ */ new Set(), this.callbacks = /* @__PURE__ */ new Map(), this.unloadPriorityCallback = null;
      let e = this.itemSet;
      this.defaultPriorityCallback = (t) => e.get(t);
    }
    // Returns whether or not the cache has reached the maximum size
    isFull() {
      return this.itemSet.size >= this.maxSize;
    }
    add(e, t) {
      let s = this.itemSet;
      if (s.has(e) || this.isFull())
        return !1;
      let n = this.usedSet, r = this.itemList, i = this.callbacks;
      return r.push(e), n.add(e), s.set(e, Date.now()), i.set(e, t), !0;
    }
    remove(e) {
      let t = this.usedSet, s = this.itemSet, n = this.itemList, r = this.callbacks;
      if (s.has(e)) {
        r.get(e)(e);
        let i = n.indexOf(e);
        return n.splice(i, 1), t.delete(e), s.delete(e), r.delete(e), !0;
      }
      return !1;
    }
    markUsed(e) {
      let t = this.itemSet, s = this.usedSet;
      t.has(e) && !s.has(e) && (t.set(e, Date.now()), s.add(e));
    }
    markAllUnused() {
      this.usedSet.clear();
    }
    // TODO: this should be renamed because it's not necessarily unloading all unused content
    // Maybe call it "cleanup" or "unloadToMinSize"
    unloadUnusedContent() {
      let e = this.unloadPercent, t = this.minSize, s = this.itemList, n = this.itemSet, r = this.usedSet, i = this.callbacks, a = s.length - r.size, c = s.length - t, l = this.unloadPriorityCallback || this.defaultPriorityCallback;
      if (c > 0 && a > 0) {
        s.sort((m, _) => {
          let f = r.has(m), p = r.has(_);
          return f && p ? 0 : !f && !p ? l(_) - l(m) : f ? 1 : -1;
        });
        let h = Math.min(c, a), u = Math.max(t * e, h * e), d = Math.min(u, a);
        d = Math.ceil(d);
        let g = s.splice(0, d);
        for (let m = 0, _ = g.length; m < _; m++) {
          let f = g[m];
          i.get(f)(f), n.delete(f), i.delete(f);
        }
      }
    }
    scheduleUnload(e = !0) {
      this.scheduled || (this.scheduled = !0, queueMicrotask(() => {
        this.scheduled = !1, this.unloadUnusedContent(), e && this.markAllUnused();
      }));
    }
  };

  // node_modules/3d-tiles-renderer/src/utilities/PriorityQueue.js
  var J = class {
    constructor() {
      this.maxJobs = 6, this.items = [], this.callbacks = /* @__PURE__ */ new Map(), this.currJobs = 0, this.scheduled = !1, this.autoUpdate = !0, this.priorityCallback = () => {
        throw new Error("PriorityQueue: PriorityCallback function not defined.");
      }, this.schedulingCallback = (e) => {
        requestAnimationFrame(e);
      }, this._runjobs = () => {
        this.tryRunJobs(), this.scheduled = !1;
      };
    }
    sort() {
      let e = this.priorityCallback;
      this.items.sort(e);
    }
    add(e, t) {
      return new Promise((s, n) => {
        let r = (...c) => t(...c).then(s).catch(n), i = this.items, a = this.callbacks;
        i.push(e), a.set(e, r), this.autoUpdate && this.scheduleJobRun();
      });
    }
    remove(e) {
      let t = this.items, s = this.callbacks, n = t.indexOf(e);
      n !== -1 && (t.splice(n, 1), s.delete(e));
    }
    tryRunJobs() {
      this.sort();
      let e = this.items, t = this.callbacks, s = this.maxJobs, n = this.currJobs;
      for (; s > n && e.length > 0; ) {
        n++;
        let r = e.pop(), i = t.get(r);
        t.delete(r), i(r).then(() => {
          this.currJobs--, this.autoUpdate && this.scheduleJobRun();
        }).catch(() => {
          this.currJobs--, this.autoUpdate && this.scheduleJobRun();
        });
      }
      this.currJobs = n;
    }
    scheduleJobRun() {
      this.scheduled || (this.schedulingCallback(this._runjobs), this.scheduled = !0);
    }
  };

  // node_modules/3d-tiles-renderer/src/base/constants.js
  var Ft = 0.0033528106647474805, ne = -(Ft * 6378137 - 6378137);

  // node_modules/3d-tiles-renderer/src/base/traverseFunctions.js
  function Ee(o) {
    return o === 3 || o === 4;
  }
  function U(o, e) {
    return o.__lastFrameVisited === e && o.__used;
  }
  function Qe(o, e) {
    o.__lastFrameVisited !== e && (o.__lastFrameVisited = e, o.__used = !1, o.__inFrustum = !1, o.__isLeaf = !1, o.__visible = !1, o.__active = !1, o.__error = 1 / 0, o.__distanceFromCamera = 1 / 0, o.__childrenWereVisible = !1, o.__allChildrenLoaded = !1);
  }
  function Xe(o, e, t, s) {
    if (s.ensureChildrenArePreprocessed(o), Qe(o, e), o.__used = !0, t.markUsed(o), o.__contentEmpty) {
      let n = o.children;
      for (let r = 0, i = n.length; r < i; r++)
        Xe(n[r], e, t, s);
    }
  }
  function Ye(o, e, t) {
    if (t.ensureChildrenArePreprocessed(o), o.__contentEmpty && (!o.__externalTileSet || Ee(o.__loadingState))) {
      let n = o.children;
      for (let r = 0, i = n.length; r < i; r++) {
        let a = n[r];
        a.__depthFromRenderedParent = e, Ye(a, e, t);
      }
    } else
      t.requestTileContents(o);
  }
  function Ie(o, e = null, t = null, s = null, n = 0) {
    if (e && e(o, s, n)) {
      t && t(o, s, n);
      return;
    }
    let r = o.children;
    for (let i = 0, a = r.length; i < a; i++)
      Ie(r[i], e, t, o, n + 1);
    t && t(o, s, n);
  }
  function Fe(o, e) {
    e.ensureChildrenArePreprocessed(o);
    let t = e.stats, s = e.frameCount, n = e.errorTarget, r = e.maxDepth, i = e.loadSiblings, a = e.lruCache, c = e.stopAtEmptyTiles;
    if (Qe(o, s), e.tileInView(o) === !1)
      return !1;
    if (o.__used = !0, a.markUsed(o), o.__inFrustum = !0, t.inFrustum++, (c || !o.__contentEmpty) && !o.__externalTileSet && (e.calculateError(o), o.__error <= n || e.maxDepth > 0 && o.__depth + 1 >= r))
      return !0;
    let h = !1, u = o.children;
    for (let d = 0, g = u.length; d < g; d++) {
      let m = u[d], _ = Fe(m, e);
      h = h || _;
    }
    if (h && i)
      for (let d = 0, g = u.length; d < g; d++) {
        let m = u[d];
        Xe(m, s, a, e);
      }
    return !0;
  }
  function De(o, e) {
    let t = e.stats, s = e.frameCount;
    if (!U(o, s))
      return;
    t.used++;
    let n = o.children, r = !1;
    for (let i = 0, a = n.length; i < a; i++) {
      let c = n[i];
      r = r || U(c, s);
    }
    if (!r)
      o.__isLeaf = !0;
    else {
      let i = !1, a = !0;
      for (let c = 0, l = n.length; c < l; c++) {
        let h = n[c];
        if (De(h, e), i = i || h.__wasSetVisible || h.__childrenWereVisible, U(h, s)) {
          let u = h.__allChildrenLoaded || !h.__contentEmpty && Ee(h.__loadingState) || !h.__externalTileSet && h.__contentEmpty && h.children.length === 0 || h.__externalTileSet && h.__loadingState === 4;
          a = a && u;
        }
      }
      o.__childrenWereVisible = i, o.__allChildrenLoaded = a;
    }
  }
  function Ae(o, e) {
    let t = e.stats, s = e.frameCount;
    if (!U(o, s))
      return;
    let n = o.parent, r = n ? n.__depthFromRenderedParent : -1;
    o.__depthFromRenderedParent = r;
    let i = e.lruCache;
    if (o.__isLeaf) {
      o.__depthFromRenderedParent++, o.__loadingState === 3 ? (o.__inFrustum && (o.__visible = !0, t.visible++), o.__active = !0, t.active++) : !i.isFull() && (!o.__contentEmpty || o.__externalTileSet) && e.requestTileContents(o);
      return;
    }
    let a = (e.errorTarget + 1) * e.errorThreshold, c = o.__error <= a, l = c || o.refine === "ADD", h = !o.__contentEmpty, u = h || o.__externalTileSet, d = Ee(o.__loadingState) && u, g = o.__childrenWereVisible, m = o.children, _ = o.__allChildrenLoaded;
    if (l && h && o.__depthFromRenderedParent++, l && !d && !i.isFull() && u && e.requestTileContents(o), (c && !_ && !g && d || o.refine === "ADD" && d) && (o.__inFrustum && (o.__visible = !0, t.visible++), o.__active = !0, t.active++), o.refine !== "ADD" && c && !_ && d)
      for (let f = 0, p = m.length; f < p; f++) {
        let x = m[f];
        U(x, s) && !i.isFull() && (x.__depthFromRenderedParent = o.__depthFromRenderedParent + 1, Ye(x, x.__depthFromRenderedParent, e));
      }
    else
      for (let f = 0, p = m.length; f < p; f++) {
        let x = m[f];
        U(x, s) && Ae(x, e);
      }
  }
  function ke(o, e) {
    let t = e.frameCount, s = U(o, t);
    if (s || o.__usedLastFrame) {
      let n = !1, r = !1;
      s && (n = o.__active, e.displayActiveTiles ? r = o.__active || o.__visible : r = o.__visible), !o.__contentEmpty && o.__loadingState === 3 && (o.__wasSetActive !== n && e.setTileActive(o, n), o.__wasSetVisible !== r && e.setTileVisible(o, r)), o.__wasSetActive = n, o.__wasSetVisible = r, o.__usedLastFrame = s;
      let i = o.children;
      for (let a = 0, c = i.length; a < c; a++) {
        let l = i[a];
        ke(l, e);
      }
    }
  }

  // node_modules/3d-tiles-renderer/src/base/TilesRendererBase.js
  var Ke = (o, e) => o.__depth !== e.__depth ? o.__depth > e.__depth ? -1 : 1 : o.__inFrustum !== e.__inFrustum ? o.__inFrustum ? 1 : -1 : o.__used !== e.__used ? o.__used ? 1 : -1 : o.__error !== e.__error ? o.__error > e.__error ? 1 : -1 : o.__distanceFromCamera !== e.__distanceFromCamera ? o.__distanceFromCamera > e.__distanceFromCamera ? -1 : 1 : 0, Dt = (o) => 1 / (o.__depthFromRenderedParent + 1), re = class {
    get rootTileSet() {
      let e = this.tileSets[this.rootURL];
      return !e || e instanceof Promise ? null : e;
    }
    get root() {
      let e = this.rootTileSet;
      return e ? e.root : null;
    }
    constructor(e) {
      this.tileSets = {}, this.rootURL = e, this.fetchOptions = {}, this.preprocessURL = null;
      let t = new se();
      t.unloadPriorityCallback = Dt;
      let s = new J();
      s.maxJobs = 4, s.priorityCallback = Ke;
      let n = new J();
      n.maxJobs = 1, n.priorityCallback = Ke, this.lruCache = t, this.downloadQueue = s, this.parseQueue = n, this.stats = {
        parsing: 0,
        downloading: 0,
        failed: 0,
        inFrustum: 0,
        used: 0,
        active: 0,
        visible: 0
      }, this.frameCount = 0, this.errorTarget = 6, this.errorThreshold = 1 / 0, this.loadSiblings = !0, this.displayActiveTiles = !1, this.maxDepth = 1 / 0, this.stopAtEmptyTiles = !0;
    }
    traverse(e, t) {
      let n = this.tileSets[this.rootURL];
      !n || !n.root || Ie(n.root, (r, ...i) => (this.ensureChildrenArePreprocessed(r), e ? e(r, ...i) : !1), t);
    }
    // Public API
    update() {
      let e = this.stats, t = this.lruCache, s = this.tileSets, n = s[this.rootURL];
      if (this.rootURL in s) {
        if (!n || !n.root)
          return;
      } else {
        this.loadRootTileSet(this.rootURL);
        return;
      }
      let r = n.root;
      e.inFrustum = 0, e.used = 0, e.active = 0, e.visible = 0, this.frameCount++, Fe(r, this), De(r, this), Ae(r, this), ke(r, this), t.scheduleUnload();
    }
    // Overrideable
    parseTile(e, t, s) {
      return null;
    }
    disposeTile(e) {
    }
    preprocessNode(e, t, s = null) {
      if (e.content && (!("uri" in e.content) && "url" in e.content && (e.content.uri = e.content.url, delete e.content.url), e.content.uri && (e.content.uri = new URL(e.content.uri, t + "/").toString()), e.content.boundingVolume && !("box" in e.content.boundingVolume || "sphere" in e.content.boundingVolume || "region" in e.content.boundingVolume) && delete e.content.boundingVolume), e.parent = s, e.children = e.children || [], e.content && e.content.uri) {
        let r = Re(e.content.uri), i = !!(r && r.toLowerCase() === "json");
        e.__externalTileSet = i, e.__contentEmpty = i;
      } else
        e.__externalTileSet = !1, e.__contentEmpty = !0;
      e.__distanceFromCamera = 1 / 0, e.__error = 1 / 0, e.__inFrustum = !1, e.__isLeaf = !1, e.__usedLastFrame = !1, e.__used = !1, e.__wasSetVisible = !1, e.__visible = !1, e.__childrenWereVisible = !1, e.__allChildrenLoaded = !1, e.__wasSetActive = !1, e.__active = !1, e.__loadingState = 0, e.__loadIndex = 0, e.__loadAbort = null, e.__depthFromRenderedParent = -1, s === null ? (e.__depth = 0, e.refine = e.refine || "REPLACE") : (e.__depth = s.__depth + 1, e.refine = e.refine || s.refine), e.__basePath = t;
    }
    setTileActive(e, t) {
    }
    setTileVisible(e, t) {
    }
    calculateError(e) {
      return 0;
    }
    tileInView(e) {
      return !0;
    }
    ensureChildrenArePreprocessed(e) {
      let t = e.children;
      for (let s = 0, n = t.length; s < n; s++) {
        let r = t[s];
        if ("__depth" in r)
          break;
        this.preprocessNode(r, e.__basePath, e);
      }
    }
    resetFailedTiles() {
      let e = this.stats;
      e.failed !== 0 && (this.traverse((t) => {
        t.__loadingState === 4 && (t.__loadingState = 0);
      }), e.failed = 0);
    }
    // Private Functions
    fetchTileSet(e, t, s = null) {
      return fetch(e, t).then((n) => {
        if (n.ok)
          return n.json();
        throw new Error(`TilesRenderer: Failed to load tileset "${e}" with status ${n.status} : ${n.statusText}`);
      }).then((n) => {
        let r = n.asset.version, [i, a] = r.split(".").map((l) => parseInt(l));
        console.assert(
          i <= 1,
          "TilesRenderer: asset.version is expected to be a 1.x or a compatible version."
        ), i === 1 && a > 0 && console.warn("TilesRenderer: tiles versions at 1.1 or higher have limited support. Some new extensions and features may not be supported.");
        let c = e.replace(/\/[^\/]*\/?$/, "");
        return c = new URL(c, window.location.href).toString(), this.preprocessNode(n.root, c, s), n;
      });
    }
    loadRootTileSet(e) {
      let t = this.tileSets;
      if (e in t)
        return t[e] instanceof Error ? Promise.reject(t[e]) : Promise.resolve(t[e]);
      {
        let s = this.fetchTileSet(this.preprocessURL ? this.preprocessURL(e) : e, this.fetchOptions).then((n) => {
          t[e] = n;
        });
        return s.catch((n) => {
          console.error(n), t[e] = n;
        }), t[e] = s, s;
      }
    }
    requestTileContents(e) {
      if (e.__loadingState !== 0)
        return;
      let t = this.stats, s = this.lruCache, n = this.downloadQueue, r = this.parseQueue, i = e.__externalTileSet;
      s.add(e, (u) => {
        u.__loadingState === 1 ? (u.__loadAbort.abort(), u.__loadAbort = null) : i ? u.children.length = 0 : this.disposeTile(u), u.__loadingState === 1 ? t.downloading-- : u.__loadingState === 2 && t.parsing--, u.__loadingState = 0, u.__loadIndex++, r.remove(u), n.remove(u);
      }), e.__loadIndex++;
      let a = e.__loadIndex, c = new AbortController(), l = c.signal;
      t.downloading++, e.__loadAbort = c, e.__loadingState = 1;
      let h = (u) => {
        e.__loadIndex === a && (u.name !== "AbortError" ? (r.remove(e), n.remove(e), e.__loadingState === 2 ? t.parsing-- : e.__loadingState === 1 && t.downloading--, t.failed++, console.error(`TilesRenderer : Failed to load tile at url "${e.content.uri}".`), console.error(u), e.__loadingState = 4) : s.remove(e));
      };
      i ? n.add(e, (u) => {
        if (u.__loadIndex !== a)
          return Promise.resolve();
        let d = this.preprocessURL ? this.preprocessURL(u.content.uri) : u.content.uri;
        return this.fetchTileSet(d, Object.assign({ signal: l }, this.fetchOptions), u);
      }).then((u) => {
        e.__loadIndex === a && (t.downloading--, e.__loadAbort = null, e.__loadingState = 3, e.children.push(u.root));
      }).catch(h) : n.add(e, (u) => {
        if (u.__loadIndex !== a)
          return Promise.resolve();
        let d = this.preprocessURL ? this.preprocessURL(u.content.uri) : u.content.uri;
        return fetch(d, Object.assign({ signal: l }, this.fetchOptions));
      }).then((u) => {
        if (e.__loadIndex === a) {
          if (u.ok)
            return u.arrayBuffer();
          throw new Error(`Failed to load model with error code ${u.status}`);
        }
      }).then((u) => {
        if (e.__loadIndex === a)
          return t.downloading--, t.parsing++, e.__loadAbort = null, e.__loadingState = 2, r.add(e, (d) => {
            if (d.__loadIndex !== a)
              return Promise.resolve();
            let g = d.content.uri, m = Re(g);
            return this.parseTile(u, d, m);
          });
      }).then(() => {
        e.__loadIndex === a && (t.parsing--, e.__loadingState = 3, e.__wasSetVisible && this.setTileVisible(e, !0), e.__wasSetActive && this.setTileActive(e, !0));
      }).catch(h);
    }
    dispose() {
      let e = this.lruCache, t = [];
      this.traverse((s) => (t.push(s), !1));
      for (let s = 0, n = t.length; s < n; s++)
        e.remove(t[s]);
      this.stats = {
        parsing: 0,
        downloading: 0,
        failed: 0,
        inFrustum: 0,
        used: 0,
        active: 0,
        visible: 0
      }, this.frameCount = 0;
    }
  };

  // stub:./B3DMLoader.js
  var ie = class {
    constructor() {
    }
    parse() {
      return Promise.reject(new Error("unsupported tile format"));
    }
  };

  // stub:./PNTSLoader.js
  var ae = class {
    constructor() {
    }
    parse() {
      return Promise.reject(new Error("unsupported tile format"));
    }
  };

  // stub:./I3DMLoader.js
  var ce = class {
    constructor() {
    }
    parse() {
      return Promise.reject(new Error("unsupported tile format"));
    }
  };

  // stub:./CMPTLoader.js
  var le = class {
    constructor() {
    }
    parse() {
      return Promise.reject(new Error("unsupported tile format"));
    }
  };

  // node_modules/3d-tiles-renderer/src/three/GLTFExtensionLoader.js
  var nt = T(P(), 1), ot = T(st(), 1);

  // node_modules/3d-tiles-renderer/src/base/LoaderBase.js
  var he = class {
    constructor() {
      this.fetchOptions = {}, this.workingPath = "";
    }
    load(e) {
      return fetch(e, this.fetchOptions).then((t) => {
        if (!t.ok)
          throw new Error(`Failed to load file "${e}" with status ${t.status} : ${t.statusText}`);
        return t.arrayBuffer();
      }).then((t) => (this.workingPath === "" && (this.workingPath = this.workingPathForURL(e)), this.parse(t)));
    }
    resolveExternalURL(e) {
      return /^[^\\/]/.test(e) ? this.workingPath + "/" + e : e;
    }
    workingPathForURL(e) {
      let t = e.split(/[\\/]/g);
      return t.pop(), t.join("/") + "/";
    }
    parse(e) {
      throw new Error("LoaderBase: Parse not implemented.");
    }
  };

  // node_modules/3d-tiles-renderer/src/three/gltf/GLTFCesiumRTCExtension.js
  var ue = class {
    constructor() {
      this.name = "CESIUM_RTC";
    }
    afterRoot(e) {
      if (e.parser.json.extensions && e.parser.json.extensions.CESIUM_RTC) {
        let { center: t } = e.parser.json.extensions.CESIUM_RTC;
        t && (e.scene.position.x += t[0], e.scene.position.y += t[1], e.scene.position.z += t[2]);
      }
    }
  };

  // node_modules/3d-tiles-renderer/src/three/GLTFExtensionLoader.js
  var de = class extends he {
    constructor(e = nt.DefaultLoadingManager) {
      super(), this.manager = e;
    }
    parse(e) {
      return new Promise((t, s) => {
        let n = this.manager, r = this.fetchOptions, i = n.getHandler("path.gltf") || n.getHandler("path.glb");
        i || (i = new ot.GLTFLoader(n), i.register(() => new ue())), r.credentials === "include" && r.mode === "cors" && i.setCrossOrigin("use-credentials"), "credentials" in r && i.setWithCredentials(r.credentials === "include"), r.headers && (console.log(r), i.setRequestHeader(r.headers));
        let a = i.resourcePath || i.path || this.workingPath;
        !/[\\/]$/.test(a) && a.length && (a += "/"), i.parse(e, a, (c) => {
          t(c);
        }, s);
      });
    }
  };

  // node_modules/3d-tiles-renderer/src/three/TilesGroup.js
  var fe = T(P(), 1), pe = new fe.Matrix4(), me = class extends fe.Group {
    constructor(e) {
      super(), this.name = "TilesRenderer.TilesGroup", this.tilesRenderer = e;
    }
    raycast(e, t) {
      return this.tilesRenderer.optimizeRaycast ? (this.tilesRenderer.raycast(e, t), !1) : !0;
    }
    updateMatrixWorld(e) {
      if (this.matrixAutoUpdate && this.updateMatrix(), this.matrixWorldNeedsUpdate || e) {
        this.parent === null ? pe.copy(this.matrix) : pe.multiplyMatrices(this.parent.matrixWorld, this.matrix), this.matrixWorldNeedsUpdate = !1;
        let t = pe.elements, s = this.matrixWorld.elements, n = !1;
        for (let r = 0; r < 16; r++) {
          let i = t[r], a = s[r];
          if (Math.abs(i - a) > Number.EPSILON) {
            n = !0;
            break;
          }
        }
        if (n) {
          this.matrixWorld.copy(pe);
          let r = this.children;
          for (let i = 0, a = r.length; i < a; i++)
            r[i].updateMatrixWorld();
        }
      }
    }
  };

  // node_modules/3d-tiles-renderer/src/three/TilesRenderer.js
  var S = T(P(), 1);

  // node_modules/3d-tiles-renderer/src/three/raycastTraverse.js
  var D = T(P(), 1), At = parseInt(D.REVISION) < 165, ge = new D.Matrix4(), rt = new D.Ray(), Oe = new D.Vector3(), _e = [];
  function it(o, e) {
    return o.distance - e.distance;
  }
  function at(o, e, t) {
    At ? (o.traverse((s) => {
      Object.getPrototypeOf(s).raycast.call(s, e, t);
    }), _e.sort(it)) : e.intersectObject(o, !0, t);
  }
  function kt(o, e) {
    at(o, e, _e);
    let t = _e[0] || null;
    return _e.length = 0, t;
  }
  function ze(o, e, t, s = null) {
    let { group: n, activeTiles: r } = o;
    o.ensureChildrenArePreprocessed(e), s === null && (s = rt, ge.copy(n.matrixWorld).invert(), s.copy(t.ray).applyMatrix4(ge));
    let i = [], a = e.children;
    for (let h = 0, u = a.length; h < u; h++) {
      let d = a[h];
      if (!d.__used)
        continue;
      d.cached.boundingVolume.intersectRay(s, Oe) !== null && (Oe.applyMatrix4(n.matrixWorld), i.push({
        distance: Oe.distanceToSquared(t.ray.origin),
        tile: d
      }));
    }
    i.sort(it);
    let c = null, l = 1 / 0;
    if (r.has(e)) {
      let h = kt(e.cached.scene, t);
      h && (c = h, l = h.distance * h.distance);
    }
    for (let h = 0, u = i.length; h < u; h++) {
      let d = i[h], g = d.distance, m = d.tile;
      if (g > l)
        break;
      let _ = ze(o, m, t, s);
      if (_) {
        let f = _.distance * _.distance;
        f < l && (c = _, l = f);
      }
    }
    return c;
  }
  function Be(o, e, t, s, n = null) {
    let { group: r, activeTiles: i } = o, { scene: a, boundingVolume: c } = e.cached;
    if (o.ensureChildrenArePreprocessed(e), n === null && (n = rt, ge.copy(r.matrixWorld).invert(), n.copy(t.ray).applyMatrix4(ge)), !e.__used || !c.intersectsRay(n))
      return;
    i.has(e) && at(a, t, s);
    let l = e.children;
    for (let h = 0, u = l.length; h < u; h++)
      Be(o, l[h], t, s, n);
  }

  // node_modules/3d-tiles-renderer/src/utilities/readMagicBytes.js
  function ct(o) {
    let e;
    if (o instanceof DataView ? e = o : e = new DataView(o), String.fromCharCode(e.getUint8(0)) === "{")
      return null;
    let t = "";
    for (let s = 0; s < 4; s++)
      t += String.fromCharCode(e.getUint8(s));
    return t;
  }

  // node_modules/3d-tiles-renderer/src/three/math/TileBoundingVolume.js
  var R = T(P(), 1);

  // node_modules/3d-tiles-renderer/src/three/math/OBB.js
  var M = T(P(), 1), xe = new M.Vector3(), be = new M.Vector3(), L = new M.Vector3(), Q = class {
    constructor(e = new M.Box3(), t = new M.Matrix4()) {
      this.box = e.clone(), this.transform = t.clone(), this.inverseTransform = new M.Matrix4(), this.points = new Array(8).fill().map(() => new M.Vector3()), this.planes = new Array(6).fill().map(() => new M.Plane());
    }
    update() {
      let { points: e, inverseTransform: t, transform: s, box: n } = this;
      t.copy(s).invert();
      let { min: r, max: i } = n, a = 0;
      for (let c = -1; c <= 1; c += 2)
        for (let l = -1; l <= 1; l += 2)
          for (let h = -1; h <= 1; h += 2)
            e[a].set(
              c < 0 ? r.x : i.x,
              l < 0 ? r.y : i.y,
              h < 0 ? r.z : i.z
            ).applyMatrix4(s), a++;
      this.updatePlanes();
    }
    updatePlanes() {
      xe.copy(this.box.min).applyMatrix4(this.transform), be.copy(this.box.max).applyMatrix4(this.transform), L.set(0, 0, 1).transformDirection(this.transform), this.planes[0].setFromNormalAndCoplanarPoint(L, xe), this.planes[1].setFromNormalAndCoplanarPoint(L, be).negate(), L.set(0, 1, 0).transformDirection(this.transform), this.planes[2].setFromNormalAndCoplanarPoint(L, xe), this.planes[3].setFromNormalAndCoplanarPoint(L, be).negate(), L.set(1, 0, 0).transformDirection(this.transform), this.planes[4].setFromNormalAndCoplanarPoint(L, xe), this.planes[5].setFromNormalAndCoplanarPoint(L, be).negate();
    }
    // based on three.js' Box3 "intersects frustum" function
    intersectsFrustum(e) {
      let { points: t } = this, { planes: s } = e;
      for (let n = 0; n < 6; n++) {
        let r = s[n], i = -1 / 0;
        for (let a = 0; a < 8; a++) {
          let c = t[a], l = r.distanceToPoint(c);
          i = i < l ? l : i;
        }
        if (i < 0)
          return !1;
      }
      for (let n = 0; n < 6; n++) {
        let r = this.planes[n], i = -1 / 0;
        for (let a = 0; a < 8; a++) {
          let c = e.points[a], l = r.distanceToPoint(c);
          i = i < l ? l : i;
        }
        if (i < 0)
          return !1;
      }
      return !0;
    }
  };

  // node_modules/3d-tiles-renderer/src/three/math/EllipsoidRegion.js
  var V = T(P(), 1), G = T(P(), 1);

  // node_modules/3d-tiles-renderer/src/three/math/Ellipsoid.js
  var b = T(P(), 1);

  // node_modules/3d-tiles-renderer/src/three/math/GeoUtils.js
  var X = T(P(), 1), vs = new X.Spherical(), Ts = new X.Vector3();
  function lt(o) {
    let { x: e, y: t, z: s } = o;
    o.x = s, o.y = e, o.z = t;
  }
  function ht(o) {
    return -o + Math.PI / 2;
  }

  // node_modules/3d-tiles-renderer/src/three/math/Ellipsoid.js
  var ut = new b.Spherical(), A = new b.Vector3(), w = new b.Vector3(), Se = new b.Vector3(), Vt = new b.Vector3(), ye = new b.Matrix4(), Ne = new b.Sphere(), dt = new b.Vector3(), We = new b.Vector3(), je = new b.Vector3(), pt = new b.Vector3(), mt = new b.Ray(), Ut = 1e-12, Ot = 0.1, N = class {
    constructor(e = 1, t = 1, s = 1) {
      this.radius = new b.Vector3(e, t, s);
    }
    intersectRay(e, t) {
      return ye.makeScale(...this.radius).invert(), Ne.center.set(0, 0, 0), Ne.radius = 1, mt.copy(e).applyMatrix4(ye), mt.intersectSphere(Ne, t) ? (ye.makeScale(...this.radius), t.applyMatrix4(ye), t) : null;
    }
    // returns a frame with Z indicating altitude
    // Y pointing north
    // X pointing east
    constructLatLonFrame(e, t, s) {
      return this.getCartographicToPosition(e, t, 0, pt), this.getCartographicToNormal(e, t, je), this.getNorthernTangent(e, t, We), dt.crossVectors(We, je), s.makeBasis(dt, We, je).setPosition(pt);
    }
    getNorthernTangent(e, t, s, n = Vt) {
      let r = 1, i = e + 1e-7;
      e > Math.PI / 4 && (r = -1, i = e - 1e-7);
      let a = this.getCartographicToNormal(e, t, w).normalize(), c = this.getCartographicToNormal(i, t, Se).normalize();
      return n.crossVectors(a, c).normalize().multiplyScalar(r), s.crossVectors(n, a).normalize();
    }
    getCartographicToPosition(e, t, s, n) {
      this.getCartographicToNormal(e, t, A);
      let r = this.radius;
      w.copy(A), w.x *= r.x ** 2, w.y *= r.y ** 2, w.z *= r.z ** 2;
      let i = Math.sqrt(A.dot(w));
      return w.divideScalar(i), n.copy(w).addScaledVector(A, s);
    }
    getPositionToCartographic(e, t) {
      this.getPositionToSurfacePoint(e, w), this.getPositionToNormal(e, A);
      let s = Se.subVectors(e, w);
      return t.lon = Math.atan2(A.y, A.x), t.lat = Math.asin(A.z), t.height = Math.sign(s.dot(e)) * s.length(), t;
    }
    getCartographicToNormal(e, t, s) {
      return ut.set(1, ht(e), t), s.setFromSpherical(ut).normalize(), lt(s), s;
    }
    getPositionToNormal(e, t) {
      let s = this.radius;
      return t.copy(e), t.x /= s.x ** 2, t.y /= s.y ** 2, t.z /= s.z ** 2, t.normalize(), t;
    }
    getPositionToSurfacePoint(e, t) {
      let s = this.radius, n = 1 / s.x ** 2, r = 1 / s.y ** 2, i = 1 / s.z ** 2, a = e.x * e.x * n, c = e.y * e.y * r, l = e.z * e.z * i, h = a + c + l, u = Math.sqrt(1 / h), d = w.copy(e).multiplyScalar(u);
      if (h < Ot)
        return isFinite(u) ? t.copy(d) : null;
      let g = Se.set(
        d.x * n * 2,
        d.y * r * 2,
        d.z * i * 2
      ), m = (1 - u) * e.length() / (0.5 * g.length()), _ = 0, f, p, x, v, C, O, y, z, ee, B, He;
      do {
        m -= _, x = 1 / (1 + m * n), v = 1 / (1 + m * r), C = 1 / (1 + m * i), O = x * x, y = v * v, z = C * C, ee = O * x, B = y * v, He = z * C, f = a * O + c * y + l * z - 1, p = a * ee * n + c * B * r + l * He * i;
        let Tt = -2 * p;
        _ = f / Tt;
      } while (Math.abs(f) > Ut);
      return t.set(
        e.x * x,
        e.y * v,
        e.z * C
      );
    }
    calculateHorizonDistance(e, t) {
      let s = this.calculateEffectiveRadius(e);
      return Math.sqrt(2 * s * t + t ** 2);
    }
    calculateEffectiveRadius(e) {
      let t = this.radius.x, n = 1 - this.radius.z ** 2 / t ** 2, r = e * b.MathUtils.DEG2RAD, i = Math.sin(r) ** 2;
      return t / Math.sqrt(1 - n * i);
    }
    getPositionElevation(e) {
      this.getPositionToSurfacePoint(e, w);
      let t = Se.subVectors(e, w);
      return Math.sign(t.dot(e)) * t.length();
    }
  };

  // node_modules/3d-tiles-renderer/src/three/math/EllipsoidRegion.js
  var k = Math.PI, we = k / 2, Y = new G.Vector3(), W = new G.Vector3(), j = new G.Vector3(), ft = new V.Matrix4(), Z = 0, Ge = [];
  function zt(o = !1) {
    return o ? (Ge[Z] || (Ge[Z] = new G.Vector3()), Z++, Ge[Z - 1]) : new G.Vector3();
  }
  function _t() {
    Z = 0;
  }
  var ve = class extends N {
    constructor(e, t, s, n = -we, r = we, i = 0, a = 2 * k, c = 0, l = 0) {
      super(e, t, s), this.latStart = n, this.latEnd = r, this.lonStart = i, this.lonEnd = a, this.heightStart = c, this.heightEnd = l;
    }
    _getPoints(e = !1) {
      let {
        latStart: t,
        latEnd: s,
        lonStart: n,
        lonEnd: r,
        heightStart: i,
        heightEnd: a
      } = this, c = V.MathUtils.mapLinear(0.5, 0, 1, t, s), l = V.MathUtils.mapLinear(0.5, 0, 1, n, r), h = Math.floor(n / we) * we, u = [
        [-k / 2, 0],
        [k / 2, 0],
        [0, h],
        [0, h + k / 2],
        [0, h + k],
        [0, h + 3 * k / 2],
        [t, r],
        [s, r],
        [t, n],
        [s, n],
        [0, n],
        [0, r],
        [c, l],
        [t, l],
        [s, l],
        [c, n],
        [c, r]
      ], d = [], g = u.length;
      for (let m = 0; m <= 1; m++) {
        let _ = V.MathUtils.mapLinear(m, 0, 1, i, a);
        for (let f = 0, p = g; f < p; f++) {
          let [x, v] = u[f];
          if (x >= t && x <= s && v >= n && v <= r) {
            let C = zt(e);
            d.push(C), this.getCartographicToPosition(x, v, _, C);
          }
        }
      }
      return d;
    }
    getBoundingBox(e, t) {
      _t();
      let {
        latStart: s,
        latEnd: n,
        lonStart: r,
        lonEnd: i
      } = this;
      if (n - s < k / 2) {
        let l = V.MathUtils.mapLinear(0.5, 0, 1, s, n), h = V.MathUtils.mapLinear(0.5, 0, 1, r, i);
        this.getCartographicToNormal(l, h, j), W.set(0, 0, 1), Y.crossVectors(W, j), W.crossVectors(Y, j), t.makeBasis(Y, W, j);
      } else
        Y.set(1, 0, 0), W.set(0, 1, 0), j.set(0, 0, 1), t.makeBasis(Y, W, j);
      ft.copy(t).invert();
      let c = this._getPoints(!0);
      for (let l = 0, h = c.length; l < h; l++)
        c[l].applyMatrix4(ft);
      e.makeEmpty(), e.setFromPoints(c);
    }
    getBoundingSphere(e, t) {
      _t();
      let s = this._getPoints(!0);
      e.makeEmpty(), e.setFromPoints(s, t);
    }
  };

  // node_modules/3d-tiles-renderer/src/three/math/TileBoundingVolume.js
  var E = new R.Vector3(), I = new R.Vector3(), F = new R.Vector3(), gt = new R.Vector3(), xt = new R.Vector3(), bt = new R.Vector3(), q = new R.Ray(), Te = class {
    constructor() {
      this.sphere = null, this.obb = null, this.region = null, this.regionObb = null;
    }
    intersectsRay(e) {
      let t = this.sphere, s = this.obb || this.regionObb;
      return !(t && !e.intersectsSphere(t) || s && (q.copy(e).applyMatrix4(s.inverseTransform), !q.intersectsBox(s.box)));
    }
    intersectRay(e, t = null) {
      let s = this.sphere, n = this.obb || this.regionObb, r = -1 / 0, i = -1 / 0;
      s && e.intersectSphere(s, xt) && (r = s.containsPoint(e.origin) ? 0 : e.origin.distanceToSquared(xt)), n && (q.copy(e).applyMatrix4(n.inverseTransform), q.intersectBox(n.box, bt) && (i = n.box.containsPoint(q.origin) ? 0 : q.origin.distanceToSquared(bt)));
      let a = Math.max(r, i);
      return a === -1 / 0 ? null : (e.at(Math.sqrt(a), t), t);
    }
    distanceToPoint(e) {
      let t = this.sphere, s = this.obb || this.regionObb, n = -1 / 0, r = -1 / 0;
      return t && (n = Math.max(t.distanceToPoint(e), 0)), s && (gt.copy(e).applyMatrix4(s.inverseTransform), r = s.box.distanceToPoint(gt)), n > r ? n : r;
    }
    intersectsFrustum(e) {
      let t = this.obb || this.regionObb, s = this.sphere;
      return s && !e.intersectsSphere(s) || t && !t.intersectsFrustum(e) ? !1 : !!(s || t);
    }
    getOBB(e, t) {
      let s = this.obb || this.regionObb;
      s ? (e.copy(s.box), t.copy(s.transform)) : (this.getAABB(e), t.identity());
    }
    getAABB(e) {
      if (this.sphere)
        this.sphere.getBoundingBox(e);
      else {
        let t = this.obb || this.regionObb;
        e.copy(t.box).applyMatrix4(t.transform);
      }
    }
    getSphere(e) {
      if (this.sphere)
        e.copy(this.sphere);
      else if (this.region)
        this.region.getBoundingSphere(e);
      else {
        let t = this.obb || this.regionObb;
        t.box.getBoundingSphere(e), e.applyMatrix4(t.transform);
      }
    }
    setObbData(e, t) {
      let s = new Q();
      E.set(e[3], e[4], e[5]), I.set(e[6], e[7], e[8]), F.set(e[9], e[10], e[11]);
      let n = E.length(), r = I.length(), i = F.length();
      E.normalize(), I.normalize(), F.normalize(), n === 0 && E.crossVectors(I, F), r === 0 && I.crossVectors(E, F), i === 0 && F.crossVectors(E, I), s.transform.set(
        E.x,
        I.x,
        F.x,
        e[0],
        E.y,
        I.y,
        F.y,
        e[1],
        E.z,
        I.z,
        F.z,
        e[2],
        0,
        0,
        0,
        1
      ).premultiply(t), s.box.min.set(-n, -r, -i), s.box.max.set(n, r, i), s.update(), this.obb = s;
    }
    setSphereData(e, t, s, n, r) {
      let i = new R.Sphere();
      i.center.set(e, t, s), i.radius = n, i.applyMatrix4(r), this.sphere = i;
    }
    setRegionData(e, t, s, n, r, i) {
      let a = new ve(
        6378137,
        6378137,
        ne,
        t,
        n,
        e,
        s,
        r,
        i
      ), c = new Q();
      a.getBoundingBox(c.box, c.transform), c.update(), this.region = a, this.regionObb = c;
    }
  };

  // node_modules/3d-tiles-renderer/src/three/math/ExtendedFrustum.js
  var H = T(P(), 1), Bt = new H.Matrix3();
  function Nt(o, e, t, s) {
    let n = Bt.set(
      o.normal.x,
      o.normal.y,
      o.normal.z,
      e.normal.x,
      e.normal.y,
      e.normal.z,
      t.normal.x,
      t.normal.y,
      t.normal.z
    );
    return s.set(-o.constant, -e.constant, -t.constant), s.applyMatrix3(n.invert()), s;
  }
  var Pe = class extends H.Frustum {
    constructor() {
      super(), this.points = Array(8).fill().map(() => new H.Vector3());
    }
    setFromProjectionMatrix(e, t) {
      super.setFromProjectionMatrix(e, t), this.calculateFrustumPoints();
    }
    calculateFrustumPoints() {
      let { planes: e, points: t } = this;
      [
        [e[0], e[3], e[4]],
        // Near top left
        [e[1], e[3], e[4]],
        // Near top right
        [e[0], e[2], e[4]],
        // Near bottom left
        [e[1], e[2], e[4]],
        // Near bottom right
        [e[0], e[3], e[5]],
        // Far top left
        [e[1], e[3], e[5]],
        // Far top right
        [e[0], e[2], e[5]],
        // Far bottom left
        [e[1], e[2], e[5]]
        // Far bottom right
      ].forEach((n, r) => {
        Nt(n[0], n[1], n[2], t[r]);
      });
    }
  };

  // node_modules/3d-tiles-renderer/src/three/TilesRenderer.js
  var St = parseInt(S.REVISION) < 165, wt = Symbol("INITIAL_FRUSTUM_CULLED"), Me = new S.Matrix4(), qe = new S.Matrix4(), $ = new S.Vector3(), Wt = new S.Vector3(1, 0, 0), jt = new S.Vector3(0, 1, 0);
  function yt(o, e) {
    o.traverse((t) => {
      t.frustumCulled = t[wt] && e;
    });
  }
  var Ce = class extends re {
    get autoDisableRendererCulling() {
      return this._autoDisableRendererCulling;
    }
    set autoDisableRendererCulling(e) {
      this._autoDisableRendererCulling !== e && (super._autoDisableRendererCulling = e, this.forEachLoadedModel((t) => {
        yt(t, !e);
      }));
    }
    constructor(...e) {
      super(...e), this.group = new me(this), this.cameras = [], this.cameraMap = /* @__PURE__ */ new Map(), this.cameraInfo = [], this.activeTiles = /* @__PURE__ */ new Set(), this.visibleTiles = /* @__PURE__ */ new Set(), this.optimizeRaycast = !0, this._autoDisableRendererCulling = !0, this._eventDispatcher = new S.EventDispatcher(), this.onLoadTileSet = null, this.onLoadModel = null, this.onDisposeModel = null, this.onTileVisibilityChange = null;
      let t = new S.LoadingManager();
      if (t.setURLModifier((s) => this.preprocessURL ? this.preprocessURL(s) : s), this.manager = t, St) {
        let s = this;
        this._overridenRaycast = function(n, r) {
          s.optimizeRaycast || Object.getPrototypeOf(this).raycast.call(this, n, r);
        };
      }
    }
    addEventListener(...e) {
      this._eventDispatcher.addEventListener(...e);
    }
    hasEventListener(...e) {
      this._eventDispatcher.hasEventListener(...e);
    }
    removeEventListener(...e) {
      this._eventDispatcher.removeEventListener(...e);
    }
    dispatchEvent(...e) {
      this._eventDispatcher.dispatchEvent(...e);
    }
    /* Public API */
    getBounds(...e) {
      return console.warn("TilesRenderer: getBounds has been renamed to getBoundingBox."), this.getBoundingBox(...e);
    }
    getOrientedBounds(...e) {
      return console.warn("TilesRenderer: getOrientedBounds has been renamed to getOrientedBoundingBox."), this.getOrientedBoundingBox(...e);
    }
    getBoundingBox(e) {
      if (!this.root)
        return !1;
      let t = this.root.cached.boundingVolume;
      return t && t.getAABB(e), !0;
    }
    getOrientedBoundingBox(e, t) {
      if (!this.root)
        return !1;
      let s = this.root.cached.boundingVolume;
      return s && s.getOBB(e, t), !0;
    }
    getBoundingSphere(e) {
      if (!this.root)
        return !1;
      let t = this.root.cached.boundingVolume;
      return t ? (t.getSphere(e), !0) : !1;
    }
    forEachLoadedModel(e) {
      this.traverse((t) => {
        let s = t.cached.scene;
        s && e(s, t);
      });
    }
    raycast(e, t) {
      if (this.root)
        if (e.firstHitOnly) {
          let s = ze(this, this.root, e);
          s && t.push(s);
        } else
          Be(this, this.root, e, t);
    }
    hasCamera(e) {
      return this.cameraMap.has(e);
    }
    setCamera(e) {
      let t = this.cameras, s = this.cameraMap;
      return s.has(e) ? !1 : (s.set(e, new S.Vector2()), t.push(e), !0);
    }
    setResolution(e, t, s) {
      let n = this.cameraMap;
      return n.has(e) ? (t instanceof S.Vector2 ? n.get(e).copy(t) : n.get(e).set(t, s), !0) : !1;
    }
    setResolutionFromRenderer(e, t) {
      let s = this.cameraMap;
      if (!s.has(e))
        return !1;
      let n = s.get(e);
      return t.getSize(n), n.multiplyScalar(t.getPixelRatio()), !0;
    }
    deleteCamera(e) {
      let t = this.cameras, s = this.cameraMap;
      if (s.has(e)) {
        let n = t.indexOf(e);
        return t.splice(n, 1), s.delete(e), !0;
      }
      return !1;
    }
    /* Overriden */
    fetchTileSet(e, ...t) {
      let s = super.fetchTileSet(e, ...t);
      return s.then((n) => {
        queueMicrotask(() => {
          this.dispatchEvent({
            type: "load-tile-set",
            tileSet: n,
            url: e
          }), this.onLoadTileSet && this.onLoadTileSet(n, e);
        });
      }).catch(() => {
      }), s;
    }
    update() {
      let e = this.group, t = this.cameras, s = this.cameraMap, n = this.cameraInfo;
      if (t.length === 0) {
        console.warn("TilesRenderer: no cameras defined. Cannot update 3d tiles.");
        return;
      }
      for (; n.length > t.length; )
        n.pop();
      for (; n.length < t.length; )
        n.push({
          frustum: new Pe(),
          isOrthographic: !1,
          sseDenominator: -1,
          // used if isOrthographic:false
          position: new S.Vector3(),
          invScale: -1,
          pixelSize: 0
          // used if isOrthographic:true
        });
      qe.copy(e.matrixWorld).invert(), $.setFromMatrixScale(qe);
      let r = $.x;
      Math.abs(Math.max($.x - $.y, $.x - $.z)) > 1e-6 && console.warn("ThreeTilesRenderer : Non uniform scale used for tile which may cause issues when calculating screen space error.");
      for (let i = 0, a = n.length; i < a; i++) {
        let c = t[i], l = n[i], h = l.frustum, u = l.position, d = s.get(c);
        (d.width === 0 || d.height === 0) && console.warn("TilesRenderer: resolution for camera error calculation is not set.");
        let g = c.projectionMatrix.elements;
        if (l.isOrthographic = g[15] === 1, l.isOrthographic) {
          let m = 2 / g[0], _ = 2 / g[5];
          l.pixelSize = Math.max(_ / d.height, m / d.width);
        } else
          l.sseDenominator = 2 / g[5] / d.height;
        l.invScale = r, Me.copy(e.matrixWorld), Me.premultiply(c.matrixWorldInverse), Me.premultiply(c.projectionMatrix), h.setFromProjectionMatrix(Me), u.set(0, 0, 0), u.applyMatrix4(c.matrixWorld), u.applyMatrix4(qe);
      }
      super.update();
    }
    preprocessNode(e, t, s = null) {
      super.preprocessNode(e, t, s);
      let n = new S.Matrix4();
      if (e.transform) {
        let a = e.transform;
        for (let c = 0; c < 16; c++)
          n.elements[c] = a[c];
      }
      s && n.premultiply(s.cached.transform);
      let r = new S.Matrix4().copy(n).invert(), i = new Te();
      "sphere" in e.boundingVolume && i.setSphereData(...e.boundingVolume.sphere, n), "box" in e.boundingVolume && i.setObbData(e.boundingVolume.box, n), "region" in e.boundingVolume && i.setRegionData(...e.boundingVolume.region), e.cached = {
        loadIndex: 0,
        transform: n,
        transformInverse: r,
        active: !1,
        inFrustum: [],
        boundingVolume: i,
        scene: null,
        geometry: null,
        materials: null,
        textures: null
      };
    }
    parseTile(e, t, s) {
      t._loadIndex = t._loadIndex || 0, t._loadIndex++;
      let r = t.content.uri.split(/[\\\/]/g);
      r.pop();
      let i = r.join("/"), a = this.fetchOptions, c = this.manager, l = t._loadIndex, h = null, u = this.rootTileSet.asset && this.rootTileSet.asset.gltfUpAxis || "y", d = t.cached, g = d.transform, m = new S.Matrix4();
      switch (u.toLowerCase()) {
        case "x":
          m.makeRotationAxis(jt, -Math.PI / 2);
          break;
        case "y":
          m.makeRotationAxis(Wt, Math.PI / 2);
          break;
      }
      let _ = (ct(e) || s).toLowerCase();
      switch (_) {
        case "b3dm": {
          let p = new ie(c);
          p.workingPath = i, p.fetchOptions = a, p.adjustmentTransform.copy(m), h = p.parse(e);
          break;
        }
        case "pnts": {
          let p = new ae(c);
          p.workingPath = i, p.fetchOptions = a, h = p.parse(e);
          break;
        }
        case "i3dm": {
          let p = new ce(c);
          p.workingPath = i, p.fetchOptions = a, p.adjustmentTransform.copy(m), h = p.parse(e);
          break;
        }
        case "cmpt": {
          let p = new le(c);
          p.workingPath = i, p.fetchOptions = a, p.adjustmentTransform.copy(m), h = p.parse(e).then((x) => x.scene);
          break;
        }
        case "gltf":
        case "glb":
          let f = new de(c);
          f.workingPath = i, f.fetchOptions = a, h = f.parse(e);
          break;
        default:
          console.warn(`TilesRenderer: Content type "${_}" not supported.`), h = Promise.resolve(null);
          break;
      }
      return h.then((f) => {
        let p, x;
        if (f.isObject3D ? (p = f, x = null) : (p = f.scene, x = f), t._loadIndex !== l)
          return;
        p.updateMatrix(), (_ === "glb" || _ === "gltf") && p.matrix.multiply(m), p.matrix.premultiply(g), p.matrix.decompose(p.position, p.quaternion, p.scale), p.traverse((y) => {
          y[wt] = y.frustumCulled;
        }), yt(p, !this.autoDisableRendererCulling), St && p.traverse((y) => {
          y.raycast = this._overridenRaycast;
        });
        let v = [], C = [], O = [];
        p.traverse((y) => {
          if (y.geometry && C.push(y.geometry), y.material) {
            let z = y.material;
            v.push(y.material);
            for (let ee in z) {
              let B = z[ee];
              B && B.isTexture && O.push(B);
            }
          }
        }), d.materials = v, d.geometry = C, d.textures = O, d.scene = p, d.metadata = x, this.dispatchEvent({
          type: "load-model",
          scene: p,
          tile: t
        }), this.onLoadModel && this.onLoadModel(p, t);
      });
    }
    disposeTile(e) {
      let t = e.cached;
      if (t.scene) {
        let s = t.materials, n = t.geometry, r = t.textures, i = t.scene.parent;
        t.scene.traverse((a) => {
          a.userData.meshFeatures && a.userData.meshFeatures.dispose(), a.userData.structuralMetadata && a.userData.structuralMetadata.dispose();
        });
        for (let a = 0, c = n.length; a < c; a++)
          n[a].dispose();
        for (let a = 0, c = s.length; a < c; a++)
          s[a].dispose();
        for (let a = 0, c = r.length; a < c; a++) {
          let l = r[a];
          l.image instanceof ImageBitmap && l.image.close(), l.dispose();
        }
        i && i.remove(t.scene), this.dispatchEvent({
          type: "dispose-model",
          scene: t.scene,
          tile: e
        }), this.onDisposeModel && this.onDisposeModel(t.scene, e), t.scene = null, t.materials = null, t.textures = null, t.geometry = null, t.metadata = null;
      }
      this.activeTiles.delete(e), this.visibleTiles.delete(e), e._loadIndex++;
    }
    setTileVisible(e, t) {
      let s = e.cached.scene, n = this.visibleTiles, r = this.group;
      t ? (r.add(s), n.add(e), s.updateMatrixWorld(!0)) : (r.remove(s), n.delete(e)), this.dispatchEvent({
        type: "tile-visibility-change",
        scene: s,
        tile: e,
        visible: t
      }), this.onTileVisibilityChange && this.onTileVisibilityChange(s, e, t);
    }
    setTileActive(e, t) {
      let s = this.activeTiles;
      t ? s.add(e) : s.delete(e);
    }
    calculateError(e) {
      let t = e.cached, s = t.inFrustum, n = this.cameras, r = this.cameraInfo, i = t.boundingVolume, a = -1 / 0, c = 1 / 0;
      for (let l = 0, h = n.length; l < h; l++) {
        if (!s[l])
          continue;
        let u = r[l], d = u.invScale, g;
        if (u.isOrthographic) {
          let m = u.pixelSize;
          g = e.geometricError / (m * d);
        } else {
          let _ = i.distanceToPoint(u.position) * d, f = u.sseDenominator;
          g = e.geometricError / (_ * f), c = Math.min(c, _);
        }
        a = Math.max(a, g);
      }
      e.__distanceFromCamera = c, e.__error = a;
    }
    tileInView(e) {
      let t = e.cached, s = t.boundingVolume, n = t.inFrustum, r = this.cameraInfo, i = !1;
      for (let a = 0, c = r.length; a < c; a++) {
        let l = r[a].frustum;
        s.intersectsFrustum(l) ? (i = !0, n[a] = !0) : n[a] = !1;
      }
      return i;
    }
  };

  // node_modules/3d-tiles-renderer/src/three/math/GeoConstants.js
  var vt = new N(6378137, 6378137, ne);
  return It(Gt);
})();
