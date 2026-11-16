// Hidden Gems City: the city built from the Option B plan (game/citydata/city.json, made by the plan generator).
// Buildings: near-rectangular town houses get walls on their fitted rectangle, a hip or gable roof with eaves and a white
// fascia board (and rake boards on the gables); everything else is extruded from its drawn outline with a white coping.
// Also: bridge decks with parapets, the school fence with its gate, palms, and lamp posts along the boulevards.
export function buildPlanCity({THREE, CITY, base, road, wallMat, trimMat, stoneMat, ironMat}){
  const deckTop = road !== undefined ? road : base;
  const V = [], T = [];                       // wall + roof triangles (city material), trim triangles (white)
  const P = (x, y, z) => [x, y, z];
  const tri = (A, a, b, c) => A.push(...a, ...b, ...c);
  const quad = (A, a, b, c, d) => { tri(A, a, b, c); tri(A, a, c, d); };
  const out = {};

  // ---------- pitched houses ----------
  function pitched(b){
    const c = b.obb, y0 = base, y1 = base + b.h;
    const e1 = [c[1][0] - c[0][0], c[1][1] - c[0][1]], e2 = [c[2][0] - c[1][0], c[2][1] - c[1][1]];
    const l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
    const C = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2];
    const [lu, lv, U, Vv] = l1 >= l2 ? [l1, l2, e1, e2] : [l2, l1, e2, e1];
    const u = [U[0] / lu, U[1] / lu], v = [Vv[0] / lv, Vv[1] / lv], a = lu / 2, bb = lv / 2;
    const at = (s, t, y) => P(C[0] + u[0]*s + v[0]*t, y, C[1] + u[1]*s + v[1]*t);
    // walls
    const w = [at(-a, -bb, 0), at(a, -bb, 0), at(a, bb, 0), at(-a, bb, 0)];
    for (let i = 0; i < 4; i++){ const p = w[i], q = w[(i + 1) % 4]; quad(V, [p[0], y0, p[2]], [q[0], y0, q[2]], [q[0], y1, q[2]], [p[0], y1, p[2]]); }
    // roof: 45 cm eaves, about 29 degrees
    const o = .45, A2 = a + o, B2 = bb + o, rh = B2 * .55, yr = y1 + rh;
    if (b.roof === 'gable'){
      quad(V, at(-A2, -B2, y1), at(A2, -B2, y1), at(A2, 0, yr), at(-A2, 0, yr));
      quad(V, at(A2, B2, y1), at(-A2, B2, y1), at(-A2, 0, yr), at(A2, 0, yr));
      const gh = rh * bb / B2;                                        // the gable walls rise to meet the roof
      [-a, a].forEach(s => tri(V, at(s, -bb, y1), at(s, bb, y1), at(s, 0, y1 + gh)));
      // fascia along both eaves, rake boards up both gables
      [-1, 1].forEach(sd => board(at(-A2, sd*B2, y1), at(A2, sd*B2, y1), [v[0]*sd, v[1]*sd]));
      [-1, 1].forEach(se => [-1, 1].forEach(sd => board(at(se*A2, sd*B2, y1), at(se*A2, 0, yr), [u[0]*se, u[1]*se])));
    } else {
      const r = Math.max(A2 - B2, 0);
      quad(V, at(-A2, -B2, y1), at(A2, -B2, y1), at(r, 0, yr), at(-r, 0, yr));
      quad(V, at(A2, B2, y1), at(-A2, B2, y1), at(-r, 0, yr), at(r, 0, yr));
      tri(V, at(A2, -B2, y1), at(A2, B2, y1), at(r, 0, yr));
      tri(V, at(-A2, B2, y1), at(-A2, -B2, y1), at(-r, 0, yr));
      [-1, 1].forEach(sd => board(at(-A2, sd*B2, y1), at(A2, sd*B2, y1), [v[0]*sd, v[1]*sd]));
      [-1, 1].forEach(se => board(at(se*A2, -B2, y1), at(se*A2, B2, y1), [u[0]*se, u[1]*se]));
    }
  }
  // a white board 30 cm deep hanging from an edge (eave or rake), on the outside face
  function board(p, q, n){
    const d = .06, hgt = .32, ox = n[0]*d, oz = n[1]*d;
    const a = [p[0] + ox, p[1], p[2] + oz], b = [q[0] + ox, q[1], q[2] + oz];
    quad(T, [a[0], a[1] - hgt, a[2]], [b[0], b[1] - hgt, b[2]], b, a);
    quad(T, [p[0], p[1] - hgt, p[2]], [q[0], q[1] - hgt, q[2]], [b[0], b[1] - hgt, b[2]], [a[0], a[1] - hgt, a[2]]);   // underside
  }

  // ---------- flat roofs: extruded outline + coping ----------
  const flatGeos = [], copeGeos = [];
  function flat(b){
    const shape = new THREE.Shape(b.pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    (b.holes || []).forEach(h => shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
    const g = new THREE.ExtrudeGeometry(shape, {depth:b.h, bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0, base, 0);
    g.deleteAttribute('uv'); flatGeos.push(g.index ? g.toNonIndexed() : g);
    const cg = new THREE.ExtrudeGeometry(shape, {depth:.5, bevelEnabled:false}); cg.rotateX(-Math.PI/2);
    cg.computeBoundingBox(); const bx = cg.boundingBox, cx = (bx.min.x + bx.max.x)/2, cz = (bx.min.z + bx.max.z)/2, sz = Math.max(4, Math.min(bx.max.x - bx.min.x, bx.max.z - bx.min.z));
    const s = 1 + .5 / sz; cg.translate(-cx, 0, -cz); cg.scale(s, 1, s); cg.translate(cx, base + b.h - .1, cz);
    cg.deleteAttribute('uv'); copeGeos.push(cg.index ? cg.toNonIndexed() : cg);
  }
  for (const b of CITY.buildings){ if (b.roof === 'flat' || !b.obb) flat(b); else pitched(b); }

  const mk = (arr, extra, mat) => {
    const parts = []; if (arr.length){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); parts.push(g); }
    parts.push(...extra.map(g => { const n = new THREE.BufferGeometry(); n.setAttribute('position', g.attributes.position); return n; }));
    if (!parts.length) return null;
    let total = 0; parts.forEach(g => total += g.attributes.position.count);
    const pos = new Float32Array(total*3); let o = 0; parts.forEach(g => { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
  };
  out.buildings = mk(V, flatGeos, wallMat);
  out.trim = mk(T, copeGeos, trimMat);

  // ---------- bridges: deck + parapets ----------
  const deck = [], rails = [];
  for (const poly of CITY.bridges){
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, {depth:1.4, bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0, deckTop - 1.4, 0); g.deleteAttribute('uv'); deck.push(g.toNonIndexed());
    for (let i = 0; i < poly.length; i++){                            // parapets on the long sides only (the short ends meet the street)
      const p = poly[i], q = poly[(i + 1) % poly.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 11) continue;
      const bx = new THREE.BoxGeometry(L, 1.1, .3); bx.rotateY(-Math.atan2(q[1] - p[1], q[0] - p[0])); bx.translate((p[0] + q[0])/2, deckTop + .55, (p[1] + q[1])/2); bx.deleteAttribute('uv'); rails.push(bx.toNonIndexed());
    }
  }
  out.bridges = mk([], deck.concat(rails), stoneMat);

  // ---------- the school fence: steel posts every 2.5 m, 2 m picket panels, stone gate pillars and two open gate leaves ----------
  // it follows the purple line drawn on the plan (CITY.fence); the 9 m gate opening faces the roundabout by the K-12 garage
  const fz = [], gz = [], F = CITY.fence, Y0 = 1.0, FH = 2.05;   // posts start a little below any ground
  const OPEN = CITY.openings || [{c:CITY.gate, w:9.2, main:1}];   // driveways through the fence; main = the school gate by the garage
  const openAt = p => OPEN.find(o => Math.hypot(p[0] - o.c[0], p[1] - o.c[1]) < o.w/2);
  const box = (w, h, d, x, y, z, rot, arr) => { const b = new THREE.BoxGeometry(w, h, d); if (rot) b.rotateY(rot); b.translate(x, y, z); b.deleteAttribute('uv'); arr.push(b.toNonIndexed()); };
  let gateSide = [];
  for (let i = 0; i < F.length; i++){
    const p = F[i], q = F[(i + 1) % F.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 2.5)), ang = -Math.atan2(q[1] - p[1], q[0] - p[0]);
    for (let k = 0; k < n; k++){
      const t0 = k / n, t1 = (k + 1) / n, a = [p[0] + (q[0] - p[0])*t0, p[1] + (q[1] - p[1])*t0], c = [p[0] + (q[0] - p[0])*t1, p[1] + (q[1] - p[1])*t1];
      const oa = openAt(a), oc = openAt(c);
      if (oa && oc) continue;                                                // inside an opening
      if (oa || oc){ const o = oa || oc; gateSide.push({o, at: oa ? c : a, ang, dir: oa ? [c[0]-a[0], c[1]-a[1]] : [a[0]-c[0], a[1]-c[1]]}); continue; }
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]), mid = [(a[0] + c[0])/2, (a[1] + c[1])/2];
      box(.1, FH + .25, .1, a[0], Y0 + (FH + .25)/2, a[1], ang, fz);                                    // post
      [.18, FH - .1].forEach(hh => box(len, .06, .05, mid[0], Y0 + .25 + hh, mid[1], ang, fz));        // bottom and top rails
      const m = Math.max(2, Math.round(len / .13));
      for (let s = 1; s < m; s++){ const f = s / m; box(.025, FH - .25, .025, a[0] + (c[0] - a[0])*f, Y0 + .25 + (FH - .25)/2 + .05, a[1] + (c[1] - a[1])*f, 0, fz); }   // pickets, 13 cm apart
    }
  }
  // the gate: a stone pillar each side of the opening, and a leaf on each, swung open into the school grounds
  gateSide.forEach(({o, at, ang, dir}) => {
    box(.6, FH + .9, .6, at[0], Y0 + (FH + .9)/2, at[1], ang, gz);
    box(.8, .14, .8, at[0], Y0 + FH + .97, at[1], ang, gz);
    if (!o.main) return;                                                     // the other driveways: pillars only
    const dl = Math.hypot(dir[0], dir[1]) || 1, ux = -dir[0]/dl, uz = -dir[1]/dl;                         // into the opening
    const sw = .9, cs = Math.cos(sw), sn = Math.sin(sw), lx = ux*cs - uz*sn, lz = ux*sn + uz*cs, LW = Math.min(4.2, o.w/2 - .4);  // leaf swung about 50 degrees
    const cx = at[0] + lx*(LW/2 + .35), cz = at[1] + lz*(LW/2 + .35), la = -Math.atan2(lz, lx);
    [.2, FH - .15].forEach(hh => box(LW, .08, .06, cx, Y0 + .25 + hh, cz, la, fz));
    for (let s = 0; s <= 20; s++){ const f = s / 20 - .5; box(.035, FH - .2, .035, cx + lx*LW*f, Y0 + .25 + (FH - .2)/2, cz + lz*LW*f, 0, fz); }
  });
  out.fence = mk([], fz, ironMat);
  out.gatePillars = mk([], gz, stoneMat);
  out.gateSides = gateSide.length;

  // ---------- lamp posts along every boulevard, one side then the other, ~30 m apart ----------
  out.lampAt = [];
  let side = 1;
  for (const r of CITY.roads){
    if (r.c !== 'blvd') continue;
    for (let i = 0; i < r.pts.length - 1; i++){
      const p = r.pts[i], q = r.pts[i + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 8) continue;
      const nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L, n = Math.floor(L / 30);
      for (let k = 0; k <= n; k++){ const t = n ? k / n : .5; out.lampAt.push([p[0] + (q[0] - p[0])*t + nx*5.2*side, p[1] + (q[1] - p[1])*t + nz*5.2*side]); side = -side; }
    }
  }
  return out;
}

