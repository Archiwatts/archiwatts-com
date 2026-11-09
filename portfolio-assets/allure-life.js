/* Allure Waterways: life in the installation.
   - Water: the tank volume (its rounded plan, inside the glass) in a slowly flowing blue, light bands drifting along the tank
   - Fish: low-poly fish that swim only inside the water. The ramps, elevators and frame are voxelised (0.4 m) and every fish looks
     ahead and turns before it would touch them, so none pass through the geometry
   - People: the site's sketch figures walk on the ramp floors only (upward faces of the ramps), stepping cell to cell up and down the
     slopes, and only where there is headroom, so they keep to the path and never clip railings or walls
   Hidden with their part (tank: water and fish; ramps: people). Needs allure-parts.js and sketch-people.js. */
(function () {
  function ready() { var c = window.daylightContext; return c && c.scene && window.allureParts && window.SketchPeople; }
  (function wait() { if (ready()) setTimeout(init, 400); else setTimeout(wait, 400); })();
  var T0 = { minX: -5.45, maxX: 5.45, minY: 35.6, maxY: 53.2, minZ: -52.8, maxZ: 42.7, r: 5.45 };   // tank interior, rounded ends
  function inTank(x, y, z, m) { m = m || 0; if (y < T0.minY + m || y > T0.maxY - m || x < T0.minX + m || x > T0.maxX - m) return false; var cz0 = T0.minZ + T0.r, cz1 = T0.maxZ - T0.r; if (z < cz0) return Math.hypot(x, z - cz0) < T0.r - m; if (z > cz1) return Math.hypot(x, z - cz1) < T0.r - m; return true; }
  function init() {
    var ctx = window.daylightContext, scene = ctx.scene, P = window.allureParts.parts, mobile = !!(window.modelPerformance && window.modelPerformance.mobile);
    var any = P.ramps[0] || P.tank[0], Mesh = any.constructor, BG = any.geometry.constructor, Attr = any.geometry.attributes.position.constructor, std = any.material.constructor;
    function plain(C) { try { var q = new Float32Array(3); return new C(q, 1).array === q; } catch (e) { return false; } }
    if (!plain(Attr)) scene.traverse(function (o) { if (o.isMesh && o.geometry.index && plain(o.geometry.index.constructor)) Attr = o.geometry.index.constructor; });
    var TIME = { value: 0 };
    // ---- occupancy: ramps, elevators and frame, voxelised ----
    var S = .4, X0 = T0.minX - 1, Y0 = 27, Z0 = T0.minZ - 1, NX = Math.ceil((T0.maxX - X0 + 1) / S), NY = Math.ceil((60 - Y0) / S), NZ = Math.ceil((T0.maxZ - Z0 + 1) / S);
    var occ = new Uint8Array(NX * NY * NZ), floors = new Map();   // floors: x,z cell -> heights of walkable ramp floor
    function vi(x, y, z) { var a = Math.floor((x - X0) / S), b = Math.floor((y - Y0) / S), c = Math.floor((z - Z0) / S); if (a < 0 || b < 0 || c < 0 || a >= NX || b >= NY || c >= NZ) return -1; return (c * NY + b) * NX + a; }
    function mark(x, y, z) { var k = vi(x, y, z); if (k >= 0) occ[k] = 1; }
    function each(meshes, fn) {
      meshes.forEach(function (o) {
        var g = o.geometry, p = g.attributes.position, ix = g.index.array, m = o.matrixWorld.elements;
        function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
        for (var t = 0; t < ix.length; t += 3) fn(V(ix[t]), V(ix[t + 1]), V(ix[t + 2]), o);
      });
    }
    function solid(a, b, c) {   // sample the triangle densely enough to leave no gaps at the voxel size
      var l = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]), Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2])), n = Math.min(60, Math.ceil(l / (S * .7)));
      for (var i = 0; i <= n; i++) for (var j = 0; j <= n - i; j++) { var u = i / n || 0, v = j / n || 0, w = 1 - u - v; mark(a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v); }
    }
    var glassWalls = P.tank.filter(function (o) { return /glass/i.test(o.material.name); });
    each(P.ramps.concat(P.elevators, P.tank.filter(function (o) { return glassWalls.indexOf(o) < 0 && !/water/i.test(o.material.name); })), function (a, b, c, o) {
      solid(a, b, c);
      if (P.ramps.indexOf(o) < 0) return;
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], ny = uz * vx - ux * vz, l = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx);
      if (l < 1e-6 || Math.abs(ny) / l < .88) return;                                       // walkable: faces turned up (ramps are gentle)
      var d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-9) return;
      var x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), z0 = Math.min(a[2], b[2], c[2]), z1 = Math.max(a[2], b[2], c[2]);
      for (var gx = Math.floor(x0 / S); gx <= Math.floor(x1 / S); gx++) for (var gz = Math.floor(z0 / S); gz <= Math.floor(z1 / S); gz++) {
        var px = (gx + .5) * S, pz = (gz + .5) * S, l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / d, l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / d, l3 = 1 - l1 - l2;
        if (l1 < -.05 || l2 < -.05 || l3 < -.05) continue; var h = l1 * a[1] + l2 * b[1] + l3 * c[1], key = gx + ',' + gz, L = floors.get(key);
        if (!L) floors.set(key, L = []); if (!L.some(function (q) { return Math.abs(q - h) < .15; })) L.push(h);
      }
    });
    function blocked(x, y, z) { var k = vi(x, y, z); return k < 0 || occ[k] === 1; }
    function free(x, y, z, r) { if (!inTank(x, y, z, .35)) return false; for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) if (blocked(x + dx * r, y + dy * r, z + dz * r)) return false; return true; }
    // ---- water volume: the tank's rounded plan, extruded ----
    var ring = [], seg = 14, cz0 = T0.minZ + T0.r, cz1 = T0.maxZ - T0.r, R = T0.r + .2;
    for (var i = 0; i <= seg; i++) { var a = Math.PI + i / seg * Math.PI; ring.push([Math.cos(a) * R, cz0 + Math.sin(a) * R]); }
    for (var i2 = 0; i2 <= seg; i2++) { var a2 = i2 / seg * Math.PI; ring.push([Math.cos(a2) * R, cz1 + Math.sin(a2) * R]); }
    var WP = [], WI = [], yb = T0.minY - .25, yt = T0.maxY + .25, nr = ring.length;
    ring.forEach(function (q) { WP.push(q[0], yb, q[1], q[0], yt, q[1]); });
    for (var k = 0; k < nr; k++) { var k2 = (k + 1) % nr; WI.push(k * 2, k2 * 2, k * 2 + 1, k2 * 2, k2 * 2 + 1, k * 2 + 1); }
    var ct = WP.length / 3; WP.push(0, yt, (cz0 + cz1) / 2); for (var k3 = 0; k3 < nr; k3++) WI.push(ct, k3 * 2 + 1, ((k3 + 1) % nr) * 2 + 1);
    var wg = new BG(); wg.setAttribute('position', new Attr(new Float32Array(WP), 3)); wg.setIndex(WI); wg.computeVertexNormals();
    var wm = new std(); wm.name = 'Allure tank water volume'; wm.color.set('#3aa6c9'); wm.transparent = true; wm.opacity = .2; wm.depthWrite = false; wm.side = 2; wm.roughness = .1; wm.metalness = 0; wm.userData.skKeep = .95;
    wm.onBeforeCompile = function (sh) {
      sh.uniforms.alT = TIME;
      sh.vertexShader = 'varying vec3 vAlW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vAlW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float alT; varying vec3 vAlW;\nfloat alH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat alN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(alH(i),alH(i+vec2(1,0)),f.x),mix(alH(i+vec2(0,1)),alH(i+vec2(1,1)),f.x),f.y);}\n' +
        sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n vec2 q = vec2(vAlW.x + vAlW.y * .6 + sin(vAlW.z * .35 + alT * .8) * .6, vAlW.z - alT * 1.8); float fl = alN(q * vec2(.9, .22)) * .6 + alN(q * vec2(2.4, .7) + alT * .3) * .4;\n' +
          ' float band = smoothstep(.55, .8, fl); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.62, .88, .95), band * .55); diffuseColor.a *= .85 + .5 * band;\n' +
          ' float sh = alN(vAlW.xz * 3.1 + vec2(alT * .7, -alT * 1.1)) * alN(vAlW.zy * 2.7 - alT * .9); diffuseColor.rgb += vec3(.35, .45, .45) * smoothstep(.45, .75, sh);');
    };
    wm.customProgramCacheKey = function () { return 'allure-water-flow'; };
    if (window.sketchStyle && window.sketchStyle.patch) window.sketchStyle.patch(wm);
    var water = new Mesh(wg, wm); water.name = 'Allure tank water volume'; water.renderOrder = 1; water.userData.noWalk = true; scene.add(water); P.tank.push(water);
    (function tick() { TIME.value = performance.now() / 1000; requestAnimationFrame(tick); })();
    // ---- fish ----
    var NF = mobile ? 50 : 140, fish = [], seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var COLS = [[.98, .55, .15], [.98, .82, .2], [.25, .55, .95], [.85, .88, .9], [.95, .35, .4], [.3, .8, .75]];
    for (var f = 0; f < NF; f++) {
      var p = null; for (var tr = 0; tr < 400 && !p; tr++) { var x = T0.minX + rnd() * (T0.maxX - T0.minX), y = T0.minY + rnd() * (T0.maxY - T0.minY), z = T0.minZ + rnd() * (T0.maxZ - T0.minZ); if (free(x, y, z, .4)) p = [x, y, z]; }
      if (!p) continue; var hd = rnd() * Math.PI * 2; fish.push({ p: p, d: [Math.cos(hd), (rnd() - .5) * .2, Math.sin(hd)], v: .5 + rnd() * .8, s: .22 + rnd() * .3, c: COLS[Math.floor(rnd() * COLS.length)], ph: rnd() * 6 });
    }
    var FV = 7, FP = new Float32Array(fish.length * FV * 3), FC = new Float32Array(fish.length * FV * 3), FI = [];
    fish.forEach(function (F, i) {
      var b = i * FV; [[b, b + 1, b + 2], [b, b + 2, b + 3], [b, b + 3, b + 4], [b, b + 4, b + 1], [b + 5, b + 2, b + 6], [b + 5, b + 6, b + 4]].forEach(function (t) { FI.push(t[0], t[1], t[2]); });
      for (var v = 0; v < FV; v++) { var sh = v === 0 ? 1.1 : v >= 5 ? .8 : (v === 1 || v === 3 ? 1 : .75); FC.set([Math.pow(F.c[0] * sh, 2.2), Math.pow(F.c[1] * sh, 2.2), Math.pow(F.c[2] * sh, 2.2)], (b + v) * 3); }
    });
    var fg = new BG(), fpa = new Attr(FP, 3); fg.setAttribute('position', fpa); fg.setAttribute('color', new Attr(FC, 3)); fg.setIndex(FI);
    var fm = new std(); fm.name = 'Allure fish'; fm.vertexColors = true; fm.color.set('#ffffff'); fm.side = 2; fm.roughness = .45; fm.metalness = .1; fm.flatShading = true; fm.userData.skKeep = 1;
    if (window.sketchStyle && window.sketchStyle.patch) window.sketchStyle.patch(fm);
    var fishMesh = new Mesh(fg, fm); fishMesh.name = 'Allure fish'; fishMesh.frustumCulled = false; fishMesh.userData.noWalk = true; scene.add(fishMesh); P.tank.push(fishMesh);
    // ---- people on the ramps ----
    var SP = window.SketchPeople, walkers = [], keys = []; floors.forEach(function (L, k) { L.forEach(function (h) { keys.push([k, h]); }); });
    function floorAt(x, z, h) { var L = floors.get(Math.floor(x / S) + ',' + Math.floor(z / S)); if (!L) return null; var best = null; L.forEach(function (q) { if (Math.abs(q - h) < .45 && (best === null || Math.abs(q - h) < Math.abs(best - h))) best = q; }); return best; }
    function headroom(x, z, h) { for (var y = h + .7; y < h + 1.8; y += S) if (blocked(x, y, z)) return false; for (var r = 0; r < 6; r++) { var a = r / 6 * Math.PI * 2; if (blocked(x + Math.cos(a) * .3, h + 1, z + Math.sin(a) * .3)) return false; } return true; }
    var NPp = mobile ? 14 : 36;
    for (var w = 0; w < NPp * 20 && walkers.length < NPp && keys.length; w++) {
      var K2 = keys[Math.floor(rnd() * keys.length)], g2 = K2[0].split(','), wx = (+g2[0] + .5) * S, wz = (+g2[1] + .5) * S;
      if (!headroom(wx, wz, K2[1])) continue; var ha = rnd() * Math.PI * 2; walkers.push({ x: wx, z: wz, h: K2[1], a: ha, v: .9 + rnd() * .4, type: Math.floor(rnd() * SP.types), ph: rnd() * 4 });
    }
    var TexC = null; scene.traverse(function (o) { if (!TexC && o.isLight && o.shadow && o.shadow.map) TexC = o.shadow.map.texture.constructor; if (!TexC && o.material && o.material.map) TexC = o.material.map.constructor; });
    var people = null, PP, PU, ppa, pua;
    if (walkers.length && TexC) {
      var tex = new TexC(SP.atlas()); tex.colorSpace = 'srgb'; tex.needsUpdate = true;
      var sm = new std(); sm.name = 'NBYC life sprites'; sm.map = tex; sm.emissiveMap = tex; sm.color.set('#000000'); sm.emissive.set('#ffffff'); sm.alphaTest = .45; sm.side = 2; sm.toneMapped = false;
      PP = new Float32Array(walkers.length * 12); PU = new Float32Array(walkers.length * 8); var PN = new Float32Array(walkers.length * 12), PI = [];
      walkers.forEach(function (W, i) { for (var v = 0; v < 4; v++) PN[i * 12 + v * 3 + 1] = 1; PI.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); });
      var pg = new BG(); ppa = new Attr(PP, 3); pua = new Attr(PU, 2); pg.setAttribute('position', ppa); pg.setAttribute('normal', new Attr(PN, 3)); pg.setAttribute('uv', pua); pg.setIndex(PI);
      people = new Mesh(pg, sm); people.name = 'NBYC life sprites allure'; people.frustumCulled = false; people.userData.noWalk = true; scene.add(people); P.ramps.push(people);
    }
    // ---- motion ----
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(.08, (now - last) / 1000); last = now;
      // in a plan (a cut from above) the water and fish step aside so the drawing reads
      var planCut = (ctx.renderer.clippingPlanes || []).some(function (pl) { return pl.normal && pl.normal.y < -.5; }); wm.visible = !planCut; fm.visible = !planCut;
      fish.forEach(function (F, i) {
        var ahead = .9 + F.s * 2, nx = F.p[0] + F.d[0] * ahead, ny = F.p[1] + F.d[1] * ahead, nz = F.p[2] + F.d[2] * ahead;
        if (!free(nx, ny, nz, .3)) {   // turn toward the most open nearby direction before reaching anything
          var best = null; for (var t = 0; t < 14; t++) { var a = rnd() * Math.PI * 2, e = (rnd() - .5) * .5, d = [Math.cos(a), e, Math.sin(a)], L = Math.hypot(d[0], d[1], d[2]); d = [d[0] / L, d[1] / L, d[2] / L]; if (free(F.p[0] + d[0] * ahead, F.p[1] + d[1] * ahead, F.p[2] + d[2] * ahead, .3)) { best = d; break; } }
          F.d = best || [-F.d[0], -F.d[1], -F.d[2]];
        } else if (rnd() < .02) { var a2 = Math.atan2(F.d[2], F.d[0]) + (rnd() - .5) * .9; F.d = [Math.cos(a2), F.d[1] * .8 + (rnd() - .5) * .1, Math.sin(a2)]; var L2 = Math.hypot(F.d[0], F.d[1], F.d[2]); F.d = [F.d[0] / L2, F.d[1] / L2, F.d[2] / L2]; }
        var mx = F.p[0] + F.d[0] * F.v * dt, my = F.p[1] + F.d[1] * F.v * dt, mz = F.p[2] + F.d[2] * F.v * dt; if (free(mx, my, mz, .2)) F.p = [mx, my, mz];
        F.ph += dt * (4 + F.v * 3);
        var fx = F.d[0], fy = F.d[1], fz = F.d[2], sx = -fz, sz = fx, sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl; var s = F.s, wag = Math.sin(F.ph) * .35;
        var o = F.p, pts = [[o[0] + fx * s, o[1] + fy * s, o[2] + fz * s], [o[0] + sx * s * .28, o[1], o[2] + sz * s * .28], [o[0], o[1] + s * .32, o[2]], [o[0] - sx * s * .28, o[1], o[2] - sz * s * .28], [o[0], o[1] - s * .26, o[2]],
          [o[0] - fx * s * .85, o[1] - fy * s * .85, o[2] - fz * s * .85], [o[0] - fx * s * 1.35 + sx * wag * s, o[1] + s * .28, o[2] - fz * s * 1.35 + sz * wag * s]];
        pts[5] = [o[0] - fx * s * .9 + sx * wag * s * .6, o[1] - s * .25, o[2] - fz * s * .9 + sz * wag * s * .6];
        for (var v = 0; v < 7; v++) FP.set(pts[v], (i * 7 + v) * 3);
      });
      fpa.needsUpdate = true; fg.computeVertexNormals();
      if (people) {
        var e = ctx.camera.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
        walkers.forEach(function (W, i) {
          var step = W.v * dt, nx = W.x + Math.cos(W.a) * step, nz = W.z + Math.sin(W.a) * step, look = .7, hx = W.x + Math.cos(W.a) * look, hz = W.z + Math.sin(W.a) * look, hh = floorAt(hx, hz, W.h), nh = floorAt(nx, nz, W.h);
          if (hh !== null && nh !== null && headroom(hx, hz, hh)) { W.x = nx; W.z = nz; W.h += (nh - W.h) * .5; W.ph += dt * W.v * 2.2; if (rnd() < .006) W.a += (rnd() - .5) * .6; }
          else { var ok = false; for (var t = 0; t < 10 && !ok; t++) { var a = W.a + (rnd() - .5) * Math.PI * 1.2 + (t > 6 ? Math.PI : 0), qx = W.x + Math.cos(a) * look, qz = W.z + Math.sin(a) * look, qh = floorAt(qx, qz, W.h); if (qh !== null && headroom(qx, qz, qh)) { W.a = a; ok = true; } } if (!ok) W.a += Math.PI; }
          var hw = .3, ht = 1.7, j = i * 12, y = W.h;
          PP[j] = W.x - rx * hw; PP[j + 1] = y; PP[j + 2] = W.z - rz * hw; PP[j + 3] = W.x + rx * hw; PP[j + 4] = y; PP[j + 5] = W.z + rz * hw; PP[j + 6] = W.x + rx * hw; PP[j + 7] = y + ht; PP[j + 8] = W.z + rz * hw; PP[j + 9] = W.x - rx * hw; PP[j + 10] = y + ht; PP[j + 11] = W.z - rz * hw;
          var c = SP.walkCell(W.type, Math.floor(W.ph) % 4); PU.set([c[0], c[1], c[2], c[1], c[2], c[3], c[0], c[3]], i * 8);
        });
        ppa.needsUpdate = true; pua.needsUpdate = true;
      }
      if (!document.hidden) ctx.controls.dispatchEvent({ type: 'change' });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.allureLife = { fish: fish.length, people: walkers.length, floorCells: floors.size, occupied: occ.reduce(function (s, v) { return s + v; }, 0) };
  }
})();
