// Shared: load a site model (plain .glb, or the base64 model-part-XX.js chunks) as a glTF-Transform document.
const fs = require('fs'), path = require('path');
const { createRequire } = require('module');
const TOOLS = 'C:/Users/herna/Documents/Codex/2026-10-17/files-mentioned-by-the-user-update/work/model-tools/';
const req = createRequire(TOOLS + 'x.js');
const core = req('@gltf-transform/core'), ext = req('@gltf-transform/extensions'), fn = req('@gltf-transform/functions');
const mo = req('meshoptimizer');
const ROOT = 'G:/My Drive/github/archiwatts-com/';

const SOURCES = {
  'hive': { glb: 'Hive/light/hive-new-light.glb' },
  'phalanstery': { glb: 'Phalanstery/light/Phalanstery-v2-light.glb' },
  'tranquil-river': { glb: 'Tranquil-River/light/Tranquil-River-v2-light.glb' },
  'net-zero-school': { glb: 'Net-Zero-School/light/Net-Zero-School-v2-light.glb' },
  'venice-apartments': { dir: 'interactive/venice-apartments' },
  'allure-waterways': { dir: 'interactive/allure-waterways' },
  'wheels-on-water': { dir: 'interactive/wheels-on-water' },
  'north-beach-youth-center': { dir: 'interactive/north-beach-youth-center' },
  'museum-of-emotions': { dir: 'interactive/museum-of-emotions' },
  'museum-study-2': { dir: 'interactive/museum-of-emotions/studies/study-2' },
  'museum-study-3': { dir: 'interactive/museum-of-emotions/studies/study-3' },
  'london-1': { glb: '_source-models/london-vertical-farm/web/ifc-version-1.glb' },   // from the IFC (batched conversion)
  'london-2': { glb: '_source-models/london-vertical-farm/web/ifc-version-2.glb' }   // from the IFC (real geometry and Revit materials)
};

async function io() {
  await mo.MeshoptDecoder.ready; await mo.MeshoptEncoder.ready; await mo.MeshoptSimplifier.ready;
  return new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': mo.MeshoptDecoder, 'meshopt.encoder': mo.MeshoptEncoder });
}
function bytes(slug) {
  const s = SOURCES[slug];
  if (s.glb) return new Uint8Array(fs.readFileSync(ROOT + s.glb));
  const dir = ROOT + s.dir + '/';
  const parts = fs.readdirSync(dir).filter(f => /^model-part-\d+\.js$/.test(f)).sort();
  const bufs = parts.map(f => { const t = fs.readFileSync(dir + f, 'latin1'); return Buffer.from(t.slice(t.indexOf('"') + 1, t.lastIndexOf('"')), 'base64'); });
  return new Uint8Array(Buffer.concat(bufs));
}
function info(slug) {
  const s = SOURCES[slug]; if (!s.dir) return null;
  const f = ROOT + s.dir + '/model-data.js'; if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, 'utf8'); const m = t.match(/projectModelInfo=(\{[\s\S]*?\});/); return m ? JSON.parse(m[1]) : null;
}
module.exports = { core, ext, fn, mo, ROOT, SOURCES, io, bytes, info };
