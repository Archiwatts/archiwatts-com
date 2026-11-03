/* Net Zero School: the Hive's sketch people walking the paths and learning ramps, and cars driving the campus roads and parked in
   the stalls. Walkable ground is read from the model (the paving and the ramps); the road network and the stalls come from the
   road centre lines and parking spaces of the Revit model (light/nzs-routes.json). */
(function () {
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.SketchPeople; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('NZS life skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();
  function srand(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function attrClass(g) {
    var found = null, nor = g.attributes.normal;
    [g.index && g.index.constructor, g.index && Object.getPrototypeOf(g.index.constructor), nor && nor.constructor].forEach(function (C) {
      if (found || typeof C !== 'function') return; try { var a = new Float32Array(4), p = new C(a, 2); if (p.array === a && p.itemSize === 2) found = C; } catch (e) {}
    });
    return found;
  }
  // world-space triangles of a mesh
  function eachTri(o, cb) {
    var g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count; o.updateWorldMatrix(true, false);
    var e = o.matrixWorld.elements;
    function w(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
    for (var t = 0; t < n; t += 3) cb(w(I ? I.getX(t) : t), w(I ? I.getX(t + 1) : t + 1), w(I ? I.getX(t + 2) : t + 2));
  }
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, mobile = !!(window.modelPerformance && window.modelPerformance.mobile);
    var ref = null, std = null, Tex = null;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.index) return; if (!ref) ref = o;
      var m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.isMeshStandardMaterial && !m.transparent && (!std || (std.isMeshPhysicalMaterial && !m.isMeshPhysicalMaterial))) std = m; if (!Tex && m && m.map) Tex = m.map.constructor;
    });
    if (!ref || !std || !Tex) return;
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = attrClass(ref.geometry); if (!Attr) return;
    var anim = [], rnd = srand(4421);

    /* ---- walkable ground: the tops of the paving and the ramps ---- */
    var C = .5, key = function (x, z) { return Math.floor(x / C) + ',' + Math.floor(z / C); }, walkH = new Map();
    scene.traverse(function (o) {
      if (!o.isMesh || !/^site_paving$|_ramp$/.test(o.name || '')) return;
      eachTri(o, function (a, b, c) {
        var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], nl = Math.hypot(nx, ny, nz) || 1;
        if (Math.abs(ny) / nl < .88) return;
        var d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-9) return;
        for (var x = Math.floor(Math.min(a[0], b[0], c[0]) / C) * C + C / 2; x <= Math.max(a[0], b[0], c[0]); x += C) for (var z = Math.floor(Math.min(a[2], b[2], c[2]) / C) * C + C / 2; z <= Math.max(a[2], b[2], c[2]); z += C) {
          var l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2; if (l1 < 0 || l2 < 0 || l3 < 0) continue;
          var y = l1 * a[1] + l2 * b[1] + l3 * c[1], k = key(x, z), h = walkH.get(k); if (h === undefined || y > h) walkH.set(k, y);
        }
      });
    });
    var walk = []; walkH.forEach(function (y, k) { walk.push(k); }); var wset = new Set(walk);

    /* ---- people: the shared sketch figures, quads turned to the camera every frame. The last few slots are schoolchildren, hidden
       until a bus drops them off; they then wander the paths for a while and go in. ---- */
    var SP = window.SketchPeople, atlasTex = new Tex(SP.atlas()); atlasTex.colorSpace = 'srgb'; atlasTex.needsUpdate = true;
    var nW = Math.min(walk.length ? (mobile ? 22 : 80) : 0, walk.length), nK = walk.length ? (mobile ? 8 : 16) : 0, NP = nW + nK;
    var P = new Float32Array(Math.max(1, NP) * 12), UV = new Float32Array(Math.max(1, NP) * 8), NN = new Float32Array(Math.max(1, NP) * 12), I = [];
    for (var q = 0; q < NP; q++) { for (var v = 0; v < 4; v++) NN[q * 12 + v * 3 + 1] = 1; I.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); }
    var sg = new BG(), pa = new Attr(P, 3), ua = new Attr(UV, 2); sg.setAttribute('position', pa); sg.setAttribute('normal', new Attr(NN, 3)); sg.setAttribute('uv', ua); sg.setIndex(I);
    var sm = std.clone(); sm.name = 'NZS life sprites'; sm.map = atlasTex; sm.emissiveMap = atlasTex; sm.color.set('#000000'); sm.emissive.set('#ffffff'); sm.normalMap = null; sm.roughnessMap = null; sm.aoMap = null; sm.metalness = 0; sm.roughness = 1; sm.side = 2; sm.alphaTest = .45; sm.transparent = false; sm.opacity = 1; sm.toneMapped = false; sm.needsUpdate = true;
    var sprites = new Mesh(sg, sm); sprites.name = 'NZS life sprites'; sprites.frustumCulled = false; sprites.renderOrder = 5; if (NP) scene.add(sprites);
    function setCell(i, c, flip) { var o = i * 8, a = flip ? c[2] : c[0], b = flip ? c[0] : c[2]; UV[o] = a; UV[o + 1] = c[1]; UV[o + 2] = b; UV[o + 3] = c[1]; UV[o + 4] = b; UV[o + 5] = c[3]; UV[o + 6] = a; UV[o + 7] = c[3]; }
    function cellXZ(k) { var p = k.split(','); return [(+p[0] + .5) * C, (+p[1] + .5) * C]; }
    function step(k, dir) {
      var p = k.split(','), x = +p[0], z = +p[1], opts = [], tot = 0, h0 = walkH.get(k);
      for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue; var nk = (x + dx) + ',' + (z + dz); if (!wset.has(nk)) continue;
        if (Math.abs(walkH.get(nk) - h0) > .35) continue;   // no stepping up walls or off the ramp edges
        var w = dir && dx === dir[0] && dz === dir[1] ? 12 : (dir && dx === -dir[0] && dz === -dir[1] ? .05 : 1); opts.push([nk, [dx, dz], w]); tot += w;
      }
      if (!opts.length) return null; var r = rnd() * tot; for (var j = 0; j < opts.length; j++) { r -= opts[j][2]; if (r <= 0) return opts[j]; } return opts[0];
    }
    var walkers = [];
    for (var w = 0; w < NP; w++) { var k0 = walk[Math.floor(rnd() * walk.length)]; walkers.push({ a: k0, b: k0, t: 1, dir: null, sp: .9 + rnd() * .5, type: Math.floor(rnd() * SP.types), dist: rnd() * 3, pause: rnd() * 4, kid: w >= nW, life: 0, delay: 0 }); }
    // a bus has stopped at (x, z): the hidden children step off one after another onto the nearest path and wander for a while
    function dropKids(x, z) {
      var best = null, bd = 1e9; walk.forEach(function (k) { var c = cellXZ(k), d = (c[0] - x) * (c[0] - x) + (c[1] - z) * (c[1] - z); if (d < bd) { bd = d; best = k; } });
      if (!best || bd > 900) return; var n = 0;
      walkers.forEach(function (o) { if (!o.kid || o.life > 0 || n >= 8) return; o.a = o.b = best; o.t = 1; o.dir = null; o.life = 35 + rnd() * 25; o.delay = n * .7; o.pause = 0; o.sp = 1 + rnd() * .5; n++; });
    }
    function advance(o, dt) {
      o.t += dt * o.sp / C; o.dist += dt * o.sp;
      while (o.t >= 1) { o.t -= 1; o.a = o.b; var n = step(o.a, o.dir); if (n) { o.b = n[0]; o.dir = n[1]; } else { o.b = o.a; o.dir = null; o.t = 0; break; } }
      var A = cellXZ(o.a), B = cellXZ(o.b); return [A[0] + (B[0] - A[0]) * o.t, A[1] + (B[1] - A[1]) * o.t, walkH.get(o.a) + (walkH.get(o.b) - walkH.get(o.a)) * o.t];
    }
    var rx = 1, rz = 0;
    anim.push(function (time, dt) {
      ctx.camera.updateMatrixWorld(); var e = ctx.camera.matrixWorld.elements, rl; rx = e[0]; rz = e[2]; rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      if (!NP) return;
      walkers.forEach(function (o, i) {
        var j = i * 12;
        if (o.kid && (o.life <= 0 || o.delay > 0)) { if (o.delay > 0) o.delay -= dt; for (var z0 = 0; z0 < 12; z0++) P[j + z0] = 0; return; }
        if (o.kid) o.life -= dt;
        var p, frame;
        if (o.pause > 0) { o.pause -= dt; var A = cellXZ(o.a); p = [A[0], A[1], walkH.get(o.a)]; frame = 4; }
        else { p = advance(o, dt); frame = Math.floor(o.dist / .45) % 4; if (!o.kid && rnd() < .003) o.pause = 2 + rnd() * 5; }
        var h = o.kid ? 1.3 : 1.75, mv = o.dir ? o.dir[0] * rx + o.dir[1] * rz : 1, hw = h * SP.aspect / 2;
        setCell(i, SP.walkCell(o.type, frame), mv < 0);
        P[j] = p[0] - rx * hw; P[j + 1] = p[2]; P[j + 2] = p[1] - rz * hw; P[j + 3] = p[0] + rx * hw; P[j + 4] = p[2]; P[j + 5] = p[1] + rz * hw;
        P[j + 6] = p[0] + rx * hw; P[j + 7] = p[2] + h; P[j + 8] = p[1] + rz * hw; P[j + 9] = p[0] - rx * hw; P[j + 10] = p[2] + h; P[j + 11] = p[1] - rz * hw;
      });
      pa.needsUpdate = true; ua.needsUpdate = true;
    });

    /* ---- vehicles: simple massing in one mesh (sedans, SUVs, pickups, vans and yellow school buses), driven along the road network
       (the campus roads and the streets around it);
       parked cars fill the stalls, and the buses pull up at the drop-off and let the children out ---- */
    fetch('light/nzs-routes.json?v=3').then(function (r) { return r.json(); }).then(function (R) {
      var nodes = R.nodes, links = R.links; if (!nodes || !nodes.length) return;
      var PAINT = ['#f2f0ea', '#c9ccd0', '#2c2f34', '#8a1f2a', '#24466e', '#d8d2c4', '#5d6b73', '#a8a49a', '#3d5a45', '#b4542c'];
      var D = '#1d1e20', G = '#5a6a75', YB = '#f2b300';
      // each type: four boxes [length, width, bottom, top, offset along the vehicle, colour (null: its paint)]
      var TYPES = {
        sedan: [[4.0, 1.66, .1, .4, 0, D], [4.4, 1.8, .4, .95, 0, null], [2.3, 1.56, .95, 1.4, -.2, G], [2.15, 1.5, 1.4, 1.48, -.2, null]],
        suv: [[4.4, 1.8, .12, .5, 0, D], [4.7, 1.9, .5, 1.15, 0, null], [3.2, 1.8, 1.15, 1.68, -.45, G], [3.1, 1.76, 1.68, 1.8, -.45, null]],
        pickup: [[5.0, 1.85, .12, .5, 0, D], [5.4, 1.95, .5, 1.1, 0, null], [1.9, 1.85, 1.1, 1.72, .9, G], [1.8, 1.8, 1.72, 1.84, .9, null]],
        van: [[4.9, 1.9, .12, .45, 0, D], [5.2, 2.0, .45, 1.3, 0, null], [4.3, 1.96, 1.3, 1.92, -.3, G], [4.5, 1.98, 1.92, 2.12, -.25, null]],
        bus: [[10.4, 2.36, .15, .55, 0, D], [11.2, 2.5, .55, 1.5, 0, YB], [10.6, 2.46, 1.5, 2.12, -.15, G], [11.0, 2.5, 2.12, 2.4, -.05, YB]]   // 2.4 m tall: under the canopies' 2.6 m clearance over the drive
      }, MIX = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'pickup', 'van'], PARKED = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'van'];   // stalls are 2.7 x 5.5 m: the parked ones are the narrower, shorter types
      var nBus = mobile ? 1 : 2, nCar = Math.min(mobile ? 8 : 24, nodes.length), nCampus = R.campus || nodes.length, nMove = nCar + nBus, stalls = (R.parking || []).slice(), nPark = Math.min(mobile ? 16 : 42, stalls.length);
      for (var s = stalls.length - 1; s > 0; s--) { var j = Math.floor(rnd() * (s + 1)), tmp = stalls[s]; stalls[s] = stalls[j]; stalls[j] = tmp; }
      var NC = nMove + nPark, VPC = 4 * 24, CP = new Float32Array(NC * VPC * 3), CN = new Float32Array(NC * VPC * 3), CC = new Float32Array(NC * VPC * 3), CI = [], kind = [];
      // the 6 faces of a unit box as 4 corners each (x along the vehicle, y up, z across)
      var F6 = [
        [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
        [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
        [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]];
      var tmpC = new (sm.color.constructor)();
      for (var c = 0; c < NC; c++) {
        var pool = c >= nMove ? PARKED : MIX, t = c >= nCar && c < nMove ? 'bus' : pool[Math.floor(rnd() * pool.length)], paint = PAINT[Math.floor(rnd() * PAINT.length)]; kind.push(TYPES[t]);
        TYPES[t].forEach(function (b, bi) {
          tmpC.set(b[5] || paint);
          F6.forEach(function (f, fi) {
            var base = c * VPC + bi * 24 + fi * 4;
            for (var v = 0; v < 4; v++) { CC[(base + v) * 3] = tmpC.r; CC[(base + v) * 3 + 1] = tmpC.g; CC[(base + v) * 3 + 2] = tmpC.b; }
            CI.push(base, base + 1, base + 2, base, base + 2, base + 3);
          });
        });
      }
      var cg = new BG(), cpa = new Attr(CP, 3), cna = new Attr(CN, 3); cg.setAttribute('position', cpa); cg.setAttribute('normal', cna); cg.setAttribute('color', new Attr(CC, 3)); cg.setIndex(CI);
      var cm = std.clone(); cm.name = 'NZS life cars'; cm.map = null; cm.normalMap = null; cm.roughnessMap = null; cm.aoMap = null; cm.color.set('#ffffff'); if (cm.emissive) cm.emissive.set('#000000'); cm.vertexColors = true; cm.roughness = .55; cm.metalness = .15; cm.transparent = false; cm.opacity = 1; cm.side = 0; cm.needsUpdate = true;
      var cars = new Mesh(cg, cm); cars.name = 'NZS life cars'; cars.frustumCulled = false; scene.add(cars);
      // place vehicle c at (x, y, z) heading (dx, dz): local x along the heading, local z to its right
      function place(c, x, y, z, dx, dz) {
        var rX = -dz, rZ = dx;
        kind[c].forEach(function (b, bi) {
          var hl = b[0] / 2, hw = b[1] / 2, y0 = b[2], y1 = b[3], off = b[4];
          F6.forEach(function (f, fi) {
            var base = (c * VPC + bi * 24 + fi * 4) * 3;
            for (var v = 0; v < 4; v++) {
              var k = f[1][v], lx = off + k[0] * hl, ly = k[1] > 0 ? y1 : y0, lz = k[2] * hw, o = base + v * 3;
              CP[o] = x + dx * lx + rX * lz; CP[o + 1] = y + ly; CP[o + 2] = z + dz * lx + rZ * lz;
              var n = f[0]; CN[o] = dx * n[0] + rX * n[2]; CN[o + 1] = n[1]; CN[o + 2] = dz * n[0] + rZ * n[2];
            }
          });
        });
      }
      for (var p2 = 0; p2 < nPark; p2++) { var st = stalls[p2]; var fl = (p2 * 7 % 3 === 0 ? -1 : 1); place(nMove + p2, st[0], st[1], st[2], fl * Math.cos(st[3]), -fl * Math.sin(st[3])); }
      // the drop-off: the road node nearest the administration building's front (PROJECT_PANEL.dropOff overrides, as [x, z])
      var DROP = (window.PROJECT_PANEL && window.PROJECT_PANEL.dropOff) || [185, -235], drop = 0, dd = 1e18;
      nodes.forEach(function (n, i) { var d = (n[0] - DROP[0]) * (n[0] - DROP[0]) + (n[2] - DROP[1]) * (n[2] - DROP[1]); if (d < dd) { dd = d; drop = i; } });
      // moving vehicles: node to node, keeping to the right-hand lane, preferring to carry straight on at junctions
      function next(a, b) {
        var ax = nodes[b][0] - nodes[a][0], az = nodes[b][2] - nodes[a][2], al = Math.hypot(ax, az) || 1, opts = [], tot = 0;
        links[b].forEach(function (n) {
          if (n === a) return; var bx = nodes[n][0] - nodes[b][0], bz = nodes[n][2] - nodes[b][2], bl = Math.hypot(bx, bz) || 1, d = (ax * bx + az * bz) / (al * bl);
          if (d < .2) return; var w = Math.pow(d, 6); opts.push([n, w]); tot += w;
        });
        if (!opts.length) return a;   // a dead end: turn round
        var r = rnd() * tot; for (var i = 0; i < opts.length; i++) { r -= opts[i][1]; if (r <= 0) return opts[i][0]; } return opts[0][0];
      }
      // half the cars start on the campus roads, half out on the streets
      var movers = [];
      for (var m = 0; m < nMove; m++) {
        var bus = m >= nCar, a0 = bus ? drop : Math.floor(rnd() * (m % 2 ? nCampus : nodes.length)), b0 = links[a0].length ? links[a0][Math.floor(rnd() * links[a0].length)] : a0;
        movers.push({ a: a0, b: b0, t: bus ? 0 : rnd(), sp: bus ? 5 : 6 + rnd() * 3, hx: 1, hz: 0, init: false, bus: bus, stop: 0, cool: bus ? 20 + m * 25 : 0 });
      }
      anim.push(function (time, dt) {
        movers.forEach(function (o, i) {
          var A = nodes[o.a], B = nodes[o.b], L = Math.hypot(B[0] - A[0], B[2] - A[2]) || .01;
          if (o.cool > 0) o.cool -= dt;
          if (o.stop > 0) o.stop -= dt;
          else {
            o.t += dt * o.sp / L;
            while (o.t >= 1) {
              o.t -= 1; var nb = next(o.a, o.b); o.a = o.b; o.b = nb; A = nodes[o.a]; B = nodes[o.b]; L = Math.hypot(B[0] - A[0], B[2] - A[2]) || .01;
              // a bus reaching the drop-off pulls up for a while and lets the children off
              if (o.bus && o.a === drop && o.cool <= 0) { o.t = 0; o.stop = 14; o.cool = 75; o.dropping = true; break; }
            }
          }
          var tx = (B[0] - A[0]) / L, tz = (B[2] - A[2]) / L, k = o.init ? Math.min(1, dt * 4) : 1; o.init = true;
          o.hx += (tx - o.hx) * k; o.hz += (tz - o.hz) * k; var hl = Math.hypot(o.hx, o.hz) || 1, hx = o.hx / hl, hz = o.hz / hl, lane = o.bus ? 2 : 1.7;
          var x = A[0] + (B[0] - A[0]) * o.t - hz * lane, z = A[2] + (B[2] - A[2]) * o.t + hx * lane, y = A[1] + (B[1] - A[1]) * o.t + .03;
          if (o.dropping && o.stop < 12) { o.dropping = false; dropKids(x - hz * 2.5, z + hx * 2.5); }
          place(i, x, y, z, hx, hz);
        });
        cpa.needsUpdate = true; cna.needsUpdate = true;
      });
      window.nzsLife.cars = nCar; window.nzsLife.buses = nBus; window.nzsLife.parked = nPark; window.nzsLife.dropNode = nodes[drop];
    }).catch(function (e) { console.warn('NZS cars skipped', e); });
    window.nzsLife = { walkers: nW, kids: nK, walkCells: walk.length };

    // one frame loop for the people and the cars; it pauses while the tab is hidden. The section box's cutting planes (set on the
    // model's materials) are passed on to them.
    var last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop); if (document.hidden) { last = now; return; }
      var dt = Math.min(.1, (now - last) / 1000); last = now;
      anim.forEach(function (f) { f(now / 1000, dt); });
      scene.traverse(function (o) { if (o.isMesh && /^NZS life /.test(o.material && o.material.name || '') && o.material.clippingPlanes !== std.clippingPlanes) o.material.clippingPlanes = std.clippingPlanes; });
      ctx.controls.dispatchEvent({ type: 'change' });
    })(last);
  }
})();
