// Game models at page fidelity: the same model each 3D project page uses, with its own materials and textures and its full
// geometry (no simplification). Only the site context and water are removed, the ground is cropped to a tight apron around
// the building, and where a source has no real materials (the London IFCs) they are set from the project renders.
// Output: game/models/<slug>.glb + manifest.json (ground at y = 0, centred on the building). Run: node build-game2.cjs [slug ...]
const fs = require('fs'), L = require('./lib.cjs');
const OUT = L.ROOT + 'game/models/';
Object.assign(L.SOURCES, {
  'net-zero-school': { glb: 'Net-Zero-School/light/Net-Zero-School-v2-detail.glb' },
  'tranquil-river': { glb: 'Tranquil-River/light/Tranquil-River-v2-detail.glb' },
  'north-beach-youth-center': { glb: '_source-models/north-beach-youth-center/out/model.glb' },
  'london-1': { glb: 'interactive/london-vertical-farm-v1/model.glb' },
  'london-2': { glb: 'interactive/london-vertical-farm-v2/model.glb' }
});
const WATER = /water/i, CONTEXT = /context|team buildings/i, GROUND = /landscape|field|road|paving|terrain|ground|paths|site_line|bank|spring_bed|planting/i;
// London: material names are Revit/IFC names with no colour; set from the renders (white concrete shell, timber floors as accent,
// green roofs on the metal-plate bases, vertical gardens, dark aluminium, clear glass)
const LONDON = [
  [/CLT Wood\(FLOOR\)|Default Floor|IfcSlab|Floor/i, 'LV timber floor', 0xc89a63, .7, 0],
  [/metail plate|green roof|planter/i, 'LV green roof', 0x5f8a3c, .95, 0],
  [/vert garm/i, 'LV vertical garden', 0x4e7f39, .9, 0],
  [/Aluminom|Aluminum|Steel|IfcRailing|IfcMember|Wire|PVC|Rubber/i, 'LV dark metal', 0x2c2e31, .4, .6],
  [/Glass|Glazing/i, 'LV glass', 0xa9cad6, .05, .1, .32],
  [/Dock--wood/i, 'LV dock timber', 0x8a6a48, .8, 0],
  [/Door/i, 'LV door', 0x6b4b2a, .6, 0],
  [/CLT Wood|stuc|trim|Gypsum|Wall|Default/i, 'LV white concrete', 0xece6dc, .85, 0]
];
// Youth Center (IFC conversion, no colours): from its drawings, white plaster bands, glazing, a perforated metal screen
const NBYC = [
  [/Glazing/i, 'YC glass', 0xa9cad6, .05, .1, .35], [/Plaster/i, 'YC white plaster', 0xf2eee6, .85, 0], [/ScreenPanel/i, 'YC perforated screen', 0xb8bcc0, .45, .7],
  [/Stone/i, 'YC stone', 0xd8cdb8, .9, 0], [/Metal/i, 'YC dark metal', 0x2e3134, .4, .6], [/Timber/i, 'YC timber', 0xa77a4f, .7, 0],
  [/Planting/i, 'YC planting', 0x557f3c, .95, 0], [/Other/i, 'YC light concrete', 0xd9d6cf, .9, 0]
];
const CFG = {
  'hive': { rect: [-205, -85, 268, 232], tight: 14 },
  'net-zero-school': { rect: [8, -420, 400, 75], tight: 10 },
  'tranquil-river': { tight: 8, y0: 0 },
  'north-beach-youth-center': { around: /Youth_center__(Glazing|Plaster|ScreenPanel|Timber)/, tight: 8, y0: 34.5, minY: 30, mats: NBYC },
  'museum-of-emotions': { drop: /Landscape|Paths/, asGround: /Stone/, tight: 8 },   // inset: the building without its circular site
  'museum-study-2': { around: /(Plaster|Dark timber)/, margin: 90, tight: 8 },
  'museum-study-3': { around: /(Warm plaster|Stone|Metal)/, margin: 60, tight: 8, y0: 11.75 },
  'london-1': { tight: 10, mats: LONDON },
  'london-2': { around: /Glass walls|Aluminum|Default Floor/, tight: 18, mats: LONDON }
};
const lin = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255].map(c => { c /= 255; return c <= .04045 ? c/12.92 : Math.pow((c + .055)/1.055, 2.4); });

