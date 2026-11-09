/* Replaces a decimated web mesh with the exact faces from Revit (revit_faces.py), so curved roofs and openings come out smooth.
   Configure with window.REVIT_REPLACE = [{ mesh: 'name in the scene', file: 'faces.json', key: 'revit element id',
   materials: { 'Revit material name': 'scene material name' }, smooth: 35 }].
   The JSON is { id: { material: [x,y,z, ...] } } in page metres. Vertices are welded and shaded smooth across edges flatter than
   `smooth` degrees (a curved roof reads curved, its edges stay crisp). */
(function () {
  var CFG = window.REVIT_REPLACE || [];
  function ready() { var c = window.daylightContext; if (!c || !c.scene) return false; return CFG.every(function (r) { return c.scene.getObjectByName(r.mesh); }); }
  (function wait(n) { if (ready()) run(); else if (n < 300) setTimeout(function () { wait(n + 1); }, 300); })(0);
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, mats = {};
    scene.traverse(function (o) { if (o.isMesh && o.material && !Array.isArray(o.material)) mats[o.material.name] = o.material; });
    CFG.forEach(function (r) {
      fetch(r.file).then(function (x) { return x.json(); }).then(function (J) {
        var src = scene.getObjectByName(r.mesh), E = J[r.key]; if (!src || !E) return;
        var BG = src.geometry.constructor, Attr = src.geometry.attributes.position.constructor;
        function plain(C) { try { var q = new Float32Array(3); return new C(q, 1).array === q; } catch (e) { return false; } }
        if (!plain(Attr)) scene.traverse(function (o) { if (o.isMesh && o.geometry.index && plain(o.geometry.index.constructor)) Attr = o.geometry.index.constructor; });
        var cosT = Math.cos((r.smooth || 35) * Math.PI / 180), made = [];
        Object.keys(E).forEach(function (name) {
          var mat = mats[(r.materials || {})[name] || name]; if (!mat) return;
          var T = E[name], sc = J.scale || 1, key = new Map(), P = [], I = [];
          for (var i = 0; i < T.length; i += 3) { var k = Math.round(T[i] * sc * 1000) + ',' + Math.round(T[i + 1] * sc * 1000) + ',' + Math.round(T[i + 2] * sc * 1000), id = key.get(k); if (id === undefined) { id = P.length / 3; key.set(k, id); P.push(T[i] * sc, T[i + 1] * sc, T[i + 2] * sc); } I.push(id); }
          // smooth normals with a crease angle: each corner of a triangle averages the neighbours (at the same point) that are not turned more than `smooth` degrees from it
          var nt = I.length / 3, FN = new Float32Array(nt * 3), at = new Map();
          for (var t = 0; t < nt; t++) { var a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; FN[t * 3] = nx / l; FN[t * 3 + 1] = ny / l; FN[t * 3 + 2] = nz / l; for (var k2 = 0; k2 < 3; k2++) { var v = I[t * 3 + k2], L = at.get(v); if (!L) at.set(v, L = []); L.push(t); } }
          var pos = new Float32Array(nt * 9), nrm = new Float32Array(nt * 9);
          for (var t2 = 0; t2 < nt; t2++) for (var k3 = 0; k3 < 3; k3++) {
            var vi = I[t2 * 3 + k3], sx = 0, sy = 0, sz = 0; at.get(vi).forEach(function (q) { if (FN[q * 3] * FN[t2 * 3] + FN[q * 3 + 1] * FN[t2 * 3 + 1] + FN[q * 3 + 2] * FN[t2 * 3 + 2] >= cosT) { sx += FN[q * 3]; sy += FN[q * 3 + 1]; sz += FN[q * 3 + 2]; } });
            var sl = Math.hypot(sx, sy, sz) || 1, o2 = (t2 * 3 + k3) * 3; pos[o2] = P[vi * 3]; pos[o2 + 1] = P[vi * 3 + 1]; pos[o2 + 2] = P[vi * 3 + 2]; nrm[o2] = sx / sl; nrm[o2 + 1] = sy / sl; nrm[o2 + 2] = sz / sl;
          }
          var g = new BG(); g.setAttribute('position', new Attr(pos, 3)); g.setAttribute('normal', new Attr(nrm, 3));
          var m = new src.constructor(g, mat); m.name = r.mesh + '_revit'; m.castShadow = src.castShadow; m.receiveShadow = src.receiveShadow; m.renderOrder = src.renderOrder;
          // page-metre coordinates are world coordinates: carry the source mesh's parent transform back out
          src.updateMatrixWorld(true); if (src.parent) { src.parent.updateMatrixWorld(true); var inv = src.parent.matrixWorld.clone().invert(); m.applyMatrix4(inv); } src.parent.add(m); made.push(m);
        });
        if (made.length) src.visible = false;
        ctx.controls.dispatchEvent({ type: 'change' }); (window.revitReplace = window.revitReplace || []).push([r.mesh, made.length]);
      });
    });
  }
})();
