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
    try { addPaving(ctx, mesh, std, Tex); } catch (e) { console.warn('Hive paving skipped:', e && e.message || e); }
    try { addWalkers(ctx, mesh, std); } catch (e) { console.warn('Hive walkers skipped:', e && e.message || e); }
    try { addPool(ctx, mesh, std); } catch (e) { console.warn('Hive pool skipped:', e && e.message || e); }
    try { addTrees(ctx, mesh, std, Tex); } catch (e) { console.warn('Hive trees skipped:', e && e.message || e); }
    if (!Tex) return;
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
          var hi = (a[1] + b[1] + c[1]) / 3 > 1.3;
          if (hi ? (context && darkTexel(o, T[1], i0, i1, i2)) : (!context || (mx > bx0 && mx < bx1 && mz > bz0 && mz < bz1) || darkTexel(o, T[1], i0, i1, i2))) {
            drop = true; removed++;
            (roadDistance(mx, mz) < 6.5 || o.name.indexOf('site-road') >= 0 ? buckets.road : buckets.site).push(a, b, c);
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
      mats.forEach(function (m) { m.map = maps[0]; m.normalMap = maps[1]; m.roughnessMap = maps[2]; if (m.normalScale) m.normalScale.set(.35, .35); m.needsUpdate = true; });
      redraw(ctx);
    }).catch(function (e) { console.warn('Hive paving textures failed:', e && e.message || e); });
  }

  /* Walking visitors: one merged mesh of simple figures that follow the site's own walking graph
     (a trimmed copy of the full model's: ground, podium deck and roof deck). */
  var SHIRTS = ['#e0557c', '#f1c453', '#4fa6c9', '#7fc28a', '#f08c4f', '#a58bd6', '#e8e4da', '#3f6fb0', '#c94f4f', '#5aa89b'];
  var PANTS = ['#2f3440', '#46505e', '#6a7585', '#3b3a36', '#5b4a3a'];
  var SKINS = ['#f1c9a5', '#d9a07a', '#b97a52', '#8a5636', '#5d3a25'];
  var HAIRS = ['#24201d', '#3b2a20', '#6b4a2e', '#b9a074', '#8c8c8c'];
  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function addWalkers(ctx, ref, std) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var mobile = !!(window.modelPerformance && window.modelPerformance.mobile);
    var COUNT = mobile ? 56 : 220, HZ = mobile ? 8 : 14, SCALE = 1.55;
    fetch('light/walkers.json?v=1').then(function (r) { return r.json(); }).then(function (G) {
      var S = G.s, AX = [], AY = [], AZ = [], ADJ = [];
      for (var i = 0, k = 0; i < G.x.length; i++) { AX.push(G.x[i] * S); AY.push(G.h[i] / 100); AZ.push(G.z[i] * S); var c = G.e[k++], nb = []; for (var q = 0; q < c; q++) nb.push(G.e[k++]); ADJ.push(nb); }
      // the frontage promenade (sidewalk between the building and the canal) is outside the site graph: add a walkable grid there, clear of the trees
      var PROM = [], gx0 = -69, gz0 = 181.5, cols = Math.round((150 - gx0) / S) + 1, rows = 8, base0 = AX.length, hole = {};
      for (var gi = 0; gi < cols; gi++) for (var gj = 0; gj < rows; gj++) {
        var wx = gx0 + gi * S, wz = gz0 + gj * S, blocked = false;
        TREES.forEach(function (T) { if (!T[3] && Math.hypot(wx - T[0], wz - T[2]) < 2.6) blocked = true; });
        if (blocked) { hole[gi + ',' + gj] = -1; continue; }
        hole[gi + ',' + gj] = AX.length; AX.push(wx); AY.push(.05); AZ.push(wz); ADJ.push([]); PROM.push(AX.length - 1);
      }
      for (var gi2 = 0; gi2 < cols; gi2++) for (var gj2 = 0; gj2 < rows; gj2++) {
        var a0 = hole[gi2 + ',' + gj2]; if (a0 === undefined || a0 < 0) continue;
        for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; var b0 = hole[(gi2 + di) + ',' + (gj2 + dj)]; if (b0 !== undefined && b0 >= 0) ADJ[a0].push(b0); }
      }
      var N = AX.length, PX = Float32Array.from(AX), PY = Float32Array.from(AY), PZ = Float32Array.from(AZ);
      var seed = 4171; function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
      // figure template: boxes, feet at y = 0, facing +z. pivot parts swing about X
      var parts = [
        { b: [-.1, .43, 0, .15, .86, .17], pv: [-.1, .86, 0], sw: 1, col: 'pants' },
        { b: [.1, .43, 0, .15, .86, .17], pv: [.1, .86, 0], sw: -1, col: 'pants' },
        { b: [0, 1.13, 0, .42, .56, .22], col: 'shirt' },
        { b: [-.27, 1.1, 0, .1, .56, .13], pv: [-.27, 1.38, 0], sw: -.8, col: 'shirt' },
        { b: [.27, 1.1, 0, .1, .56, .13], pv: [.27, 1.38, 0], sw: .8, col: 'shirt' },
        { b: [0, 1.56, 0, .22, .26, .24], col: 'skin' },
        { b: [0, 1.71, -.01, .24, .1, .26], col: 'hair' }
      ];
      var VPP = parts.length * 24, TPP = parts.length * 12;
      var tp = new Float32Array(VPP * 3), tn = new Float32Array(VPP * 3), tpart = new Uint8Array(VPP), ti = new Uint32Array(TPP * 3);
      var FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      parts.forEach(function (pt, pi) {
        var b = pt.b, hx = b[3] / 2, hy = b[4] / 2, hz = b[5] / 2;
        FACES.forEach(function (f, fi) {
          var u = f[0] ? [0, 1, 0] : f[1] ? [0, 0, 1] : [1, 0, 0], v = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
          for (var s = 0; s < 4; s++) {
            var su = s === 0 || s === 3 ? -1 : 1, sv = s < 2 ? -1 : 1, vi = pi * 24 + fi * 4 + s, o = vi * 3;
            tp[o] = b[0] + (f[0] * hx + u[0] * hx * su + v[0] * hx * sv); tp[o + 1] = b[1] + (f[1] * hy + u[1] * hy * su + v[1] * hy * sv); tp[o + 2] = b[2] + (f[2] * hz + u[2] * hz * su + v[2] * hz * sv);
            tn[o] = f[0]; tn[o + 1] = f[1]; tn[o + 2] = f[2]; tpart[vi] = pi;
          }
          var base = pi * 24 + fi * 4, ib = (pi * 12 + fi * 2) * 3;
          ti[ib] = base; ti[ib + 1] = base + 1; ti[ib + 2] = base + 2; ti[ib + 3] = base; ti[ib + 4] = base + 2; ti[ib + 5] = base + 3;
        });
      });
      var P = new Float32Array(COUNT * VPP * 3), Nn = new Float32Array(COUNT * VPP * 3), Cc = new Float32Array(COUNT * VPP * 3), Ii = new Uint32Array(COUNT * TPP * 3);
      var folks = [];
      // spawn: most on the ground, the rest on the decks
      var ground = [], decks = [], front = [];
      for (var n = 0; n < N; n++) { if (PY[n] < 1.5) { ground.push(n); if (PZ[n] > 112) front.push(n); } else decks.push(n); }
      for (var w = 0; w < COUNT; w++) {
        var pool = w < COUNT * .42 && PROM.length ? PROM : w < COUNT * .58 && ground.length ? ground : (decks.length ? decks : ground), node = pool[Math.floor(rnd() * pool.length)];
        var child = rnd() < .1, tall = child ? .62 + rnd() * .1 : .93 + rnd() * .16;
        var cols = { shirt: hexRgb(SHIRTS[Math.floor(rnd() * SHIRTS.length)]), pants: hexRgb(PANTS[Math.floor(rnd() * PANTS.length)]), skin: hexRgb(SKINS[Math.floor(rnd() * SKINS.length)]), hair: hexRgb(HAIRS[Math.floor(rnd() * HAIRS.length)]) };
        folks.push({ node: node, prev: -1, next: -1, t: rnd(), x: PX[node], y: PY[node], z: PZ[node], dx: 0, dz: 1, yaw: rnd() * 6.28, speed: (child ? .9 : 1.05) + rnd() * .55, s: tall * SCALE, phase: rnd() * 6.28, cols: cols });
        for (var v = 0; v < VPP; v++) { var cc = cols[parts[tpart[v]].col], o = (w * VPP + v) * 3; Cc[o] = cc[0]; Cc[o + 1] = cc[1]; Cc[o + 2] = cc[2]; }
        for (var j = 0; j < TPP * 3; j++) Ii[w * TPP * 3 + j] = ti[j] + w * VPP;
      }
      function pick(f) {
        var nbs = ADJ[f.node]; if (!nbs.length) return -1;
        var tot = 0, wts = [];
        for (var e = 0; e < nbs.length; e++) {
          var j = nbs[e], dx = PX[j] - PX[f.node], dz = PZ[j] - PZ[f.node], l = Math.hypot(dx, dz) || 1;
          var wgt = j === f.prev ? .03 : Math.pow(Math.max(0, (dx * f.dx + dz * f.dz) / l) + .35, 2.2) + .05;
          wts.push(wgt); tot += wgt;
        }
        var r = rnd() * tot; for (var q = 0; q < wts.length; q++) { r -= wts[q]; if (r <= 0) return nbs[q]; }
        return nbs[nbs.length - 1];
      }
      folks.forEach(function (f) { f.next = pick(f); if (f.next >= 0) { var l = Math.hypot(PX[f.next] - PX[f.node], PZ[f.next] - PZ[f.node]) || 1; f.dx = (PX[f.next] - PX[f.node]) / l; f.dz = (PZ[f.next] - PZ[f.node]) / l; f.yaw = Math.atan2(f.dx, f.dz); } });
      function step(dt, time) {
        for (var w = 0; w < COUNT; w++) {
          var f = folks[w];
          if (f.next >= 0) {
            var ex = PX[f.next] - PX[f.node], ez = PZ[f.next] - PZ[f.node], len = Math.hypot(ex, ez) || 1;
            f.t += f.speed * dt / len;
            while (f.t >= 1 && f.next >= 0) { f.t -= 1; f.prev = f.node; f.node = f.next; f.next = pick(f); if (f.next >= 0) { var nx = PX[f.next] - PX[f.node], nz = PZ[f.next] - PZ[f.node], nl = Math.hypot(nx, nz) || 1; f.dx = nx / nl; f.dz = nz / nl; } }
            if (f.next < 0) { f.t = 0; f.next = f.prev; f.prev = -1; if (f.next >= 0) { var rx = PX[f.next] - PX[f.node], rz = PZ[f.next] - PZ[f.node], rl = Math.hypot(rx, rz) || 1; f.dx = rx / rl; f.dz = rz / rl; } }
          }
          var tx = f.next >= 0 ? f.t : 0, nn = f.next >= 0 ? f.next : f.node;
          f.x = PX[f.node] + (PX[nn] - PX[f.node]) * tx; f.z = PZ[f.node] + (PZ[nn] - PZ[f.node]) * tx; f.y = PY[f.node] + (PY[nn] - PY[f.node]) * tx;
          var want = Math.atan2(f.dx, f.dz), dyaw = Math.atan2(Math.sin(want - f.yaw), Math.cos(want - f.yaw)); f.yaw += dyaw * Math.min(1, dt * 6);
          var cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), swing = Math.sin(time * f.speed * 5.2 + f.phase) * .55, bob = Math.abs(Math.sin(time * f.speed * 5.2 + f.phase)) * .03, sc = f.s;
          var cs = Math.cos(swing), ss = Math.sin(swing);
          for (var v = 0; v < VPP; v++) {
            var o = v * 3, x = tp[o], y = tp[o + 1], z = tp[o + 2], nx2 = tn[o], ny2 = tn[o + 1], nz2 = tn[o + 2], pt = parts[tpart[v]];
            if (pt.pv) {
              var a = swing * pt.sw, ca = Math.cos(a), sa = Math.sin(a), py = y - pt.pv[1], pz = z - pt.pv[2];
              y = pt.pv[1] + py * ca - pz * sa; z = pt.pv[2] + py * sa + pz * ca;
              var nyy = ny2 * ca - nz2 * sa; nz2 = ny2 * sa + nz2 * ca; ny2 = nyy;
            }
            var ob = (w * VPP + v) * 3;
            P[ob] = f.x + (x * cy + z * sy) * sc; P[ob + 1] = f.y + (y + bob) * sc + .03; P[ob + 2] = f.z + (-x * sy + z * cy) * sc;
            Nn[ob] = nx2 * cy + nz2 * sy; Nn[ob + 1] = ny2; Nn[ob + 2] = -nx2 * sy + nz2 * cy;
          }
        }
      }
      step(0, 0);
      var g = new BG(), posA = new Attr(P, 3), norA = new Attr(Nn, 3);
      g.setAttribute('position', posA); g.setAttribute('normal', norA); g.setAttribute('color', new Attr(Cc, 3)); g.setIndex(Array.prototype.slice.call(Ii));
      var m = std.clone(); m.name = 'Hive walking visitors'; m.map = null; m.normalMap = null; m.roughnessMap = null; m.color.set('#ffffff'); m.emissive.set('#2b2b2b'); m.vertexColors = true; m.roughness = .85; m.metalness = 0; m.side = 2; m.transparent = false; m.opacity = 1; m.needsUpdate = true;
      var crowd = new Mesh(g, m); crowd.name = 'Hive walking visitors'; crowd.frustumCulled = false; ctx.scene.add(crowd);
      // switch in the project panel
      var on = true, panel = document.querySelector('.building-panel'), last = 0, time = 0;
      if (panel) {
        var lab = document.createElement('label'); lab.style.cssText = 'display:flex;gap:8px;align-items:center;margin:10px 0;font-size:14px;cursor:pointer';
        lab.innerHTML = '<input type="checkbox" checked style="width:18px;height:18px"> <span>Walking people (' + COUNT + ')</span>';
        var stats = panel.querySelector('#model-stats'); if (stats) panel.insertBefore(lab, stats); else panel.appendChild(lab);
        lab.querySelector('input').addEventListener('change', function (e) { on = e.target.checked; crowd.visible = on; redraw(ctx); });
      }
      function tick(now) {
        requestAnimationFrame(tick);
        if (!on || document.hidden || now - last < 1000 / HZ) return;
        var dt = Math.min(.25, (now - last) / 1000); last = now; time += dt;
        step(dt, time); posA.needsUpdate = true; norA.needsUpdate = true; redraw(ctx);
      }
      requestAnimationFrame(tick);
      window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { walkers: COUNT, walkerNodes: N, walkerAt: function (i) { var f = folks[i]; return [f.x, f.y, f.z]; } });
    }).catch(function (e) { console.warn('Hive walkers failed:', e && e.message || e); });
  }

  /* Shade planting: same positions as the full page (placements already cleared of the building),
     built from one merged mesh with roughly half the leaves (fewer again on phones). */
  var TREES = [[-62,0,184,0],[-38,0,184,0],[-14,0,184,0],[10,0,184,0],[34,0,184,0],[58,0,184,0],[82,0,184,0],[106,0,184,0],[131,0,184,0],[148,0,184,0],[-80,0,172,0],[25,0,186,0],[68,0,185,0],[6,13.716,153,1],[78,13.716,141,1]];
  function addTrees(ctx, ref, std, Tex) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var mobile = !!(window.modelPerformance && window.modelPerformance.mobile);
    var seed = 719;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    var P = [], N = [], C = [], I = [];
    function vtx(x, y, z, nx, ny, nz, r, g, b) { P.push(x, y, z); N.push(nx, ny, nz); C.push(r, g, b); return P.length / 3 - 1; }
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    // tapered limb between two points, 9 sides
    function limb(a, b, r0, r1, col) {
      var d = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      var u = norm(cross(d, Math.abs(d[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), w = cross(d, u), S = 9, base = P.length / 3;
      for (var i = 0; i <= S; i++) {
        var t = i / S * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        var n = [u[0] * c + w[0] * s, u[1] * c + w[1] * s, u[2] * c + w[2] * s];
        vtx(a[0] + n[0] * r0, a[1] + n[1] * r0, a[2] + n[2] * r0, n[0], n[1], n[2], col[0], col[1], col[2]);
        vtx(b[0] + n[0] * r1, b[1] + n[1] * r1, b[2] + n[2] * r1, n[0], n[1], n[2], col[0], col[1], col[2]);
      }
      for (var k = 0; k < S; k++) { var o = base + k * 2; I.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    var wood = [.29, .2, .13];
    var LIGHT = norm([-.5, .8, .3]);
    TREES.forEach(function (T, ti) {
      var deck = T[3] === 1, x0 = T[0], y0 = T[1], z0 = T[2];
      var D = deck ? 1.65 : 3.1, V = deck ? 4.6 : 7.8, r1 = deck ? .13 : .24;
      var trunkTop = [x0, y0 + V * .52, z0];
      limb([x0, y0, z0], trunkTop, r1, r1 * .45, wood);
      var crown = [x0, y0 + V * .72, z0 + 0], R = D * 1.1;
      var branches = [];
      for (var b = 0; b < 7; b++) {
        var ang = b / 7 * Math.PI * 2 + rnd() * .5, len = D * (.7 + rnd() * .35), rise = V * (.24 + rnd() * .16);
        var tip = [x0 + Math.cos(ang) * len, y0 + V * .52 + rise, z0 + Math.sin(ang) * len];
        limb(trunkTop, tip, r1 * .45, r1 * .16, wood);
        branches.push(tip);
      }
      var full = deck ? 600 : 1300, count = Math.round(full * (mobile ? .62 : 1));
      var size = (deck ? .58 : .85) * (mobile ? 1.18 : 1);
      var hue = .86 + (ti % 3) * .05;
      for (var q = 0; q < count; q++) {
        // point in a flattened sphere, biased toward the shell so the crown reads solid
        var th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), rr = R * Math.pow(.35 + .65 * rnd(), .6);
        var lx = Math.sin(ph) * Math.cos(th), ly = Math.cos(ph), lz = Math.sin(ph) * Math.sin(th);
        var cx = crown[0] + lx * rr * 1.08, cy = crown[1] + ly * rr * .82, cz = crown[2] + lz * rr * 1.08;
        var lum = Math.max(0, lx * LIGHT[0] + ly * LIGHT[1] + lz * LIGHT[2]) * (.55 + .45 * rr / R);
        var shade = .5 + lum * .6 + rnd() * .12;
        var cr = (.17 + rnd() * .08) * shade * hue, cg = (.36 + rnd() * .16) * shade, cb = (.12 + rnd() * .05) * shade;
        var sc = size * (.7 + rnd() * .6), yaw = rnd() * Math.PI * 2, tilt = (rnd() - .5) * 1.2;
        var ax = [Math.cos(yaw), 0, Math.sin(yaw)], ay = norm([Math.sin(tilt) * -Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw)]);
        var nn = norm([lx * .6 + ay[0], ly * .6 + ay[1] + .4, lz * .6 + ay[2]]);
        var o = P.length / 3, h = sc * .5;
        // a diamond leaf cluster: 4 verts, 2 triangles, double sided via material
        vtx(cx - ax[0] * h, cy - ax[1] * h, cz - ax[2] * h, nn[0], nn[1], nn[2], cr, cg, cb);
        vtx(cx + ax[0] * h, cy + ax[1] * h, cz + ax[2] * h, nn[0], nn[1], nn[2], cr, cg, cb);
        vtx(cx + ay[0] * h * 1.1, cy + ay[1] * h * 1.1, cz + ay[2] * h * 1.1, nn[0], nn[1], nn[2], cr * 1.1, cg * 1.1, cb * 1.1);
        vtx(cx - ay[0] * h * 1.1, cy - ay[1] * h * 1.1, cz - ay[2] * h * 1.1, nn[0], nn[1], nn[2], cr * .85, cg * .85, cb * .85);
        I.push(o, o + 1, o + 2, o, o + 2, o + 1, o, o + 3, o + 1, o, o + 1, o + 3);
      }
    });
    var g = new BG();
    g.setAttribute('position', new Attr(new Float32Array(P), 3));
    g.setAttribute('normal', new Attr(new Float32Array(N), 3));
    g.setAttribute('color', new Attr(new Float32Array(C), 3));
    g.setIndex(I);
    var m = std.clone(); m.name = 'Hive shade planting';
    m.map = null; m.normalMap = null; m.roughnessMap = null; m.color.set('#ffffff'); m.emissive.set('#141e10');
    m.vertexColors = true; m.roughness = .85; m.metalness = 0; m.side = 2; m.transparent = false; m.opacity = 1; m.needsUpdate = true;
    var trees = new Mesh(g, m); trees.name = 'Hive shade planting'; trees.frustumCulled = false;
    ctx.scene.add(trees);
    // soft contact shadows
    var shadows = 0;
    if (Tex) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 64;
      var c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
      var tex = new Tex(cv); tex.needsUpdate = true;
      var sm = std.clone(); sm.map = tex; sm.normalMap = null; sm.roughnessMap = null; sm.color.set('#10200c');
      sm.transparent = true; sm.depthWrite = false; sm.roughness = 1; sm.metalness = 0; sm.side = 2; sm.polygonOffset = true; sm.polygonOffsetFactor = -2; sm.needsUpdate = true;
      TREES.forEach(function (T) {
        var rad = (T[3] ? 1.65 : 3.1) * 1.7;
        var sg = new BG();
        sg.setAttribute('position', new Attr(new Float32Array([-rad, 0, rad, rad, 0, rad, rad, 0, -rad, -rad, 0, -rad]), 3));
        sg.setAttribute('normal', new Attr(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
        sg.setAttribute('uv', new Attr(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
        sg.setIndex([0, 1, 2, 0, 2, 3]);
        var s = new Mesh(sg, sm); s.position.set(T[0] + 1, T[1] + .06, T[2] + .8); s.renderOrder = 1;
        ctx.scene.add(s); shadows++;
      });
    }
    redraw(ctx);
    window.hiveLightLook = Object.assign(window.hiveLightLook || {}, { trees: TREES.length, treeTriangles: I.length / 3, treeShadows: shadows });
  }

  function addPool(ctx, ref, std) {
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = bufferAttributeClass(ref.geometry);
    var corners = [[21.147, 139.571], [36.304, 137.998], [36.776, 142.545], [21.62, 144.12]];
    var cx = 0, cz = 0;
    corners.forEach(function (c) { cx += c[0] * .25; cz += c[1] * .25; });
    var dx = corners[1][0] - corners[0][0], dz = corners[1][1] - corners[0][1];
    var s = Math.sqrt(dx * dx + dz * dz), rx = dx / s, rz = dz / s, ax = -rz, az = rx;
    var width = 4.572, deck = 13.716, base = 10.82, waterY = 13.56;
    var yaw = Math.atan2(-rz, rx);
    var wallH = deck - .07 - base;
    var basinMat = std.clone(); basinMat.name = 'Pool basin'; basinMat.color.set('#c5dfe0'); basinMat.roughness = .78; basinMat.metalness = 0; basinMat.side = 2; basinMat.map = null; basinMat.normalMap = null; basinMat.roughnessMap = null; basinMat.needsUpdate = true;
    var waterMat = std.clone(); waterMat.name = 'Amenity pool water'; waterMat.color.set('#438f9d'); waterMat.roughness = .22; waterMat.metalness = .12; waterMat.envMapIntensity = .7; waterMat.side = 2; waterMat.map = null; waterMat.normalMap = null; waterMat.roughnessMap = null; waterMat.needsUpdate = true;
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
