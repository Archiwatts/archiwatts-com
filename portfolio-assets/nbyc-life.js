/* North Beach Youth Center: the Hive's sketch people walking the plaza and streets around the building, and cars driving the
   streets and parked along the kerbs. The ground, the streets and the buildings are all read from the model itself: ground
   surfaces are the up-facing faces at plaza level, anything standing on them (the building, its canopy, the neighbours) blocks,
   and a street is a free corridor between blocked areas, found by a distance transform. */
(function () {
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.SketchPeople; }
  var tries = 0;
  (function wait() { if (ready() && (window.nbycIfc || tries > 200)) { setTimeout(function () { try { run(); } catch (e) { console.warn('Youth center life skipped', e); } }, 2500); } else if (tries++ < 600) setTimeout(wait, 150); })();
  function srand(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function attrClass(g) {
    var found = null, nor = g.attributes.normal;
    [g.index && g.index.constructor, g.index && Object.getPrototypeOf(g.index.constructor), nor && nor.constructor].forEach(function (C) {
      if (found || typeof C !== 'function') return; try { var a = new Float32Array(4), p = new C(a, 2); if (p.array === a && p.itemSize === 2) found = C; } catch (e) {}
    });
    return found;
  }
  function eachTri(o, cb) {
    if (Array.isArray(o)) { o.forEach(function (x) { eachTri(x, cb); }); return; }   // a part may be several meshes (the Revit model comes in chunks)
    var g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count; o.updateWorldMatrix(true, false); var e = o.matrixWorld.elements;
    function w(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
    for (var t = 0; t < n; t += 3) cb(w(I ? I.getX(t) : t), w(I ? I.getX(t + 1) : t + 1), w(I ? I.getX(t + 2) : t + 2));
  }
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, mobile = !!(window.modelPerformance && window.modelPerformance.mobile), rnd = srand(9137);
    var ref = null, std = null, Tex = null, byPart = {};
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.visible || (o.userData && o.userData.skEdge) || /^Old_/.test(o.name || '')) return;
      var k = /__([A-Za-z]+)$/.exec(o.name || ''); if (k) (byPart[k[1]] = byPart[k[1]] || []).push(o);
      if (!o.geometry.index) return; if (!ref) ref = o;
      var m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.isMeshStandardMaterial && !m.transparent && (!std || (std.isMeshPhysicalMaterial && !m.isMeshPhysicalMaterial))) std = m; if (!Tex && m && m.map) Tex = m.map.constructor;
    });
    if (!ref || !std || !byPart.Stone || !byPart.Context) return;
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = attrClass(ref.geometry); if (!Attr) return;
    if (!Tex) { var tm = window.SketchPeople.atlas; Tex = null; }
    var anim = [];
    // the site's centre, and the plaza level (the commonest height of the stone's up-facing faces, by area)
    var SX = -52, SZ = 53, hist = {};
    eachTri(byPart.Stone, function (a, b, c) {
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      if (ny / l < .95 || Math.abs(a[0] - SX) > 80 || Math.abs(a[2] - SZ) > 80) return; var k = Math.round(a[1] * 4) / 4; hist[k] = (hist[k] || 0) + l / 2;
    });
    var gy = 0, best = 0; Object.keys(hist).forEach(function (k) { if (hist[k] > best) { best = hist[k]; gy = +k; } });

    /* ---- rasters over the neighbourhood: ground at plaza level, and anything standing above it ---- */
    var C = 1.5, X0 = SX - 170, Z0 = SZ - 170, NX = Math.ceil(340 / C), NZ = Math.ceil(340 / C), GH = new Float32Array(NX * NZ).fill(-1e9), HI = new Float32Array(NX * NZ).fill(-1e9), TG = new Float32Array(NX * NZ).fill(-1e9);
    function rast(o, ground) {
      eachTri(o, function (a, b, c) {
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
        if (ny / l < .85) return; var ym = Math.min(a[1], b[1], c[1]);
        if (ground && ym < gy + 8 && ym > gy - 12) {   // terrain at any height (dunes), for planting trees on
          var cx3 = Math.floor(((a[0] + b[0] + c[0]) / 3 - X0) / C), cz3 = Math.floor(((a[2] + b[2] + c[2]) / 3 - Z0) / C);
          if (cx3 >= 0 && cz3 >= 0 && cx3 < NX && cz3 < NZ) { var k3 = cz3 * NX + cx3, y3 = (a[1] + b[1] + c[1]) / 3; if (y3 > TG[k3]) TG[k3] = y3; }
        }
        var isHi = ym > gy + 1.2, isGnd = !isHi && ym > gy - 1.2; if (!isHi && !isGnd) return; if (isGnd && !ground) return;
        var x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), z0 = Math.min(a[2], b[2], c[2]), z1 = Math.max(a[2], b[2], c[2]);
        if (x1 < X0 || z1 < Z0 || x0 > X0 + NX * C || z0 > Z0 + NZ * C) return;
        var d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-9) return;
        var ix0 = Math.max(0, Math.floor((x0 - X0) / C)), ix1 = Math.min(NX - 1, Math.floor((x1 - X0) / C)), iz0 = Math.max(0, Math.floor((z0 - Z0) / C)), iz1 = Math.min(NZ - 1, Math.floor((z1 - Z0) / C));
        for (var ix = ix0; ix <= ix1; ix++) for (var iz = iz0; iz <= iz1; iz++) {
          var x = X0 + (ix + .5) * C, z = Z0 + (iz + .5) * C, l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2;
          if (l1 < -.05 || l2 < -.05 || l3 < -.05) continue; var y = l1 * a[1] + l2 * b[1] + l3 * c[1], k = iz * NX + ix; if (isHi) { if (y > HI[k]) HI[k] = y; } else if (y > GH[k]) GH[k] = y;
        }
      });
    }
    ['Stone', 'Skate', 'Landscape', 'Context'].forEach(function (k) { if (byPart[k]) rast(byPart[k], true); });
    ['Plaster', 'Metal', 'Timber', 'Glazing', 'ScreenPanel', 'Other', 'Planting', 'Context', 'Stone'].forEach(function (k) { if (byPart[k]) rast(byPart[k], false); });
    var free = new Uint8Array(NX * NZ); for (var k = 0; k < free.length; k++) free[k] = GH[k] > -1e8 && HI[k] < -1e8 ? 1 : 0;

    /* ---- the roads, as drawn on the site plan (cars drive these; people keep off them) ---- */
    // centre lines from the Revit site: the sidewalk slab's kerbs run x -93.8 to 8.8, z 18.5 to 77.6, crosswalk domes at z 81.6 / 85.5
    var RD = { XW: -100, XE: 14.5, ZN: 12.5, ZS: 83.6, ZR: -23, XA: -140, XB: 80 };
    var ROADSEG = [[RD.XA, RD.ZR, RD.XB, RD.ZR], [RD.XW, RD.ZR, RD.XW, RD.ZS], [RD.XE, RD.ZR, RD.XE, RD.ZS], [RD.XW, RD.ZN, RD.XE, RD.ZN], [RD.XA, RD.ZS, RD.XB, RD.ZS]];
    function nearRoad(x, z, r) {
      for (var s = 0; s < ROADSEG.length; s++) { var g = ROADSEG[s], ax = g[2] - g[0], az = g[3] - g[1], l2 = ax * ax + az * az, t = Math.max(0, Math.min(1, ((x - g[0]) * ax + (z - g[1]) * az) / l2)); if (Math.hypot(x - g[0] - ax * t, z - g[1] - az * t) < r) return true; }
      return false;
    }

    /* ---- people: walkers on free ground near the site, off the roads ---- */
    var walk = [], walkH = new Map(), key = function (ix, iz) { return ix + ',' + iz; }, walkPos = [];
    for (var iz = 0; iz < NZ; iz++) for (var ix = 0; ix < NX; ix++) { var kk = iz * NX + ix; if (!free[kk]) continue; var x = X0 + (ix + .5) * C, z = Z0 + (iz + .5) * C; if (Math.hypot(x - SX, z - SZ) > 60 || nearRoad(x, z, 5.5)) continue; walk.push(key(ix, iz)); walkH.set(key(ix, iz), GH[kk]); }
    var wset = new Set(walk), SP = window.SketchPeople, atlasTex = new Tex(SP.atlas()); atlasTex.colorSpace = 'srgb'; atlasTex.needsUpdate = true;
    var nW = Math.min(walk.length ? (mobile ? 16 : 48) : 0, walk.length);
    var P = new Float32Array(Math.max(1, nW) * 12), UV = new Float32Array(Math.max(1, nW) * 8), NN = new Float32Array(Math.max(1, nW) * 12), I = [];
    for (var q = 0; q < nW; q++) { for (var v = 0; v < 4; v++) NN[q * 12 + v * 3 + 1] = 1; I.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); }
    var sg = new BG(), pa = new Attr(P, 3), ua = new Attr(UV, 2); sg.setAttribute('position', pa); sg.setAttribute('normal', new Attr(NN, 3)); sg.setAttribute('uv', ua); sg.setIndex(I);
    var sm = std.clone(); sm.name = 'NBYC life sprites'; sm.map = atlasTex; sm.emissiveMap = atlasTex; sm.color.set('#000000'); sm.emissive.set('#ffffff'); sm.normalMap = null; sm.roughnessMap = null; sm.aoMap = null; sm.metalness = 0; sm.roughness = 1; sm.side = 2; sm.alphaTest = .45; sm.transparent = false; sm.opacity = 1; sm.toneMapped = false; sm.needsUpdate = true;
    var sprites = new Mesh(sg, sm); sprites.name = 'NBYC life sprites'; sprites.frustumCulled = false; sprites.renderOrder = 5; if (nW) scene.add(sprites);
    /* ---- trees: a dense belt of 2D trees on the dunes between the south road and the beach, as in the site render. Each tree is a
       picture standing upright and turning to face the camera, drawn once into a small atlas of four tree shapes. ---- */
    (function trees() {
      var cv = document.createElement('canvas'); cv.width = 6144; cv.height = 768; var g2 = cv.getContext('2d'), tr = srand(4411); g2.setTransform(3, 0, 0, 3, 0, 0);   // drawn in 256-unit cells at twice the resolution, so the sprites stay sharp up close
      /* slots 4-5: watercolour palms (style D, with heavier lines): soft overlapping green washes on a pale brown trunk, each frond
         outlined and ribbed in a darker green. Painted on white paper and the paper keyed out, so the overlapping washes keep
         their depth even though the sprites use a hard alpha cut. Slot 6: planter bush (styles A + B): an ink-outlined scalloped
         mound filled with green leaf clusters and a few pink flowers, with light scribble marks. */
      function paper() { var c = document.createElement('canvas'); c.width = 768; c.height = 768; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 768, 768); x.scale(3, 3); x.lineCap = 'round'; x.lineJoin = 'round'; return [c, x]; }
      function keyWhite(c) { var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); var d = x.getImageData(0, 0, c.width, c.height), p = d.data; for (var i = 0; i < p.length; i += 4) { var w = Math.min(p[i], p[i + 1], p[i + 2]); p[i + 3] = w > 247 ? 0 : 255; } x.putImageData(d, 0, 0); return c; }
      function palmD(cx, top, lean, n, len, droop) {
        var pc = paper(), c = pc[0], x = pc[1], tx = cx + lean, base = 256;
        x.fillStyle = 'rgba(160,130,108,.55)'; x.beginPath(); x.moveTo(cx - 6, base); x.quadraticCurveTo(cx - 5 + lean * .3, (base + top) / 2, tx - 3.5, top); x.lineTo(tx + 3.5, top); x.quadraticCurveTo(cx + 5 + lean * .3, (base + top) / 2, cx + 6, base); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(80,56,40,.9)'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(cx - 6, base); x.quadraticCurveTo(cx - 5 + lean * .3, (base + top) / 2, tx - 3.5, top); x.moveTo(cx + 6, base); x.quadraticCurveTo(cx + 5 + lean * .3, (base + top) / 2, tx + 3.5, top); x.stroke();
        var fr = [];
        for (var i = 0; i < n; i++) { var a = Math.PI * (.04 + .92 * i / (n - 1)) + (tr() - .5) * .15, L = len * (.85 + tr() * .3), dr = droop * (.7 + tr() * .6); var ex = tx + Math.cos(a) * L, ey = top - Math.sin(a) * L + dr * L, kx = tx + Math.cos(a) * L * .55, ky = top - Math.sin(a) * L * .55 - L * .25; fr.push([kx, ky, ex, ey, L]); }
        function bez(f, t) { var u = 1 - t; return [u * u * tx + 2 * u * t * f[0] + t * t * f[2], u * u * top + 2 * u * t * f[1] + t * t * f[3]]; }
        fr.forEach(function (f) {   // two washes per frond, slightly offset, for the watercolour overlap
          for (var w = 0; w < 2; w++) {
            x.fillStyle = w ? 'rgba(88,124,90,.38)' : 'rgba(128,156,118,.42)';   /* softer, less saturated greens */ x.beginPath(); x.moveTo(tx, top);
            for (var k = 0; k <= 16; k++) { var b = bez(f, k / 16); x.lineTo(b[0] + w * 1.5, b[1] - f[4] * .045 * Math.sin(Math.PI * k / 16)); }
            for (var k2 = 16; k2 >= 0; k2--) { var b2 = bez(f, k2 / 16); x.lineTo(b2[0] - w * 1.5, b2[1] + f[4] * (.08 + w * .02) * Math.sin(Math.PI * k2 / 16)); }
            x.closePath(); x.fill();
          }
        });
        fr.forEach(function (f) {   // heavier linework: the frond edge and its rib
          x.strokeStyle = 'rgba(48,66,50,.95)'; x.lineWidth = 3; x.beginPath(); x.moveTo(tx, top); x.quadraticCurveTo(f[0], f[1], f[2], f[3]); x.stroke();
          x.lineWidth = 2; x.strokeStyle = 'rgba(48,66,50,.8)'; x.beginPath(); for (var k = 0; k <= 16; k++) { var b = bez(f, k / 16), yy = b[1] + f[4] * .08 * Math.sin(Math.PI * k / 16); if (k) x.lineTo(b[0], yy); else x.moveTo(b[0], yy); } x.stroke();
        });
        return keyWhite(c);
      }
      // a thick black outline around the whole palm silhouette: the shape stamped in black around itself, the palm drawn on top
      function inkOutline(c, r) { var o = document.createElement('canvas'); o.width = c.width; o.height = c.height; var x = o.getContext('2d'); for (var a = 0; a < 16; a++) x.drawImage(c, Math.cos(a / 16 * Math.PI * 2) * r, Math.sin(a / 16 * Math.PI * 2) * r); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#16171a'; x.fillRect(0, 0, o.width, o.height); x.globalCompositeOperation = 'source-over'; x.drawImage(c, 0, 0); return o; }
      g2.drawImage(inkOutline(palmD(124, 58, 12, 12, 82, .42), 9), 4 * 256, 0, 256, 256);
      g2.drawImage(inkOutline(palmD(128, 104, -4, 15, 96, .28), 9), 5 * 256, 0, 256, 256);
      (function () {
        var pc = paper(), c = pc[0], x = pc[1], cx = 128, base = 250, pts = [];
        for (var a = 0; a <= 12; a++) { var an = Math.PI + a / 12 * Math.PI, r = 108 * (1 + .1 * Math.sin(a * 2.7) + (tr() - .5) * .08); pts.push([cx + Math.cos(an) * r, base + Math.sin(an) * r * .62]); }
        function shape() { x.beginPath(); x.moveTo(pts[0][0], base); for (var i = 0; i < pts.length - 1; i++) { var p = pts[i], q = pts[i + 1]; x.quadraticCurveTo((p[0] + q[0]) / 2, Math.min(p[1], q[1]) - 12, q[0], q[1]); } x.closePath(); }
        shape(); x.fillStyle = '#3f8a4c'; x.fill();
        x.save(); shape(); x.clip();
        for (var i = 0; i < 70; i++) { x.fillStyle = ['#2f7a3e', '#4f9a5c', '#6fb37c', '#86c290'][Math.floor(tr() * 4)]; x.beginPath(); x.arc(cx + (tr() - .5) * 200, base - tr() * 70, 9 + tr() * 9, 0, Math.PI * 2); x.fill(); }
        x.strokeStyle = 'rgba(30,40,32,.45)'; x.lineWidth = 1.4; for (var j = 0; j < 12; j++) { var sx = cx + (tr() - .5) * 170, sy = base - 10 - tr() * 55; x.beginPath(); x.arc(sx, sy, 10, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
        for (var fl = 0; fl < 14; fl++) { x.fillStyle = '#d0679a'; x.beginPath(); x.arc(cx + (tr() - .5) * 170, base - 8 - tr() * 60, 4.5, 0, Math.PI * 2); x.fill(); }
        x.restore();
        shape(); x.strokeStyle = '#2b2d30'; x.lineWidth = 3; x.stroke();
        g2.drawImage(keyWhite(c), 6 * 256, 0, 256, 256);
      })();
      for (var v = 0; v < 4; v++) {
        var ox = v * 256, cxm = ox + 128;
        g2.fillStyle = '#5b4632'; g2.fillRect(cxm - 7, 150, 14, 106);                                 // trunk
        for (var b = 0; b < 46; b++) {                                                             // canopy: overlapping leaf clusters
          var ang = tr() * Math.PI * 2, rr = Math.sqrt(tr()) * (v === 3 ? 70 : 92), bx = cxm + Math.cos(ang) * rr, by = (v === 3 ? 90 : 100) + Math.sin(ang) * rr * .82, br = 20 + tr() * 26;
          var shade = 0.55 + 0.45 * (1 - (by - 20) / 180) * (0.6 + 0.4 * tr());
          g2.fillStyle = 'rgb(' + Math.round(48 * shade + 14) + ',' + Math.round(92 * shade + 22) + ',' + Math.round(44 * shade + 12) + ')';
          g2.beginPath(); g2.arc(bx, by, br, 0, Math.PI * 2); g2.fill();
        }
      }
      var ttex = new Tex(cv); ttex.colorSpace = 'srgb'; ttex.needsUpdate = true;
      var spots = [];
      for (var x = -150; x < 62; x += 6.5) for (var z = 93; z < 130; z += 6.5) {
        var tx = x + (tr() - .5) * 5, tz = z + (tr() - .5) * 5; if (nearRoad(tx, tz, 8) || tr() < .18) continue;
        var ix = Math.floor((tx - X0) / C), iz = Math.floor((tz - Z0) / C), k = iz * NX + ix; if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) continue;
        if (HI[k] > -1e8 && HI[k] > (TG[k] > -1e8 ? TG[k] : gy) + 1.5) continue;                     // not on a building
        spots.push([tx, TG[k] > -1e8 ? TG[k] : gy, tz, 6 + tr() * 5, Math.floor(tr() * 4)]);
      }
      /* palm planters around the building, as in the daytime render: a palm with a flowering bed at its foot every ~10 m, in a ring
         a few metres out from the facade, kept off the streets and off anything built */
      var BX0 = -90, BX1 = 1, BZ0 = 21, BZ1 = 66;
      // palms are planted only on lawn: points at least 0.7 m inside the plan's lawn areas (from lawn-mask.png, 1 m apart)
      var LAWNPTS = [[-90.5, 20.5], [-89.5, 20.5], [-88.5, 20.5], [-87.5, 20.5], [-86.5, 20.5], [-85.5, 20.5], [-84.5, 20.5], [-83.5, 20.5], [-82.5, 20.5], [-81.5, 20.5], [-80.5, 20.5], [-79.5, 20.5], [-78.5, 20.5], [-77.5, 20.5], [-76.5, 20.5], [-75.5, 20.5], [-74.5, 20.5], [-73.5, 20.5], [-72.5, 20.5], [-71.5, 20.5], [-70.5, 20.5], [-69.5, 20.5], [-68.5, 20.5], [-67.5, 20.5], [-66.5, 20.5], [-65.5, 20.5], [-64.5, 20.5], [-63.5, 20.5], [-62.5, 20.5], [-61.5, 20.5], [-60.5, 20.5], [-59.5, 20.5], [-58.5, 20.5], [-57.5, 20.5], [-56.5, 20.5], [-55.5, 20.5], [-54.5, 20.5], [-53.5, 20.5], [-52.5, 20.5], [-51.5, 20.5], [-50.5, 20.5], [-49.5, 20.5], [-48.5, 20.5], [-47.5, 20.5], [-46.5, 20.5], [-45.5, 20.5], [-44.5, 20.5], [-43.5, 20.5], [-42.5, 20.5], [-15.5, 20.5], [-14.5, 20.5], [-13.5, 20.5], [-12.5, 20.5], [-11.5, 20.5], [-10.5, 20.5], [-8.5, 20.5], [-7.5, 20.5], [-1.5, 20.5], [-0.5, 20.5], [0.5, 20.5], [-90.5, 21.5], [-89.5, 21.5], [-48.5, 21.5], [-47.5, 21.5], [-46.5, 21.5], [-45.5, 21.5], [-44.5, 21.5], [-43.5, 21.5], [-14.5, 21.5], [-13.5, 21.5], [-12.5, 21.5], [-11.5, 21.5], [-10.5, 21.5], [-7.5, 21.5], [-90.5, 22.5], [-47.5, 22.5], [-46.5, 22.5], [-45.5, 22.5], [-44.5, 22.5], [-13.5, 22.5], [-12.5, 22.5], [-11.5, 22.5], [-10.5, 22.5], [-90.5, 23.5], [-47.5, 23.5], [-46.5, 23.5], [-45.5, 23.5], [-12.5, 23.5], [-90.5, 24.5], [-47.5, 24.5], [-46.5, 24.5], [-45.5, 24.5], [-90.5, 25.5], [-47.5, 25.5], [-46.5, 25.5], [-11.5, 25.5], [-10.5, 25.5], [-9.5, 25.5], [-8.5, 25.5], [-7.5, 25.5], [-6.5, 25.5], [-90.5, 26.5], [-47.5, 26.5], [-46.5, 26.5], [-11.5, 26.5], [-10.5, 26.5], [-9.5, 26.5], [-8.5, 26.5], [-7.5, 26.5], [-47.5, 27.5], [-46.5, 27.5], [-11.5, 27.5], [-10.5, 27.5], [-9.5, 27.5], [-8.5, 27.5], [-7.5, 27.5], [0.5, 27.5], [1.5, 27.5], [2.5, 27.5], [-47.5, 28.5], [-46.5, 28.5], [-11.5, 28.5], [-10.5, 28.5], [-9.5, 28.5], [-8.5, 28.5], [-7.5, 28.5], [-0.5, 28.5], [0.5, 28.5], [1.5, 28.5], [2.5, 28.5], [-47.5, 29.5], [-46.5, 29.5], [-45.5, 29.5], [-11.5, 29.5], [-10.5, 29.5], [-9.5, 29.5], [-8.5, 29.5], [-7.5, 29.5], [-0.5, 29.5], [0.5, 29.5], [1.5, 29.5], [2.5, 29.5], [-47.5, 30.5], [-46.5, 30.5], [-45.5, 30.5], [-11.5, 30.5], [-10.5, 30.5], [-9.5, 30.5], [-8.5, 30.5], [-0.5, 30.5], [0.5, 30.5], [1.5, 30.5], [2.5, 30.5], [-47.5, 31.5], [-46.5, 31.5], [-45.5, 31.5], [-44.5, 31.5], [0.5, 31.5], [1.5, 31.5], [2.5, 31.5], [-47.5, 32.5], [-46.5, 32.5], [-45.5, 32.5], [-44.5, 32.5], [-43.5, 32.5], [-47.5, 33.5], [-46.5, 33.5], [-45.5, 33.5], [-44.5, 33.5], [-43.5, 33.5], [-42.5, 33.5], [-48.5, 34.5], [-47.5, 34.5], [-46.5, 34.5], [-45.5, 34.5], [-44.5, 34.5], [-43.5, 34.5], [-42.5, 34.5], [-81.5, 35.5], [-80.5, 35.5], [-79.5, 35.5], [-78.5, 35.5], [-77.5, 35.5], [-73.5, 35.5], [-72.5, 35.5], [-71.5, 35.5], [-70.5, 35.5], [-69.5, 35.5], [-68.5, 35.5], [-67.5, 35.5], [-66.5, 35.5], [-65.5, 35.5], [-60.5, 35.5], [-59.5, 35.5], [-58.5, 35.5], [-57.5, 35.5], [-56.5, 35.5], [-55.5, 35.5], [-54.5, 35.5], [-53.5, 35.5], [-52.5, 35.5], [-51.5, 35.5], [-50.5, 35.5], [-49.5, 35.5], [-48.5, 35.5], [-47.5, 35.5], [-46.5, 35.5], [-45.5, 35.5], [-44.5, 35.5], [-43.5, 35.5], [-42.5, 35.5], [-80.5, 36.5], [-79.5, 36.5], [-78.5, 36.5], [-77.5, 36.5], [-73.5, 36.5], [-72.5, 36.5], [-71.5, 36.5], [-70.5, 36.5], [-69.5, 36.5], [-68.5, 36.5], [-67.5, 36.5], [-66.5, 36.5], [-65.5, 36.5], [-60.5, 36.5], [-59.5, 36.5], [-58.5, 36.5], [-57.5, 36.5], [-56.5, 36.5], [-55.5, 36.5], [-54.5, 36.5], [-53.5, 36.5], [-52.5, 36.5], [-51.5, 36.5], [-50.5, 36.5], [-49.5, 36.5], [-48.5, 36.5], [-47.5, 36.5], [-46.5, 36.5], [-45.5, 36.5], [-44.5, 36.5], [-43.5, 36.5], [-42.5, 36.5], [-79.5, 37.5], [-78.5, 37.5], [-77.5, 37.5], [-73.5, 37.5], [-72.5, 37.5], [-71.5, 37.5], [-70.5, 37.5], [-69.5, 37.5], [-68.5, 37.5], [-67.5, 37.5], [-66.5, 37.5], [-65.5, 37.5], [-60.5, 37.5], [-59.5, 37.5], [-58.5, 37.5], [-57.5, 37.5], [-56.5, 37.5], [-55.5, 37.5], [-54.5, 37.5], [-53.5, 37.5], [-52.5, 37.5], [-51.5, 37.5], [-50.5, 37.5], [-49.5, 37.5], [-48.5, 37.5], [-47.5, 37.5], [-46.5, 37.5], [-45.5, 37.5], [-44.5, 37.5], [-43.5, 37.5], [-42.5, 37.5], [-90.5, 38.5], [-78.5, 38.5], [-77.5, 38.5], [-73.5, 38.5], [-72.5, 38.5], [-71.5, 38.5], [-70.5, 38.5], [-69.5, 38.5], [-68.5, 38.5], [-67.5, 38.5], [-66.5, 38.5], [-65.5, 38.5], [-59.5, 38.5], [-58.5, 38.5], [-57.5, 38.5], [-56.5, 38.5], [-55.5, 38.5], [-54.5, 38.5], [-53.5, 38.5], [-52.5, 38.5], [-51.5, 38.5], [-50.5, 38.5], [-49.5, 38.5], [-48.5, 38.5], [-47.5, 38.5], [-46.5, 38.5], [-45.5, 38.5], [-44.5, 38.5], [-43.5, 38.5], [-42.5, 38.5], [-90.5, 39.5], [-89.5, 39.5], [-43.5, 39.5], [-42.5, 39.5], [-90.5, 40.5], [-89.5, 40.5], [-88.5, 40.5], [-43.5, 40.5], [-42.5, 40.5], [-10.5, 40.5], [-9.5, 40.5], [-8.5, 40.5], [-7.5, 40.5], [-6.5, 40.5], [-5.5, 40.5], [-4.5, 40.5], [-3.5, 40.5], [-2.5, 40.5], [-1.5, 40.5], [-0.5, 40.5], [-90.5, 41.5], [-89.5, 41.5], [-88.5, 41.5], [-87.5, 41.5], [-43.5, 41.5], [-42.5, 41.5], [-10.5, 41.5], [-9.5, 41.5], [-8.5, 41.5], [-7.5, 41.5], [-6.5, 41.5], [-5.5, 41.5], [-4.5, 41.5], [-3.5, 41.5], [-2.5, 41.5], [-1.5, 41.5], [-0.5, 41.5], [-90.5, 42.5], [-89.5, 42.5], [-88.5, 42.5], [-87.5, 42.5], [-86.5, 42.5], [-43.5, 42.5], [-42.5, 42.5], [-7.5, 42.5], [-6.5, 42.5], [-5.5, 42.5], [-4.5, 42.5], [-3.5, 42.5], [-2.5, 42.5], [-1.5, 42.5], [-0.5, 42.5], [0.5, 42.5], [-90.5, 43.5], [-89.5, 43.5], [-88.5, 43.5], [-87.5, 43.5], [-86.5, 43.5], [-43.5, 43.5], [-42.5, 43.5], [-5.5, 43.5], [-4.5, 43.5], [-3.5, 43.5], [-2.5, 43.5], [-1.5, 43.5], [-0.5, 43.5], [0.5, 43.5], [-90.5, 44.5], [-89.5, 44.5], [-88.5, 44.5], [-87.5, 44.5], [-49.5, 44.5], [-48.5, 44.5], [-47.5, 44.5], [-46.5, 44.5], [-45.5, 44.5], [-44.5, 44.5], [-43.5, 44.5], [-42.5, 44.5], [-4.5, 44.5], [-3.5, 44.5], [-1.5, 44.5], [-0.5, 44.5], [0.5, 44.5], [-90.5, 45.5], [-89.5, 45.5], [-88.5, 45.5], [-49.5, 45.5], [-48.5, 45.5], [-47.5, 45.5], [-46.5, 45.5], [-45.5, 45.5], [-44.5, 45.5], [-43.5, 45.5], [-42.5, 45.5], [-0.5, 45.5], [0.5, 45.5], [-90.5, 46.5], [-89.5, 46.5], [-88.5, 46.5], [-49.5, 46.5], [-48.5, 46.5], [-47.5, 46.5], [-46.5, 46.5], [-45.5, 46.5], [-44.5, 46.5], [-43.5, 46.5], [-42.5, 46.5], [-0.5, 46.5], [0.5, 46.5], [-90.5, 47.5], [-89.5, 47.5], [-49.5, 47.5], [-48.5, 47.5], [-47.5, 47.5], [-46.5, 47.5], [-45.5, 47.5], [-44.5, 47.5], [-43.5, 47.5], [-42.5, 47.5], [0.5, 47.5], [-90.5, 48.5], [-89.5, 48.5], [0.5, 48.5], [-90.5, 49.5], [-0.5, 49.5], [0.5, 49.5], [-90.5, 50.5], [-0.5, 50.5], [0.5, 50.5], [-90.5, 51.5], [0.5, 51.5], [-90.5, 52.5], [-90.5, 53.5], [0.5, 53.5], [-90.5, 54.5], [0.5, 54.5], [-90.5, 55.5], [-90.5, 56.5], [-0.5, 56.5], [0.5, 56.5], [-90.5, 57.5], [0.5, 57.5], [-90.5, 58.5], [-89.5, 58.5], [0.5, 58.5], [-90.5, 59.5], [-89.5, 59.5], [-50.5, 59.5], [-49.5, 59.5], [-48.5, 59.5], [-47.5, 59.5], [-46.5, 59.5], [-45.5, 59.5], [-44.5, 59.5], [-43.5, 59.5], [-42.5, 59.5], [-41.5, 59.5], [-40.5, 59.5], [0.5, 59.5], [-90.5, 60.5], [-89.5, 60.5], [-88.5, 60.5], [-50.5, 60.5], [-49.5, 60.5], [-48.5, 60.5], [-47.5, 60.5], [-46.5, 60.5], [-45.5, 60.5], [-44.5, 60.5], [-43.5, 60.5], [-42.5, 60.5], [-41.5, 60.5], [-40.5, 60.5], [-36.5, 60.5], [-35.5, 60.5], [-34.5, 60.5], [-33.5, 60.5], [-32.5, 60.5], [-31.5, 60.5], [-30.5, 60.5], [-29.5, 60.5], [-28.5, 60.5], [-27.5, 60.5], [-26.5, 60.5], [-25.5, 60.5], [-0.5, 60.5], [0.5, 60.5], [-90.5, 61.5], [-89.5, 61.5], [-88.5, 61.5], [-87.5, 61.5], [-51.5, 61.5], [-50.5, 61.5], [-49.5, 61.5], [-48.5, 61.5], [-47.5, 61.5], [-46.5, 61.5], [-45.5, 61.5], [-44.5, 61.5], [-43.5, 61.5], [-42.5, 61.5], [-41.5, 61.5], [-40.5, 61.5], [-37.5, 61.5], [-36.5, 61.5], [-35.5, 61.5], [-34.5, 61.5], [-33.5, 61.5], [-32.5, 61.5], [-31.5, 61.5], [-30.5, 61.5], [-29.5, 61.5], [-28.5, 61.5], [-27.5, 61.5], [-26.5, 61.5], [-25.5, 61.5], [-1.5, 61.5], [-0.5, 61.5], [0.5, 61.5], [-90.5, 62.5], [-89.5, 62.5], [-88.5, 62.5], [-87.5, 62.5], [-86.5, 62.5], [-51.5, 62.5], [-50.5, 62.5], [-49.5, 62.5], [-48.5, 62.5], [-47.5, 62.5], [-46.5, 62.5], [-45.5, 62.5], [-44.5, 62.5], [-43.5, 62.5], [-42.5, 62.5], [-41.5, 62.5], [-40.5, 62.5], [-37.5, 62.5], [-36.5, 62.5], [-35.5, 62.5], [-34.5, 62.5], [-33.5, 62.5], [-32.5, 62.5], [-31.5, 62.5], [-30.5, 62.5], [-29.5, 62.5], [-28.5, 62.5], [-27.5, 62.5], [-26.5, 62.5], [-25.5, 62.5], [-4.5, 62.5], [-3.5, 62.5], [-2.5, 62.5], [-1.5, 62.5], [-0.5, 62.5], [0.5, 62.5], [-90.5, 63.5], [-89.5, 63.5], [-88.5, 63.5], [-87.5, 63.5], [-86.5, 63.5], [-85.5, 63.5], [-45.5, 63.5], [-44.5, 63.5], [-43.5, 63.5], [-42.5, 63.5], [-41.5, 63.5], [-40.5, 63.5], [-37.5, 63.5], [-36.5, 63.5], [-30.5, 63.5], [-29.5, 63.5], [-28.5, 63.5], [-6.5, 63.5], [-5.5, 63.5], [-4.5, 63.5], [-3.5, 63.5], [-2.5, 63.5], [-1.5, 63.5], [-0.5, 63.5], [0.5, 63.5], [-90.5, 64.5], [-89.5, 64.5], [-88.5, 64.5], [-87.5, 64.5], [-86.5, 64.5], [-54.5, 64.5], [-44.5, 64.5], [-43.5, 64.5], [-42.5, 64.5], [-41.5, 64.5], [-40.5, 64.5], [-37.5, 64.5], [-29.5, 64.5], [-9.5, 64.5], [-8.5, 64.5], [-7.5, 64.5], [-6.5, 64.5], [-5.5, 64.5], [-4.5, 64.5], [-3.5, 64.5], [-2.5, 64.5], [-1.5, 64.5], [-0.5, 64.5], [0.5, 64.5], [-90.5, 65.5], [-89.5, 65.5], [-88.5, 65.5], [-87.5, 65.5], [-58.5, 65.5], [-57.5, 65.5], [-56.5, 65.5], [-55.5, 65.5], [-54.5, 65.5], [-44.5, 65.5], [-43.5, 65.5], [-42.5, 65.5], [-41.5, 65.5], [-40.5, 65.5], [-19.5, 65.5], [-18.5, 65.5], [-17.5, 65.5], [-16.5, 65.5], [-15.5, 65.5], [-10.5, 65.5], [-9.5, 65.5], [-8.5, 65.5], [-7.5, 65.5], [-6.5, 65.5], [-5.5, 65.5], [-4.5, 65.5], [-3.5, 65.5], [-2.5, 65.5], [-1.5, 65.5], [-0.5, 65.5], [0.5, 65.5], [-90.5, 66.5], [-89.5, 66.5], [-88.5, 66.5], [-58.5, 66.5], [-57.5, 66.5], [-56.5, 66.5], [-55.5, 66.5], [-54.5, 66.5], [-44.5, 66.5], [-43.5, 66.5], [-42.5, 66.5], [-41.5, 66.5], [-40.5, 66.5], [-19.5, 66.5], [-18.5, 66.5], [-17.5, 66.5], [-16.5, 66.5], [-15.5, 66.5], [-14.5, 66.5], [-13.5, 66.5], [-12.5, 66.5], [-11.5, 66.5], [-10.5, 66.5], [-9.5, 66.5], [-8.5, 66.5], [-7.5, 66.5], [-6.5, 66.5], [-5.5, 66.5], [-4.5, 66.5], [-3.5, 66.5], [-2.5, 66.5], [-1.5, 66.5], [-0.5, 66.5], [0.5, 66.5], [-58.5, 67.5], [-57.5, 67.5], [-56.5, 67.5], [-55.5, 67.5], [-54.5, 67.5], [-53.5, 67.5], [-52.5, 67.5], [-51.5, 67.5], [-50.5, 67.5], [-49.5, 67.5], [-48.5, 67.5], [-47.5, 67.5], [-46.5, 67.5], [-45.5, 67.5], [-44.5, 67.5], [-43.5, 67.5], [-42.5, 67.5], [-41.5, 67.5], [-40.5, 67.5], [-19.5, 67.5], [-18.5, 67.5], [-17.5, 67.5], [-16.5, 67.5], [-15.5, 67.5], [-14.5, 67.5], [-13.5, 67.5], [-12.5, 67.5], [-11.5, 67.5], [-10.5, 67.5], [-9.5, 67.5], [-8.5, 67.5], [-7.5, 67.5], [-6.5, 67.5], [-5.5, 67.5], [-4.5, 67.5], [-3.5, 67.5], [-2.5, 67.5], [-1.5, 67.5], [-0.5, 67.5], [0.5, 67.5], [-90.5, 71.5], [-76.5, 71.5], [-75.5, 71.5], [-74.5, 71.5], [-73.5, 71.5], [-72.5, 71.5], [-71.5, 71.5], [-70.5, 71.5], [-69.5, 71.5], [-68.5, 71.5], [-67.5, 71.5], [-66.5, 71.5], [-65.5, 71.5], [-64.5, 71.5], [-63.5, 71.5], [-58.5, 71.5], [-57.5, 71.5], [-56.5, 71.5], [-55.5, 71.5], [-54.5, 71.5], [-53.5, 71.5], [-52.5, 71.5], [-51.5, 71.5], [-50.5, 71.5], [-49.5, 71.5], [-48.5, 71.5], [-47.5, 71.5], [-46.5, 71.5], [-45.5, 71.5], [-44.5, 71.5], [-43.5, 71.5], [-42.5, 71.5], [-41.5, 71.5], [-40.5, 71.5], [-37.5, 71.5], [-36.5, 71.5], [-35.5, 71.5], [-34.5, 71.5], [-33.5, 71.5], [-32.5, 71.5], [-31.5, 71.5], [-30.5, 71.5], [-29.5, 71.5], [-28.5, 71.5], [-27.5, 71.5], [-26.5, 71.5], [-25.5, 71.5], [-24.5, 71.5], [-23.5, 71.5], [-19.5, 71.5], [-18.5, 71.5], [-17.5, 71.5], [-16.5, 71.5], [-15.5, 71.5], [-14.5, 71.5], [-13.5, 71.5], [-12.5, 71.5], [-11.5, 71.5], [-10.5, 71.5], [-9.5, 71.5], [-8.5, 71.5], [-7.5, 71.5], [-6.5, 71.5], [-5.5, 71.5], [-4.5, 71.5], [-3.5, 71.5], [-2.5, 71.5], [-1.5, 71.5], [-0.5, 71.5], [0.5, 71.5], [-91.5, 72.5], [-90.5, 72.5], [-89.5, 72.5], [-77.5, 72.5], [-76.5, 72.5], [-75.5, 72.5], [-74.5, 72.5], [-73.5, 72.5], [-72.5, 72.5], [-71.5, 72.5], [-70.5, 72.5], [-69.5, 72.5], [-68.5, 72.5], [-67.5, 72.5], [-66.5, 72.5], [-65.5, 72.5], [-64.5, 72.5], [-63.5, 72.5], [-58.5, 72.5], [-57.5, 72.5], [-56.5, 72.5], [-55.5, 72.5], [-54.5, 72.5], [-53.5, 72.5], [-52.5, 72.5], [-51.5, 72.5], [-50.5, 72.5], [-49.5, 72.5], [-48.5, 72.5], [-47.5, 72.5], [-46.5, 72.5], [-45.5, 72.5], [-44.5, 72.5], [-43.5, 72.5], [-42.5, 72.5], [-41.5, 72.5], [-40.5, 72.5], [-37.5, 72.5], [-36.5, 72.5], [-35.5, 72.5], [-34.5, 72.5], [-33.5, 72.5], [-32.5, 72.5], [-31.5, 72.5], [-30.5, 72.5], [-29.5, 72.5], [-28.5, 72.5], [-27.5, 72.5], [-26.5, 72.5], [-25.5, 72.5], [-24.5, 72.5], [-23.5, 72.5], [-19.5, 72.5], [-18.5, 72.5], [-17.5, 72.5], [-16.5, 72.5], [-15.5, 72.5], [-14.5, 72.5], [-13.5, 72.5], [-12.5, 72.5], [-11.5, 72.5], [-10.5, 72.5], [-9.5, 72.5], [-8.5, 72.5], [-7.5, 72.5], [-6.5, 72.5], [-5.5, 72.5], [-4.5, 72.5], [-3.5, 72.5], [-2.5, 72.5], [-1.5, 72.5], [-0.5, 72.5], [0.5, 72.5], [-92.5, 73.5], [-91.5, 73.5], [-90.5, 73.5], [-89.5, 73.5], [-88.5, 73.5], [-87.5, 73.5], [-86.5, 73.5], [-85.5, 73.5], [-84.5, 73.5], [-83.5, 73.5], [-82.5, 73.5], [-81.5, 73.5], [-80.5, 73.5], [-79.5, 73.5], [-78.5, 73.5], [-77.5, 73.5], [-76.5, 73.5], [-75.5, 73.5], [-74.5, 73.5], [-73.5, 73.5], [-72.5, 73.5], [-71.5, 73.5], [-70.5, 73.5], [-69.5, 73.5], [-68.5, 73.5], [-67.5, 73.5], [-66.5, 73.5], [-65.5, 73.5], [-64.5, 73.5], [-63.5, 73.5], [-58.5, 73.5], [-57.5, 73.5], [-56.5, 73.5], [-55.5, 73.5], [-54.5, 73.5], [-53.5, 73.5], [-52.5, 73.5], [-51.5, 73.5], [-50.5, 73.5], [-49.5, 73.5], [-48.5, 73.5], [-47.5, 73.5], [-46.5, 73.5], [-45.5, 73.5], [-44.5, 73.5], [-43.5, 73.5], [-42.5, 73.5], [-41.5, 73.5], [-40.5, 73.5], [-37.5, 73.5], [-36.5, 73.5], [-35.5, 73.5], [-34.5, 73.5], [-33.5, 73.5], [-32.5, 73.5], [-31.5, 73.5], [-30.5, 73.5], [-29.5, 73.5], [-28.5, 73.5], [-27.5, 73.5], [-26.5, 73.5], [-25.5, 73.5], [-24.5, 73.5], [-23.5, 73.5], [-19.5, 73.5], [-18.5, 73.5], [-17.5, 73.5], [-16.5, 73.5], [-15.5, 73.5], [-14.5, 73.5], [-13.5, 73.5], [-12.5, 73.5], [-11.5, 73.5], [-10.5, 73.5], [-9.5, 73.5], [-8.5, 73.5], [-7.5, 73.5], [-6.5, 73.5], [-5.5, 73.5], [-4.5, 73.5], [-3.5, 73.5], [-2.5, 73.5], [-1.5, 73.5], [-0.5, 73.5], [0.5, 73.5], [1.5, 73.5], [2.5, 73.5], [3.5, 73.5], [4.5, 73.5], [5.5, 73.5], [6.5, 73.5], [7.5, 73.5]];
      function onLawn(px, pz) { var best = null, bd = 16; LAWNPTS.forEach(function (q) { var d = (q[0] - px) * (q[0] - px) + (q[1] - pz) * (q[1] - pz); if (d < bd) { bd = d; best = q; } }); return best; }
      var usedPalm = [];
      function tryPalm(px, pz) {
        var lp = onLawn(px, pz); if (!lp) return; px = lp[0] + (tr() - .5) * .4; pz = lp[1] + (tr() - .5) * .4;
        if (usedPalm.some(function (u) { return Math.hypot(u[0] - px, u[1] - pz) < 6; })) return; usedPalm.push([px, pz]);
        if (nearRoad(px, pz, 4.5)) return;
        var ix2 = Math.floor((px - X0) / C), iz2 = Math.floor((pz - Z0) / C); if (ix2 < 0 || iz2 < 0 || ix2 >= NX || iz2 >= NZ) return; var k2 = iz2 * NX + ix2;
        var gy2 = GH[k2] > -1e8 ? GH[k2] : gy; if (HI[k2] > -1e8 && HI[k2] > gy2 + 1.2) return;
        spots.push([px, gy2, pz, 9 + tr() * 4, 4 + Math.floor(tr() * 2)]);
        spots.push([px + (tr() - .5), gy2, pz + (tr() - .5), 1.6 + tr() * .6, 6]);
        spots.push([px + 1.6 * (tr() - .5) + 1.2, gy2, pz + 1.6 * (tr() - .5), 1.3 + tr() * .5, 6]);
      }
      /* green spaces: the plan's own landscape areas, picked by the green marks on the ground plan and cut to the plan's outlines
         (portfolio-assets/textures/nbyc/lawn-mask.png, 5 cm per pixel over x -96..12, z 16..80). One clean lawn surface on the
         ground, trimmed by that mask; no shrubs for now. */
      (function lawn() {
        var LX0 = -96, LX1 = 12, LZ0 = 16, LZ1 = 80, y = 34.66;   // just above the site's paving (34.4 to 34.6)
        var P = new Float32Array([LX0, y, LZ0, LX0, y, LZ1, LX1, y, LZ1, LX0, y, LZ0, LX1, y, LZ1, LX1, y, LZ0]);
        var U = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1]);   // mask image rows run with z
        var lg = new BG(); lg.setAttribute('position', new Attr(P, 3)); lg.setAttribute('normal', new Attr(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3)); lg.setAttribute('uv', new Attr(U, 2)); lg.setAttribute('nbL', new Attr(new Float32Array(6).fill(1), 1));
        var lm = new (std.constructor)(); lm.name = 'NBYC lawn';   // a fresh material: the site's shader patches stay off it lm.color.set('#8fa865'); lm.normalMap = null; lm.roughnessMap = null; lm.aoMap = null; lm.metalness = 0; lm.roughness = 1;
        var mi = new Image(), mt = new Tex(mi); mi.onload = function () { mt.needsUpdate = true; ctx.controls.dispatchEvent({ type: 'change' }); }; mi.src = '../../portfolio-assets/textures/nbyc/lawn-mask.png';
        var gi = new Image(), gt = new Tex(gi); gt.wrapS = gt.wrapT = 1000; gt.repeat.set((LX1 - LX0) / 3, (LZ1 - LZ0) / 3); gt.colorSpace = 'srgb'; gt.anisotropy = 8; gi.onload = function () { gt.needsUpdate = true; ctx.controls.dispatchEvent({ type: 'change' }); }; gi.src = '../../portfolio-assets/textures/nbyc/grass.jpg';
        lm.map = gt; lm.alphaMap = mt; lm.alphaTest = .5; lm.transparent = false; lm.side = 0; lm.polygonOffset = true; lm.polygonOffsetFactor = -2; lm.polygonOffsetUnits = -2; lm.needsUpdate = true;
        var lmesh = new Mesh(lg, lm); lmesh.name = 'NBYC lawn'; lmesh.receiveShadow = true; scene.add(lmesh);
        // Diagram mode: lawns as a flat diagram green, trees and palms hidden; other modes: the grass photo, trees back
        function diag() { var dm = document.documentElement.getAttribute('data-sk') === 'diagram'; lm.map = dm ? null : gt; lm.color.set(dm ? '#9fc58a' : '#8fa865'); lm.needsUpdate = true; scene.traverse(function (o) { if (o.name === 'NBYC life trees') o.visible = !dm; }); ctx.controls.dispatchEvent({ type: 'change' }); }
        new MutationObserver(diag).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sk'] }); setTimeout(diag, 500);
      })();
      // the big shade tree from the site plan render, on the green strip beside the back of house (9), clear of the road and drop-off
      // the big shade tree from the site plan render: on the lawn in the north-east corner with the most room around it (the open lawn
      // spot farthest from any building), so its crown never clips a wall
      (function () {
        var best = null, bd = -1;
        LAWNPTS.forEach(function (q) { if (q[0] < -30 || q[1] > 45) return; if (q[0] > -4 && q[1] < 36) return;   /* not the drop-off island */ var md = 99;
          for (var dx = -9; dx <= 9; dx += 1) for (var dz = -9; dz <= 9; dz += 1) { var ix5 = Math.floor((q[0] + dx - X0) / C), iz5 = Math.floor((q[1] + dz - Z0) / C); if (ix5 < 0 || iz5 < 0 || ix5 >= NX || iz5 >= NZ) continue; var k5 = iz5 * NX + ix5, g5 = GH[k5] > -1e8 ? GH[k5] : gy; if (HI[k5] > -1e8 && HI[k5] > g5 + 1.5) md = Math.min(md, Math.hypot(dx, dz)); }
          if (nearRoad(q[0], q[1], 6)) return; if (md > bd) { bd = md; best = q; } });
        if (!best) return; var ix3 = Math.floor((best[0] - X0) / C), iz3 = Math.floor((best[1] - Z0) / C), k3 = iz3 * NX + ix3, gy3 = GH[k3] > -1e8 ? GH[k3] : gy; spots.push([best[0], gy3, best[1], Math.min(13, 4 + bd * 1.6), 1]); window.nbycShadeTree = [best[0], best[1], bd];
      })();
      var off = 5;
      for (var px = BX0; px <= BX1; px += 10) { tryPalm(px + (tr() - .5) * 2, BZ0 - off); tryPalm(px + (tr() - .5) * 2, BZ1 + off); }
      for (var pz = BZ0 + 5; pz <= BZ1 - 5; pz += 10) { tryPalm(BX0 - off, pz + (tr() - .5) * 2); tryPalm(BX1 + off, pz + (tr() - .5) * 2); }
      var nT = spots.length; if (!nT) return;
      var TP = new Float32Array(nT * 12), TU = new Float32Array(nT * 8), TN = new Float32Array(nT * 12), TI = [];
      spots.forEach(function (s, i) { var u0 = s[4] / 8, u1 = u0 + .125; TU.set([u0, 0, u1, 0, u1, 1, u0, 1], i * 8); for (var v = 0; v < 4; v++) TN[i * 12 + v * 3 + 1] = 1; TI.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); });
      var tg = new BG(), tpa = new Attr(TP, 3); tg.setAttribute('position', tpa); tg.setAttribute('normal', new Attr(TN, 3)); tg.setAttribute('uv', new Attr(TU, 2)); tg.setIndex(TI);
      var tm = std.clone(); tm.name = 'NBYC life trees'; tm.map = ttex; tm.color.set('#ffffff'); tm.normalMap = null; tm.roughnessMap = null; tm.aoMap = null; tm.metalness = 0; tm.roughness = 1; tm.side = 2; tm.alphaTest = .5; tm.transparent = false; tm.needsUpdate = true;
      var tmesh = new Mesh(tg, tm); tmesh.name = 'NBYC life trees'; tmesh.frustumCulled = false; scene.add(tmesh);
      anim.push(function () {
        var e = ctx.camera.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
        spots.forEach(function (s, i) { var hw = s[3] * (s[4] === 6 ? .7 : .45), j = i * 12, y0 = s[1] - .2, y1 = s[1] + s[3];
          TP[j] = s[0] - rx * hw; TP[j + 1] = y0; TP[j + 2] = s[2] - rz * hw; TP[j + 3] = s[0] + rx * hw; TP[j + 4] = y0; TP[j + 5] = s[2] + rz * hw;
          TP[j + 6] = s[0] + rx * hw; TP[j + 7] = y1; TP[j + 8] = s[2] + rz * hw; TP[j + 9] = s[0] - rx * hw; TP[j + 10] = y1; TP[j + 11] = s[2] - rz * hw; });
        tpa.needsUpdate = true;
      });
      window.nbycTrees = nT;
    })();
    function setCell(i, c, flip) { var o = i * 8, a = flip ? c[2] : c[0], b = flip ? c[0] : c[2]; UV[o] = a; UV[o + 1] = c[1]; UV[o + 2] = b; UV[o + 3] = c[1]; UV[o + 4] = b; UV[o + 5] = c[3]; UV[o + 6] = a; UV[o + 7] = c[3]; }
    function cellXZ(k) { var p = k.split(','); return [X0 + (+p[0] + .5) * C, Z0 + (+p[1] + .5) * C]; }
    var occ = new Map();   // cell -> the walker standing on or heading into it, so two people never share a cell
    function step(k, dir, self) {
      var p = k.split(','), x = +p[0], z = +p[1], opts = [], tot = 0;
      for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue; var nk = (x + dx) + ',' + (z + dz); if (!wset.has(nk)) continue; if (occ.has(nk) && occ.get(nk) !== self) continue;
        var w = dir && dx === dir[0] && dz === dir[1] ? 12 : (dir && dx === -dir[0] && dz === -dir[1] ? .05 : 1); opts.push([nk, [dx, dz], w]); tot += w;
      }
      if (!opts.length) return null; var r = rnd() * tot; for (var j = 0; j < opts.length; j++) { r -= opts[j][2]; if (r <= 0) return opts[j]; } return opts[0];
    }
    var walkers = [];
    for (var w = 0; w < nW; w++) { var k0 = walk[Math.floor(rnd() * walk.length)], tries2 = 0; while (occ.has(k0) && tries2++ < 50) k0 = walk[Math.floor(rnd() * walk.length)]; occ.set(k0, w); walkers.push({ a: k0, b: k0, t: 1, dir: null, sp: .9 + rnd() * .5, type: Math.floor(rnd() * SP.types), dist: rnd() * 3, pause: rnd() * 4 }); }
    function advance(o, dt, self) {
      o.t += dt * o.sp / C; o.dist += dt * o.sp;
      while (o.t >= 1) {
        o.t -= 1; if (o.a !== o.b && occ.get(o.a) === self) occ.delete(o.a); o.a = o.b;
        var n = step(o.a, o.dir, self); if (n) { o.b = n[0]; o.dir = n[1]; occ.set(o.b, self); } else { o.b = o.a; o.dir = null; o.t = 0; break; }   // boxed in: wait a step
      }
      var A = cellXZ(o.a), B = cellXZ(o.b); return [A[0] + (B[0] - A[0]) * o.t, A[1] + (B[1] - A[1]) * o.t, walkH.get(o.a) + (walkH.get(o.b) - walkH.get(o.a)) * o.t];
    }
    anim.push(function (time, dt) {
      if (!nW) return; ctx.camera.updateMatrixWorld(); var e = ctx.camera.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      walkers.forEach(function (o, i) {
        var p, frame; if (o.pause > 0) { o.pause -= dt; var A = cellXZ(o.a); p = [A[0], A[1], walkH.get(o.a)]; frame = 4; } else { p = advance(o, dt, i); frame = Math.floor(o.dist / .45) % 4; if (rnd() < .003) o.pause = 2 + rnd() * 5; }
        walkPos[i * 2] = p[0]; walkPos[i * 2 + 1] = p[1];
        var mv = o.dir ?o.dir[0] * rx + o.dir[1] * rz : 1, hw = 1.75 * SP.aspect / 2, j = i * 12; setCell(i, SP.walkCell(o.type, frame), mv < 0);
        P[j] = p[0] - rx * hw; P[j + 1] = p[2]; P[j + 2] = p[1] - rz * hw; P[j + 3] = p[0] + rx * hw; P[j + 4] = p[2]; P[j + 5] = p[1] + rz * hw;
        P[j + 6] = p[0] + rx * hw; P[j + 7] = p[2] + 1.75; P[j + 8] = p[1] + rz * hw; P[j + 9] = p[0] - rx * hw; P[j + 10] = p[2] + 1.75; P[j + 11] = p[1] - rz * hw;
      });
      pa.needsUpdate = true; ua.needsUpdate = true;
    });

    /* ---- streets: free corridors between the blocked areas. Distance (in cells) to the nearest blocked cell, then the ridge of that
       distance where the corridor is 6-18 m wide is the street's centre line; the plaza itself is left out. ---- */
    var dist = new Float32Array(NX * NZ), INF = 1e6; for (var k2 = 0; k2 < dist.length; k2++) dist[k2] = free[k2] ? INF : 0;
    for (var pass = 0; pass < 2; pass++) {
      var zs = pass ? NZ - 2 : 1, ze = pass ? -1 : NZ - 1, zd = pass ? -1 : 1, xs = pass ? NX - 2 : 1, xe = pass ? -1 : NX - 1, xd = pass ? -1 : 1;
      for (var z2 = zs; z2 !== ze; z2 += zd) for (var x2 = xs; x2 !== xe; x2 += xd) {
        var k3 = z2 * NX + x2, d0 = dist[k3]; if (!d0) continue;
        var nb = pass ? [[1, 0, 1], [0, 1, 1], [1, 1, 1.414], [-1, 1, 1.414]] : [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]];
        nb.forEach(function (n) { var d1 = dist[(z2 + n[1]) * NX + x2 + n[0]] + n[2]; if (d1 < d0) d0 = d1; }); dist[k3] = d0;
      }
    }
    var MINR = 2, MAXR = 6, ridge = new Int32Array(NX * NZ).fill(-1), nodes = [], inPlaza = function (x, z) { return x > -108 && x < 4 && z > 22 && z < 86; };
    for (var z4 = 2; z4 < NZ - 2; z4++) for (var x4 = 2; x4 < NX - 2; x4++) {
      var k4 = z4 * NX + x4, d = dist[k4]; if (!free[k4] || d < MINR || d > MAXR) continue;
      var xx = X0 + (x4 + .5) * C, zz = Z0 + (z4 + .5) * C; if (inPlaza(xx, zz) || zz > 96 || Math.hypot(xx - SX, zz - SZ) > 150) continue;   // south of z 96 is the dune and tree belt, not a street
      var top = true; for (var dz2 = -1; dz2 <= 1 && top; dz2++) for (var dx2 = -1; dx2 <= 1; dx2++) if (dist[(z4 + dz2) * NX + x4 + dx2] > d + .01) { top = false; break; }
      if (!top) continue; ridge[k4] = nodes.length; nodes.push([xx, GH[k4], zz, d * C]);
    }
    var links = nodes.map(function () { return []; });
    for (var z5 = 0; z5 < NZ; z5++) for (var x5 = 0; x5 < NX; x5++) { var a5 = ridge[z5 * NX + x5]; if (a5 < 0) continue; [[1, 0], [0, 1], [1, 1], [1, -1], [2, 0], [0, 2], [2, 1], [1, 2], [2, -1], [1, -2]].forEach(function (n) { var zq = z5 + n[1], xq = x5 + n[0]; if (zq < 0 || xq < 0 || zq >= NZ || xq >= NX) return; var b5 = ridge[zq * NX + xq]; if (b5 >= 0) { links[a5].push(b5); links[b5].push(a5); } }); }
    // keep the connected pieces with real length
    var comp = new Int32Array(nodes.length).fill(-1), sizes = [];
    for (var s0 = 0; s0 < nodes.length; s0++) { if (comp[s0] >= 0) continue; var cid = sizes.length, st = [s0], cnt = 0; comp[s0] = cid; while (st.length) { var v0 = st.pop(); cnt++; links[v0].forEach(function (w0) { if (comp[w0] < 0) { comp[w0] = cid; st.push(w0); } }); } sizes.push(cnt); }
    var keepNode = nodes.map(function (n, i) { return sizes[comp[i]] >= 12; });
    /* the roads, as drawn on the site plan: the long road to the north, and the roads that ring the site (north, west, east, south) */
    nodes = []; links = []; keepNode = [];
    (function () {
      var XW = RD.XW, XE = RD.XE, ZN = RD.ZN, ZS = RD.ZS, ZR = RD.ZR, XA = RD.XA, XB = RD.XB, built = {};
      function hAt(x, z) { var ix = Math.floor((x - X0) / C), iz = Math.floor((z - Z0) / C); if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) return gy; var h = GH[iz * NX + ix]; return h > -1e8 ? h : gy; }
      function nodeAt(x, z) { var k = x.toFixed(1) + ',' + z.toFixed(1); if (built[k] === undefined) { built[k] = nodes.length; nodes.push([x, hAt(x, z), z, 5]); links.push([]); keepNode.push(true); } return built[k]; }
      function road(x0, z0, x1, z1) { var L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 3)), prev = null; for (var i = 0; i <= n; i++) { var id = nodeAt(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n); if (prev !== null && prev !== id) { links[prev].push(id); links[id].push(prev); } prev = id; } }
      road(XA, ZR, XW, ZR); road(XW, ZR, XE, ZR); road(XE, ZR, XB, ZR);
      road(XW, ZR, XW, ZN); road(XW, ZN, XW, ZS); road(XE, ZR, XE, ZN); road(XE, ZN, XE, ZS);
      road(XW, ZN, XE, ZN); road(XA, ZS, XW, ZS); road(XW, ZS, XE, ZS); road(XE, ZS, XB, ZS);
    })();

    /* ---- vehicles ---- */
    var D = '#1d1e20', G = '#5a6a75';
    var TYPES = {
      sedan: [[4.0, 1.66, .1, .4, 0, D], [4.4, 1.8, .4, .95, 0, null], [2.3, 1.56, .95, 1.4, -.2, G], [2.15, 1.5, 1.4, 1.48, -.2, null]],
      suv: [[4.4, 1.8, .12, .5, 0, D], [4.7, 1.9, .5, 1.15, 0, null], [3.2, 1.8, 1.15, 1.68, -.45, G], [3.1, 1.76, 1.68, 1.8, -.45, null]],
      pickup: [[5.0, 1.85, .12, .5, 0, D], [5.4, 1.95, .5, 1.1, 0, null], [1.9, 1.85, 1.1, 1.72, .9, G], [1.8, 1.8, 1.72, 1.84, .9, null]],
      van: [[4.9, 1.9, .12, .45, 0, D], [5.2, 2.0, .45, 1.3, 0, null], [4.3, 1.96, 1.3, 1.92, -.3, G], [4.5, 1.98, 1.92, 2.12, -.25, null]],
      bus: [[10.4, 2.36, .15, .55, 0, D], [11.2, 2.5, .55, 1.5, 0, '#f2b300'], [10.6, 2.46, 1.5, 2.12, -.15, G], [11.0, 2.5, 2.12, 2.4, -.05, '#f2b300']]
    }, MIX = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'pickup', 'van'], PARKED = ['sedan', 'sedan', 'suv', 'suv', 'van'], PAINT = ['#f2f0ea', '#c9ccd0', '#2c2f34', '#8a1f2a', '#24466e', '#d8d2c4', '#5d6b73', '#a8a49a', '#3d5a45', '#b4542c'];
    var good = []; nodes.forEach(function (n, i) { if (keepNode[i]) good.push(i); });
    var nMove = good.length ? (mobile ? 6 : 14) : 0, nBus = nMove ? 1 : 0, REVCARS = window.nbycCars || [], nPark = REVCARS.length   /* the Revit model's cars, redrawn low-poly */, NC = nMove + nBus + nPark;
    window.nbycLife = { gy: gy, walkCells: walk.length, walkers: nW, ridge: nodes.length, streetNodes: good.length, cars: nMove, parked: nPark };
    if (NC) {
      var VPC = 96, CP = new Float32Array(NC * VPC * 3), CN = new Float32Array(NC * VPC * 3), CC = new Float32Array(NC * VPC * 3), CI = [], kind = [];
      var F6 = [[[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]], [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]], [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]];
      var tmpC = new (sm.color.constructor)();
      for (var c = 0; c < NC; c++) {
        var rl = c >= nMove + nBus ? REVCARS[c - nMove - nBus].len : 0;
        var tname = c >= nMove && c < nMove + nBus ? 'bus' : (rl ? (rl > 8 ? 'bus' : rl > 5 ? 'van' : rl > 4.6 ? (rnd() < .5 ? 'suv' : 'pickup') : (rnd() < .6 ? 'sedan' : 'suv')) : MIX[Math.floor(rnd() * MIX.length)]), paint = PAINT[Math.floor(rnd() * PAINT.length)]; kind.push(TYPES[tname]);
        TYPES[tname].forEach(function (b, bi) { tmpC.set(b[5] || paint); F6.forEach(function (f, fi) { var base = c * VPC + bi * 24 + fi * 4; for (var v = 0; v < 4; v++) { CC[(base + v) * 3] = tmpC.r; CC[(base + v) * 3 + 1] = tmpC.g; CC[(base + v) * 3 + 2] = tmpC.b; } CI.push(base, base + 1, base + 2, base, base + 2, base + 3); }); });
      }
      var cg = new BG(), cpa = new Attr(CP, 3), cna = new Attr(CN, 3); cg.setAttribute('position', cpa); cg.setAttribute('normal', cna); cg.setAttribute('color', new Attr(CC, 3)); cg.setIndex(CI);
      var cm = std.clone(); cm.name = 'NBYC life cars'; cm.map = null; cm.normalMap = null; cm.roughnessMap = null; cm.aoMap = null; cm.color.set('#ffffff'); if (cm.emissive) cm.emissive.set('#000000'); cm.vertexColors = true; cm.roughness = .55; cm.metalness = .15; cm.transparent = false; cm.opacity = 1; cm.side = 0; cm.needsUpdate = true;
      var cars = new Mesh(cg, cm); cars.name = 'NBYC life cars'; cars.frustumCulled = false; scene.add(cars);
      var place = function (c, x, y, z, dx, dz) {
        var rX = -dz, rZ = dx;
        kind[c].forEach(function (b, bi) { var hl = b[0] / 2, hw = b[1] / 2, y0 = b[2], y1 = b[3], off = b[4]; F6.forEach(function (f, fi) { var base = (c * VPC + bi * 24 + fi * 4) * 3; for (var v = 0; v < 4; v++) { var k = f[1][v], lx = off + k[0] * hl, ly = k[1] > 0 ? y1 : y0, lz = k[2] * hw, o = base + v * 3; CP[o] = x + dx * lx + rX * lz; CP[o + 1] = y + ly; CP[o + 2] = z + dz * lx + rZ * lz; var n = f[0]; CN[o] = dx * n[0] + rX * n[2]; CN[o + 1] = n[1]; CN[o + 2] = dz * n[0] + rZ * n[2]; } }); });
      };
      // parked along the kerb: beside a street node, along the street, on the right-hand side
      // parked exactly where the Revit model had its cars, facing the same way
      for (var p2 = 0; p2 < nPark; p2++) { var rc = REVCARS[p2]; place(nMove + nBus + p2, rc.x, rc.y + .03, rc.z, rc.dx, rc.dz); }
      /* traffic: the back alley to the north (beside the apartments) gets its own one or two slow cars that stay on it, down the
         middle; every other car keeps off it and favours the main avenue along the beach */
      var isAlley = function (n) { return Math.abs(nodes[n][2] - RD.ZR) < 1; }, isMain = function (n) { return Math.abs(nodes[n][2] - RD.ZS) < 1; };
      var next = function (a, b, alley) {
        var ax = nodes[b][0] - nodes[a][0], az = nodes[b][2] - nodes[a][2], al = Math.hypot(ax, az) || 1, opts = [], tot = 0;
        links[b].forEach(function (n) { if (n === a || !keepNode[n] || isAlley(n) !== alley) return; var bx = nodes[n][0] - nodes[b][0], bz = nodes[n][2] - nodes[b][2], bl = Math.hypot(bx, bz) || 1, d = (ax * bx + az * bz) / (al * bl); if (d < .1) return; var w = Math.pow(Math.max(d, .01), 5) * (isMain(n) ? 4 : 1); opts.push([n, w]); tot += w; });
        if (!opts.length) { var back = links[b].filter(function (n) { return keepNode[n] && isAlley(n) === alley; }); return back.length ? back[0] : a; } var r = rnd() * tot; for (var i = 0; i < opts.length; i++) { r -= opts[i][1]; if (r <= 0) return opts[i][0]; } return opts[0][0];
      };
      var movers = [];
      var alleyN = good.filter(isAlley), mainN = good.filter(isMain), otherN = good.filter(function (n) { return !isAlley(n); });
      for (var m = 0; m < nMove + nBus; m++) {
        var al2 = m < 1 && m < nMove && alleyN.length > 0, pool = al2 ? alleyN : (rnd() < .7 && mainN.length ? mainN : otherN);
        var a0 = pool[Math.floor(rnd() * pool.length)], cand = links[a0].filter(function (v) { return keepNode[v] && isAlley(v) === al2; }), b0 = cand.length ? cand[Math.floor(rnd() * cand.length)] : a0;
        movers.push({ a: a0, b: b0, t: rnd(), sp: m >= nMove ? 5 : al2 ? 3.5 : 6 + rnd() * 3, hx: 1, hz: 0, init: false, alley: al2 });
      }
      anim.push(function (time, dt) {
        // look ahead before moving: slow and stop behind another car in the same lane, or for anyone in front of the bumper
        movers.forEach(function (o, i) {
          if (o.x === undefined) { o.v = o.sp; o.wait = 0; return; }
          var hx = o.hdx, hz = o.hdz, block = false, len = o.isBus ? 7 : 4.5;
          movers.forEach(function (p, j) { if (j === i || p.x === undefined) return; var dx = p.x - o.x, dz = p.z - o.z, ah = dx * hx + dz * hz, lat = Math.abs(dx * hz - dz * hx); if (ah > 0 && ah < len + 5 && lat < 2) block = true; });
          REVCARS.forEach(function (p) { var dx = p.x - o.x, dz = p.z - o.z, ah = dx * hx + dz * hz; if (ah > 0 && ah < len + 4 && Math.abs(dx * hz - dz * hx) < 2) block = true; });
          for (var w = 0; w < walkPos.length; w += 2) { var dx2 = walkPos[w] - o.x, dz2 = walkPos[w + 1] - o.z, ah2 = dx2 * hx + dz2 * hz; if (ah2 > 0 && ah2 < len + 4 && Math.abs(dx2 * hz - dz2 * hx) < 2.2) block = true; }
          o.wait = block ? o.wait + dt : 0; if (o.wait > 8) block = false;      // never lock up for good at a crossing
          o.v += ((block ? 0 : o.sp) - o.v) * Math.min(1, dt * (block ? 6 : 1.5));
        });
        movers.forEach(function (o, i) {
          var A = nodes[o.a], B = nodes[o.b], L = Math.hypot(B[0] - A[0], B[2] - A[2]) || .01; o.t += dt * (o.v === undefined ? o.sp : o.v) / L;
          while (o.t >= 1) { o.t -= 1; var nb = next(o.a, o.b, !!o.alley); o.a = o.b; o.b = nb; A = nodes[o.a]; B = nodes[o.b]; L = Math.hypot(B[0] - A[0], B[2] - A[2]) || .01; }
          var tx = (B[0] - A[0]) / L, tz = (B[2] - A[2]) / L, k = o.init ? Math.min(1, dt * 4) : 1; o.init = true;
          o.hx += (tx - o.hx) * k; o.hz += (tz - o.hz) * k; var hl = Math.hypot(o.hx, o.hz) || 1, hx = o.hx / hl, hz = o.hz / hl, lane = o.alley ? 0 : Math.min(2.2, A[3] * .45);
          o.x = A[0] + (B[0] - A[0]) * o.t - hz * lane; o.z = A[2] + (B[2] - A[2]) * o.t + hx * lane; o.hdx = hx; o.hdz = hz; o.isBus = i >= nMove;
          place(i, o.x, A[1] + (B[1] - A[1]) * o.t + .03, o.z, hx, hz);
        });
        cpa.needsUpdate = true; cna.needsUpdate = true;
      });
    }
    // one frame loop for people and cars; it pauses while the tab is hidden, and passes the section box's planes on to them
    var last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop); if (document.hidden) { last = now; return; }
      var dt = Math.min(.1, (now - last) / 1000); last = now; anim.forEach(function (f) { f(now / 1000, dt); });
      scene.traverse(function (o) { if (o.isMesh && /^NBYC life /.test(o.material && o.material.name || '') && o.material.clippingPlanes !== std.clippingPlanes) o.material.clippingPlanes = std.clippingPlanes; });
      ctx.controls.dispatchEvent({ type: 'change' });
    })(last);
  }
})();
