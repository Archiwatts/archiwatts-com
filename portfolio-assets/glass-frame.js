/* Glass with framing that came out of the export as one glass mesh: the frame members are long narrow strips, the panes are broad,
   so each triangle is sorted by its shape and the strips are given the frame material.
   Configure with window.GLASS_FRAME = [{ mesh: 'mesh name', frame: 'material name to borrow from the scene', width: .2 }]. */
(function () {
  var CFG = window.GLASS_FRAME || []; var SWAP = window.GLASS_SWAP || []; CFG.swap = SWAP;
  function ready() { var c = window.daylightContext; if (!c || !c.scene) return false; var ok = true; CFG.forEach(function (r) { if (!c.scene.getObjectByName(r.mesh)) ok = false; }); return ok; }
  // a rule may give `faces`: a JSON file of the Revit frame faces ({cm: [x,y,z,...] per triangle vertex, page axes, centimetres});
  // then a triangle is frame when its centre lies on one of those faces, instead of being guessed from its shape
  var FACES = {}, GFACES = {};
  (function wait(n) {
    if (ready()) { var urls = CFG.filter(function (r) { return r.faces; }); Promise.all(urls.map(function (r) { return fetch(r.faces).then(function (x) { return x.json(); }).then(function (j) { FACES[r.mesh] = j.cm.map(function (v) { return v / 100; }); }).catch(function () {}); }).concat(CFG.filter(function (r) { return r.glassFaces; }).map(function (r) { return fetch(r.glassFaces).then(function (x) { return x.json(); }).then(function (j) { GFACES[r.mesh] = j.cm.map(function (v) { return v / 100; }); }).catch(function () {}); }))).then(function () { setTimeout(run, 300); }); }
    else if (n < 300) setTimeout(function () { wait(n + 1); }, 300);
  })(0);
  function onFaces(T) {   // returns test(x,y,z): is the point on one of these triangles (within 3 cm)
    var G = 1, H = new Map();
    for (var i = 0; i < T.length; i += 9) { var x0 = Math.min(T[i], T[i + 3], T[i + 6]), x1 = Math.max(T[i], T[i + 3], T[i + 6]), z0 = Math.min(T[i + 2], T[i + 5], T[i + 8]), z1 = Math.max(T[i + 2], T[i + 5], T[i + 8]);
      for (var gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (var gz = Math.floor(z0 / G); gz <= Math.floor(z1 / G); gz++) { var k = gx + ',' + gz, L = H.get(k); if (!L) H.set(k, L = []); L.push(i); } }
    return function (px, py, pz) {
      var L = H.get(Math.floor(px / G) + ',' + Math.floor(pz / G)); if (!L) return false;
      for (var q = 0; q < L.length; q++) { var i = L[q], ax = T[i], ay = T[i + 1], az = T[i + 2], ux = T[i + 3] - ax, uy = T[i + 4] - ay, uz = T[i + 5] - az, vx = T[i + 6] - ax, vy = T[i + 7] - ay, vz = T[i + 8] - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz); if (nl < 1e-12) continue; nx /= nl; ny /= nl; nz /= nl;
        var wx = px - ax, wy = py - ay, wz = pz - az, dist = wx * nx + wy * ny + wz * nz; if (Math.abs(dist) > .03) continue;
        wx -= dist * nx; wy -= dist * ny; wz -= dist * nz; var uu = ux * ux + uy * uy + uz * uz, uv = ux * vx + uy * vy + uz * vz, vv = vx * vx + vy * vy + vz * vz, wu = wx * ux + wy * uy + wz * uz, wv = wx * vx + wy * vy + wz * vz, den = uv * uv - uu * vv;
        if (Math.abs(den) < 1e-14) continue; var s = (uv * wv - vv * wu) / den, t = (uv * wu - uu * wv) / den; if (s >= -.01 && t >= -.01 && s + t <= 1.01) return true; }
      return false;
    };
  }
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, mats = {}; scene.traverse(function (o) { if (o.isMesh && o.material && !Array.isArray(o.material)) mats[o.material.name] = o.material; });
    var done = [];
    (CFG.swap || []).forEach(function (s) { var o = scene.getObjectByName(s.mesh), m = mats[s.to]; if (o && m) o.material = m; });   // whole meshes that take another scene material
    CFG.forEach(function (r) {
      var o = scene.getObjectByName(r.mesh), fm = mats[r.frame]; if (!o || !fm || !o.geometry.index) return;
      o.updateMatrixWorld(); var g = o.geometry, p = g.attributes.position, ix = g.index.array, m = o.matrixWorld.elements, W = r.width || .2, glass = [], frame = [];
      function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
      // connected pieces (vertices welded by position): a piece is a frame member when it is long and narrow overall -- its surface
      // area over its length is small -- while panes are broad sheets
      var n = p.count, par = new Int32Array(n), key = new Map(); for (var i = 0; i < n; i++) { var w = V(i), k = Math.round(w[0] * 200) + ',' + Math.round(w[1] * 200) + ',' + Math.round(w[2] * 200), r0 = key.get(k); if (r0 === undefined) { key.set(k, i); par[i] = i; } else par[i] = r0; }
      function f(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
      for (var t0 = 0; t0 < ix.length; t0 += 3) { var q = f(ix[t0]); par[f(ix[t0 + 1])] = q; par[f(ix[t0 + 2])] = q; }
      var S = new Map();
      for (var t = 0; t < ix.length; t += 3) {
        var a = V(ix[t]), b = V(ix[t + 1]), c = V(ix[t + 2]), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], ar = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
        var rt = f(ix[t]), s = S.get(rt); if (!s) { s = { a: 0, b: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] }; S.set(rt, s); } s.a += ar; [a, b, c].forEach(function (v) { for (var j = 0; j < 3; j++) { if (v[j] < s.b[j]) s.b[j] = v[j]; if (v[j] > s.b[j + 3]) s.b[j + 3] = v[j]; } });
      }
      S.forEach(function (s) { var L = Math.hypot(s.b[3] - s.b[0], s.b[4] - s.b[1], s.b[5] - s.b[2]); s.frame = L > W * 4 && s.a / L < W * 2.6; });   // a box-section bar's surface is about 4 x its width x its length
      // bars fused into a glass sheet: also each long, narrow triangle of a sheet (short slivers from the panes' triangulation stay glass)
      // bars fused into a glass sheet: a narrow triangle whose edge-neighbours are all narrow too is part of a bar (bars are built only
      // of narrow faces); slivers from the panes' triangulation touch broad pane triangles and stay glass
      var nt = ix.length / 3, thin = new Uint8Array(nt), W2 = r.width || .2;
      for (var t1 = 0; t1 < nt; t1++) { var a1 = V(ix[t1 * 3]), b1 = V(ix[t1 * 3 + 1]), c1 = V(ix[t1 * 3 + 2]), L1 = Math.max(Math.hypot(a1[0] - b1[0], a1[1] - b1[1], a1[2] - b1[2]), Math.hypot(b1[0] - c1[0], b1[1] - c1[1], b1[2] - c1[2]), Math.hypot(c1[0] - a1[0], c1[1] - a1[1], c1[2] - a1[2]));
        var u1 = [b1[0] - a1[0], b1[1] - a1[1], b1[2] - a1[2]], v1 = [c1[0] - a1[0], c1[1] - a1[1], c1[2] - a1[2]], ar1 = Math.hypot(u1[1] * v1[2] - u1[2] * v1[1], u1[2] * v1[0] - u1[0] * v1[2], u1[0] * v1[1] - u1[1] * v1[0]); thin[t1] = L1 > W2 * 3 && ar1 / L1 < W2 ? 1 : 0; }
      var EM = new Map(); for (var t3 = 0; t3 < nt; t3++) for (var e = 0; e < 3; e++) { var va = f(ix[t3 * 3 + e]), vb = f(ix[t3 * 3 + (e + 1) % 3]), ek = va < vb ? va + ',' + vb : vb + ',' + va, L3 = EM.get(ek); if (!L3) EM.set(ek, L3 = []); L3.push(t3); }
      var ok = new Uint8Array(nt); for (var t4 = 0; t4 < nt; t4++) ok[t4] = thin[t4];
      EM.forEach(function (L4) { var any = L4.some(function (q) { return !thin[q]; }); if (any) L4.forEach(function (q) { ok[q] = 0; }); });
      var onF = FACES[r.mesh] ? onFaces(FACES[r.mesh]) : null, onG = r.drop && GFACES[r.mesh] ? onFaces(GFACES[r.mesh].concat(FACES[r.mesh] || [])) : null, dropped = 0;
      for (var t2 = 0; t2 < nt; t2++) {
        var isF, A6 = V(ix[t2 * 3]), B6 = V(ix[t2 * 3 + 1]), C6 = V(ix[t2 * 3 + 2]);
        if (onF) { var A5 = V(ix[t2 * 3]), B5 = V(ix[t2 * 3 + 1]), C5 = V(ix[t2 * 3 + 2]); isF = onF((A5[0] + B5[0] + C5[0]) / 3, (A5[1] + B5[1] + C5[1]) / 3, (A5[2] + B5[2] + C5[2]) / 3) && onF(A5[0], A5[1], A5[2]) && onF(B5[0], B5[1], B5[2]) && onF(C5[0], C5[1], C5[2]); }   // all three corners too: a glass triangle merely touching a rib stays glass
        else isF = S.get(f(ix[t2 * 3])).frame || ok[t2];
        if (!isF && onG && !onG((A6[0] + B6[0] + C6[0]) / 3, (A6[1] + B6[1] + C6[1]) / 3, (A6[2] + B6[2] + C6[2]) / 3)) { dropped++; continue; }   // glass that is not in the Revit element at all: removed
        (isF ? frame : glass).push(ix[t2 * 3], ix[t2 * 3 + 1], ix[t2 * 3 + 2]);
      }
      if (!frame.length) return;
      function part(L, mat, name) { var ng = new (g.constructor)(); Object.keys(g.attributes).forEach(function (k) { ng.setAttribute(k, g.attributes[k]); }); ng.setIndex(new (g.index.constructor)(p.count > 65535 ? new Uint32Array(L) : new Uint16Array(L), 1)); ng.boundingBox = g.boundingBox; ng.boundingSphere = g.boundingSphere; var mm = new (o.constructor)(ng, mat); mm.name = name; mm.position.copy(o.position); mm.quaternion.copy(o.quaternion); mm.scale.copy(o.scale); mm.castShadow = o.castShadow; mm.receiveShadow = o.receiveShadow; mm.renderOrder = o.renderOrder; o.parent.add(mm); return mm; }
      part(frame, fm, r.mesh + '_frame'); o.geometry = (function () { var ng = new (g.constructor)(); Object.keys(g.attributes).forEach(function (k) { ng.setAttribute(k, g.attributes[k]); }); ng.setIndex(new (g.index.constructor)(p.count > 65535 ? new Uint32Array(glass) : new Uint16Array(glass), 1)); ng.boundingBox = g.boundingBox; ng.boundingSphere = g.boundingSphere; return ng; })();
      done.push([r.mesh, glass.length / 3, frame.length / 3, dropped]);
    });
    ctx.controls.dispatchEvent({ type: 'change' }); window.glassFrame = done;
  }
})();
