/* Allure Waterways: the installation on the ship's deck, shown apart from the ship.
   The project came out of Revit as four merged meshes (Deck, Metal, Plaster, Water), so they are split here by connected piece:
   - Tank: the aquarium enclosure (walls and roof, in glass), its frame and the water
   - Elevators: the four tube elevators (glass tubes, solid cars)
   - Ramps: the ramps, decks and railings that wind through the tank
   The panel gets a PROJECT PARTS group: Cruise ship on / off (the ship is this page's context, so Faded / Hidden also work from the
   context menu), Isolate project, and on / off for each part. In Watercolor the installation keeps its blues (sketch-style skKeep). */
(function () {
  function ready() { var c = window.daylightContext; return c && c.scene && window.sketchStyle && window.projectWalk && document.querySelector('.building-panel'); }
  (function wait() { if (ready()) setTimeout(init, 900); else setTimeout(wait, 400); })();
  function init() {
    var ctx = window.daylightContext, scene = ctx.scene, src = [], ship = null;
    scene.traverse(function (o) { if (!o.isMesh || o.userData.skEdge) return; if (/^(Deck|Metal|Plaster|Water)$/.test(o.name)) src.push(o); if (/^Ship_hull/.test(o.name)) ship = o; });
    if (!src.length) return;
    var std = src[0].material.constructor;
    function mat(name, color, opts) {
      var m = new std(); m.name = name; m.color.set(color); m.roughness = opts.r != null ? opts.r : .6; m.metalness = opts.m || 0;
      if (opts.o != null) { m.transparent = true; m.opacity = opts.o; m.depthWrite = false; m.side = 2; }
      m.userData.skKeep = opts.keep != null ? opts.keep : .85; window.sketchStyle.patch(m); return m;
    }
    var GLASS = mat('Allure glass', '#a9dcec', { r: .03, m: .15, o: .16, keep: .9 }), TUBE = mat('Allure elevator glass', '#7fc4de', { r: .05, m: .1, o: .26, keep: .9 });
    var FRAME = mat('Allure frame', '#1f2225', { r: .32, m: .75, keep: .8 }), CAR = mat('Allure elevator car', '#c3c8cc', { r: .25, m: .8, keep: .8 });
    var RAMP = mat('Allure ramp', '#dfe3e4', { r: .55, keep: .6 }), RAIL = mat('Allure railing', '#b8bec3', { r: .25, m: .85, keep: .75 });
    var WATER = mat('Allure tank water', '#2f8fb4', { r: .08, m: .05, o: .55, keep: .95 });
    var parts = { tank: [], elevators: [], ramps: [] }, TUBES = [];
    // the Plaster mesh holds the tubes, so it goes first and the tube footprints are known for the others
    src.sort(function (a, b) { return (a.name === 'Plaster' ? 0 : 1) - (b.name === 'Plaster' ? 0 : 1); });
    src.forEach(function (o) {
      o.updateMatrixWorld(); var g = o.geometry, p = g.attributes.position, ix = g.index.array, n = p.count, par = new Int32Array(n), m = o.matrixWorld.elements;
      for (var i = 0; i < n; i++) par[i] = i;
      function f(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
      for (var t = 0; t < ix.length; t += 3) { var a = f(ix[t]); par[f(ix[t + 1])] = a; par[f(ix[t + 2])] = a; }
      var B = new Map();
      for (var v = 0; v < n; v++) { var r = f(v), b = B.get(r); if (!b) { b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; B.set(r, b); } var x = p.getX(v), y = p.getY(v), z = p.getZ(v), w = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; for (var j = 0; j < 3; j++) { if (w[j] < b[j]) b[j] = w[j]; if (w[j] > b[j + 3]) b[j + 3] = w[j]; } }
      // each piece to a bucket: [part, material]
      var cls = new Map(), K = {};
      B.forEach(function (b, r) {
        var wx = b[3] - b[0], hy = b[4] - b[1], dz = b[5] - b[2], k;
        if (o.name === 'Water') k = ['tank', WATER];
        else if (wx <= 7.5 && dz <= 10 && hy >= 12 && o.name !== 'Metal') k = ['elevators', wx > 4 ? TUBE : CAR];   // the two inner elevators are oval, 9 m long                    // tube elevators run the full height
        else if (o.name === 'Plaster' && (wx >= 10 || dz >= 25) && hy >= 8) k = ['tank', GLASS];               // enclosure walls
        else if (o.name === 'Plaster' && hy < .3 && b[1] > 53 && (wx >= 10 || dz >= 20)) k = ['tank', GLASS];  // enclosure roof
        else if (o.name === 'Metal' && hy >= 15 && Math.min(wx, dz) < .5) k = ['tank', FRAME];                 // mullions
        else if (o.name === 'Metal' && Math.abs(Math.abs(b[0]) - 5.75) < .4 && hy > 5) k = ['tank', FRAME];
        else k = ['ramps', o.name === 'Metal' ? RAIL : RAMP];
        var key = k[0] + '|' + k[1].name; if (!K[key]) K[key] = k; cls.set(r, K[key]);   // one shared bucket per part and material
      });
      // the tubes' curved faces came out as loose triangles: small pieces inside a tube's footprint belong to that tube
      B.forEach(function (b, r) { var k = cls.get(r); if (k[1] === TUBE) TUBES.push([(b[0] + b[3]) / 2, (b[2] + b[5]) / 2, Math.max(b[3] - b[0], b[5] - b[2]) / 2 + .15]); });
      var lists = new Map();
      if (TUBES.length) B.forEach(function (b, r) {
        var k = cls.get(r), top = b[1] > 52.5; if (k[0] !== 'ramps' || (!top && Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]) > 1.2)) return; var px = (b[0] + b[3]) / 2, pz = (b[2] + b[5]) / 2;
        for (var q = 0; q < TUBES.length; q++) { var T = TUBES[q], d = Math.hypot(px - T[0], pz - T[1]); if (d <= T[2] && (top || d >= T[2] - 1.3)) { var key = 'elevators|' + TUBE.name; if (!K[key]) K[key] = ['elevators', TUBE]; cls.set(r, K[key]); return; } }
      });
      // per triangle: inside the glass, long narrow strips are the frame (black metal); in the ramps, tall upright faces are the
      // tunnel walls (glass)
      function W3(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
      function bucket(part, mat) { var key = part + '|' + mat.name; return K[key] || (K[key] = [part, mat]); }
      for (var t2 = 0; t2 < ix.length; t2 += 3) {
        var k2 = cls.get(f(ix[t2]));
        if (k2[1] === GLASS || k2[1] === RAMP) {   // (the tubes' curved glass is cut in thin facets, so it is left whole)
          var A = W3(ix[t2]), Bv = W3(ix[t2 + 1]), Cv = W3(ix[t2 + 2]), e1 = Math.hypot(A[0] - Bv[0], A[1] - Bv[1], A[2] - Bv[2]), e2 = Math.hypot(Bv[0] - Cv[0], Bv[1] - Cv[1], Bv[2] - Cv[2]), e3 = Math.hypot(Cv[0] - A[0], Cv[1] - A[1], Cv[2] - A[2]);
          var ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2], vx = Cv[0] - A[0], vy = Cv[1] - A[1], vz = Cv[2] - A[2], cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx, ar = Math.hypot(cx, cy, cz), alt = ar / Math.max(e1, e2, e3, 1e-6);
          var span = Math.max(A[1], Bv[1], Cv[1]) - Math.min(A[1], Bv[1], Cv[1]), up = ar > 1e-9 ? Math.abs(cy) / ar : 1;
          if (k2[1] !== RAMP) { var zc = (A[2] + Bv[2] + Cv[2]) / 3; if (alt < .16 && Math.max(e1, e2, e3) > .5 && zc > -47.4 && zc < 37.3) k2 = bucket(k2[0], FRAME); }   // the rounded ends are curved glass in thin facets: left whole
          else if (up < .3 && span > .3 && alt > .1) k2 = bucket('ramps', GLASS);   // tunnel walls (slab edges are under 0.3 m)
        }
        var L = lists.get(k2); if (!L) { L = []; lists.set(k2, L); } L.push(ix[t2], ix[t2 + 1], ix[t2 + 2]);
      }
      lists.forEach(function (L, k3) {
        var ng = new (g.constructor)(); Object.keys(g.attributes).forEach(function (a) { ng.setAttribute(a, g.attributes[a]); });
        ng.setIndex(new (g.index.constructor)(n > 65535 ? new Uint32Array(L) : new Uint16Array(L), 1)); ng.boundingBox = g.boundingBox; ng.boundingSphere = g.boundingSphere;
        var mesh = new (o.constructor)(ng, k3[1]); mesh.name = 'Allure ' + k3[0] + ' ' + o.name; mesh.matrixAutoUpdate = false; mesh.matrix.copy(o.matrix); mesh.matrixWorld.copy(o.matrixWorld);
        mesh.castShadow = !k3[1].transparent; mesh.receiveShadow = true; if (k3[1].transparent) mesh.renderOrder = 2;
        o.parent.add(mesh); parts[k3[0]].push(mesh);
      });
      o.visible = false; o.userData.noWalk = true;
    });
    // ---- panel: PROJECT PARTS ----
    var panel = document.querySelector('.building-panel'), sel = document.getElementById('pp-context');
    var lab = sel && sel.closest('label'); if (lab && lab.firstChild && lab.firstChild.nodeType === 3) lab.firstChild.textContent = 'Cruise ship';
    var css = document.createElement('style');
    css.textContent = '.building-panel .al-parts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}.building-panel .al-parts button{min-height:34px;white-space:normal;line-height:1.15}' +
      '.building-panel .al-parts .al-wide{grid-column:1/-1}';
    document.head.appendChild(css);
    var head = document.createElement('small'); head.textContent = 'PROJECT PARTS'; head.style.cssText = 'display:block;margin-top:10px';
    var box = document.createElement('div'); box.className = 'pp-viewbar al-parts'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Project parts');
    function toggle(label, title, get, set) { var b = document.createElement('button'); b.type = 'button'; b.title = title; function sync() { var on = get(); b.textContent = label + (on ? ': on' : ': off'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } b.addEventListener('click', function () { set(!get()); sync(); ctx.controls.dispatchEvent({ type: 'change' }); }); sync(); b.sync = sync; return b; }
    function shipOn() { return sel ? sel.value !== 'hidden' : !!(ship && ship.visible); }
    function setShip(on) { if (sel) { sel.value = on ? 'solid' : 'hidden'; sel.dispatchEvent(new Event('change', { bubbles: true })); } else if (ship) ship.visible = on; }
    var shipB = toggle('Cruise ship', 'Show or hide the ship around the installation', shipOn, setShip);
    if (sel) sel.addEventListener('change', function () { shipB.sync(); });
    var iso = document.createElement('button'); iso.type = 'button'; iso.className = 'al-wide'; iso.textContent = 'Isolate the installation'; iso.title = 'Hide the ship and frame the tank, elevators and ramps';
    iso.addEventListener('click', function () {
      setShip(false); shipB.sync(); Object.keys(parts).forEach(function (k) { parts[k].forEach(function (m) { m.visible = true; }); }); btns.forEach(function (b) { b.sync(); });
      var c = ctx.camera; c.position.set(70, 88, 78); ctx.controls.target.set(0, 42, -5); ctx.controls.update && ctx.controls.update(); ctx.controls.dispatchEvent({ type: 'change' });
    });
    function partToggle(k, label, title) { return toggle(label, title, function () { return parts[k].some(function (m) { return m.visible; }); }, function (on) { parts[k].forEach(function (m) { m.visible = on; }); }); }
    var btns = [partToggle('tank', 'Tank enclosure', 'The glass aquarium, its frame and water'), partToggle('elevators', 'Elevators', 'The four glass tube elevators'), partToggle('ramps', 'Ramps', 'The ramps and decks through the tank')];
    box.appendChild(iso); box.appendChild(shipB); btns.forEach(function (b) { box.appendChild(b); });
    var anchor = document.querySelector('.building-panel .pc-secs') || document.querySelector('.building-panel .pc-tour');
    if (anchor) { anchor.parentNode.insertBefore(head, anchor.nextSibling); head.parentNode.insertBefore(box, head.nextSibling); } else { panel.appendChild(head); panel.appendChild(box); }
    // phones: a Ship button in the bottom bar cycles the ship solid -> faded -> hidden (hidden also frames the installation)
    (function mobileShip() {
      var bar = document.querySelector('.mm-bottom'); if (!bar) { if ((mobileShip.n = (mobileShip.n || 0) + 1) < 40) setTimeout(mobileShip, 500); return; }
      if (!sel || bar.querySelector('[data-al-ship]')) return;
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-al-ship', ''); var ic = document.createElement('span'); ic.setAttribute('aria-hidden', 'true'); var tx = document.createElement('span'); b.appendChild(ic); b.appendChild(tx);
      var ORDER = ['solid', 'faded', 'hidden'], NAME = { solid: 'Ship on', faded: 'Ship faded', hidden: 'Ship off' }, ICON = { solid: '⛴', faded: '◌', hidden: '⊘' };
      function sync() { var v = sel.value; ic.textContent = ICON[v] || '⛴'; tx.textContent = NAME[v] || 'Ship'; b.setAttribute('aria-pressed', v !== 'solid' ? 'true' : 'false'); b.title = 'Cruise ship: ' + v + ' (tap to change)'; }
      b.addEventListener('click', function () { var v = ORDER[(ORDER.indexOf(sel.value) + 1) % 3]; if (v === 'hidden') iso.click(); else { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); } shipB.sync(); sync(); });
      sel.addEventListener('change', sync); sync();
      bar.insertBefore(b, bar.querySelector('[data-mm-mode="menu"]')); bar.style.gridTemplateColumns = 'repeat(' + bar.children.length + ',minmax(0,1fr))';
    })();
    ctx.controls.dispatchEvent({ type: 'change' });
    window.allureParts = { parts: parts, counts: { tank: parts.tank.length, elevators: parts.elevators.length, ramps: parts.ramps.length } };
  }
})();
