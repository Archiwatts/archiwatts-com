/* Phones: the tour timeline right above the bottom bar, for every model page with a walk / fly tour (project-walk.js, or North
   Beach's nbyc-tour.js). Always there, dimmed until a tour plays; the bar's Tour button starts the tour chosen on its Walk | Fly
   switch; play / pause, 1x / 2x, and stop markers (kept after a tour ends) that jump straight to a part of the project. */
(function () {
  function btn(label, title, on) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (title) b.title = title; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', on); return b; }
  var W = null;
  (function wait() { W = window.projectWalk || window.nbycTour; if (W && W.state) mobileTimeline(); else setTimeout(wait, 400); })();
    // 7. phones: the tour timeline sits right above the bottom bar, always there (dimmed until a tour plays). Tour starts the walk
    //    or fly chosen on its Walk | Fly switch; play / pause, and the stop markers (kept after a tour ends) jump straight to a part.
    function mobileTimeline() {
      var bar = document.querySelector('.mm-bottom'); if (!bar) { if ((mobileTimeline.n = (mobileTimeline.n || 0) + 1) < 40) setTimeout(mobileTimeline, 500); return; }
      if (document.querySelector('.pc-mtl')) return;
      var st = document.createElement('style');
      st.textContent = '.pc-mtl{position:fixed;left:8px;right:8px;z-index:60;padding:4px 6px;border:1px solid #4d4953;border-radius:10px;background:rgba(31,29,34,.9);color:#f2f0f4;font:600 11px Archivo,system-ui,sans-serif;transition:opacity .25s;box-sizing:border-box}' +
        '.pc-mtl.idle{opacity:.7}.pc-mtl .r1{display:grid;grid-template-columns:auto 28px minmax(0,1fr) 30px;gap:6px;align-items:center}' +
        '.pc-mtl button{min-height:26px;border:1px solid #4d4953;border-radius:6px;background:#29262d;color:inherit;font:inherit;padding:0 6px}.pc-mtl button[aria-pressed=true]{background:#e0567f;border-color:#e0567f}' +
        '.pc-mtl .sw{display:flex;gap:3px}.pc-mtl .ln{position:relative;height:28px}.pc-mtl .ln:before{content:"";position:absolute;left:0;right:0;top:19px;height:3px;border-radius:2px;background:#4d4953}' +
        '.pc-mtl .fl{position:absolute;left:0;top:19px;height:3px;border-radius:2px;background:#e0567f}.pc-mtl .mk{position:absolute;top:15px;width:10px;height:11px;margin-left:-5px;padding:0;min-height:0;border:0;border-radius:3px;background:#f2f0f4}' +
        '.pc-mtl .mk.on{background:#e0567f}.pc-mtl .nw{position:absolute;left:0;right:0;top:1px;font-size:9px;line-height:11px;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85;pointer-events:none}' +
        // phone on its side: the bottom bar becomes a column on the right edge, the timeline stays docked under the header
        '@media (orientation:landscape) and (max-height:520px){.mm-bottom{left:auto!important;right:0!important;top:0!important;bottom:0!important;width:64px!important;height:auto!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:4px;padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px)) 4px!important;padding-right:calc(4px + env(safe-area-inset-right,0px))!important}' +
        '.mm-bottom>*{flex:0 0 auto!important;width:100%!important}.mm-top{right:calc(64px + env(safe-area-inset-right,0px))!important;width:auto!important}.pc-mtl{right:calc(72px + env(safe-area-inset-right,0px))}}';
      document.head.appendChild(st);
      var box = document.createElement('div'); box.className = 'pc-mtl idle'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Tour timeline');
      var r1 = document.createElement('div'); r1.className = 'r1'; var sw = document.createElement('div'); sw.className = 'sw';
      var bW = btn('Walk', 'Walk-through', function () { pick('walk'); }), bF = btn('Fly', 'Fly-through', function () { pick('fly'); }); sw.appendChild(bW); sw.appendChild(bF);
      var play = btn('▶', 'Play / pause', function () { var s = W.state(); if (s.playing) W.pause(); else go(want, 0); });
      var ln = document.createElement('div'); ln.className = 'ln'; var fl = document.createElement('div'); fl.className = 'fl'; ln.appendChild(fl);
      var sp = btn('1×', 'Speed', function () { var v = W.state().speed === 2 ? 1 : 2; W.setSpeed(v); sp.textContent = v + '×'; });
      var nw = document.createElement('div'); nw.className = 'nw';
      r1.appendChild(sw); r1.appendChild(play); r1.appendChild(ln); r1.appendChild(sp); box.appendChild(r1); ln.appendChild(nw); document.body.appendChild(box);
      var want = 'walk', cache = {}, key = '';
      function pick(m) { want = m; var s = W.state(); if (s.playing && s.mode !== m) go(m, 0); paint(); }
      function go(m, t) {   // start (or switch to) a mode, then jump to t once its route is ready
        var s = W.state(); if (!s.playing || s.mode !== m) { if (s.playing) W.stop(false); m === 'fly' ? W.startFly() : W.start(); }
        if (t > 0) (function wait(n) { var q = W.state(); if (q.playing && !q.preparing && q.total) W.seek(t); else if (n < 200) setTimeout(function () { wait(n + 1); }, 100); })(0);
      }
      function fmt(x) { x = Math.max(0, x | 0); return (x / 60 | 0) + ':' + ('0' + x % 60).slice(-2); }
      function paint() {
        var s = W.state(), on = s.playing, m = on ? s.mode : want; bW.setAttribute('aria-pressed', m === 'walk' ? 'true' : 'false'); bF.setAttribute('aria-pressed', m === 'fly' ? 'true' : 'false');
        box.classList.toggle('idle', !on); play.textContent = on && !s.paused ? '❚❚' : '▶';
        if (on && s.total && s.markers.length) cache[s.mode] = { total: s.total, markers: s.markers };
        var c = cache[m], k = m + (c ? c.total.toFixed(1) + c.markers.length : '');
        if (k !== key) { key = k; Array.prototype.slice.call(ln.querySelectorAll('.mk')).forEach(function (e) { e.remove(); });
          if (c) c.markers.forEach(function (mk) { var d = document.createElement('button'); d.type = 'button'; d.className = 'mk'; d.setAttribute('aria-label', 'Jump to ' + mk.label); d.title = mk.label; d.style.left = (100 * mk.t / c.total) + '%'; d.addEventListener('click', function () { go(m, mk.t); if (W.state().playing) W.seek(mk.t); }); ln.appendChild(d); }); }
        fl.style.width = on && s.total ? (100 * s.t / s.total) + '%' : '0';
        var cur = null; if (on) s.markers.forEach(function (mk) { if (mk.t <= s.t + .3) cur = mk; });
        Array.prototype.forEach.call(ln.querySelectorAll('.mk'), function (e, i) { e.classList.toggle('on', !!(on && c && c.markers[i] === cur)); });
        nw.textContent = s.preparing ? 'Preparing the route…' : on ? (cur ? cur.label + '  ·  ' : '') + fmt(s.t) + ' / ' + fmt(s.total) : (m === 'walk' ? 'Walk-through' : 'Fly-through') + ' · tap ▶ or Tour to start' + (c ? ', or a marker to jump in' : '');
      }
      ln.addEventListener('click', function (ev) { if (ev.target.closest('.mk')) return; var s = W.state(); if (!s.playing || !s.total) return; var r = ln.getBoundingClientRect(); W.seek((ev.clientX - r.left) / r.width * s.total); });
      // the bar's Tour button now drives this timeline
      document.addEventListener('click', function (ev) { var t = ev.target.closest && ev.target.closest('.mm-bottom [data-mm-mode="tour"]'); if (!t) return; ev.preventDefault(); ev.stopImmediatePropagation(); var s = W.state(); if (s.playing && s.mode === want) W.pause(); else go(want, 0); }, true);
      (function place() { var b = document.querySelector('.mm-bottom'), vis = b && b.getBoundingClientRect().height > 0 && getComputedStyle(b).display !== 'none';
        var h = document.querySelector('.mm-top'), hb = h ? h.getBoundingClientRect().bottom : 0;   // docked right under the header bar
        box.hidden = !vis; if (vis) box.style.top = (Math.max(0, hb) + 6) + 'px'; paint(); requestAnimationFrame(place); })();
    }
})();
