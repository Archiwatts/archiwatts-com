// Builds the project models for the parkour game (game/models): each project with only a tight apron of its own landscape
// (no site context, no water), from the best version of each model, baked to metres with its ground at y = 0, meshopt-compressed.
// Run: node build-game.cjs [slug ...]
const fs = require('fs');
const L = require('./lib.cjs');
const OUT = L.ROOT + 'game/models/';
Object.assign(L.SOURCES, {   // the versions the project pages show on a computer
  'net-zero-school': { glb: 'Net-Zero-School/light/Net-Zero-School-v2-detail.glb' },
  'tranquil-river': { glb: 'Tranquil-River/light/Tranquil-River-v2-detail.glb' },
  'winter-station': { glb: '_source-models/winter-station/winter-station.glb' },
  'north-beach-youth-center': { glb: '_source-models/north-beach-youth-center/out/model.glb' }   // the IFC conversion: the page model's building parts are empty
});
const lin = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255].map(c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }).concat(1);
const WATER = /water/i, CONTEXT = /context|team buildings/i, GROUND = /landscape|field|road|paving|terrain|ground|paths|site_line|bank|spring_bed|planting/i;

// rect: [x0, z0, x1, z1] in model metres; around: node-name pattern whose bounds (+ margin) define the piece; sea: sit the piece's water at sea level
// rect / around / square: where to look for the project (model metres); tight: crop to the project's own parts + this margin (m);
// keep: also keep context (Venice is its own old quarter); budget: triangle cap (0 = full)
const CFG = {
  'hive': { rect: [-205, -85, 268, 232], tight: 14, budget: 700000 },
  'net-zero-school': { rect: [8, -420, 400, 75], tight: 14, budget: 700000 },
  'tranquil-river': { tight: 10, budget: 0 },
  'north-beach-youth-center': { around: /^Youth_center__(Glazing|Plaster|ScreenPanel|Timber|Planting)$/, tight: 8, budget: 900000 },
  'museum-of-emotions': { rect: [-125, -125, 125, 125], tight: 10, budget: 400000 },
  'museum-study-2': { around: /^(Plaster|Dark timber)$/, margin: 90, tight: 10, budget: 250000 },
  'museum-study-3': { around: /^(Warm plaster|Stone|Metal)$/, margin: 60, tight: 10, budget: 250000 },
  'london-1': { around: /^(CLT Wood|white trim -- wood|white stuc -- wood)$/, square: 220, tight: 12, skip: /^(Default Form|Analytical Floor Surface|Default Mass Floor)$/, context: /^(DefaultMaterial|IfcSite)$/, budget: 900000 },
  'london-2': { around: /^(Glass walls|Aluminum|Default Floor)$/, square: 240, tight: 12, skip: /^(Default Form|Default Mass Floor|Glass, Clear Glazing|Base|Analytical Floor Surface)$/, context: /^(Analytical Floor Surface|DefaultMaterial|IfcSite)$/, budget: 0 },
  'winter-station': { tight: 4, budget: 0 },
  'venice-apartments': { around: /^Main apartment$/, margin: 420, island: { seed: /^Main apartment$/, erode: 2 }, keep: true, sea: true, dropWater: true, budget: 700000 },
  'allure-waterways': { y0: 9, budget: 400000, ship: true, keep: true },
  'wheels-on-water': { y0: 1, budget: 0, ship: true, keep: true }
};

