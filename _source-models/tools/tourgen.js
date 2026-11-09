/* Tour generator (a tool, run in the browser on a project page; not loaded by the site).
   Input: the page's model (already loaded) and its Revit read (revit_info.py -> <project>/revit-info.json).
   1. Fits Revit's coordinates onto the web model: Revit feet -> metres, Revit Z up -> page Y up, then the best of the 8 quarter-turn /
      mirror options and a translation, found by where the Revit wall lines land on the model's walls (plus the floor height from the
      lowest level).
   2. Rooms -> walk stops: named rooms (no closets / shafts / tiny rooms), one per room, ordered floor by floor along a short route.
   3. A fly-through through the same rooms, and the Revit section / elevation views mapped for the panel.
   Returns { fit, walk, fly, sections, elevations } -- pasted into the page as PROJECT_WALK / PROJECT_CONTROLS. */
window.tourgen = async function (infoUrl, opts) {
  opts = opts || {};
  var info = await fetch(infoUrl).then(function (r) { return r.json(); }), ctx = window.daylightContext, scene = ctx.scene, F = .3048;
  // model walls on a 0.5 m grid (vertical faces), and floor heights
  var box = window.projectWalk.box, CS = .5, pad = 40, X0 = box[0] - pad, Z0 = box[2] - pad, NX = Math.ceil((box[3] - box[0] + 2 * pad) / CS), NZ = Math.ceil((box[5] - box[2] + 2 * pad) / CS);
  var wall = new Uint8Array(NX * NZ), floorsY = [];
  scene.traverse(function (o) {
    if (!o.isMesh || !o.visible || o.userData.skEdge || /context|life|ink|sprite/i.test(o.name || '')) return; o.updateMatrixWorld();
    var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, m = o.matrixWorld.elements, n = ix ? ix.length : p.count, V = function (i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; };
    for (var t = 0; t + 2 < n; t += 3 * (n > 3e6 ? 3 : 1)) {
      var a = V(ix ? ix[t] : t), b = V(ix ? ix[t + 1] : t + 1), c = V(ix ? ix[t + 2] : t + 2);
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], ny = uz * vx - ux * vz, l = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx); if (l < 1e-8) continue;
      if (Math.abs(ny) / l > .9) { if (Math.random() < .02) floorsY.push((a[1] + b[1] + c[1]) / 3); continue; }
      if (Math.abs(ny) / l > .3) continue;
      for (var k = 0; k <= 4; k++) { var x = a[0] + (b[0] - a[0]) * k / 4, z = a[2] + (b[2] - a[2]) * k / 4, gx = Math.floor((x - X0) / CS), gz = Math.floor((z - Z0) / CS); if (gx >= 0 && gz >= 0 && gx < NX && gz < NZ) wall[gz * NX + gx] = 1; }
    }
  });
  // dilate one cell so a wall line in the middle of a thick wall still hits
  var w2 = wall.slice(); for (var gz = 1; gz < NZ - 1; gz++) for (var gx = 1; gx < NX - 1; gx++) if (wall[gz * NX + gx]) { w2[gz * NX + gx - 1] = w2[gz * NX + gx + 1] = w2[(gz - 1) * NX + gx] = w2[(gz + 1) * NX + gx] = 1; }
  var W = info.walls.filter(function (_, i) { return i % Math.max(1, Math.floor(info.walls.length / 4000)) === 0; }).map(function (p) { return [p[0] * F, p[1] * F]; });
  if (!W.length) return { error: 'no walls in the Revit read' };
  var mx = 0, my = 0; W.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= W.length; my /= W.length;
  var cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
  function xf(o, p) { var x = p[0] - mx, y = p[1] - my; var a = o.mir ? -x : x; var r = [[a, -y], [y, a], [-a, y], [-y, -a]][o.rot]; return [r[0] + o.tx, r[1] + o.tz]; }
  function score(o) { var h = 0; for (var i = 0; i < W.length; i++) { var q = xf(o, W[i]), gx = Math.floor((q[0] - X0) / CS), gz = Math.floor((q[1] - Z0) / CS); if (gx >= 0 && gz >= 0 && gx < NX && gz < NZ && w2[gz * NX + gx]) h++; } return h / W.length; }
  var best = null;
  for (var mir = 0; mir < 2; mir++) for (var rot = 0; rot < 4; rot++) {
    var o = { mir: mir, rot: rot, tx: cx, tz: cz }, bs = score(o), step = 4;
    for (var dx = -40; dx <= 40; dx += 4) for (var dz = -40; dz <= 40; dz += 4) { var o2 = { mir: mir, rot: rot, tx: cx + dx, tz: cz + dz }, s2 = score(o2); if (s2 > bs) { bs = s2; o = o2; } }
    while (step > .1) { var imp = true; while (imp) { imp = false; [[step, 0], [-step, 0], [0, step], [0, -step]].forEach(function (d) { var o3 = { mir: o.mir, rot: o.rot, tx: o.tx + d[0], tz: o.tz + d[1] }, s3 = score(o3); if (s3 > bs) { bs = s3; o = o3; imp = true; } }); } step /= 2; }
    if (!best || bs > best.score) { best = o; best.score = bs; }
  }
  // floor: the lowest Revit level's height lands on the model's lowest big floor
  floorsY.sort(function (a, b) { return a - b; }); var lowFloor = floorsY.length ? floorsY[Math.floor(floorsY.length * .08)] : box[1];
  var lv = info.levels.slice().sort(function (a, b) { return a.elev - b.elev; }), z0 = lv.length ? lv[0].elev * F : 0; best.ty = lowFloor - z0;
  var P = function (p) { var q = xf(best, [p[0] * F, p[1] * F]); return [q[0], p[2] * F + best.ty, q[1]]; };
  var D = function (d) { var q = xf({ mir: best.mir, rot: best.rot, tx: 0, tz: 0 }, [d[0] + mx, d[1] + my]); return [q[0], d[2], q[1]]; };
  // rooms -> stops
  var skip = /^(room|space|area|circ\.?|circulation|corridor|hall|hallway|lobby \d+|open)$|^room \d+$|closet|clo\.?$|storage|stor\.?$|shaft|elev|mech|electric|janitor|jan\.?$|chase|riser|stair|vestib|toilet|wc$|restroom|bath|ups|data|idf|mdf|trash/i;
  var rooms = info.rooms.filter(function (r) { return r.name && r.area > (opts.minArea || 120) && !skip.test(r.name); });
  var seen = {}; rooms = rooms.filter(function (r) { var k = r.name.toLowerCase() + '|' + r.level; if (seen[k]) return false; seen[k] = 1; return true; });
  rooms.sort(function (a, b) { return a.elev - b.elev; });
  var byLevel = {}; rooms.forEach(function (r) { (byLevel[r.level] || (byLevel[r.level] = [])).push(r); });
  var order = [], cur = null;
  Object.keys(byLevel).sort(function (a, b) { return byLevel[a][0].elev - byLevel[b][0].elev; }).forEach(function (k) {
    var L = byLevel[k].slice(); if (L.length > (opts.perLevel || 4)) L = L.sort(function (a, b) { return b.area - a.area; }).slice(0, opts.perLevel || 4);
    while (L.length) { var bi = 0, bd = 1e18; L.forEach(function (r, i) { var d = cur ? Math.hypot(r.p[0] - cur.p[0], r.p[1] - cur.p[1]) : 0; if (d < bd) { bd = d; bi = i; } }); cur = L.splice(bi, 1)[0]; order.push(cur); }
  });
  var E = 1.6, walk = [], fly = [], t = 0, c3 = [cx, box[1] + (box[4] - box[1]) * .4, cz];
  // arrival from outside, facing the building
  var long = box[3] - box[0] > box[5] - box[2], ap = long ? [cx, lowFloor + E, box[2] - 8] : [box[0] - 8, lowFloor + E, cz];
  walk.push([ap, [cx, lowFloor + 3, cz], 'Arrival']); fly.push([0, [ap[0], ap[1] + 2, ap[2] - 6], c3, 'Arrival']); t = 10;
  order.slice(0, opts.max || 12).forEach(function (r, i) {
    var p = P([r.p[0], r.p[1], r.elev]), nx = order[i + 1], look = nx ? P([nx.p[0], nx.p[1], nx.elev]) : c3;
    var eye = [p[0], p[1] + E, p[2]], lk = [look[0], p[1] + E, look[2]]; if (Math.hypot(lk[0] - eye[0], lk[2] - eye[2]) < 1) lk = [c3[0], p[1] + E, c3[2]];
    var name = r.name.replace(/\s+/g, ' ').trim(); name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    walk.push([eye.map(function (v) { return +v.toFixed(2); }), lk.map(function (v) { return +v.toFixed(2); }), name]);
    fly.push([t, [eye[0], eye[1] + 1.2, eye[2]].map(function (v) { return +v.toFixed(2); }), lk.map(function (v) { return +v.toFixed(2); }), name]); t += 9;
  });
  var R = Math.max(box[3] - box[0], box[5] - box[2]);
  fly.push([t + 4, [cx + R * .25, box[4] + Math.min(R * .45, 120), cz + R * .5].map(function (v) { return +v.toFixed(1); }), [cx, box[1], cz].map(function (v) { return +v.toFixed(1); }), 'The whole project']);
  // Revit sections and elevations
  var sections = [], elevations = {};
  info.views.forEach(function (v) {
    var o = P(v.origin), d = D(v.dir), r = D(v.right), cxv = (v.min[0] + v.max[0]) / 2 * F, cyv = (v.min[1] + v.max[1]) / 2 * F, w = (v.max[0] - v.min[0]) * F, h = (v.max[1] - v.min[1]) * F;
    var ctr = [o[0] + r[0] * cxv, o[1] + cyv, o[2] + r[2] * cxv], dir = [d[0], 0, d[2]], dl = Math.hypot(dir[0], dir[2]) || 1; dir = [dir[0] / dl, 0, dir[2] / dl];
    var n = [-dir[0], 0, -dir[2]], c = dir[0] * o[0] + dir[2] * o[2];
    if (v.type === 'Section' && v.sheet && v.sheet !== '---' && !/callout/i.test(v.name)) { var dist = Math.max(w, h) * .9 + 10; sections.push([v.name, 'Revit section' + (v.sheet ? ', sheet ' + v.sheet : ''), n, +c.toFixed(2), [ctr[0] + dir[0] * dist, ctr[1] + 4, ctr[2] + dir[2] * dist].map(function (q) { return +q.toFixed(1); }), ctr.map(function (q) { return +q.toFixed(1); })]); }
    if (v.type === 'Elevation') { var nm = v.name.toLowerCase(), k = /^north/.test(nm) ? 'n' : /^south/.test(nm) ? 's' : /^east/.test(nm) ? 'e' : /^west/.test(nm) ? 'w' : null;
      if (k && !elevations[k]) elevations[k] = { n: n, c: +c.toFixed(2), dir: dir, ctr: ctr.map(function (q) { return +q.toFixed(1); }), w: +w.toFixed(1), h: +h.toFixed(1), label: v.name + ' elevation', sub: 'Revit elevation' + (v.sheet && v.sheet !== '---' ? ', sheet ' + v.sheet : '') }; }
  });
  // no rooms: let the walk place its own stops on each floor, named from the Revit levels
  var levelsOut = lv.map(function (l) { return [+(l.elev * F + best.ty).toFixed(2), l.name]; });
  if (!order.length) { walk = null; }
  return { levels: levelsOut, fit: { mir: best.mir, rot: best.rot, tx: +best.tx.toFixed(2), tz: +best.tz.toFixed(2), ty: +best.ty.toFixed(2), score: +best.score.toFixed(3), walls: W.length }, rooms: order.length, walk: walk, fly: fly, sections: sections.slice(0, 8), elevations: elevations };
};
