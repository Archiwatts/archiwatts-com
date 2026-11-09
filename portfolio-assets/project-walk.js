/* Walk-through and fly-through for any project page (generalised from the North Beach Youth Center tour).
   Configure per page with window.PROJECT_WALK before this script:
     { eye: 1.6,                         eye height above the floor, metres
       walk: [[eye[x,y,z], look[x,y,z], 'Label' | null], ...]   stops for the eye-level walk (the route between them is pathfound)
       fly:  [[seconds, eye[x,y,z], look[x,y,z], 'Label' | null], ...]   keyframes for the free-flying camera
       step: .42,                        climbable rise per 0.5 m cell (.13 = ramps only)
       exclude: /regex/,                 mesh names the walkable map ignores
       ready: function () { return bool } extra readiness test (e.g. a model streamed in later) }
   Without a config the walk proposes its own stops (an arrival point outside, then the most open spot on each floor level) and the
   fly-through orbits the project and finishes on an overview.
   The walk builds a walkable map of the model (floors, ramps, stairs on a 0.5 m grid; walls, glass and railings as obstacles) and
   pathfinds between stops, so it keeps its feet on the floor, changes level only by ramp or stair, and never passes through a wall.
   API (window.projectWalk): start(), startFly(), stop(restore), pause(p), seek(t), setSpeed(v), state() -- used by the player bar. */
