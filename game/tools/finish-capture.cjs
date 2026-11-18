// Turn a page capture (game/markup/<slug>-capture.glb, from page-capture.js) into the game model: weld, prune, dedup,
// meshopt-compress, write game/models/<slug>.glb and its manifest entry. Run: node finish-capture.cjs <slug> [project minX minZ maxX maxZ]
const fs = require('fs'), L = require('../../_source-models/tools/world/lib.cjs');
const ROOT = L.ROOT, slug = process.argv[2];
(async () => {
  const io = await L.io(), src = ROOT + 'game/markup/' + slug + '-capture.glb';
  const doc = await io.read(src), root = doc.getRoot(), scene = root.listScenes()[0];
  const gr = root.listNodes().find(n => n.getName() === 'game-root');
  const ra = process.argv.find(a => a.startsWith('--root='));   // keep the old model's origin, so the project stays on its plot
  if (ra) gr.setTranslation(ra.split('=')[1].split(',').map(Number));
  const t = gr.getTranslation();
  let pb = null;   // the project's own extent, from its nodes
  root.listNodes().filter(n => /^project/.test(n.getName()) && n.getMesh()).forEach(n => { const a = n.getMesh().listPrimitives()[0].getAttribute('POSITION'); const mn = a.getMin([]), mx = a.getMax([]);
    pb = pb ? [Math.min(pb[0], mn[0]), Math.min(pb[1], mn[1]), Math.min(pb[2], mn[2]), Math.max(pb[3], mx[0]), Math.max(pb[4], mx[1]), Math.max(pb[5], mx[2])] : [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]]; });
  const simp = +(process.argv.find(a => a.startsWith('--simplify=')) || '=0').split('=')[1];   // e.g. 0.002: max error as a fraction of the model size
  const steps = [L.fn.weld(), L.fn.dedup(), L.fn.prune()];
  if (simp) steps.push(L.fn.simplify({simplifier: L.mo.MeshoptSimplifier, ratio: 0, error: simp, lockBorder: true}));
  await doc.transform(...steps, L.fn.meshopt({encoder: L.mo.MeshoptEncoder, level: 'medium'}));
  const bin = await io.writeBinary(doc); fs.writeFileSync(ROOT + 'game/models/' + slug + '.glb', bin);
  const bb = L.fn.getBounds(scene), mf = ROOT + 'game/models/manifest.json', man = JSON.parse(fs.readFileSync(mf, 'utf8').replace(/^﻿/, ''));
  const tris = root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((q, p) => q + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);
  man[slug] = Object.assign({}, man[slug] || {}, { w: +(bb.max[0] - bb.min[0]).toFixed(1), d: +(bb.max[2] - bb.min[2]).toFixed(1), sea: false, ground: 0, tris: Math.round(tris), kb: Math.round(bin.length / 1024),
    project: [pb[0] + t[0], pb[1] + t[1], pb[2] + t[2], pb[3] + t[0], pb[4] + t[1], pb[5] + t[2]].map(v => +v.toFixed(1)), textures: root.listTextures().length, source: 'page capture' });
  fs.writeFileSync(mf, JSON.stringify(man, null, 1));
  console.log(slug, JSON.stringify(man[slug]));
})().catch(e => { console.error(e); process.exit(1); });
