// Capture a project page's finished 3D scene as a GLB for the game (run inside the page, after it has loaded).
// Usage (in the page): const s = await fetch('/game/tools/page-capture.js').then(r => r.text()); eval(s);
//   await pageCapture({slug, project: /regex of the project's own mesh names/, drop: /names to leave out/, near: 85, ground: /flat ground meshes/})
// What it does: bakes every visible mesh to page coordinates (instances expanded), keeps the project whole, keeps a context
// building only when the whole building stands within `near` metres of the project (never sliced), crops flat ground to the
// project's apron, leaves water out (the game has its own sea), and wraps everything in a 'game-root' node that centres the
// project with its ground at y = 0. Materials keep their colour, roughness, metalness, opacity, vertex colours and texture.
// The GLB is POSTed to /__save (game/markup/<slug>-capture.glb); game/tools/finish-capture.cjs compresses it into game/models.
window.pageCapture = async function (opt) {
  const scene = window.daylightContext.scene; scene.updateMatrixWorld(true);
  const near = opt.near ?? 85, apron = opt.apron ?? 30;
  const items = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isSprite || !o.visible || (o.userData && (o.userData.skEdge || o.userData.noExport))) return;
    let p = o; while (p) { if (p.visible === false) return; p = p.parent; }
    if (/water/i.test(o.name) || (opt.drop && opt.drop.test(o.name))) return;
    const g = o.geometry; if (!g || !g.attributes.position || (g.drawRange && g.drawRange.count === 0)) return;
    items.push(o);
  });
  // world-space triangles per mesh (instances expanded), grouped by material slot
  const M = new o3(); function o3() { this.e = new Float32Array(16); }
  const mats = new Map(), meshes = [];
  const matId = m => { if (!mats.has(m)) mats.set(m, mats.size); return mats.get(m); };
  const pb = [1e9, 1e9, -1e9, -1e9];
  for (const o of items) {
    const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, COL = g.attributes.color, I = g.index;
    const n = o.isInstancedMesh ? o.count : 1, ml = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups && g.groups.length ? g.groups : [{start: 0, count: I ? I.count : P.count, materialIndex: 0}];
    for (let k = 0; k < n; k++) {
      const W = o.matrixWorld.clone(); if (o.isInstancedMesh) { const im = new W.constructor(); o.getMatrixAt(k, im); W.multiply(im); }
      const e = W.elements, nm = new W.constructor().copy(W).invert().transpose().elements;
      for (const gr of groups) {
        const mat = ml[gr.materialIndex || 0]; if (!mat || mat.visible === false) continue;
        const end = Math.min(gr.start + gr.count, I ? I.count : P.count), map = new Map(), pos = [], nor = [], uv = [], col = [], idx = [];
        for (let t = gr.start; t < end; t++) {
          const v = I ? I.getX(t) : t; let j = map.get(v);
          if (j === undefined) {
            j = pos.length / 3; map.set(v, j);
            const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
            pos.push(e[0]*x + e[4]*y + e[8]*z + e[12], e[1]*x + e[5]*y + e[9]*z + e[13], e[2]*x + e[6]*y + e[10]*z + e[14]);
            if (N) { const a = N.getX(v), b = N.getY(v), c = N.getZ(v); let nx = nm[0]*a + nm[4]*b + nm[8]*c, ny = nm[1]*a + nm[5]*b + nm[9]*c, nz = nm[2]*a + nm[6]*b + nm[10]*c; const l = Math.hypot(nx, ny, nz) || 1; nor.push(nx/l, ny/l, nz/l); }
            if (UV) uv.push(UV.getX(v), UV.getY(v));
            if (COL) col.push(COL.getX(v), COL.getY(v), COL.getZ(v));
          }
          idx.push(j);
        }
        if (!idx.length) continue;
        const proj = opt.project.test(o.name);
        const rec = {name: o.name + (n > 1 ? '_' + k : ''), mat: matId(mat), pos, nor: N ? nor : null, uv: UV && mat.map ? uv : null, col: COL && mat.vertexColors ? col : null, idx, proj};
        meshes.push(rec);
        if (proj && (!opt.core || opt.core.test(o.name))) for (let q = 0; q < pos.length; q += 3) { pb[0] = Math.min(pb[0], pos[q]); pb[1] = Math.min(pb[1], pos[q+2]); pb[2] = Math.max(pb[2], pos[q]); pb[3] = Math.max(pb[3], pos[q+2]); }
      }
    }
  }
  if (opt.rect) { pb[0] = opt.rect[0]; pb[1] = opt.rect[1]; pb[2] = opt.rect[2]; pb[3] = opt.rect[3]; }   // an explicit site block (page coordinates)
  const rect = [pb[0] - near, pb[1] - near, pb[2] + near, pb[3] + near], apr = [pb[0] - apron, pb[1] - apron, pb[2] + apron, pb[3] + apron];
  const inside = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
  // the ground level: the lowest flat level with a real share of up-facing area in the apron
  const hist = new Map();
  for (const m of meshes) for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t]*3, b = m.idx[t+1]*3, c = m.idx[t+2]*3, ys = [m.pos[a+1], m.pos[b+1], m.pos[c+1]];
    if (Math.max(...ys) - Math.min(...ys) > .02 || !inside(apr, m.pos[a], m.pos[a+2])) continue;
    const ar = Math.abs((m.pos[b]-m.pos[a])*(m.pos[c+2]-m.pos[a+2]) - (m.pos[c]-m.pos[a])*(m.pos[b+2]-m.pos[a+2])) / 2, kk = Math.round(ys[0]*4);
    hist.set(kk, (hist.get(kk) || 0) + ar);
  }
  let best = 0; hist.forEach(v => { best = Math.max(best, v); }); let y0 = 1e9; hist.forEach((v, k) => { if (v >= best * .05 && k/4 < y0) y0 = k/4; });
  if (opt.y0 !== undefined) y0 = opt.y0;
  // flat ground crossing the crop line is clipped exactly to it (straight, clean edges), not dropped triangle by triangle
  function clipFlat(m, t, r, keep) {
    const ia = [m.idx[t], m.idx[t+1], m.idx[t+2]], V = ia.map(i => [m.pos[i*3], m.pos[i*3+1], m.pos[i*3+2], i]);
    const ny = (() => { const a = V[0], b = V[1], c = V[2], ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2], nx = uy*vz - uz*vy, nyy = uz*vx - ux*vz, nz = ux*vy - uy*vx; return Math.abs(nyy) / (Math.hypot(nx, nyy, nz) || 1); })();
    const ins = V.map(v => inside(r, v[0], v[2]));
    if (ins.every(Boolean)) { keep.push(...ia); return; }
    if (ny < .9) { const cx = (V[0][0] + V[1][0] + V[2][0]) / 3, cz = (V[0][2] + V[1][2] + V[2][2]) / 3; if (inside(r, cx, cz)) keep.push(...ia); return; }
    let poly = V.map(v => ({p: v.slice(0, 3), i: v[3]}));
    const edges = [[0, r[0], 1], [0, r[2], -1], [2, r[1], 1], [2, r[3], -1]];
    for (const [ax, lim, sg] of edges) {
      const o2 = []; for (let k = 0; k < poly.length; k++) { const A = poly[k], B = poly[(k + 1) % poly.length], ia2 = (A.p[ax] - lim) * sg >= 0, ib = (B.p[ax] - lim) * sg >= 0;
        if (ia2) o2.push(A); if (ia2 !== ib) { const tt = (lim - A.p[ax]) / (B.p[ax] - A.p[ax]); o2.push({p: [0, 1, 2].map(q => A.p[q] + (B.p[q] - A.p[q]) * tt), i: -1, A, B, tt}); } }
      poly = o2; if (poly.length < 3) return; }
    const id = poly.map(q => { if (q.i >= 0) return q.i; const j = m.pos.length / 3; m.pos.push(...q.p);
      const lerp = (arr, w) => { if (!arr) return; for (let c = 0; c < w; c++) arr.push(arr[(q.A.i >= 0 ? q.A.i : 0)*w + c]); };
      if (m.nor) { m.nor.push(0, 1, 0); } if (m.uv) lerp(m.uv, 2); if (m.col) lerp(m.col, 3); return j; });
    for (let k = 1; k + 1 < id.length; k++) keep.push(id[0], id[k], id[k+1]);
  }
  // context: split into buildings (connected pieces); keep whole pieces near the project; flat ground is cropped to the apron
  const out = [];
  for (const m of meshes) {
    if (m.proj && !opt.core) { out.push(m); continue; }
    if (m.proj) {   // with a core: the building whole, its other site parts cropped to the apron
      const keep = []; for (let t = 0; t < m.idx.length; t += 3) clipFlat(m, t, apr, keep);
      if (keep.length) out.push({...m, idx: keep}); continue; }
    const nv = m.pos.length / 3, par = new Int32Array(nv).map((_, i) => i), f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const key = new Map(); for (let i = 0; i < nv; i++) { const kk = Math.round(m.pos[i*3]*50) + ',' + Math.round(m.pos[i*3+1]*50) + ',' + Math.round(m.pos[i*3+2]*50); const r0 = key.get(kk); if (r0 === undefined) key.set(kk, i); else par[f(i)] = f(r0); }
    for (let t = 0; t < m.idx.length; t += 3) { const a = f(m.idx[t]), b = f(m.idx[t+1]), c = f(m.idx[t+2]); par[b] = a; par[f(c)] = a; }
    const box = new Map(); for (let i = 0; i < nv; i++) { const r = f(i); const b = box.get(r) || [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; b[0] = Math.min(b[0], m.pos[i*3]); b[1] = Math.min(b[1], m.pos[i*3+1]); b[2] = Math.min(b[2], m.pos[i*3+2]); b[3] = Math.max(b[3], m.pos[i*3]); b[4] = Math.max(b[4], m.pos[i*3+1]); b[5] = Math.max(b[5], m.pos[i*3+2]); box.set(r, b); }
    const keep = [];
    for (let t = 0; t < m.idx.length; t += 3) {
      const r = f(m.idx[t]), b = box.get(r), flat = b[4] - b[1] < 1.2 && (b[3] - b[0] > 60 || b[5] - b[2] > 60);   // a big flat piece is ground
      if (flat) clipFlat(m, t, apr, keep);
      else if (b[0] >= rect[0] && b[3] <= rect[2] && b[2] >= rect[1] && b[5] <= rect[3]) keep.push(m.idx[t], m.idx[t+1], m.idx[t+2]);   // a whole building inside the reach
    }
    if (keep.length) out.push({...m, idx: keep});
  }
  // GLB
  const cx = (pb[0] + pb[2]) / 2, cz = (pb[1] + pb[3]) / 2;
  const chunks = [], views = [], accs = [], gm = [], nodes = [], meshesJ = [], imgs = [], texs = [], samplers = [{magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497}];
  let off = 0; const push = (arr, target) => { const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.byteLength % 4)) % 4; chunks.push(b); if (pad) chunks.push(new Uint8Array(pad)); views.push({buffer: 0, byteOffset: off, byteLength: b.byteLength, ...(target ? {target} : {})}); off += b.byteLength + pad; return views.length - 1; };
  const lin = c => c; // three keeps colours linear already
  for (const [mat, id] of mats) {
    const c = mat.color ? [lin(mat.color.r), lin(mat.color.g), lin(mat.color.b)] : [1, 1, 1];
    const J = {name: mat.name || ('m' + id), pbrMetallicRoughness: {baseColorFactor: [...c, mat.transparent ? (mat.opacity ?? 1) : 1], metallicFactor: mat.metalness ?? 0, roughnessFactor: mat.roughness ?? .9}, doubleSided: true};
    if (mat.transparent && (mat.opacity ?? 1) < .99) J.alphaMode = 'BLEND';
    if (mat.map && mat.map.image && (mat.map.image.width || mat.map.image.videoWidth)) {
      try { const im = mat.map.image, cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0);
        const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const buf = new Uint8Array(await blob.arrayBuffer());
        imgs.push({bufferView: push(buf), mimeType: 'image/png'}); texs.push({source: imgs.length - 1, sampler: 0}); J.pbrMetallicRoughness.baseColorTexture = {index: texs.length - 1}; } catch (e) { console.warn('texture skipped', mat.name, e); }
    }
    gm[id] = J;
  }
  for (const m of out) {
    // re-index the kept triangles
    const remap = new Map(), P = [], Nn = [], U = [], Cc = [], Ix = [];
    for (const v of m.idx) { let j = remap.get(v); if (j === undefined) { j = P.length / 3; remap.set(v, j); P.push(m.pos[v*3], m.pos[v*3+1], m.pos[v*3+2]); if (m.nor) Nn.push(m.nor[v*3], m.nor[v*3+1], m.nor[v*3+2]); if (m.uv) U.push(m.uv[v*2], m.uv[v*2+1]); if (m.col) Cc.push(m.col[v*3], m.col[v*3+1], m.col[v*3+2]); } Ix.push(j); }
    const pa = new Float32Array(P), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < pa.length; i += 3) for (let q = 0; q < 3; q++) { mn[q] = Math.min(mn[q], pa[i+q]); mx[q] = Math.max(mx[q], pa[i+q]); }
    const attrs = {POSITION: accs.push({bufferView: push(pa, 34962), componentType: 5126, count: pa.length/3, type: 'VEC3', min: mn, max: mx}) - 1};
    if (Nn.length) attrs.NORMAL = accs.push({bufferView: push(new Float32Array(Nn), 34962), componentType: 5126, count: pa.length/3, type: 'VEC3'}) - 1;
    if (U.length) attrs.TEXCOORD_0 = accs.push({bufferView: push(new Float32Array(U), 34962), componentType: 5126, count: pa.length/3, type: 'VEC2'}) - 1;
    if (Cc.length) attrs.COLOR_0 = accs.push({bufferView: push(new Float32Array(Cc), 34962), componentType: 5126, count: pa.length/3, type: 'VEC3'}) - 1;
    const ind = accs.push({bufferView: push(new Uint32Array(Ix), 34963), componentType: 5125, count: Ix.length, type: 'SCALAR'}) - 1;
    meshesJ.push({name: m.name, primitives: [{attributes: attrs, indices: ind, material: m.mat}]});
    nodes.push({name: (m.proj ? 'project' : 'context') + m.name, mesh: meshesJ.length - 1});
  }
  const kids = nodes.map((_, i) => i); nodes.push({name: 'game-root', translation: [-cx, -y0, -cz], children: kids});
  const json = {asset: {version: '2.0', generator: 'archiwatts page-capture'}, scene: 0, scenes: [{nodes: [nodes.length - 1]}], nodes, meshes: meshesJ, materials: gm, accessors: accs, bufferViews: views, buffers: [{byteLength: off}]};
  if (imgs.length) Object.assign(json, {images: imgs, textures: texs, samplers});
  const js = new TextEncoder().encode(JSON.stringify(json)), jp = (4 - js.length % 4) % 4, jlen = js.length + jp;
  const total = 12 + 8 + jlen + 8 + off, glb = new Uint8Array(total), dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jlen, true); dv.setUint32(16, 0x4E4F534A, true); glb.set(js, 20); for (let i = 0; i < jp; i++) glb[20 + js.length + i] = 0x20;
  let o2 = 20 + jlen; dv.setUint32(o2, off, true); dv.setUint32(o2 + 4, 0x004E4942, true); o2 += 8; for (const c of chunks) { glb.set(c, o2); o2 += c.byteLength; }
  const r = await fetch('/__save?name=' + opt.slug + '-capture.glb', {method: 'POST', body: glb});
  const tris = out.reduce((s, m) => s + m.idx.length / 3, 0);
  return {saved: await r.text(), mb: +(total / 1048576).toFixed(1), meshes: out.length, tris, y0, project: pb.map(v => +v.toFixed(1)), centre: [cx, cz], materials: mats.size, textures: imgs.length};
};