(function () {
  var CFG = window.PROJECT_WALK || {}, E = CFG.eye || 1.6, STEP = CFG.step || .42, WALK = CFG.walkSpeed || 1.2,   /* walkSpeed: a big campus glides faster */ PAUSE = 3.2, CS = .5, FLYSLOW = 1.25;
  var SKIPRE = /life|lines|ink|sketch|overlay|drape|lawn|helper|plan |ground line|outline|people|sprite|car/i;
  function ready() { var c = window.daylightContext; return c && c.controls && c.scene && c.camera && (!CFG.ready || CFG.ready()) && modelLoaded(c.scene); }
  var lastCount = -1, stable = 0;
  function modelLoaded(scene) {   // wait until the model has stopped streaming in (mesh count steady for a few checks)
    var n = 0; scene.traverse(function (o) { if (o.isMesh) n++; }); if (n === lastCount && n > 0) stable++; else stable = 0; lastCount = n; return stable >= 4;
  }
  (function wait() { if (ready()) init(); else setTimeout(wait, 500); })();

  function cr(p0, p1, p2, p3, t) { var t2 = t * t, t3 = t2 * t; return p1.map(function (_, i) { return .5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3); }); }

  // every model triangle in world space, fed to fn(ax,ay,az,bx,by,bz,cx,cy,cz, mesh)
  function eachTri(scene, fn, filter) {
    scene.traverse(function (o) {
      if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
      if ((o.userData && (o.userData.skEdge || o.userData.noWalk)) || SKIPRE.test(o.name || '') || (CFG.exclude && CFG.exclude.test(o.name || ''))) return;
      if (filter && !filter(o)) return;
      o.updateMatrixWorld(); var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, m = o.matrixWorld.elements, n = ix ? ix.length : p.count;
      var ident = m[0] === 1 && m[5] === 1 && m[10] === 1 && !m[12] && !m[13] && !m[14] && !m[1] && !m[2] && !m[4] && !m[6] && !m[8] && !m[9];
      var A = p.isInterleavedBufferAttribute ? null : p.array;
      function V(i, out) { var x, y, z; if (A && p.itemSize === 3) { x = A[i * 3]; y = A[i * 3 + 1]; z = A[i * 3 + 2]; } else { x = p.getX(i); y = p.getY(i); z = p.getZ(i); } if (ident) { out[0] = x; out[1] = y; out[2] = z; } else { out[0] = m[0] * x + m[4] * y + m[8] * z + m[12]; out[1] = m[1] * x + m[5] * y + m[9] * z + m[13]; out[2] = m[2] * x + m[6] * y + m[10] * z + m[14]; } }
      var a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
      for (var t = 0; t + 2 < n; t += 3) { V(ix ? ix[t] : t, a); V(ix ? ix[t + 1] : t + 1, b); V(ix ? ix[t + 2] : t + 2, c); fn(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], o); }
    });
  }
  function projectBox(scene) {   // the project's own extent (context meshes left out)
    var b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    scene.traverse(function (o) {
      if (!o.isMesh || !o.visible || /context/i.test(o.name || '') || SKIPRE.test(o.name || '') || (o.userData && o.userData.skEdge)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); o.updateMatrixWorld(); var bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (!isFinite(bb.min.x) || bb.max.x - bb.min.x > 5000) return;
      b[0] = Math.min(b[0], bb.min.x); b[1] = Math.min(b[1], bb.min.y); b[2] = Math.min(b[2], bb.min.z); b[3] = Math.max(b[3], bb.max.x); b[4] = Math.max(b[4], bb.max.y); b[5] = Math.max(b[5], bb.max.z);
    });
    // the page's own focus box (the building, not its whole terrain) when it gives one and it is smaller
    var f = window.projectModelInfo && window.projectModelInfo.focusBounds;
    if (f && (f.max[0] - f.min[0]) * (f.max[2] - f.min[2]) < (b[3] - b[0]) * (b[5] - b[2])) b = [f.min[0], Math.max(b[1], f.min[1]), f.min[2], f.max[0], Math.min(b[4], f.max[1]), f.max[2]];
    return b;
  }

  /* ---- the walkable map ---- */
  var X0, Z0, NX, NZ;
  function buildNav(scene, box) {
    var pad = 30; X0 = box[0] - pad; Z0 = box[2] - pad; NX = Math.min(1200, Math.ceil((box[3] - box[0] + 2 * pad) / CS)); NZ = Math.min(1200, Math.ceil((box[5] - box[2] + 2 * pad) / CS));
    var floors = new Array(NX * NZ), walls = new Array(NX * NZ);
    function addF(i, y) { var a = floors[i] || (floors[i] = []); for (var k = 0; k < a.length; k++) if (Math.abs(a[k] - y) < .12) { if (y > a[k]) a[k] = y; return; } a.push(y); }
    function addW(i, y0, y1) { (walls[i] || (walls[i] = [])).push(y0, y1); }
    eachTri(scene, function (ax, ay, az, bx, by, bz, cx, cy, cz, o) {
      var mat = o.material && !Array.isArray(o.material) ? o.material : null, glass = (mat && mat.transparent && mat.opacity < .7) || /glaz|glass/i.test(o.name || '') || /glaz|glass/i.test(mat && mat.name || ''), door = /door|sash|hardware/i.test(mat && mat.name || '');
      var ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz); if (l < 1e-8) return;
      var up = Math.abs(ny) / l, xmin = Math.min(ax, bx, cx), xmax = Math.max(ax, bx, cx), zmin = Math.min(az, bz, cz), zmax = Math.max(az, bz, cz);
      if (xmax < X0 || zmax < Z0 || xmin > X0 + NX * CS || zmin > Z0 + NZ * CS) return;
      if (up > .82 && !glass) {
        var d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) return;
        for (var gx = Math.max(0, Math.floor((xmin - X0) / CS)); gx <= Math.min(NX - 1, Math.floor((xmax - X0) / CS)); gx++) for (var gz = Math.max(0, Math.floor((zmin - Z0) / CS)); gz <= Math.min(NZ - 1, Math.floor((zmax - Z0) / CS)); gz++) {
          var px = X0 + (gx + .5) * CS, pz = Z0 + (gz + .5) * CS, l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
          if (l1 < -.02 || l2 < -.02 || l3 < -.02) continue; addF(gz * NX + gx, l1 * ay + l2 * by + l3 * cy);
        }
      } else if (up < .5 && !door) {
        var n = Math.min(400, Math.ceil(Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(cx - bx, cy - by, cz - bz)) / .25) + 1);
        for (var i = 0; i <= n; i++) for (var j = 0; j <= n - i; j++) {
          var s1 = i / n, s2 = j / n, px2 = ax + ux * s1 + vx * s2, py2 = ay + uy * s1 + vy * s2, pz2 = az + uz * s1 + vz * s2, gx2 = Math.floor((px2 - X0) / CS), gz2 = Math.floor((pz2 - Z0) / CS);
          if (gx2 < 0 || gz2 < 0 || gx2 >= NX || gz2 >= NZ) continue; addW(gz2 * NX + gx2, py2 - .13, py2 + .13);
        }
      }
    });
    var node = [], nearW = [], ofs = new Int32Array(NX * NZ + 1);
    function blocked(c, h) { var w = walls[c]; if (!w) return false; for (var k = 0; k < w.length; k += 2) if (w[k + 1] > h + .3 && w[k] < h + 1.9) return true; return false; }
    for (var c = 0; c < NX * NZ; c++) {
      ofs[c] = node.length; var f = floors[c]; if (!f) continue; f.sort(function (a, b) { return a - b; });
      for (var k = 0; k < f.length; k++) {
        var h = f[k]; if (k + 1 < f.length && f[k + 1] - h < 2.1) continue; if (blocked(c, h)) continue;
        var gx = c % NX, gz = (c / NX) | 0, near = 3;
        for (var dx = -2; dx <= 2; dx++) for (var dz = -2; dz <= 2; dz++) { var x2 = gx + dx, z2 = gz + dz, r2 = Math.max(Math.abs(dx), Math.abs(dz)); if (r2 < near && x2 >= 0 && z2 >= 0 && x2 < NX && z2 < NZ && blocked(z2 * NX + x2, h)) near = r2; }
        node.push(c, h); nearW.push(near);
      }
    }
    ofs[NX * NZ] = node.length;
    var comp = new Int32Array(node.length / 2).fill(-1), best = -1, bestN = 0, nc = 0;
    for (var s0 = 0; s0 < node.length; s0 += 2) {
      if (comp[s0 / 2] >= 0) continue; var st = [s0], cnt = 0; comp[s0 / 2] = nc;
      while (st.length) { var cur = st.pop(); cnt++; var cc = node[cur], hh = node[cur + 1], gx3 = cc % NX, gz3 = (cc / NX) | 0;
        for (var dx3 = -1; dx3 <= 1; dx3++) for (var dz3 = -1; dz3 <= 1; dz3++) { var x = gx3 + dx3, z = gz3 + dz3; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue; var c2 = z * NX + x;
          for (var k2 = ofs[c2]; k2 < ofs[c2 + 1]; k2 += 2) if (comp[k2 / 2] < 0 && Math.abs(node[k2 + 1] - hh) <= STEP) { comp[k2 / 2] = nc; st.push(k2); } } }
      if (cnt > bestN) { bestN = cnt; best = nc; } nc++;
    }
    return { node: node, ofs: ofs, comp: comp, main: best, near: nearW };
  }
  function findPath(nav, from, to) {
    var node = nav.node, ofs = nav.ofs;
    function nearest(p) {
      var best = -1, bd = 1e9, gx = Math.floor((p[0] - X0) / CS), gz = Math.floor((p[2] - Z0) / CS);
      for (var r = 0; r < 14; r++) for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; var x = gx + dx, z = gz + dz; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue; var c = z * NX + x;
        for (var k = ofs[c]; k < ofs[c + 1]; k += 2) { var d = Math.abs(node[k + 1] - p[1]) * 3 + r * CS + (nav.comp[k / 2] !== nav.main ? 1.5 : 0); if (d < bd) { bd = d; best = k; } }   // floors reached only by lift are allowed too
      }
      return best;
    }
    var s = nearest(from), t = nearest(to); if (s < 0 || t < 0) return null;
    var g = new Map(), prev = new Map(), heap = [[0, s]], tc = node[t], tx = tc % NX, tz = (tc / NX) | 0; g.set(s, 0);
    function push(e) { heap.push(e); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var q = heap[p]; heap[p] = heap[i]; heap[i] = q; i = p; } }
    function pop() { var top = heap[0], e = heap.pop(); if (heap.length) { heap[0] = e; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; var q = heap[m]; heap[m] = heap[i]; heap[i] = q; i = m; } } return top; }
    var it = 0;
    while (heap.length && it++ < 600000) {
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
    var out = [], k3 = t; while (k3 !== undefined) { var cc = node[k3]; out.push([X0 + (cc % NX + .5) * CS, node[k3 + 1], Z0 + ((cc / NX | 0) + .5) * CS]); if (k3 === s) break; k3 = prev.get(k3); }
    return out.reverse();
  }
  function smooth(pts, n) { for (var it = 0; it < n; it++) { var q = pts.map(function (p) { return p.slice(); }); for (var i = 1; i < pts.length - 1; i++) for (var a = 0; a < 3; a++) q[i][a] = (pts[i - 1][a] + 2 * pts[i][a] + pts[i + 1][a]) / 4; pts = q; } return pts; }

  // proposed stops when the page gives none: arrival outside, then the most open spot on each floor level
  function autoStops(nav, box) {
    var node = nav.node, lv = {}, cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
    for (var k = 0; k < node.length; k += 2) {
      var c = node[k], x = X0 + (c % NX + .5) * CS, z = Z0 + ((c / NX | 0) + .5) * CS, h = node[k + 1];
      var inside = x > box[0] && x < box[3] && z > box[2] && z < box[5]; if (!inside) continue;
      var key = Math.round(h / 1.5); (lv[key] || (lv[key] = [])).push([x, h, z, nav.near[k / 2]]);
    }
    var levels = Object.keys(lv).map(Number).filter(function (k2) { return lv[k2].length > 60; }).sort(function (a, b) { return a - b; });
    // one stop per real floor: buckets closer than 2.4 m are the same floor (keep the bigger), and at most ~10 floors, spread evenly
    var merged = []; levels.forEach(function (k2) { var last = merged[merged.length - 1]; if (last !== undefined && (k2 - last) * 1.5 < 2.4) { if (lv[k2].length > lv[last].length) merged[merged.length - 1] = k2; } else merged.push(k2); }); levels = merged;
    var MAXF = CFG.maxFloors || 10; if (levels.length > MAXF) { var pick = []; for (var q2 = 0; q2 < MAXF; q2++) pick.push(levels[Math.round(q2 * (levels.length - 1) / (MAXF - 1))]); levels = pick.filter(function (v2, i2, a2) { return a2.indexOf(v2) === i2; }); }
    var stops = [];
    // arrival: the walkable ground point outside the project closest to the middle of its longest side
    var long = box[3] - box[0] > box[5] - box[2], ap = long ? [cx, 0, box[2] - 6] : [box[0] - 6, 0, cz], ab = null, ad = 1e9;
    for (var k4 = 0; k4 < node.length; k4 += 2) { if (nav.comp[k4 / 2] !== nav.main) continue; var c4 = node[k4], x4 = X0 + (c4 % NX + .5) * CS, z4 = Z0 + ((c4 / NX | 0) + .5) * CS; var d4 = Math.hypot(x4 - ap[0], z4 - ap[2]) + Math.abs(node[k4 + 1] - box[1]) * 4; if (d4 < ad) { ad = d4; ab = [x4, node[k4 + 1], z4]; } }
    if (ab) stops.push([[ab[0], ab[1] + E, ab[2]], [cx, ab[1] + 4, cz], 'Arrival']);
    levels.forEach(function (key, i) {
      var pts = lv[key], best = null, bs = -1e9;
      pts.forEach(function (p) { var sc = p[3] * 2 - Math.hypot(p[0] - cx, p[2] - cz) * .15; if (sc > bs) { bs = sc; best = p; } });
      // named from the Revit levels when the page gives them (PROJECT_WALK.levels: [[height in page metres, 'Name'], ...])
      var nm = i ? 'Level ' + (i + 1) : 'Ground level'; if (CFG.levels && best) { var bl = null, bd2 = 1e9; CFG.levels.forEach(function (L) { var dd = Math.abs(L[0] - best[1]); if (dd < bd2) { bd2 = dd; bl = L[1]; } }); if (bl && bd2 < 1.6) nm = bl; }
      var dup = stops.filter(function (s0) { return s0[2] === nm || s0[2].indexOf(nm + ' (') === 0; }).length; if (dup) nm += ' (' + (dup + 1) + ')';
      if (best) stops.push([[best[0], best[1] + E, best[2]], [cx, best[1] + E, cz], nm]);
    });
    return stops;
  }
  function autoFly(box) {
    var cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2, cy = (box[1] + box[4]) / 2, R = Math.max(10, Math.hypot(box[3] - box[0], box[5] - box[2]) / 2), H = box[4] - box[1];
    var k = [], t = 0;
    k.push([t, [cx - R * 1.6, box[1] + 2.5, cz - R * 1.1], [cx, cy, cz], 'Approach']); t += 12;
    for (var i = 0; i <= 6; i++) { var a = Math.PI * 1.25 + i / 6 * Math.PI * 1.5; k.push([t, [cx + Math.cos(a) * R * 1.35, box[1] + H * (.4 + .5 * i / 6), cz + Math.sin(a) * R * 1.35], [cx, cy, cz], i === 3 ? 'All round' : null]); t += 9; }
    k.push([t, [cx + R * .3, box[4] + R * 1.1, cz + R * .9], [cx, box[1], cz], 'Overview']);
    return k;
  }

  function init() {
    var ctx = window.daylightContext, cam = ctx.camera, ctl = ctx.controls, scene = ctx.scene, playing = false, s = 0, last = 0, saved = null, fov0 = cam.fov, hemi = null, hemi0 = 1, speed = 1, paused = false;
    var box = projectBox(scene), K = CFG.walk || null, FLY = CFG.fly || autoFly(box), route = null, mode = 'walk';
    function at(t0) {
      var L = FLY, n = L.length; if (t0 <= 0) return [L[0][1], L[0][2], 0]; if (t0 >= L[n - 1][0]) return [L[n - 1][1], L[n - 1][2], n - 1];
      var i = 0; while (L[i + 1][0] < t0) i++; var a = L[Math.max(0, i - 1)], b = L[i], c = L[i + 1], d = L[Math.min(n - 1, i + 2)], t = (t0 - b[0]) / (c[0] - b[0]); t = t * t * (3 - 2 * t) * .35 + t * .65;
      return [cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t), i];
    }
    function buildRoute() {
      var nav = buildNav(scene, box); if (!K) K = autoStops(nav, box);
      var R2 = [], stops = [];
      for (var i = 0; i < K.length - 1; i++) {
        var a = K[i][0], b = K[i + 1][0], seg = findPath(nav, [a[0], a[1] - E, a[2]], [b[0], b[1] - E, b[2]]);
        // no stair or ramp joins the two floors: ride up like a lift at the start, then walk on along the new floor
        if (!seg || seg.length < 2) seg = Math.abs(a[1] - b[1]) > 1.5 ? [[a[0], a[1] - E, a[2]], [a[0], b[1] - E, a[2]], [b[0], b[1] - E, b[2]]] : [[a[0], a[1] - E, a[2]], [b[0], b[1] - E, b[2]]];
        if (!R2.length) R2.push(seg[0]); stops.push(R2.length - 1); for (var j = 1; j < seg.length; j++) R2.push(seg[j]);
      }
      if (K.length === 1) R2.push([K[0][0][0], K[0][0][1] - E, K[0][0][2]], [K[0][0][0] + .1, K[0][0][1] - E, K[0][0][2]]);
      stops.push(R2.length - 1); R2 = smooth(R2, 6);
      var d = [0]; for (var k = 1; k < R2.length; k++) d.push(d[k - 1] + Math.hypot(R2[k][0] - R2[k - 1][0], (R2[k][1] - R2[k - 1][1]) * 2, R2[k][2] - R2[k - 1][2]));
      var T = [], t = 0; for (var s2 = 0; s2 < stops.length; s2++) { var di = d[stops[s2]]; if (s2) t += (di - d[stops[s2 - 1]]) / WALK; T.push([t, di, s2]); if (K[s2] && K[s2][2]) t += PAUSE; T.push([t, di, s2]); }
      return { pts: R2, d: d, stops: stops, T: T, total: Math.max(t, 1) };
    }
    function onRoute(rt, time) {
      var T = rt.T, i = 0; while (i < T.length - 1 && T[i + 1][0] < time) i++;
      var a = T[i], b = T[Math.min(T.length - 1, i + 1)], u = b[0] > a[0] ? (time - a[0]) / (b[0] - a[0]) : 0; u = Math.max(0, Math.min(1, u)); u = u * u * (3 - 2 * u) * .3 + u * .7;
      var dist = a[1] + (b[1] - a[1]) * u, stop = a[2];
      function posAt(dd) { var d = rt.d, lo = 0, hi = d.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (d[m] < dd) lo = m + 1; else hi = m; } var k = Math.max(1, lo), f = (dd - d[k - 1]) / ((d[k] - d[k - 1]) || 1); f = Math.max(0, Math.min(1, f)); var p = rt.pts[k - 1], q = rt.pts[k]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f]; }
      var p = posAt(dist), ahead = posAt(Math.min(rt.d[rt.d.length - 1], dist + 5));
      var next = Math.min(K.length - 1, stop + (a[1] === b[1] ? 0 : 1)), sd = rt.d[rt.stops[next]], near = Math.max(0, 1 - Math.abs(sd - dist) / 6), tg = K[next][1];
      var look = [ahead[0], ahead[1] + E, ahead[2]].map(function (v, k) { return v + (tg[k] - v) * near; });
      return { eye: [p[0], p[1] + E, p[2]], look: look, stop: stop };
    }
    var tag = document.createElement('div');
    tag.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:rgba(20,20,22,.78);color:#fff;font:600 13px/1.2 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:8px 14px;border-radius:999px;pointer-events:none;opacity:0;transition:opacity .5s;z-index:30';
    document.body.appendChild(tag);
    var lastLabel = -1, lookS = null, keys = {}, resumeBlend = 0, resumeFrom = null;
    addEventListener('keydown', function (e) { if (!playing || !paused || /input|textarea|select/i.test(e.target.tagName)) return; var k = e.key.toLowerCase(); if ('wasdqe'.indexOf(k) >= 0 && k.length === 1) { keys[k] = true; e.preventDefault(); } if (e.key === 'Shift') keys.shift = true; });
    addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); if (k.length === 1) keys[k] = false; if (e.key === 'Shift') keys.shift = false; });
    addEventListener('blur', function () { keys = {}; });
    function list() { return mode === 'fly' ? FLY.map(function (k) { return [k[1], k[2], k[3]]; }) : K; }
    function total() { return mode === 'fly' ? FLY[FLY.length - 1][0] * FLYSLOW : (route ? route.total : 0); }
    function frame(now) {
      if (!playing) return;
      var dt = Math.min(.1, (now - last) / 1000); last = now;
      if (paused) {
        var mvx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), mvz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), mvy = (keys.e ? 1 : 0) - (keys.q ? 1 : 0);
        if (mvx || mvz || mvy) {
          var fx = ctl.target.x - cam.position.x, fz = ctl.target.z - cam.position.z, fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
          var v = (keys.shift ? 7 : 2.6) * dt, dx = (fx * mvz - fz * mvx) * v, dz = (fz * mvz + fx * mvx) * v, dy = mvy * v;
          cam.position.x += dx; cam.position.y += dy; cam.position.z += dz; ctl.target.x += dx; ctl.target.y += dy; ctl.target.z += dz; ctl.update && ctl.update(); ctl.dispatchEvent({ type: 'change' });
        }
        requestAnimationFrame(frame); return;
      }
      if (resumeBlend > 0) resumeBlend = Math.max(0, resumeBlend - dt * 1.2);
      s += dt * speed;
      var p, q, li, L = list();
      if (mode === 'fly') { var f = at(s / FLYSLOW); p = f[0]; q = f[1]; li = f[2]; }
      else { var r = onRoute(route, s); p = r.eye; if (!lookS) lookS = r.look.slice(); var k = Math.min(1, dt * 2.2); for (var a = 0; a < 3; a++) lookS[a] += (r.look[a] - lookS[a]) * k; q = lookS; li = r.stop; }
      if (resumeBlend > 0 && resumeFrom) { var u = resumeBlend * resumeBlend; p = p.map(function (v2, i2) { return v2 + (resumeFrom.p[i2] - v2) * u; }); q = q.map(function (v2, i2) { return v2 + (resumeFrom.q[i2] - v2) * u; }); }
      cam.position.set(p[0], p[1], p[2]); ctl.target.set(q[0], q[1], q[2]); cam.lookAt(q[0], q[1], q[2]); ctl.update && ctl.update(); ctl.dispatchEvent({ type: 'change' });
      while (li > 0 && !L[li][2]) li--;
      if (li !== lastLabel && L[li] && L[li][2]) { lastLabel = li; tag.textContent = L[li][2]; tag.style.opacity = 1; clearTimeout(tag._t); tag._t = setTimeout(function () { tag.style.opacity = 0; }, 4000); }
      if (s >= total()) { stop(false); return; }
      requestAnimationFrame(frame);
    }
    function begin(m) {
      if (playing) stop(true); mode = m; lookS = null;
      saved = { p: cam.position.clone(), t: ctl.target.clone(), near: cam.near }; cam.fov = 68; cam.near = .08; cam.updateProjectionMatrix();
      hemi = null; scene.traverse(function (o) { if (!hemi && o.isHemisphereLight) hemi = o; }); if (hemi) { hemi0 = hemi.intensity; hemi.intensity = hemi0 * 1.5; }
      playing = true; paused = false; s = 0; lastLabel = -1; last = performance.now(); ctl.enabled = false; requestAnimationFrame(frame); notify();
    }
    var preparing = false;
    function start() {
      if (!route) { preparing = true; notify(); setTimeout(function () { var t0 = performance.now(); route = buildRoute(); api.route = route; api.stops = K; api.buildMs = performance.now() - t0; preparing = false; begin('walk'); }, 30); return; }
      begin('walk');
    }
    function startFly() { begin('fly'); }
    function stop(restore) {
      playing = false; paused = false; ctl.enabled = true; if (hemi) hemi.intensity = hemi0; cam.fov = fov0; if (saved) cam.near = saved.near; cam.updateProjectionMatrix(); tag.style.opacity = 0;
      if (restore && saved) { cam.position.copy(saved.p); ctl.target.copy(saved.t); ctl.update && ctl.update(); }
      ctl.dispatchEvent({ type: 'change' }); notify();
    }
    addEventListener('keydown', function (e) { if (playing && e.key === 'Escape') stop(true); });
    function markers() {
      if (mode === 'fly') return FLY.filter(function (k) { return k[3]; }).map(function (k) { return { t: k[0] * FLYSLOW, label: k[3] }; });
      if (!route) return []; var out = []; K.forEach(function (k, i) { if (!k[2]) return; for (var j = 0; j < route.T.length; j++) if (route.T[j][2] === i) { out.push({ t: route.T[j][0], label: k[2] }); break; } }); return out;
    }
    var listeners = []; function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
    var api = window.projectWalk = { box: box, fly: FLY, start: start, startFly: startFly, stop: stop, onChange: function (f) { listeners.push(f); },
      seek: function (t) { s = Math.max(0, Math.min(total() - .05, t)); lookS = null; lastLabel = -1; },
      pause: function (p) { var was = paused; paused = p === undefined ? !paused : !!p; last = performance.now();
        if (paused && !was) { ctl.enabled = true; tag.textContent = 'Paused: drag to look around, W A S D to walk'; tag.style.opacity = 1; clearTimeout(tag._t); tag._t = setTimeout(function () { tag.style.opacity = 0; }, 5000); }
        if (!paused && was) { ctl.enabled = false; keys = {}; resumeFrom = { p: cam.position.toArray(), q: ctl.target.toArray() }; resumeBlend = 1; lookS = null; } notify(); },
      setSpeed: function (v) { speed = v; },
      state: function () { return { playing: playing, preparing: preparing, paused: paused, mode: mode, t: s, total: total(), speed: speed, markers: markers() }; } };
    notify();
  }
})();
