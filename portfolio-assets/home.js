/* ArchiWatts homepage: builds the menu and views from the data below, then handles routing. */
(() => {
const $ = id => document.getElementById(id);
const body = document.body;

/* ---------- data ---------- */
const MAIN = [
  {id:'Hive', title:'Hive', tag:'Capstone · Miami, Florida', img:'img/Hive/model/overview.png'},
  {id:'Phalanstery', title:'Phalanstery', tag:'New Harmony · Architectural representation', img:'img/Phalanstery/model/overview.png'},
  {id:'Tranquil-River', title:'Tranquil River', tag:'Kikuletwa Hot Springs · Tanzania', img:'img/Tranquil-River/model/overview.png'},
  {id:'Net-Zero-School', title:'Net Zero School', tag:'Henry S. West Laboratory School · Coral Gables', img:'img/Net-Zero-School/model/overview.png'}
];
const MORE = [
  {title:'Venice Apartments', sub:'3D model · drawings', slug:'venice-apartments', gallery:'projects/venice-redesign/index.html'},
  {title:'Allure Waterways', sub:'3D model · drawings', slug:'allure-waterways', gallery:'projects/allure-of-the-sea/index.html'},
  {title:'Museum of Emotions', sub:'Three studies · 3D', slug:'museum-of-emotions', gallery:'projects/museum-of-emotions/index.html', studies:true},
  {title:'Cantilever Barn', sub:'East Tennessee · drawings · 3D', slug:'east-tennessee-cantilever-barn', gallery:'projects/cantilever-barn/index.html'},
  {title:'Wheels on Water', sub:'3D model', slug:'wheels-on-water', gallery:'projects/wheels-on-water/index.html'},
  {title:'Bench Boat', sub:'Bench studies · 3D', slug:'bench-boat', gallery:'projects/bench-studies/index.html'},
  {title:'Bench D9', sub:'Bench studies · 3D', slug:'bench-d9', gallery:'projects/bench-studies/index.html'},
  {title:'North Beach Youth Center', sub:'Youth center · 3D', slug:'north-beach-youth-center', gallery:'projects/north-beach-youth-center/index.html'},
  {title:'A Moment in Monument', sub:'Winter Stations 2027 · interactive wall', slug:'winter-station-2027', gallery:'projects/winter-station-2027/index.html'}
];
const STORIES = [
  {title:'Hive', sub:'A new ground above the city.', href:'Hive/story.html', img:'img/Hive/renders/best-render-capstone-front-view.webp'},
  {title:'Phalanstery', sub:'A city within a frame.', href:'Phalanstery/story.html', img:'img/Phalanstery/renders/best-render-phalanstery-17.webp'},
  {title:'Tranquil River', sub:'A hidden spring. A timber ribcage.', href:'Tranquil-River/story.html', img:'img/Tranquil-River/renders/best-render.webp'},
  {title:'Net Zero School', sub:'Learning across a connected campus.', href:'Net-Zero-School/story.html', img:'img/Net-Zero-School/drafting/best-energy-model.webp'},
  {title:'London Vertical Farm', sub:'Vertical farming studies.', href:'London-Vertical-Farm/story.html', img:'img/London-Vertical-Farm/renders/best-render.webp'},
  {title:'Early Studies & Experiments', sub:'First two years: design, hand drawings, CAD, and digital models.', href:'Early-Studies/index.html', badge:'ES'}
];
const GALLERIES = [
  {title:'New project collections', sub:'Latest drawings, renders, and presentations.', href:'latest-additions.html', badge:'NEW'},
  {title:'North Beach Youth Center', sub:'Drawings and studies', href:'projects/north-beach-youth-center/index.html', img:'interactive/north-beach-youth-center/preview.webp'},
  {title:'Venice Apartments', sub:'Drawings and studies', href:'projects/venice-redesign/index.html', img:'interactive/venice-apartments/preview.webp'},
  {title:'Allure Waterways', sub:'Drawings and studies', href:'projects/allure-of-the-sea/index.html', img:'interactive/allure-waterways/preview.webp'},
  {title:'Museum of Emotions', sub:'Drawings and studies', href:'projects/museum-of-emotions/index.html', img:'interactive/museum-of-emotions/preview.webp'},
  {title:'Wheels on Water', sub:'Drawings and studies', href:'projects/wheels-on-water/index.html', img:'interactive/wheels-on-water/preview.webp'},
  {title:'Winter Station 2027', sub:'Drawings, presentation, and project PDF', href:'projects/winter-station-2027/index.html', img:'interactive/winter-station-2027/preview.webp'},
  {title:'Computational Design Studies', sub:'Drawings and studies', href:'projects/computational-design-studies/index.html', badge:'CD'}
];
const CATS = [
  ['interactive','Interactive','Enter the work. Walk through the models in 3D.'],
  ['studies','Studies','Project stories and the ideas behind them.'],
  ['drafting','Drafting','Plans, sections, and the discipline of drawing.'],
  ['practice','Consulting','Work shaped by real sites and collaboration.'],
  ['renders','Renders','Light, material, and atmosphere.'],
  ['fabrication','Fabrication','From drawings to objects and material studies.'],
  ['portfolio','Portfolio','Collected architectural work, organized by year.']
];
const CARDS = [
  {title:'Architecture', sub:'Spatial studies, project stories, and interactive models.', href:'#arch', poster:'img/architecture-poster.jpg', video:'vid/architecture-reel.mp4', wide:true},
  {title:'Graphic Design', sub:'Branding, illustration, and graphic work.', href:'graphic-design/index.html', poster:'img/graphic-design.jpg', contain:true},
  {title:'Art ↗', sub:'Experimental forms and moving images.', href:'https://archiwatts-art.me/', poster:'img/art-poster.jpg', video:'vid/art-animation.mp4'}
];

/* ---------- templates ---------- */
const img = (src, alt, extra = '') => `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" ${extra}>`;

const modelTile = p => `<article class="tile">
<a class="thumb" href="${p.id}/${p.id}.html" aria-label="${p.title}: explore in 3D" tabindex="-1">${img(p.img, p.title + ' 3D model')}</a>
<div class="body"><h3>${p.title}</h3><small>${p.tag}</small>
<div class="btns">
<a class="btn dk-only" href="${p.id}/${p.id}.html">Explore in 3D ↗</a>
<a class="btn alt dk-only" href="${p.id}/story.html">Project story →</a>
<a class="btn ph-only" href="${p.id}/story.html">Project story →</a>
<a class="btn alt ph-only" href="${p.id}/${p.id}.html">Open 3D model anyway ↗</a>
</div><p class="note">The full 3D model works best on a computer.</p></div></article>`;

const row = (title, sub, thumb, main, links = '') => `<div class="row"><span class="t">${thumb}</span>
<a class="m" href="${main}"><b>${title}</b><small>${sub}</small></a>${links ? `<span class="links">${links}</span>` : ''}</div>`;

const moreRow = p => {
  const base = `interactive/${p.slug}/index.html`;
  const studies = p.studies ? `<a href="${base}?study=2">Study 2</a><a href="${base}?study=3">Study 3</a>` : '';
  return row(p.title, p.sub, img(`interactive/${p.slug}/preview.webp`, ''), base, `<a href="${p.gallery}">Gallery →</a>${studies}`);
};

const linkRow = r => row(r.title, r.sub, r.img ? img(r.img, '') : (r.badge || ''), r.href);

const tileLink = (href, src, alt, title, sub) => `<a class="tile" href="${href}"><span class="thumb">${img(src, alt)}</span><span class="body"><h3>${title}</h3><small>${sub}</small></span></a>`;

const panels = {
  interactive: () => `<div class="models">${MAIN.map(modelTile).join('')}</div>
<h3 class="sec">More 3D studies</h3><div class="rows">${MORE.map(moreRow).join('')}</div>
<p style="margin-top:20px"><a class="go" href="interactive/index.html">All interactive projects →</a></p>`,
  studies: () => `<h3 class="sec" style="margin-top:0">Project stories</h3><div class="rows">${STORIES.map(linkRow).join('')}</div>
<h3 class="sec">Drawings and studies</h3><div class="rows">${GALLERIES.map(linkRow).join('')}</div>`,
  drafting: () => `<a class="go" href="galleries/drafting.html">Open the drafting gallery →</a>
<div class="models">${tileLink('projects/cantilever-barn/index.html','interactive/east-tennessee-cantilever-barn/preview.webp','Cantilever Barn model','Cantilever Barn','Drawings and 3D study')}
${tileLink('galleries/drafting.html','img/UBC-Tallwood-House/drafting/brock-commons-tallwood-house-code-compliance-page-1.webp','UBC Tallwood House drawing','UBC Tallwood House','Code compliance drawings')}
${tileLink('galleries/drafting.html','img/Redfox-Commons/drafting/redfox-drawings.webp','Redfox Commons drawing','Redfox Commons','Drawings')}
${tileLink('projects/bench-studies/index.html','interactive/bench-d9/preview.webp','Bench D9 model','Bench Studies','Boat and D9')}</div>`,
  practice: () => `<a class="go" href="galleries/practice.html">Open the consulting gallery →</a>
<div class="models">${tileLink('galleries/practice.html','img/Design360/renders/best-render-zoom-action.webp','Design360 project view','Design360','Design consultant, Aug. – Sep. 2022')}</div>`,
  renders: () => `<a class="go" href="galleries/renders.html">Open the renders gallery →</a>
<div class="models">${[['Hive','img/Hive/renders/best-render-capstone-front-view.webp'],['Tranquil-River','img/Tranquil-River/renders/best-render.webp'],['Phalanstery','img/Phalanstery/renders/best-render-phalanstery-17.webp']].map(([id,src]) => { const t = id.replace('-', ' '); return tileLink(id + '/story.html#gallery', src, t + ' render', t, 'View renders'); }).join('')}</div>`,
  fabrication: () => `<a class="go" href="galleries/fabrication.html">Open the fabrication gallery →</a>
<div class="models">${tileLink('galleries/fabrication.html','img/Table-X/drafting/table-drawings.webp','Table X drawings','Table X','Fabrication drawings')}
${tileLink('galleries/fabrication.html','img/Standing-Desk/drafting/desk-drawings.webp','Standing desk drawings','Standing Desk','Fabrication drawings')}</div>`,
  portfolio: () => `<a class="go" href="galleries/portfolio.html">Open the architectural portfolio →</a>
<div class="models">${tileLink('galleries/portfolio.html','img/arc-portfolio/2024/page-01.webp','Architectural portfolio 2024','2024 Portfolio','Collected work')}
${tileLink('galleries/portfolio.html#year-2020','img/arc-portfolio/2024/page-01.webp','Architectural portfolio 2020','2020 Portfolio','Collected work')}</div>`
};

/* ---------- build ---------- */
const svg = $('svgsrc').innerHTML;
const tilt = $('tilt');
for (let z = 8; z >= 0; z -= 2) {
  const d = document.createElement('div');
  d.className = 'layer' + (z ? '' : ' front');
  d.style.setProperty('--z', z);
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = svg;
  tilt.append(d);
}
$('home').firstElementChild.innerHTML = svg;

$('links').innerHTML = `<li><a href="#arch" data-r="arch">Architecture</a>
<ul class="sub" aria-label="Architecture categories">${CATS.map(([id, t]) => `<li><a href="#arch/${id}" data-c="${id}">${t}</a></li>`).join('')}</ul></li>
<li><a href="graphic-design/index.html">Graphic Design</a></li>
<li><a href="https://archiwatts-art.me/">Art ↗</a></li>
<li><a href="#about" data-r="about">About &amp; Contact</a></li>`;

$('cards').innerHTML = CARDS.map(c => `<article class="card${c.wide ? ' wide' : ''}">
<a class="cover" href="${c.href}"${c.href.startsWith('http') ? ' rel="noopener"' : ''}><div class="frame">${
  c.video ? `<video src="${c.video}" poster="${c.poster}" muted loop playsinline preload="none" aria-label="${c.title.replace(' ↗','')} preview"></video>`
          : `<img class="${c.contain ? 'contain' : ''}" src="${c.poster}" alt="${c.title} preview" loading="lazy">`}</div>
<div class="cap"><b>${c.title}</b><span>${c.sub}</span></div></a>${c.video ? '<button class="vt" type="button">Pause preview</button>' : ''}</article>`).join('');

$('tabs').innerHTML = CATS.map(([id, t]) => `<li><a href="#arch/${id}" data-c="${id}">${t}</a></li>`).join('');
$('panels').innerHTML = CATS.map(([id, t, d]) => `<section class="panel" id="cat-${id}" aria-label="${t}" hidden><h2>${t}</h2><p class="lede">${d}</p>${panels[id]()}</section>`).join('');

/* ---------- videos ---------- */
const reduced = matchMedia('(prefers-reduced-motion:reduce)');
const videos = [...document.querySelectorAll('#cards video')];
function syncVideos() {
  for (const v of videos) {
    const btn = v.closest('.card').querySelector('.vt');
    const wantPlay = body.dataset.v === 'home' && !document.hidden && v.dataset.inView === 'true' && v.dataset.paused !== 'true';
    if (wantPlay) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
    btn.textContent = v.dataset.paused === 'true' ? 'Play preview' : 'Pause preview';
    btn.setAttribute('aria-label', btn.textContent + ': ' + v.getAttribute('aria-label'));
  }
}
videos.forEach(v => {
  if (reduced.matches) v.dataset.paused = 'true';
  v.closest('.card').querySelector('.vt').onclick = () => {
    v.dataset.paused = String(v.dataset.paused !== 'true');
    syncVideos();
  };
});
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => { for (const e of es) e.target.dataset.inView = String(e.isIntersecting); syncVideos(); }, {threshold: .25});
  videos.forEach(v => io.observe(v));
} else videos.forEach(v => v.dataset.inView = 'true');
document.addEventListener('visibilitychange', syncVideos);

