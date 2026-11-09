/* North Beach Youth Center: the project control panel, reorganised.
   - The bottom-left model buttons and the Levels toggle are gone from view; Fit and Expand join the 3D / Plan / N S E W bar.
     The original buttons stay in the page, hidden, so everything they drive keeps working; the new ones just click them.
   - A second bar, GUIDED TOUR, sits under it in the same style: Stops (the camera tour of the project's areas), Sections (preset
     section cuts, each with a label) and Walk-through (the eye-level walk from nbyc-tour.js).
   - The tabs read Views, Plans, Layers (Layers has the most buttons, so it goes last). */
(function () {
  function ready() { return document.querySelector('.pp-viewbar') && document.querySelector('nav.view-tools') && window.daylightContext && window.nbycIfc && window.nbycTour; }
  (function wait() { if (ready()) init(); else setTimeout(wait, 300); })();

  function btn(label, title, onClick) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (title) b.title = title; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', onClick); return b; }

  // layout: every row fills the panel's width and stays inside its padding (the shared .pp-viewbar grid is six fixed columns)
  var css = document.createElement('style');
  css.textContent =
    '.building-panel .pp-viewbar{box-sizing:border-box;max-width:100%;min-width:0}' +
    '.building-panel .pp-viewbar>*{min-width:0}' +
    '.building-panel .pp-viewbar.nb-views{grid-template-columns:repeat(4,minmax(0,1fr))}' +
    '.building-panel .pp-viewbar.nb-tour{grid-template-columns:repeat(4,minmax(0,1fr))}' +
    '.building-panel .pp-viewbar.nb-tour>button{white-space:normal;line-height:1.15;padding-left:2px;padding-right:2px}' +
    '.building-panel .pp-viewbar.nb-secs{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:6px}' +
    '.building-panel .pp-viewbar.nb-secs[hidden]{display:none!important}' +
    '.building-panel .nb-player{margin-top:6px;padding:8px;border:1.5px solid #4d4953;border-radius:10px;background:#1f1d22;box-sizing:border-box;max-width:100%}' +
    '.building-panel .nb-player[hidden]{display:none!important}' +
    '.building-panel .nb-prow{display:grid;grid-template-columns:34px minmax(0,1fr) 38px;gap:8px;align-items:center}' +
    '.building-panel .nb-prow>button{min-height:30px;padding:0}' +
    '.building-panel .nb-line{position:relative;height:22px;cursor:pointer}' +
    '.building-panel .nb-line:before{content:"";position:absolute;left:0;right:0;top:9px;height:4px;border-radius:2px;background:#4d4953}' +
    '.building-panel .nb-fill{position:absolute;left:0;top:9px;height:4px;border-radius:2px;background:#e0567f;pointer-events:none}' +
    '.building-panel .nb-marks{position:absolute;inset:0}' +
    '.building-panel .nb-mark{position:absolute;top:4px;width:10px;height:14px;margin-left:-5px;padding:0;border:0;border-radius:3px;background:#f2f0f4;cursor:pointer;opacity:.85}' +
    '.building-panel .nb-mark:hover,.building-panel .nb-mark.on{background:#e0567f;opacity:1}' +
    '.building-panel .nb-now{margin-top:6px;font:700 12px Archivo,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#f2f0f4;min-height:15px}' +
    '.building-panel .nb-time{display:block;margin-top:2px;font:500 11px Archivo,system-ui,sans-serif;color:#a9a4ae}' +
    '.building-panel .pp-viewbar.nb-plans{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:6px}' +
    '.building-panel .pp-viewbar.nb-plans[hidden]{display:none!important}' +
    '.building-panel .pp-viewbar.nb-plans>button{white-space:normal;line-height:1.15;padding-left:2px;padding-right:2px;font-size:11px}' +
    '.building-panel .pp-viewbar.nb-secs>button{white-space:normal;line-height:1.15;min-height:34px}' +
    '.building-panel .pp-viewbar.nb-secs>label{grid-column:1/-1}' +
    '.building-panel .pp-viewbar.nb-secs>label[hidden]{display:none!important}';
  document.head.appendChild(css);

  function init() {
    var ctx = window.daylightContext, vt = document.querySelector('nav.view-tools'), vb = document.querySelector('.pp-viewbar');
    var find = function (re) { return Array.prototype.find.call(vt.querySelectorAll('button'), function (b) { return re.test(b.textContent); }); };
    var fit = document.getElementById('fit-button'), expand = document.getElementById('expand-button'), walk = find(/walk-through|stop walk|preparing/i), levels = find(/^levels$/i);
    if (levels && levels.getAttribute('aria-pressed') === 'true') levels.click();    // levels off for good
    vt.hidden = true; vb.classList.add('nb-views'); vt.style.setProperty('display', 'none', 'important');

    // Fit and Expand on the view bar
    vb.appendChild(btn('Fit', 'Fit the whole model in view', function () { fit && fit.click(); }));
    var ex = btn('Expand', 'Full-screen model', function () { expand && expand.click(); ex.setAttribute('aria-pressed', ex.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });
    vb.appendChild(ex);

    // the guided tour bar
    var tourOld = document.querySelector('.pp-tour');
    var head = document.createElement('small'); head.textContent = 'GUIDED TOUR'; head.style.cssText = 'display:block;margin-top:10px';
    var gb = document.createElement('div'); gb.className = 'pp-viewbar nb-tour'; gb.setAttribute('role', 'group'); gb.setAttribute('aria-label', 'Guided tour');
    var stops = btn('Stops', 'Fly to each part of the project in turn', function () { if (tourOld) tourOld.click(); });
    var secs = btn('Sections', 'Preset section cuts through the building', function () { var on = secRow.hidden; secRow.hidden = !on; secs.setAttribute('aria-pressed', on ? 'true' : 'false'); if (!on) cut(null); });
    var wk = btn('Walk-through', 'Walk from the street through the building, at eye level', function () { walk && walk.click(); });
    var fly = find(/fly-through|stop flight/i);
    var fl = btn('Fly-through', 'Glide freely through the project, like the render video', function () { fly && fly.click(); });
    gb.appendChild(stops); gb.appendChild(secs); gb.appendChild(wk); gb.appendChild(fl);
    /* the player: under the Guided tour bar while the walk or the fly-through plays. Play/pause, a timeline with a marker at each
       named stop (click a marker or anywhere on the line to jump there), the time, and 1x / 2x speed. */
    var player = document.createElement('div'); player.className = 'nb-player'; player.hidden = true;
    var pBtn = btn('❚❚', 'Pause / play', function () { var T = window.nbycTour; if (T) T.pause(); });
    var line = document.createElement('div'); line.className = 'nb-line'; var fill = document.createElement('div'); fill.className = 'nb-fill'; line.appendChild(fill);
    var marks = document.createElement('div'); marks.className = 'nb-marks'; line.appendChild(marks);
    var now = document.createElement('div'); now.className = 'nb-now';
    var tm = document.createElement('span'); tm.className = 'nb-time';
    var spd = btn('1×', 'Playback speed', function () { var T = window.nbycTour; if (!T) return; var v = T.state().speed === 2 ? 1 : 2; T.setSpeed(v); spd.textContent = v + '×'; spd.setAttribute('aria-pressed', v === 2 ? 'true' : 'false'); });
    var row1 = document.createElement('div'); row1.className = 'nb-prow'; row1.appendChild(pBtn); row1.appendChild(line); row1.appendChild(spd);
    player.appendChild(row1); player.appendChild(now); player.appendChild(tm);
    line.addEventListener('click', function (ev) { if (ev.target.closest('.nb-mark')) return; var T = window.nbycTour; if (!T) return; var r = line.getBoundingClientRect(), st = T.state(); T.seek((ev.clientX - r.left) / r.width * st.total); });
    var markKey = '';
    function fmt(x) { x = Math.max(0, x | 0); return (x / 60 | 0) + ':' + ('0' + x % 60).slice(-2); }
    (function tick() {
      var T = window.nbycTour, st = T && T.state();
      if (st && st.playing) {
        player.hidden = false; pBtn.textContent = st.paused ? '▶' : '❚❚';
        fill.style.width = (100 * st.t / (st.total || 1)) + '%';
        tm.textContent = st.paused ? 'Paused: drag to look around, W A S D to walk, Q / E down / up' : fmt(st.t) + ' / ' + fmt(st.total) + (st.mode === 'fly' ? '  ·  fly-through' : '  ·  walk-through');
        var key = st.mode + st.total.toFixed(1) + st.markers.length;
        if (key !== markKey && st.total) {
          markKey = key; marks.innerHTML = '';
          st.markers.forEach(function (m) {
            var d = document.createElement('button'); d.type = 'button'; d.className = 'nb-mark'; d.title = m.label + ' (' + fmt(m.t) + ')'; d.setAttribute('aria-label', 'Jump to ' + m.label);
            d.style.left = (100 * m.t / st.total) + '%'; d.addEventListener('click', function () { window.nbycTour.seek(m.t); }); marks.appendChild(d);
          });
        }
        var cur = null; st.markers.forEach(function (m) { if (m.t <= st.t + .3) cur = m; });
        now.textContent = cur ? cur.label : '';
        Array.prototype.forEach.call(marks.children, function (d, i) { d.classList.toggle('on', st.markers[i] === cur); });
      } else if (!player.hidden) { player.hidden = true; markKey = ''; }
      requestAnimationFrame(tick);
    })();
    if (fly) new MutationObserver(function () { var on = /stop/i.test(fly.textContent); fl.textContent = on ? 'Stop flight' : 'Fly-through'; fl.setAttribute('aria-pressed', on ? 'true' : 'false'); }).observe(fly, { childList: true, characterData: true, subtree: true });
    // keep the walk button's state in step with the tour script's own (it says "Stop walk" while playing)
    if (walk) new MutationObserver(function () { var playing = /stop|preparing/i.test(walk.textContent); wk.textContent = playing ? (/preparing/i.test(walk.textContent) ? 'Preparing…' : 'Stop walk') : 'Walk-through'; wk.setAttribute('aria-pressed', playing ? 'true' : 'false'); }).observe(walk, { childList: true, characterData: true, subtree: true });

    // section presets: a cutting plane through the whole scene, with a label saying where the cut is
    var V3 = ctx.camera.position.constructor, G = 34.6;
    var SEC = [
      // the section views drawn in the Revit model (read with tools/revit_views.py), each cut where Revit cuts it and seen from its side
      ['N-S Section', 'Revit section, sheet A 07: lengthwise through the building', [0, 0, 1], -53.4, [-45, 48, -36], [-45, 42, 53.4]],
      ['Funnel Section', 'Revit section, sheet A 06: lengthwise through the glass funnels, looking north', [0, 0, -1], 53.4, [-44.5, 48, 143], [-44.5, 42, 53.4]],
      ['E-W Section', 'Revit section, sheet A 08: across the middle of the building', [1, 0, 0], 38.31, [-108, 48, 52.6], [-38.3, 42, 52.6]],
      ['Class room Section', 'Revit section, sheet A504: through the classroom pod', [0, 0, -1], 27.3, [-29.2, 48, 72], [-29.2, 44, 27.3]],
      ['Class room cross', 'Revit section, sheet A 22: across the classroom pod', [-1, 0, 0], -28.7, [2, 48, 27.3], [-28.7, 45, 27.3]],
      ['Wall section', 'Revit section, sheet A 19: through the facade wall', [-1, 0, 0], -49.56, [-28, 42, 62.4], [-49.6, 41, 62.4]],
    ];
    /* ---- plans: your drawn plan for each level, draped onto the model ----
       Placement was fitted to the model itself (about 4,200 points along the walls cut at 1.5 m: scale 18.83 / 18.78 px per metre,
       no rotation, pinned at the west funnel). The drawing is laid onto the real surface under the cut in 0.4 m tiles that follow
       each surface's slope, so the skate bowl, the raised juice bar and the ramps all carry their part of the drawing at their own
       height. The building's program areas keep the drawing with its white; outside them only the linework stays, on the ground,
       with no white over streets or paving and nothing past the curbs. */
    var PLANS = [   // your drawings: Grade plan, Level 2 (rooms 18-29), Level 3 (gymnastics hall and top garden, 30-36), roof
      { key: 'ground', fit: [504.438, 853.719, 18.83, 18.801], name: 'Ground', floor: G, cut: G + 2.1, sub: 'Grade plan, cut 2.1 m (7 ft) above grade' },
      { key: 'classroom', fit: [512.438, 853.813, 18.832, 18.804], name: 'Level 2', floor: 40.1, cut: 41.3, sub: 'Level 2 plan (+5.5 m): table tennis, lockers, offices' },
      { key: 'level3', fit: [508.344, 854.031, 18.832, 18.861], name: 'Level 3', floor: 45.6, cut: 46.8, sub: 'Level 3 plan (+11 m): gymnastics hall, bleachers, top garden' },
      { key: 'roof', fit: [509.219, 861.125, 18.779, 18.682], name: 'Roof', floor: 53.5, cut: 200, sub: 'Roof plan, the whole building from above' }
    ];
    var FIT = { ox: 504.5, oy: 853.875, sx: 18.83178, sz: 18.78178, rot: -0.0008, qx: -76.81, qz: 53.40 }, CB = [194, 194, 2167, 1298];
    function toPix(x, z) { var c = Math.cos(FIT.rot), s = Math.sin(FIT.rot), dx = (x - FIT.qx) * FIT.sx, dz = (z - FIT.qz) * FIT.sz; return [FIT.ox + c * dx - s * dz - CB[0], FIT.oy + s * dx + c * dz - CB[1]]; }
    var SITE = { x0: -95, x1: 9.5, z0: 17.5, z1: 78.2 }, GX0 = -96, GZ0 = 16, CS = .25, GNX = 432, GNZ = 256;   // 0.25 m tiles: fine enough that floor edges don't step visibly
    var drape = null, drapeCache = {}, planOn = null;
    function revitTris(fn) { ctx.scene.traverse(function (o) { if (o.isMesh && o.userData.ifc && !/Glazing/.test(o.name) && o.geometry.attributes.position) fn(o.geometry.attributes.position.array); }); }
    function surfaceUnder(cut) {      // per 0.4 m cell: the plane of the top up-facing surface below the cut
      var n = GNX * GNZ, H = new Float32Array(n).fill(-1e9), PA = new Float32Array(n), PB = new Float32Array(n), PC = new Float32Array(n);
      revitTris(function (A) {
        for (var k = 0; k < A.length; k += 9) {
          var ax = A[k], ay = A[k + 1], az = A[k + 2], bx = A[k + 3], by = A[k + 4], bz = A[k + 5], cx = A[k + 6], cy = A[k + 7], cz = A[k + 8];
          if (Math.max(ay, by, cy) > cut - .15) continue;
          var ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
          if (l < 1e-8 || Math.abs(ny) / l < .8) continue;
          var pa = -nx / ny, pb = -nz / ny, pc = ay - pa * ax - pb * az, d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue;
          var gx0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - GX0) / CS)), gx1 = Math.min(GNX - 1, Math.floor((Math.max(ax, bx, cx) - GX0) / CS));
          var gz0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - GZ0) / CS)), gz1 = Math.min(GNZ - 1, Math.floor((Math.max(az, bz, cz) - GZ0) / CS));
          for (var gx = gx0; gx <= gx1; gx++) for (var gz = gz0; gz <= gz1; gz++) {
            var px = GX0 + (gx + .5) * CS, pz = GZ0 + (gz + .5) * CS, l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
            if (l1 < -.02 || l2 < -.02 || l3 < -.02) continue; var h = l1 * ay + l2 * by + l3 * cy, c = gz * GNX + gx; if (h > H[c]) { H[c] = h; PA[c] = pa; PB[c] = pb; PC[c] = pc; }
          }
        }
      });
      return { H: H, PA: PA, PB: PB, PC: PC };
    }
    function buildDrape(P, img, done) {
      // each sheet was exported with its own slight crop, so each carries its own fitted placement (walls of its own floor)
      FIT.ox = P.fit[0]; FIT.oy = P.fit[1]; FIT.sx = P.fit[2]; FIT.sz = P.fit[3]; FIT.rot = 0;
      var S = surfaceUnder(P.cut), W = CB[2] - CB[0], Hh = CB[3] - CB[1];
      // program areas (keep the white): ground = canopy outline, rotunda, skate park, pod and its entrance, back of house, anything
      // roofed; upper levels = wherever that level's floor exists
      var mc = document.createElement('canvas'); mc.width = W; mc.height = Hh; var mg = mc.getContext('2d'); mg.fillStyle = '#fff';
      function poly(pts) { mg.beginPath(); pts.forEach(function (p, i) { var c = toPix(p[0], p[1]); if (i) mg.lineTo(c[0], c[1]); else mg.moveTo(c[0], c[1]); }); mg.closePath(); mg.fill(); }
      function rr(x0, z0, x1, z1) { poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]); }
      function circ(x, z, r) { var c = toPix(x, z); mg.beginPath(); mg.ellipse(c[0], c[1], r * FIT.sx, r * FIT.sz, 0, 0, 7); mg.fill(); }
      if (P.key === 'ground') {
        var r = 12.82; rr(-89.61 + r, 40.6, 1.34 - r, 66.23); circ(-89.61 + r, 53.41, r); circ(1.34 - r, 53.41, r); circ(-10.6, 54.2, 14.2);
        rr(-89.8, 22, -48.8, 34.3); rr(-37.5, 28, -18, 42); rr(-10.5, 19.2, -1.8, 24.2); rr(-44.3, 20.2, -11.2, 34.5);
        revitTris(function (A) { for (var k = 0; k < A.length; k += 9) if (Math.min(A[k + 1], A[k + 4], A[k + 7]) >= 43.5) poly([[A[k], A[k + 2]], [A[k + 3], A[k + 5]], [A[k + 6], A[k + 8]]]); });
      } else {
        // traced from the floor's own triangles (smooth edges), not from the grid
        revitTris(function (A) { for (var k = 0; k < A.length; k += 9) { var ys = [A[k + 1], A[k + 4], A[k + 7]], lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys); if (lo < P.floor - .8 || hi > P.cut - .15) continue; var ux = A[k + 3] - A[k], uy = A[k + 4] - A[k + 1], uz = A[k + 5] - A[k + 2], vx = A[k + 6] - A[k], vy = A[k + 7] - A[k + 1], vz = A[k + 8] - A[k + 2], ny = uz * vx - ux * vz, l = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx); if (l < 1e-8 || Math.abs(ny) / l < .8) continue; poly([[A[k], A[k + 2]], [A[k + 3], A[k + 5]], [A[k + 6], A[k + 8]]]); } });
      }
      // feather the white edge by a couple of pixels so it never reads as stair-stepped
      var mf = document.createElement('canvas'); mf.width = W; mf.height = Hh; var mfg = mf.getContext('2d'); mfg.filter = 'blur(2px)'; mfg.drawImage(mc, 0, 0);
      var md = mfg.getImageData(0, 0, W, Hh).data, gc = document.createElement('canvas'); gc.width = W; gc.height = Hh; var gg = gc.getContext('2d'); gg.drawImage(img, 0, 0);
      var src = gg.getImageData(0, 0, W, Hh), out = gg.createImageData(W, Hh), sA = toPix(SITE.x0, SITE.z0), sB = toPix(SITE.x1, SITE.z1);
      for (var y = 0; y < Hh; y++) for (var x2 = 0; x2 < W; x2++) {
        var i = (y * W + x2) * 4, R = src.data[i], Gc = src.data[i + 1], B = src.data[i + 2];
        var w = md[i + 3] / 255, inSite = x2 > sA[0] && x2 < sB[0] && y > sA[1] && y < sB[1];
        var lum = R * .3 + Gc * .59 + B * .11, la = inSite ? Math.max(0, Math.min(1, (185 - lum) / 80)) : 0, lv = 35 + lum * .15;
        // blend: inside the program areas the drawing with its white, outside only its lines, mixed across the feathered edge
        var oa = w * (232 / 255) + (1 - w) * la; out.data[i + 3] = Math.round(oa * 255);
        if (oa > 0) { out.data[i] = Math.round((w * (232 / 255) * R + (1 - w) * la * lv) / oa); out.data[i + 1] = Math.round((w * (232 / 255) * Gc + (1 - w) * la * lv) / oa); out.data[i + 2] = Math.round((w * (232 / 255) * B + (1 - w) * la * lv) / oa); }
      }
      gg.putImageData(out, 0, 0);
      // the draped tiles: inside the program areas on their own surface; outside, on the ground
      var P3 = [], UV = [];
      for (var gz2 = 0; gz2 < GNZ; gz2++) for (var gx2 = 0; gx2 < GNX; gx2++) {
        var cc = gz2 * GNX + gx2, x0 = GX0 + gx2 * CS, x1 = x0 + CS, z0 = GZ0 + gz2 * CS, z1 = z0 + CS;
        if (x1 < SITE.x0 - 1 || x0 > SITE.x1 + 1 || z1 < SITE.z0 - 1 || z0 > SITE.z1 + 1) continue;
        var has = S.H[cc] > -1e8, hb = has ? S.H[cc] : G;
        var hy = function (px, pz) { return (has ? Math.min(hb + .25, Math.max(hb - .25, S.PA[cc] * px + S.PB[cc] * pz + S.PC[cc])) : G) + .04; };
        [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]].forEach(function (p) { var pp = toPix(p[0], p[1]); P3.push(p[0], hy(p[0], p[1]), p[1]); UV.push(pp[0] / W, 1 - pp[1] / Hh); });
      }
      var any = null; ctx.scene.traverse(function (o) { if (!any && o.isMesh && o.userData.ifc) any = o; });
      var Geo = any.geometry.constructor, Attr = any.geometry.attributes.position.constructor, g = new Geo(), N = new Float32Array(P3.length);
      for (var k3 = 1; k3 < N.length; k3 += 3) N[k3] = 1;
      g.setAttribute('position', new Attr(new Float32Array(P3), 3)); g.setAttribute('normal', new Attr(N, 3)); g.setAttribute('uv', new Attr(new Float32Array(UV), 2));
      var TexC = null; ctx.scene.traverse(function (o) { if (!TexC && o.material && o.material.map) TexC = o.material.map.constructor; });
      var t = new TexC(gc); t.colorSpace = 'srgb'; t.anisotropy = 8; t.needsUpdate = true;
      done({ geo: g, tex: t });
    }
    function showPlan(i) {
      planBtns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      secBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      if (drape) drape.visible = false;
      if (i === null) { planOn = null; ctx.renderer.clippingPlanes = []; label.hidden = true; ctx.controls.dispatchEvent({ type: 'change' }); return; }
      var P = PLANS[i]; planOn = i;
      plane.normal.set(0, -1, 0); plane.constant = P.cut; ctx.renderer.clippingPlanes = [plane];
      var cam = ctx.camera, half = Math.tan(cam.fov * Math.PI / 360), cx = (SITE.x0 + SITE.x1) / 2, cz = (SITE.z0 + SITE.z1) / 2, h = Math.max((SITE.z1 - SITE.z0) * .62 / half, (SITE.x1 - SITE.x0) * .62 / (half * (cam.aspect || 1.5))) * 1.35;   // a little extra so the panel doesn't cover the east end
      cam.position.set(cx, P.floor + h, cz + .01); ctx.controls.target.set(cx, P.floor, cz); if (cam.far < h + 200) { cam.far = h + 200; cam.updateProjectionMatrix(); } ctx.controls.update && ctx.controls.update();
      label.innerHTML = ''; var b1 = document.createElement('div'); b1.textContent = (P.name + ' plan').toUpperCase(); var b2 = document.createElement('div'); b2.textContent = P.sub; b2.style.cssText = 'font-weight:400;opacity:.85;letter-spacing:0'; label.appendChild(b1); label.appendChild(b2); label.hidden = false;
      function put(d) {
        if (planOn !== i) return;
        if (!drape) {
          var base = null; ctx.scene.traverse(function (o) { if (!base && o.isMesh && o.material && o.material.isMeshStandardMaterial) base = o.material; });
          var m = base.clone(); m.onBeforeCompile = function () {}; m.customProgramCacheKey = function () { return 'nbyc-plan-drape'; };
          m.color.set('#000000'); m.emissive.set('#ffffff'); m.normalMap = null; m.roughnessMap = null; m.aoMap = null; m.metalness = 0; m.roughness = 1; m.toneMapped = false;
          m.transparent = true; m.alphaTest = .03; m.depthTest = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -6; m.polygonOffsetUnits = -6; m.side = 2;
          drape = new any0.constructor(d.geo, m); drape.name = 'NBYC plan drape'; drape.renderOrder = 5; drape.frustumCulled = false; ctx.scene.add(drape);
        }
        drape.geometry = d.geo; drape.material.map = d.tex; drape.material.emissiveMap = d.tex; drape.material.opacity = 1; drape.material.needsUpdate = true; drape.visible = true;
        ctx.controls.dispatchEvent({ type: 'change' });
      }
      var any0 = null; ctx.scene.traverse(function (o) { if (!any0 && o.isMesh && o.userData.ifc) any0 = o; });
      if (drapeCache[P.key]) { put(drapeCache[P.key]); return; }
      var img = new Image(); img.onload = function () { setTimeout(function () { buildDrape(P, img, function (d) { drapeCache[P.key] = d; put(d); }); }, 20); };
      img.src = '../../portfolio-assets/textures/nbyc/plans/' + P.key + '.webp';
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    var planBtns = [];
    var secRow = document.createElement('div'); secRow.className = 'pp-viewbar nb-secs'; secRow.hidden = true;
    var label = document.createElement('div');
    label.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);background:rgba(20,20,22,.8);color:#fff;font:600 12px/1.3 system-ui,sans-serif;letter-spacing:.05em;padding:8px 14px;border-radius:10px;pointer-events:none;z-index:30;text-align:center;max-width:80vw';
    label.hidden = true; document.body.appendChild(label);
    var plane = { normal: new V3(), constant: 0 }, secBtns = [];
    function cut(i) {
      secBtns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      if (drape) drape.visible = false; planOn = null; planBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      if (i === null || i === undefined) { ctx.renderer.clippingPlanes = []; label.hidden = true; ctx.controls.dispatchEvent({ type: 'change' }); return; }
      var s = SEC[i]; plane.normal.set(s[2][0], s[2][1], s[2][2]); plane.constant = s[3];
      ctx.renderer.clippingPlanes = [plane]; ctx.renderer.localClippingEnabled = true;
      ctx.camera.position.set(s[4][0], s[4][1], s[4][2]); ctx.controls.target.set(s[5][0], s[5][1], s[5][2]);
      ctx.controls.update && ctx.controls.update();
      label.innerHTML = ''; var b1 = document.createElement('div'); b1.textContent = s[0].toUpperCase(); var b2 = document.createElement('div'); b2.textContent = s[1]; b2.style.cssText = 'font-weight:400;opacity:.85;letter-spacing:0'; label.appendChild(b1); label.appendChild(b2); label.hidden = false;
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    SEC.forEach(function (s, i) { var b = btn(s[0], s[1], function () { cut(b.getAttribute('aria-pressed') === 'true' ? null : i); }); secBtns.push(b); secRow.appendChild(b); });
    secRow.appendChild(btn('Clear cut', 'Show the whole model again', function () { cut(null); }));
    // the plan level bar: pops up under the view bar when Plan is chosen
    var planRow = document.createElement('div'); planRow.className = 'pp-viewbar nb-plans'; planRow.setAttribute('role', 'group'); planRow.setAttribute('aria-label', 'Plan levels'); planRow.hidden = true;
    PLANS.forEach(function (P, i) { var b = btn(P.name, P.sub, function () { showPlan(i); }); planBtns.push(b); planRow.appendChild(b); });
    vb.parentNode.insertBefore(planRow, vb.nextSibling);
    var vbMain = vb;
    vbMain.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-v]'); if (!b) return;
      if (b.getAttribute('data-v') === 'top') {
        planRow.hidden = false;
        // let the viewer switch to its plan mode, then lay the ground plan in
        var last = null, n = 0; (function settle() { var p = ctx.camera.position, s = p.x.toFixed(2) + p.y.toFixed(2) + p.z.toFixed(2); if ((s === last && n > 3) || n > 40) showPlan(planOn === null ? 0 : planOn); else { last = s; n++; setTimeout(settle, 60); } })();
      } else { planRow.hidden = true; if (planOn !== null) showPlan(null); }
    });

    var anchor = tourOld || vb; anchor.parentNode.insertBefore(head, anchor.nextSibling); head.parentNode.insertBefore(gb, head.nextSibling); gb.parentNode.insertBefore(player, gb.nextSibling); player.parentNode.insertBefore(secRow, player.nextSibling);
    if (tourOld) tourOld.hidden = true;

    // tabs: Views, Plans, Layers -- and open on Views
    var tabs = document.querySelector('.tabs[role="tablist"]');
    if (tabs) {
      ['views', 'plans', 'layers'].forEach(function (k) { var t = tabs.querySelector('[data-t="' + k + '"]'); if (t) tabs.appendChild(t); });
      var v = tabs.querySelector('[data-t="views"]'); if (v && v.getAttribute('aria-selected') !== 'true') v.click();
    }
    /* N / S / E / W elevations: taken from the site boundary on that side (north from the alley, south from the avenue, west and
       east from their streets), so the neighbours in front are cut away and only the project shows, framed tight on the building */
    var B = { x0: -93, x1: 5, z0: 18, z1: 73, y0: 34.4, y1: 55.5 }, BC = [(B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2];
    /* from the Revit elevation markers (tools/revit_views.py): Revit's project north is turned 90 degrees from the page, so its North
       elevation looks from the page's east side (the alley). Each cut sits at the marker; framing uses the view's own crop. */
    var ELEV = {   // n/c: cutting plane (keeps the building side); dir: from the building toward the viewer; ctr, w, h: the crop
      n: { n: [-1, 0, 0], c: 2.18, dir: [1, 0, 0], ctr: [2.2, 50.3, 37.1], w: 115.8, h: 32, label: 'North elevation', sub: 'Revit elevation, sheet A 10: from the alley' },
      s: { n: [1, 0, 0], c: 98.32, dir: [-1, 0, 0], ctr: [-98.3, 50.3, 37.1], w: 115.8, h: 32, label: 'South elevation', sub: 'Revit elevation, sheet A 10' },
      e: { n: [0, 0, -1], c: 79.05, dir: [0, 0, 1], ctr: [-41.6, 50.4, 79.1], w: 115.9, h: 32, label: 'East elevation', sub: 'Revit elevation, sheet A 09: from the avenue' },
      w: { n: [0, 0, 1], c: -15.26, dir: [0, 0, -1], ctr: [-46.2, 50.3, 15.3], w: 115.8, h: 32, label: 'West elevation', sub: 'Revit elevation, sheet A 09' }
    };
    var elevPlane = { normal: new V3(), constant: 0 }, gradePlane = { normal: new V3(0, 1, 0), constant: -34.3 };   // grade: hide the piles and the sunken skate park under the cut ground
    function elevation(k) {
      var e = ELEV[k]; secBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      elevPlane.normal.set(e.n[0], e.n[1], e.n[2]); elevPlane.constant = e.c; ctx.renderer.clippingPlanes = [elevPlane, gradePlane];
      var cam = ctx.camera, half = Math.tan((cam.fov * Math.PI / 180) / 2), aspect = cam.aspect || 1.5;
      var dist = Math.max((e.w * .52) / (half * aspect), (e.h * .55) / half), c0 = e.ctr;
      cam.position.set(c0[0] + e.dir[0] * dist, c0[1], c0[2] + e.dir[2] * dist); ctx.controls.target.set(c0[0], c0[1], c0[2]);
      if (cam.far < dist + 300) { cam.far = dist + 300; cam.updateProjectionMatrix(); }
      ctx.controls.update && ctx.controls.update();
      label.innerHTML = ''; var b1 = document.createElement('div'); b1.textContent = e.label.toUpperCase(); var b2 = document.createElement('div'); b2.textContent = e.sub; b2.style.cssText = 'font-weight:400;opacity:.85;letter-spacing:0'; label.appendChild(b1); label.appendChild(b2); label.hidden = false;
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    vb.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-v]'); if (!b) return; var v = b.getAttribute('data-v');
      if (ELEV[v]) {
        // let the viewer switch into its flat elevation mode first, then wait for its camera move to settle and reframe on the building
        var last = null, n = 0;
        (function settle() { var p = ctx.camera.position, s = p.x.toFixed(2) + p.y.toFixed(2) + p.z.toFixed(2); if ((s === last && n > 3) || n > 40) elevation(v); else { last = s; n++; setTimeout(settle, 60); } })();
      } else { ctx.renderer.clippingPlanes = []; label.hidden = true; ctx.controls.dispatchEvent({ type: 'change' }); }
    });

    window.nbycPanel = { cut: cut, sections: SEC, elevation: elevation };
  }
})();