// =================== the roads: smooth vector streets from the plan centrelines ===================
// 1. join the short road pieces into long chains through every two-way node, smooth them (Chaikin)
// 2. no loose ends: an end that stops within 12 m of another road is joined to it; otherwise it gets a turning circle
// 3. paint a 0.5 m road mask (anti-aliased): the pavement slab is cut there (shader) and is not solid there (game.js)
// 4. kerbs: traced along the mask edge (marching squares), a 15 cm stone kerb from the road up to the pavement
// 5. markings: white edge lines, yellow centre dashes on streets; boulevards get a raised planted median instead
export function buildRoads({THREE, CITY, ROAD, TOP, X0, Z0, W, H, isLand}){
  const WID = {blvd:8.5, street:6}, out = {};
  // ---------- chains ----------
  const K = p => (Math.round(p[0]*2)/2) + ',' + (Math.round(p[1]*2)/2);
  const roads = CITY.roads.filter(r => r.pts.length >= 2), at = new Map();
  roads.forEach((r, i) => [0, 1].forEach(e => { const k = K(e ? r.pts[r.pts.length-1] : r.pts[0]); (at.get(k) || at.set(k, []).get(k)).push([i, e]); }));
  const used = new Uint8Array(roads.length), chains = [];
  for (let i = 0; i < roads.length; i++){
    if (used[i]) continue; used[i] = 1; let pts = roads[i].pts.slice(); const c = roads[i].c;
    for (const dir of [1, 0]){                                       // grow forward from the end, then backward from the start
      for (;;){
        const end = dir ? pts[pts.length-1] : pts[0], here = at.get(K(end)) || [], nb = here.filter(([j]) => !used[j]);
        if (here.length !== 2 || nb.length !== 1 || roads[nb[0][0]].c !== c) break;
        const [j, e] = nb[0]; used[j] = 1; let more = roads[j].pts.slice(); if (e === 1) more.reverse(); more = more.slice(1);   // points running away from the shared node
        pts = dir ? pts.concat(more) : more.reverse().concat(pts);
      }
    }
    chains.push({c, pts});
  }
  const len = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]); return s; };
  const deg = new Map(); chains.forEach(ch => [ch.pts[0], ch.pts[ch.pts.length-1]].forEach(p => deg.set(K(p), (deg.get(K(p)) || 0) + 1)));
  const C = chains.filter(ch => !(len(ch.pts) < 8 && deg.get(K(ch.pts[0])) === 1 && deg.get(K(ch.pts[ch.pts.length-1])) === 1));   // stray crumbs
  const chaikin = (p, it) => { for (let n = 0; n < it; n++){ const q = [p[0]]; for (let i = 0; i < p.length-1; i++){ const a = p[i], b = p[i+1];
      q.push([a[0]*.75 + b[0]*.25, a[1]*.75 + b[1]*.25], [a[0]*.25 + b[0]*.75, a[1]*.25 + b[1]*.75]); } q.push(p[p.length-1]); p = q; } return p; };
  C.forEach(ch => { ch.pts = chaikin(ch.pts, 3); ch.w = WID[ch.c]; });
  // ---------- loose ends ----------
  const nodes = new Map(); C.forEach((ch, ci) => [0, 1].forEach(e => { const p = e ? ch.pts[ch.pts.length-1] : ch.pts[0], k = K(p); (nodes.get(k) || nodes.set(k, {p, list:[]}).get(k)).list.push([ci, e]); }));
  const G = 20, grid = new Map(), gk = (x, z) => Math.floor(x/G) + ',' + Math.floor(z/G);
  C.forEach((ch, ci) => ch.pts.forEach((p, i) => { const k = gk(p[0], p[1]); (grid.get(k) || grid.set(k, []).get(k)).push([ci, i]); }));
  const nearest = (p, skipCi, skipI) => { let best = null, bd = 1e9; const gx = Math.floor(p[0]/G), gz = Math.floor(p[1]/G);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [ci, i] of grid.get((gx+a) + ',' + (gz+b)) || []){
      if (ci === skipCi && Math.abs(i - skipI) < 60) continue; const q = C[ci].pts[i], d = Math.hypot(q[0]-p[0], q[1]-p[1]); if (d < bd){ bd = d; best = [q, ci]; } }
    return best ? {q:best[0], d:bd, ci:best[1]} : null; };
  const discs = [], joins = [];                                     // turning circles; junction patches
  nodes.forEach(n => { if (n.list.length >= 3) joins.push({p:n.p, r:Math.max(...n.list.map(([ci]) => C[ci].w))/2 + .6}); });
  let joined = 0, culs = 0;
  const nC = C.length;
  nodes.forEach(n => {
    if (n.list.length !== 1) return; const [ci, e] = n.list[0]; if (ci >= nC) return; const ch = C[ci], idx = e ? ch.pts.length-1 : 0, nr = nearest(n.p, ci, idx);
    if (nr && nr.d < ch.w/2 + C[nr.ci].w/2 + .5){ joins.push({p:n.p, r:ch.w/2 + .6}); return; }          // already touching another road: a T junction
    if (nr && nr.d < 12){ const link = [n.p, nr.q]; C.push({c:'street', pts:link, w:WID.street, link:1}); joins.push({p:nr.q, r:C[nr.ci].w/2 + .6}); joined++; return; }
    if (isLand(n.p[0], n.p[1])){ discs.push({p:n.p, r:ch.c === 'blvd' ? 9 : 7.5}); culs++; }               // a turning circle rather than a dead stop mid-block
  });
  // ---------- the road mask (0.5 m, anti-aliased) ----------
  const px = .5, mw = Math.ceil(W/px), mh = Math.ceil(H/px), cv = document.createElement('canvas'); cv.width = mw; cv.height = mh;
  const g = cv.getContext('2d', {willReadFrequently:true}); g.fillStyle = '#000'; g.fillRect(0, 0, mw, mh); g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
  const tx = x => (x - X0)/px, tz = z => (z - Z0)/px;
  C.forEach(ch => { g.lineWidth = ch.w/px; g.beginPath(); ch.pts.forEach((p, i) => i ? g.lineTo(tx(p[0]), tz(p[1])) : g.moveTo(tx(p[0]), tz(p[1]))); g.stroke(); });
  discs.concat(joins).forEach(d => { g.beginPath(); g.arc(tx(d.p[0]), tz(d.p[1]), d.r/px, 0, Math.PI*2); g.fill(); });
  const img = g.getImageData(0, 0, mw, mh).data, mask = new Uint8Array(mw*mh);
  for (let i = 0; i < mw*mh; i++) mask[i] = img[i*4];
  out.mask = mask; out.mw = mw; out.mh = mh; out.px = px;
  out.roadAt = (x, z) => { const i = Math.floor((x - X0)/px), j = Math.floor((z - Z0)/px); return i >= 0 && j >= 0 && i < mw && j < mh && mask[j*mw + i] > 127; };
  // ---------- kerbs along the mask edge (marching squares with interpolation) ----------
  const v = (i, j) => mask[j*mw + i], T = 127.5, segs = [];
  const P = (i0, j0, i1, j1) => { const a = v(i0, j0), b = v(i1, j1), f = (T - a)/((b - a) || 1); return [X0 + (i0 + .5 + (i1 - i0)*f)*px, Z0 + (j0 + .5 + (j1 - j0)*f)*px]; };
  const CASES = {1:[[3,0]], 2:[[0,1]], 3:[[3,1]], 4:[[1,2]], 5:[[3,0],[1,2]], 6:[[0,2]], 7:[[3,2]], 8:[[2,3]], 9:[[2,0]], 10:[[0,1],[2,3]], 11:[[2,1]], 12:[[1,3]], 13:[[1,0]], 14:[[0,3]]};
  for (let j = 0; j < mh-1; j++) for (let i = 0; i < mw-1; i++){
    const c = (v(i,j) > T ? 1 : 0) | (v(i+1,j) > T ? 2 : 0) | (v(i+1,j+1) > T ? 4 : 0) | (v(i,j+1) > T ? 8 : 0); if (c === 0 || c === 15) continue;
    const e = [P(i,j,i+1,j), P(i+1,j,i+1,j+1), P(i,j+1,i+1,j+1), P(i,j,i,j+1)];   // top, right, bottom, left
    for (const [a, b] of CASES[c]) segs.push(e[a], e[b]);
  }
  const pk = p => p[0].toFixed(3) + ',' + p[1].toFixed(3), nxt = new Map();
  for (let s = 0; s < segs.length; s += 2) nxt.set(pk(segs[s]), segs[s+1]);
  const seen = new Set(), lines = [];
  for (let s = 0; s < segs.length; s += 2){
    let k = pk(segs[s]); if (seen.has(k)) continue; const line = [segs[s]];
    while (!seen.has(k)){ seen.add(k); const q = nxt.get(k); if (!q) break; line.push(q); k = pk(q); }
    if (line.length > 3) lines.push(line);
  }
  const rdp = (p, tol) => { if (p.length < 3) return p; const a = p[0], b = p[p.length-1], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1e-9; let md = 0, mi = 0;
    for (let i = 1; i < p.length-1; i++){ const d = Math.abs(dz*p[i][0] - dx*p[i][1] + b[0]*a[1] - b[1]*a[0])/L; if (d > md){ md = d; mi = i; } }
    return md > tol ? rdp(p.slice(0, mi+1), tol).slice(0, -1).concat(rdp(p.slice(mi), tol)) : [a, b]; };
  const kv = [], KW = .3;
  const wallAt = (a, b, y0, y1, arr) => { arr.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]); };
  for (const line0 of lines){
    const line = rdp(line0, .08);
    for (let i = 0; i < line.length-1; i++){
      const a = line[i], b = line[i+1], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz); if (L < 1e-3) continue;
      let nx = -dz/L, nz = dx/L; const mx = (a[0]+b[0])/2, mz = (a[1]+b[1])/2;
      if (out.roadAt(mx + nx*.6, mz + nz*.6)){ nx = -nx; nz = -nz; }          // (nx, nz) points away from the road
      if (!isLand(mx + nx*.8, mz + nz*.8)) continue;                          // no kerb along water (bridges have their own parapets)
      const a2 = [a[0] + nx*KW, a[1] + nz*KW], b2 = [b[0] + nx*KW, b[1] + nz*KW];
      wallAt(a, b, ROAD - .05, TOP + .02, kv);                                // kerb face
      kv.push(a[0], TOP+.02, a[1], b[0], TOP+.02, b[1], b2[0], TOP+.02, b2[1], a[0], TOP+.02, a[1], b2[0], TOP+.02, b2[1], a2[0], TOP+.02, a2[1]);   // kerb top
    }
  }
  const mesh = (arr, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals(); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m; };
  out.kerbs = mesh(kv, new THREE.MeshStandardMaterial({color:0xc9c4b8, roughness:.85, side:THREE.DoubleSide}));
  // ---------- markings and medians ----------
  const jn = joins.concat(discs.map(d => ({p:d.p, r:d.r + 1})));
  const jgrid = new Map(); jn.forEach(j => { const k = gk(j.p[0], j.p[1]); (jgrid.get(k) || jgrid.set(k, []).get(k)).push(j); });
  const nearJ = (x, z, pad) => { const gx = Math.floor(x/G), gz = Math.floor(z/G);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of jgrid.get((gx+a) + ',' + (gz+b)) || []) if (Math.hypot(j.p[0]-x, j.p[1]-z) < j.r + pad) return true; return false; };
  const mv = [], mc = [], md = [], dv = [], Y = ROAD + .012;
  const strip = (a, b, na, nb, off, w, col, arr, carr, y = Y) => {   // a flat quad between a and b, offset sideways by off, w wide
    const p = (q, n, o) => [q[0] + n[0]*o, q[1] + n[1]*o];
    const a0 = p(a, na, off - w/2), a1 = p(a, na, off + w/2), b0 = p(b, nb, off - w/2), b1 = p(b, nb, off + w/2);
    arr.push(a0[0], y, a0[1], b0[0], y, b0[1], b1[0], y, b1[1], a0[0], y, a0[1], b1[0], y, b1[1], a1[0], y, a1[1]); if (carr) for (let k = 0; k < 6; k++) carr.push(...col); };
  const WHITE = [.93, .93, .9], YEL = [.95, .8, .25];
  for (const ch of C){
    if (ch.link) continue; const p = ch.pts, n = [];
    for (let i = 0; i < p.length; i++){ const a = p[Math.max(0, i-1)], b = p[Math.min(p.length-1, i+1)], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1; n.push([-dz/L, dx/L]); }
    let s = 0;
    for (let i = 0; i < p.length-1; i++){
      const a = p[i], b = p[i+1], L = Math.hypot(b[0]-a[0], b[1]-a[1]), mx = (a[0]+b[0])/2, mz = (a[1]+b[1])/2; s += L;
      if (L < 1e-3 || nearJ(mx, mz, 2.5) || !isLand(mx, mz)) continue;
      const e = ch.w/2 - .45;
      strip(a, b, n[i], n[i+1], e, .14, WHITE, mv, mc); strip(a, b, n[i], n[i+1], -e, .14, WHITE, mv, mc);   // edge lines
      if (ch.c === 'street'){ if ((s % 6) < 3.2) strip(a, b, n[i], n[i+1], 0, .13, YEL, mv, mc); }           // dashed centre line
      else {                                                                                                  // boulevard: a planted median, kerbed
        strip(a, b, n[i], n[i+1], 0, 1.7, null, md, null, TOP + .04);
        for (const o of [.85, -.85]){ const A = [a[0] + n[i][0]*o, a[1] + n[i][1]*o], B = [b[0] + n[i+1][0]*o, b[1] + n[i+1][1]*o]; wallAt(A, B, ROAD - .02, TOP + .04, dv); }
      }
    }
  }
  const markMat = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.6, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mv, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(mc, 3)); mg.computeVertexNormals(); mg.computeBoundingSphere();
  out.marks = new THREE.Mesh(mg, markMat); out.marks.receiveShadow = true; out.marks.userData.noCollide = true;
  out.medians = new THREE.Group();
  out.medians.add(mesh(md, new THREE.MeshStandardMaterial({color:0x5f8a3e, roughness:1})), mesh(dv, new THREE.MeshStandardMaterial({color:0xc9c4b8, roughness:.85, side:THREE.DoubleSide})));
  out.stats = {chains:C.length, joined, culs, junctions:joins.length, kerbLines:lines.length};
  console.log('[roads]', JSON.stringify(out.stats));
  return out;
}
