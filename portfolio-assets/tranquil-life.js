/* Tranquil River: clear rippling water over the spring bed, the Hive's sketch people walking the decks and banks, swimmers in the
   spring, and a Diagram view that colours each of the eight zones. Walkable ground and open water are read from the model itself. */
(function () {
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.SketchPeople; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Tranquil life skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();
  function srand(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function attrClass(g) {
    var found = null, nor = g.attributes.normal;
    [g.index && g.index.constructor, g.index && Object.getPrototypeOf(g.index.constructor), nor && nor.constructor].forEach(function (C) {
      if (found || typeof C !== 'function') return; try { var a = new Float32Array(4), p = new C(a, 2); if (p.array === a && p.itemSize === 2) found = C; } catch (e) {}
    });
    return found;
  }
  // world-space triangles of a mesh (including each copy of an instanced mesh)
  function eachTri(o, cb) {
    var g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count; o.updateWorldMatrix(true, false);
    var mats = [];
    if (o.isInstancedMesh) { for (var k = 0; k < o.count; k++) { var M = o.matrixWorld.clone(), Mi = M.clone(); o.getMatrixAt(k, Mi); mats.push(M.multiply(Mi).elements); } } else mats.push(o.matrixWorld.elements);
    mats.forEach(function (e) {
      function w(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
      for (var t = 0; t < n; t += 3) cb(w(I ? I.getX(t) : t), w(I ? I.getX(t + 1) : t + 1), w(I ? I.getX(t + 2) : t + 2));
    });
  }
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, mobile = !!(window.modelPerformance && window.modelPerformance.mobile);
    var ref = null, std = null, Tex = null;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.index || o.isInstancedMesh) return; if (!ref) ref = o;
      var m = Array.isArray(o.material) ? o.material[0] : o.material;
      // a solid one (copies start from it); the model's solid materials may load as physical materials, which is fine
      if (m && m.isMeshStandardMaterial && !m.transparent && (!std || (std.isMeshPhysicalMaterial && !m.isMeshPhysicalMaterial))) std = m; if (!Tex && m && m.map) Tex = m.map.constructor;
    });
    if (!ref || !std || !Tex) return;
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = attrClass(ref.geometry); if (!Attr) return;
    function tex(cv, rep) { var t = new Tex(cv); t.wrapS = t.wrapT = rep ? 1000 : 1001; t.colorSpace = 'srgb'; t.needsUpdate = true; return t; }
    var anim = [];

    /* ---- water: clear enough to read the spring bed, with a slow ripple ---- */
    var waters = [], waterY = -1e9, wcells = new Set(), wH = new Map(), C = .5, key = function (x, z) { return Math.floor(x / C) + ',' + Math.floor(z / C); };
    scene.traverse(function (o) { if (o.isMesh && /water_surface/.test(o.name || '')) waters.push(o); });
    (function () {
      var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g2 = cv.getContext('2d');
      g2.fillStyle = '#7fd3c4'; g2.fillRect(0, 0, 256, 256);
      for (var row = 0; row < 16; row++) {
        var y0 = row * 16 + 8, amp = 2.5 + (row % 3), ph = row * .9, k = 2 + (row % 2);
        [['rgba(232,250,244,.9)', 0], ['rgba(40,128,126,.45)', 5]].forEach(function (s) {
          g2.beginPath(); for (var x = 0; x <= 256; x += 4) { var y = y0 + s[1] + Math.sin(x / 256 * Math.PI * 2 * k + ph) * amp; if (x) g2.lineTo(x, y); else g2.moveTo(x, y); }
          g2.strokeStyle = s[0]; g2.lineWidth = s[1] ? 1.4 : 2; g2.stroke();
        });
      }
      var rt = tex(cv, true);
      waters.forEach(function (o) {
        var g = o.geometry, pos = g.attributes.position, uv = new Float32Array(pos.count * 2); o.updateWorldMatrix(true, false); var e = o.matrixWorld.elements;
        for (var i = 0; i < pos.count; i++) { var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); uv[i * 2] = (e[0] * x + e[4] * y + e[8] * z + e[12]) / 5; uv[i * 2 + 1] = (e[2] * x + e[6] * y + e[10] * z + e[14]) / 5; }
        g.setAttribute('uv', new Attr(uv, 2));
        var m = std.clone(); m.name = 'Tranquil pond water'; m.map = rt; m.normalMap = null; m.roughnessMap = null; m.aoMap = null; m.color.set('#ffffff'); m.emissive.set('#1f6f6a'); m.emissiveIntensity = .35;
        m.roughness = .25; m.metalness = 0; m.transparent = true; m.opacity = .42; m.depthWrite = false; m.side = 2; m.needsUpdate = true; o.material = m; o.renderOrder = 4;
        eachTri(o, function (a, b, c) {
          var ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (Math.abs(ny) < 1e-9) return; waterY = Math.max(waterY, a[1], b[1], c[1]);
          // grid-aligned cell centres (the water is made of many triangles smaller than a cell, so also mark each one's centre)
          var ty = (a[1] + b[1] + c[1]) / 3, mark = function (k) { wcells.add(k); if (!(wH.get(k) >= ty)) wH.set(k, ty); };   // each spot keeps its own water level
          mark(key((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3));
          for (var x = Math.floor(Math.min(a[0], b[0], c[0]) / C) * C + C / 2; x <= Math.max(a[0], b[0], c[0]); x += C) for (var z = Math.floor(Math.min(a[2], b[2], c[2]) / C) * C + C / 2; z <= Math.max(a[2], b[2], c[2]); z += C) {
            var d1 = (x - b[0]) * (a[2] - b[2]) - (a[0] - b[0]) * (z - b[2]), d2 = (x - c[0]) * (b[2] - c[2]) - (b[0] - c[0]) * (z - c[2]), d3 = (x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2]);
            if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) mark(key(x, z));
          }
        });
      });
      anim.push(function (t) { rt.offset.set(t * .012, t * .02); });
    })();

    /* ---- walkable ground: the tops of the decks and the banks, above the water line ---- */
    var walkH = new Map();
    scene.traverse(function (o) {
      if (!o.isMesh || !/wood_deck|terrain_bank|spring_bank/.test(o.name || '')) return;
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
    var walk = [], swim = [];
    // walkers: dry ground, or decks standing well clear of the water; swimmers: the pond wherever no deck is overhead
    walkH.forEach(function (y, k) { if (wcells.has(k) ? y > wH.get(k) + .3 : y > waterY + .08) walk.push(k); });
    wcells.forEach(function (k) {
      var p = k.split(','), x = +p[0], z = +p[1], open = true; for (var dx = -1; dx <= 1 && open; dx++) for (var dz = -1; dz <= 1; dz++) if (!wcells.has((x + dx) + ',' + (z + dz))) { open = false; break; }
      var h = walkH.get(k); if (open && !(h > wH.get(k) + .3)) swim.push(k);
    });
    var wset = new Set(walk), sset = new Set(swim);

    /* ---- sprites: the shared sketch people, quads turned to the camera every frame ---- */
    var SP = window.SketchPeople, atlas = tex(SP.atlas(), false), rnd = srand(2207);
    var nW = Math.min(walk.length ? (mobile ? 14 : 36) : 0, walk.length), nS = Math.min(swim.length ? (mobile ? 4 : 10) : 0, swim.length), N = nW + nS;
    if (!N) { window.tranquilLife = { walkers: 0, swimmers: 0 }; return; }
    var P = new Float32Array(N * 12), UV = new Float32Array(N * 8), NN = new Float32Array(N * 12), I = [];
    for (var q = 0; q < N; q++) { for (var v = 0; v < 4; v++) NN[q * 12 + v * 3 + 1] = 1; I.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); }
    var sg = new BG(), pa = new Attr(P, 3), ua = new Attr(UV, 2); sg.setAttribute('position', pa); sg.setAttribute('normal', new Attr(NN, 3)); sg.setAttribute('uv', ua); sg.setIndex(I);
    var sm = std.clone(); sm.name = 'Tranquil life sprites'; sm.map = atlas; sm.emissiveMap = atlas; sm.color.set('#000000'); sm.emissive.set('#ffffff'); sm.normalMap = null; sm.roughnessMap = null; sm.aoMap = null; sm.metalness = 0; sm.roughness = 1; sm.side = 2; sm.alphaTest = .45; sm.transparent = false; sm.opacity = 1; sm.toneMapped = false; sm.needsUpdate = true;
    var sprites = new Mesh(sg, sm); sprites.name = 'Tranquil life sprites'; sprites.frustumCulled = false; sprites.renderOrder = 5; scene.add(sprites);
    function setCell(i, c, flip) { var o = i * 8, a = flip ? c[2] : c[0], b = flip ? c[0] : c[2]; UV[o] = a; UV[o + 1] = c[1]; UV[o + 2] = b; UV[o + 3] = c[1]; UV[o + 4] = b; UV[o + 5] = c[3]; UV[o + 6] = a; UV[o + 7] = c[3]; }
    function cellXZ(k) { var p = k.split(','); return [(+p[0] + .5) * C, (+p[1] + .5) * C]; }
    function step(set, k, dir, hmap) {
      var p = k.split(','), x = +p[0], z = +p[1], opts = [], tot = 0, h0 = hmap ? hmap.get(k) : 0;
      for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue; var nk = (x + dx) + ',' + (z + dz); if (!set.has(nk)) continue;
        if (hmap && Math.abs(hmap.get(nk) - h0) > .35) continue;   // no stepping up walls or down off decks
        var w = dir && dx === dir[0] && dz === dir[1] ? 10 : (dir && dx === -dir[0] && dz === -dir[1] ? .05 : 1); opts.push([nk, [dx, dz], w]); tot += w;
      }
      if (!opts.length) return null; var r = rnd() * tot; for (var j = 0; j < opts.length; j++) { r -= opts[j][2]; if (r <= 0) return opts[j]; } return opts[0];
    }
    function agent(set, list) { var k = list[Math.floor(rnd() * list.length)]; return { a: k, b: k, t: 1, dir: null, sp: .9 + rnd() * .5, type: Math.floor(rnd() * SP.types), dist: rnd() * 3, pause: rnd() * 4, phase: rnd() * 6 }; }
    var walkers = [], swimmers = [];
    for (var w = 0; w < nW; w++) walkers.push(agent(wset, walk));
    for (var s = 0; s < nS; s++) { var sa = agent(sset, swim); sa.sp = .35 + rnd() * .2; swimmers.push(sa); }
    function advance(o, set, hmap, dt) {
      o.t += dt * o.sp / C; o.dist += dt * o.sp;
      while (o.t >= 1) { o.t -= 1; o.a = o.b; var n = step(set, o.a, o.dir, hmap); if (n) { o.b = n[0]; o.dir = n[1]; } else { o.b = o.a; o.dir = null; o.t = 0; break; } }
      var A = cellXZ(o.a), B = cellXZ(o.b); return [A[0] + (B[0] - A[0]) * o.t, A[1] + (B[1] - A[1]) * o.t, hmap ? hmap.get(o.a) + (hmap.get(o.b) - hmap.get(o.a)) * o.t : wH.get(o.a) + (wH.get(o.b) - wH.get(o.a)) * o.t];
    }
    anim.push(function (time, dt) {
      ctx.camera.updateMatrixWorld(); var e = ctx.camera.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      function quad(i, x, y, z, wd, h) { var o = i * 12, hw = wd / 2; P[o] = x - rx * hw; P[o + 1] = y; P[o + 2] = z - rz * hw; P[o + 3] = x + rx * hw; P[o + 4] = y; P[o + 5] = z + rz * hw; P[o + 6] = x + rx * hw; P[o + 7] = y + h; P[o + 8] = z + rz * hw; P[o + 9] = x - rx * hw; P[o + 10] = y + h; P[o + 11] = z - rz * hw; }
      walkers.forEach(function (o, i) {
        var p, frame;
        if (o.pause > 0) { o.pause -= dt; var A = cellXZ(o.a); p = [A[0], A[1], walkH.get(o.a)]; frame = 4; }
        else { p = advance(o, wset, walkH, dt); frame = Math.floor(o.dist / .45) % 4; if (rnd() < .003) o.pause = 2 + rnd() * 5; }
        var mv = o.dir ? o.dir[0] * rx + o.dir[1] * rz : 1;
        setCell(i, SP.walkCell(o.type, frame), mv < 0); quad(i, p[0], p[2], p[1], 1.75 * SP.aspect, 1.75);
      });
      swimmers.forEach(function (o, i) {
        var p = advance(o, sset, null, dt), k = nW + i, h = 1.75 * SP.aspect * 1.6;
        setCell(k, SP.swimCell(Math.floor(time * 1.2 + o.phase)), (o.dir ? o.dir[0] * rx + o.dir[1] * rz : 1) < 0);
        quad(k, p[0], p[2] - h * SP.swimLine + Math.sin(time * 2 + o.phase) * .03, p[1], h * SP.aspect * 2, h);
      });
      pa.needsUpdate = true; ua.needsUpdate = true;
    });
    window.tranquilLife = { walkers: nW, swimmers: nS, walkCells: walk.length, swimCells: swim.length, waterY: +waterY.toFixed(2) };

    /* ---- Diagram view: each zone in its own colour, the site context pale ---- */
    var ZONE = { 'zone-1': '#e3b24d', 'zone-2': '#e8706a', 'zone-3': '#72a8dc', 'zone-4': '#9c7fc4', 'zone-5': '#5fae8f', 'zone-6': '#7c7c80' }, PALE = '#efe4c8', GREEN = '#cfe0b8';
    var orig = new Map(), flatCache = {}, diag = false;
    function flat(hex) { if (flatCache[hex]) return flatCache[hex]; var m = std.clone(); m.name = 'Tranquil diagram ' + hex; m.map = null; m.normalMap = null; m.roughnessMap = null; m.aoMap = null; m.vertexColors = false; m.color.set(hex); m.emissive.set(hex); m.emissiveIntensity = .2; m.roughness = 1; m.metalness = 0; m.transparent = false; m.opacity = 1; m.needsUpdate = true; return (flatCache[hex] = m); }
    function setDiagram(on) {
      diag = on;
      scene.traverse(function (o) {
        if (!o.isMesh || (o.userData && o.userData.skEdge) || /^Tranquil (life|pond)/.test(o.material && o.material.name || '') || /water_surface/.test(o.name)) return;
        var z = /^(zone-\d|site-extras)/.exec(o.name || ''); if (!z) return;
        if (!orig.has(o)) orig.set(o, o.material);
        o.material = on ? flat(ZONE[z[1]] || (/zone-8/.test(z[1]) ? GREEN : PALE)) : orig.get(o);
      });
      if (on && scene.background && scene.background.isColor) scene.background.setHex(0xf4f1ea);
      if (on && window.sketchStyle && window.sketchStyle.u) window.sketchStyle.u.uInk.value = [.17, .16, .15];
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    if (window.sketchStyle) {
      var setMode = window.sketchStyle.setMode;
      window.sketchStyle.setMode = function (name) { setMode(name); if (name === 'diagram') setDiagram(true); else if (diag) setDiagram(false); };
    }

    // one frame loop for the water and the people; it pauses while the tab is hidden. The section box's cutting planes (set on the
    // model's materials) are passed on to the water, the people and the diagram colours.
    var last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop); if (document.hidden) { last = now; return; }
      var dt = Math.min(.1, (now - last) / 1000); last = now;
      anim.forEach(function (f) { f(now / 1000, dt); });
      scene.traverse(function (o) { if (o.isMesh && /^Tranquil /.test(o.material && o.material.name || '') && o.material.clippingPlanes !== std.clippingPlanes) o.material.clippingPlanes = std.clippingPlanes; });
      ctx.controls.dispatchEvent({ type: 'change' });
    })(last);
  }
})();
