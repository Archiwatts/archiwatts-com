/* Project control panel for the light model pages, laid out like the full-detail (v1.4) panel:
   snapshot, appearance, surrounding context, then Layers / Views / Plans tabs.
   Configure with window.PROJECT_PANEL = { snapshot, details, story, pdf, layers: [{ n, re }], context: 'regex' }.
   styles: true gives all five sketch-style modes; a list such as [['watercolor', 'Watercolor'], ['realistic', 'Material']] gives just those. */
(function () {
  var C = window.PROJECT_PANEL; if (!C) return;
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && document.querySelector('.building-panel'); }
  var tries = 0;
  (function wait() {
    if (ready()) { try { run(); } catch (e) { console.warn('Project panel skipped', e); } }
    else if (tries++ < 600) setTimeout(wait, 150);
  })();
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function redraw(ctx) { if (ctx.controls && ctx.controls.dispatchEvent) ctx.controls.dispatchEvent({ type: 'change' }); }
  function run() {
    var ctx = window.daylightContext, panel = document.querySelector('.building-panel');
    var css = document.createElement('style');
    css.textContent =
      '.building-panel{width:min(360px,calc(100vw - 32px))!important;max-height:calc(100vh - 110px);overflow:auto}' +
      '.building-panel>p:not(.pp-keep),.building-panel .model-panel-options>.model-setting,.building-panel .model-travel-settings{display:none!important}' +
      '.pp{display:grid;gap:14px;margin-top:10px}.pp h3{margin:0 0 8px;font:700 11px/1.2 Archivo,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffb1c8}' +
      '.pp p{margin:0 0 8px;font-size:14px;line-height:1.5;color:#e9e6ee}.pp hr{border:0;border-top:1px solid #4d4953;margin:0}' +
      '.pp details summary{cursor:pointer;font:700 12px Archivo,system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#f2f0f4;padding:4px 0}.pp details p{margin-top:6px}' +
      '.pp .lbtn{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;margin-top:6px;font:700 13px Archivo,system-ui,sans-serif;color:#f2f0f4;background:#26242a;border:1.5px solid #4d4953;border-radius:10px;text-decoration:none;cursor:pointer;padding:0 12px}.pp .lbtn:hover{border-color:#fff}' +
      '.pp .seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}.pp .seg.five{grid-auto-flow:row;grid-template-columns:repeat(3,1fr)}.pp .seg button,.pp .chips button,.pp .tabs button,.pp .acts button{font:700 13px Archivo,system-ui,sans-serif;color:#f2f0f4;background:#26242a;border:1.5px solid #4d4953;border-radius:10px;min-height:44px;padding:0 8px;cursor:pointer}' +
      '.pp .seg button:hover,.pp .chips button:hover,.pp .tabs button:hover,.pp .acts button:hover{border-color:#fff}' +
      '.pp .seg button[aria-pressed=true]{background:#e0557c;border-color:#e0557c;color:#1c1b1e}' +
      '.pp label.sel{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:14px}.pp select{font:700 13px Archivo,system-ui,sans-serif;color:#f2f0f4;background:#26242a;border:1.5px solid #4d4953;border-radius:10px;min-height:40px;padding:0 10px}' +
      '.pp .tabs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}.pp .tabs button[aria-selected=true]{background:#e0557c;border-color:#e0557c;color:#1c1b1e}' +
      '.pp .chips{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:10px}.pp .chips button{text-align:left;display:flex;align-items:center;gap:8px;min-height:42px}.pp .chips button i{width:12px;height:12px;border-radius:50%;border:2px solid #f2f0f4;flex:none}.pp .chips button[aria-pressed=true]{background:#3a3640;border-color:#f2f0f4}.pp .chips button[aria-pressed=true] i{background:#f2f0f4}' +
      '.pp .count{font-size:12px;color:#c9c4d0;margin-top:10px}.pp .acts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}' +
      '.pp .views{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.pp .views button{font:700 13px Archivo,system-ui,sans-serif;color:#f2f0f4;background:#26242a;border:1.5px solid #4d4953;border-radius:10px;min-height:44px;cursor:pointer}.pp .views button:hover{border-color:#fff}' +
      '.pp [hidden]{display:none!important}';
    document.head.appendChild(css);
    // keep the full-detail link, restyled as the last action
    var full = panel.querySelector('a.full-detail'), fullP = full && full.closest('p'); if (fullP) fullP.classList.add('pp-keep');
    var layers = (C.layers || []).map(function (l) { return { n: l.n, re: new RegExp(l.re, 'i'), on: true, meshes: null }; });
    var ctxRe = C.context ? new RegExp(C.context, 'i') : null, ctxMeshes = null, ctxOrig = new Map(), PALE_CTX = null;
    function meshesFor(re) { var out = []; ctx.scene.traverse(function (o) { if (!o.isMesh) return; for (var p = o; p; p = p.parent) if (p.name && re.test(p.name)) { out.push(o); return; } }); return out; }
    var root = document.createElement('div'); root.className = 'pp';
    root.innerHTML =
      '<section><h3>Project snapshot</h3><p>' + esc(C.snapshot) + '</p>' + (C.details ? '<details><summary>Project details</summary><p>' + C.details + '</p></details>' : '') +
      (C.story ? '<a class="lbtn" href="' + esc(C.story) + '">Learn more about the project →</a>' : '') + (C.pdf ? '<a class="lbtn" href="' + esc(C.pdf) + '" target="_blank" rel="noopener">Read the project PDF →</a>' : '') + '</section><hr>' +
      '<section><h3>Appearance</h3>'+(C.styles?'<div class="seg'+(Array.isArray(C.styles)&&C.styles.length<4?'':' five')+'" role="group" aria-label="Appearance">'+(Array.isArray(C.styles)?C.styles:[['watercolor','Watercolor'],['sketch','Sketch'],['massing','Massing'],['diagram','Diagram'],['realistic','Realistic']]).map(function(p){return '<button type="button" data-s="'+p[0]+'" aria-pressed="'+(p[0]===(C.mode||'watercolor'))+'">'+p[1]+'</button>'}).join('')+'</div>':'<div class="seg" role="group" aria-label="Appearance"><button type="button" data-m="colors" aria-pressed="true">Materials</button><button type="button" data-m="paper" aria-pressed="false">Diagram</button><button type="button" data-m="clay" aria-pressed="false">Clay</button></div>')+'' +
      (ctxRe ? '<label class="sel">Surrounding context<select id="pp-context"><option value="solid">Solid</option><option value="faded">Faded</option><option value="hidden">Hidden</option></select></label>' : '') + '</section><hr>' +
      '<section><div class="tabs" role="tablist"><button type="button" role="tab" data-t="layers" aria-selected="true">Layers</button><button type="button" role="tab" data-t="views" aria-selected="false">Views</button><button type="button" role="tab" data-t="plans" aria-selected="false">Plans</button></div>' +
      '<div data-p="layers"><div class="seg" style="margin-top:10px" role="group" aria-label="Layer click"><button type="button" data-lm="isolate" aria-pressed="true">Isolate</button><button type="button" data-lm="toggle" aria-pressed="false">Toggle</button></div><div class="chips">' + layers.map(function (l, i) { return '<button type="button" data-l="' + i + '" aria-pressed="true"><i></i>' + esc(l.n) + '</button>'; }).join('') + '</div><div class="count" id="pp-count"></div><div class="acts"><button type="button" id="pp-all">Show all layers</button><button type="button" id="pp-fit">Fit model</button></div></div>' +
      '<div data-p="views" hidden><p style="margin-top:10px">Move the camera to a standard view.</p><div class="views"><button type="button" data-v="fit">Overview</button><button type="button" data-v="top">Plan</button><button type="button" data-v="n">From the north</button><button type="button" data-v="s">From the south</button><button type="button" data-v="e">From the east</button><button type="button" data-v="w">From the west</button></div></div>' +
      '<div data-p="plans" hidden><p style="margin-top:10px">Plans, elevations, sections, diagrams and renders for this project.</p><button type="button" class="lbtn" id="pp-sheets" ' + '>Open drawings and renders</button>' + (C.story ? '<a class="lbtn" href="' + esc(C.story) + '">Project story →</a>' : '') + '</div></section>';
    var h2 = panel.querySelector('h2'); (h2 || panel.firstChild).after(root);
    var q = function (s) { return root.querySelector(s); }, qa = function (s) { return [].slice.call(root.querySelectorAll(s)); };
    function count() { var on = layers.filter(function (l) { return l.on; }).length; var el = q('#pp-count'); if (el) el.textContent = on + ' / ' + layers.length + ' layers on'; }
    function linked() {
      var need = layers.some(function (l) { return l.on && /retail|office|store|shop/i.test(l.n); }), hasAny = layers.some(function (l) { return /retail|office|store|shop/i.test(l.n); });
      if (!hasAny) return; ctx.scene.traverse(function (o) { if (o.isMesh && o.name === 'Hive interiors') o.visible = need; });
    }
    function setLayer(i, on) {
      var l = layers[i]; l.on = on; if (!l.meshes) l.meshes = meshesFor(l.re);
      l.meshes.forEach(function (o) { o.visible = on; }); qa('[data-l="' + i + '"]')[0].setAttribute('aria-pressed', String(on)); linked(); count(); redraw(ctx);
    }
    var layerMode = 'isolate';
    qa('[data-lm]').forEach(function (b) { b.addEventListener('click', function () { layerMode = b.dataset.lm; qa('[data-lm]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
    qa('[data-l]').forEach(function (b) { b.addEventListener('click', function (ev) { var i = +b.dataset.l, toggle = layerMode === 'toggle' || ev.shiftKey || ev.ctrlKey || ev.metaKey; if (toggle) setLayer(i, !layers[i].on); else { var only = layers[i].on && layers.every(function (l, k) { return k === i || !l.on; }); layers.forEach(function (l, k) { setLayer(k, only ? true : k === i); }); } }); });
    q('#pp-all').addEventListener('click', function () { layers.forEach(function (l, i) { setLayer(i, true); }); });
    q('#pp-fit').addEventListener('click', function () { var b = document.getElementById('fit-button'); if (b) b.click(); });
    qa('.seg button[data-s], .seg button[data-m]').forEach(function (b) { b.addEventListener('click', function () { [].forEach.call(b.parentNode.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); if (b.dataset.s) { if (window.sketchStyle) window.sketchStyle.setMode(b.dataset.s); } else if (window.lightViews) window.lightViews.apply(b.dataset.m); }); });
    qa('.tabs button').forEach(function (b) { b.addEventListener('click', function () { qa('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); qa('[data-p]').forEach(function (p) { p.hidden = p.dataset.p !== b.dataset.t; }); }); });
    var sel = q('#pp-context');
    if (sel) sel.addEventListener('change', function () {
      if (!ctxMeshes) ctxMeshes = meshesFor(ctxRe);
      if (!PALE_CTX) ctxMeshes.some(function (o) { var m = o.material; if (m && m.color && !(o.userData && o.userData.skEdge)) { PALE_CTX = new m.color.constructor('#ecebe7'); return true; } });
      // Faded keeps the context solid but washed out towards a pale ground (see-through boxes read as a wire mesh), and its ink
      // outlines go with it in Faded and Hidden, so the eye goes to the project; the project's own colours are left alone
      ctxMeshes.forEach(function (o) {
        if (o.userData && o.userData.skEdge) { o.userData.layerOn = sel.value === 'solid'; o.visible = sel.value === 'solid' && (!window.sketchStyle || window.sketchStyle.mode() !== 'realistic'); return; }
        var m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return;
        if (!ctxOrig.has(m)) ctxOrig.set(m, { c: m.color && m.color.clone(), e: m.emissive && m.emissive.clone() });
        var s = ctxOrig.get(m);
        if (sel.value === 'hidden') { o.visible = false; return; }
        o.visible = true;
        if (sel.value === 'faded') { if (m.color && s.c) m.color.copy(s.c).lerp(PALE_CTX, .72); if (m.emissive) m.emissive.copy(PALE_CTX).multiplyScalar(.45); }
        else { if (s.c) m.color.copy(s.c); if (s.e) m.emissive.copy(s.e); }
      });
      redraw(ctx);
    });
    /* Standard views. Plan, north, south, east and west are flat: a long lens from far away, so the model reads like a plan or an
       elevation (straight lines stay straight, no perspective), which also gives a clean look at a section-box cut.
       3D goes back to the normal lens and the overview. North is -z, as on the site plans. */
    var fb = window.projectModelInfo && window.projectModelInfo.focusBounds, cam = ctx.camera, lens0 = null, FLAT = 5;
    function setView(v) {
      if (lens0 === null) lens0 = { fov: cam.fov, near: cam.near, far: cam.far };
      if (v === 'fit' || v === '3d' || !fb) {
        cam.fov = lens0.fov; cam.near = lens0.near; cam.far = lens0.far; cam.updateProjectionMatrix();
        var f = document.getElementById('fit-button'); if (f) f.click(); else { ctx.controls.update(); redraw(ctx); }
      } else {
        var c = [0, 1, 2].map(function (i) { return (fb.min[i] + fb.max[i]) / 2; }), sx = fb.max[0] - fb.min[0], sy = fb.max[1] - fb.min[1], sz = fb.max[2] - fb.min[2];
        var span = v === 'top' ? Math.max(sx, sz) : (v === 'n' || v === 's' ? Math.max(sx, sy * 1.6) : Math.max(sz, sy * 1.6));
        var d = span * .62 / Math.tan(FLAT * Math.PI / 360), off = { top: [0, d, d * 1e-4], n: [0, 0, -d], s: [0, 0, d], e: [d, 0, 0], w: [-d, 0, 0] }[v];
        cam.fov = FLAT; cam.near = Math.max(lens0.near, d * .02); cam.far = Math.max(lens0.far, d * 3); cam.updateProjectionMatrix();
        ctx.controls.target.set(c[0], c[1], c[2]); cam.position.set(c[0] + off[0], c[1] + off[1], c[2] + off[2]); ctx.controls.update(); redraw(ctx);
      }
      [].forEach.call(document.querySelectorAll('.pp-viewbar button'), function (x) { x.setAttribute('aria-pressed', String(x.dataset.v === (v === 'fit' ? '3d' : v))); });
    }
    qa('.views button').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.v); }); });
    // the same views as a row at the top of the project controls, so they are one tap away
    if (C.viewbar !== false) {
      var vcss = document.createElement('style');
      vcss.textContent = '.pp-viewbar{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin:8px 0 4px;padding:4px;background:#26242a;border:1.5px solid #4d4953;border-radius:12px}' +
        '.pp-viewbar button{font:700 12px Archivo,system-ui,sans-serif;color:#f2f0f4;background:transparent;border:0;border-radius:8px;min-height:36px;padding:0;cursor:pointer}.pp-viewbar button:hover{background:#3a3640}.pp-viewbar button[aria-pressed=true]{background:#e0557c;color:#1c1b1e}';
      document.head.appendChild(vcss);
      var bar = document.createElement('div'); bar.className = 'pp-viewbar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Views');
      bar.innerHTML = [['3d', '3D', 'Back to the 3D view'], ['top', 'Plan', 'Flat plan from above'], ['n', 'N', 'Flat elevation from the north'], ['s', 'S', 'Flat elevation from the south'], ['e', 'E', 'Flat elevation from the east'], ['w', 'W', 'Flat elevation from the west']]
        .map(function (b, i) { return '<button type="button" data-v="' + b[0] + '" title="' + b[2] + '" aria-pressed="' + (i === 0) + '">' + b[1] + '</button>'; }).join('');
      // just under the "Project controls" heading (or at the very top of the panel)
      var head = [].filter.call(panel.querySelectorAll('*'), function (el) { return !el.children.length && /^project controls$/i.test((el.textContent || '').trim()); })[0];
      if (head) head.after(bar); else panel.prepend(bar);
      bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) setView(b.dataset.v); });
    }
    q('#pp-sheets').addEventListener('click', function () { var b = document.getElementById('drawings-button') || document.getElementById('sheets-button'); if (b) b.click(); else q('#pp-sheets').textContent = 'No drawings added yet'; });
    count();
  }
})();