(async () => {
  const io = await L.io(); fs.mkdirSync(OUT, { recursive: true });
  const manifest = fs.existsSync(OUT + 'manifest.json') ? JSON.parse(fs.readFileSync(OUT + 'manifest.json', 'utf8')) : {};
  const todo = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CFG);
  for (const slug of todo) {
    const cfg = CFG[slug], t0 = Date.now();
    const doc = await io.readBinary(L.bytes(cfg.src || slug)); await doc.transform(L.fn.dequantize());
    const root = doc.getRoot(), scene = root.listScenes()[0];
    const nodes = []; scene.traverse(n => nodes.push(n));
    const full = (n) => { const a = []; for (let p = n; p && p.getName; p = p.getParentNode ? p.getParentNode() : null) a.push(p.getName()); return a.join(' / '); };

    // piece rectangle
    let rect = cfg.rect ? cfg.rect.slice() : null;
    if (cfg.around) { let b = null; nodes.filter(n => cfg.around.test(n.getName())).forEach(n => { const nb = L.fn.getBounds(n); if (!isFinite(nb.min[0])) return; b = b ? [Math.min(b[0], nb.min[0]), Math.min(b[1], nb.min[2]), Math.max(b[2], nb.max[0]), Math.max(b[3], nb.max[2])] : [nb.min[0], nb.min[2], nb.max[0], nb.max[2]]; }); rect = b; }
    if (!rect) { const b = L.fn.getBounds(scene); rect = [b.min[0], b.min[2], b.max[0], b.max[2]]; }
    if (cfg.square) { const c = [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2]; rect = [c[0] - cfg.square, c[1] - cfg.square, c[0] + cfg.square, c[1] + cfg.square]; }
    const mg = cfg.margin || 0; rect = [rect[0] - mg, rect[1] - mg, rect[2] + mg, rect[3] + mg];
    if (cfg.tight !== undefined){   // shrink to the project's own parts (not ground, context or water) inside that area, plus a margin of its own landscape
      const pb2 = [1e9, 1e9, -1e9, -1e9];
      for (const node of nodes){ const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix(), nm = full(node);
        for (const prim of mesh.listPrimitives()){ const mat = prim.getMaterial(), mname = mat ? mat.getName() : '', label = nm + ' / ' + mname;
          if (cfg.skip && cfg.skip.test(mname)) continue;
          const own = /main apartment|youth center/i.test(nm);
          if (WATER.test(label) || (!own && (CONTEXT.test(label) || (cfg.context && cfg.context.test(mname)))) || GROUND.test(label)) continue;
          const pa = prim.getAttribute('POSITION').getArray();
          for (let v = 0; v < pa.length; v += 3){ const x = m[0]*pa[v] + m[4]*pa[v+1] + m[8]*pa[v+2] + m[12], z = m[2]*pa[v] + m[6]*pa[v+1] + m[10]*pa[v+2] + m[14];
            if (x < rect[0] || x > rect[2] || z < rect[1] || z > rect[3]) continue; if (x < pb2[0]) pb2[0] = x; if (z < pb2[1]) pb2[1] = z; if (x > pb2[2]) pb2[2] = x; if (z > pb2[3]) pb2[3] = z; } } }
      if (pb2[0] < 1e8) rect = [pb2[0] - cfg.tight, pb2[1] - cfg.tight, pb2[2] + cfg.tight, pb2[3] + cfg.tight];
    }
    // island: keep only the land that the seed node stands on. Rasterise everything that is not water, break the bridges
    // (erode), flood from the seed, grow back, and keep the triangles over that mask.
    let mask = null;
    if (cfg.island) {
      const C = 2, gw = Math.ceil((rect[2] - rect[0]) / C), gd = Math.ceil((rect[3] - rect[1]) / C), occ = new Uint8Array(gw * gd);
      const mark = (x, z) => { const i = Math.floor((x - rect[0]) / C), j = Math.floor((z - rect[1]) / C); if (i >= 0 && j >= 0 && i < gw && j < gd) occ[j * gw + i] = 1; };
      for (const node of nodes) { const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix(), nm = full(node);
        for (const prim of mesh.listPrimitives()) { if (prim.getMode() !== 4) continue; const mat = prim.getMaterial(); if (WATER.test(nm + ' / ' + (mat ? mat.getName() : ''))) continue;
          const pa = prim.getAttribute('POSITION').getArray(), I = prim.getIndices(), ia = I ? I.getArray() : null, count = ia ? ia.length : pa.length / 3;
          const X = v => m[0] * pa[v * 3] + m[4] * pa[v * 3 + 1] + m[8] * pa[v * 3 + 2] + m[12], Z = v => m[2] * pa[v * 3] + m[6] * pa[v * 3 + 1] + m[10] * pa[v * 3 + 2] + m[14];
          for (let i = 0; i + 2 < count; i += 3) { const a = ia ? ia[i] : i, b = ia ? ia[i + 1] : i + 1, c = ia ? ia[i + 2] : i + 2, ax = X(a), az = Z(a), bx = X(b), bz = Z(b), qx = X(c), qz = Z(c);
            if (Math.max(ax, bx, qx) < rect[0] || Math.min(ax, bx, qx) > rect[2] || Math.max(az, bz, qz) < rect[1] || Math.min(az, bz, qz) > rect[3]) continue;
            const n = Math.min(160, Math.ceil(Math.max(Math.hypot(bx - ax, bz - az), Math.hypot(qx - ax, qz - az), Math.hypot(qx - bx, qz - bz)) / (C * .7)));
            for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) { const s = u / (n || 1), t = v / (n || 1); mark(ax + (bx - ax) * s + (qx - ax) * t, az + (bz - az) * s + (qz - az) * t); } } } }
      const morph = (src, r, grow) => { const out = new Uint8Array(gw * gd); for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) { let v = grow ? 0 : 1;
        for (let dj = -r; dj <= r && v !== (grow ? 1 : 0); dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj, o = ii >= 0 && jj >= 0 && ii < gw && jj < gd ? src[jj * gw + ii] : 0; if (grow ? o : !o) { v = grow ? 1 : 0; break; } } out[j * gw + i] = v; } return out; };
      const er = morph(occ, cfg.island.erode || 2, false);
      let sb = null; nodes.filter(n => cfg.island.seed.test(n.getName())).forEach(n => { const nb = L.fn.getBounds(n); if (isFinite(nb.min[0])) sb = nb; });
      let si = Math.floor(((sb.min[0] + sb.max[0]) / 2 - rect[0]) / C), sj = Math.floor(((sb.min[2] + sb.max[2]) / 2 - rect[1]) / C);
      if (!er[sj * gw + si]) { let bd = 1e9, bi = si, bj = sj; for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) if (er[j * gw + i]) { const d = (i - si) ** 2 + (j - sj) ** 2; if (d < bd) { bd = d; bi = i; bj = j; } } si = bi; sj = bj; }
      const fl = new Uint8Array(gw * gd), st = [sj * gw + si]; fl[st[0]] = 1;
      while (st.length) { const k = st.pop(), i = k % gw, j = (k - i) / gw; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gd) continue; const kk = jj * gw + ii; if (er[kk] && !fl[kk]) { fl[kk] = 1; st.push(kk); } } }
      const land = morph(fl, (cfg.island.erode || 2) + 1, true); let i0 = gw, i1 = 0, j0 = gd, j1 = 0, cells = 0;
      for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) if (land[j * gw + i]) { cells++; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
      const r0 = rect.slice(); mask = (x, z) => { const i = Math.floor((x - r0[0]) / C), j = Math.floor((z - r0[1]) / C); return i >= 0 && j >= 0 && i < gw && j < gd && land[j * gw + i] === 1; };
      rect = [r0[0] + i0 * C, r0[1] + j0 * C, r0[0] + (i1 + 1) * C, r0[1] + (j1 + 1) * C];
      console.log('  island:', Math.round(rect[2] - rect[0]) + ' x ' + Math.round(rect[3] - rect[1]) + ' m,', Math.round(cells * C * C / 1e4 * 10) / 10 + ' ha, touches search edge:', i0 === 0 || j0 === 0 || i1 === gw - 1 || j1 === gd - 1);
    }
    const cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2;

    // gather triangles per output material, in world metres
    const groups = new Map(); const hist = new Map(), whist = new Map(); let waterArea = 0, waterY = 0;
    const group = (key, kind, color) => { if (!groups.has(key)) groups.set(key, { kind, color, pos: [], nrm: [], idx: [], n: 0, noNormals: false }); return groups.get(key); };
    for (const node of nodes) {
      const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix(), nm = full(node);
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const P = prim.getAttribute('POSITION'); if (!P) continue; const pa = P.getArray(), N = prim.getAttribute('NORMAL'), na = N ? N.getArray() : null;
        const I = prim.getIndices(), ia = I ? I.getArray() : null, count = ia ? ia.length : P.getCount();
        const mat = prim.getMaterial(), mname = mat ? mat.getName() : '', label = nm + ' / ' + mname;
        if (cfg.skip && cfg.skip.test(mname)) continue;
        const own = /main apartment|youth center/i.test(nm);   // the project's own parts can share a material named after the context
        const kind = WATER.test(label) ? 'water' : (own ? false : (CONTEXT.test(label) || (cfg.context && cfg.context.test(mname)))) ? 'context' : cfg.ship ? 'project' : GROUND.test(label) ? 'ground' : 'project';
        if (!cfg.keep && (kind === 'context' || kind === 'water')) continue;   // the game city supplies its own streets, neighbours and water
        if (kind === 'water' && cfg.dropWater) {
          for (let i = 0; i + 2 < count; i += 30) { const a = (ia ? ia[i] : i) * 3; const x = m[0] * pa[a] + m[4] * pa[a + 1] + m[8] * pa[a + 2] + m[12], y = m[1] * pa[a] + m[5] * pa[a + 1] + m[9] * pa[a + 2] + m[13]; waterArea += 1; waterY += y; }
          continue;
        }
        const g = kind === 'water' ? group('water', 'water', lin(0x6f9bb3)) : kind === 'context' ? group('context:' + (mname || 'none'), 'context', cfg.contextColor ? lin(cfg.contextColor) : mat ? mat.getBaseColorFactor().slice() : lin(0xb9bcc2)) /* keeps its own colour; the page can grey it */ : group((kind === 'ground' ? 'ground:' : 'project:') + mname, kind, mat ? mat.getBaseColorFactor().slice() : [1, 1, 1, 1]);
        if (!na) g.noNormals = true;
        const nv = P.getCount(), wp = new Float32Array(nv * 3);
        for (let v = 0; v < nv; v++) { const x = pa[v * 3], y = pa[v * 3 + 1], z = pa[v * 3 + 2]; wp[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; wp[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; wp[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]; }
        const remap = new Int32Array(nv).fill(-1); const base = g.n;
        for (let i = 0; i + 2 < count; i += 3) {
          const a = ia ? ia[i] : i, b = ia ? ia[i + 1] : i + 1, c = ia ? ia[i + 2] : i + 2;
          const ax = wp[a * 3], ay = wp[a * 3 + 1], az = wp[a * 3 + 2], bx = wp[b * 3], by = wp[b * 3 + 1], bz = wp[b * 3 + 2], qx = wp[c * 3], qy = wp[c * 3 + 1], qz = wp[c * 3 + 2];
          const mx = (ax + bx + qx) / 3, mz = (az + bz + qz) / 3;
          if (mx < rect[0] || mx > rect[2] || mz < rect[1] || mz > rect[3]) {
            // a big triangle (ground, water) that reaches into the piece is kept too and clamped to the edge below, or it leaves a hole
            const x0 = Math.min(ax, bx, qx), x1 = Math.max(ax, bx, qx), z0 = Math.min(az, bz, qz), z1 = Math.max(az, bz, qz);
            if (mask || Math.max(x1 - x0, z1 - z0) < 20 || x1 < rect[0] || x0 > rect[2] || z1 < rect[1] || z0 > rect[3]) continue;
          }
          if (mask && !mask(mx, mz)) continue;
          const ux = bx - ax, uy = by - ay, uz = bz - az, vx = qx - ax, vy = qy - ay, vz = qz - az, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, area = Math.hypot(nx, ny, nz) / 2;
          if (kind === 'water') { if (area > 0 && Math.abs(ny) / (area * 2) > .95) { const k = Math.round((ay + by + qy) / 3 * 4); whist.set(k, (whist.get(k) || 0) + area); } }
          else if (area > 0 && Math.abs(ny) / (area * 2) > .95) { const k = Math.round((ay + by + qy) / 3 * 4); hist.set(k, (hist.get(k) || 0) + area); }
          for (const v of [a, b, c]) {
            if (remap[v] < 0) { remap[v] = g.n++; g.pos.push(Math.min(rect[2], Math.max(rect[0], wp[v * 3])), wp[v * 3 + 1], Math.min(rect[3], Math.max(rect[1], wp[v * 3 + 2])));
              if (na) { const x = na[v * 3], y = na[v * 3 + 1], z = na[v * 3 + 2]; let X = m[0] * x + m[4] * y + m[8] * z, Y = m[1] * x + m[5] * y + m[9] * z, Z = m[2] * x + m[6] * y + m[10] * z; const l = Math.hypot(X, Y, Z) || 1; g.nrm.push(X / l, Y / l, Z / l); } else g.nrm.push(0, 1, 0); }
            g.idx.push(remap[v]);
          }
        }
        void base;
      }
    }
    let groundY = 0, best = 0; hist.forEach((a, k) => { if (a > best) { best = a; groundY = k / 4; } });
    // water level: the highest water surface that carries a real share of the water area (ignores the beds of water volumes)
    if (whist.size) { let mx = 0; whist.forEach(a => { if (a > mx) mx = a; }); let top = -1e9; whist.forEach((a, k) => { if (a >= mx * .3 && k / 4 > top) top = k / 4; }); waterArea = 1; waterY = top; }
    const wY = waterArea ? waterY / waterArea : null, seaBased = !!(cfg.sea && wY !== null);
    const y0 = cfg.y0 !== undefined ? cfg.y0 : seaBased ? wY : groundY;

    // rebuild the document from the gathered groups
    nodes.forEach(n => n.dispose()); root.listMeshes().forEach(m => m.dispose()); root.listTextures().forEach(t => t.dispose()); root.listMaterials().forEach(m => m.dispose());
    await doc.transform(L.fn.prune());
    const buffer = root.listBuffers()[0] || doc.createBuffer(); let tris = 0; const pb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const [key, g] of groups) {
      if (!g.idx.length) continue;
      const pos = new Float32Array(g.pos); for (let i = 0; i < pos.length; i += 3) { pos[i] -= cx; pos[i + 1] -= y0; pos[i + 2] -= cz; if (g.kind === 'project') { for (let k = 0; k < 3; k++) { pb[k] = Math.min(pb[k], pos[i + k]); pb[k + 3] = Math.max(pb[k + 3], pos[i + k]); } } }
      const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer)).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.idx)).setBuffer(buffer));
      if (g.noNormals && cfg.normals) {   // page models: area-weighted vertex normals, so the site viewer can light them without un-sharing vertices
        const nr = new Float32Array(pos.length), ix = g.idx;
        for (let i = 0; i < ix.length; i += 3) { const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, c]) { nr[k] += nx; nr[k + 1] += ny; nr[k + 2] += nz; } }
        for (let i = 0; i < nr.length; i += 3) { const l = Math.hypot(nr[i], nr[i + 1], nr[i + 2]) || 1; nr[i] /= l; nr[i + 1] /= l; nr[i + 2] /= l; }
        prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nr).setBuffer(buffer));
      }
      if (!g.noNormals) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nrm)).setBuffer(buffer));
      const c = g.color.slice(0, 3).concat(g.kind === 'project' || g.kind === 'ground' ? g.color[3] : 1);
      const mat = doc.createMaterial(key).setBaseColorFactor(c).setRoughnessFactor(.9).setMetallicFactor(0).setDoubleSided(true); if (c[3] < 1) mat.setAlphaMode('BLEND'); prim.setMaterial(mat);
      scene.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(prim))); tris += g.idx.length / 3;
    }
    const before = tris;
    if (cfg.budget && tris > cfg.budget) await doc.transform(L.fn.weld(), L.fn.simplify({ simplifier: L.mo.MeshoptSimplifier, ratio: cfg.budget / tris, error: .003 }));
    const count = () => { let t = 0; root.listMeshes().forEach(m => m.listPrimitives().forEach(p => t += p.getIndices().getCount() / 3)); return t; };
    tris = count();
    if (cfg.budget && tris > cfg.budget * 1.25) {
      // the simplifier stalls on models made of many loose parts: finish with vertex clustering on a grid sized to meet the budget (context twice as coarse)
      const prims = []; root.listMeshes().forEach(m => m.listPrimitives().forEach(p => prims.push({ p, coarse: /^(context|water)/.test(m.getName()) ? 2 : 1, pos: p.getAttribute('POSITION').getArray(), idx: p.getIndices().getArray() })));
      const cluster = (pr, cell, build) => {
        const c = cell * pr.coarse, map = new Map(), rm = new Int32Array(pr.pos.length / 3), sum = [], out = []; let n = 0;
        for (let v = 0; v < rm.length; v++) { const x = pr.pos[v * 3], y = pr.pos[v * 3 + 1], z = pr.pos[v * 3 + 2], key = Math.round(x / c) + ',' + Math.round(y / c) + ',' + Math.round(z / c); let id = map.get(key); if (id === undefined) { id = n++; map.set(key, id); if (build) sum.push(0, 0, 0, 0); } rm[v] = id; if (build) { sum[id * 4] += x; sum[id * 4 + 1] += y; sum[id * 4 + 2] += z; sum[id * 4 + 3]++; } }
        let t = 0; for (let i = 0; i < pr.idx.length; i += 3) { const a = rm[pr.idx[i]], b = rm[pr.idx[i + 1]], d = rm[pr.idx[i + 2]]; if (a === b || b === d || a === d) continue; t++; if (build) out.push(a, b, d); }
        if (!build) return t;
        const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = sum[i * 4] / sum[i * 4 + 3]; pos[i * 3 + 1] = sum[i * 4 + 1] / sum[i * 4 + 3]; pos[i * 3 + 2] = sum[i * 4 + 2] / sum[i * 4 + 3]; }
        return { pos, idx: new Uint32Array(out) };
      };
      let lo = .05, hi = 12; for (let it = 0; it < 9; it++) { const mid = Math.sqrt(lo * hi); let t = 0; prims.forEach(pr => t += cluster(pr, mid, false)); if (t > cfg.budget) lo = mid; else hi = mid; }
      prims.forEach(pr => { const r = cluster(pr, hi, true); const old = [pr.p.getAttribute('POSITION'), pr.p.getIndices(), pr.p.getAttribute('NORMAL')];
        pr.p.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(r.pos).setBuffer(buffer)).setIndices(doc.createAccessor().setType('SCALAR').setArray(r.idx).setBuffer(buffer)).setAttribute('NORMAL', null); old.forEach(a => a && a.dispose()); });
      const all = []; scene.traverse(n => all.push(n));
      all.forEach(n => { const m = n.getMesh(); if (m && m.listPrimitives().every(p => p.getIndices().getCount() === 0)) { m.listPrimitives().forEach(p => p.dispose()); m.dispose(); n.dispose(); } });
      await doc.transform(L.fn.prune());
      manifest.__cell = manifest.__cell || {}; manifest.__cell[slug] = +hi.toFixed(2); tris = count();
    }
    if (L.fn.meshopt) await doc.transform(L.fn.meshopt({ encoder: L.mo.MeshoptEncoder, level: 'medium' }));
    const bin = await io.writeBinary(doc); if (cfg.out) { fs.mkdirSync(require('path').dirname(L.ROOT + cfg.out), { recursive: true }); fs.writeFileSync(L.ROOT + cfg.out, bin); console.log(slug, '->', cfg.out, Math.round(tris), 'tris', Math.round(bin.length / 1024), 'KB, meshes', root.listMeshes().length); continue; } fs.writeFileSync(OUT + slug + '.glb', bin);
    manifest[slug] = { w: +(rect[2] - rect[0]).toFixed(1), d: +(rect[3] - rect[1]).toFixed(1), sea: seaBased, ground: +(groundY - y0).toFixed(2), tris: Math.round(tris), kb: Math.round(bin.length / 1024),
      project: pb[0] < 1e8 ? pb.map(v => +v.toFixed(1)) : null };
    console.log(slug, JSON.stringify(manifest[slug]), '| cropped', Math.round(before), '| water y', wY === null ? '-' : wY.toFixed(2), '| ground y', groundY, '|', ((Date.now() - t0) / 1000).toFixed(1) + 's');
    fs.writeFileSync(OUT + 'manifest.json', JSON.stringify(manifest, null, 1));
  }
})().catch(e => { console.error(e); process.exit(1); });

