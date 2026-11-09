/* Slide-through document viewer for project pages: a PDF shown as its pages, one at a time.
   Markup: <div class="pp-deck" data-src="folder/" data-n="46" data-title="Project portfolio"></div> (pages folder/page-001.webp ...).
   Arrows, keys, swipe and the thumbnail strip move through the deck; the zoom buttons (or a double-click) enlarge the page and it
   can be dragged around; the full-screen button fills the screen. Used inline and by deck.html (opened in a new tab). */
(function () {
  function pad(i) { return ('00' + i).slice(-3); }
  function build(el) {
    var src = el.getAttribute('data-src'), n = +el.getAttribute('data-n'), title = el.getAttribute('data-title') || 'Document', i = 0, z = 1, px = 0, py = 0;
    el.innerHTML = '<div class="dk-stage"><img class="dk-page" alt=""><button class="dk-nav dk-prev" aria-label="Previous page">‹</button><button class="dk-nav dk-next" aria-label="Next page">›</button></div>' +
      '<div class="dk-bar"><span class="dk-count"></span><span class="dk-tools"><button class="dk-zo" aria-label="Zoom out">−</button><button class="dk-zi" aria-label="Zoom in">+</button><button class="dk-fs" aria-label="Full screen">⤢</button></span></div><div class="dk-thumbs"></div>';
    var stage = el.querySelector('.dk-stage'), img = el.querySelector('.dk-page'), count = el.querySelector('.dk-count'), thumbs = el.querySelector('.dk-thumbs');
    for (var k = 0; k < n; k++) (function (k) { var b = document.createElement('button'); b.className = 'dk-thumb'; b.setAttribute('aria-label', 'Page ' + (k + 1)); b.innerHTML = '<img loading="lazy" alt="" src="' + src + 'page-' + pad(k + 1) + '.webp">'; b.onclick = function () { go(k); }; thumbs.appendChild(b); })(k);
    function view() { img.style.transform = 'translate(' + px + 'px,' + py + 'px) scale(' + z + ')'; stage.classList.toggle('zoomed', z > 1); }
    function go(k) {
      i = Math.max(0, Math.min(n - 1, k)); z = 1; px = py = 0; view();
      img.src = src + 'page-' + pad(i + 1) + '.webp'; img.alt = title + ', page ' + (i + 1); count.textContent = title + ' · ' + (i + 1) + ' / ' + n;
      [].forEach.call(thumbs.children, function (t, j) { t.classList.toggle('on', j === i); }); var t = thumbs.children[i]; if (t) thumbs.scrollTo({ left: t.offsetLeft - thumbs.clientWidth / 2 + t.clientWidth / 2, behavior: 'smooth' });
      if (i + 1 < n) new Image().src = src + 'page-' + pad(i + 2) + '.webp';
    }
    function zoom(f) { z = Math.max(1, Math.min(4, z * f)); if (z === 1) px = py = 0; view(); }
    el.querySelector('.dk-prev').onclick = function () { go(i - 1); }; el.querySelector('.dk-next').onclick = function () { go(i + 1); };
    el.querySelector('.dk-zi').onclick = function () { zoom(1.5); }; el.querySelector('.dk-zo').onclick = function () { zoom(1 / 1.5); };
    el.querySelector('.dk-fs').onclick = function () { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(function () {}); };
    img.ondblclick = function () { if (z > 1) { z = 1; px = py = 0; view(); } else zoom(2.2); };
    el.tabIndex = 0; el.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === '+' || e.key === '=') zoom(1.5); else if (e.key === '-') zoom(1 / 1.5); else return; e.preventDefault(); });
    // drag to pan when zoomed, swipe to turn pages when not
    var sx = 0, sy = 0, ox = 0, oy = 0, down = false;
    stage.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; down = true; sx = e.clientX; sy = e.clientY; ox = px; oy = py; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) { if (!down || z === 1) return; px = ox + e.clientX - sx; py = oy + e.clientY - sy; view(); });
    stage.addEventListener('pointerup', function (e) { if (!down) return; down = false; var dx = e.clientX - sx; if (z === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sy)) go(i + (dx < 0 ? 1 : -1)); });
    stage.addEventListener('wheel', function (e) { if (!e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    var start = +(new URLSearchParams(location.search).get('page') || 1) - 1; go(el.hasAttribute('data-follow-url') ? start : 0);
  }
  function init() { document.querySelectorAll('.pp-deck').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
