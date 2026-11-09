/* Project pages: every collapsible section starts open, and clicking any image opens it large (the dialog is found once the page
   has loaded, since pages place it after this script). */
(function () {
  function init() {
    document.querySelectorAll('details.addition-section').forEach(function (d) { d.open = true; });
    var dialog = document.getElementById('media-dialog'); if (!dialog) return;
    var image = dialog.querySelector('img');
    document.querySelectorAll('.image-open').forEach(function (b) {
      b.addEventListener('click', function () { var s = b.querySelector('img'); image.src = s.currentSrc || s.src; image.alt = s.alt; dialog.showModal(); });
    });
    var close = dialog.querySelector('button'); if (close) close.onclick = function () { dialog.close(); };
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
