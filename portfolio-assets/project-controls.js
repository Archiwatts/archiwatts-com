/* Project control panel, for every project page (generalised from North Beach Youth Center):
   - the bottom-left model buttons and Levels toggle leave the screen; Fit and Expand join the 3D / Plan / N S E W bar
   - a GUIDED TOUR bar in the same style: Stops (the page's camera tour), Sections, Walk-through, Fly-through
   - the player under it while a walk or flight plays: play/pause, a timeline with a marker per stop (click to jump), 1x / 2x
   - Sections: preset cuts, each with a label
   - N / S / E / W: framed on the building from its own edge (or the page's elevation markers), neighbours in front cut away
   - tabs read Views, Plans, Layers
   Configure with window.PROJECT_CONTROLS = { sections: [[name, sub, normal[3], constant, eye[3], target[3]], ...],
     elevations: { n: {n, c, dir, ctr, w, h, label, sub}, ... }, grade: y } -- anything missing is worked out from the model. */
(function () {
  var CFG = window.PROJECT_CONTROLS || {};
  function ready() { return document.querySelector('.pp-viewbar') && window.daylightContext && window.projectWalk; }
  (function wait() { if (ready()) init(); else setTimeout(wait, 300); })();
  var css = document.createElement('style');
  css.textContent =
    '.building-panel .pp-viewbar{box-sizing:border-box;max-width:100%;min-width:0}.building-panel .pp-viewbar>*{min-width:0}' +
    '.building-panel .pp-viewbar.pc-views{grid-template-columns:repeat(4,minmax(0,1fr))}' +
    '.building-panel .pp-viewbar.pc-tour{grid-template-columns:repeat(4,minmax(0,1fr))}' +
    '.building-panel .pp-viewbar.pc-tour>button,.building-panel .pp-viewbar.pc-secs>button{white-space:normal;line-height:1.15;padding-left:2px;padding-right:2px}' +
    '.building-panel .pp-viewbar.pc-secs{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:6px}.building-panel .pp-viewbar.pc-secs>button{min-height:34px}' +
    '.building-panel .pp-viewbar.pc-secs[hidden],.building-panel .pc-player[hidden]{display:none!important}' +
    '.building-panel .pc-player{margin-top:6px;padding:8px;border:1.5px solid #4d4953;border-radius:10px;background:#1f1d22;box-sizing:border-box;max-width:100%}' +
    '.building-panel .pc-prow{display:grid;grid-template-columns:34px minmax(0,1fr) 38px;gap:8px;align-items:center}.building-panel .pc-prow>button{min-height:30px;padding:0}' +
    '.building-panel .pc-line{position:relative;height:22px;cursor:pointer}.building-panel .pc-line:before{content:"";position:absolute;left:0;right:0;top:9px;height:4px;border-radius:2px;background:#4d4953}' +
    '.building-panel .pc-fill{position:absolute;left:0;top:9px;height:4px;border-radius:2px;background:#e0567f;pointer-events:none}.building-panel .pc-marks{position:absolute;inset:0}' +
    '.building-panel .pc-mark{position:absolute;top:4px;width:10px;height:14px;margin-left:-5px;padding:0;border:0;border-radius:3px;background:#f2f0f4;cursor:pointer;opacity:.85}' +
    '.building-panel .pc-mark:hover,.building-panel .pc-mark.on{background:#e0567f;opacity:1}' +
    '.building-panel .pc-now{margin-top:6px;font:700 12px Archivo,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#f2f0f4;min-height:15px}' +
    '.building-panel .pc-time{display:block;margin-top:2px;font:500 11px Archivo,system-ui,sans-serif;color:#a9a4ae}';
  document.head.appendChild(css);
  function btn(label, title, on) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (title) b.title = title; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', on); return b; }

  function init() {
    var ctx = window.daylightContext, W = window.projectWalk, vt = document.querySelector('nav.view-tools'), vb = document.querySelector('.building-panel .pp-viewbar') || document.querySelector('.pp-viewbar');
    if (!vb || vb.classList.contains('pc-views')) return;
    var V3 = ctx.camera.position.constructor, box = W.box, cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2, G = CFG.grade != null ? CFG.grade : box[1];
    // 1. bottom-left buttons off screen (kept in the page, so what they drive keeps working)
    var fit = document.getElementById('fit-button'), expand = document.getElementById('expand-button');
    if (vt) { Array.prototype.forEach.call(vt.querySelectorAll('button'), function (b) { if (/^levels$/i.test(b.textContent) && b.getAttribute('aria-pressed') === 'true') b.click(); }); vt.hidden = true; vt.style.setProperty('display', 'none', 'important'); }
    vb.classList.add('pc-views');
    if (fit) vb.appendChild(btn('Fit', 'Fit the whole model in view', function () { fit.click(); }));
    if (expand) { var ex = btn('Expand', 'Full-screen model', function () { expand.click(); ex.setAttribute('aria-pressed', ex.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); }); vb.appendChild(ex); }
    // 2. guided tour bar
    var tourOld = document.querySelector('.pp-tour'), head = document.createElement('small'); head.textContent = 'GUIDED TOUR'; head.style.cssText = 'display:block;margin-top:10px';
    var gb = document.createElement('div'); gb.className = 'pp-viewbar pc-tour'; gb.setAttribute('role', 'group'); gb.setAttribute('aria-label', 'Guided tour');
    var secs = btn('Sections', 'Preset section cuts through the building', function () { var on = secRow.hidden; secRow.hidden = !on; secs.setAttribute('aria-pressed', on ? 'true' : 'false'); if (!on) cut(null); });
    var wk = btn('Walk-through', 'Walk through the project at eye level', function () { var st = W.state(); st.playing && st.mode === 'walk' ? W.stop(true) : W.start(); });
    var fl = btn('Fly-through', 'Glide freely through and around the project', function () { var st = W.state(); st.playing && st.mode === 'fly' ? W.stop(true) : W.startFly(); });
    if (tourOld) gb.appendChild(btn('Stops', 'Fly to each part of the project in turn', function () { tourOld.click(); }));
    gb.appendChild(secs); gb.appendChild(wk); gb.appendChild(fl);
    if (!tourOld) gb.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
    // 3. player
    var player = document.createElement('div'); player.className = 'pc-player'; player.hidden = true;
    var pBtn = btn('❚❚', 'Pause / play', function () { W.pause(); }), line = document.createElement('div'); line.className = 'pc-line';
    var fill = document.createElement('div'); fill.className = 'pc-fill'; line.appendChild(fill); var marks = document.createElement('div'); marks.className = 'pc-marks'; line.appendChild(marks);
    var now = document.createElement('div'); now.className = 'pc-now'; var tm = document.createElement('span'); tm.className = 'pc-time';
    var spd = btn('1×', 'Playback speed', function () { var v = W.state().speed === 2 ? 1 : 2; W.setSpeed(v); spd.textContent = v + '×'; spd.setAttribute('aria-pressed', v === 2 ? 'true' : 'false'); });
    var row = document.createElement('div'); row.className = 'pc-prow'; row.appendChild(pBtn); row.appendChild(line); row.appendChild(spd); player.appendChild(row); player.appendChild(now); player.appendChild(tm);
    line.addEventListener('click', function (ev) { if (ev.target.closest('.pc-mark')) return; var r = line.getBoundingClientRect(); W.seek((ev.clientX - r.left) / r.width * W.state().total); });
    function fmt(x) { x = Math.max(0, x | 0); return (x / 60 | 0) + ':' + ('0' + x % 60).slice(-2); }
    var markKey = '';
    (function tick() {
      var st = W.state();
      wk.textContent = st.preparing ? 'Preparing…' : st.playing && st.mode === 'walk' ? 'Stop walk' : 'Walk-through'; wk.setAttribute('aria-pressed', st.playing && st.mode === 'walk' ? 'true' : 'false');
      fl.textContent = st.playing && st.mode === 'fly' ? 'Stop flight' : 'Fly-through'; fl.setAttribute('aria-pressed', st.playing && st.mode === 'fly' ? 'true' : 'false');
      if (st.playing) {
        player.hidden = false; pBtn.textContent = st.paused ? '▶' : '❚❚'; fill.style.width = (100 * st.t / (st.total || 1)) + '%';
        tm.textContent = st.paused ? 'Paused: drag to look around, W A S D to walk, Q / E down / up' : fmt(st.t) + ' / ' + fmt(st.total) + (st.mode === 'fly' ? '  ·  fly-through' : '  ·  walk-through');
        var key = st.mode + st.total.toFixed(1) + st.markers.length;
        if (key !== markKey && st.total) { markKey = key; marks.innerHTML = ''; st.markers.forEach(function (m) { var d = document.createElement('button'); d.type = 'button'; d.className = 'pc-mark'; d.title = m.label + ' (' + fmt(m.t) + ')'; d.setAttribute('aria-label', 'Jump to ' + m.label); d.style.left = (100 * m.t / st.total) + '%'; d.addEventListener('click', function () { W.seek(m.t); }); marks.appendChild(d); }); }
        var cur = null; st.markers.forEach(function (m) { if (m.t <= st.t + .3) cur = m; }); now.textContent = cur ? cur.label : '';
        Array.prototype.forEach.call(marks.children, function (d, i) { d.classList.toggle('on', st.markers[i] === cur); });
      } else if (!player.hidden) { player.hidden = true; markKey = ''; }
      requestAnimationFrame(tick);
    })();
    // 4. sections: the page's presets, or a long section, a cross section and a plan cut through the middle
    var label = document.createElement('div');
    label.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);background:rgba(20,20,22,.8);color:#fff;font:600 12px/1.3 system-ui,sans-serif;letter-spacing:.05em;padding:8px 14px;border-radius:10px;pointer-events:none;z-index:30;text-align:center;max-width:80vw';
    label.hidden = true; document.body.appendChild(label);
    function showLabel(a, b) { label.innerHTML = ''; var b1 = document.createElement('div'); b1.textContent = a.toUpperCase(); var b2 = document.createElement('div'); b2.textContent = b; b2.style.cssText = 'font-weight:400;opacity:.85;letter-spacing:0'; label.appendChild(b1); label.appendChild(b2); label.hidden = false; }
    var lx = box[3] - box[0], lz = box[5] - box[2], H = box[4] - box[1], R = Math.max(lx, lz);
    var SEC = CFG.sections || [
      ['Long section', 'Lengthwise through the middle', lx > lz ? [0, 0, 1] : [1, 0, 0], lx > lz ? -cz : -cx, lx > lz ? [cx, box[1] + H * .5, cz - R * 1.1] : [cx - R * 1.1, box[1] + H * .5, cz], [cx, box[1] + H * .45, cz]],
      ['Cross section', 'Across the middle', lx > lz ? [1, 0, 0] : [0, 0, 1], lx > lz ? -cx : -cz, lx > lz ? [cx - R * .9, box[1] + H * .5, cz] : [cx, box[1] + H * .5, cz - R * .9], [cx, box[1] + H * .45, cz]],
      ['Plan cut', 'Cut 1.5 m above the ground floor', [0, -1, 0], G + 1.5, [cx, G + R * 1.2, cz + .01], [cx, G, cz]]
    ];
    var secRow = document.createElement('div'); secRow.className = 'pp-viewbar pc-secs'; secRow.hidden = true;
    var plane = { normal: new V3(), constant: 0 }, secBtns = [];
    function cut(i) {
      secBtns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      if (i === null || i === undefined) { ctx.renderer.clippingPlanes = []; label.hidden = true; ctx.controls.dispatchEvent({ type: 'change' }); return; }
      var s = SEC[i]; plane.normal.set(s[2][0], s[2][1], s[2][2]); plane.constant = s[3]; ctx.renderer.clippingPlanes = [plane]; ctx.renderer.localClippingEnabled = true;
      ctx.camera.position.set(s[4][0], s[4][1], s[4][2]); ctx.controls.target.set(s[5][0], s[5][1], s[5][2]); ctx.controls.update && ctx.controls.update();
      showLabel(s[0], s[1]); ctx.controls.dispatchEvent({ type: 'change' });
    }
    SEC.forEach(function (s, i) { var b = btn(s[0], s[1], function () { cut(b.getAttribute('aria-pressed') === 'true' ? null : i); }); secBtns.push(b); secRow.appendChild(b); });
    secRow.appendChild(btn('Clear cut', 'Show the whole model again', function () { cut(null); }));
    var anchor = tourOld || vb; anchor.parentNode.insertBefore(head, anchor.nextSibling); head.parentNode.insertBefore(gb, head.nextSibling); gb.parentNode.insertBefore(player, gb.nextSibling); player.parentNode.insertBefore(secRow, player.nextSibling);
    if (tourOld) tourOld.hidden = true;
    // 5. tabs: Views, Plans, Layers
    var tabs = document.querySelector('.tabs[role="tablist"]');
    if (tabs) { ['views', 'plans', 'layers'].forEach(function (k) { var t = tabs.querySelector('[data-t="' + k + '"]'); if (t) tabs.appendChild(t); }); var v = tabs.querySelector('[data-t="views"]'); if (v && v.getAttribute('aria-selected') !== 'true') v.click(); }
    // 6. N / S / E / W: from the page's elevation markers, or framed on the project from just outside its own edge
    var m = 4, ELEV = CFG.elevations || {
      n: { n: [0, 0, 1], c: -(box[2] - m), dir: [0, 0, -1], ctr: [cx, box[1] + H / 2, box[2] - m], w: lx + 8, h: H + 6, label: 'North elevation', sub: 'Framed on the project' },
      s: { n: [0, 0, -1], c: box[5] + m, dir: [0, 0, 1], ctr: [cx, box[1] + H / 2, box[5] + m], w: lx + 8, h: H + 6, label: 'South elevation', sub: 'Framed on the project' },
      e: { n: [-1, 0, 0], c: box[3] + m, dir: [1, 0, 0], ctr: [box[3] + m, box[1] + H / 2, cz], w: lz + 8, h: H + 6, label: 'East elevation', sub: 'Framed on the project' },
      w: { n: [1, 0, 0], c: -(box[0] - m), dir: [-1, 0, 0], ctr: [box[0] - m, box[1] + H / 2, cz], w: lz + 8, h: H + 6, label: 'West elevation', sub: 'Framed on the project' }
    };
    var ep = { normal: new V3(), constant: 0 }, gp = { normal: new V3(0, 1, 0), constant: -(G - .3) };
    function elevation(k) {
      var e = ELEV[k]; secBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      ep.normal.set(e.n[0], e.n[1], e.n[2]); ep.constant = e.c; ctx.renderer.clippingPlanes = [ep, gp];
      var cam = ctx.camera, half = Math.tan((cam.fov * Math.PI / 180) / 2), dist = Math.max((e.w * .52) / (half * (cam.aspect || 1.5)), (e.h * .55) / half), c0 = e.ctr;
      cam.position.set(c0[0] + e.dir[0] * dist, c0[1], c0[2] + e.dir[2] * dist); ctx.controls.target.set(c0[0], c0[1], c0[2]); if (cam.far < dist + 300) { cam.far = dist + 300; cam.updateProjectionMatrix(); }
      ctx.controls.update && ctx.controls.update(); showLabel(e.label, e.sub); ctx.controls.dispatchEvent({ type: 'change' });
    }
    vb.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-v]'); if (!b) return; var v = b.getAttribute('data-v');
      if (ELEV[v]) { var last = null, n = 0; (function settle() { var p = ctx.camera.position, s = p.x.toFixed(2) + p.y.toFixed(2) + p.z.toFixed(2); if ((s === last && n > 3) || n > 40) elevation(v); else { last = s; n++; setTimeout(settle, 60); } })(); }
      else { ctx.renderer.clippingPlanes = []; label.hidden = true; ctx.controls.dispatchEvent({ type: 'change' }); }
    });
    window.projectControls = { cut: cut, sections: SEC, elevation: elevation, elevations: ELEV };

  }
})();
