/* People and boats for any project page: the site's sketch figures walk the open ground around the project, and on water small
   dark boats with a figure aboard glide along the canals. Walkable ground and water are read from the model (upward faces at street
   level; faces whose name or material says water) on a 1 m grid; figures steer to stay on them. Phones get fewer.
   Configure with window.PROJECT_LIFE = { people: 40, boats: 6 } (0 turns either off). Needs sketch-people.js. */
(function () {
  var CFG = window.PROJECT_LIFE || {};
  function ready() { var c = window.daylightContext; return c && c.scene && window.projectWalk && window.SketchPeople && window.projectLook; }
  (function wait() { if (ready()) setTimeout(init, 800); else setTimeout(wait, 500); })();
  function init() {
    var ctx = window.daylightContext, scene = ctx.scene, box = window.projectWalk.box, G = window.projectLook.ground != null ? window.projectLook.ground : box[1];
    var mobile = !!(window.modelPerformance && window.modelPerformance.mobile), NP = CFG.people != null ? CFG.people : (mobile ? 14 : 40), NB = CFG.boats != null ? CFG.boats : (mobile ? 3 : 6);
    var pad = 45, X0 = box[0] - pad, Z0 = box[2] - pad, NX = Math.ceil((box[3] - box[0] + 2 * pad)), NZ = Math.ceil((box[5] - box[2] + 2 * pad));
    var ground = new Uint8Array(NX * NZ), water = new Uint8Array(NX * NZ), gy = new Float32Array(NX * NZ), wy = new Float32Array(NX * NZ), roof = new Uint8Array(NX * NZ), cover = new Uint8Array(NX * NZ);
    scene.traverse(function (o) {
      if (!o.isMesh || !o.visible || o.userData.skEdge || /life|sprite|ink|drape|lawn/i.test(o.name || '')) return;
      var isW = /water|canal/i.test((o.name || '') + ' ' + (o.material && o.material.name || '')); o.updateMatrixWorld();
      var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, m = o.matrixWorld.elements, n = ix ? ix.length : p.count;
      function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
      for (var t = 0; t + 2 < n; t += 3) {
        var a = V(ix ? ix[t] : t), b = V(ix ? ix[t + 1] : t + 1), c = V(ix ? ix[t + 2] : t + 2);
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], ny = uz * vx - ux * vz, l = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx); if (l < 1e-9) continue;
        var up = Math.abs(ny) / l, y = (a[1] + b[1] + c[1]) / 3, x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), z0 = Math.min(a[2], b[2], c[2]), z1 = Math.max(a[2], b[2], c[2]);
        if (x1 < X0 || z1 < Z0 || x0 > X0 + NX || z0 > Z0 + NZ) continue;
        var d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-9) continue;
        for (var gx = Math.max(0, Math.floor(x0 - X0)); gx <= Math.min(NX - 1, Math.floor(x1 - X0)); gx++) for (var gz = Math.max(0, Math.floor(z0 - Z0)); gz <= Math.min(NZ - 1, Math.floor(z1 - Z0)); gz++) {
          var px = X0 + gx + .5, pz = Z0 + gz + .5, l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / d, l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / d, l3 = 1 - l1 - l2;
          if (l1 < -.02 || l2 < -.02 || l3 < -.02) continue; var h = l1 * a[1] + l2 * b[1] + l3 * c[1], k = gz * NX + gx;
          if (isW) { if (up > .9) { water[k] = 1; wy[k] = h; } continue; }
          if (h > G - 1.2) cover[k] = 1;                                                    // a street, quay or building over the water plane
          if (h > G + 1.6) { if (up > .5 || h < G + 6) roof[k] = 1; continue; }        // anything standing above street level blocks
          if (up > .9 && h > G - .5 && h < G + .7) { ground[k] = 1; gy[k] = Math.max(gy[k] || -1e9, h); }
        }
      }
    });
    for (var k0 = 0; k0 < NX * NZ; k0++) { if (roof[k0]) ground[k0] = 0; if (cover[k0]) water[k0] = 0; }
    // keep boats off the canal edges: water cells need open water two cells around
    var wOpen = new Uint8Array(NX * NZ); for (var zq = 2; zq < NZ - 2; zq++) for (var xq = 2; xq < NX - 2; xq++) { var kk = zq * NX + xq, all = water[kk]; for (var d2 = -2; d2 <= 2 && all; d2++) all = water[kk + d2] && water[kk + d2 * NX]; wOpen[kk] = all ? 1 : 0; } water = wOpen;
    function cells(set) { var a = []; for (var k = 0; k < set.length; k++) if (set[k]) a.push(k); return a; }
    var GC = cells(ground), WC = cells(water); if (!GC.length && !WC.length) return;
    var any = null, TexC = null; scene.traverse(function (o) { if (!any && o.isMesh && o.geometry.attributes.position && !o.userData.skEdge) any = o; if (!TexC && o.material && (o.material.map || o.material.emissiveMap)) TexC = (o.material.map || o.material.emissiveMap).constructor; if (!TexC && o.isLight && o.shadow && o.shadow.map) TexC = o.shadow.map.texture.constructor; });
    if (!any || !TexC) { setTimeout(init, 1500); return; }
    var Mesh = any.constructor, BG = any.geometry.constructor, Attr = any.geometry.attributes.position.constructor;
    function plain(C) { try { var q = new Float32Array(3), r = new C(q, 1); return r.array === q; } catch (e) { return false; } }
    if (!plain(Attr)) scene.traverse(function (o) { if (o.isMesh && o.geometry.index && plain(o.geometry.index.constructor)) Attr = o.geometry.index.constructor; });
    var SP = window.SketchPeople, tex = new TexC(SP.atlas()); tex.colorSpace = 'srgb'; tex.needsUpdate = true;
    var sm = new (any.material.constructor)(); sm.name = 'NBYC life sprites'; sm.map = tex; sm.emissiveMap = tex; sm.color.set('#000000'); if (sm.emissive) sm.emissive.set('#ffffff'); sm.alphaTest = .45; sm.side = 2; sm.toneMapped = false; sm.roughness = 1; sm.metalness = 0;
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function at(k) { return [X0 + (k % NX) + .5, Z0 + Math.floor(k / NX) + .5]; }
    function ok(set, x, z) { var gx = Math.floor(x - X0), gz = Math.floor(z - Z0); return gx >= 0 && gz >= 0 && gx < NX && gz < NZ && set[gz * NX + gx]; }
    function hAt(arr, x, z) { var gx = Math.floor(x - X0), gz = Math.floor(z - Z0); return arr[gz * NX + gx]; }
    var agents = [];
    // walkers: start near the project (closer cells more likely), wander at walking pace, turning away from anything not walkable
    var cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
    var nearG = GC.filter(function (k) { var p = at(k); return Math.hypot(p[0] - cx, p[1] - cz) < Math.max(box[3] - box[0], box[5] - box[2]) * .8 + 25; });
    for (var i = 0; i < NP && nearG.length; i++) { var p0 = at(nearG[Math.floor(rnd() * nearG.length)]); agents.push({ kind: 'p', x: p0[0], z: p0[1], h: rnd() * 6.28, v: 1.1 + rnd() * .5, type: Math.floor(rnd() * SP.types), ph: rnd() * 4, stand: rnd() < .15 }); }
    for (var j = 0; j < NB && WC.length; j++) { var w0 = at(WC[Math.floor(rnd() * WC.length)]); agents.push({ kind: 'b', x: w0[0], z: w0[1], h: rnd() * 6.28, v: 1.6 + rnd() * .8, type: Math.floor(rnd() * SP.types), ph: 0 }); }
    if (!agents.length) return;
    var nP = agents.length, P = new Float32Array(nP * 12), UV = new Float32Array(nP * 8), N = new Float32Array(nP * 12), I = [];
    for (var q = 0; q < nP; q++) { for (var v = 0; v < 4; v++) N[q * 12 + v * 3 + 1] = 1; I.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); }
    var g = new BG(), pa = new Attr(P, 3), ua = new Attr(UV, 2); g.setAttribute('position', pa); g.setAttribute('normal', new Attr(N, 3)); g.setAttribute('uv', ua); g.setIndex(I);
    var people = new Mesh(g, sm); people.name = 'NBYC life sprites people'; people.frustumCulled = false; people.userData.noWalk = true; scene.add(people);
    // boat hulls: one merged mesh of simple dark gondola-like hulls, moved each frame
    var bs = agents.filter(function (a) { return a.kind === 'b'; }), hull = null, HP = null, hpa = null;
    if (bs.length) {
      var HV = [[-2.2, 0, -.45], [2.2, 0, -.45], [2.2, 0, .45], [-2.2, 0, .45], [-2.9, .55, -.6], [2.9, .55, -.6], [2.9, .55, .6], [-2.9, .55, .6]], HF = [[0, 2, 1], [0, 3, 2], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
      HP = new Float32Array(bs.length * 8 * 3); var HI = []; bs.forEach(function (b, i2) { HF.forEach(function (f) { HI.push(i2 * 8 + f[0], i2 * 8 + f[1], i2 * 8 + f[2]); }); b.hv = HV; b.hi = i2; });
      var hg = new BG(); hpa = new Attr(HP, 3); hg.setAttribute('position', hpa); hg.setIndex(HI); hg.computeVertexNormals && hg.computeVertexNormals();
      var hm = new (any.material.constructor)(); hm.name = 'Project boats'; hm.color.set('#4a3020'); hm.roughness = .6; hm.side = 2; hull = new Mesh(hg, hm); hull.name = 'Project boats'; hull.frustumCulled = false; hull.userData.noWalk = true; scene.add(hull);
    }
    // trees on the lawns: low-poly canopies (three lumpy blobs over a trunk), shaded by vertex colour, spaced out over the lawn area
    var NT = CFG.trees != null ? CFG.trees : (mobile ? 30 : 90), lawns = [];
    scene.traverse(function (o) { if (o.isMesh && /landscape|lawn|grass/i.test(o.name || '') && !/life|sprite/i.test(o.name || '')) lawns.push(o); });
    if (NT && lawns.length) {
      var tris = [], tot = 0;
      lawns.forEach(function (o) { o.updateMatrixWorld(); var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, m = o.matrixWorld.elements, n = ix ? ix.length : p.count;
        function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
        for (var t = 0; t + 2 < n; t += 3) { var a = V(ix ? ix[t] : t), b = V(ix ? ix[t + 1] : t + 1), c = V(ix ? ix[t + 2] : t + 2), ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2], ar = Math.abs(ux * vz - uz * vx) / 2; if (ar < .5 || Math.max(a[1], b[1], c[1]) < G - 1) continue; tot += ar; tris.push([tot, a, b, c]); } });
      var spots = [];
      for (var tries = 0; tries < NT * 30 && spots.length < NT && tot > 0; tries++) {
        var r0 = rnd() * tot, lo = 0, hi = tris.length - 1; while (lo < hi) { var mid = (lo + hi) >> 1; if (tris[mid][0] < r0) lo = mid + 1; else hi = mid; }
        var T = tris[lo], u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
        var sx = T[1][0] + (T[2][0] - T[1][0]) * u + (T[3][0] - T[1][0]) * w, sy = Math.max(T[1][1], T[2][1], T[3][1]), sz = T[1][2] + (T[2][2] - T[1][2]) * u + (T[3][2] - T[1][2]) * w;
        if (spots.some(function (q) { return Math.hypot(q[0] - sx, q[2] - sz) < 6.5; })) continue;
        if (ok(roof, sx, sz)) continue; spots.push([sx, sy, sz, .8 + rnd() * .5]);
      }
      if (spots.length) {
        var TP = [], TC = [], TI = [];
        function blob(cx2, cy2, cz2, R, Ry, col, seg) {
          var base = TP.length / 3, rs = seg || 7, cs = 5;
          for (var a2 = 0; a2 <= cs; a2++) for (var b2 = 0; b2 < rs; b2++) {
            var th = a2 / cs * Math.PI, ph = b2 / rs * Math.PI * 2, j = 1 + (a2 > 0 && a2 < cs ? (rnd() - .5) * .28 : 0), x2 = Math.sin(th) * Math.cos(ph) * R * j, y2 = Math.cos(th) * Ry * j, z2 = Math.sin(th) * Math.sin(ph) * R * j;
            TP.push(cx2 + x2, cy2 + y2, cz2 + z2); var sh2 = .72 + .38 * (Math.cos(th) * .5 + .5) + (rnd() - .5) * .08; TC.push(Math.pow(col[0] * sh2, 2.2), Math.pow(col[1] * sh2, 2.2), Math.pow(col[2] * sh2, 2.2));   /* vertex colours are linear */
          }
          for (var a3 = 0; a3 < cs; a3++) for (var b3 = 0; b3 < rs; b3++) { var p00 = base + a3 * rs + b3, p01 = base + a3 * rs + (b3 + 1) % rs, p10 = p00 + rs, p11 = p01 + rs; TI.push(p00, p10, p01, p01, p10, p11); }
        }
        var GREENS = [[.33, .47, .22], [.28, .42, .2], [.4, .52, .25], [.31, .45, .27]];
        spots.forEach(function (s) {
          var k = s[3], gc = GREENS[Math.floor(rnd() * GREENS.length)], ht = 2.4 * k;
          blob(s[0], s[1] + ht / 2, s[2], .2 * k, ht / 2, [.36, .27, .19], 5);
          blob(s[0], s[1] + ht + 1.3 * k, s[2], 2.1 * k, 1.6 * k, gc);
          blob(s[0] + (rnd() - .5) * 1.6 * k, s[1] + ht + 2.3 * k, s[2] + (rnd() - .5) * 1.6 * k, 1.5 * k, 1.2 * k, [gc[0] * 1.12, gc[1] * 1.1, gc[2] * 1.05]);
          blob(s[0] + (rnd() - .5) * 2 * k, s[1] + ht + .9 * k, s[2] + (rnd() - .5) * 2 * k, 1.4 * k, 1.1 * k, [gc[0] * .9, gc[1] * .92, gc[2] * .9]);
        });
        var tg = new BG(); tg.setAttribute('position', new Attr(new Float32Array(TP), 3)); tg.setAttribute('color', new Attr(new Float32Array(TC), 3)); tg.setIndex(TI); tg.computeVertexNormals();
        var tm = new (any.material.constructor)(); tm.name = 'Project trees'; tm.vertexColors = true; tm.color.set('#ffffff'); tm.roughness = .95; tm.metalness = 0; tm.flatShading = true;
        if (window.sketchStyle && window.sketchStyle.patch) try { window.sketchStyle.patch(tm); } catch (e) {}
        var trees = new Mesh(tg, tm); trees.name = 'Project trees'; trees.castShadow = true; trees.receiveShadow = true; trees.userData.noWalk = true; scene.add(trees);
        spots.forEach(function (s) { var gx = Math.floor(s[0] - X0), gz = Math.floor(s[2] - Z0); for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) { var xx = gx + dx, zz = gz + dz; if (xx >= 0 && zz >= 0 && xx < NX && zz < NZ) ground[zz * NX + xx] = 0; } });
      }
    }
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(.1, (now - last) / 1000); last = now;
      var e = ctx.camera.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      agents.forEach(function (a, i) {
        var set = a.kind === 'b' ? water : ground;
        if (!a.stand) {
          var nx = a.x + Math.cos(a.h) * a.v * dt, nz = a.z + Math.sin(a.h) * a.v * dt, look = a.kind === 'b' ? 4 : 1.5;
          if (ok(set, a.x + Math.cos(a.h) * look, a.z + Math.sin(a.h) * look) && ok(set, nx, nz)) { a.x = nx; a.z = nz; if (rnd() < .01) a.h += (rnd() - .5) * 1.2; }
          else { for (var tr = 0; tr < 8; tr++) { var h2 = a.h + (rnd() - .5) * Math.PI * 1.4; if (ok(set, a.x + Math.cos(h2) * look, a.z + Math.sin(h2) * look)) { a.h = h2; break; } } if (tr === 8) a.h += Math.PI; }
          a.ph += dt * a.v * 2.2;
        }
        var y = a.kind === 'b' ? hAt(wy, a.x, a.z) + .45 : hAt(gy, a.x, a.z), hw = .38, ht = 1.75, j = i * 12;
        P[j] = a.x - rx * hw; P[j + 1] = y; P[j + 2] = a.z - rz * hw; P[j + 3] = a.x + rx * hw; P[j + 4] = y; P[j + 5] = a.z + rz * hw;
        P[j + 6] = a.x + rx * hw; P[j + 7] = y + ht; P[j + 8] = a.z + rz * hw; P[j + 9] = a.x - rx * hw; P[j + 10] = y + ht; P[j + 11] = a.z - rz * hw;
        var cell = SP.walkCell(a.type, a.stand || a.kind === 'b' ? 4 : Math.floor(a.ph) % 4); UV.set([cell[0], cell[1], cell[2], cell[1], cell[2], cell[3], cell[0], cell[3]], i * 8);
        if (a.kind === 'b' && HP) { var ch = Math.cos(a.h), sh = Math.sin(a.h), wyb = y - .45; a.hv.forEach(function (v2, k2) { var o = (a.hi * 8 + k2) * 3; HP[o] = a.x + v2[0] * ch - v2[2] * sh; HP[o + 1] = wyb + v2[1]; HP[o + 2] = a.z + v2[0] * sh + v2[2] * ch; }); }
      });
      pa.needsUpdate = true; ua.needsUpdate = true; if (hpa) { hpa.needsUpdate = true; hull.geometry.computeVertexNormals(); }
      if (!document.hidden) ctx.controls.dispatchEvent({ type: 'change' });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.projectLife = { agents: agents, people: NP, boats: bs.length, groundCells: GC.length, waterCells: WC.length };
  }
})();
