/* Builds the 3D project pages' side rail in the home page's navigation (same links, order and style as index.html), so the 3D
   viewers read as part of the same site. Keeps the page's own logo; marks the current project under Architecture > Interactive. */
(function () {
  var rail = document.getElementById('portfolio-rail'); if (!rail) return;
  var logo = rail.querySelector('svg'), here = location.pathname.replace(/\\/g, '/');
  var CATS = [['interactive', 'Interactive'], ['studies', 'Studies'], ['drafting', 'Drafting'], ['practice', 'Consulting'], ['renders', 'Renders'], ['fabrication', 'Fabrication'], ['portfolio', 'Portfolio']];
  var PROJECTS = [['Hive', '../Hive/Hive.html'], ['Phalanstery', '../Phalanstery/Phalanstery.html'], ['Tranquil River', '../Tranquil-River/Tranquil-River.html'], ['Net Zero School', '../Net-Zero-School/Net-Zero-School.html']];
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function isHere(href) { var dir = href.split('/')[1]; return here.indexOf('/' + dir + '/') >= 0; }
  var mark = document.createElement('a'); mark.className = 'sr-mark'; mark.href = '../index.html#home'; mark.setAttribute('aria-label', 'ArchiWatts home'); if (logo) mark.appendChild(logo);
  var nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Site');
  nav.innerHTML = '<ul class="sr-links">' +
    '<li><a href="../index.html#arch" aria-current="page">Architecture</a><ul class="sr-sub" aria-label="Architecture categories">' +
    CATS.map(function (c) {
      return '<li><a href="../index.html#arch/' + c[0] + '"' + (c[0] === 'interactive' ? ' aria-current="true"' : '') + '>' + c[1] + '</a>' +
        (c[0] === 'interactive' ? '<ul class="sr-proj" aria-label="3D projects">' + PROJECTS.map(function (p) { return '<li><a href="' + p[1] + '"' + (isHere(p[1]) ? ' aria-current="page"' : '') + '>' + esc(p[0]) + '</a></li>'; }).join('') + '</ul>' : '') + '</li>';
    }).join('') + '</ul></li>' +
    '<li><a href="../graphic-design/index.html">Graphic Design</a></li>' +
    '<li><a href="https://archiwatts-art.me/">Art ↗</a></li>' +
    '<li><a href="../index.html#about">About &amp; Contact</a></li></ul>';
  rail.textContent = ''; rail.appendChild(mark); rail.appendChild(nav);

  // phones: the top bar (mobile-nav-c.js) gets the home page's phone header: logo tile, project name, a "Menu" pill whose list is
  // the site navigation (Architecture with the four 3D projects, Graphic Design, Art, About & Contact)
  (function phone() {
    var chrome = document.getElementById('mobile-model-chrome'); if (!chrome) return;
    var logoLink = chrome.querySelector('.mm-logo'), btn = chrome.querySelector('.mm-project'), list = chrome.querySelector('.mm-projects');
    if (logoLink) logoLink.classList.add('sr-phone-mark');
    if (btn) { var arrow = btn.querySelector('span[aria-hidden]'); if (arrow) { arrow.className = 'sr-menu-pill'; arrow.textContent = 'Menu'; } btn.setAttribute('aria-label', 'Site menu'); }
    if (list) {
      list.setAttribute('aria-label', 'Site');
      list.innerHTML = '<ul class="sr-links">' +
        '<li><a href="../index.html#arch" aria-current="page">Architecture</a><ul class="sr-proj" aria-label="3D projects">' +
        PROJECTS.map(function (p) { return '<li><a href="' + p[1] + '"' + (isHere(p[1]) ? ' aria-current="page"' : '') + '>' + esc(p[0]) + '</a></li>'; }).join('') + '</ul></li>' +
        '<li><a href="../graphic-design/index.html">Graphic Design</a></li>' +
        '<li><a href="https://archiwatts-art.me/">Art ↗</a></li>' +
        '<li><a href="../index.html#about">About &amp; Contact</a></li></ul>';
    }
  })();
})();
