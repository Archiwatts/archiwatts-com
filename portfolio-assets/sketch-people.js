/* Sketch people shared by the project viewers: the Hive's entourage figures in the loose marker style of architects' sketch sheets
   (open oval heads, trapezoid and cape bodies, tapering legs, quick hatching, black on white), six archetypes x six poses
   (4 walking, standing, seated), plus swimmers in the same pen.
   window.SketchPeople.atlas() -> canvas; .walkCell(type, frame) / .swimCell(k) -> [u0, v0, u1, v1] in that canvas. */
(function () {
  var INK = '#302d29', CW = 128, CH = 256, ACOLS = 16, ROWS = 3;
  var PEOPLE = [{ shape: 0, s: 1 }, { shape: 1, s: 1 }, { shape: 2, s: 1 }, { shape: 3, s: 1 }, { shape: 0, s: 1 }, { shape: 4, s: 1 }];
  function srand(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function wob(r, a) { return (r() - .5) * a; }
  /* One loose pen stroke through the points: smoothed, drifting, drawn twice with different pressure. */
  function pen(c, pts, w, r, drift) {
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; drift = drift || 1;
    for (var pass = 0; pass < 2; pass++) {
      var P = pts.map(function (p) { return [p[0] + wob(r, (pass ? 4.2 : 2) * drift), p[1] + wob(r, (pass ? 4.2 : 2) * drift)]; });
      c.lineWidth = w * (pass ? .5 : 1); c.beginPath(); c.moveTo(P[0][0], P[0][1]);
      if (P.length === 2) c.lineTo(P[1][0], P[1][1]);
      else { for (var i = 1; i < P.length - 1; i++) c.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); c.lineTo(P[P.length - 1][0], P[P.length - 1][1]); }
      c.stroke();
    }
  }
  function scribble(c, x0, x1, y0, y1, n, w, r) {
    c.strokeStyle = INK; c.lineCap = 'round'; c.lineWidth = w;
    for (var i = 0; i < n; i++) { var x = x0 + (x1 - x0) * (i + r() * .6) / n, y = y0 + (y1 - y0) * (.1 + r() * .8), len = (y1 - y0) * (.15 + r() * .3); c.beginPath(); c.moveTo(x + len * .4, y - len * .5); c.quadraticCurveTo(x + len * .1, y, x - len * .3, y + len * .5); c.stroke(); }
  }
  function drawPerson(c, cell, T, pose, phase, seed) {
    var typeId = Math.floor((seed - 100) / 17), rs = srand(900 + typeId * 31), rj = srand(seed * 13 + pose * 101), ox = (cell % ACOLS) * CW, oy = Math.floor(cell / ACOLS) * CH, k = T.s, cx = ox + 64, fy = oy + CH - 14;
    function L(v) { return v * k; }
    var sit = pose === 5, walk = pose < 4, sw = walk ? Math.sin(phase * Math.PI * 2) : 0, lw = Math.max(2.6, L(3.8)), shape = T.shape;
    var hip = sit ? fy - L(48) : fy - L(104), sh = hip - L(74), lean = shape === 4 ? L(7) : 0;
    c.strokeStyle = 'rgba(48,45,41,.26)'; c.lineWidth = L(8); c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - L(10), fy + 5); c.quadraticCurveTo(cx + L(24), fy + 2, cx + L(58), fy + 9); c.stroke();
    pen(c, [[cx - L(32), fy + 1], [cx - L(8), fy + 3], [cx + L(34), fy]], 1.8, rj, .8);
    var hem = hip + (shape === 1 ? L(46) : shape === 3 ? L(36) : L(12));
    if (sit) {
      var kx = cx + L(40);
      pen(c, [[cx - L(6), hip], [cx + L(20), hip - L(1)], [kx, hip + L(3)], [kx + L(2), fy - L(2)]], lw, rj);
      pen(c, [[cx + L(4), hip + L(5)], [cx + L(26), hip + L(6)], [kx + L(12), hip + L(8)], [kx + L(14), fy - L(2)]], lw * .8, rj);
      pen(c, [[kx - L(2), fy - L(1)], [kx + L(18), fy - L(2)]], lw, rj);
      pen(c, [[cx - L(24), hip + L(5)], [cx + L(20), hip + L(4)]], lw * .6, rj); pen(c, [[cx - L(24), hip + L(5)], [cx - L(24), fy - L(2)]], lw * .6, rj); pen(c, [[cx - L(26), hip - L(44)], [cx - L(24), hip + L(5)]], lw * .6, rj);
    } else {
      var y0 = hem - L(6), spread = L(26) * sw;
      [-1, 1].forEach(function (d) {
        var fx = cx + d * spread + d * L(3), lift = d * sw > 0 ? L(8) * Math.abs(sw) : 0, top = cx + d * L(6), kneeX = (top + fx) / 2 + d * L(3), kneeY = (y0 + fy) / 2;
        if (shape === 1 || shape === 3) { pen(c, [[top - L(5), y0], [kneeX - L(3), kneeY], [fx, fy - lift]], lw * .8, rj); pen(c, [[top + L(5), y0], [kneeX + L(3), kneeY], [fx, fy - lift]], lw * .8, rj); if (d > 0) scribble(c, Math.min(top, fx) - L(2), Math.max(top, fx) + L(2), kneeY, fy - L(4), 3, Math.max(2, L(3)), rj); }
        else { pen(c, [[top - L(6), y0], [kneeX - L(5), kneeY], [fx - L(2), fy - lift]], lw, rj); pen(c, [[top + L(6), y0], [kneeX + L(5), kneeY], [fx + L(2), fy - lift]], lw * .7, rj); }
        pen(c, [[fx - L(8), fy - lift], [fx + L(8), fy - lift - 1]], lw * .9, rj);
      });
    }
    var w1, w2;
    if (shape === 0 || shape === 4) { w1 = 24; w2 = 20; } else if (shape === 1) { w1 = 11; w2 = 36; } else if (shape === 2) { w1 = 22; w2 = 23; } else { w1 = 12; w2 = 46; }
    var bowL = wob(rs, L(40)), bowR = wob(rs, L(40)), skew = wob(rs, L(22)) + lean, dropL = wob(rs, L(14)), dropR = wob(rs, L(14)), hemL = wob(rs, L(16)), hemR = wob(rs, L(16)), skipTop = rs() < .45;
    function edge(side, bow, drop, hemD) {
      var x1 = L(w1), x2 = L(w2), y1 = sh + (hem - sh) * .33, y2 = sh + (hem - sh) * .68, xm1 = x1 + (x2 - x1) * .33, xm2 = x1 + (x2 - x1) * .68;
      return [[cx + side * x1 + skew, sh + drop], [cx + side * xm1 + skew * .7 + side * bow, y1], [cx + side * xm2 + skew * .3 - side * bow * .7, y2], [cx + side * x2 + hemD * .5, hem + hemD]];
    }
    var Ls = edge(-1, bowL, dropL, hemL), Rs = edge(1, bowR, dropR, hemR);
    (function () {
      function curve(P, first) { if (first) c.moveTo(P[0][0], P[0][1]); else c.lineTo(P[0][0], P[0][1]); for (var i = 1; i < P.length - 1; i++) c.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); c.lineTo(P[P.length - 1][0], P[P.length - 1][1]); }
      c.beginPath(); curve(Ls, true); c.quadraticCurveTo(cx, hem + wob(rs, L(18)), Rs[3][0], Rs[3][1]); curve(Rs.slice().reverse(), false); c.closePath(); c.fillStyle = 'rgba(251,249,243,.9)'; c.fill();
    })();
    pen(c, Ls, lw * 1.05, rj, 1.6); pen(c, Rs, lw * 1.05, rj, 1.6); if (!skipTop) pen(c, [[Ls[0][0] - L(3), Ls[0][1]], [cx + skew * .6, sh - L(4) + (dropL + dropR) * .3], [Rs[0][0] + L(3), Rs[0][1]]], lw * 1.05, rj, 1.4);
    pen(c, [[Ls[3][0] - L(4), Ls[3][1]], [cx - L(w2) * .5, hem + wob(rs, L(14))], [cx + L(w2) * .1, hem + wob(rs, L(14))], [cx + L(w2) * .6, hem + wob(rs, L(14))], [Rs[3][0] + L(4), Rs[3][1]]], lw * .9, rj, 1.5);
    scribble(c, cx + (shape === 2 ? -L(w1) * .7 : L(2)), cx + L(w2) * (shape === 3 ? 1 : .8), sh + L(6), hem - L(6), shape === 2 ? 7 : 5, Math.max(1.6, L(2.3)), rj);
    if (shape === 2) pen(c, [[cx - L(21), hip - L(4)], [cx, hip - L(2)], [cx + L(21), hip - L(5)]], lw * .7, rj);
    if (shape === 3) { pen(c, [[cx - L(8), sh + L(14)], [cx - L(16), hem - L(8)]], lw * .6, rj); pen(c, [[cx + L(10), sh + L(16)], [cx + L(22), hem - L(6)]], lw * .6, rj); }
    if (shape !== 3 && !sit) { var a = walk ? -sw * .6 : .06; pen(c, [[cx + L(w1) + lean, sh + L(5)], [cx + L(w1 + 4) + Math.sin(a) * L(26), sh + L(38)], [cx + L(w1 + 2) + Math.sin(a) * L(52), sh + L(8) + Math.cos(a) * L(56)]], lw * .8, rj); }
    if (sit) pen(c, [[cx + L(w1) + lean, sh + L(6)], [cx + L(28), hip - L(22)], [cx + L(36), hip - L(2)]], lw * .8, rj);
    if (shape === 4) pen(c, [[cx + L(40), hip - L(14)], [cx + L(46), fy - L(2)]], lw * .8, rj);
    var hx = cx + lean * 1.4, hy = sh - L(22), tilt = wob(rs, .9);
    pen(c, [[hx - L(1), sh - L(1)], [hx, sh - L(8)]], lw * .8, rj, .6);
    var pts = []; for (var i = 0; i <= 9; i++) { var ang = tilt + .6 + i / 9 * (Math.PI * 2 - .5); pts.push([hx + Math.cos(ang) * L(10.5), hy + Math.sin(ang) * L(15)]); }
    c.beginPath(); c.ellipse(hx, hy, L(10.5), L(15), tilt, 0, Math.PI * 2); c.fillStyle = 'rgba(251,249,243,.95)'; c.fill();
    pen(c, pts, lw * .9, rj, .7);
    if (shape === 1 || shape === 3) pen(c, [[hx - L(11), hy + L(2)], [hx - L(8), hy - L(14)], [hx + L(8), hy - L(15)], [hx + L(10), hy - L(2)]], lw * .8, rj, .8);
  }
  /* Swimmers, in the same pen: a head and shoulders breaking the water, one arm reaching forward, rings of ripples.
     The water line sits at 3/4 of the cell height; frames 0-1 alternate the stroke. */
  function drawSwimmer(c, cell, k) {
    // drawn large in the cell (head, shoulders, one arm out of the water, a ring of ripples) so a swimmer reads at site scale
    var r = srand(4400 + k * 37), ox = (cell % ACOLS) * CW, oy = Math.floor(cell / ACOLS) * CH, cx = ox + 64, wl = oy + CH * .75;
    c.strokeStyle = 'rgba(236,250,246,.95)'; c.lineWidth = 6; c.beginPath(); c.ellipse(cx, wl + 8, 58, 16, 0, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.ellipse(cx, wl + 9, 40, 10, 0, 0, Math.PI * 2); c.stroke();
    pen(c, [[cx - 60, wl + 4], [cx - 22, wl - 2], [cx + 20, wl + 2], [cx + 60, wl - 1]], 3, r, 1);
    pen(c, [[cx - 44, wl + 20], [cx - 8, wl + 17], [cx + 34, wl + 21]], 2, r, .8);
    // shoulders and head
    c.beginPath(); c.ellipse(cx - 4, wl - 12, 30, 14, 0, Math.PI, 0); c.fillStyle = 'rgba(251,249,243,.95)'; c.fill();
    pen(c, [[cx - 34, wl - 2], [cx - 22, wl - 18], [cx + 12, wl - 20], [cx + 26, wl - 3]], 4.2, r, 1.2);
    c.beginPath(); c.ellipse(cx - 4, wl - 44, 19, 22, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(251,249,243,.97)'; c.fill();
    pen(c, (function () { var p = []; for (var i = 0; i <= 10; i++) { var a = .6 + i / 10 * (Math.PI * 2 - .5); p.push([cx - 4 + Math.cos(a) * 19, wl - 44 + Math.sin(a) * 22]); } return p; })(), 4, r, .7);
    pen(c, [[cx - 22, wl - 52], [cx - 16, wl - 66], [cx + 8, wl - 67], [cx + 16, wl - 54]], 3.4, r, .8);   // hair
    // one arm reaching out of the water, alternating side by frame
    if (k % 2) pen(c, [[cx + 20, wl - 12], [cx + 40, wl - 52], [cx + 58, wl - 46]], 4, r, 1);
    else pen(c, [[cx - 28, wl - 12], [cx - 46, wl - 50], [cx - 60, wl - 40]], 4, r, 1);
  }
  var cache = null;
  function atlas() {
    if (cache) return cache;
    var cv = document.createElement('canvas'); cv.width = CW * ACOLS; cv.height = CH * ROWS; var c = cv.getContext('2d');
    for (var t = 0; t < PEOPLE.length; t++) for (var f = 0; f < 6; f++) drawPerson(c, t * 6 + f, PEOPLE[t], f, f < 4 ? f / 4 : 0, 100 + t * 17 + f);
    for (var s = 0; s < 2; s++) drawSwimmer(c, 36 + s, s);
    return (cache = cv);
  }
  function cellUV(i) { var col = i % ACOLS, row = Math.floor(i / ACOLS); return [col / ACOLS, 1 - (row + 1) / ROWS, (col + 1) / ACOLS, 1 - row / ROWS]; }
  window.SketchPeople = {
    atlas: atlas, types: PEOPLE.length,
    walkCell: function (type, frame) { return cellUV(type * 6 + frame); },   // frames 0-3 walking, 4 standing, 5 seated
    swimCell: function (k) { return cellUV(36 + (k % 2)); },
    aspect: CW / CH, swimLine: .25                                          // a swimmer cell's water line, measured up from its bottom
  };
})();
