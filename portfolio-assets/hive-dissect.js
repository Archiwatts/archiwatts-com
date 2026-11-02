/* Hive dissect: click any part of the model to isolate it. The rest of the building turns to a ghost, the camera flies to the part,
   and a card gives a live readout (levels, height, footprint) with shortcuts to its floor plan, its phase and the facade panel system. */
(function () {
  var PHASE_OF = { a: 1, d: 1, c: 2, e: 2, b: 3 };
  var LEVEL_H = 3.048;
  var INFO = {
    residential: { n: 'Residential', c: '#e3b24d', plan: 'residential', planName: 'Typical residential floor', text: 'The typical floor repeats from L-6 to L-13 (22.9 to 47.2 m). The large hexagons on the plan are the service elevators that connect each level.' },
    retail: { n: 'Retail', c: '#e8706a', plan: 'ground', planName: 'Ground floor plan', text: 'Shops and the supermarket at grade, opening onto the public realm and the canal-side promenade.' },
    office: { n: 'Offices', c: '#72a8dc', plan: 'office', planName: 'Office floor plan', text: 'Office floors above the retail podium, sharing the building cores with the residential blocks.' },
    common: { n: 'Shared amenities', c: '#bfcca6', plan: 'amenity', planName: 'Amenity deck plan', text: 'The amenity deck: shared spaces, pool and gardens raised above the street.' },
    parking: { n: 'Parking / ramps', c: '#7c7c80', plan: 'ground', planName: 'Ground floor plan', text: 'Parking floors reached by the three hatched ramps shown on the ground plan.' },
    structure: { n: 'Structure', c: '#d9d2c2', plan: null, text: 'Columns, cores and slabs that carry the blocks and the amenity deck.' },
    pavilions: { n: 'Amenity pavilions', c: '#d9d2c2', plan: 'amenity', planName: 'Amenity deck plan', text: 'Small pavilions that sit on the amenity deck.' },
    facade: { n: 'Facade panel system', c: '#6f8fae', plan: null, text: 'A perforated hexagon panel skin hung off the slab edges. It shades the glass and gives each block its texture.' }
  };
  var PICKABLE = /^HIVE_(residential|retail|office|common|parking|structure|pavilions)-([a-e])_(\w+)/;
  // the panel skin: HIVE_facade-<block>_* in the FBX model; baked aluminium and Mesh_n instances in the earlier model
  var FACADE_BLOCK = /^HIVE_facade-([a-e])_/, FACADE_OLD = /_aluminum$|^Mesh_\d+|(residential|common|parking)-[a-e]_metal$/;
  // furnishing that would crowd a selection: shop and garage interiors (with the cars), trees and people, the deck pools
  var DECOR = /^(Hive interiors|Hive sketch sprites|Hive planting bed|Pool |Amenity pool)/;
  // computer browsers only: needs a mouse that can hover
  if (!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches)) return;
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Hive dissect skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();

  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, cam = ctx.camera, dom = ctx.renderer.domElement, controls = ctx.controls;
    var V3 = cam.position.constructor, parts = [], decor = [], origMat = new Map(), origVis = new Map(), ghostMat = {}, sel = null, down = null, geoCache = new Map(), fly = null, perBlock = false;

    function classify(o) {
      var n = o.name || '', f = FACADE_BLOCK.exec(n);
      if (f) return { prog: 'facade', block: f[1] };
      var old = !perBlock && FACADE_OLD.test(n), m = PICKABLE.exec(n);
      if (m && !old) return { prog: m[1], block: m[2] };
      if (old && !/context|water|road|sprite|pool/i.test(n)) return { prog: 'facade', block: '' };
      return null;
    }
    function collect() {
      parts = []; decor = []; scene.updateMatrixWorld(true); perBlock = false;
      scene.traverse(function (o) { if (o.isMesh && FACADE_BLOCK.test(o.name || '')) perBlock = true; });
      scene.traverse(function (o) {
        if (!o.isMesh || !o.geometry || (o.userData && o.userData.skEdge) || !o.geometry.attributes.position) return;
        if (DECOR.test(o.name || '')) { decor.push(o); return; }
        var c = classify(o); if (c) parts.push({ mesh: o, prog: c.prog, block: c.block });
      });
    }
    collect(); setTimeout(collect, 3000);

    // ---- ray picking against the model's own triangles ----
    function localGeo(g) {
      var c = geoCache.get(g); if (c) return c;
      var p = g.attributes.position, n = p.count, P = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { P[i * 3] = p.getX(i); P[i * 3 + 1] = p.getY(i); P[i * 3 + 2] = p.getZ(i); }
      var idx = g.index ? g.index.array : null;
      if (!g.boundingBox) g.computeBoundingBox();
      c = { P: P, I: idx, box: g.boundingBox }; geoCache.set(g, c); return c;
    }
    function hitMesh(o, org, dir) {
      var inv = o.matrixWorld.clone().invert(), a = org.clone().applyMatrix4(inv), b = org.clone().add(dir).applyMatrix4(inv);
      var ox = a.x, oy = a.y, oz = a.z, dx = b.x - ox, dy = b.y - oy, dz = b.z - oz, g = localGeo(o.geometry), bx = g.box;
      var t0 = 0, t1 = Infinity, lo = [bx.min.x, bx.min.y, bx.min.z], hi = [bx.max.x, bx.max.y, bx.max.z], oo = [ox, oy, oz], dd = [dx, dy, dz];
      for (var k = 0; k < 3; k++) {
        if (Math.abs(dd[k]) < 1e-12) { if (oo[k] < lo[k] || oo[k] > hi[k]) return Infinity; }
        else { var ta = (lo[k] - oo[k]) / dd[k], tb = (hi[k] - oo[k]) / dd[k]; if (ta > tb) { var s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return Infinity; }
      }
      var P = g.P, I = g.I, n = I ? I.length : P.length / 3, best = Infinity;
      for (var f = 0; f < n; f += 3) {
        var i0 = (I ? I[f] : f) * 3, i1 = (I ? I[f + 1] : f + 1) * 3, i2 = (I ? I[f + 2] : f + 2) * 3;
        var e1x = P[i1] - P[i0], e1y = P[i1 + 1] - P[i0 + 1], e1z = P[i1 + 2] - P[i0 + 2], e2x = P[i2] - P[i0], e2y = P[i2 + 1] - P[i0 + 1], e2z = P[i2 + 2] - P[i0 + 2];
        var px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-14 && det < 1e-14) continue;
        var id = 1 / det, tx = ox - P[i0], ty = oy - P[i0 + 1], tz = oz - P[i0 + 2], u = (tx * px + ty * py + tz * pz) * id; if (u < 0 || u > 1) continue;
        var qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * id; if (v < 0 || u + v > 1) continue;
        var t = (e2x * qx + e2y * qy + e2z * qz) * id; if (t > 1e-4 && t < best) best = t;
      }
      return best;
    }
    function pick(clientX, clientY) {
      var r = dom.getBoundingClientRect(), nx = (clientX - r.left) / r.width * 2 - 1, ny = -((clientY - r.top) / r.height * 2 - 1);
      cam.updateMatrixWorld(); scene.updateMatrixWorld(true);
      var org = cam.position.clone(), far = new V3(nx, ny, .5).unproject(cam), dir = far.sub(org).normalize(), best = Infinity, hit = null, bestN = Infinity, hitN = null;
      parts.forEach(function (p) { if (!p.mesh.visible || p.mesh.isInstancedMesh) return; var t = hitMesh(p.mesh, org, dir); if (t < best) { best = t; hit = p; } if (p.prog !== 'facade' && t < bestN) { bestN = t; hitN = p; } });
      // the panel skin sits just in front of the building, so a panel hit selects the block behind it
      if (hit && hit.prog === 'facade') {
        var nm = PICKABLE.exec(hit.mesh.name || '');
        if (nm) { var own = parts.filter(function (q) { return q.prog === nm[1] && q.block === nm[2]; })[0]; if (own) return own; }
        if (hitN && bestN < best + 40) return hitN;
      }
      return hit;
    }

    // ---- isolate: only the chosen part stays solid; the rest of the building is a faint ghost and the furnishing steps away ----
    function ghostOf(m) {
      var k = m.uuid; if (ghostMat[k]) return ghostMat[k];
      var g = m.clone(); g.transparent = true; g.opacity = .05; g.depthWrite = false; g.needsUpdate = true; return (ghostMat[k] = g);
    }
    function hide(o, on) { if (!origVis.has(o)) origVis.set(o, o.visible); o.visible = on ? origVis.get(o) : false; }
    function clearSel() {
      parts.forEach(function (p) { if (origMat.has(p.mesh)) p.mesh.material = origMat.get(p.mesh); });
      origVis.forEach(function (v, o) { o.visible = v; }); origVis.clear(); origMat.clear(); sel = null; card.hidden = true; hint.hidden = false; changed();
    }
    // a facade with a block letter belongs to that block only; the earlier model's skin is one system for the whole building
    function same(p, q) { return p.prog === 'x' || q.prog === p.prog && (q.block === p.block || (p.prog === 'facade' && !p.block)); }
    function apply(p) {
      sel = p;
      parts.forEach(function (q) {
        if (!origMat.has(q.mesh)) origMat.set(q.mesh, q.mesh.material);
        var base = origMat.get(q.mesh), mine = same(p, q);
        q.mesh.material = mine ? base : (Array.isArray(base) ? base.map(ghostOf) : ghostOf(base));
        // only the chosen part stays: the structure (columns, cores, slabs) is left as a faint ghost for scale, everything else steps out
        hide(q.mesh, mine || (q.prog === 'structure' && /_static$/.test(q.mesh.name)));
      });
      decor.forEach(function (o) { hide(o, p.prog === 'common' && /pool/i.test(o.name)); });
      changed();
    }
    // ink outlines follow the selection: only the chosen block keeps its lines
    function edges() {
      scene.traverse(function (o) {
        if (!(o.userData && o.userData.skEdge)) return; var m = /^HIVE_([a-z]+)-([a-z]+)_/.exec(o.name || '');
        if (!m || /miami/.test(o.name)) return;
        o.visible = !sel || (m[1] === sel.prog && m[2] === sel.block);
      });
    }
    function changed() { edges(); controls.dispatchEvent({ type: 'change' }); }

    // ---- readout ----
    function stats(p) {
      var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], tris = 0, corners = [];
      parts.forEach(function (q) {
        if (!same(p, q) || q.mesh.isInstancedMesh) return; var o = q.mesh, b = localGeo(o.geometry).box; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        for (var i = 0; i < 8; i++) { var v = new V3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld); mn[0] = Math.min(mn[0], v.x); mn[1] = Math.min(mn[1], v.y); mn[2] = Math.min(mn[2], v.z); mx[0] = Math.max(mx[0], v.x); mx[1] = Math.max(mx[1], v.y); mx[2] = Math.max(mx[2], v.z); }
      });
      if (!isFinite(mn[0]) && p.prog === 'facade') { var all = { prog: 'x' }; var keep = parts; parts = parts.filter(function (q) { return q.prog !== 'facade'; }); var r = stats({ prog: 'x', block: '' }); parts = keep; return r; }
      return { mn: mn, mx: mx, tris: tris, w: mx[0] - mn[0], d: mx[2] - mn[2], h0: mn[1], h1: mx[1] };
    }

    // ---- camera flight ----
    function flyTo(s) {
      var c = new V3((s.mn[0] + s.mx[0]) / 2, (s.mn[1] + s.mx[1]) / 2, (s.mn[2] + s.mx[2]) / 2), size = Math.max(s.w, s.d, s.h1 - s.h0, 12);
      var dir = cam.position.clone().sub(controls.target).normalize(); if (dir.y < .25) dir.y = .25; dir.normalize();
      var toP = c.clone().add(dir.multiplyScalar(size * 1.5)), fromP = cam.position.clone(), fromT = controls.target.clone(), t0 = performance.now();
      fly = { id: t0 };
      (function step(now) {
        if (!fly || fly.id !== t0) return; var k = Math.min(1, (now - t0) / 1100), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        cam.position.lerpVectors(fromP, toP, e); controls.target.lerpVectors(fromT, c, e); controls.update(); changed();
        if (k < 1) requestAnimationFrame(step); else fly = null;
      })(t0);
    }

    // ---- hover: a pink wash over the block under the pointer, with a small label ----
    var hoverMat = null, hoverKey = null, overlays = [], tip = null, pending = null, lastMove = null;
    function hoverMaterial() {
      if (hoverMat) return hoverMat; var base = parts[0] && parts[0].mesh.material; base = Array.isArray(base) ? base[0] : base; if (!base) return null;
      // a light tint, not a fill: the part under the pointer should read through it
      var m = base.clone(); m.name = 'Hive sketch hover'; m.map = null; m.normalMap = null; m.roughnessMap = null; m.aoMap = null; m.vertexColors = false; m.color.set('#f2a7bd'); if (m.emissive) { m.emissive.set('#f2a7bd'); m.emissiveIntensity = .35; }
      m.transparent = true; m.opacity = .16; m.depthWrite = false; m.toneMapped = false; m.polygonOffset = true; m.polygonOffsetFactor = -3; m.polygonOffsetUnits = -3; m.side = 2;
      m.onBeforeCompile = function () {}; m.customProgramCacheKey = function () { return 'hd-hover'; }; m.needsUpdate = true; return (hoverMat = m);
    }
    function clearHover() { overlays.forEach(function (o) { o.visible = false; }); overlays = []; hoverKey = null; if (tip) tip.hidden = true; dom.style.cursor = ''; }
    function setHover(p, x, y) {
      if (!p) { if (hoverKey) { clearHover(); changed(); } return; }
      var key = p.prog + p.block;
      if (key !== hoverKey) {
        overlays.forEach(function (o) { o.visible = false; }); overlays = [];
        var mat = hoverMaterial(); if (!mat) return;
        parts.forEach(function (q) {
          if (!same(p, q) || q.mesh.isInstancedMesh || !q.mesh.visible) return;
          var o = q.mesh.userData.hdHover; if (!o) { o = new q.mesh.constructor(q.mesh.geometry, mat); o.name = 'Hive hover'; o.renderOrder = 5; o.raycast = function () {}; o.userData.skHover = true; q.mesh.add(o); q.mesh.userData.hdHover = o; }
          o.visible = true; overlays.push(o);
        });
        hoverKey = key; changed();
      }
      var inf = INFO[p.prog], phase = PHASE_OF[p.block];
      tip.innerHTML = '<b>' + inf.n + '</b>' + (p.block ? ' · Block ' + p.block.toUpperCase() + (phase ? ' · Phase ' + phase : '') : '') + '<span>Click to dissect</span>';
      tip.hidden = false; tip.style.left = (x > innerWidth * .55 ? Math.max(100, x - tip.offsetWidth - 14) : x + 16) + 'px'; tip.style.top = (y + 18) + 'px'; dom.style.cursor = 'pointer';
    }
    dom.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (e.buttons) { if (hoverKey) { clearHover(); changed(); } return; }
      lastMove = { x: e.clientX, y: e.clientY }; if (pending) return;
      pending = setTimeout(function () { pending = null; if (!lastMove || fly) return; if (!parts.length) collect(); setHover(pick(lastMove.x, lastMove.y), lastMove.x, lastMove.y); }, 70);
    });
    dom.addEventListener('pointerleave', function () { lastMove = null; if (hoverKey) { clearHover(); changed(); } });

    // ---- card ----
    var css = document.createElement('style');
    css.textContent = '#hd-hint{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:30;background:rgba(28,27,30,.88);color:#f2f0f4;font:600 12.5px Archivo,system-ui,sans-serif;padding:8px 14px;border-radius:99px;pointer-events:none;letter-spacing:.02em;max-width:calc(100vw - 32px);text-align:center}' +
      '#hd-card{position:fixed;left:184px;bottom:70px;z-index:30;width:min(340px,calc(100vw - 32px));background:rgba(28,27,30,.94);color:#f2f0f4;border:1.5px solid #4d4953;border-radius:14px;padding:14px 16px;font:13px/1.45 Archivo,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)}' +
      '#hd-card h3{margin:0 0 2px;font:800 17px Archivo,system-ui,sans-serif}#hd-card .sub{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#e0557c;font-weight:700}' +
      '#hd-card .sw{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:7px;vertical-align:-1px}' +
      '#hd-card dl{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 12px;margin:10px 0}#hd-card dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#a8a3b0}#hd-card dd{margin:0;font:700 15px Archivo,system-ui,sans-serif}' +
      '#hd-card p{margin:0 0 10px;color:#d6d2dc}#hd-card .row{display:flex;flex-wrap:wrap;gap:6px}#hd-card button{font:700 12px Archivo,system-ui,sans-serif;color:#f2f0f4;background:#26242a;border:1.5px solid #4d4953;border-radius:10px;min-height:38px;padding:0 12px;cursor:pointer}#hd-card button.pri{background:#e0557c;border-color:#e0557c;color:#1c1b1e}' +
      '#hd-card .x{position:absolute;right:8px;top:8px;min-height:30px;width:30px;padding:0;border-radius:99px}' +
      '@media (max-width:900px){#hd-card{left:16px;right:16px;bottom:64px;width:auto}}';
    document.head.appendChild(css);
    css.textContent += '#hd-tip{position:fixed;z-index:9999;pointer-events:none;background:rgba(28,27,30,.94);color:#f2f0f4;border:1.5px solid #e0557c;border-radius:10px;padding:7px 11px;font:12.5px/1.35 Archivo,system-ui,sans-serif;max-width:220px}#hd-tip b{font-weight:800}#hd-tip span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#e0557c;margin-top:2px;font-weight:700}';
    tip = document.createElement('div'); tip.id = 'hd-tip'; tip.hidden = true; document.body.appendChild(tip);
    var hint = document.createElement('div'); hint.id = 'hd-hint'; hint.textContent = 'Click any part of the building to dissect it'; document.body.appendChild(hint);
    var card = document.createElement('div'); card.id = 'hd-card'; card.hidden = true; document.body.appendChild(card);
    function show(p) {
      var inf = INFO[p.prog], s = stats(p), phase = PHASE_OF[p.block], floors = Math.max(1, Math.round((s.h1 - s.h0) / LEVEL_H));
      card.innerHTML = '<button class="x" type="button" data-a="close" aria-label="Close">×</button><div class="sub">' + (p.block ? 'Block ' + p.block.toUpperCase() + (phase ? ' · Phase ' + phase : '') : 'Whole building') + '</div><h3><span class="sw" style="background:' + inf.c + '"></span>' + inf.n + '</h3>' +
        '<dl><div><dt>Height range</dt><dd>' + s.h0.toFixed(1) + ' to ' + s.h1.toFixed(1) + ' m</dd></div><div><dt>Levels spanned</dt><dd>about ' + floors + '</dd></div><div><dt>Footprint</dt><dd>' + s.w.toFixed(0) + ' × ' + s.d.toFixed(0) + ' m</dd></div><div><dt>Model detail</dt><dd>' + (s.tris < 1000 ? Math.round(s.tris) : Math.round(s.tris / 1000) + 'k') + ' triangles</dd></div></dl>' +
        '<p>' + inf.text + '</p><div class="row">' +
        (inf.plan ? '<button class="pri" type="button" data-a="plan">' + inf.planName + '</button>' : '') +
        (phase ? '<button type="button" data-a="phase">Show Phase ' + phase + '</button>' : '') +
        (p.prog !== 'facade' ? '<button type="button" data-a="facade">Facade panels</button>' : '') +
        '<button type="button" data-a="reset">Whole building</button></div>';
      card.hidden = false; hint.hidden = true; card.dataset.prog = p.prog; card.dataset.block = p.block;
    }
    function select(p) { apply(p); show(p); flyTo(stats(p)); }
    card.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b || !sel) return; var a = b.dataset.a, inf = INFO[sel.prog];
      if (a === 'close' || a === 'reset') { clearSel(); if (window.hivePlanOverlays) window.hivePlanOverlays.show(null); if (a === 'reset' && window.newProjectViewer && window.newProjectViewer.fit) window.newProjectViewer.fit(); }
      else if (a === 'plan' && window.hivePlanOverlays) window.hivePlanOverlays.show(inf.plan);
      else if (a === 'phase' && window.hivePhases) { clearSel(); window.hivePhases.apply(true); window.hivePhases.setPhase(PHASE_OF[sel ? sel.block : card.dataset.block]); }
      else if (a === 'facade') { var fs = parts.filter(function (q) { return q.prog === 'facade'; }), f = fs.filter(function (q) { return q.block === sel.block; })[0] || fs[0]; if (f) select(f); }
    });
    dom.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    dom.addEventListener('pointerup', function (e) {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || performance.now() - down.t > 450) { down = null; return; }
      down = null; if (!parts.length) collect();
      var p = pick(e.clientX, e.clientY); if (p) select(p); else if (sel) clearSel();
    });
    window.hiveDissect = { select: select, clear: clearSel, pick: pick, parts: function () { return parts; } };
  }
})();
