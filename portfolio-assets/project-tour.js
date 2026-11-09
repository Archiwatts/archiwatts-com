/* Guided tour of the 3D projects. "Take the tour" in the rail (or ?tour=1 in the address) flies the camera round the current project
   (overview, front, side, high corner), then drops to eye level and walks a loop round the site in first person using the viewer's own
   collision-checked walk mode, then moves on to the next project and continues. Any click, key or drag takes over; Esc stops it.
   The project list and order come from site-rail.js (window.siteProjects). */
(function () {
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.newProjectViewer.navigation; }
  var STOPS_MS = 4200, HOLD_MS = 1300, WALK_S = 26, EYE = 1.65;
  var ctx, V, cam, ctl, B, state = null, bar, raf = 0, ui = {};
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function mobile() { return !!(window.modelPerformance && window.modelPerformance.mobile); }
  function list() { return (window.siteProjects || []).filter(function (p) { return !/winter-station/.test(p.url); }); }
  function curIndex() { var l = list(), h = location.pathname.replace(/[^\/]*$/, ''); for (var i = 0; i < l.length; i++) if (new URL(l[i].url, location.href).pathname.replace(/[^\/]*$/, '') === h) return i; return -1; }
  function bounds() {
    // the project's own size: the focus box the page gives, or the model's non-context parts, whichever is smaller (a focus box that
    // takes in the whole neighbourhood would put the camera far from the project)
    var f = window.projectModelInfo && window.projectModelInfo.focusBounds, fb = f && { c: [0, 1, 2].map(function (i) { return (f.min[i] + f.max[i]) / 2; }), s: [0, 1, 2].map(function (i) { return f.max[i] - f.min[i]; }) };
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; ctx.scene.traverse(function (o) { if (!o.isMesh || (o.userData && o.userData.skEdge) || !o.geometry || /context|^site_|^site-|lines$/i.test(o.name || '')) return; o.updateWorldMatrix(true, false); o.geometry.computeBoundingBox(); var b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); [b.min, b.max].forEach(function (p) { ['x', 'y', 'z'].forEach(function (a, i) { mn[i] = Math.min(mn[i], p[a]); mx[i] = Math.max(mx[i], p[a]); }); }); });
    var mb = mx[0] > mn[0] ? { c: [0, 1, 2].map(function (i) { return (mn[i] + mx[i]) / 2; }), s: [0, 1, 2].map(function (i) { return mx[i] - mn[i]; }) } : null;
    if (fb && mb) return Math.max(fb.s[0], fb.s[2]) <= Math.max(mb.s[0], mb.s[2]) ? fb : mb; return fb || mb;
  }
  function sentence() { var s = window.PROJECT_PANEL && window.PROJECT_PANEL.snapshot || ''; var m = /^[^.]+\./.exec(s); return m ? m[0] : ''; }
  function css() {
    var s = document.createElement('style');
    s.textContent = '#pt-bar{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:140;display:none;align-items:center;gap:10px;max-width:calc(100vw - 24px);padding:8px 10px 8px 16px;background:rgba(28,27,30,.93);color:#f2f0f4;border:1.5px solid #4d4953;border-radius:999px;font:600 13px Archivo,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)}' +
      '#pt-bar.on{display:flex}#pt-bar .pt-t{min-width:0;max-width:min(52vw,420px);line-height:1.3}#pt-bar .pt-k{display:block;font:700 10px Archivo,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffb1c8}' +
      '#pt-bar button{min-height:40px;min-width:40px;padding:0 12px;border:1.5px solid #4d4953;border-radius:999px;background:#26242a;color:#f2f0f4;font:700 12px Archivo,system-ui,sans-serif;cursor:pointer}#pt-bar button:hover{border-color:#e0557c}#pt-bar button.pri{background:#e0557c;border-color:#e0557c;color:#1c1b1e}' +
      '#pt-dots{display:flex;gap:5px}#pt-dots i{width:7px;height:7px;border-radius:50%;background:#4d4953}#pt-dots i.on{background:#e0557c}#pt-dots i.done{background:#c9c4d0}' +
      '#pt-card{position:fixed;inset:0;z-index:150;display:none;align-items:center;justify-content:center;background:rgba(20,19,22,.55)}#pt-card.on{display:flex}' +
      '#pt-card div{max-width:min(420px,calc(100vw - 32px));padding:22px 24px;background:#26242a;color:#f2f0f4;border:1.5px solid #4d4953;border-radius:16px;font:400 15px/1.5 Archivo,system-ui,sans-serif;text-align:center}#pt-card h3{margin:4px 0 6px;font:800 24px/1.15 Archivo,system-ui,sans-serif}#pt-card small{font:700 11px Archivo,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffb1c8}' +
      '#pt-card .row{display:flex;gap:8px;justify-content:center;margin-top:16px}#pt-card button,#pt-card a{min-height:44px;padding:0 18px;display:inline-flex;align-items:center;border:1.5px solid #4d4953;border-radius:999px;background:#26242a;color:#f2f0f4;font:700 13px Archivo,system-ui,sans-serif;text-decoration:none;cursor:pointer}#pt-card .pri{background:#e0557c;border-color:#e0557c;color:#1c1b1e}' +
      '@media (max-width:900px){#pt-bar{bottom:calc(76px + env(safe-area-inset-bottom,0px));gap:6px;padding-left:12px}#pt-bar .pt-t{max-width:46vw;font-size:12px}#pt-dots{display:none}}';
    document.head.appendChild(s);
    bar = document.createElement('div'); bar.id = 'pt-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Guided tour');
    bar.innerHTML = '<span class="pt-t"><span class="pt-k" id="pt-k"></span><span id="pt-c"></span></span><span id="pt-dots"></span><button type="button" id="pt-prev" aria-label="Previous stop">‹</button><button type="button" id="pt-pp" class="pri" aria-label="Pause">❚❚</button><button type="button" id="pt-next" aria-label="Next stop">›</button><button type="button" id="pt-stop" aria-label="End the tour">✕</button>';
    document.body.appendChild(bar);
    var card = document.createElement('div'); card.id = 'pt-card'; card.innerHTML = '<div><small id="pt-ck"></small><h3 id="pt-ct"></h3><p id="pt-cp"></p><div class="row" id="pt-cr"></div></div>'; document.body.appendChild(card);
    ui = { k: bar.querySelector('#pt-k'), c: bar.querySelector('#pt-c'), dots: bar.querySelector('#pt-dots'), pp: bar.querySelector('#pt-pp'), card: card, ck: card.querySelector('#pt-ck'), ct: card.querySelector('#pt-ct'), cp: card.querySelector('#pt-cp'), cr: card.querySelector('#pt-cr') };
    bar.querySelector('#pt-stop').onclick = function () { stop(true); };
    bar.querySelector('#pt-prev').onclick = function () { jump(-1); }; bar.querySelector('#pt-next').onclick = function () { jump(1); };
    ui.pp.onclick = function () { if (!state) return; state.paused = !state.paused; ui.pp.textContent = state.paused ? '▶' : '❚❚'; ui.pp.setAttribute('aria-label', state.paused ? 'Play' : 'Pause'); };
  }
  function plan() {
    var c = B.c, s = Math.max(B.s[0], B.s[2], B.s[1] * 1.6, 20), d = s * 1.3, fov = cam.fov || 50, k = d / (2 * Math.tan(fov * Math.PI / 360)) * 1.15 * ((window.PROJECT_PANEL && window.PROJECT_PANEL.tourZoom) || .62);
    function at(dx, dy, dz, k2) { var l = Math.hypot(dx, dy, dz); return { p: [c[0] + dx / l * k * k2, c[1] + dy / l * k * k2, c[2] + dz / l * k * k2], t: [c[0], c[1] - B.s[1] * .1, c[2]] }; }
    var intro = sentence() || (document.title || '').replace(/\s*\|.*$/, '');
    return [
      Object.assign(at(.85, .6, 1, 1), { k: 'Overview', c: intro, kind: 'fly' }),
      Object.assign(at(0, .42, 1, .85), { k: 'Front', c: 'The south face, from street level.', kind: 'fly' }),
      Object.assign(at(1, .45, .1, .85), { k: 'From the east', c: 'Along the side of the building.', kind: 'fly' }),
      Object.assign(at(-.8, .75, -.7, 1), { k: 'From above', c: 'The whole site from the north-west.', kind: 'fly' }),
      { k: 'Walk the site', c: 'Now at eye level: a walk round the building.', kind: 'walk' }
    ].filter(function (s) { return s.kind !== 'walk' || Math.max(B.s[0], B.s[2]) >= 15; });
  }
  function dots() { ui.dots.innerHTML = state.stops.map(function (s, i) { return '<i class="' + (i === state.i ? 'on' : i < state.i ? 'done' : '') + '"></i>'; }).join(''); }
  function enter(i) {
    var st = state.stops[i]; state.i = i; state.el = 0; state.paused = false; ui.pp.textContent = '❚❚';
    ui.k.textContent = 'Tour · ' + (curIndex() + 1) + ' of ' + list().length + ' · ' + st.k; ui.c.textContent = st.c; dots();
    if (st.kind === 'fly') {
      if (window.newProjectViewer.mode() === 'walk') window.newProjectViewer.fit();
      ctl.enabled = false; state.from = { p: cam.position.toArray(), t: ctl.target.toArray() };
    } else walkStart();
  }
  function walkStart() {
    var nav = window.newProjectViewer.navigation, sp = nav.state().spawn; window.newProjectViewer.walk();
    state.w = { cx: B.c[0], cz: B.c[2], ang: 0, yaw: null, last: null, stuck: 0 };
    var dx = sp[0] - B.c[0], dz = sp[2] - B.c[2]; state.w.r = Math.min(Math.max(Math.hypot(dx, dz), 9), 40); state.w.ang = Math.atan2(dz, dx); state.w.a0 = state.w.ang;
  }
  function walkFrame(dt) {
    var w = state.w, nav = window.newProjectViewer.navigation, p = cam.position, Vec = p.constructor;
    // the waypoint a few metres ahead on the ring through the spawn point
    var look = w.ang + .22, tx = w.cx + Math.cos(look) * w.r, tz = w.cz + Math.sin(look) * w.r, dx = tx - p.x, dz = tz - p.z, dl = Math.hypot(dx, dz) || 1;
    var step = Math.min(2.4 * dt, dl), res = nav.move([p.x, p.y, p.z], [p.x + dx / dl * step, p.y, p.z + dz / dl * step]), moved = Math.hypot(res[0] - p.x, res[2] - p.z);
    var fl; try { fl = nav.floor(res[0], res[2], res[1]); } catch (e) { fl = null; }
    p.x = res[0]; p.z = res[2]; if (typeof fl === 'number' && isFinite(fl)) p.y += (fl + EYE - p.y) * Math.min(1, dt * 8);
    // follow the ring: advance the target angle by the angle actually covered; skip ahead if a wall holds us up
    w.ang = Math.atan2(p.z - w.cz, p.x - w.cx); if (moved < step * .25) { w.stuck += dt; if (w.stuck > .7) { w.a0 += .35; w.ang += .35; w.stuck = 0; var rr = w.r; p.x = w.cx + Math.cos(w.ang) * rr; p.z = w.cz + Math.sin(w.ang) * rr; } } else w.stuck = 0;
    var tY = Math.atan2(dx, dz), toC = Math.atan2(w.cx - p.x, w.cz - p.z), want = tY + angDiff(toC, tY) * .35; if (w.yaw === null) w.yaw = want; w.yaw += angDiff(want, w.yaw) * Math.min(1, dt * 2.2);
    cam.lookAt(new Vec(p.x + Math.sin(w.yaw) * 10, p.y - .25, p.z + Math.cos(w.yaw) * 10));
  }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!state) return;
    var dt = Math.min(.1, (now - (state.last || now)) / 1000); state.last = now; if (state.paused || document.hidden) return;
    state.el += dt * 1000; var st = state.stops[state.i], el = state.el;
    if (st.kind === 'fly') {
      var u = Math.min(1, el / STOPS_MS), e = ease(u), F = state.from; cam.position.set(F.p[0] + (st.p[0] - F.p[0]) * e, F.p[1] + (st.p[1] - F.p[1]) * e, F.p[2] + (st.p[2] - F.p[2]) * e); ctl.target.set(F.t[0] + (st.t[0] - F.t[0]) * e, F.t[1] + (st.t[1] - F.t[1]) * e, F.t[2] + (st.t[2] - F.t[2]) * e); cam.lookAt(ctl.target);
      if (el > STOPS_MS + HOLD_MS) jump(1);
    } else {
      walkFrame(dt); if (el > WALK_S * 1000) finishProject();
    }
    ctl.dispatchEvent({ type: 'change' });
  }
  function jump(dir) { if (!state) return; var n = state.i + dir; if (n < 0) n = 0; if (n >= state.stops.length) { finishProject(); return; } enter(n); }
  function finishProject() {
    var l = list(), i = curIndex(), next = i >= 0 && i + 1 < l.length ? l[i + 1] : null; if (window.newProjectViewer.mode() === 'walk') window.newProjectViewer.fit(); ctl.enabled = true;
    state = null; bar.classList.remove('on');
    ui.ck.textContent = next ? 'Next on the tour · ' + (i + 2) + ' of ' + l.length : 'Tour complete'; ui.ct.textContent = next ? next.name : 'That was every project';
    ui.cp.textContent = next ? 'Continuing in 6 seconds.' : 'Pick a project, or take the tour again from the start.'; ui.cr.innerHTML = '';
    function btn(t, pri, fn) { var b = document.createElement(fn.href ? 'a' : 'button'); b.textContent = t; if (pri) b.className = 'pri'; if (fn.href) b.href = fn.href; else b.onclick = fn; ui.cr.appendChild(b); }
    ui.card.classList.add('on'); var timer = 0, left = 6;
    function go() { clearInterval(timer); location.href = next ? next.url + (next.url.indexOf('?') < 0 ? '?tour=1' : '&tour=1') : l[0].url + '?tour=1'; }
    function close() { clearInterval(timer); ui.card.classList.remove('on'); }
    if (next) { btn('Go now', true, go); btn('Stay here', false, close); timer = setInterval(function () { left--; ui.cp.textContent = 'Continuing in ' + left + ' seconds.'; if (left <= 0) go(); }, 1000); }
    else { btn('Start again', true, go); btn('All projects', false, { href: (window.siteProjects && window.siteProjects.length ? new URL('interactive/index.html', l[0].url.replace(/[^\/]*\/[^\/]*$/, '')).href : '../interactive/index.html') }); btn('Close', false, close); }
  }
  function start() {
    if (state || !ready()) return; ui.card.classList.remove('on'); B = bounds(); window.newProjectViewer.fit();
    state = { stops: plan(), i: 0, paused: false, last: 0 }; bar.classList.add('on'); enter(0); if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop(userAction) {
    if (!state) return; state = null; bar.classList.remove('on'); ctl.enabled = true; ui.card.classList.remove('on');
    if (window.newProjectViewer.mode() === 'walk' && userAction) window.newProjectViewer.fit();
  }
  function init() {
    ctx = window.daylightContext; cam = ctx.camera; ctl = ctx.controls; css();
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-tour]'); if (b) { e.preventDefault(); start(); var mb = document.querySelector('#mobile-model-chrome .mm-project'); if (mb && mb.getAttribute('aria-expanded') === 'true') mb.click(); } });
    // the viewer's own controls take over: dragging the model, any key (Esc included), or pressing the canvas
    ctl.addEventListener('start', function () { stop(false); });
    addEventListener('keydown', function (e) { if (state && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) { if (e.code === 'Escape' || /^(Key[WASD]|Arrow)/.test(e.code)) stop(true); } });
    ctx.renderer.domElement.addEventListener('pointerdown', function () { if (state && state.stops[state.i].kind === 'walk') stop(false); });
    // the tour button sits in the project controls, under the 3D / Plan / N / S / E / W bar
    (function addButton(n) {
      var vb = document.querySelector('.pp-viewbar');
      if (vb && !document.querySelector('.pp-tour')) { var b = document.createElement('button'); b.type = 'button'; b.className = 'pp-tour'; b.setAttribute('data-tour', ''); b.textContent = '▶ Take the guided tour'; vb.after(b); }
      else if (!vb && n < 120) setTimeout(function () { addButton(n + 1); }, 400);
    })(0);    window.projectTour = { stops: function () { B = bounds(); return plan(); }, goto: function (i) { B = bounds(); var s = plan()[i]; ctl.enabled = true; cam.position.set(s.p[0], s.p[1], s.p[2]); ctl.target.set(s.t[0], s.t[1], s.t[2]); cam.lookAt(ctl.target); ctl.dispatchEvent({ type: 'change' }); return s; }, start: start, stop: function () { stop(true); }, running: function () { return !!state; } };
    if (/[?&]tour=1/.test(location.search)) setTimeout(start, mobile() ? 3500 : 2500);
  }
  var tries = 0; (function wait() { if (ready()) { try { init(); } catch (e) { console.warn('Tour skipped', e); } } else if (tries++ < 800) setTimeout(wait, 200); })();
})();
