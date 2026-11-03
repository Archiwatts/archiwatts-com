/* Builds the 3D project pages' side rail in the home page's navigation (same links, order and style as index.html), so the 3D
   viewers read as part of the same site. Keeps the page's own logo; marks the current project under Architecture > Interactive.
   Links are built from this script's own location, so the same rail works at any folder depth. */
(function () {
  var rail = document.getElementById('portfolio-rail'); if (!rail) return;
  var me = document.currentScript, ROOT = me && me.src ? me.src.replace(/portfolio-assets\/site-rail\.js.*$/, '') : '../';
  var logo = rail.querySelector('svg'), here = location.pathname.replace(/\\/g, '/');
  var CATS = [['interactive', 'Interactive'], ['studies', 'Studies'], ['drafting', 'Drafting'], ['practice', 'Consulting'], ['renders', 'Renders'], ['fabrication', 'Fabrication'], ['portfolio', 'Portfolio']];
  var PROJECTS = [['Hive', 'Hive/Hive.html'], ['Phalanstery', 'Phalanstery/Phalanstery.html'], ['Tranquil River', 'Tranquil-River/Tranquil-River.html'], ['Net Zero School', 'Net-Zero-School/Net-Zero-School.html'],
    ['North Beach Youth Center', 'interactive/north-beach-youth-center/index.html'], ['Venice Apartments', 'interactive/venice-apartments/index.html'], ['Allure Waterways', 'interactive/allure-waterways/index.html'],
    ['Museum of Emotions', 'interactive/museum-of-emotions/index.html'], ['East Tennessee Cantilever Barn', 'interactive/east-tennessee-cantilever-barn/index.html'], ['Wheels on Water', 'interactive/wheels-on-water/index.html'],
    ['Bench Boat', 'interactive/bench-boat/index.html'], ['Bench D9', 'interactive/bench-d9/index.html'], ['A Moment in Monument', 'interactive/winter-station-2027/index.html']];
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function href(p) { return ROOT + p; }
  function isHere(p) { var dir = new URL(href(p), location.href).pathname.replace(/[^\/]*$/, ''); return here.indexOf(dir) === 0; }
  var mark = document.createElement('a'); mark.className = 'sr-mark'; mark.href = href('index.html#home'); mark.setAttribute('aria-label', 'ArchiWatts home'); if (logo) mark.appendChild(logo);
  var nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Site');
  function projList(cls) { return '<ul class="' + cls + '" aria-label="3D projects">' + PROJECTS.map(function (p) { return '<li><a href="' + href(p[1]) + '"' + (isHere(p[1]) ? ' aria-current="page"' : '') + '>' + esc(p[0]) + '</a></li>'; }).join('') + '</ul>'; }
  nav.innerHTML = '<ul class="sr-links">' +
    '<li><a href="' + href('index.html#arch') + '" aria-current="page">Architecture</a><ul class="sr-sub" aria-label="Architecture categories">' +
    CATS.map(function (c) {
      return '<li><a href="' + href('index.html#arch/' + c[0]) + '"' + (c[0] === 'interactive' ? ' aria-current="true"' : '') + '>' + c[1] + '</a>' + (c[0] === 'interactive' ? projList('sr-proj') : '') + '</li>';
    }).join('') + '</ul></li>' +
    '<li><a href="' + href('graphic-design/index.html') + '">Graphic Design</a></li>' +
    '<li><a href="https://archiwatts-art.me/">Art ↗</a></li>' +
    '<li><a href="' + href('index.html#about') + '">About &amp; Contact</a></li></ul>';
  rail.textContent = ''; rail.appendChild(mark); rail.appendChild(nav);

  // phones: the top bar (mobile-nav-c.js) gets the home page's phone header: logo tile, project name, a "Menu" pill whose list is
  // the site navigation (Architecture with the 3D projects, Graphic Design, Art, About & Contact)
  (function phone() {
    var chrome = document.getElementById('mobile-model-chrome'); if (!chrome) return;
    var logoLink = chrome.querySelector('.mm-logo'), btn = chrome.querySelector('.mm-project'), list = chrome.querySelector('.mm-projects');
    if (logoLink) logoLink.classList.add('sr-phone-mark');
    if (btn) { var arrow = btn.querySelector('span[aria-hidden]'); if (arrow) { arrow.className = 'sr-menu-pill'; arrow.textContent = 'Menu'; } btn.setAttribute('aria-label', 'Site menu'); }
    if (list) {
      list.setAttribute('aria-label', 'Site');
      var build = function () {
        list.innerHTML = '<ul class="sr-links">' +
          '<li><a href="' + href('index.html#arch') + '" aria-current="page">Architecture</a>' + projList('sr-proj') + '</li>' +
          '<li><a href="' + href('graphic-design/index.html') + '">Graphic Design</a></li>' +
          '<li><a href="https://archiwatts-art.me/">Art ↗</a></li>' +
          '<li><a href="' + href('index.html#about') + '">About &amp; Contact</a></li></ul>';
      };
      build();
      // some pages fill this list again a moment later (project-navigation.js): put the shared one back
      if (window.MutationObserver) new MutationObserver(function () { if (!list.querySelector('.sr-links')) build(); }).observe(list, { childList: true });
    }

  })();
})();
