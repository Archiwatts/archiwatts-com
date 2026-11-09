/* North Beach Youth Center: the walk-through. The camera retraces the route of the Lumion video (north-shore-render-copy.mp4):
   street -> curved west end -> green-wall entrance -> skate park -> plaza and juice-bar pod -> ground floor -> stairs up -> cafe around
   the glass funnel -> amphitheatre steps -> lattice ramp -> classroom -> roof opening -> skylit gym -> east rotunda.
   Stops are in page metres (grade y 34.6; main floor 40.1, classroom/gym floor 45.6, roof deck 53.5), eye height 1.6 m; the camera glides along a
   smooth curve through them and pauses briefly at each named stop. */
(function () {
  var E = 1.6, G = 34.6, MAIN = 40.1, GYM = 45.6, ROOF = 53.5;   // floor levels read from the model
  // [order, eye position (feet + 1.6 m), look-at point, label or null]; the route between them is found on the walkable map
  var K = [
    [0,  [-118, G + E, 82],     [-82, 42, 56],   'The street'],
    [1,  [-104, G + E, 64],     [-84, 40, 52],   null],
    [2,  [-86, G + E, 68],      [-80, 37, 58],   'Green-wall entrance'],
    [3,  [-72, G + E, 60],      [-77, 41, 53],   null],
    [4,  [-64, G + E, 40],      [-70, 33, 28],   'Skate park'],
    [5,  [-54, G + E, 38],      [-40, 37, 27],   'Plaza and juice bar'],
    [6,  [-50, G + E, 46],      [-62, 37, 56],   'Skate shop (retail)'],
    [8,  [-67, MAIN + E, 47],   [-77, 43, 53],   'Cafe at the glass funnel'],
    [9,  [-70, MAIN + E, 59],   [-77, 44, 53],   null],
    [10, [-83, MAIN + E, 48],   [-76, 41.5, 57], 'Amphitheatre steps'],
    [11, [-74, MAIN + E, 53],   [-77, 50, 53],   null],
    [12, [-52, GYM + E, 45],    [-36, GYM + 1, 48], 'Classroom'],
    [13, [-71, GYM + E, 58],    [-77, 42, 53],   'The funnel from the upper level'],
    [14, [-46, GYM + E, 53],    [-30, GYM + 2, 53], 'Skylit gym'],
    [15, [-22, GYM + E, 60],    [-11, GYM + 2, 54], 'East rotunda']
  ];

  function ready() { return window.daylightContext && window.daylightContext.controls && window.nbycIfc; }
  (function wait() { if (ready()) init(); else setTimeout(wait, 300); })();

  function cr(p0, p1, p2, p3, t) {   // centripetal-ish Catmull-Rom, per axis
    var t2 = t * t, t3 = t2 * t;
    return p1.map(function (_, i) { return .5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3); });
  }
  /* the fly-through: a free camera gliding the same story as the Lumion video, floating between levels and over things
     ([seconds, eye, look-at, label]); played on a smooth curve, a little slower than the video */
  var FLY = [
    [0,   [-118, G + 2.5, 82],   [-82, 42, 56],   'The street'],
    [8,   [-104, G + 3, 64],     [-84, 40, 52],   null],
    [15,  [-86, G + 2.2, 68],    [-80, 37, 58],   'Green-wall entrance'],
    [22,  [-72, G + 3, 60],      [-77, 41, 53],   null],
    [30,  [-64, G + 6, 42],      [-70, 33, 28],   'Skate park'],
    [38,  [-54, G + 4, 38],      [-40, 37, 27],   'Plaza and juice bar'],
    [46,  [-50, G + 2, 46],      [-62, 37, 56],   'Skate shop (retail)'],
    [55,  [-62, MAIN - 1, 51],   [-70, 42, 54],   null],
    [64,  [-67, MAIN + 1.8, 47], [-77, 43, 53],   'Cafe at the glass funnel'],
    [73,  [-70, MAIN + 2, 59],   [-77, 44, 53],   null],
    [82,  [-83, MAIN + 1.8, 48], [-76, 41.5, 57], 'Amphitheatre steps'],
    [91,  [-74, MAIN + 2.5, 53], [-77, 50, 53],   null],
    [101, [-89, GYM, 61],        [-80, 46, 66],   'Lattice ramp'],
    [111, [-85, GYM + 2, 44],    [-91, GYM + 1, 51], null],
    [123, [-52, GYM + 1.8, 45],  [-36, GYM + 1, 48], 'Classroom'],
    [137, [-70, ROOF + 2.5, 57], [-77, 46, 53],   'Over the funnel'],
    [153, [-46, GYM + 2.5, 53],  [-30, GYM + 2, 53], 'Skylit gym'],
    [169, [-22, GYM + 2, 60],    [-11, GYM + 2, 54], 'East rotunda'],
    [182, [10, ROOF + 14, 85],   [-40, 42, 50],   'The whole building']
  ];
  var FLYSLOW = 1.25;
  function at(s) {
    var K = FLY, n = K.length; if (s <= 0) return [K[0][1], K[0][2], 0]; if (s >= K[n - 1][0]) return [K[n - 1][1], K[n - 1][2], n - 1];
    var i = 0; while (K[i + 1][0] < s) i++;
    var a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(n - 1, i + 2)], t = (s - b[0]) / (c[0] - b[0]);
    t = t * t * (3 - 2 * t) * .35 + t * .65;     // ease a little into and out of each stop
    return [cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t), i];
  }

  /* ---- walking for real: a walkable map of the model (floors, ramps, stairs) on a 0.5 m grid, with walls, glass and railings as
     obstacles; the route between stops is found on it, so the walk only changes level on a ramp or stair, keeps its feet on the
     floor and never passes through a wall ---- */
  var WALK = 1.2, PAUSE = 3.2, CS = .5, X0 = -132, Z0 = 8, NX = 300, NZ = 180, STEP = .42,   /* climbable rise per half-metre cell; set to .13 for ramps only (a ramp rises ~0.04 m per cell, a stair riser ~0.18 m) once the ground-to-main ramp connects */ R = 0;
  function buildNav(scene) {
    var floors = new Array(NX * NZ), walls = new Array(NX * NZ);
    function addF(i, y) { var a = floors[i] || (floors[i] = []); for (var k = 0; k < a.length; k++) if (Math.abs(a[k] - y) < .12) { if (y > a[k]) a[k] = y; return; } a.push(y); }
    function addW(i, y0, y1) { (walls[i] || (walls[i] = [])).push(y0, y1); }
    scene.traverse(function (o) {
      if (!o.isMesh || !o.visible || !o.userData.ifc || !o.geometry.attributes.position) return;
      var glass = /Glazing/.test(o.name), A = o.geometry.attributes.position.array, door = /door|sash|hardware|wheels/i.test(o.material && o.material.name || '');   // doors stand closed in the model: walk through them
      for (var k = 0; k < A.length; k += 9) {
        var ax = A[k], ay = A[k + 1], az = A[k + 2], bx = A[k + 3], by = A[k + 4], bz = A[k + 5], cx = A[k + 6], cy = A[k + 7], cz = A[k + 8];
        var ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz); if (l < 1e-8) continue;
        var up = Math.abs(ny) / l, xmin = Math.min(ax, bx, cx), xmax = Math.max(ax, bx, cx), zmin = Math.min(az, bz, cz), zmax = Math.max(az, bz, cz);
        if (xmax < X0 || zmax < Z0 || xmin > X0 + NX * CS || zmin > Z0 + NZ * CS) continue;
        if (up > .82 && !glass) {           // walkable: floors, ramps, stair treads, paving
          var d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue;
          for (var gx = Math.floor((xmin - X0) / CS); gx <= Math.floor((xmax - X0) / CS); gx++) for (var gz = Math.floor((zmin - Z0) / CS); gz <= Math.floor((zmax - Z0) / CS); gz++) {
            if (gx < 0 || gz < 0 || gx >= NX || gz >= NZ) continue; var px = X0 + (gx + .5) * CS, pz = Z0 + (gz + .5) * CS;
            var l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
            if (l1 < -.02 || l2 < -.02 || l3 < -.02) continue; addF(gz * NX + gx, l1 * ay + l2 * by + l3 * cy);
          }
        } else if (up < .5 && !door) {               // walls, glass, railings, columns: sample the face onto the grid
          // sample the face itself (in 3D), recording the height at each sample, so a long sloped ramp edge only blocks where it
          // really stands at body height, not along its whole length
          var n = Math.min(400, Math.ceil(Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(cx - bx, cy - by, cz - bz)) / .25) + 1);
          for (var i = 0; i <= n; i++) for (var j = 0; j <= n - i; j++) {
            var s1 = i / n, s2 = j / n, px2 = ax + ux * s1 + vx * s2, py2 = ay + uy * s1 + vy * s2, pz2 = az + uz * s1 + vz * s2, gx2 = Math.floor((px2 - X0) / CS), gz2 = Math.floor((pz2 - Z0) / CS);
            if (gx2 < 0 || gz2 < 0 || gx2 >= NX || gz2 >= NZ) continue; addW(gz2 * NX + gx2, py2 - .13, py2 + .13);
          }
        }
      }
    });
    // nodes: one per (cell, floor height) with head room and no wall at body height in the cell or right beside it
    var node = [], nearW = [], ofs = new Int32Array(NX * NZ + 1);
    function blocked(c, h) { var w = walls[c]; if (!w) return false; for (var k = 0; k < w.length; k += 2) if (w[k + 1] > h + .3 && w[k] < h + 1.9) return true; return false; }
    for (var c = 0; c < NX * NZ; c++) {
      ofs[c] = node.length; var f = floors[c]; if (!f) continue; f.sort(function (a, b) { return a - b; });
      for (var k = 0; k < f.length; k++) {
        var h = f[k]; if (k + 1 < f.length && f[k + 1] - h < 2.1) continue;      // no head room under the next surface
        if (blocked(c, h)) continue;
        // how close the nearest wall is (in cells, up to 2); the route pays extra to pass near one, so it walks down the middle
        var gx = c % NX, gz = (c / NX) | 0, near = 3;
        for (var dx = -2; dx <= 2; dx++) for (var dz = -2; dz <= 2; dz++) { var x2 = gx + dx, z2 = gz + dz, r2 = Math.max(Math.abs(dx), Math.abs(dz)); if (r2 < near && x2 >= 0 && z2 >= 0 && x2 < NX && z2 < NZ && blocked(z2 * NX + x2, h)) near = r2; }
        node.push(c, h); nearW.push(near);
      }
    }
    ofs[NX * NZ] = node.length;
    // keep only the largest connected walkable area (street, site and every floor reached by ramps and stairs); stops snap onto it
    var comp = new Int32Array(node.length / 2).fill(-1), best = -1, bestN = 0, nc = 0;
    for (var s0 = 0; s0 < node.length; s0 += 2) {
      if (comp[s0 / 2] >= 0) continue; var st = [s0], n = 0; comp[s0 / 2] = nc;
      while (st.length) { var cur = st.pop(); n++; var cc = node[cur], hh = node[cur + 1], gx = cc % NX, gz = (cc / NX) | 0;
        for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) { var x = gx + dx, z = gz + dz; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue; var c2 = z * NX + x;
          for (var k2 = ofs[c2]; k2 < ofs[c2 + 1]; k2 += 2) if (comp[k2 / 2] < 0 && Math.abs(node[k2 + 1] - hh) <= STEP) { comp[k2 / 2] = nc; st.push(k2); } } }
      if (n > bestN) { bestN = n; best = nc; } nc++;
    }
    return { node: node, ofs: ofs, comp: comp, main: best, near: nearW };
  }
  function findPath(nav, from, to) {      // A* over the walkable nodes; from/to are [x, y, z] feet positions
    var node = nav.node, ofs = nav.ofs;
    function nearest(p) {
      var best = -1, bd = 1e9, gx = Math.floor((p[0] - X0) / CS), gz = Math.floor((p[2] - Z0) / CS);
      for (var r = 0; r < 14; r++) for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; var x = gx + dx, z = gz + dz; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue; var c = z * NX + x;
        for (var k = ofs[c]; k < ofs[c + 1]; k += 2) { if (nav.comp[k / 2] !== nav.main) continue; var d = Math.abs(node[k + 1] - p[1]) * 3 + r * CS; if (d < bd) { bd = d; best = k; } }
      }
      return best;
    }
    var s = nearest(from), t = nearest(to); if (s < 0 || t < 0) return null;
    var g = new Map(), prev = new Map(), heap = [[0, s]], tc = node[t], tx = tc % NX, tz = (tc / NX) | 0; g.set(s, 0);
    function push(e) { heap.push(e); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var q = heap[p]; heap[p] = heap[i]; heap[i] = q; i = p; } }
    function pop() { var top = heap[0], e = heap.pop(); if (heap.length) { heap[0] = e; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; var q = heap[m]; heap[m] = heap[i]; heap[i] = q; i = m; } } return top; }
    var it = 0;
    while (heap.length && it++ < 400000) {
      var cur = pop()[1]; if (cur === t) break; var c = node[cur], h = node[cur + 1], gx = c % NX, gz = (c / NX) | 0, gc = g.get(cur);
      for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue; var x = gx + dx, z = gz + dz; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue; var c2 = z * NX + x;
        for (var k = ofs[c2]; k < ofs[c2 + 1]; k += 2) {
          var dh = node[k + 1] - h; if (Math.abs(dh) > STEP) continue;
          var ng = gc + Math.hypot(dx, dz) * CS * (1 + [3, 1.6, .6, 0][nav.near[k / 2]]) + Math.abs(dh) * 1.5; if (g.has(k) && g.get(k) <= ng) continue;
          g.set(k, ng); prev.set(k, cur); push([ng + Math.hypot(x - tx, z - tz) * CS, k]);
        }
      }
    }
    if (!prev.has(t) && s !== t) return null;
    var out = [], k2 = t; while (k2 !== undefined) { var cc = node[k2]; out.push([X0 + (cc % NX + .5) * CS, node[k2 + 1], Z0 + ((cc / NX | 0) + .5) * CS]); if (k2 === s) break; k2 = prev.get(k2); }
    return out.reverse();
  }
  function smooth(pts, n) {               // soften the grid's zig-zag; heights smoothed more gently so stairs read as a climb
    for (var it = 0; it < n; it++) { var q = pts.map(function (p) { return p.slice(); }); for (var i = 1; i < pts.length - 1; i++) for (var a = 0; a < 3; a++) q[i][a] = (pts[i - 1][a] + 2 * pts[i][a] + pts[i + 1][a]) / 4; pts = q; }
    return pts;
  }
  function buildRoute(scene) {
    var nav = buildNav(scene), R2 = [], stops = [];
    for (var i = 0; i < K.length - 1; i++) {
      var a = K[i][1], b = K[i + 1][1], seg = findPath(nav, [a[0], a[1] - E, a[2]], [b[0], b[1] - E, b[2]]);
      if (!seg || seg.length < 2) seg = [[a[0], a[1] - E, a[2]], [b[0], b[1] - E, b[2]]];
      if (!R2.length) R2.push(seg[0]); stops.push(R2.length - 1); for (var j = 1; j < seg.length; j++) R2.push(seg[j]);
    }
    stops.push(R2.length - 1);
    R2 = smooth(R2, 6);
    var d = [0]; for (var k = 1; k < R2.length; k++) d.push(d[k - 1] + Math.hypot(R2[k][0] - R2[k - 1][0], (R2[k][1] - R2[k - 1][1]) * 2, R2[k][2] - R2[k - 1][2]));
    // timeline: walk at WALK m/s, pause at each named stop
    var T = [], t = 0; for (var s = 0; s < stops.length; s++) { var di = d[stops[s]]; if (s) t += (di - d[stops[s - 1]]) / WALK; T.push([t, di, s]); if (K[s][3]) t += PAUSE; T.push([t, di, s]); }
    return { pts: R2, d: d, stops: stops, T: T, total: t };
  }
  function onRoute(rt, time) {
    var T = rt.T, i = 0; while (i < T.length - 1 && T[i + 1][0] < time) i++;
    var a = T[i], b = T[Math.min(T.length - 1, i + 1)], u = b[0] > a[0] ? (time - a[0]) / (b[0] - a[0]) : 0; u = Math.max(0, Math.min(1, u)); u = u * u * (3 - 2 * u) * .3 + u * .7;
    var dist = a[1] + (b[1] - a[1]) * u, stop = a[2];
    function posAt(dd) { var d = rt.d, k = 0, lo = 0, hi = d.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (d[m] < dd) lo = m + 1; else hi = m; } k = Math.max(1, lo); var f = (dd - d[k - 1]) / ((d[k] - d[k - 1]) || 1); f = Math.max(0, Math.min(1, f)); var p = rt.pts[k - 1], q = rt.pts[k]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f]; }
    var p = posAt(dist), ahead = posAt(Math.min(rt.d[rt.d.length - 1], dist + 5));
    // look ahead along the walk, turning toward the stop's view as the walker arrives and while paused
    var next = Math.min(K.length - 1, stop + (a[1] === b[1] ? 0 : 1)), sd = rt.d[rt.stops[next]], near = Math.max(0, 1 - Math.abs(sd - dist) / 6), tg = K[next][2];
    var look = [ahead[0], ahead[1] + E, ahead[2]]; look = look.map(function (v, k) { return v + (tg[k] - v) * near; });
    return { eye: [p[0], p[1] + E, p[2]], look: look, stop: stop };
  }

  function init() {
    var ctx = window.daylightContext, cam = ctx.camera, ctl = ctx.controls, playing = false, s = 0, last = 0, saved = null, fov0 = cam.fov, hemi = null, hemi0 = 1, speed = 1, paused = false;
    var ref = Array.prototype.find.call(document.querySelectorAll('button'), function (b) { return /guided view/i.test(b.textContent); });
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Walk-through'; if (ref) btn.className = ref.className;
    if (ref && ref.parentElement) ref.parentElement.insertBefore(btn, ref); else { btn.style.cssText = 'position:fixed;right:16px;bottom:56px;z-index:20'; document.body.appendChild(btn); }
    var tag = document.createElement('div');
    tag.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:rgba(20,20,22,.78);color:#fff;font:600 13px/1.2 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:8px 14px;border-radius:999px;pointer-events:none;opacity:0;transition:opacity .5s;z-index:30';
    document.body.appendChild(tag);
    var bar = document.createElement('div'); bar.style.cssText = 'position:fixed;left:0;bottom:0;height:3px;background:#e0567f;width:0;z-index:30;pointer-events:none'; document.body.appendChild(bar);
    var lastLabel = -1, route = null, lookS = null, keys = {}, resumeBlend = 0, resumeFrom = null;
    addEventListener('keydown', function (e) { if (!playing || !paused || /input|textarea|select/i.test(e.target.tagName)) return; var k = e.key.toLowerCase(); if ('wasdqe'.indexOf(k) >= 0 && k.length === 1) { keys[k] = true; e.preventDefault(); } if (e.key === 'Shift') keys.shift = true; });
    addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); if (k.length === 1) keys[k] = false; if (e.key === 'Shift') keys.shift = false; });
    addEventListener('blur', function () { keys = {}; });
    function frame(now) {
      if (!playing) return;
      var dt = Math.min(.1, (now - last) / 1000); last = now;
      if (paused) {
        /* paused: the camera is yours. Drag to look around (orbit), W A S D to walk, Q / E to go down / up, Shift to hurry.
           Pressing play again glides back onto the tour. */
        var mvx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), mvz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), mvy = (keys.e ? 1 : 0) - (keys.q ? 1 : 0);
        if (mvx || mvz || mvy) {
          var fx = ctl.target.x - cam.position.x, fz = ctl.target.z - cam.position.z, fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
          var v = (keys.shift ? 7 : 2.6) * dt, dx = (fx * mvz - fz * mvx) * v, dz = (fz * mvz + fx * mvx) * v, dy = mvy * v;
          cam.position.x += dx; cam.position.y += dy; cam.position.z += dz; ctl.target.x += dx; ctl.target.y += dy; ctl.target.z += dz;
          ctl.update && ctl.update(); ctl.dispatchEvent({ type: 'change' });
        }
        requestAnimationFrame(frame); return;
      }
      if (resumeBlend > 0) resumeBlend = Math.max(0, resumeBlend - dt * 1.2);
      s += dt * speed;
      var p, q, LIST, li, total;
      if (mode === 'fly') {
        var f = at(s / FLYSLOW); p = f[0]; q = f[1]; LIST = FLY; li = f[2]; total = FLY[FLY.length - 1][0] * FLYSLOW;
      } else {
        var r = onRoute(route, s); p = r.eye;
        if (!lookS) lookS = r.look.slice(); var k = Math.min(1, dt * 2.2); for (var a = 0; a < 3; a++) lookS[a] += (r.look[a] - lookS[a]) * k;   // turn the head smoothly
        q = lookS; LIST = K; li = r.stop; total = route.total;
      }
      if (resumeBlend > 0 && resumeFrom) {   // after free roaming, glide back onto the tour instead of jumping
        var u = resumeBlend * resumeBlend; p = p.map(function (v2, i2) { return v2 + (resumeFrom.p[i2] - v2) * u; }); q = q.map(function (v2, i2) { return v2 + (resumeFrom.q[i2] - v2) * u; });
      }
      cam.position.set(p[0], p[1], p[2]); ctl.target.set(q[0], q[1], q[2]); cam.lookAt(q[0], q[1], q[2]); ctl.update && ctl.update(); ctl.dispatchEvent({ type: 'change' });
      while (li > 0 && !LIST[li][3]) li--;
      if (li !== lastLabel && LIST[li][3]) { lastLabel = li; tag.textContent = LIST[li][3]; tag.style.opacity = 1; clearTimeout(tag._t); tag._t = setTimeout(function () { tag.style.opacity = 0; }, 4000); }
      bar.style.width = (100 * s / total) + '%';
      if (s >= total) { stop(false); return; }
      requestAnimationFrame(frame);
    }
    var mode = 'walk';
    function startFly() { if (playing) stop(true); mode = 'fly'; begin(); flyBtn.textContent = 'Stop flight'; flyBtn.setAttribute('aria-pressed', 'true'); }
    function begin() {
      lookS = null;
      saved = { p: cam.position.clone(), t: ctl.target.clone(), near: cam.near }; cam.fov = 68; cam.near = .08; cam.updateProjectionMatrix();
      hemi = null; ctx.scene.traverse(function (o) { if (!hemi && o.isHemisphereLight) hemi = o; }); if (hemi) { hemi0 = hemi.intensity; hemi.intensity = hemi0 * 1.7; }
      playing = true; paused = false; s = 0; lastLabel = -1; last = performance.now(); ctl.enabled = false; requestAnimationFrame(frame);
    }
    var flyBtn = document.createElement('button'); flyBtn.type = 'button'; flyBtn.textContent = 'Fly-through'; if (ref) flyBtn.className = ref.className; btn.parentNode.insertBefore(flyBtn, btn.nextSibling);
    flyBtn.addEventListener('click', function () { playing && mode === 'fly' ? stop(true) : startFly(); });
    function start() {
      if (playing) stop(true); mode = 'walk';
      if (!route) { btn.textContent = 'Preparing walk…'; setTimeout(function () { var t0 = performance.now(); route = buildRoute(ctx.scene); window.nbycTour.route = route; window.nbycTour.buildMs = performance.now() - t0; start(); }, 30); return; }
      lookS = null;
      saved = { p: cam.position.clone(), t: ctl.target.clone(), near: cam.near }; cam.fov = 68; cam.near = .08; cam.updateProjectionMatrix();
      // indoors the sky light is all that reaches, so lift it while walking (the video's interiors read bright)
      hemi = null; ctx.scene.traverse(function (o) { if (!hemi && o.isHemisphereLight) hemi = o; }); if (hemi) { hemi0 = hemi.intensity; hemi.intensity = hemi0 * 1.7; }
      playing = true; paused = false; s = 0; lastLabel = -1; last = performance.now(); ctl.enabled = false; btn.textContent = 'Stop walk'; btn.setAttribute('aria-pressed', 'true'); requestAnimationFrame(frame);
    }
    function stop(restore) {
      playing = false; ctl.enabled = true; if (hemi) hemi.intensity = hemi0; cam.fov = fov0; if (saved) cam.near = saved.near; cam.updateProjectionMatrix(); btn.textContent = 'Walk-through'; btn.setAttribute('aria-pressed', 'false'); flyBtn.textContent = 'Fly-through'; flyBtn.setAttribute('aria-pressed', 'false'); bar.style.width = 0; tag.style.opacity = 0;
      if (restore && saved) { cam.position.copy(saved.p); ctl.target.copy(saved.t); ctl.update && ctl.update(); }
      ctl.dispatchEvent({ type: 'change' });
    }
    btn.addEventListener('click', function () { playing ? stop(true) : start(); });
    addEventListener('keydown', function (e) { if (playing && e.key === 'Escape') stop(true); });
    // for the player bar: where we are, how long it is, and the named stops as markers on the timeline
    function total() { return mode === 'fly' ? FLY[FLY.length - 1][0] * FLYSLOW : (route ? route.total : 0); }
    function markers() {
      if (mode === 'fly') return FLY.filter(function (k) { return k[3]; }).map(function (k) { return { t: k[0] * FLYSLOW, label: k[3] }; });
      if (!route) return [];
      var out = []; K.forEach(function (k, i) { if (!k[3]) return; for (var j = 0; j < route.T.length; j++) if (route.T[j][2] === i) { out.push({ t: route.T[j][0], label: k[3] }); break; } }); return out;
    }
    window.nbycTour = { keys: K, fly: FLY, start: start, startFly: startFly, stop: stop,
      seek: function (t) { s = Math.max(0, Math.min(total() - .05, t)); lookS = null; lastLabel = -1; },
      pause: function (p) {
        var was = paused; paused = p === undefined ? !paused : !!p; last = performance.now();
        if (paused && !was) { ctl.enabled = true; { var lx = ctl.target.x - cam.position.x, ly = ctl.target.y - cam.position.y, lz = ctl.target.z - cam.position.z, ll = Math.hypot(lx, ly, lz) || 1; ctl.target.set(cam.position.x + lx / ll * .4, cam.position.y + ly / ll * .4, cam.position.z + lz / ll * .4); ctl.update && ctl.update(); }   /* dragging turns the head in place */ tag.textContent = 'Paused: drag to look around, W A S D to walk'; tag.style.opacity = 1; clearTimeout(tag._t); tag._t = setTimeout(function () { tag.style.opacity = 0; }, 5000); }
        if (!paused && was) { ctl.enabled = false; keys = {}; resumeFrom = { p: cam.position.toArray(), q: ctl.target.toArray() }; resumeBlend = 1; lookS = null; }
      },
      setSpeed: function (v) { speed = v; },
      state: function () { return { playing: playing, paused: paused, mode: mode, t: s, total: total(), speed: speed, markers: markers() }; } };
  }
})();