/* ---------- routing ---------- */
const views = {home: $('vHome'), arch: $('vArch'), about: $('vAbout')};
let first = true;
function route() {
  const hash = location.hash.slice(1);
  if (!hash) { body.classList.remove('docked', 'mo'); body.dataset.v = 'intro'; syncVideos(); return; }
  const [r, sub] = hash.split('/');
  const v = r === 'arch' ? 'arch' : (r === 'about' || r === 'contact') ? 'about' : 'home';
  body.classList.add('docked');
  body.classList.remove('mo');
  $('mb').setAttribute('aria-expanded', 'false');
  body.dataset.v = v;
  for (const [k, el] of Object.entries(views)) { el.hidden = k !== v; el.inert = k !== v; }
  const cat = CATS.some(c => c[0] === sub) ? sub : 'interactive';
  document.querySelectorAll('.panel').forEach(p => p.hidden = p.id !== 'cat-' + cat);
  document.querySelectorAll('[data-c]').forEach(a => { if (v === 'arch' && a.dataset.c === cat) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  document.querySelectorAll('#links a[data-r]').forEach(a => { if (a.dataset.r === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = {home: 'ArchiWatts | Architecture, graphics, and art', arch: 'Architecture | ArchiWatts', about: 'About & Contact | ArchiWatts'}[v];
  scrollTo(0, 0);
  if (!first) { const h = views[v].querySelector('h1'); h && h.focus({preventScroll: true}); }
  first = false;
  syncVideos();
}
function enter() { location.hash = 'home'; }
$('logo').addEventListener('click', enter);
$('mb').addEventListener('click', () => { const open = body.classList.toggle('mo'); $('mb').setAttribute('aria-expanded', String(open)); });
$('links').addEventListener('click', e => { if (e.target.closest('a')) body.classList.remove('mo'); $('mb').setAttribute('aria-expanded', 'false'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && body.classList.contains('mo')) { body.classList.remove('mo'); $('mb').setAttribute('aria-expanded', 'false'); $('mb').focus(); } });
document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); location.hash = a.dataset.go; }));
addEventListener('hashchange', route);
addEventListener('wheel', e => { if (!location.hash && e.deltaY > 20) enter(); }, {passive: true});
let startY = 0;
addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive: true});
addEventListener('touchend', e => { if (!location.hash && startY - e.changedTouches[0].clientY > 50) enter(); }, {passive: true});
let frame = 0, pt;
addEventListener('pointermove', e => {
  if (location.hash || reduced.matches) return;
  pt = e; if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; tilt.style.setProperty('--ry', (pt.clientX / innerWidth - .5) * 34 + 'deg'); tilt.style.setProperty('--rx', (.5 - pt.clientY / innerHeight) * 22 + 'deg'); });
}, {passive: true});
/* ---------- ambient circuit background: faint traces like the logo, with pink pulses ---------- */
(() => {
  const c = $('bg'); if (!c) return;
  const ctx = c.getContext('2d');
  const phone = matchMedia('(max-width:760px)').matches;
  let W = 0, H = 0, D = 1, paths = [], raf = 0, last = 0, running = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function build() {
    D = Math.min(devicePixelRatio || 1, 1.5);
    W = c.width = Math.round(innerWidth * D); H = c.height = Math.round(innerHeight * D);
    const g = 56 * D, count = phone ? 7 : 16;
    paths = [];
    for (let i = 0; i < count; i++) {
      let x = Math.round(rnd(0, W / g)) * g, y = Math.round(rnd(0, H / g)) * g;
      const pts = [[x, y]];
      let diag = Math.random() < .5;
      const segs = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < segs; s++) {
        const n = 2 + Math.floor(Math.random() * 5), sx = Math.random() < .5 ? 1 : -1;
        if (diag) { x += sx * n * g; y += n * g; } else { y += (Math.random() < .5 ? 1 : -1) * n * g; }
        pts.push([x, y]); diag = !diag;
      }
      let len = 0; const L = [0];
      for (let k = 1; k < pts.length; k++) { len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); L.push(len); }
      paths.push({pts, L, len, t: Math.random(), v: rnd(.00004, .00009), node: ['ring', 'dot', 'pink'][Math.floor(Math.random() * 3)]});
    }
  }
  function at(p, t) {
    const d = t * p.len; let k = 1; while (k < p.L.length - 1 && p.L[k] < d) k++;
    const a = p.pts[k - 1], b = p.pts[k], u = (d - p.L[k - 1]) / (p.L[k] - p.L[k - 1] || 1);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const p of paths) {
      ctx.strokeStyle = 'rgba(242,240,244,.075)'; ctx.lineWidth = 1.6 * D;
      ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      const e = p.pts[p.pts.length - 1];
      ctx.beginPath(); ctx.arc(e[0], e[1], 5 * D, 0, 7);
      if (p.node === 'pink') { ctx.fillStyle = 'rgba(224,85,124,.35)'; ctx.fill(); }
      else if (p.node === 'dot') { ctx.fillStyle = 'rgba(242,240,244,.10)'; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(242,240,244,.12)'; ctx.stroke(); }
      p.t = (p.t + p.v * dt) % 1;
      const [px, py] = at(p, p.t);
      const g = ctx.createRadialGradient(px, py, 0, px, py, 14 * D);
      g.addColorStop(0, 'rgba(224,85,124,.75)'); g.addColorStop(1, 'rgba(224,85,124,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 14 * D, 0, 7); ctx.fill();
    }
  }
  function frame(now) {
    raf = 0;
    if (!running) return;
    if (now - last >= (phone ? 50 : 33)) { draw(Math.min(now - last, 100)); last = now; }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    const should = body.classList.contains('docked') && !document.hidden && !reduced.matches;
    if (should && !running) { running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
    else if (!should) { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } if (body.classList.contains('docked')) draw(0); }
  }
  build();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); sync(); draw(0); }, 200); });
  document.addEventListener('visibilitychange', sync);
  addEventListener('hashchange', sync);
  new MutationObserver(sync).observe(body, {attributes: true, attributeFilter: ['class']});
  sync();
})();
route();
})();