(async () => {
  const io = await L.io(); fs.mkdirSync(OUT, {recursive: true});
  const manifest = fs.existsSync(OUT + 'manifest.json') ? JSON.parse(fs.readFileSync(OUT + 'manifest.json', 'utf8').replace(/^﻿/, '')) : {};
  for (const slug of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CFG)){
    const cfg = CFG[slug], t0 = Date.now(), doc = await io.readBinary(L.bytes(slug)); await doc.transform(L.fn.dequantize());
    const root = doc.getRoot(), scene = root.listScenes()[0], items = [];
    scene.traverse(n => { const mesh = n.getMesh(); if (!mesh) return; const path = []; for (let p = n; p && p.getName; p = p.getParentNode ? p.getParentNode() : null) path.push(p.getName());
      mesh.listPrimitives().forEach(prim => { const mat = prim.getMaterial(), label = path.join(' / ') + ' / ' + (mat ? mat.getName() : '');
        const kind = cfg.drop && cfg.drop.test(label) ? 'drop' : WATER.test(label) ? 'water' : CONTEXT.test(label) ? 'context' : (cfg.asGround && cfg.asGround.test(label)) || GROUND.test(label) ? 'ground' : 'project';
        items.push({n, prim, kind, label, m: n.getWorldMatrix()}); }); });
    const X = (m, a, i) => m[0]*a[i] + m[4]*a[i+1] + m[8]*a[i+2] + m[12], Yy = (m, a, i) => m[1]*a[i] + m[5]*a[i+1] + m[9]*a[i+2] + m[13], Z = (m, a, i) => m[2]*a[i] + m[6]*a[i+1] + m[10]*a[i+2] + m[14];
    // the building's footprint: its own parts (inside the search area, if one is given)
    let area = cfg.rect || null;
    if (cfg.around){ let b = null; items.filter(it => cfg.around.test(it.label)).forEach(it => { const a = it.prim.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3){ const x = X(it.m, a, i), z = Z(it.m, a, i); b = b ? [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)] : [x, z, x, z]; } }); area = b; }
    if (area && cfg.margin) area = [area[0] - cfg.margin, area[1] - cfg.margin, area[2] + cfg.margin, area[3] + cfg.margin];
    const pb = [1e9, 1e9, -1e9, -1e9];
    items.filter(it => it.kind === 'project').forEach(it => { const a = it.prim.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3){ const x = X(it.m, a, i), z = Z(it.m, a, i);
      if (area && (x < area[0] || x > area[2] || z < area[1] || z > area[3])) continue; pb[0] = Math.min(pb[0], x); pb[1] = Math.min(pb[1], z); pb[2] = Math.max(pb[2], x); pb[3] = Math.max(pb[3], z); } });
    const rect = [pb[0] - cfg.tight, pb[1] - cfg.tight, pb[2] + cfg.tight, pb[3] + cfg.tight], inR = (x, z) => x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3];
    // remove context, water and dropped parts; crop ground (and project parts outside the area) to the apron, triangle by triangle
    const hist = new Map(); let kept = 0;
    for (const it of items){
      if (it.kind === 'drop' || it.kind === 'context' || it.kind === 'water'){ it.prim.dispose(); continue; }
      const a = it.prim.getAttribute('POSITION').getArray(), I = it.prim.getIndices(), ia = I ? I.getArray() : null, cnt = ia ? ia.length : a.length/3, out = [];
      for (let t = 0; t + 2 < cnt; t += 3){ const v = [0, 1, 2].map(k => (ia ? ia[t + k] : t + k)*3), cx = (X(it.m, a, v[0]) + X(it.m, a, v[1]) + X(it.m, a, v[2]))/3, cz = (Z(it.m, a, v[0]) + Z(it.m, a, v[1]) + Z(it.m, a, v[2]))/3;
        if (!inR(cx, cz)) continue;
        if (cfg.minY !== undefined && Math.max(Yy(it.m, a, v[0]), Yy(it.m, a, v[1]), Yy(it.m, a, v[2])) < cfg.minY) continue;   // stray parts far below the building
        out.push(ia ? ia[t] : t, ia ? ia[t+1] : t+1, ia ? ia[t+2] : t+2);
        const ys = v.map(k => Yy(it.m, a, k)); if (Math.max(...ys) - Math.min(...ys) < .02){ const k = Math.round(ys[0]*4); hist.set(k, (hist.get(k) || 0) + 1); } }
      if (!out.length){ it.prim.dispose(); continue; }
      if (out.length !== cnt){ const big = a.length/3 > 65535; it.prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(big ? new Uint32Array(out) : new Uint16Array(out)).setBuffer(root.listBuffers()[0])); }
      kept += out.length/3;
      if (cfg.mats){ const mat = it.prim.getMaterial(), name = mat ? mat.getName() : '', rule = cfg.mats.find(r => r[0].test(name)) || cfg.mats.find(r => r[0].test(it.label));
        if (rule){ let nm = root.listMaterials().find(m => m.getName() === rule[1]);
          if (!nm){ nm = doc.createMaterial(rule[1]).setBaseColorFactor([...lin(rule[2]), rule[5] ?? 1]).setRoughnessFactor(rule[3]).setMetallicFactor(rule[4]).setDoubleSided(true); if (rule[5] !== undefined) nm.setAlphaMode('BLEND'); }
          it.prim.setMaterial(nm); } } }
    let best = 0; hist.forEach(c => { if (c > best) best = c; }); let y0 = 1e9; hist.forEach((c, k) => { if (c >= best*.05 && k/4 < y0) y0 = k/4; });   // ground: the lowest flat level with a real share of flat surface (not a roof)
    if (cfg.y0 !== undefined) y0 = cfg.y0;
    const cx = (rect[0] + rect[2])/2, cz = (rect[1] + rect[3])/2, wrap = doc.createNode('game-root').setTranslation([-cx, -y0, -cz]);
    scene.listChildren().forEach(c => { if (c !== wrap){ scene.removeChild(c); wrap.addChild(c); } }); scene.addChild(wrap);
    root.listMeshes().forEach(m => { if (!m.listPrimitives().length) m.dispose(); });
    await doc.transform(L.fn.prune(), L.fn.dedup(), L.fn.meshopt({encoder: L.mo.MeshoptEncoder, level: 'medium'}));
    const bin = await io.writeBinary(doc); fs.writeFileSync(OUT + slug + '.glb', bin);
    const h = (pb[3] < 1e8) ? null : null; void h;
    const bb = L.fn.getBounds(scene);
    manifest[slug] = { w: +(rect[2] - rect[0]).toFixed(1), d: +(rect[3] - rect[1]).toFixed(1), sea: false, ground: 0, tris: Math.round(kept), kb: Math.round(bin.length/1024),
      project: [pb[0] - cx, bb.min[1], pb[1] - cz, pb[2] - cx, bb.max[1], pb[3] - cz].map(v => +v.toFixed(1)), textures: root.listTextures().length };
    console.log(slug, JSON.stringify(manifest[slug]), 'y0', y0, ((Date.now() - t0)/1000).toFixed(1) + 's', 'mats:', root.listMaterials().map(m => m.getName()).slice(0, 14).join(' | '));
    fs.writeFileSync(OUT + 'manifest.json', JSON.stringify(manifest, null, 1));
  }
})().catch(e => { console.error(e); process.exit(1); });
