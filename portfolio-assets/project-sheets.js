/* Project sheets: renders, drawings and diagrams for a model page, opened from a button next to the model controls. Configure with window.PROJECT_SHEETS = { title, button, sets: [{ id, name, items: [{ src, t }] }] }. */
(function () {
  var CFG = window.PROJECT_SHEETS || { title: 'Drawings', sets: [] };
  var SETS = CFG.sets;  var css = '#dw{position:fixed;inset:0;z-index:5000;background:#1c1b1e;color:#f2f0f4;font:400 15px/1.5 Archivo,system-ui,sans-serif;display:none;flex-direction:column}#dw.open{display:flex}' +
    '#dw header{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:14px max(16px,env(safe-area-inset-left,0px));border-bottom:1px solid #4d4953}' +
    '#dw h2{margin:0;font-size:20px;flex:none}#dw .tabs{display:flex;gap:8px;flex-wrap:wrap;flex:1}' +
    '#dw button{font:700 13px Archivo,system-ui,sans-serif;color:#f2f0f4;background:#26242a;border:1.5px solid #4d4953;border-radius:999px;padding:0 16px;min-height:44px;cursor:pointer}#dw button:hover{border-color:#fff}' +
    '#dw .tabs button[aria-pressed=true]{background:#e0557c;border-color:#e0557c;color:#1c1b1e}' +
    '#dw .grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:16px max(16px,env(safe-area-inset-left,0px));align-content:start}' +
    '#dw figure{margin:0;background:#26242a;border:1.5px solid #4d4953;border-radius:10px;overflow:hidden;cursor:pointer}#dw figure:hover{border-color:#e0557c}' +
    '#dw figure img{width:100%;height:190px;object-fit:contain;background:#fff;display:block}#dw figcaption{padding:8px 10px;font-size:13px}' +
    '#dw .empty{grid-column:1/-1;color:#c9c4d0;max-width:60ch}' +
    '#dw .lb{position:fixed;inset:0;background:#0d0c0ee6;display:none;align-items:center;justify-content:center;z-index:2}#dw .lb.open{display:flex}' +
    '#dw .lb img{max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);background:#fff;object-fit:contain}#dw .lb .bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:8px;align-items:center;justify-content:center;padding:14px;flex-wrap:wrap}#dw .lb .cap{color:#f2f0f4;font-size:14px;width:100%;text-align:center}' +
    '#sheets-button{margin-left:6px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var dw = document.createElement('div'); dw.id = 'dw'; dw.setAttribute('role', 'dialog'); dw.setAttribute('aria-label', CFG.title);
  dw.innerHTML = '<header><h2></h2><div class="tabs" role="tablist"></div><button type="button" id="dw-close">Close</button></header><div class="grid"></div><div class="lb"><img alt=""><div class="bar"><div class="cap"></div><button type="button" data-a="prev">Previous</button><button type="button" data-a="next">Next</button><button type="button" data-a="x">Close view</button></div></div>';
  var cur = SETS[0], at = 0; dw.querySelector('h2').textContent = CFG.title;
  var tabs = dw.querySelector('.tabs'), grid = dw.querySelector('.grid'), lb = dw.querySelector('.lb'), lbi = lb.querySelector('img'), cap = lb.querySelector('.cap');
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function renderTabs() { tabs.innerHTML = SETS.map(function (s) { return '<button type="button" role="tab" data-id="' + s.id + '" aria-pressed="' + (s === cur) + '">' + s.name + ' (' + s.items.length + ')</button>'; }).join(''); }
  function renderGrid() {
    if (!cur.items.length) { grid.innerHTML = '<p class="empty">Nothing has been added to this group yet.</p>'; return; }
    grid.innerHTML = cur.items.map(function (it, i) { return '<figure data-i="' + i + '"><img loading="lazy" decoding="async" src="' + it.src + '" alt="' + esc(it.t) + '"><figcaption>' + esc(it.t) + '</figcaption></figure>'; }).join('');
  }
  function show(i) { at = (i + cur.items.length) % cur.items.length; var it = cur.items[at]; lbi.src = it.src; lbi.alt = it.t; cap.textContent = it.t + '  (' + (at + 1) + ' of ' + cur.items.length + ')'; lb.classList.add('open'); }
  tabs.addEventListener('click', function (e) { var b = e.target.closest('button[data-id]'); if (!b) return; cur = SETS.filter(function (s) { return s.id === b.dataset.id; })[0]; renderTabs(); renderGrid(); grid.scrollTop = 0; });
  grid.addEventListener('click', function (e) { var f = e.target.closest('figure'); if (f) show(+f.dataset.i); });
  lb.addEventListener('click', function (e) { var a = e.target.dataset && e.target.dataset.a; if (a === 'prev') show(at - 1); else if (a === 'next') show(at + 1); else if (a === 'x' || e.target === lb) lb.classList.remove('open'); });
  function open() { dw.classList.add('open'); renderTabs(); renderGrid(); }
  function close() { dw.classList.remove('open'); lb.classList.remove('open'); }
  dw.querySelector('#dw-close').addEventListener('click', close);
  addEventListener('keydown', function (e) {
    if (!dw.classList.contains('open')) return;
    if (e.key === 'Escape') { if (lb.classList.contains('open')) lb.classList.remove('open'); else close(); }
    else if (lb.classList.contains('open') && e.key === 'ArrowRight') show(at + 1);
    else if (lb.classList.contains('open') && e.key === 'ArrowLeft') show(at - 1);
  });
  function start() {
    document.body.appendChild(dw);
    var bar = document.querySelector('.view-tools');
    if (bar && SETS.length) { var b = document.createElement('button'); b.id = 'sheets-button'; b.type = 'button'; b.textContent = CFG.button || 'Drawings'; b.addEventListener('click', open); bar.appendChild(b); }
  }
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
