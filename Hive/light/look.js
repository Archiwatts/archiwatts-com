/* Hive light model: restores details the full-detail page adds at runtime.
   1. Pavilions: each region gets its own pastel plaster (same textures and region list as the full page).
   2. Amenity pool: the basin and water on the common-b deck (same size and position as the full page). */
(function () {
  var REGIONS = [{min:[-8.71094,13.72135,63.53516],max:[-.125,18.29341,72.11328],group:"HIVE_pavilions-b_static"},{min:[114.42969,13.72136,97.83594],max:[125.375,18.29342,108.33594],group:"HIVE_pavilions-b_static"},{min:[142.25781,13.72136,136.61719],max:[152.53906,18.29342,146.89453],group:"HIVE_pavilions-b_static"},{min:[-56.25,13.72519,156.21484],max:[-50.15625,18.76785,162.3125],group:"HIVE_pavilions-b_static"},{min:[5.16406,13.72136,79.55859],max:[15.66406,18.3355,90.5],group:"HIVE_pavilions-b_static"},{min:[-12.49219,13.72135,10.01172],max:[-1.54688,18.29341,20.50391],group:"HIVE_pavilions-b_static"},{min:[65.64062,13.72137,153.24609],max:[76.58594,18.29342,163.74609],group:"HIVE_pavilions-b_static"},{min:[100.17969,13.72136,109.04688],max:[108.75,18.29342,117.62109],group:"HIVE_pavilions-b_static"},{min:[-38.05469,13.72136,91.78125],max:[-31.96094,16.0093,97.82812],group:"HIVE_pavilions-b_static"},{min:[74.75,13.72136,98.35156],max:[85.24219,18.29342,109.29297],group:"HIVE_pavilions-b_static"},{min:[-9.60938,13.72135,38.51562],max:[.89062,17.91081,49.45312],group:"HIVE_pavilions-b_static"},{min:[27.40625,13.72136,130.15625],max:[34.10156,21.31212,136.85156],group:"HIVE_pavilions-b_static"},{min:[41.96875,13.72136,107.67969],max:[48.05469,16.0093,113.72656],group:"HIVE_pavilions-b_static"},{min:[-67.60156,13.72136,110.33594],max:[-57.10938,17.91082,121.27344],group:"HIVE_pavilions-b_static"},{min:[109.40625,13.72137,160.94922],max:[115.50781,18.29342,167.04297],group:"HIVE_pavilions-b_static"},{min:[-4.96094,13.72136,119.46094],max:[5.97656,18.29342,129.95703],group:"HIVE_pavilions-b_static"},{min:[-45.92188,13.72135,54.58203],max:[-37.34375,21.31211,63.15625],group:"HIVE_pavilions-b_static"},{min:[-28.89062,13.72136,139.33594],max:[-17.95312,18.29342,149.83594],group:"HIVE_pavilions-b_static"}];
  var PALETTE = ['#f1b1d0', '#9cd5e6', '#a5d389', '#f1d181', '#e89082', '#cbb6e5'];
  var NAME = 'HIVE_pavilions-b_static', TILE = 2.4;

  function ready() {
    return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene;
  }
  var tries = 0;
  (function wait() {
    if (ready()) { try { run(); } catch (e) { console.warn('Hive detail pass skipped', e); } }
    else if (tries++ < 500) setTimeout(wait, 150);
  })();

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not load ' + url)); };
      img.src = url;
    });
  }
  function bufferAttributeClass(g) {
    var found = null, nor = g.attributes.normal;
    [nor && nor.constructor, g.index && Object.getPrototypeOf(g.index.constructor), g.index && g.index.constructor].forEach(function (C) {
      if (found || typeof C !== 'function') return;
      try { var probe = new C(new Float32Array(4), 2); if (probe.array && probe.itemSize === 2) found = C; } catch (er) {}
    });
    if (!found) throw new Error('no usable BufferAttribute class');
    return found;
  }

  function run() {
    var ctx = window.daylightContext, mesh = null, std = null, Tex = null;
    ctx.scene.traverse(function (o) {
      if (!o.isMesh) return;
      if (o.name === NAME) mesh = o;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (!std && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) std = m;
        if (!Tex && m.map) Tex = m.map.constructor;
      });
    });
    if (!mesh || !std) return;
    // Heavy set-up runs one step per task so the page stays responsive (important on phones).
    var anim = [], waterT = null, steps = [];
    function step(name, fn) { steps.push(function () { try { fn(); } catch (e) { console.warn('Hive ' + name + ' skipped:', e && e.message || e); } }); }
    step('paving', function () { addPaving(ctx, mesh, std, Tex); });
    step('glass', function () { restoreGlass(ctx); });
    if (Tex) {
      step('road markings', function () { roadRibbon(ctx, mesh, std, Tex); roadRibbon(ctx, mesh, std, Tex, [[-76, 87.5], [-32, 121], [13, 153]], 5.5); });
      step('water', function () { waterT = animateWater(ctx, std, Tex); });
      step('pools', function () { addPool(ctx, mesh, std); addPool(ctx, mesh, std, [[94.6, 127.3], [106.3, 136.9], [111.9, 130.3], [99.6, 120.4]]); });
      step('deck floor', function () { addDeckFloor(ctx, mesh, std); });
      step('extra buildings', function () { addContextExtra(ctx, mesh, std); });
      step('shore', function () { addShore(ctx, mesh, std); });
      step('trees', function () { addSketchTrees(ctx, mesh, std, Tex, anim); });
      step('sketch life', function () { addSketchLife(ctx, mesh, std, Tex, anim); });
      step('animation', function () { startAnimation(ctx, anim, waterT); });
    }
    (function next(i) { if (i >= steps.length) return; steps[i](); setTimeout(function () { next(i + 1); }, 40); })(0);    if (!Tex) return;
    var base ='../portfolio-assets/hive-pbr-plaster-';
    Promise.all(['color', 'normal', 'roughness'].map(function (k) { return loadImage(base + k + '.webp'); })).then(function (imgs) {
      var maps = imgs.map(function (img, i) {
        var t = new Tex(img);
        t.wrapS = t.wrapT = 1000; // repeat
        t.anisotropy = 4;
        if (i === 0) t.colorSpace = 'srgb';
        t.needsUpdate = true;
        return t;
      });
      applyPavilions(mesh, std, maps, ctx);
    }).catch(function (e) { console.warn('Hive pavilion finish failed:', e && e.message || e); });
  }

  function applyPavilions(mesh, std, maps, ctx) {
    var g = mesh.geometry, pos = g.attributes.position;
    if (!g.attributes.normal) g.computeVertexNormals();
    var nor = g.attributes.normal;
    if (!g.index) { var seq = []; for (var s = 0; s < pos.count; s++) seq.push(s); g.setIndex(seq); }
    var Attr = bufferAttributeClass(g);
    mesh.updateWorldMatrix(true, false);
    var e = mesh.matrixWorld.elements, count = pos.count, uv = new Float32Array(count * 2);
    var wx = new Float32Array(count), wz = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      var x = e[0] * px + e[4] * py + e[8] * pz + e[12], y = e[1] * px + e[5] * py + e[9] * pz + e[13], z = e[2] * px + e[6] * py + e[10] * pz + e[14];
      wx[i] = x; wz[i] = z;
      var nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      var tx = Math.abs(e[0] * nx + e[4] * ny + e[8] * nz), ty = Math.abs(e[1] * nx + e[5] * ny + e[9] * nz), tz = Math.abs(e[2] * nx + e[6] * ny + e[10] * nz);
      var u, v;
      if (ty > tx && ty > tz) { u = x; v = z; } else if (tx > tz) { u = z; v = y; } else { u = x; v = y; }
      uv[i * 2] = u / TILE; uv[i * 2 + 1] = v / TILE;
    }
    var uvAttr = new Attr(uv, 2);
    if (!uvAttr.array) throw new Error('texture coordinate attribute could not be created');
    g.setAttribute('uv', uvAttr);
    var index = g.index, n = index.count, buckets = PALETTE.map(function () { return []; });
    for (var t = 0; t < n; t += 3) {
      var ids = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      var cx = (wx[ids[0]] + wx[ids[1]] + wx[ids[2]]) / 3, cz = (wz[ids[0]] + wz[ids[1]] + wz[ids[2]]) / 3;
      var r = -1;
      for (var q = 0; q < REGIONS.length; q++) {
        var R = REGIONS[q];
        if (cx >= R.min[0] - .05 && cx <= R.max[0] + .05 && cz >= R.min[2] - .05 && cz <= R.max[2] + .05) { r = q; break; }
      }
      var c = r === 11 ? 0 : Math.max(0, r) % PALETTE.length;
      buckets[c].push(ids[0], ids[1], ids[2]);
    }
    var all = [];
    g.clearGroups();
    buckets.forEach(function (b, ci) { if (b.length) { g.addGroup(all.length, b.length, ci); for (var k = 0; k < b.length; k++) all.push(b[k]); } });
    g.setIndex(all);
    mesh.material = PALETTE.map(function (hex, ci) {
      var m = std.clone();
      m.name = 'Pavilion plaster ' + (ci + 1);
      m.color.set(hex);
      m.map = maps[0]; m.normalMap = maps[1]; m.roughnessMap = maps[2];
      m.roughness = 1; m.metalness = 0; m.side = 2; m.transparent = false; m.opacity = 1;
      if (m.normalScale) m.normalScale.set(.4, .4);
      m.needsUpdate = true;
      return m;
    });
    redraw(ctx);
    window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { pavilions: true, pavilionTriangles: all.length / 3 });
  }

  function redraw(ctx) { if (ctx.controls && ctx.controls.dispatchEvent) ctx.controls.dispatchEvent({ type: 'change' }); }

  /* A simple box geometry built by hand, because the viewer does not expose its own BoxGeometry. */
  function boxGeometry(BG, Attr, w, h, d) {
    var hx = w / 2, hy = h / 2, hz = d / 2, P = [], N = [], I = [];
    var faces = [
      [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
      [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
      [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
      [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
      [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
      [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]
    ];
    faces.forEach(function (f, fi) {
      f[1].forEach(function (p) { P.push(p[0], p[1], p[2]); N.push(f[0][0], f[0][1], f[0][2]); });
      var o = fi * 4; I.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    var g = new BG();
    g.setAttribute('position', new Attr(new Float32Array(P), 3));
    g.setAttribute('normal', new Attr(new Float32Array(N), 3));
    g.setIndex(I);
    return g;
  }

  /* Site paving. The baked ground in the light model has black texels (road, plaza, courtyard) that read as a
     speckled, tiled mess from above. Those ground triangles are replaced by real paving: concrete for the site,
     asphalt along the road, with a slow colour variation so the texture never shows its repeat. */
  var ROAD = [[-235, 144.5], [-195, 144.5], [-165, 137], [-137, 124], [-112, 103], [-92, 78], [-62, 39], [-30, -4], [2, -47], [34, -90], [66, -133]];
  var SHORE = [[-96.3, 190.4], [122, 194], [127.6, 194.6], [136.7, 193.5], [149.7, 190.5], [166.8, 183]];
  function shoreZ(x) {
    if (x <= SHORE[0][0]) return SHORE[0][1];
    for (var i = 0; i < SHORE.length - 1; i++) if (x <= SHORE[i + 1][0]) { var t = (x - SHORE[i][0]) / (SHORE[i + 1][0] - SHORE[i][0]); return SHORE[i][1] + (SHORE[i + 1][1] - SHORE[i][1]) * t; }
    return SHORE[SHORE.length - 1][1];
  }
  function roadDistance(x, z) {
    var best = 1e9;
    for (var i = 0; i < ROAD.length - 1; i++) {
      var ax = ROAD[i][0], az = ROAD[i][1], bx = ROAD[i + 1][0], bz = ROAD[i + 1][1], dx = bx - ax, dz = bz - az;
      var t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  }
  function hash2(i, j) { var h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z) {
    var i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    var a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  function addPaving(ctx, ref, std, Tex) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var cvs = document.createElement('canvas'); cvs.width = cvs.height = 1;
    var cx = cvs.getContext('2d', { willReadFrequently: true });
    var buckets = { site: [], road: [] }, targets = [];
    ctx.scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.uv || o.name.indexOf('Hive') === 0) return;
      var m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.map && /^BAKED/.test(m.name) && m.map.image && m.map.image.width) targets.push([o, m]);
    });
    // pass 1: footprint of the site's own ground, so the ground of the surrounding context is only replaced near the site
    function groundTris(o, fn) {
      var g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count; o.updateWorldMatrix(true, false);
      var e = o.matrixWorld.elements;
      function wp(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
      for (var t = 0; t < n; t += 3) {
        var i0 = I ? I.getX(t) : t, i1 = I ? I.getX(t + 1) : t + 1, i2 = I ? I.getX(t + 2) : t + 2;
        var a = wp(i0), b = wp(i1), c = wp(i2), cy = (a[1] + b[1] + c[1]) / 3, ground = false;
        if (cy < 8) {
          var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          var nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
          ground = ny / (Math.hypot(nx, ny, nz) || 1) > .7;
        }
        fn(t, i0, i1, i2, a, b, c, ground);
      }
    }
    var bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    targets.forEach(function (T) {
      var o = T[0]; if (/context|site-road/.test(o.name)) return;
      groundTris(o, function (t, i0, i1, i2, a, b, c, ground) {
        if (!ground || (a[1] + b[1] + c[1]) / 3 > 1.3) return;
        var mx = (a[0] + b[0] + c[0]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
        bx0 = Math.min(bx0, mx); bx1 = Math.max(bx1, mx); bz0 = Math.min(bz0, mz); bz1 = Math.max(bz1, mz);
      });
    });
    bx0 -= 8; bx1 += 8; bz0 -= 8; bz1 += 8;
    function darkTexel(o, m, i0, i1, i2) {
      var img = m.map.image, U = o.geometry.attributes.uv, W = img.width, H = img.height;
      var u = (U.getX(i0) + U.getX(i1) + U.getX(i2)) / 3, v = (U.getY(i0) + U.getY(i1) + U.getY(i2)) / 3;
      cx.clearRect(0, 0, 1, 1);
      cx.drawImage(img, Math.min(W - 1, Math.max(0, Math.floor(u * W))), Math.min(H - 1, Math.max(0, Math.floor(v * H))), 1, 1, 0, 0, 1, 1);
      var px = cx.getImageData(0, 0, 1, 1).data; return (px[0] + px[1] + px[2]) / 3 < 24;
    }
    targets.forEach(function (T) {
      var o = T[0], g = o.geometry, keep = [], removed = 0, context = /context/.test(o.name);
      groundTris(o, function (t, i0, i1, i2, a, b, c, ground) {
        var drop = false;
        if (ground) {
          var mx = (a[0] + b[0] + c[0]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
          if (!context && (a[1] + b[1] + c[1]) / 3 <= 1.3) {
            drop = true; removed++;
            buckets.site.push(a, b, c);
          }
        }
        if (!drop) keep.push(i0, i1, i2);
      });
      if (removed) g.setIndex(keep);
    });    var made = 0, mats = [];
    ['site', 'road'].forEach(function (kind) {
      var tris = buckets[kind]; if (!tris.length) return;
      var Pp = new Float32Array(tris.length * 3), Nn = new Float32Array(tris.length * 3), Cc = new Float32Array(tris.length * 3), tile = kind === 'road' ? 3.2 : 2.2, UV = new Float32Array(tris.length * 2);
      for (var k = 0; k < tris.length; k++) {
        var p = tris[k], y = p[1] + .02;
        Pp[k * 3] = p[0]; Pp[k * 3 + 1] = y; Pp[k * 3 + 2] = p[2]; Nn[k * 3 + 1] = 1;
        var low = vnoise(p[0] / 11, p[2] / 11), hi = vnoise(p[0] / 3.1 + 40, p[2] / 3.1 + 40), s = .9 + .11 * low + .05 * hi;
        Cc[k * 3] = s; Cc[k * 3 + 1] = s; Cc[k * 3 + 2] = s * .985;
        UV[k * 2] = p[0] / tile; UV[k * 2 + 1] = p[2] / tile;
      }
      var g = new BG();
      g.setAttribute('position', new Attr(Pp, 3)); g.setAttribute('normal', new Attr(Nn, 3)); g.setAttribute('color', new Attr(Cc, 3)); g.setAttribute('uv', new Attr(UV, 2));
      var m = std.clone(); m.name = kind === 'road' ? 'Hive asphalt' : 'Hive site paving';
      m.map = null; m.normalMap = null; m.roughnessMap = null; m.vertexColors = true;
      m.color.set(kind === 'road' ? '#5d5f64' : '#bdb9b1'); m.emissive.set(kind === 'road' ? '#2c2d30' : '#45433f'); m.roughness = kind === 'road' ? .95 : .9; m.metalness = 0; m.side = 2; m.transparent = false; m.opacity = 1;
      m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; m.needsUpdate = true;
      var mesh = new Mesh(g, m); mesh.name = 'Hive ' + kind + ' paving'; mesh.frustumCulled = false; ctx.scene.add(mesh); mats.push(m); made += tris.length / 3;
    });
    // the unbaked approach sidewalk is plain black: give it the same paving colour
    ctx.scene.traverse(function (o) {
      if (o.isMesh && /West_approach/.test(o.name)) { var m = (Array.isArray(o.material) ? o.material[0] : o.material).clone(); m.color.set('#bdb9b1'); m.emissive.set('#45433f'); m.roughness = .9; o.material = m; }
    });
    redraw(ctx);
    window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { paving: made });
    if (!Tex || !mats.length) return;
    var base = '../portfolio-assets/hive-pbr-concrete-';
    Promise.all(['color', 'normal', 'roughness'].map(function (k) { return loadImage(base + k + '.webp'); })).then(function (imgs) {
      var maps = imgs.map(function (im, i) { var t = new Tex(im); t.wrapS = t.wrapT = 1000; t.anisotropy = 4; if (i === 0) t.colorSpace = 'srgb'; t.needsUpdate = true; return t; });
      mats.forEach(function (m) {
        if (m.name === 'Hive asphalt') { m.map = asphaltTex(Tex); m.normalMap = null; m.roughnessMap = null; m.color.set('#ffffff'); m.emissive.set('#26272a'); }
        else { m.map = maps[0]; m.normalMap = maps[1]; m.roughnessMap = maps[2]; if (m.normalScale) m.normalScale.set(.35, .35); }
        m.needsUpdate = true;
      });
      redraw(ctx);
    }).catch(function (e) { console.warn('Hive paving textures failed:', e && e.message || e); });
  }

  /* ---------- Sketch layer ----------
     People, trees, shopfronts, office floors, canal water and road markings are flat, hand-drawn style images
     (canvas atlases, one draw call each) that move. They stand in for heavy 3D so the model stays light. */
  var INK = '#302d29', CREAM = '#efe8d8';
  var TREES = [[-62,0,184,0],[-38,0,184,0],[-14,0,184,0],[10,0,184,0],[34,0,184,0],[58,0,184,0],[82,0,184,0],[106,0,184,0],[131,0,184,0],[148,0,184,0],[-80,0,172,0],[25,0,186,0],[68,0,185,0]];
  var SHOPS = [[-0.63,0.776,70.49,0.03,167.49,16.16,2.15,2],[-0.63,0.776,61.36,0.03,160.08,7.43,2.15,2],[-0.63,0.776,56.74,0.09,156.33,4.34,2.08,2],[0.991,0.133,153.77,0.09,163.24,17.5,4.17,2],[0.63,-0.776,75.36,0.09,146.59,20.97,4.17,2],[-0.776,-0.63,59.82,0.09,146.99,15.72,4.17,2],[0,1,114.65,0.03,173.11,72.62,2.29,2],[0,-1,110.21,0.09,153.84,49.8,4.17,2],[0.776,0.63,-25.31,0.06,102.53,14.04,4.45,0],[-0.63,0.776,-17.51,0.03,162.79,27.06,2.15,0],[-0.63,0.776,-35,0.03,148.59,18.1,2.15,0],[-0.63,0.776,-76.21,0.09,115.14,36.15,4.17,0],[0,1,-52.46,0.03,173.05,15.42,2.15,0],[0.63,-0.776,-45.45,0.03,116.84,86.05,2.15,0],[0.63,-0.776,-20.96,0.03,116.88,10.43,2.15,0],[0.63,-0.776,-36.27,0.03,104.42,12.03,2.15,0],[0.63,-0.776,-46.84,0.03,95.83,15.09,2.15,0],[0.63,-0.776,-59.77,0.03,85.34,18.11,2.15,0],[0.63,-0.776,-67.99,0.09,78.67,2.93,2.08,0],[0.776,0.63,-22.48,0.09,108.04,8.74,4.17,0],[-0.776,-0.63,-89.13,0.03,100.28,4.14,2.15,0],[-0.776,-0.63,-85.13,0.03,95.35,8.42,2.15,0],[-0.776,-0.63,-81.58,0.09,90.98,2.73,2.08,0],[1,0,-43.43,0.03,157.68,28.25,2.15,0],[1,0,-43.43,0.09,159.17,10.39,2.08,0],[1,0,-43.43,0.09,147.24,7.37,2.08,0],[-1,0,-61.5,0.09,150.11,43.38,2.05,0],[-0.63,0.776,-3.23,0.03,151.11,22.58,2.15,1],[0.776,0.63,0.78,0.03,166.01,15.42,2.15,1],[-0.63,0.776,-0.55,0.03,133.44,42.01,2.15,1],[0.776,0.63,47.08,0.03,138,14.45,2.15,1],[-0.776,-0.63,-16.93,0.09,101.2,8.74,4.17,1],[-0.103,-0.995,27.14,0.09,126.53,9.73,4.17,1],[0.776,0.63,34.37,0.09,123.12,7.38,4.17,1],[0.63,-0.776,11.68,0.09,118.46,27.14,4.17,1],[0.103,0.995,29.19,0.03,145.73,23.87,2.13,1],[-0.776,-0.63,-68.44,0.03,74.83,2.74,2.15,3],[-0.776,-0.63,-65.78,0.03,71.55,5.6,2.15,3],[-0.776,-0.63,-62.65,0.03,67.7,4.18,2.15,3],[-0.776,-0.63,-60.43,0.09,64.96,2.74,2.08,3],[-0.776,-0.63,-12.33,0.11,5.71,32.98,4.14,3],[0.63,-0.776,-1.33,0.11,38.49,22.28,4.14,3],[0.63,-0.776,-16.83,0.11,25.91,15.57,4.14,3],[0.776,0.63,21.63,0.11,44.69,16.1,4.14,3],[0.776,0.63,32.49,0.11,31.32,16.26,4.14,3],[0.63,-0.776,34.39,0.11,20.72,7.8,4.14,3],[0.63,-0.776,21.67,0.11,10.4,22.89,4.14,3],[0.63,-0.776,5.87,0.11,-2.42,15.42,4.14,3]];
  function srand(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function makeTex(Tex, cv) { var t = new Tex(cv); t.wrapS = t.wrapT = 1001; t.anisotropy = 4; t.colorSpace = 'srgb'; t.needsUpdate = true; return t; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function line(c, pts, w, col, r, closed) {
    c.lineJoin = c.lineCap = 'round'; c.lineWidth = w; c.strokeStyle = col; c.beginPath();
    pts.forEach(function (p, i) { var x = p[0] + (r() - .5) * 1.3, y = p[1] + (r() - .5) * 1.3; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    if (closed) c.closePath(); c.stroke();
  }
  function fillPoly(c, pts, fill, w, r) {
    c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = fill; c.fill();
    line(c, pts, w, INK, r, true);
  }

  /* People: 6 figure types x 6 poses (4 walk frames, standing, sitting), drawn as inked line figures. */
  /* Entourage figures in the loose marker style of architects' sketch sheets: open oval heads, trapezoid and cape bodies,
     tapering legs, quick hatching, black on white. Six archetypes x six poses (4 walking, standing, seated). */
  var PEOPLE = [
    { shape: 0, s: 1, m: 1.83 }, { shape: 1, s: 1, m: 1.72 }, { shape: 2, s: 1, m: 1.88 }, { shape: 3, s: 1, m: 1.68 }, { shape: 0, s: 1, m: .91 }, { shape: 4, s: 1, m: 1.7 }
  ];
  var CW = 128, CH = 256, ACOLS = 16, PAPER = '#fbf9f3';
  function wob(r, a) { return (r() - .5) * a; }
  /* One loose pen stroke through the points: smoothed, drifting, drawn twice with different pressure. */
  function pen(c, pts, w, r, drift) {
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; drift = drift || 1;
    for (var pass = 0; pass < 2; pass++) {
      var P = pts.map(function (p) { return [p[0] + wob(r, (pass ? 4.2 : 2) * drift), p[1] + wob(r, (pass ? 4.2 : 2) * drift)]; });
      c.lineWidth = w * (pass ? .5 : 1); c.beginPath(); c.moveTo(P[0][0], P[0][1]);
      if (P.length === 2) c.lineTo(P[1][0], P[1][1]);
      else { for (var i = 1; i < P.length - 1; i++) c.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); c.lineTo(P[P.length - 1][0], P[P.length - 1][1]); }
      c.stroke();
    }
  }
  function wash(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fillStyle = 'rgba(251,249,243,.93)'; c.fill(); }
  function scribble(c, x0, x1, y0, y1, n, w, r) {
    c.strokeStyle = INK; c.lineCap = 'round'; c.lineWidth = w;
    for (var i = 0; i < n; i++) { var x = x0 + (x1 - x0) * (i + r() * .6) / n, y = y0 + (y1 - y0) * (.1 + r() * .8), len = (y1 - y0) * (.15 + r() * .3); c.beginPath(); c.moveTo(x + len * .4, y - len * .5); c.quadraticCurveTo(x + len * .1, y, x - len * .3, y + len * .5); c.stroke(); }
  }
  function drawPerson(c, cell, T, pose, phase, seed) {
    var typeId = Math.floor((seed - 100) / 17), rs = srand(900 + typeId * 31), rj = srand(seed * 13 + pose * 101), ox = (cell % ACOLS) * CW, oy = Math.floor(cell / ACOLS) * CH, k = T.s, cx = ox + 64, fy = oy + CH - 14;
    function L(v) { return v * k; }
    var sit = pose === 5, walk = pose < 4, sw = walk ? Math.sin(phase * Math.PI * 2) : 0, lw = Math.max(2.6, L(3.8)), shape = T.shape;
    var hip = sit ? fy - L(48) : fy - L(104), sh = hip - L(74), lean = shape === 4 ? L(7) : 0;
    // soft ground smudge
    c.strokeStyle = 'rgba(48,45,41,.26)'; c.lineWidth = L(8); c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - L(10), fy + 5); c.quadraticCurveTo(cx + L(24), fy + 2, cx + L(58), fy + 9); c.stroke();
    pen(c, [[cx - L(32), fy + 1], [cx - L(8), fy + 3], [cx + L(34), fy]], 1.8, rj, .8);
    var hem = hip + (shape === 1 ? L(46) : shape === 3 ? L(36) : L(12));
    // legs: long loose lines, a pair for trousers, single strokes under skirts
    if (sit) {
      var kx = cx + L(40);
      pen(c, [[cx - L(6), hip], [cx + L(20), hip - L(1)], [kx, hip + L(3)], [kx + L(2), fy - L(2)]], lw, rj);
      pen(c, [[cx + L(4), hip + L(5)], [cx + L(26), hip + L(6)], [kx + L(12), hip + L(8)], [kx + L(14), fy - L(2)]], lw * .8, rj);
      pen(c, [[kx - L(2), fy - L(1)], [kx + L(18), fy - L(2)]], lw, rj);
      pen(c, [[cx - L(24), hip + L(5)], [cx + L(20), hip + L(4)]], lw * .6, rj); pen(c, [[cx - L(24), hip + L(5)], [cx - L(24), fy - L(2)]], lw * .6, rj); pen(c, [[cx - L(26), hip - L(44)], [cx - L(24), hip + L(5)]], lw * .6, rj);
    } else {
      var y0 = hem - L(6), spread = L(26) * sw;
      [-1, 1].forEach(function (d) {
        var fx = cx + d * spread + d * L(3), lift = d * sw > 0 ? L(8) * Math.abs(sw) : 0, top = cx + d * L(6), kneeX = (top + fx) / 2 + d * L(3), kneeY = (y0 + fy) / 2;
        if (shape === 1 || shape === 3) { pen(c, [[top - L(5), y0], [kneeX - L(3), kneeY], [fx, fy - lift]], lw * .8, rj); pen(c, [[top + L(5), y0], [kneeX + L(3), kneeY], [fx, fy - lift]], lw * .8, rj); if (d > 0) scribble(c, Math.min(top, fx) - L(2), Math.max(top, fx) + L(2), kneeY, fy - L(4), 3, Math.max(2, L(3)), rj); }
        else { pen(c, [[top - L(6), y0], [kneeX - L(5), kneeY], [fx - L(2), fy - lift]], lw, rj); pen(c, [[top + L(6), y0], [kneeX + L(5), kneeY], [fx + L(2), fy - lift]], lw * .7, rj); }
        pen(c, [[fx - L(8), fy - lift], [fx + L(8), fy - lift - 1]], lw * .9, rj);
      });
    }
    // body: flared side lines with a loose hem, light wash behind so the figure reads on any ground
    var w1, w2, wob2 = L(3);
    if (shape === 0 || shape === 4) { w1 = 24; w2 = 20; } else if (shape === 1) { w1 = 11; w2 = 36; } else if (shape === 2) { w1 = 22; w2 = 23; } else { w1 = 12; w2 = 46; }
    var bowL = wob(rs, L(40)), bowR = wob(rs, L(40)), skew = wob(rs, L(22)) + lean, dropL = wob(rs, L(14)), dropR = wob(rs, L(14)), hemL = wob(rs, L(16)), hemR = wob(rs, L(16)), skipTop = rs() < .45;
    function edge(side, bow, drop, hemD) {
      var x1 = L(w1), x2 = L(w2), y1 = sh + (hem - sh) * .33, y2 = sh + (hem - sh) * .68, xm1 = x1 + (x2 - x1) * .33, xm2 = x1 + (x2 - x1) * .68;
      return [[cx + side * x1 + skew, sh + drop], [cx + side * xm1 + skew * .7 + side * bow, y1], [cx + side * xm2 + skew * .3 - side * bow * .7, y2], [cx + side * x2 + hemD * .5, hem + hemD]];
    }
    var Ls = edge(-1, bowL, dropL, hemL), Rs = edge(1, bowR, dropR, hemR);
    (function () {
      function curve(P, first) { if (first) c.moveTo(P[0][0], P[0][1]); else c.lineTo(P[0][0], P[0][1]); for (var i = 1; i < P.length - 1; i++) c.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); c.lineTo(P[P.length - 1][0], P[P.length - 1][1]); }
      c.beginPath(); curve(Ls, true); c.quadraticCurveTo(cx, hem + wob(rs, L(18)), Rs[3][0], Rs[3][1]); curve(Rs.slice().reverse(), false); c.closePath(); c.fillStyle = 'rgba(251,249,243,.9)'; c.fill();
    })();
    pen(c, Ls, lw * 1.05, rj, 1.6); pen(c, Rs, lw * 1.05, rj, 1.6);    if (!skipTop) pen(c, [[Ls[0][0] - L(3), Ls[0][1]], [cx + skew * .6, sh - L(4) + (dropL + dropR) * .3], [Rs[0][0] + L(3), Rs[0][1]]], lw * 1.05, rj, 1.4);
    pen(c, [[Ls[3][0] - L(4), Ls[3][1]], [cx - L(w2) * .5, hem + wob(rs, L(14))], [cx + L(w2) * .1, hem + wob(rs, L(14))], [cx + L(w2) * .6, hem + wob(rs, L(14))], [Rs[3][0] + L(4), Rs[3][1]]], lw * .9, rj, 1.5);
    scribble(c, cx + (shape === 2 ? -L(w1) * .7 : L(2)), cx + L(w2) * (shape === 3 ? 1 : .8), sh + L(6), hem - L(6), shape === 2 ? 7 : 5, Math.max(1.6, L(2.3)), rj);
    if (shape === 2) pen(c, [[cx - L(21), hip - L(4)], [cx, hip - L(2)], [cx + L(21), hip - L(5)]], lw * .7, rj);
    if (shape === 3) { pen(c, [[cx - L(8), sh + L(14)], [cx - L(16), hem - L(8)]], lw * .6, rj); pen(c, [[cx + L(10), sh + L(16)], [cx + L(22), hem - L(6)]], lw * .6, rj); }
    // arm
    if (shape !== 3 && !sit) { var a = walk ? -sw * .6 : .06; pen(c, [[cx + L(w1) + lean, sh + L(5)], [cx + L(w1 + 4) + Math.sin(a) * L(26), sh + L(38)], [cx + L(w1 + 2) + Math.sin(a) * L(52), sh + L(8) + Math.cos(a) * L(56)]], lw * .8, rj); }
    if (sit) pen(c, [[cx + L(w1) + lean, sh + L(6)], [cx + L(28), hip - L(22)], [cx + L(36), hip - L(2)]], lw * .8, rj);
    if (shape === 4) pen(c, [[cx + L(40), hip - L(14)], [cx + L(46), fy - L(2)]], lw * .8, rj);
    // head: small open oval and a flick of neck
    var hx = cx + lean * 1.4, hy = sh - L(22), tilt = wob(rs, .9);
    pen(c, [[hx - L(1), sh - L(1)], [hx, sh - L(8)]], lw * .8, rj, .6);
    var pts = []; for (var i = 0; i <= 9; i++) { var ang = tilt + .6 + i / 9 * (Math.PI * 2 - .5); pts.push([hx + Math.cos(ang) * L(10.5), hy + Math.sin(ang) * L(15)]); }
    c.beginPath(); c.ellipse(hx, hy, L(10.5), L(15), tilt, 0, Math.PI * 2); c.fillStyle = 'rgba(251,249,243,.95)'; c.fill();
    pen(c, pts, lw * .9, rj, .7);
    if (shape === 1 || shape === 3) pen(c, [[hx - L(11), hy + L(2)], [hx - L(8), hy - L(14)], [hx + L(8), hy - L(15)], [hx + L(10), hy - L(2)]], lw * .8, rj, .8);
  }  function peopleAtlas(Tex) {
    var cv = canvas(CW * ACOLS, CH * 3), c = cv.getContext('2d');
    for (var t = 0; t < PEOPLE.length; t++) for (var f = 0; f < 6; f++) drawPerson(c, t * 6 + f, PEOPLE[t], f, f < 4 ? f / 4 : 0, 100 + t * 17 + f);
    return makeTex(Tex, cv);
  }

  /* Trees: three inked canopies with hatching. */
  function treeAtlas(Tex) {
    var cv = canvas(1280, 384), c = cv.getContext('2d');
    for (var sb = 0; sb < 2; sb++) {
      var rb = srand(1300 + sb * 17), bx0 = (3 + sb) * 256 + 128, fillB = ['#c3d6ad', '#b4cf9c'][sb];
      for (var bi = 0; bi < 7; bi++) { var ang = Math.PI + bi / 6 * Math.PI, rx = 70 + rb() * 20, bxx = bx0 + Math.cos(ang) * 62 * (bi % 2 ? .6 : 1), byy = 360 - 40 - Math.abs(Math.sin(ang)) * 50 - rb() * 18; c.beginPath(); c.arc(bxx, byy, 34 + rb() * 18, 0, Math.PI * 2); c.fillStyle = fillB; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
      c.strokeStyle = 'rgba(48,45,41,.5)'; c.lineWidth = 1.5; for (var hh = 0; hh < 22; hh++) { var hx2 = bx0 - 80 + rb() * 160, hy2 = 280 + rb() * 70; c.beginPath(); c.moveTo(hx2, hy2); c.lineTo(hx2 - 9, hy2 + 14); c.stroke(); }
      line(c, [[bx0 - 100, 372], [bx0 + 100, 372]], 2, INK, rb);
    }
    for (var v = 0; v < 3; v++) {
      var r = srand(900 + v * 31), ox = v * 256, cx = ox + 128, fills = ['#f1efe4', '#ebe9dc', '#f5f3ea'], blobs = [];
      line(c, [[cx - 7, 372], [cx - 5, 250], [cx - 14, 196]], 5, INK, r); line(c, [[cx + 7, 372], [cx + 5, 250], [cx + 15, 196]], 5, INK, r);
      line(c, [[cx, 270], [cx - 36, 214]], 4, INK, r); line(c, [[cx, 262], [cx + 38, 206]], 4, INK, r);
      for (var i = 0; i < 9; i++) { var ang = i / 9 * Math.PI * 2 + r() * .4, d = i === 0 ? 0 : 50 + r() * 22; blobs.push([cx + Math.cos(ang) * d, 132 + Math.sin(ang) * d * .85, 46 + r() * 20]); }
      blobs.sort(function (p, q) { return p[1] - q[1]; });
      blobs.forEach(function (bl) { c.beginPath(); c.arc(bl[0], bl[1], bl[2], 0, Math.PI * 2); c.fillStyle = fills[v]; c.fill(); c.lineWidth = 3.4; c.strokeStyle = INK; c.stroke(); });
      c.save(); c.beginPath(); blobs.forEach(function (bl) { c.moveTo(bl[0] + bl[2], bl[1]); c.arc(bl[0], bl[1], bl[2], 0, Math.PI * 2); }); c.clip();
      c.strokeStyle = 'rgba(48,45,41,.55)'; c.lineWidth = 1.6;
      for (var h = 0; h < 46; h++) { var hx = cx - 20 + r() * 120, hy = 96 + r() * 120; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - 12, hy + 18); c.stroke(); }
      c.restore();
      for (var l = 0; l < 14; l++) { var lx = cx - 90 + r() * 180, ly = 70 + r() * 130; c.beginPath(); c.arc(lx, ly, 3, 0, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(); }
    }
    return makeTex(Tex, cv);
  }

  /* Shopfronts (6 kinds) and an office floor, 512 x 256 each, in one atlas. */
  var SHOP_KINDS = ['CAFE', 'BAKERY', 'BOUTIQUE', 'BOOKS', 'FLORIST', 'HOME'];
  function shopAtlas(Tex) {
    var cv = canvas(2048, 512), c = cv.getContext('2d');
    for (var k = 0; k < 7; k++) {
      var r = srand(500 + k * 13), ox = (k % 4) * 512, oy = Math.floor(k / 4) * 256;
      c.fillStyle = '#f4eddc'; c.fillRect(ox, oy, 512, 256);
      c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(ox + 3, oy + 3, 506, 250);
      if (k < 6) {
        var cols = ['#e0557c', '#4fa6c9', '#f1c453', '#7fc28a', '#f08c4f', '#a58bd6'], col = cols[k];
        for (var s = 0; s < 8; s++) { c.beginPath(); c.moveTo(ox + 20 + s * 59, oy + 12); c.lineTo(ox + 79 + s * 59, oy + 12); c.lineTo(ox + 79 + s * 59, oy + 54); c.arc(ox + 49.5 + s * 59, oy + 54, 29.5, 0, Math.PI); c.lineTo(ox + 20 + s * 59, oy + 12); c.fillStyle = s % 2 ? CREAM : col; c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke(); }
        c.fillStyle = CREAM; c.fillRect(ox + 150, oy + 66, 212, 34); c.strokeRect(ox + 150, oy + 66, 212, 34);
        c.fillStyle = INK; c.font = '700 24px "Archivo Narrow",Archivo,system-ui,sans-serif'; c.textAlign = 'center'; c.fillText(SHOP_KINDS[k], ox + 256, oy + 91);
        for (var sh = 0; sh < 2; sh++) line(c, [[ox + 30, oy + 150 + sh * 46], [ox + 330, oy + 150 + sh * 46]], 3, INK, r);
        for (var it = 0; it < 12; it++) {
          var ix = ox + 44 + it * 25, iy = oy + 150 - (it % 2) * 0; c.beginPath();
          if (k === 0) { c.rect(ix, iy - 16, 14, 16); } else if (k === 1) { c.ellipse(ix + 8, iy - 8, 11, 7, 0, 0, Math.PI * 2); } else if (k === 2) { c.moveTo(ix, iy - 26); c.lineTo(ix + 16, iy - 26); c.lineTo(ix + 8, iy); c.closePath(); } else if (k === 3) { c.rect(ix, iy - 24, 9, 24); } else if (k === 4) { c.arc(ix + 8, iy - 12, 8, 0, Math.PI * 2); } else { c.rect(ix, iy - 20, 14, 20); }
          c.fillStyle = it % 2 ? col : '#fff7e6'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
        }
        c.strokeRect(ox + 380, oy + 70, 100, 170); line(c, [[ox + 430, oy + 70], [ox + 430, oy + 240]], 2, INK, r); c.beginPath(); c.arc(ox + 420, oy + 160, 3, 0, 7); c.fillStyle = INK; c.fill();
        for (var hl = 0; hl < 30; hl++) line(c, [[ox + 20 + r() * 340, oy + 200 + r() * 40], [ox + 30 + r() * 340, oy + 190 + r() * 40]], 1, 'rgba(48,45,41,.35)', r);
      } else {
        for (var w = 0; w < 4; w++) { c.strokeRect(ox + 20 + w * 122, oy + 16, 110, 120); }
        for (var d = 0; d < 3; d++) { var dx = ox + 40 + d * 160; line(c, [[dx, oy + 190], [dx + 120, oy + 190]], 4, INK, r); line(c, [[dx + 10, oy + 192], [dx + 10, oy + 240]], 3, INK, r); line(c, [[dx + 110, oy + 192], [dx + 110, oy + 240]], 3, INK, r); c.strokeRect(dx + 34, oy + 150, 52, 34); line(c, [[dx + 60, oy + 184], [dx + 60, oy + 190]], 3, INK, r); }
        for (var pl = 0; pl < 5; pl++) line(c, [[ox + 20 + pl * 120, oy + 8], [ox + 50 + pl * 120, oy + 8]], 6, '#e8d79a', r);
      }
    }
    return makeTex(Tex, cv);
  }

  /* Canal water: wavy hatch lines, tileable, scrolled by the animation loop. */
  function waterTex(Tex) {
    var cv = canvas(256, 256), c = cv.getContext('2d'), r = srand(77);
    c.fillStyle = '#4a8c8e'; c.fillRect(0, 0, 256, 256);
    for (var row = 0; row < 16; row++) {
      var y0 = row * 16 + 8, amp = 2.5 + (row % 3), ph = row * .9, k = 2 + (row % 2);
      [['rgba(168,222,214,.85)', 0], ['rgba(36,92,98,.55)', 5]].forEach(function (s) {
        c.beginPath(); for (var x = 0; x <= 256; x += 4) { var y = y0 + s[1] + Math.sin(x / 256 * Math.PI * 2 * k + ph) * amp; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
        c.strokeStyle = s[0]; c.lineWidth = s[1] ? 1.6 : 2.4; c.stroke();
      });
    }
    var t = makeTex(Tex, cv); t.wrapS = t.wrapT = 1000; return t;
  }
  function asphaltTex(Tex) {
    var cv = canvas(256, 256), c = cv.getContext('2d'), r = srand(31);
    c.fillStyle = '#5b5d62'; c.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 2600; i++) { var g = 70 + r() * 70 | 0; c.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 4) + ',' + (.25 + r() * .5) + ')'; c.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    for (var k = 0; k < 14; k++) { c.strokeStyle = 'rgba(30,30,32,.35)'; c.lineWidth = 1; c.beginPath(); var x = r() * 256, y = r() * 256; c.moveTo(x, y); for (var s = 0; s < 5; s++) { x += (r() - .5) * 30; y += (r() - .5) * 30; c.lineTo(x, y); } c.stroke(); }
    var t = makeTex(Tex, cv); t.wrapS = t.wrapT = 1000; return t;
  }
  function laneTex(Tex) {
    var cv = canvas(64, 128), c = cv.getContext('2d');
    var r = srand(5); c.fillStyle = '#5b5d62'; c.fillRect(0, 0, 64, 128);
    for (var i = 0; i < 700; i++) { var g = 70 + r() * 70 | 0; c.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 4) + ',' + (.25 + r() * .5) + ')'; c.fillRect(r() * 64, r() * 128, 1 + r() * 2, 1 + r() * 2); }
    c.fillStyle = '#cfcac0'; c.fillRect(0, 0, 4, 128); c.fillRect(60, 0, 4, 128);
    c.fillStyle = '#f4f0e4'; c.fillRect(7, 0, 2, 128); c.fillRect(55, 0, 2, 128);
    c.fillStyle = '#f1c453'; c.fillRect(30, 8, 4, 48); c.fillRect(30, 72, 4, 48);
    var t = makeTex(Tex, cv); t.wrapS = 1001; t.wrapT = 1000; return t;
  }
  function roadRibbon(ctx, ref, std, Tex, ctrl, halfW) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var pts = [], P0 = ctrl || ROAD;
    for (var i = 0; i < P0.length - 1; i++) {
      var a = P0[Math.max(0, i - 1)], b = P0[i], c = P0[i + 1], d = P0[Math.min(P0.length - 1, i + 2)];
      for (var s = 0; s < 8; s++) {
        var t = s / 8, t2 = t * t, t3 = t2 * t;
        pts.push([.5 * ((2 * b[0]) + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3), .5 * ((2 * b[1]) + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3)]);
      }
    }
    pts.push(P0[P0.length - 1]);
    var P = [], UV = [], I = [], len = 0, half = halfW || 5.4;
    pts.forEach(function (p, i) {
      var q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      P.push(p[0] + nx * half, .16, p[1] + nz * half, p[0] - nx * half, .16, p[1] - nz * half); UV.push(0, len / 12, 1, len / 12);
      if (i) { var k = i * 2; I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    var N = []; for (var n = 0; n < P.length / 3; n++) N.push(0, 1, 0);
    var g = new BG(); g.setAttribute('position', new Attr(new Float32Array(P), 3)); g.setAttribute('normal', new Attr(new Float32Array(N), 3)); g.setAttribute('uv', new Attr(new Float32Array(UV), 2)); g.setIndex(I);
    var m = std.clone(); m.name = 'Hive road markings'; m.map = laneTex(Tex); m.normalMap = null; m.roughnessMap = null; m.color.set('#ffffff'); m.emissive.set('#2a2b2e'); m.roughness = .95; m.metalness = 0; m.side = 2;
    m.transparent = false; m.polygonOffset = true; m.polygonOffsetFactor = -3; m.polygonOffsetUnits = -3; m.needsUpdate = true;
    var mesh = new Mesh(g, m); mesh.name = 'Hive road markings'; mesh.frustumCulled = false; ctx.scene.add(mesh);
  }
  function animateWater(ctx, std, Tex) {
    var water = null; ctx.scene.traverse(function (o) { if (o.isMesh && /canal|water/i.test(o.name) && o.name.indexOf('Amenity') < 0) water = o; });
    if (!water) return null;
    var g = water.geometry, pos = g.attributes.position, Attr = bufferAttributeClass(g); water.updateWorldMatrix(true, false);
    var e = water.matrixWorld.elements, uv = new Float32Array(pos.count * 2);
    for (var i = 0; i < pos.count; i++) { var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); uv[i * 2] = (e[0] * x + e[4] * y + e[8] * z + e[12]) / 14; uv[i * 2 + 1] = (e[2] * x + e[6] * y + e[10] * z + e[14]) / 14; }
    g.setAttribute('uv', new Attr(uv, 2));
    var tex = waterTex(Tex), m = std.clone(); m.name = 'Hive canal hatch'; m.map = tex; m.normalMap = null; m.roughnessMap = null; m.color.set('#ffffff'); m.emissive.set('#22474a'); m.roughness = .5; m.metalness = 0; m.side = 2; m.needsUpdate = true;
    water.material = m; water.position.y += 1.15;
    return tex;
  }

  /* Billboards: flat quads that face the camera, rebuilt just before each draw, so one mesh holds hundreds of sprites. */
  function Billboards(Mesh, BG, Attr, mat, count, tilt) {
    var X = new Float32Array(count), Y = new Float32Array(count), Z = new Float32Array(count), W = new Float32Array(count), H = new Float32Array(count), SW = new Float32Array(count);
    var UVA = new Float32Array(count * 8), FL = new Uint8Array(count), P = new Float32Array(count * 12), Nn = new Float32Array(count * 12), I = [];
    for (var i = 0; i < count; i++) { for (var v = 0; v < 4; v++) Nn[i * 12 + v * 3 + 1] = 1; I.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
    var g = new BG(), pa = new Attr(P, 3), ua = new Attr(UVA, 2);
    g.setAttribute('position', pa); g.setAttribute('normal', new Attr(Nn, 3)); g.setAttribute('uv', ua); g.setIndex(I);
    var mesh = new Mesh(g, mat); mesh.frustumCulled = false; mesh.name = 'Hive sketch sprites';
    var uvDirty = true;
    mesh.onBeforeRender = function (renderer, scene, camera) {
      camera.updateMatrixWorld(); var e = camera.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      var ux = e[4] * tilt, uy = 1 - tilt + e[5] * tilt, uz = e[6] * tilt, ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      for (var i = 0; i < count; i++) {
        var h = H[i], w = W[i] / 2, o = i * 12, x = X[i], y = Y[i], z = Z[i], sw = SW[i];
        if (!h) { for (var q = 0; q < 12; q++) P[o + q] = 0; continue; }
        P[o] = x - rx * w; P[o + 1] = y; P[o + 2] = z - rz * w;
        P[o + 3] = x + rx * w; P[o + 4] = y; P[o + 5] = z + rz * w;
        P[o + 6] = x + rx * (w + sw) + ux * h; P[o + 7] = y + uy * h; P[o + 8] = z + rz * (w + sw) + uz * h;
        P[o + 9] = x + rx * (-w + sw) + ux * h; P[o + 10] = y + uy * h; P[o + 11] = z + rz * (-w + sw) + uz * h;
      }
      pa.needsUpdate = true; if (uvDirty) { ua.needsUpdate = true; uvDirty = false; }
    };
    return {
      mesh: mesh,
      place: function (i, x, y, z, w, h, sw) { X[i] = x; Y[i] = y; Z[i] = z; W[i] = w; H[i] = h; SW[i] = sw || 0; },
      cell: function (i, u0, v0, u1, v1, flip) {
        var a = flip ? u1 : u0, b = flip ? u0 : u1, o = i * 8; UVA[o] = a; UVA[o + 1] = v1; UVA[o + 2] = b; UVA[o + 3] = v1; UVA[o + 4] = b; UVA[o + 5] = v0; UVA[o + 6] = a; UVA[o + 7] = v0; uvDirty = true;
      }
    };
  }
  function spriteMaterial(std, tex) {
    var m = std.clone(); m.name = 'Hive sketch sprite'; m.map = tex; m.emissiveMap = tex; m.color.set('#000000'); m.emissive.set('#ffffff'); m.normalMap = null; m.roughnessMap = null;
    m.roughness = 1; m.metalness = 0; m.envMapIntensity = 0; m.side = 2; m.transparent = false; m.alphaTest = .45; m.toneMapped = false; m.needsUpdate = true;
    return m;
  }

  /* Sketch trees: 15 inked trees that sway, with soft ground shadows. */
  function addSketchTrees(ctx, ref, std, Tex, anim) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    // each ground tree stands in a hexagon of planting (matching the hexagonal paving), ringed with low shrubs
    var HEXR = 1.9, shrubs = [];
    TREES.forEach(function (T) { if (!T[3]) for (var k = 0; k < 6; k++) { var ang = Math.PI / 6 + k * Math.PI / 3; shrubs.push([T[0] + Math.cos(ang) * HEXR * .82, T[2] + Math.sin(ang) * HEXR * .82, k]); } });
    var bb = Billboards(Mesh, BG, Attr, spriteMaterial(std, treeAtlas(Tex)), TREES.length + shrubs.length, .5);
    TREES.forEach(function (T, i) {
      var v = i % 3, h = T[3] ? 4.6 : 9.2, w = h * .667;
      bb.place(i, T[0], T[1], T[2], w, h, 0); bb.cell(i, v / 5, 1, (v + 1) / 5, 0, i % 2 === 0);
    });
    shrubs.forEach(function (s, j) { var i = TREES.length + j, v = 3 + (j % 2), h = 3.0; bb.place(i, s[0], 0, s[1], h * .667, h, 0); bb.cell(i, v / 5, 1, (v + 1) / 5, 0, j % 3 === 0); });
    (function () {
      var P = [], N = [], I = [];
      TREES.forEach(function (T) {
        if (T[3]) return; var base = P.length / 3; P.push(T[0], .05, T[2]); N.push(0, 1, 0);
        for (var k = 0; k < 6; k++) { var a2 = k * Math.PI / 3 + Math.PI / 6; P.push(T[0] + Math.cos(a2) * HEXR, .05, T[2] + Math.sin(a2) * HEXR); N.push(0, 1, 0); }
        for (var q = 0; q < 6; q++) I.push(base, base + 1 + q, base + 1 + (q + 1) % 6);
      });
      var g = new BG(); g.setAttribute('position', new Attr(new Float32Array(P), 3)); g.setAttribute('normal', new Attr(new Float32Array(N), 3)); g.setIndex(I);
      var m = std.clone(); m.name = 'Hive planting bed'; m.map = null; m.normalMap = null; m.roughnessMap = null; m.color.set('#8fb57a'); m.emissive.set('#24351d'); m.roughness = 1; m.metalness = 0; m.side = 2; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.needsUpdate = true;
      var bed = new Mesh(g, m); bed.name = 'Hive planting bed'; bed.frustumCulled = false; ctx.scene.add(bed);
    })();    ctx.scene.add(bb.mesh);
    var cv = canvas(64, 64), c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
    var stex = makeTex(Tex, cv), sm = std.clone(); sm.map = stex; sm.normalMap = null; sm.roughnessMap = null; sm.color.set('#10200c'); sm.transparent = true; sm.depthWrite = false; sm.roughness = 1; sm.metalness = 0; sm.side = 2; sm.polygonOffset = true; sm.polygonOffsetFactor = -2; sm.needsUpdate = true;
    TREES.forEach(function (T) {
      var rad = (T[3] ? 1.65 : 3.1) * 1.6, sg = new BG();
      sg.setAttribute('position', new Attr(new Float32Array([-rad, 0, rad, rad, 0, rad, rad, 0, -rad, -rad, 0, -rad]), 3));
      sg.setAttribute('normal', new Attr(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
      sg.setAttribute('uv', new Attr(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); sg.setIndex([0, 1, 2, 0, 2, 3]);
      var s = new Mesh(sg, sm); s.position.set(T[0] + 1, T[1] + .06, T[2] + .8); s.renderOrder = 1; ctx.scene.add(s);
    });
    anim.push(function (time) { TREES.forEach(function (T, i) { var h = T[3] ? 4.6 : 9.2; bb.place(i, T[0], T[1], T[2], h * .667, h, Math.sin(time * 1.2 + i * 1.7) * h * .028); }); });
    window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { trees: TREES.length, treeStyle: 'sketch' });
  }

  /* Sketch life: walking, pausing and sitting people on the site paths and the canal promenade, shop and office interiors. */
  function addSketchLife(ctx, ref, std, Tex, anim) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var mobile = !!(window.modelPerformance && window.modelPerformance.mobile), SC = 2.1, HZ = mobile ? 8 : 14;
    var N_PROM = mobile ? 34 : 80, N_GROUND = mobile ? 10 : 46, N_DECK = mobile ? 10 : 36;
    var rnd = srand(4171);
    // shop and office cards (static quads in one mesh)
    var cards = [];
    SHOPS.forEach(function (s, si) {
      var nx = s[0], nz = s[1], ax = -nz, az = nx, usable = s[5] - 1.2, parts = Math.max(1, Math.ceil(usable / 9)), cw = usable / parts;
      for (var p = 0; p < parts; p++) {
        var off = -usable / 2 + cw * (p + .5), kind = Math.floor(rnd() * 6);
        cards.push({ letter: 'abcde'.charAt(s[7] == null ? 5 : s[7]), cx: s[2] + ax * off - nx * .5, cz: s[4] + az * off - nz * .5, y: s[3] + .05, w: cw - .3, h: Math.min(s[6], 3.4) - .1, ax: ax, az: az, nx: nx, nz: nz, cell: kind, people: 1 + Math.floor(Math.sqrt(rnd()) * rnd() * 5.4) });
      }
    });
    // keep shopfronts inside their own bays: drop any that would overlap one already placed
    cards = cards.filter(function (c, i) {
      for (var j = 0; j < i; j++) { var o = cards[j]; if (o._drop) continue; if (Math.abs(o.y - c.y) < 2 && Math.hypot(o.cx - c.cx, o.cz - c.cz) < .5 * (o.w + c.w) * .9) { c._drop = true; return false; } }
      return true;
    });    var offices = [];
    ctx.scene.traverse(function (o) {
      if (!o.isMesh || !/^HIVE_office-.*_glass$/.test(o.name)) return;
      var g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count, e; o.updateWorldMatrix(true, false); e = o.matrixWorld.elements;
      function wp(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
      var buckets = {};
      for (var t = 0; t < n; t += 3) {
        var a = wp(I ? I.getX(t) : t), b = wp(I ? I.getX(t + 1) : t + 1), c = wp(I ? I.getX(t + 2) : t + 2);
        var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        var nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], nl = Math.hypot(nx, ny, nz) || 1;
        if (Math.abs(ny / nl) > .35) continue;
        var k = Math.round(Math.atan2(nz, nx) / (Math.PI / 12)), bk = buckets[k] || (buckets[k] = { n: [Math.cos(k * Math.PI / 12), Math.sin(k * Math.PI / 12)], t0: 1e9, t1: -1e9, y0: 1e9, y1: -1e9, area: 0, px: 0, pz: 0, c: 0 });
        [a, b, c].forEach(function (v) { var tt = v[0] * -bk.n[1] + v[2] * bk.n[0]; bk.t0 = Math.min(bk.t0, tt); bk.t1 = Math.max(bk.t1, tt); bk.y0 = Math.min(bk.y0, v[1]); bk.y1 = Math.max(bk.y1, v[1]); bk.px += v[0]; bk.pz += v[2]; bk.c++; });
        bk.area += nl / 2;
      }
      Object.keys(buckets).forEach(function (key) {
        var bk = buckets[key]; if (bk.area < 60 || bk.t1 - bk.t0 < 6) return;
        var mx = bk.px / bk.c, mz = bk.pz / bk.c, tmid = (bk.t0 + bk.t1) / 2, cur = mx * -bk.n[1] + mz * bk.n[0];
        offices.push({ letter: (/-([a-e])_/.exec(o.name) || [])[1] || 'x', cx: mx + (tmid - cur) * -bk.n[1] - bk.n[0] * 1.1, cz: mz + (tmid - cur) * bk.n[0] - bk.n[1] * 1.1, y0: bk.y0, y1: bk.y1, w: bk.t1 - bk.t0, nx: bk.n[0], nz: bk.n[1], ax: -bk.n[1], az: bk.n[0] });
      });
    });
    offices = offices.filter(function (o, i) { for (var j = 0; j < i; j++) { var p = offices[j]; if (p._drop) continue; if (p.y0 < o.y1 && o.y0 < p.y1 && Math.hypot(p.cx - o.cx, p.cz - o.cz) < .5 * (p.w + o.w) * .9) { o._drop = true; return false; } } return true; });
    /* Lived-in interiors: stores on the ground floor, offices on the upper levels, as plain cream boxes in one merged mesh. */
    var IP = [], IN = [], IC = [], II = [];
    function hexC(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
    // box in wall space: u along the wall, d inward from the glass, h up from the floor y
    function box(cx, cz, y, ax, az, nx, nz, u0, u1, d0, d1, h0, h1, col) {
      var c = hexC(col), P = function (u, d, h) { return [cx + ax * u - nx * d, y + h, cz + az * u - nz * d]; };
      if (curFp) { var q0 = P(u0, d0, h0), q1 = P(u1, d0, h0), q2 = P(u1, d1, h0), q3 = P(u0, d1, h0); if (!inFp(q0[0], q0[2]) || !inFp(q1[0], q1[2]) || !inFp(q2[0], q2[2]) || !inFp(q3[0], q3[2])) return; }
      var corners = [P(u0, d0, h0), P(u1, d0, h0), P(u1, d1, h0), P(u0, d1, h0), P(u0, d0, h1), P(u1, d0, h1), P(u1, d1, h1), P(u0, d1, h1)];
      var faces = [[0, 1, 2, 3, [0, -1, 0]], [4, 7, 6, 5, [0, 1, 0]], [0, 4, 5, 1, [-nx, 0, -nz]], [1, 5, 6, 2, [ax, 0, az]], [2, 6, 7, 3, [nx, 0, nz]], [3, 7, 4, 0, [-ax, 0, -az]]];
      faces.forEach(function (fc) {
        var base = IP.length / 3, shade = fc[4][1] > .5 ? 1 : fc[4][1] < -.5 ? .6 : .82 + Math.abs(fc[4][0]) * .06;
        for (var v = 0; v < 4; v++) { var p = corners[fc[v]]; IP.push(p[0], p[1], p[2]); IN.push(fc[4][0], fc[4][1], fc[4][2]); IC.push(c[0] * shade, c[1] * shade, c[2] * shade); }
        II.push(base, base + 1, base + 2, base, base + 2, base + 3);
      });
    }
    // Building footprint at each level, rasterised from the real slabs (0.4 m cells), so nothing is ever placed outside the walls.
    var FP = { L2: new Set(), L3: new Set() }, FPL = { L2: {}, L3: {} }, FPC = .4;
    function rasterSlabs() {
      var lv = [['L2', 4.2, 4.9], ['L3', 7.2, 7.9]];
      ctx.scene.traverse(function (o) {
        if (!o.isMesh || !/^HIVE_.*_static$/.test(o.name) || /context|site|water/.test(o.name)) return; var letter = (/-([a-e])_/.exec(o.name) || [])[1] || 'x';
        var g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count; o.updateWorldMatrix(true, false); var e = o.matrixWorld.elements;
        function wp(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
        for (var t = 0; t < n; t += 3) {
          var a = wp(I ? I.getX(t) : t), b = wp(I ? I.getX(t + 1) : t + 1), c = wp(I ? I.getX(t + 2) : t + 2), cy = (a[1] + b[1] + c[1]) / 3, set = null;
          var lvl = null; for (var q = 0; q < lv.length; q++) if (cy >= lv[q][1] && cy <= lv[q][2]) lvl = lv[q][0]; if (!lvl) continue; set = FP[lvl]; var setB = FPL[lvl][letter] || (FPL[lvl][letter] = new Set());
          var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ny = e1[2] * e2[0] - e1[0] * e2[2], nl = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], ny, e1[0] * e2[1] - e1[1] * e2[0]); if (Math.abs(ny) / nl < .9) continue;
          var mnx = Math.min(a[0], b[0], c[0]), mxx = Math.max(a[0], b[0], c[0]), mnz = Math.min(a[2], b[2], c[2]), mxz = Math.max(a[2], b[2], c[2]);
          for (var iz = Math.floor(mnz / FPC); iz <= Math.floor(mxz / FPC); iz++) for (var ix = Math.floor(mnx / FPC); ix <= Math.floor(mxx / FPC); ix++) {
            var px = (ix + .5) * FPC, pz = (iz + .5) * FPC, d1 = (px - b[0]) * (a[2] - b[2]) - (a[0] - b[0]) * (pz - b[2]), d2 = (px - c[0]) * (b[2] - c[2]) - (b[0] - c[0]) * (pz - c[2]), d3 = (px - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (pz - a[2]);
            if (!(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)))) { set.add(ix + ',' + iz); setB.add(ix + ',' + iz); }
          }
        }
      });
    }
    rasterSlabs();
    var curFp = null;
    function inFp(x, z, m) { if (!curFp || !curFp.size) return true; m = m == null ? .55 : m; var pts = [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]]; for (var i = 0; i < 5; i++) if (!curFp.has(Math.floor((x + pts[i][0]) / FPC) + ',' + Math.floor((z + pts[i][1]) / FPC))) return false; return true; }
    var CREAM_SET = ['#f3ede0', '#e8dfcc', '#d9cfba'], rr = srand(2026);
    // Levels measured from the model: ground retail 0 to 4.5 m (about 12 ft clear), offices on levels 2 and 3 (4.5 and 7.5 m, 3.0 m each).
    var RETAIL_H = 4.3, OFFICE_FLOORS = [4.6, 7.6], OFFICE_H = 2.75;
    cards.forEach(function (c, ci) {
      curFp = FPL.L2[c.letter] || FP.L2;
      var H = RETAIL_H, w = c.w, rr2 = srand(7000 + ci * 17);
      var cream = CREAM_SET[ci % 3], dark = '#cbbfa6', acc = ['#eaa0b6', '#9fd0e0', '#f0d38a', '#b6dca8'][ci % 4], paper = '#f6f1e6';
      var bx = function (u0, u1, d0, d1, h0, h1, col) { box(c.cx, c.cz, c.y, c.ax, c.az, c.nx, c.nz, u0, u1, d0, d1, h0, h1, col); };
      var half = w / 2 - .35, mezz = 2.8;
      // full-height back shelving (to 3.4 m) with boards and goods on every board
      bx(-half, half, 2.6, 2.95, 0, 3.5, cream);
      [.7, 1.4, 2.1, 2.8, 3.3].forEach(function (hh) { bx(-half, half, 2.15, 2.95, hh, hh + .05, dark); });
      var goods = Math.floor(half * (mobile ? 1.6 : 4.5));
      for (var k = 0; k < goods; k++) { var uu = -half + .25 + rr2() * (2 * half - .6), hh2 = [.75, 1.45, 2.15, 3.35][Math.floor(rr2() * 4)]; bx(uu, uu + .22 + rr2() * .35, 2.2, 2.55, hh2, hh2 + .2 + rr2() * .3, rr2() < .35 ? acc : (rr2() < .5 ? paper : dark)); }
      // mezzanine over the back third: deck, rail, stair, and things up there
      if (w > 4) {
        bx(-half, half, 1.9, 2.95, mezz - .12, mezz, cream); bx(-half, half, 1.86, 1.94, mezz, mezz + .95, dark);
        for (var s = 0; s < 6; s++) bx(half - .9 + s * 0, half, 1.9 - s * .28 - .28, 1.9 - s * .28, 0, .3 + s * .42, dark);
        bx(-half + .4, -half + 1.3, 2.2, 2.9, mezz, mezz + .75, acc); bx(-.5 + rr2() * .3, .3, 2.1, 2.8, mezz, mezz + .45, paper);
      }
      // counter with till and display
      var cu = (rr2() - .5) * Math.max(0, w - 4.2), cl = Math.min(w * .5, 3.4) / 2;
      bx(cu - cl, cu + cl, .9, 1.5, 0, .95, cream); bx(cu - cl - .05, cu + cl + .05, .85, 1.55, .95, 1.01, dark); bx(cu - .25, cu + .25, 1.0, 1.3, 1.01, 1.25, acc);
      // display tables with goods, and a few seats
      var nt = w > 5.5 ? 3 : 2;
      for (var t2 = 0; t2 < nt; t2++) {
        var tu = (t2 - (nt - 1) / 2) * (w * .34) + (rr2() - .5) * .5;
        bx(tu - .55, tu + .55, -.2, .45, .72, .78, dark); bx(tu - .06, tu + .06, .05, .17, 0, .72, dark);
        bx(tu - .3, tu - .05, -.05, .2, .78, .98, rr2() < .5 ? acc : paper); bx(tu + .1, tu + .4, .0, .3, .78, .9, paper);
        if (t2 % 2 === 0) { bx(tu - .95, tu - .65, -.05, .25, 0, .45, acc); bx(tu + .65, tu + .95, -.05, .25, 0, .45, cream); }
      }
      // pendant lights
      for (var pl = 0; !mobile && pl < Math.max(2, Math.floor(w / 2.4)); pl++) { var lu = -half + .8 + pl * ((2 * half - 1.6) / Math.max(1, Math.floor(w / 2.4) - 1 || 1)); bx(lu - .015, lu + .015, 1.2, 1.23, 3.1, 4.1, dark); bx(lu - .22, lu + .22, 1.0, 1.45, 2.95, 3.12, paper); }
    });
    var bands = [];
    offices.slice(0, 40).forEach(function (o) { OFFICE_FLOORS.forEach(function (fy) { bands.push({ o: o, y: fy, desks: [] }); }); });
    var cardCount = cards.length + bands.length;
    bands.forEach(function (b, bi) {
      var lvS = b.y < 6 ? FPL.L2 : FPL.L3; curFp = lvS[b.o.letter] || (b.y < 6 ? FP.L2 : FP.L3);
      var o = b.o, y = b.y, w = o.w, ax = o.ax, az = o.az, nx = o.nx, nz = o.nz, per = Math.max(2, Math.min(12, Math.floor((w - 1.5) / 2.4))), rr3 = srand(9000 + bi * 29);
      var bx = function (u0, u1, d0, d1, h0, h1, col) { box(o.cx, o.cz, y, ax, az, nx, nz, u0, u1, d0, d1, h0, h1, col); };
      for (var row = 0; row < 2; row++) for (var i = 0; i < per; i++) {
        var u = -w / 2 + .9 + (i + .5) * ((w - 1.8) / per), d = 1.4 + row * 2.6;
        bx(u - .7, u + .7, d, d + .75, .72, .77, '#cbbfa6'); bx(u - .65, u - .6, d + .05, d + .1, 0, .72, '#cbbfa6'); bx(u + .6, u + .65, d + .65, d + .7, 0, .72, '#cbbfa6');
        bx(u - .25, u + .25, d + .45, d + .5, .77, 1.12, '#f3ede0'); bx(u - .2, u + .2, d + .15, d + .5, .77, .8, '#f3ede0');
        bx(u - .2, u + .1, d + .05, d + .3, .8, .83, i % 2 ? '#eaa0b6' : '#f6f1e6');
        bx(u - .25, u + .25, d + 1.0, d + 1.45, 0, .5, i % 3 === 0 ? '#eaa0b6' : '#e8dfcc'); bx(u - .25, u + .25, d + 1.0, d + 1.08, .5, .95, '#e8dfcc');
        if (i % 2 === 1) bx(u - .02 - .75, u + .02 - .75, d - .2, d + .95, 0, 1.2, '#e8dfcc');
        if (inFp(o.cx + ax * u - nx * (d + 1.2), o.cz + az * u - nz * (d + 1.2))) b.desks.push([u, d + 1.2]);
      }
      // meeting table, filing, plants, and a ceiling light bar over each row
      var mu = (rr3() - .5) * Math.max(0, w - 6);
      bx(mu - 1.3, mu + 1.3, 6.0, 7.0, .72, .78, '#cbbfa6'); bx(mu - .1, mu + .1, 6.3, 6.7, 0, .72, '#cbbfa6');
      for (var ch = 0; ch < 6; ch++) { var cu2 = mu - 1.0 + (ch % 3) * 1.0, cd = ch < 3 ? 5.55 : 7.45; bx(cu2 - .22, cu2 + .22, cd - .22, cd + .22, 0, .48, '#e8dfcc'); }
      bx(-w / 2 + .3, -w / 2 + .9, 6.2, 6.9, 0, 1.6, '#e8dfcc'); bx(w / 2 - .9, w / 2 - .3, 6.2, 6.9, 0, 1.6, '#e8dfcc');
      bx(-w / 2 + .5, -w / 2 + .9, .3, .7, 0, .5, '#b6dca8'); bx(w / 2 - .9, w / 2 - .5, .3, .7, 0, .5, '#b6dca8');
      [1.9, 4.5].forEach(function (cd) { bx(-w / 2 + 1, w / 2 - 1, cd, cd + .22, OFFICE_H - .12, OFFICE_H, '#f6f1e6'); });
    });    var cg = new BG(); cg.setAttribute('position', new Attr(new Float32Array(IP), 3)); cg.setAttribute('normal', new Attr(new Float32Array(IN), 3)); cg.setAttribute('color', new Attr(new Float32Array(IC), 3)); cg.setIndex(II);
    var interiorMat = std.clone(); interiorMat.name = 'Hive sketch interiors'; interiorMat.map = null; interiorMat.normalMap = null; interiorMat.roughnessMap = null; interiorMat.color.set('#ffffff'); interiorMat.emissive.set('#d99a4c'); interiorMat.emissiveIntensity = .55; interiorMat.vertexColors = true; interiorMat.roughness = 1; interiorMat.metalness = 0; interiorMat.side = 2; interiorMat.needsUpdate = true;
    var cardMesh = new Mesh(cg, interiorMat); cardMesh.name = 'Hive interiors'; cardMesh.frustumCulled = false; ctx.scene.add(cardMesh);

    // people
    fetch('light/walkers.json?v=1').then(function (r) { return r.json(); }).then(function (G) {
      var S = G.s, AX = [], AY = [], AZ = [], ADJ = [];
      for (var i = 0, k = 0; i < G.x.length; i++) { AX.push(G.x[i] * S); AY.push(G.h[i] / 100); AZ.push(G.z[i] * S); var c = G.e[k++], nb = []; for (var q = 0; q < c; q++) nb.push(G.e[k++]); ADJ.push(nb); }
      var PROM = [], gx0 = -69, gz0 = 184, cols = Math.round((150 - gx0) / S) + 1, rows = 7, hole = {};
      for (var gi = 0; gi < cols; gi++) for (var gj = 0; gj < rows; gj++) {
        var wx = gx0 + gi * S, wz = gz0 + gj * S, blocked = false;
        TREES.forEach(function (T) { if (!T[3] && Math.hypot(wx - T[0], wz - T[2]) < 2.6) blocked = true; });
        if (wz > shoreZ(wx) - 1.6) blocked = true;
        if (blocked) { hole[gi + ',' + gj] = -1; continue; }
        hole[gi + ',' + gj] = AX.length; AX.push(wx); AY.push(.05); AZ.push(wz); ADJ.push([]); PROM.push(AX.length - 1);
      }
      for (var gi2 = 0; gi2 < cols; gi2++) for (var gj2 = 0; gj2 < rows; gj2++) {
        var a0 = hole[gi2 + ',' + gj2]; if (a0 === undefined || a0 < 0) continue;
        for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; var b0 = hole[(gi2 + di) + ',' + (gj2 + dj)]; if (b0 !== undefined && b0 >= 0) ADJ[a0].push(b0); }
      }
      var PX = AX, PY = AY, PZ = AZ, ground = [], decks = [];
      for (var n = 0; n < G.x.length; n++) (PY[n] < 1.5 ? ground : decks).push(n);
      // Solid things at body height on each walking level (walls, columns, planters, glass): people keep clear of them.
      var OC = .5, BANDS = [[.25, 1.9], [5.25, 6.9], [8.25, 9.9]], OCC = [new Set(), new Set(), new Set()];
      ctx.scene.traverse(function (o) {
        if (!o.isMesh || /context|water|Hive (sketch|canal|site|road|shore|interiors)/.test(o.name || '') || (o.userData && o.userData.skEdge)) return;
        var g = o.geometry; if (!g || !g.attributes.position) return; var P = g.attributes.position, I = g.index, n = I ? I.count : P.count; o.updateWorldMatrix(true, false); var e = o.matrixWorld.elements;
        function wp(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
        for (var t = 0; t < n; t += 3) {
          var a = wp(I ? I.getX(t) : t), b = wp(I ? I.getX(t + 1) : t + 1), c = wp(I ? I.getX(t + 2) : t + 2);
          var lo = Math.min(a[1], b[1], c[1]), hi = Math.max(a[1], b[1], c[1]); if (hi < .25 || lo > 9.9) continue;
          var mnx = Math.min(a[0], b[0], c[0]), mxx = Math.max(a[0], b[0], c[0]), mnz = Math.min(a[2], b[2], c[2]), mxz = Math.max(a[2], b[2], c[2]); if (mxx < -100 || mnx > 175 || mxz < 60 || mnz > 205) continue;
          var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ny = e1[2] * e2[0] - e1[0] * e2[2], nl = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], ny, e1[0] * e2[1] - e1[1] * e2[0]) || 1; if (Math.abs(ny) / nl > .8) continue;
          for (var q = 0; q < 3; q++) {
            if (hi < BANDS[q][0] || lo > BANDS[q][1]) continue;
            [[a, b], [b, c], [c, a]].forEach(function (s) { var len = Math.hypot(s[1][0] - s[0][0], s[1][2] - s[0][2]), steps = Math.max(1, Math.ceil(len / (OC * .5))); for (var k = 0; k <= steps; k++) { var u = k / steps; OCC[q].add(Math.floor((s[0][0] + (s[1][0] - s[0][0]) * u) / OC) + ',' + Math.floor((s[0][2] + (s[1][2] - s[0][2]) * u) / OC)); } });
          }
        }
      });
      function levelBand(y) { return y < 1.5 ? 0 : (y > 4.5 && y < 5.6 ? 1 : (y > 7.5 && y < 8.7 ? 2 : -1)); }
      function solidAt(x, y, z, r) { var q = levelBand(y); if (q < 0) return false; var cx = Math.floor(x / OC), cz = Math.floor(z / OC), rr = Math.ceil((r || .6) / OC); for (var dx = -rr; dx <= rr; dx++) for (var dz = -rr; dz <= rr; dz++) if (OCC[q].has((cx + dx) + ',' + (cz + dz))) return true; return false; }
      var blocked = new Uint8Array(AX.length); for (var bn = 0; bn < AX.length; bn++) { blocked[bn] = solidAt(AX[bn], AY[bn], AZ[bn], .6) ? 1 : 0; if (!blocked[bn] && AY[bn] < 1.5) TREES.forEach(function (T) { if (!T[3] && Math.hypot(AX[bn] - T[0], AZ[bn] - T[2]) < 1.6) blocked[bn] = 1; }); }
      ground = ground.filter(function (n) { return !blocked[n]; }); decks = decks.filter(function (n) { return !blocked[n]; }); PROM = PROM.filter(function (n) { return !blocked[n]; });      // places to sit: planter edges by the trees and the canal edge
      var SPOTS = [];
      TREES.forEach(function (T) { if (!T[3]) { SPOTS.push([T[0] - 2.3, T[2] + 1.4, 0]); SPOTS.push([T[0] + 2.3, T[2] + 1.4, 0]); } });
      for (var sx = -60; sx <= 140; sx += 11) { var sxx = sx + (sx % 2 ? 2 : 0); SPOTS.push([sxx, shoreZ(sxx) - 1.5, 1]); }
      SPOTS = SPOTS.filter(function (s) { return !solidAt(s[0], 0, s[1], .7); });
      var spotBusy = SPOTS.map(function () { return false; });
      // sprites: people on paths + inside shops + inside offices
      var shopPeople = [], officePeople = [];
      cards.forEach(function (c, ci) { for (var q = 0; q < c.people; q++) shopPeople.push({ card: c, u: rnd(), dir: rnd() < .5 ? 1 : -1, speed: .25 + rnd() * .35, pause: rnd() * 4, type: Math.floor(rnd() * 6), phase: rnd() * 6 }); });
      bands.forEach(function (b) { var n = Math.min(b.desks.length, 1 + Math.floor(rnd() * 3)); for (var q = 0; q < n && officePeople.length < (mobile ? 14 : 40); q++) { var dk = b.desks[Math.floor(rnd() * b.desks.length)]; officePeople.push({ b: b, u: dk[0], d: dk[1], type: Math.floor(rnd() * 6) }); } });
      var folks = [], total = N_PROM + N_GROUND + N_DECK + shopPeople.length + officePeople.length;
      var bb = Billboards(Mesh, BG, Attr, spriteMaterial(std, peopleAtlas(Tex)), total, .55);
      function setFrame(i, type, frame, flip) { var f = type * 6 + frame, col = f % ACOLS, row = Math.floor(f / ACOLS); bb.cell(i, col * CW / (CW * ACOLS), 1 - row / 3, (col + 1) * CW / (CW * ACOLS), 1 - (row + 1) / 3, flip); }
      function mk(pool, kind) {
        var node = pool[Math.floor(rnd() * pool.length)], type = Math.floor(rnd() * 6);
        return { kind: kind, node: node, prev: -1, next: -1, t: rnd(), x: PX[node], y: PY[node], z: PZ[node], dx: 1, dz: 0, speed: (type === 4 ? .9 : 1.05) + rnd() * .5, type: type, phase: rnd() * 6.28, state: 'walk', timer: 3 + rnd() * 8, spot: -1, flip: false, frame: 0, sit: false };
      }
      for (var w = 0; w < N_PROM; w++) folks.push(mk(PROM, 'prom'));
      for (var g2 = 0; g2 < N_GROUND; g2++) folks.push(mk(ground, 'ground'));
      for (var d2 = 0; d2 < N_DECK; d2++) folks.push(mk(decks, 'deck'));
      function pick(f) {
        var nbs = ADJ[f.node]; if (!nbs.length) return -1;
        var tot = 0, wts = [];
        for (var e = 0; e < nbs.length; e++) { var j = nbs[e], dx = PX[j] - PX[f.node], dz = PZ[j] - PZ[f.node], l = Math.hypot(dx, dz) || 1; var wgt = blocked[j] || solidAt((PX[j] + PX[f.node]) / 2, (PY[j] + PY[f.node]) / 2, (PZ[j] + PZ[f.node]) / 2, .45) ? 0 : (j === f.prev ? .03 : Math.pow(Math.max(0, (dx * f.dx + dz * f.dz) / l) + .35, 2.2) + .05); wts.push(wgt); tot += wgt; }
        if (tot <= 0) return -1;
        var r = rnd() * tot; for (var q = 0; q < wts.length; q++) { r -= wts[q]; if (r <= 0) return nbs[q]; }
        return nbs[nbs.length - 1];
      }
      function nearestProm(x, z) { var best = PROM[0], bd = 1e9; PROM.forEach(function (n) { var d = (PX[n] - x) * (PX[n] - x) + (PZ[n] - z) * (PZ[n] - z); if (d < bd) { bd = d; best = n; } }); return best; }
      folks.forEach(function (f) { f.next = pick(f); if (f.next >= 0) { var l = Math.hypot(PX[f.next] - PX[f.node], PZ[f.next] - PZ[f.node]) || 1; f.dx = (PX[f.next] - PX[f.node]) / l; f.dz = (PZ[f.next] - PZ[f.node]) / l; } });
      function walk(f, dt) {
        if (f.next < 0) return;
        var ex = PX[f.next] - PX[f.node], ez = PZ[f.next] - PZ[f.node], len = Math.hypot(ex, ez) || 1; f.t += f.speed * dt / len;
        while (f.t >= 1 && f.next >= 0) { f.t -= 1; f.prev = f.node; f.node = f.next; f.next = pick(f); if (f.next >= 0) { var nx = PX[f.next] - PX[f.node], nz = PZ[f.next] - PZ[f.node], nl = Math.hypot(nx, nz) || 1; f.dx = nx / nl; f.dz = nz / nl; } }
        if (f.next < 0) { f.t = 0; f.next = f.prev; f.prev = -1; if (f.next >= 0) { var rx = PX[f.next] - PX[f.node], rz = PZ[f.next] - PZ[f.node], rl = Math.hypot(rx, rz) || 1; f.dx = rx / rl; f.dz = rz / rl; } }
        var nn = f.next >= 0 ? f.next : f.node, tx = f.next >= 0 ? f.t : 0;
        f.x = PX[f.node] + (PX[nn] - PX[f.node]) * tx; f.z = PZ[f.node] + (PZ[nn] - PZ[f.node]) * tx; f.y = PY[f.node] + (PY[nn] - PY[f.node]) * tx;
      }
      var camRight = { x: 1, z: 0 };
      function step(dt, time) {
        folks.forEach(function (f, i) {
          if (f.state === 'walk') {
            walk(f, dt); f.timer -= dt;
            if (f.timer <= 0) {
              var r = rnd();
              if (f.kind === 'prom' && r < .38) { // head for somewhere to sit
                var bi = -1, bd = 1e9; SPOTS.forEach(function (s, k) { if (spotBusy[k]) return; var d = Math.hypot(s[0] - f.x, s[1] - f.z); if (d < bd && d < 40) { bd = d; bi = k; } });
                if (bi >= 0) { f.spot = bi; spotBusy[bi] = true; f.state = 'goto'; f.timer = 0; }
                else { f.timer = 3 + rnd() * 6; }
              } else if (r < .7) { f.state = 'stand'; f.timer = 2 + rnd() * 5; } else f.timer = 4 + rnd() * 9;
            }
          } else if (f.state === 'stand') { f.timer -= dt; if (f.timer <= 0) { f.state = 'walk'; f.timer = 4 + rnd() * 10; } }
          else if (f.state === 'goto') {
            var s = SPOTS[f.spot], dx = s[0] - f.x, dz = s[1] - f.z, d = Math.hypot(dx, dz);
            if (d < .15) { f.state = 'sit'; f.timer = 9 + rnd() * 24; f.x = s[0]; f.z = s[1]; f.flip = s[2] === 1 ? false : rnd() < .5; f.faceCanal = s[2] === 1; }
            else { var mv = Math.min(d, f.speed * dt); f.x += dx / d * mv; f.z += dz / d * mv; f.dx = dx / d; f.dz = dz / d; }
          } else if (f.state === 'sit') {
            f.timer -= dt;
            if (f.timer <= 0) { spotBusy[f.spot] = false; f.spot = -1; f.state = 'walk'; f.timer = 6 + rnd() * 12; f.node = nearestProm(f.x, f.z); f.prev = -1; f.t = 0; f.next = pick(f); f.y = PY[f.node]; }
          }
          var moving = f.state === 'walk' || f.state === 'goto', sit = f.state === 'sit', frame = sit ? 5 : moving ? Math.floor(time * f.speed * 3.4 + f.phase) % 4 : 4;
          var flip = sit ? f.flip : (f.dx * camRight.x + f.dz * camRight.z) < 0;
          if (sit && f.faceCanal) flip = camRight.z < 0 ? false : false;
          var h = PEOPLE[f.type].m * 1.19;
          bb.place(i, f.x, f.y + (sit ? .02 : 0), f.z, h * .5, h, 0);
          if (frame !== f.frame || flip !== f.flipped) { f.frame = frame; f.flipped = flip; setFrame(i, f.type, frame, flip); }
        });
        var base = folks.length;
        shopPeople.forEach(function (p, j) {
          var c = p.card, i = base + j;
          if (p.pause > 0) { p.pause -= dt; } else { p.u += p.dir * p.speed * dt / c.w; if (p.u > .9 || p.u < .1) { p.dir = -p.dir; p.u = Math.max(.1, Math.min(.9, p.u)); p.pause = 1.5 + rnd() * 5; } }
          var moving = p.pause <= 0, off = (p.u - .5) * c.w, h = PEOPLE[p.type].m * 1.19;
          var spx = c.cx + c.ax * off - c.nx * .2, spz = c.cz + c.az * off - c.nz * .2; curFp = FPL.L2[c.letter] || FP.L2; var okp = inFp(spx, spz, .35);
          bb.place(i, spx, c.y + .02, spz, okp ? h * .5 : 0, okp ? h : 0, 0);
          var frame = moving ? Math.floor(time * 1.6 + p.phase) % 4 : 4, flip = (p.dir * (c.ax * camRight.x + c.az * camRight.z)) < 0;
          if (frame !== p.frame || flip !== p.flipped) { p.frame = frame; p.flipped = flip; setFrame(i, p.type, frame, flip); }
        });
        base += shopPeople.length;
        officePeople.forEach(function (p, j) {
          var i = base + j, o = p.b.o, h = PEOPLE[p.type].m * 1.19 * .86;
          var opx = o.cx + o.ax * p.u - o.nx * p.d, opz = o.cz + o.az * p.u - o.nz * p.d; curFp = (p.b.y < 6 ? FPL.L2 : FPL.L3)[p.b.o.letter] || (p.b.y < 6 ? FP.L2 : FP.L3); var oko = inFp(opx, opz, .35);
          bb.place(i, opx, p.b.y, opz, oko ? h * .5 : 0, oko ? h : 0, 0);
          if (!p.set) { p.set = true; setFrame(i, p.type, 5, (o.ax * camRight.x + o.az * camRight.z) < 0); }
        });
      }
      // keep facing direction in step with the camera
      var origBefore = bb.mesh.onBeforeRender;
      bb.mesh.onBeforeRender = function (renderer, scene, camera) { camera.updateMatrixWorld(); var e = camera.matrixWorld.elements, l = Math.hypot(e[0], e[2]) || 1; camRight.x = e[0] / l; camRight.z = e[2] / l; origBefore.call(this, renderer, scene, camera); };
      ctx.scene.add(bb.mesh);
      var shadowless = true; step(0, 0);
      anim.push(function (time, dt) { step(dt, time); });
      var on = true, panel = document.querySelector('.building-panel');
      if (panel) {
        var lab = document.createElement('label'); lab.style.cssText = 'display:flex;gap:8px;align-items:center;margin:10px 0;font-size:14px;cursor:pointer';
        lab.innerHTML = '<input type="checkbox" checked style="width:18px;height:18px"> <span>People, shops and trees in motion</span>';
        var stats = panel.querySelector('#model-stats'); if (stats) panel.insertBefore(lab, stats); else panel.appendChild(lab);
        lab.querySelector('input').addEventListener('change', function (e) { on = e.target.checked; bb.mesh.visible = on; cardMesh.visible = on; redraw(ctx); });
      }
      anim.hz = HZ; anim.isOn = function () { return on; };
      window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { people: folks.length, shopPeople: shopPeople.length, officePeople: officePeople.length, shopCards: cards.length, officeBands: bands.length, walkerAt: function (i) { var f = folks[i]; return [f.x, f.y, f.z, f.state]; } });
    }).catch(function (e) { console.warn('Hive sketch people failed:', e && e.message || e); });
  }

  /* One animation loop for everything that moves. */
  function startAnimation(ctx, anim, waterT) {
    var last = 0, time = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      var hz = anim.hz || 12, on = anim.isOn ? anim.isOn() : true;
      if (document.hidden || now - last < 1000 / hz) return;
      var dt = Math.min(.25, (now - last) / 1000); last = now; time += dt;
      if (waterT) { waterT.offset.x = (time * .018) % 1; waterT.offset.y = Math.sin(time * .35) * .03; }
      if (on) anim.forEach(function (fn) { fn(time, dt); });
      redraw(ctx);
    }
    requestAnimationFrame(tick);
  }

  /* The light export flattened the glazing to an opaque colour. The full model's glass is see-through (about 32% opaque), so restore it. */
  function restoreGlass(ctx) {
    var seen = new Set(), n = 0;
    ctx.scene.traverse(function (o) {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (!m || seen.has(m) || !/glass/i.test(m.name || '')) return; seen.add(m);
        m.transparent = true; m.opacity = .32; m.roughness = .16; m.depthWrite = false; m.side = 2; m.needsUpdate = true; n++;
      });
      if (/glass/i.test(o.name || '')) o.renderOrder = 2;
    });
    redraw(ctx);
    window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { glassMaterials: n });
  }
  /* Where the site meets the canal: paving carried right up to the water, a one-foot curb, and a light stylised rail. */
  function addShore(ctx, ref, std) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var P = [], N = [], C = [], I = [];
    function bx(cx, cy, cz, sx, sy, sz, yaw, hex) {
      var col = [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255], cs = Math.cos(yaw), sn = Math.sin(yaw), hx = sx / 2, hy = sy / 2, hz = sz / 2;
      var faces = [[[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]], [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]], [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]], [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]], [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]];
      faces.forEach(function (f) {
        var base = P.length / 3, sh = f[0][1] > .5 ? 1 : .82;
        f[1].forEach(function (p) { P.push(cx + p[0] * cs + p[2] * sn, cy + p[1], cz - p[0] * sn + p[2] * cs); N.push(f[0][0] * cs + f[0][2] * sn, f[0][1], -f[0][0] * sn + f[0][2] * cs); C.push(col[0] * sh, col[1] * sh, col[2] * sh); });
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      });
    }
    var pts = [[-110, SHORE[0][1]]].concat(SHORE);
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx), nx = -dz / len, nz = dx / len, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      // curb: its outer face on the shoreline
      bx(mx - nx * .16, .16, mz - nz * .16, len + .02, .34, .34, yaw, '#e4dccb');
      // rail: posts every 3 m, a handrail and a mid rail
      var posts = Math.max(1, Math.round(len / 3));
      for (var k = 0; k <= posts; k++) { var t = k / posts; bx(a[0] + dx * t - nx * .16, .34 + .5, a[1] + dz * t - nz * .16, .07, 1.0, .07, yaw, '#d6cdb8'); }
      bx(mx - nx * .16, 1.28, mz - nz * .16, len, .06, .07, yaw, '#cfc5ad'); bx(mx - nx * .16, .8, mz - nz * .16, len, .04, .05, yaw, '#cfc5ad');
    }
    var g = new BG(); g.setAttribute('position', new Attr(new Float32Array(P), 3)); g.setAttribute('normal', new Attr(new Float32Array(N), 3)); g.setAttribute('color', new Attr(new Float32Array(C), 3)); g.setIndex(I);
    var m = std.clone(); m.name = 'Hive shore curb'; m.map = null; m.normalMap = null; m.roughnessMap = null; m.color.set('#ffffff'); m.emissive.set('#3d3a34'); m.vertexColors = true; m.roughness = 1; m.metalness = 0; m.side = 2; m.needsUpdate = true;
    var mesh = new Mesh(g, m); mesh.name = 'Hive shore curb'; mesh.frustumCulled = false; ctx.scene.add(mesh);
    // paving from the existing edge to the shoreline, so no strip of bare ground is left between the site and the water
    var paving = null; ctx.scene.traverse(function (o) { if (o.isMesh && o.name === 'Hive site paving') paving = o; });
    var SP = [], SN = [], SC = [], SU = [], SI = [];
    for (var j = 0; j < pts.length - 1; j++) {
      var p0 = pts[j], p1 = pts[j + 1], idx = SP.length / 3, q = [[p0[0], p0[1] - 9], [p1[0], p1[1] - 9], [p1[0], p1[1]], [p0[0], p0[1]]];
      q.forEach(function (p) { SP.push(p[0], .035, p[1]); SN.push(0, 1, 0); SC.push(.95, .95, .94); SU.push(p[0] / 2.2, p[1] / 2.2); });
      SI.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
    }
    var sg = new BG(); sg.setAttribute('position', new Attr(new Float32Array(SP), 3)); sg.setAttribute('normal', new Attr(new Float32Array(SN), 3)); sg.setAttribute('color', new Attr(new Float32Array(SC), 3)); sg.setAttribute('uv', new Attr(new Float32Array(SU), 2)); sg.setIndex(SI);
    var sm = paving ? paving.material : m, sMesh = new Mesh(sg, sm); sMesh.name = 'Hive site paving shore'; sMesh.frustumCulled = false; ctx.scene.add(sMesh);
    redraw(ctx);
  }
  /* Amenity deck: the same hexagonal tile floor as the ground, laid over every upward-facing slab on the deck level
     (the pool openings stay open because there is no slab there). */
  function addDeckFloor(ctx, ref, std) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var P = [], N = [], U = [], C = [], I = [];
    ctx.scene.traverse(function (o) {
      if (!o.isMesh || !/^HIVE_.*_static$/.test(o.name) || /context|site|water/.test(o.name)) return;
      var g = o.geometry, Pp = g.attributes.position, Ix = g.index, n = Ix ? Ix.count : Pp.count; o.updateWorldMatrix(true, false); var e = o.matrixWorld.elements;
      function wp(i) { var x = Pp.getX(i), y = Pp.getY(i), z = Pp.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
      for (var t = 0; t < n; t += 3) {
        var a = wp(Ix ? Ix.getX(t) : t), b = wp(Ix ? Ix.getX(t + 1) : t + 1), c = wp(Ix ? Ix.getX(t + 2) : t + 2), cy = (a[1] + b[1] + c[1]) / 3; if (cy < 13.45 || cy > 13.85) continue;
        var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ny = e1[2] * e2[0] - e1[0] * e2[2], nl = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], ny, e1[0] * e2[1] - e1[1] * e2[0]); if (nl < 1e-9 || ny / nl < .95) continue;
        var base = P.length / 3; [a, b, c].forEach(function (p) { P.push(p[0], 13.745, p[2]); N.push(0, 1, 0); U.push(p[0] / 2.2, p[2] / 2.2); var s = .93 + .07 * vnoise(p[0] / 9, p[2] / 9); C.push(s, s, s * .985); });
        I.push(base, base + 1, base + 2);
      }
    });
    if (!P.length) return;
    var g = new BG(); g.setAttribute('position', new Attr(new Float32Array(P), 3)); g.setAttribute('normal', new Attr(new Float32Array(N), 3)); g.setAttribute('uv', new Attr(new Float32Array(U), 2)); g.setAttribute('color', new Attr(new Float32Array(C), 3)); g.setIndex(I);
    var paving = null; ctx.scene.traverse(function (o) { if (o.isMesh && o.name === 'Hive site paving') paving = o; });
    var mat = paving ? paving.material : std.clone();
    var mesh = new Mesh(g, mat); mesh.name = 'Hive deck paving'; mesh.frustumCulled = false; ctx.scene.add(mesh);
    window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { deckTriangles: I.length / 3 });
  }
  /* Three small buildings inside the site (traced from the plan sheets) that the model was missing. */
  var CTX_EXTRA = [{"poly":[[31.73,57.67],[48.94,71.68],[31.91,92.43],[14.61,78.25]],"h":8},{"poly":[[61.31,63.12],[68.05,68.66],[53.7,85.95],[52.31,84.82],[43.23,97.19],[38.13,93.64],[47.3,80.76],[48.16,80.5]],"h":8},{"poly":[[76.87,75.66],[83.61,81.02],[69.78,98.49],[62.86,93.13]],"h":8}];
  function addContextExtra(ctx, ref, std) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry), P = [], N = [], I = [];
    function earClip(poly) { var idx = poly.map(function (_, i) { return i; }), out = [], guard = 0, area = 0; for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; } if (area < 0) idx.reverse();
      function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
      while (idx.length > 3 && guard++ < 200) { var cut = false; for (var k = 0; k < idx.length; k++) { var i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], p0 = poly[i0], p1 = poly[i1], p2 = poly[i2]; if (cross(p0, p1, p2) <= 0) continue; var inside = false; for (var m = 0; m < idx.length; m++) { var q = idx[m]; if (q === i0 || q === i1 || q === i2) continue; var pp = poly[q]; if (cross(p0, p1, pp) >= 0 && cross(p1, p2, pp) >= 0 && cross(p2, p0, pp) >= 0) { inside = true; break; } } if (inside) continue; out.push([i0, i1, i2]); idx.splice(k, 1); cut = true; break; } if (!cut) break; }
      if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]); return out; }
    CTX_EXTRA.forEach(function (b) {
      var n = b.poly.length, h = b.h, base = P.length / 3;
      earClip(b.poly).forEach(function (t) { var s = P.length / 3; t.forEach(function (i) { P.push(b.poly[i][0], h, b.poly[i][1]); N.push(0, 1, 0); }); I.push(s, s + 1, s + 2); });
      for (var i = 0; i < n; i++) { var p = b.poly[i], q = b.poly[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1, nx = dz / l, nz = -dx / l, s = P.length / 3; P.push(p[0], 0, p[1], q[0], 0, q[1], q[0], h, q[1], p[0], h, p[1]); for (var k = 0; k < 4; k++) N.push(nx, 0, nz); I.push(s, s + 1, s + 2, s, s + 2, s + 3); }
    });
    var g = new BG(); g.setAttribute('position', new Attr(new Float32Array(P), 3)); g.setAttribute('normal', new Attr(new Float32Array(N), 3)); g.setIndex(I);
    var m = std.clone(); m.name = 'Hive context massing'; m.map = null; m.normalMap = null; m.roughnessMap = null; m.color.set('#d9d3c8'); m.emissive.set('#2f2d29'); m.roughness = 1; m.metalness = 0; m.side = 2; m.needsUpdate = true;
    var mesh = new Mesh(g, m); mesh.name = 'HIVE_miami-context_extra'; mesh.frustumCulled = false; ctx.scene.add(mesh);
  }
  function addPool(ctx, ref, std, corners) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    corners = corners || [[21.147, 139.571], [36.304, 137.998], [36.776, 142.545], [21.62, 144.12]];
    var cx = 0, cz = 0;
    corners.forEach(function (c) { cx += c[0] * .25; cz += c[1] * .25; });
    var dx = corners[1][0] - corners[0][0], dz = corners[1][1] - corners[0][1];
    var s = Math.sqrt(dx * dx + dz * dz), rx = dx / s, rz = dz / s, ax = -rz, az = rx;
    var width = 4.572, deck = 13.716, base = 10.82, waterY = 13.56;
    var yaw = Math.atan2(-rz, rx);
    var wallH = deck - .07 - base;
    var basinMat = std.clone(); basinMat.name = 'Pool basin'; basinMat.color.set('#c5dfe0'); basinMat.roughness = .78; basinMat.metalness = 0; basinMat.side = 2; basinMat.map = null; basinMat.normalMap = null; basinMat.roughnessMap = null; basinMat.needsUpdate = true;
    var waterMat = std.clone(); waterMat.name = 'Amenity pool water'; waterMat.color.set('#2f9ae3'); waterMat.emissive.set('#0d4a7a'); waterMat.roughness = .22; waterMat.metalness = .12; waterMat.envMapIntensity = .7; waterMat.side = 2; waterMat.map = null; waterMat.normalMap = null; waterMat.roughnessMap = null; waterMat.needsUpdate = true;
    var made = [];
    function box(name, along, y, across, w, h, d) {
      var m = new Mesh(boxGeometry(BG, Attr, w, h, d), basinMat);
      m.name = name;
      m.position.set(cx + rx * along + ax * across, y, cz + rz * along + az * across);
      m.rotation.y = yaw;
      ctx.scene.add(m); made.push(m);
    }
    box('Pool basin / floor', 0, base, 0, s - .1, .16, width - .1);
    [-1, 1].forEach(function (v) {
      box('Pool basin / long side', 0, base + wallH / 2, v * (width / 2 - .12), s - .1, wallH, .15);
      box('Pool basin / end wall', v * (s / 2 - .12), base + wallH / 2, 0, .15, wallH, width - .1);
    });
    // water surface: a flat quad facing up
    var pw = (s - .35) / 2, pd = (width - .35) / 2;
    var wg = new BG();
    wg.setAttribute('position', new Attr(new Float32Array([-pw, 0, pd, pw, 0, pd, pw, 0, -pd, -pw, 0, -pd]), 3));
    wg.setAttribute('normal', new Attr(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    wg.setIndex([0, 1, 2, 0, 2, 3]);
    var water = new Mesh(wg, waterMat);
    water.name = 'Amenity pool water';
    water.position.set(cx, waterY, cz);
    water.rotation.y = yaw;
    ctx.scene.add(water); made.push(water);
    redraw(ctx);
    window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { pool: true, poolParts: made.length });
  }
})();
