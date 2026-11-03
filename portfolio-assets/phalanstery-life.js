/* Phalanstery life: the sea drawn as moving water, people walking the city island, rowboats and swimmers in the water inside the frame.
   Walk and water points come from light/life.json (a 3 m grid of walkable ground at the island's deck height, a 10 m grid of open water). */
(function () {
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Phalanstery life skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();

  function srand(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function attrClass(g) {
    var found = null, nor = g.attributes.normal;
    [nor && nor.constructor, g.index && Object.getPrototypeOf(g.index.constructor), g.index && g.index.constructor].forEach(function (C) {
      if (found || typeof C !== 'function') return; try { var p = new C(new Float32Array(4), 2); if (p.array && p.itemSize === 2) found = C; } catch (e) {}
    });
    return found;
  }

  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, mobile = !!(window.modelPerformance && window.modelPerformance.mobile);
    var ref = null, std = null, Tex = null;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.index) return; if (!ref) ref = o;
      var m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!std && m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) std = m; if (!Tex && m && m.map) Tex = m.map.constructor;
    });
    if (!ref || !std) return;
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = attrClass(ref.geometry); if (!Attr) return;
    // the texture class comes from the sea's small white texture (the model carries it for this)
    function tex(cv) { if (!Tex) return null; var t = new Tex(cv); t.wrapS = t.wrapT = 1000; t.colorSpace = 'srgb'; t.needsUpdate = true; return t; }
    var anim = [];

    /* ---- the sea: a hatch of waves that drifts slowly ---- */
    var waterT = null;
    (function () {
      var cv = canvas(256, 256), c = cv.getContext('2d');
      c.fillStyle = '#4a8c8e'; c.fillRect(0, 0, 256, 256);
      for (var row = 0; row < 16; row++) {
        var y0 = row * 16 + 8, amp = 2.5 + (row % 3), ph = row * .9, k = 2 + (row % 2);
        [['rgba(168,222,214,.85)', 0], ['rgba(36,92,98,.55)', 5]].forEach(function (s) {
          c.beginPath(); for (var x = 0; x <= 256; x += 4) { var y = y0 + s[1] + Math.sin(x / 256 * Math.PI * 2 * k + ph) * amp; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
          c.strokeStyle = s[0]; c.lineWidth = s[1] ? 1.6 : 2.4; c.stroke();
        });
      }
      waterT = tex(cv);
      scene.traverse(function (o) {
        if (!o.isMesh || !/^zone-water/.test(o.name || '')) return;
        var g = o.geometry, pos = g.attributes.position, uv = new Float32Array(pos.count * 2); o.updateWorldMatrix(true, false); var e = o.matrixWorld.elements;
        for (var i = 0; i < pos.count; i++) { var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); uv[i * 2] = (e[0] * x + e[4] * y + e[8] * z + e[12]) / 14; uv[i * 2 + 1] = (e[2] * x + e[6] * y + e[10] * z + e[14]) / 14; }
        g.setAttribute('uv', new Attr(uv, 2));
        var m = std.clone(); m.name = 'Phal water hatch'; m.map = waterT; m.normalMap = null; m.roughnessMap = null; m.color.set(waterT ? '#ffffff' : '#4a8c8e'); m.emissive.set('#22474a'); m.roughness = .5; m.metalness = 0; m.side = 2; m.transparent = false; m.opacity = 1; m.needsUpdate = true;
        o.material = m;
      });
      if (waterT) anim.push(function (t) { waterT.offset.set(t * .006, t * .011); });
    })();

    fetch('light/life.json?v=1').then(function (r) { return r.json(); }).then(function (L) {
      var rnd = srand(1907);
      /* ---- sprites: the Hive's sketch people (shared sketch-people.js) walking and swimming; quads turn to the camera every frame ---- */
      var SP = window.SketchPeople, atlas = tex(SP.atlas());
      if (atlas) { atlas.wrapS = atlas.wrapT = 1001; }
      var nW = mobile ? 50 : 150, nS = mobile ? 10 : 26, N = nW + nS;
      var P = new Float32Array(N * 12), UV = new Float32Array(N * 8), NN = new Float32Array(N * 12), I = [];
      for (var q = 0; q < N; q++) { for (var v = 0; v < 4; v++) NN[q * 12 + v * 3 + 1] = 1; I.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); }
      var sg = new BG(), pa = new Attr(P, 3), ua = new Attr(UV, 2); sg.setAttribute('position', pa); sg.setAttribute('normal', new Attr(NN, 3)); sg.setAttribute('uv', ua); sg.setIndex(I);
      var sm = std.clone(); sm.name = 'Phal life sprites'; sm.map = atlas; sm.emissiveMap = atlas; sm.color.set('#000000'); sm.emissive.set('#ffffff'); sm.normalMap = null; sm.roughnessMap = null; sm.metalness = 0; sm.roughness = 1; sm.side = 2; sm.alphaTest = .45; sm.transparent = false; sm.opacity = 1; sm.toneMapped = false; sm.needsUpdate = true;
      var sprites = new Mesh(sg, sm); sprites.name = 'Phal life sprites'; sprites.frustumCulled = false; scene.add(sprites);
      // c = [u0, v0, u1, v1] from SketchPeople; flip mirrors a figure walking leftwards on screen
      function setCell(i, c, flip) { var o = i * 8, a = flip ? c[2] : c[0], b = flip ? c[0] : c[2]; UV[o] = a; UV[o + 1] = c[1]; UV[o + 2] = b; UV[o + 3] = c[1]; UV[o + 4] = b; UV[o + 5] = c[3]; UV[o + 6] = a; UV[o + 7] = c[3]; }

      /* ---- walkers: a random walk on the 3 m grid of walkable ground ---- */
      var WS = L.walkStep, wset = new Set(), wpts = [];
      for (var i = 0; i < L.walk.length; i += 2) { wset.add(L.walk[i] + ',' + L.walk[i + 1]); wpts.push([L.walk[i], L.walk[i + 1]]); }
      function nextOn(set, step, p, dir) {
        // keep heading most of the time, turn now and then, never step off the grid
        var opts = [];
        for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) { if (!dx && !dz) continue; var n = [p[0] + dx * step, p[1] + dz * step]; if (set.has(n[0] + ',' + n[1])) opts.push({ n: n, d: [dx, dz], w: dir && dx === dir[0] && dz === dir[1] ? 8 : 1 }); }
        if (!opts.length) return null; var tot = 0; opts.forEach(function (o) { tot += o.w; }); var r = rnd() * tot;
        for (var j = 0; j < opts.length; j++) { r -= opts[j].w; if (r <= 0) return opts[j]; } return opts[0];
      }
      var walkers = [];
      for (var w = 0; w < nW; w++) { var s0 = wpts[Math.floor(rnd() * wpts.length)]; walkers.push({ a: s0, b: s0, t: 1, dir: null, sp: .9 + rnd() * .6, type: Math.floor(rnd() * SP.types), dist: rnd() * 3, pause: rnd() * 3 }); }
      /* ---- swimmers and boats: the 10 m grid of open water ---- */
      var AS = L.waterStep, aset = new Set(), apts = [];
      for (var j2 = 0; j2 < L.water.length; j2 += 2) { aset.add(L.water[j2] + ',' + L.water[j2 + 1]); apts.push([L.water[j2], L.water[j2 + 1]]); }
      // stay inside the frame (the sea beyond it is left quiet)
      apts = apts.filter(function (p) { return Math.abs(p[0]) < 440 && Math.abs(p[1]) < 440; });
      var swimmers = [];
      for (var sI = 0; sI < nS; sI++) { var p0 = apts[Math.floor(rnd() * apts.length)]; swimmers.push({ a: p0, b: p0, t: 1, dir: null, sp: .5 + rnd() * .3, phase: rnd() * 6 }); }
      // rowboats: a hull and a rower, as plain boxes in one moving mesh each
      var hullM = std.clone(); hullM.name = 'Phal life boat'; hullM.map = null; hullM.normalMap = null; hullM.roughnessMap = null; hullM.color.set('#6b4a2c'); hullM.emissive.set('#2a1c10'); hullM.metalness = 0; hullM.roughness = .8; hullM.needsUpdate = true;
      function boatGeo() {
        var Pp = [], Nn = [], Ii = [];
        function box(cx, cy, cz, sx, sy, sz) { var hx = sx / 2, hy = sy / 2, hz = sz / 2, F = [[[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]], [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]], [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]], [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]], [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]];
          F.forEach(function (f) { var b = Pp.length / 3; f[1].forEach(function (p) { Pp.push(cx + p[0], cy + p[1], cz + p[2]); Nn.push(f[0][0], f[0][1], f[0][2]); }); Ii.push(b, b + 1, b + 2, b, b + 2, b + 3); }); }
        box(0, .2, 0, 1.3, .4, 4.2); box(0, .45, 1.9, .9, .15, .5); box(0, .45, -1.9, .9, .15, .5);   // hull and its raised ends
        box(0, .8, .2, .45, .7, .4); box(0, 1.25, .2, .3, .3, .3);                                    // the rower
        var g = new BG(); g.setAttribute('position', new Attr(new Float32Array(Pp), 3)); g.setAttribute('normal', new Attr(new Float32Array(Nn), 3)); g.setIndex(Ii); return g;
      }
      var bg = boatGeo(), boats = [], nB = mobile ? 8 : 20;
      for (var bI = 0; bI < nB; bI++) { var bp = apts[Math.floor(rnd() * apts.length)], bm = new Mesh(bg, hullM); bm.name = 'Phal life boat'; bm.frustumCulled = false; scene.add(bm); boats.push({ m: bm, a: bp, b: bp, t: 1, dir: null, sp: 1.6 + rnd() * .8, yaw: 0, ph: rnd() * 6 }); }
      function advance(o, set, step, dt) {
        o.t += dt * o.sp / step;
        while (o.t >= 1) { o.t -= 1; o.a = o.b; var n = nextOn(set, step, o.a, o.dir); if (n) { o.b = n.n; o.dir = n.d; } else { o.b = o.a; o.t = 0; break; } }
        return [o.a[0] + (o.b[0] - o.a[0]) * o.t, o.a[1] + (o.b[1] - o.a[1]) * o.t];
      }
      anim.push(function (time, dt) {
        ctx.camera.updateMatrixWorld(); var e = ctx.camera.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
        function quad(i, x, y, z, w, h) { var o = i * 12, hw = w / 2; P[o] = x - rx * hw; P[o + 1] = y; P[o + 2] = z - rz * hw; P[o + 3] = x + rx * hw; P[o + 4] = y; P[o + 5] = z + rz * hw; P[o + 6] = x + rx * hw; P[o + 7] = y + h; P[o + 8] = z + rz * hw; P[o + 9] = x - rx * hw; P[o + 10] = y + h; P[o + 11] = z - rz * hw; }
        var H = 1.75, sideOf = function (o) { return o.dir ? o.dir[0] * rx + o.dir[1] * rz : 1; };
        walkers.forEach(function (o, i) {
          var frame = 4;   // standing while paused, else the four walking frames by distance covered
          if (o.pause > 0) { o.pause -= dt; } else { var p = advance(o, wset, WS, dt); o.x = p[0]; o.z = p[1]; o.dist += dt * o.sp; frame = Math.floor(o.dist / .45) % 4; if (rnd() < .002) o.pause = 1 + rnd() * 4; }
          setCell(i, SP.walkCell(o.type, frame), sideOf(o) < 0);
          quad(i, o.x === undefined ? o.a[0] : o.x, L.walkY, o.z === undefined ? o.a[1] : o.z, H * SP.aspect, H);
        });
        swimmers.forEach(function (o, i) {
          var p = advance(o, aset, AS, dt), h = H;   // same cell scale as the walkers, so a swimmer's head matches a walker's
          setCell(nW + i, SP.swimCell(Math.floor(time * 1.2 + o.phase)), sideOf(o) < 0);
          quad(nW + i, p[0], -h * SP.swimLine + Math.sin(time * 2 + i) * .04, p[1], h * SP.aspect, h);
        });
        ua.needsUpdate = true;
        boats.forEach(function (o) { var p = advance(o, aset, AS, dt), dx = o.b[0] - o.a[0], dz = o.b[1] - o.a[1]; if (dx || dz) { var want = Math.atan2(dx, dz), d = ((want - o.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; o.yaw += d * Math.min(1, dt * 1.5); } o.m.position.set(p[0], .02 + Math.sin(time * 1.6 + o.ph) * .06, p[1]); o.m.rotation.set(Math.sin(time * 1.3 + o.ph) * .03, o.yaw, 0); });
        pa.needsUpdate = true;
      });
      sg.attributes.uv.needsUpdate = true;
      window.phalansteryLife = { walkers: nW, swimmers: nS, boats: nB };
    }).catch(function (e) { console.warn('Phalanstery life data unavailable', e); });

    // one frame loop for the water and the life; it pauses while the tab is hidden
    var last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop); if (document.hidden) { last = now; return; }
      var dt = Math.min(.1, (now - last) / 1000); last = now; var t = now / 1000;
      // the section box sets cutting planes on the model's materials: the water, figures and boats take the same ones
      scene.traverse(function (o) { if (o.isMesh && /^Phal (life|water)/.test(o.material && o.material.name || '') && o.material.clippingPlanes !== std.clippingPlanes) o.material.clippingPlanes = std.clippingPlanes; });
      anim.forEach(function (f) { f(t, dt); });
      if (ctx.controls && ctx.controls.dispatchEvent) ctx.controls.dispatchEvent({ type: 'change' });
    })(last);
  }
})();
