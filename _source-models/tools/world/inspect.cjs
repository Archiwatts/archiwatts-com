const L = require('./lib.cjs');
(async () => {
  const io = await L.io();
  for (const slug of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(L.SOURCES)) {
    try {
      const doc = await io.readBinary(L.bytes(slug)); const root = doc.getRoot(), scene = root.listScenes()[0];
      const b = L.fn.getBounds(scene); let tris = 0;
      root.listMeshes().forEach(m => m.listPrimitives().forEach(p => { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }));
      console.log('\n## ' + slug, '| tris', Math.round(tris), '| meshes', root.listMeshes().length, '| textures', root.listTextures().length);
      console.log('  min', b.min.map(v => +v.toFixed(1)).join(','), ' max', b.max.map(v => +v.toFixed(1)).join(','), ' size', b.max.map((v, i) => +(v - b.min[i]).toFixed(1)).join(' x '));
      const walk = (n, d) => { if (d > 2) return; const nb = L.fn.getBounds(n); console.log('  ' + '  '.repeat(d) + (n.getName() || '(unnamed)') + '  s=' + n.getScale().map(v => +v.toFixed(4)).join(',') + '  size ' + nb.max.map((v, i) => +(v - nb.min[i]).toFixed(1)).join('x') + (n.getMesh() ? '  [mesh ' + n.getMesh().listPrimitives().length + ' prims]' : '')); n.listChildren().slice(0, 14).forEach(c => walk(c, d + 1)); if (n.listChildren().length > 14) console.log('  ' + '  '.repeat(d + 1) + '... +' + (n.listChildren().length - 14)); };
      scene.listChildren().forEach(n => walk(n, 0));
      console.log('  materials:', root.listMaterials().map(m => m.getName()).slice(0, 24).join(' | '));
      const inf = L.info(slug); if (inf) console.log('  info: scale', inf.scale, 'dims', inf.dimensions.map(v => +v.toFixed(1)).join(','), 'focus', JSON.stringify(inf.focusBounds || null));
    } catch (e) { console.log('\n## ' + slug + ' FAILED: ' + e.message); }
  }
})();
