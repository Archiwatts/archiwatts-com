// Hidden Gems City: the city built from the Option B plan (game/citydata/city.json, made by the plan generator).
// Buildings: near-rectangular town houses get walls on their fitted rectangle, a hip or gable roof with eaves and a white
// fascia board (and rake boards on the gables); everything else is extruded from its drawn outline with a white coping.
// Also: bridge decks with parapets, the school fence with its gate, palms, and lamp posts along the boulevards.
export function buildPlanCity({THREE, CITY, base, road, wallMat, trimMat, stoneMat, ironMat}){
  const deckTop = road !== undefined ? road : base;
  const FOUND = 2.5;                          // walls run 2.5 m below grade: no building ever hovers where the ground dips
  const V = [], T = [];                       // wall + roof triangles (city material), trim triangles (white)
  const P = (x, y, z) => [x, y, z];
  const tri = (A, a, b, c) => A.push(...a, ...b, ...c);
  const quad = (A, a, b, c, d) => { tri(A, a, b, c); tri(A, a, c, d); };
  const out = {};

  // ---------- pitched houses ----------
  function pitched(b){
    const c = b.obb, y0 = base - FOUND, y1 = base + b.h;
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
    const g = new THREE.ExtrudeGeometry(shape, {depth:b.h + FOUND, bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0, base - FOUND, 0);
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
export function buildRoads({THREE, CITY, ROAD, TOP, X0, Z0, W, H, isLand, asphMat, deckMat, avoid = []}){
  const WID = {blvd:15.2, street:6.6}, out = {};   // avenue: 4 lanes of 3.3 m + 2 m median; street: 1 lane each way
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
  const SITE = chains.filter(ch => ch.c === 'site');   // a project's own roads (Net Zero's campus and streets): its model has the asphalt, so they are driven, not drawn
  let C = chains.filter(ch => ch.c !== 'site');   // the plan is checked by game/tools/traffic_sim.py: draw every road the cars drive, drop nothing
  const chaikin = (p, it) => { for (let n = 0; n < it; n++){ const q = [p[0]]; for (let i = 0; i < p.length-1; i++){ const a = p[i], b = p[i+1];
      q.push([a[0]*.75 + b[0]*.25, a[1]*.75 + b[1]*.25], [a[0]*.25 + b[0]*.75, a[1]*.25 + b[1]*.75]); } q.push(p[p.length-1]); p = q; } return p; };
  const rdpS = (p, tol) => { if (p.length < 3) return p; const a = p[0], b = p[p.length-1], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1e-9; let md = 0, mi = 0;
    for (let i = 1; i < p.length-1; i++){ const d = Math.abs(dz*p[i][0] - dx*p[i][1] + b[0]*a[1] - b[1]*a[0])/L; if (d > md){ md = d; mi = i; } }
    return md > tol ? rdpS(p.slice(0, mi+1), tol).slice(0, -1).concat(rdpS(p.slice(mi), tol)) : [a, b]; };
  const spline = p => {                                             // smooth road curve through the simplified control points (ends kept exact, so junctions still meet)
    if (p.length < 3){ const n = Math.max(2, Math.ceil(len(p) / 1.2)), a = p[0], b = p[p.length-1];   // straight roads are subdivided too, so a river crossing is seen and gets its bridge
      return Array.from({length:n + 1}, (_, i) => [a[0] + (b[0]-a[0])*i/n, a[1] + (b[1]-a[1])*i/n]); }
    const cv = new THREE.CatmullRomCurve3(p.map(q => new THREE.Vector3(q[0], 0, q[1])), false, 'centripetal');
    const n = Math.max(4, Math.ceil(len(p) / 1.2)); return cv.getPoints(n).map(v => [v.x, v.z]); };
  C.forEach(ch => { ch.len0 = len(ch.pts); ch.pts = spline(rdpS(ch.pts, .6)); ch.w = WID[ch.c]; });   // the plan's curves are already checked: keep them
  { const inA = p => avoid.some(a => Math.hypot(p[0] - a.x, p[1] - a.z) < a.r), C2 = [];   // roads stop at the edge of the squares they must stay out of
    for (const ch of C){ const cut = ch.pts.some(inA); let run = [];
      const flush = () => { if (cut){ while (run.length && !isLand(run[run.length-1][0], run[run.length-1][1])) run.pop(); while (run.length && !isLand(run[0][0], run[0][1])) run.shift(); }   // a cut road goes back to the bank: no deck left hanging over the water
        if (run.length >= 2) C2.push({...ch, pts:run}); run = []; };
      for (const p of ch.pts){ if (inA(p)) flush(); else run.push(p); } flush(); }
    C = C2; }
  const nearAvoid = p => avoid.some(a => Math.hypot(p[0] - a.x, p[1] - a.z) < a.r + 12);
  // ---------- loose ends ----------
  const nodes = new Map(); C.forEach((ch, ci) => [0, 1].forEach(e => { const p = e ? ch.pts[ch.pts.length-1] : ch.pts[0], k = K(p); (nodes.get(k) || nodes.set(k, {p, list:[]}).get(k)).list.push([ci, e]); }));
  const G = 20, grid = new Map(), gk = (x, z) => Math.floor(x/G) + ',' + Math.floor(z/G);
  C.forEach((ch, ci) => ch.pts.forEach((p, i) => { const k = gk(p[0], p[1]); (grid.get(k) || grid.set(k, []).get(k)).push([ci, i]); }));
  const nearest = (p, skipCi, skipI) => { let best = null, bd = 1e9; const gx = Math.floor(p[0]/G), gz = Math.floor(p[1]/G);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [ci, i] of grid.get((gx+a) + ',' + (gz+b)) || []){
      if (ci === skipCi && Math.abs(i - skipI) < 60) continue; const q = C[ci].pts[i], d = Math.hypot(q[0]-p[0], q[1]-p[1]); if (d < bd){ bd = d; best = [q, ci]; } }
    return best ? {q:best[0], d:bd, ci:best[1]} : null; };
  const discs = [], joins = [];                                     // turning circles; junction patches
  nodes.forEach(n => { if (n.list.length >= 2) joins.push({p:n.p, r:Math.min(...n.list.map(([ci]) => C[ci].w))/2, rmax:Math.max(...n.list.map(([ci]) => C[ci].w))/2}); });   // r: the narrowest arm (fills the wedge between arms without a bulge)
  let joined = 0, culs = 0;
  const nC = C.length;
  nodes.forEach(n => {
    if (n.list.length !== 1) return; const [ci, e] = n.list[0]; if (ci >= nC) return; const ch = C[ci], idx = e ? ch.pts.length-1 : 0, nr = nearest(n.p, ci, idx);
    if (nr && nr.d < ch.w/2 + C[nr.ci].w/2 + .5) return;                                                // already touching another road: a T junction
    // (no invented link roads: a loose end means the plan is wrong, and traffic_sim.py fails it)
    if (isLand(n.p[0], n.p[1]) && ch.len0 > 40 && !nearAvoid(n.p)){ discs.push({p:n.p, r:ch.c === 'blvd' ? 8.5 : 7}); culs++; }   // a turning circle at the end of a real street
  });
  // ---------- the road mask (0.5 m): a signed distance to the road edge, not a yes/no grid ----------
  // Each pixel stores how far it is from the kerb (128 = on the kerb line, 32 levels per metre), so the edge interpolates smoothly
  // between pixels: no staircase. Roads are blended with a smooth minimum, which rounds every junction corner (kerb return).
  const px = .5, mw = Math.ceil(W/px), mh = Math.ceil(H/px), N = mw*mh, tx = x => (x - X0)/px, tz = z => (z - Z0)/px;
  const sdf = (extra, K, out8) => {          // extra: metres added to each half-width (0 road, 2.4 pavement); K: corner softness (m)
    const S = new Float32Array(N), reach = K * 6;
    const shapes = C.map(ch => ({pts:ch.pts, hw:ch.w/2 + extra})).concat(discs.concat(joins).map(d => ({disc:d.p, hw:d.r + extra})));
    const dc = new Float32Array(N).fill(1e9);
    for (const sh of shapes){
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; const P = sh.disc ? [sh.disc] : sh.pts;
      for (const [x, z] of P){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const pad = sh.hw + reach, i0 = Math.max(0, Math.floor(tx(x0 - pad))), i1 = Math.min(mw-1, Math.ceil(tx(x1 + pad))), j0 = Math.max(0, Math.floor(tz(z0 - pad))), j1 = Math.min(mh-1, Math.ceil(tz(z1 + pad)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) dc[j*mw+i] = 1e9;
      if (sh.disc){ const [cx, cz] = sh.disc; for (let j = j0; j <= j1; j++){ const z = Z0 + (j+.5)*px; for (let i = i0; i <= i1; i++){ const x = X0 + (i+.5)*px; dc[j*mw+i] = Math.hypot(x-cx, z-cz); } } }
      else for (let s = 0; s < P.length-1; s++){ const [ax, az] = P[s], [bx, bz] = P[s+1], dx = bx-ax, dz = bz-az, L2 = dx*dx + dz*dz || 1e-9;
        const si0 = Math.max(i0, Math.floor(tx(Math.min(ax, bx) - pad))), si1 = Math.min(i1, Math.ceil(tx(Math.max(ax, bx) + pad))), sj0 = Math.max(j0, Math.floor(tz(Math.min(az, bz) - pad))), sj1 = Math.min(j1, Math.ceil(tz(Math.max(az, bz) + pad)));
        for (let j = sj0; j <= sj1; j++){ const z = Z0 + (j+.5)*px; for (let i = si0; i <= si1; i++){ const x = X0 + (i+.5)*px; let t = ((x-ax)*dx + (z-az)*dz)/L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(x - ax - t*dx, z - az - t*dz), q = j*mw+i; if (d < dc[q]) dc[q] = d; } } }
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const q = j*mw+i; if (dc[q] < 1e8) S[q] += Math.exp(-(dc[q] - sh.hw)/K); }
    }
    for (let q = 0; q < N; q++){ const d = S[q] > 0 ? -K*Math.log(S[q]) : 99; out8[q] = Math.max(0, Math.min(255, Math.round(128 - d*32))); }   // smooth union of every road, its signed distance
  };
  const mask = new Uint8Array(N), walk = new Uint8Array(N);
  sdf(0, 1.6, mask); sdf(2.4, 2.4, walk);
  const rg = new Uint8Array(N*2); for (let i = 0; i < N; i++){ rg[i*2] = mask[i]; rg[i*2+1] = Math.max(walk[i], mask[i]); }
  out.rg = rg;                                                      // R: road, G: road + pavement strip (for the ground shader)
  { const seen = new Uint8Array(mw*mh), stack = new Int32Array(mw*mh), MAXA = Math.round(90 / (px*px));   // islands under ~90 m2 become road
    for (let s = 0; s < mw*mh; s++){
      if (seen[s] || mask[s] > 127) continue; let top = 0, n = 0, edge = false; const comp = []; stack[top++] = s; seen[s] = 1;
      while (top){ const i = stack[--top]; n++; if (n <= MAXA) comp.push(i); const x = i % mw, y = (i / mw) | 0; if (x === 0 || y === 0 || x === mw-1 || y === mh-1) edge = true;
        for (const j of [i-1, i+1, i-mw, i+mw]){ if (j < 0 || j >= mw*mh || seen[j] || mask[j] > 127) continue; seen[j] = 1; stack[top++] = j; } }
      if (!edge && n <= MAXA) for (const i of comp) mask[i] = 255; } }
  for (let i = 0; i < mw*mh; i++){ rg[i*2] = mask[i]; if (mask[i] > rg[i*2+1]) rg[i*2+1] = mask[i]; }   // the filled islands count as road in the texture too
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
  const jn = joins.map(j => ({p:j.p, r:j.rmax})).concat(discs.map(d => ({p:d.p, r:d.r + 1})));
  const jgrid = new Map(); jn.forEach(j => { const k = gk(j.p[0], j.p[1]); (jgrid.get(k) || jgrid.set(k, []).get(k)).push(j); });
  const nearJ = (x, z, pad) => { const gx = Math.floor(x/G), gz = Math.floor(z/G);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of jgrid.get((gx+a) + ',' + (gz+b)) || []) if (Math.hypot(j.p[0]-x, j.p[1]-z) < j.r + pad) return true; return false; };
  const mv = [], mc = [], md = [], dv = [], Y = ROAD + .012;
  const strip = (a, b, na, nb, off, w, col, arr, carr, y = Y) => {   // a flat quad between a and b, offset sideways by off, w wide
    const p = (q, n, o) => [q[0] + n[0]*o, q[1] + n[1]*o];
    const a0 = p(a, na, off - w/2), a1 = p(a, na, off + w/2), b0 = p(b, nb, off - w/2), b1 = p(b, nb, off + w/2);
    arr.push(a0[0], y, a0[1], b0[0], y, b0[1], b1[0], y, b1[1], a0[0], y, a0[1], b1[0], y, b1[1], a1[0], y, a1[1]); if (carr) for (let k = 0; k < 6; k++) carr.push(...col); };
  const WHITE = [.93, .93, .9], YEL = [.95, .8, .25];
  // Pavement markings to MUTCD / FDOT Standard Plans 711-001 (feet in metres): 6 in lines, broken lines 10 ft painted / 30 ft gap,
  // double solid yellow centre line on two-way streets, yellow left edge line along a median, 24 in stop bar >= 4 ft before a
  // 10 ft special-emphasis crosswalk of 24 in bars on 48 in centres. Lines stop at the stop bar.
  const IN6 = .1524, FT = .3048, XW = 10*FT, BAR = 24*.0254, BARC = 48*.0254, STOPW = 24*.0254, STOPGAP = 4*FT;
  const XW_AT = 1.5, STOP_AT = XW_AT + XW + STOPGAP + STOPW/2;   // from the junction's edge: crosswalk starts at XW_AT; stop bar centre
  for (const ch of C){
    if (ch.link) continue; const p = ch.pts, n = [];
    for (let i = 0; i < p.length; i++){ const a = p[Math.max(0, i-1)], b = p[Math.min(p.length-1, i+1)], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1; n.push([-dz/L, dx/L]); }
    let s = 0;
    for (let i = 0; i < p.length-1; i++){
      const a = p[i], b = p[i+1], L = Math.hypot(b[0]-a[0], b[1]-a[1]), mx = (a[0]+b[0])/2, mz = (a[1]+b[1])/2; s += L;
      if (L < 1e-3 || nearJ(mx, mz, STOP_AT - STOPW/2) || !isLand(mx, mz)) continue;   // lines end at the stop bar
      const e = ch.w/2 - .45;
      strip(a, b, n[i], n[i+1], e, IN6, WHITE, mv, mc); strip(a, b, n[i], n[i+1], -e, IN6, WHITE, mv, mc);   // 6 in white edge lines
      if (ch.c === 'street'){ for (const o of [-IN6, IN6]) strip(a, b, n[i], n[i+1], o, IN6, YEL, mv, mc); }   // double solid yellow centre line (6 in lines, 6 in apart)
      else {                                                                                                  // boulevard: a planted median, kerbed
        strip(a, b, n[i], n[i+1], 0, 2, null, md, null, TOP + .04);
        if ((s % (40*FT)) < 10*FT) for (const o of [4.3, -4.3]) strip(a, b, n[i], n[i+1], o, IN6, WHITE, mv, mc);   // lane line: 6 in white, 10 ft painted / 30 ft gap
        for (const o of [1.25, -1.25]) strip(a, b, n[i], n[i+1], o, IN6, YEL, mv, mc);                               // yellow left edge line along the median
        for (const o of [1, -1]){ const A = [a[0] + n[i][0]*o, a[1] + n[i][1]*o], B = [b[0] + n[i+1][0]*o, b[1] + n[i+1][1]*o]; wallAt(A, B, ROAD - .02, TOP + .04, dv); }
      }
    }
  }
  // crosswalks and stop bars on every approach to a junction: a zebra across the road, and a stop bar on the arriving lane
  nodes.forEach((nd, key) => {
    if (nd.list.length < 3) return; const jr = Math.max(...nd.list.map(([ci]) => C[ci] ? C[ci].w : 6.6)) / 2;
    for (const [ci, e] of nd.list){ const ch = C[ci]; if (!ch || ch.link) continue;
      const p = e ? ch.pts.slice().reverse() : ch.pts; let acc = 0, k = 1; const want = jr + XW_AT + XW/2;
      while (k < p.length && acc + Math.hypot(p[k][0]-p[k-1][0], p[k][1]-p[k-1][1]) < want){ acc += Math.hypot(p[k][0]-p[k-1][0], p[k][1]-p[k-1][1]); k++; }
      if (k >= p.length) continue;
      const A = p[k-1], B = p[k], L = Math.hypot(B[0]-A[0], B[1]-A[1]) || 1, f = (want - acc) / L, t = [(B[0]-A[0])/L, (B[1]-A[1])/L], nn = [-t[1], t[0]];
      const P0 = [A[0] + (B[0]-A[0])*f, A[1] + (B[1]-A[1])*f];
      if (!isLand(P0[0], P0[1])) continue;
      const hw = ch.w/2 - .5;
      const nb = Math.floor((2*hw - BAR) / BARC) + 1, o0 = -((nb - 1) * BARC) / 2;
      for (let q = 0; q < nb; q++) strip([P0[0] - t[0]*XW/2, P0[1] - t[1]*XW/2], [P0[0] + t[0]*XW/2, P0[1] + t[1]*XW/2], nn, nn, o0 + q*BARC, BAR, WHITE, mv, mc);   // special-emphasis crosswalk: 24 in bars on 48 in centres, 10 ft wide
      const Q0 = [P0[0] + t[0]*(XW/2 + STOPGAP + STOPW/2), P0[1] + t[1]*(XW/2 + STOPGAP + STOPW/2)], u = [-t[0], -t[1]], rgt = [-u[1], u[0]], m0 = ch.c === 'blvd' ? 1 : 0, Q = [Q0[0] + rgt[0]*m0, Q0[1] + rgt[1]*m0];   // the lane arriving at the junction (a boulevard's starts at the median)
      strip([Q[0], Q[1]], [Q0[0] + rgt[0]*(hw), Q0[1] + rgt[1]*(hw)], t, t, 0, STOPW, WHITE, mv, mc); } });   // 24 in stop bar, 4 ft before the crosswalk
  const markMat = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.6, side:THREE.DoubleSide,   // the strips are wound facing down: double-sided so the paint shows from above
    polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mv, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(mc, 3)); mg.computeVertexNormals(); mg.computeBoundingSphere();
  out.marks = new THREE.Mesh(mg, markMat); out.marks.receiveShadow = true; out.marks.userData.noCollide = true;
  out.medians = new THREE.Group();
  out.medians.add(mesh(md, new THREE.MeshStandardMaterial({color:0x5f8a3e, roughness:1})), mesh(dv, new THREE.MeshStandardMaterial({color:0xc9c4b8, roughness:.85, side:THREE.DoubleSide})));
  // ---------- bridges: wherever a road curve runs over water it gets a deck (asphalt top, concrete body, parapets) ----------
  { const bt = [], bb = [], yT = ROAD + .02, yB = ROAD - 1.3, yP = ROAD + 1.07; let nb = 0;
    const quad = (arr, a, b, c, d) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
    const ribbon = (p, w) => { const hw = w/2 + .9, hi = hw - .3, n = [];
      for (let i = 0; i < p.length; i++){ const a = p[Math.max(0, i-1)], b = p[Math.min(p.length-1, i+1)], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1; n.push([-dz/L, dx/L]); }
      const at = (i, o, y) => [p[i][0] + n[i][0]*o, y, p[i][1] + n[i][1]*o];
      for (let i = 0; i < p.length-1; i++){ const j = i+1;
        quad(bt, at(i, -hi, yT), at(j, -hi, yT), at(j, hi, yT), at(i, hi, yT));                    // asphalt deck
        quad(bb, at(i, -hw, yB), at(j, -hw, yB), at(j, hw, yB), at(i, hw, yB));                    // underside
        for (const s of [-1, 1]){
          quad(bb, at(i, s*hw, yB), at(j, s*hw, yB), at(j, s*hw, yP), at(i, s*hw, yP));            // outer face, deck and parapet in one
          quad(bb, at(i, s*hi, yT), at(j, s*hi, yT), at(j, s*hi, yP), at(i, s*hi, yP));            // parapet inner face
          quad(bb, at(i, s*hi, yP), at(j, s*hi, yP), at(j, s*hw, yP), at(i, s*hw, yP)); } } };     // parapet top
    for (const ch of C){ const p = ch.pts; let i = 0;
      while (i < p.length){
        if (isLand(p[i][0], p[i][1])){ i++; continue; }
        let j = i; while (j < p.length && !isLand(p[j][0], p[j][1])) j++;
        const a = Math.max(0, i - 3), b = Math.min(p.length - 1, j + 2);
        const open0 = i === 0 && ((nodes.get(K(p[0])) || {list:[]}).list.length < 2), open1 = j >= p.length && ((nodes.get(K(p[p.length-1])) || {list:[]}).list.length < 2);
        if (b - a >= 2 && !open0 && !open1){ ribbon(p.slice(a, b + 1), ch.w); nb++; }   // a deck wherever the road is over water, unless that road just stops in the water
        i = j + 1; } }
    if (bt.length){ out.bridgeTop = mesh(bt, asphMat); out.bridgeBody = mesh(bb, deckMat); out.bridgeBody.castShadow = true; }
    out.nBridges = nb; }
  out.chains = C.filter(ch => !ch.link).map(ch => ({c:ch.c, pts:ch.pts})).concat(SITE.map(ch => ({c:'site', pts:ch.pts})));   // exactly what is drawn (traffic drives these)
  out.stats = {chains:C.length, joined, culs, junctions:joins.length, kerbLines:lines.length, bridges:out.nBridges};
  console.log('[roads]', JSON.stringify(out.stats));
  return out;
}


// =================== trees: palms with leaflet fronds, broadleaf trees with full rounded crowns ===================
export function buildTrees({THREE, trees, TOP}){
  const G = new THREE.Group(), R = (i, k) => { const s = Math.sin(i*127.1 + k*311.7)*43758.5453; return s - Math.floor(s); };
  const palms = [], broad = [];
  trees.forEach((t, i) => (t[2] === 2.6 || R(i, 1) < .3 ? palms : broad).push([t[0], t[1], i]));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  // ---- palm frond texture: a midrib with fine leaflets either side, on a clear background ----
  const fc = document.createElement('canvas'); fc.width = 128; fc.height = 512; { const x = fc.getContext('2d'); x.lineCap = 'round';
    for (let y = 500; y > 14; y -= 5){ const t = 1 - y/512, len = 58*Math.pow(Math.sin(Math.PI*Math.min(1, t*1.05 + .04)), .55);
      for (const s of [-1, 1]){ x.strokeStyle = `rgb(${52 + (y*7)%30},${118 + (y*13)%45},${48 + (y*5)%24})`; x.lineWidth = 4.2; x.beginPath(); x.moveTo(64, y); x.lineTo(64 + s*len, y - 30 - len*.25); x.stroke(); } }
    x.strokeStyle = '#6b7f3a'; x.lineWidth = 4; x.beginPath(); x.moveTo(64, 510); x.lineTo(64, 8); x.stroke(); }
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = 8;
  // ---- palm crown: 18 arching fronds in two tiers, each a folded strip ----
  const pos = [], uv = [], idx = [], N = 18, SEG = 8;
  for (let f = 0; f < N; f++){ const tier = f % 2, a = f/N*Math.PI*2 + (f*2.4 % 1)*.25, ca = Math.cos(a), sa = Math.sin(a), L = 3.1 + (f % 3)*.35, e0 = tier ? .95 : .3, dr = tier ? .85 : 1.3, base = pos.length/3;
    for (let s = 0; s <= SEG; s++){ const t = s/SEG, r = L*t*(1 - .15*t), y = L*(Math.sin(e0)*t - dr*t*t*.7), w = .48*Math.sin(Math.PI*(.06 + .92*t));
      pos.push(ca*r - sa*w, y + w*.3, sa*r + ca*w,  ca*r, y, sa*r,  ca*r + sa*w, y + w*.3, sa*r - ca*w); uv.push(0, t, .5, t, 1, t);
      if (s){ const b = base + (s-1)*3; idx.push(b, b+3, b+1, b+1, b+3, b+4, b+1, b+4, b+2, b+2, b+4, b+5); } } }
  const crownG = new THREE.BufferGeometry(); crownG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); crownG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); crownG.setIndex(idx); crownG.computeVertexNormals();
  const trunkG = new THREE.CylinderGeometry(.13, .2, 1, 10, 8); trunkG.translate(0, .5, 0); { const p = trunkG.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + .35*p.getY(i)*p.getY(i)); trunkG.computeVertexNormals(); }
  const bc = document.createElement('canvas'); bc.width = 64; bc.height = 64; { const x = bc.getContext('2d'); x.fillStyle = '#8f7a5e'; x.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8){ x.fillStyle = 'rgba(60,45,30,.55)'; x.fillRect(0, y, 64, 2); x.fillStyle = 'rgba(255,240,210,.12)'; x.fillRect(0, y + 3, 64, 2); } }
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(2, 9);
  if (palms.length){
    const crown = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({map:ft, alphaTest:.45, side:THREE.DoubleSide, roughness:.8}), palms.length);
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({map:bt, roughness:.95}), palms.length);
    palms.forEach(([x, z, id], i) => { const h = 6.5 + R(id, 2)*4.5, ry = R(id, 3)*Math.PI*2, k = .85 + R(id, 4)*.35;
      Q.setFromAxisAngle(UP, ry); M.compose(P.set(x, TOP, z), Q, S.set(1, h, 1)); trunk.setMatrixAt(i, M);
      M.compose(P.set(x + Math.cos(ry)*.35, TOP + h - .1, z - Math.sin(ry)*.35), Q, S.set(k, k, k)); crown.setMatrixAt(i, M); });
    crown.userData.noCollide = true; crown.castShadow = trunk.castShadow = true; crown.receiveShadow = trunk.receiveShadow = true; G.add(trunk, crown);
  }
  // ---- broadleaf crown: four overlapping, gently lumpy spheres with smooth normals; darker underneath ----
  const bp = [], bn = [], bcol = [], ico = new THREE.IcosahedronGeometry(1, 2).attributes.position;
  [[0, 0, 0, 1.75], [1.25, .25, .35, 1.25], [-1.05, .3, .65, 1.3], [.15, .55, -1.15, 1.25]].forEach(([cx, cy, cz, r], bi) => {
    for (let i = 0; i < ico.count; i++){ const x = ico.getX(i), y = ico.getY(i), z = ico.getZ(i), d = 1 + .16*Math.sin(x*5 + bi*2)*Math.sin(y*6 + bi)*Math.sin(z*5.5 + bi*3);
      const px = cx + x*r*d, py = cy + y*r*d*.85, pz = cz + z*r*d; bp.push(px, py, pz); bn.push(x, y, z);
      const sh = .5 + .5*Math.min(1, Math.max(0, (py + 1.3)/2.8)), v = .92 + .16*Math.sin(px*7.3 + pz*5.1 + py*3.7); bcol.push(.13*sh*v, .3*sh*v, .08*sh*v); } });
  const blobG = new THREE.BufferGeometry(); blobG.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); blobG.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3)); blobG.setAttribute('color', new THREE.Float32BufferAttribute(bcol, 3));
  const stemG = new THREE.CylinderGeometry(.13, .24, 1, 9, 1); stemG.translate(0, .5, 0);
  if (broad.length){
    const crown = new THREE.InstancedMesh(blobG, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.92}), broad.length);
    const stem = new THREE.InstancedMesh(stemG, new THREE.MeshStandardMaterial({color:0x6b543c, roughness:.95}), broad.length);
    const TINT = ['#ffffff', '#e6f2cf', '#d2ecc4', '#f4f0c4', '#cfe6b8'].map(c => new THREE.Color(c));
    broad.forEach(([x, z, id], i) => { const h = 2.3 + R(id, 2)*1.3, k = .85 + R(id, 4)*.6, ry = R(id, 3)*Math.PI*2;
      Q.setFromAxisAngle(UP, ry); M.compose(P.set(x, TOP, z), Q, S.set(k, h, k)); stem.setMatrixAt(i, M);
      M.compose(P.set(x, TOP + h + 1.2*k, z), Q, S.set(k, k, k)); crown.setMatrixAt(i, M); crown.setColorAt(i, TINT[id % TINT.length]); });
    crown.userData.noCollide = true; crown.castShadow = stem.castShadow = true; crown.receiveShadow = true; G.add(stem, crown);
  }
  return G;
}
