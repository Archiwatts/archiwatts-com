/* North Beach Youth Center: bold ink outlines, for the massing-model look.
   - The project and the Revit-linked neighbours: feature edges precomputed from the model (tools/revit_edges.py ->
     revit-edges.bin.gz, split into "project" and "context").
   - The far site context (one mesh in the site model): its feature edges worked out here at load.
   Lines are thick strips drawn in screen space (a few pixels wide whatever the distance), the same way the site's sketch
   outlines are drawn. Realistic mode outlines the context only (a basswood study model around the real building); Diagram
   mode outlines everything; Watercolor shows none. */
(function () {
  function ready() { return window.daylightContext && window.nbycIfc && window.sketchStyle; }
  (function wait() { if (ready()) setTimeout(init, 400); else setTimeout(wait, 300); })();

  var ANGLE = Math.cos(55 * Math.PI / 180);
  function init() {
    var ctx = window.daylightContext, scene = ctx.scene, any = null;
    scene.traverse(function (o) { if (!any && o.isMesh && o.userData.ifc) any = o; });
    if (!any) return;
    var Mesh = any.constructor, BG = any.geometry.constructor, Attr = any.geometry.attributes.position.constructor;
    var U = { uRes: { value: [1, 1] }, uMinW: { value: 2 }, uMaxW: { value: 5 }, uWorldW: { value: .5 }, uInk: { value: [.3, .3, .31] }   /* dark grey, so the context reads quieter than the building */ };
    var std = any.material; var mat = new (std.constructor)(); mat.name = 'Hive sketch NBYC ink'; mat.side = 2; mat.fog = false;
    mat.onBeforeCompile = function (shader) {
      Object.keys(U).forEach(function (k) { shader.uniforms[k] = U[k]; });
      shader.vertexShader = 'attribute vec3 other; attribute vec2 side; attribute float elen; uniform vec2 uRes; uniform float uMinW; uniform float uMaxW; uniform float uWorldW;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);')
        .replace('#include <project_vertex>',
          'vec4 a4 = modelViewMatrix * vec4(position, 1.0), b4 = modelViewMatrix * vec4(other, 1.0); a4.z += .06 + .003 * abs(a4.z); b4.z += .06 + .003 * abs(b4.z);   /* more lift with distance, so lines at ground level stay visible */ vec4 mvPosition = a4;\n' +
          'float nz = -.2; bool gone = a4.z > nz && b4.z > nz; if (!gone) { if (a4.z > nz) a4 = a4 + (b4 - a4) * ((nz - a4.z) / (b4.z - a4.z)); else if (b4.z > nz) b4 = b4 + (a4 - b4) * ((nz - b4.z) / (a4.z - b4.z)); }\n' +
          'vec4 ca = projectionMatrix * a4, cb = projectionMatrix * b4; vec2 sa = ca.xy / ca.w, sb = cb.xy / cb.w; vec2 dir = (sb - sa) * uRes; float dl = length(dir); dir = dl > 1e-5 ? dir / dl : vec2(1., 0.);\n' +
          'vec2 nrm = vec2(-dir.y, dir.x); float focal = projectionMatrix[1][1] * uRes.y * .5;\n' +
          // weight follows distance and the edge's own size: a long mass edge keeps a fine line far out, short detail edges thin away and
          // vanish once they are only a few pixels long on screen, so zoomed out you see the masses, zoomed in the detail comes back
          'float imp = clamp(elen / 8., .25, 1.); float wpx = min(uWorldW * imp * focal / max(.5, -a4.z), uMaxW); float minPx = mix(26., 6., imp);\n' +
          'if (wpx < uMinW * .45 || dl < minPx) gone = true; wpx = max(wpx, uMinW * .6);\n' +
          'vec4 cc = ca; cc.xy += nrm * side.x * wpx / uRes * cc.w; if (gone) cc = vec4(2., 2., 2., 1.); gl_Position = cc;');
      shader.fragmentShader = 'uniform vec3 uInk;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor = vec4(uInk, 1.0);');
    };
    mat.customProgramCacheKey = function () { return 'nbyc-ink'; };
    // each edge becomes a strip of 4 vertices: both ends, both sides; "other" is the opposite end
    function strips(E, n, name) {
      var P = new Float32Array(n * 12), O = new Float32Array(n * 12), S = new Float32Array(n * 8), LN = new Float32Array(n * 4), I = new Uint32Array(n * 6);
      for (var e = 0; e < n; e++) {
        var a = [E[e * 6], E[e * 6 + 1], E[e * 6 + 2]], b = [E[e * 6 + 3], E[e * 6 + 4], E[e * 6 + 5]];
        [[a, b, -1], [a, b, 1], [b, a, 1], [b, a, -1]].forEach(function (v, k) { var j = (e * 4 + k) * 3; P[j] = v[0][0]; P[j + 1] = v[0][1]; P[j + 2] = v[0][2]; O[j] = v[1][0]; O[j + 1] = v[1][1]; O[j + 2] = v[1][2]; S[(e * 4 + k) * 2] = v[2]; });
        var el = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); LN[e * 4] = LN[e * 4 + 1] = LN[e * 4 + 2] = LN[e * 4 + 3] = el;
        var q = e * 4; I.set([q, q + 1, q + 2, q, q + 2, q + 3], e * 6);
      }
      var g = new BG(); g.setAttribute('position', new Attr(P, 3)); g.setAttribute('other', new Attr(O, 3)); g.setAttribute('side', new Attr(S, 2)); g.setAttribute('elen', new Attr(LN, 1)); g.setIndex(new Attr(I, 1));
      var m = new Mesh(g, mat); m.name = name; m.frustumCulled = false; m.renderOrder = 4; m.userData.skEdge = true; m.visible = false; scene.add(m);
      m.onBeforeRender = function (r) { var c = r.domElement, pr = c.width / Math.max(1, c.clientWidth); U.uRes.value = [c.width, c.height]; U.uMinW.value = 1.4 * pr; U.uMaxW.value = 3.2 * pr; };
      return m;
    }
    var groups = { project: [], context: [] };
    // 1. precomputed Revit edges
    fetch('revit-edges.bin.gz?v=2').then(function (r) { return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }).then(function (buf) {
      var hl = new DataView(buf).getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), q = new Int16Array(buf.slice(4 + hl));
      var mn = h.min, rg = [h.max[0] - mn[0], h.max[1] - mn[1], h.max[2] - mn[2]];
      Object.keys(h.groups).forEach(function (k) {
        var s = h.groups[k][0], n = h.groups[k][1], E = new Float32Array(n * 6);
        for (var i = 0; i < n * 6; i++) { var ax = i % 3; E[i] = (q[s * 6 + i] + 32767) / 65534 * rg[ax] + mn[ax]; }
        groups[k].push(strips(E, n, 'NBYC ink ' + k));
      });
      apply();
    });
    // 2. the far site context mesh: its feature edges, worked out here
    scene.traverse(function (o) {
      if (!o.isMesh || !/^Site_context__/.test(o.name) || !o.geometry.index) return;
      o.updateMatrixWorld(); var p = o.geometry.attributes.position, ix = o.geometry.index.array, mw = o.matrixWorld.elements, n = p.count, W = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); W[i * 3] = mw[0] * x + mw[4] * y + mw[8] * z + mw[12]; W[i * 3 + 1] = mw[1] * x + mw[5] * y + mw[9] * z + mw[13]; W[i * 3 + 2] = mw[2] * x + mw[6] * y + mw[10] * z + mw[14]; }
      var key = new Map(), id = new Int32Array(n), P = [];   // weld coincident vertices
      for (var v = 0; v < n; v++) { var k = Math.round(W[v * 3] * 50) + ',' + Math.round(W[v * 3 + 1] * 50) + ',' + Math.round(W[v * 3 + 2] * 50); var r = key.get(k); if (r === undefined) { r = P.length / 3; key.set(k, r); P.push(W[v * 3], W[v * 3 + 1], W[v * 3 + 2]); } id[v] = r; }
      var nt = ix.length / 3, N = new Float32Array(nt * 3), edges = new Map(), out = [], steep = [];
      for (var t = 0; t < nt; t++) {
        var a = id[ix[t * 3]], b = id[ix[t * 3 + 1]], c = id[ix[t * 3 + 2]]; if (a === b || b === c || a === c) continue;
        var ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; N[t * 3] = nx / l; N[t * 3 + 1] = ny / l; N[t * 3 + 2] = nz / l;
        [[a, b], [b, c], [c, a]].forEach(function (e) { var k2 = e[0] < e[1] ? e[0] + '_' + e[1] : e[1] + '_' + e[0], f = edges.get(k2); if (f === undefined) edges.set(k2, t); else if (f >= 0) { var d = N[f * 3] * N[t * 3] + N[f * 3 + 1] * N[t * 3 + 1] + N[f * 3 + 2] * N[t * 3 + 2]; if (d < ANGLE) { out.push(e[0], e[1]); steep.push(Math.min(Math.abs(N[f * 3 + 1]), Math.abs(N[t * 3 + 1])) < .5); } edges.set(k2, -1); } });
      }
      edges.forEach(function (f, k2) { if (f >= 0) { var s = k2.split('_'); out.push(+s[0], +s[1]); steep.push(Math.abs(N[f * 3 + 1]) < .5); } });   // open edges
      var E = [];
      for (var j = 0; j < out.length; j += 2) { var A = out[j] * 3, B = out[j + 1] * 3, hi = Math.max(P[A + 1], P[B + 1]);
        // keep the line where a wall meets the ground (an edge at grade on a wall face); drop flat ground, kerb and road edges
        if (hi < 34.3 || (hi < 34.95 && !steep[j / 2])) continue; if (Math.hypot(P[A] - P[B], P[A + 1] - P[B + 1], P[A + 2] - P[B + 2]) < .25) continue; E.push(P[A], P[A + 1], P[A + 2], P[B], P[B + 1], P[B + 2]); }
      if (E.length) groups.context.push(strips(new Float32Array(E), E.length / 6, 'NBYC ink site context'));
    });
    /* 3. the ground line: where a context wall passes through the ground there is no edge in the mesh, so it's computed here --
       every near-vertical face outside the site that crosses ground level is cut just above the paving, and the cut becomes a line */
    (function groundLine() {
      var GY = 34.68, E = [];
      function cut(ax, ay, az, bx, by, bz, cx, cy, cz) {
        var lo = Math.min(ay, by, cy), hi = Math.max(ay, by, cy); if (lo > GY || hi < GY) return;
        var ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
        if (l < 1e-9 || Math.abs(ny) / l > .5) return;
        var mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3; if (mx > -95 && mx < 9.5 && mz > 17.5 && mz < 78.2) return;   // the site itself: no
        var V = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]], pts = [];
        for (var e = 0; e < 3; e++) { var p = V[e], q = V[(e + 1) % 3]; if ((p[1] - GY) * (q[1] - GY) < 0) { var t = (GY - p[1]) / (q[1] - p[1]); pts.push(p[0] + (q[0] - p[0]) * t, GY, p[2] + (q[2] - p[2]) * t); } }
        if (pts.length === 6 && Math.hypot(pts[0] - pts[3], pts[2] - pts[5]) > .05) E.push.apply(E, pts);
      }
      scene.traverse(function (o) {
        if (!o.isMesh || !o.geometry.attributes.position) return;
        var isCtx = /^Site_context__/.test(o.name), isRevit = !!o.userData.ifc && !/Glazing/.test(o.name); if (!isCtx && !isRevit) return;
        o.updateMatrixWorld(); var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, mw = o.matrixWorld.elements, n = ix ? ix.length : p.count;
        var bb = o.geometry.boundingBox; if (isRevit && bb && bb.min.x > -95 && bb.max.x < 9.5 && bb.min.z > 17.5 && bb.max.z < 78.2) return;
        function W(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [mw[0] * x + mw[4] * y + mw[8] * z + mw[12], mw[1] * x + mw[5] * y + mw[9] * z + mw[13], mw[2] * x + mw[6] * y + mw[10] * z + mw[14]]; }
        for (var t = 0; t < n; t += 3) { var a = W(ix ? ix[t] : t), b = W(ix ? ix[t + 1] : t + 1), c = W(ix ? ix[t + 2] : t + 2); cut(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
      });
      if (E.length) groups.context.push(strips(new Float32Array(E), E.length / 6, 'NBYC ink ground line'));
    })();
    function apply() {
      var mode = document.documentElement.getAttribute('data-sk') || 'realistic';
      groups.context.forEach(function (m) { m.visible = mode !== 'watercolor'; });
      groups.project.forEach(function (m) { m.visible = mode === 'diagram'; });
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sk'] });
    apply();
    window.nbycInk = { groups: groups, u: U, apply: apply };
  }
})();
