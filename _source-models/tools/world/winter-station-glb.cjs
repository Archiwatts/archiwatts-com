// Winter Station 2027: its page builds the pavilion in the browser (meshes + 1944 instanced tubes). The page scene was exported
// as a raw bundle (winter-station.bin: u32 header length, JSON [{color, rough, metal, opacity, pos, idx, inst}], then arrays).
// This turns it into a meshopt GLB for the game: meshes simplified, the tubes kept as GPU instances of one simplified tube.
// Run: node winter-station-glb.cjs <bundle.bin>
const fs = require('fs'), L = require('./lib.cjs');
(async () => {
  const io = await L.io(), raw = fs.readFileSync(process.argv[2]), hl = raw.readUInt32LE(0), metas = JSON.parse(raw.slice(4, 4 + hl).toString('utf8')), base = 4 + hl;
  const F32 = ([o, n]) => new Float32Array(raw.buffer.slice(raw.byteOffset + base + o, raw.byteOffset + base + o + n*4));
  const U32 = ([o, n]) => new Uint32Array(raw.buffer.slice(raw.byteOffset + base + o, raw.byteOffset + base + o + n*4));
  const doc = new L.core.Document(), buf = doc.createBuffer(), scene = doc.createScene(), inst = doc.createExtension(L.ext.EXTMeshGPUInstancing).setRequired(true);
  const lin = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255].map(c => { c /= 255; return c <= .04045 ? c/12.92 : Math.pow((c + .055)/1.055, 2.4); });
  const S = L.mo.MeshoptSimplifier; let tris = 0;
  const simplify = (pos, idx, ratio) => { if (ratio >= 1 || idx.length < 600) return idx; const target = Math.max(36, Math.floor(idx.length*ratio/3)*3);
    const [out] = S.simplify(idx, pos, 3, target, .02, ['LockBorder']); return out.length ? out : idx; };
  metas.forEach((m, k) => {
    const pos = F32(m.pos); let idx = m.idx ? U32(m.idx) : Uint32Array.from({length:pos.length/3}, (_, i) => i);
    idx = simplify(pos, idx, m.inst ? .2 : .3);
    const mat = doc.createMaterial('ws-' + k).setBaseColorFactor([...lin(m.color), m.opacity]).setRoughnessFactor(m.rough ?? .8).setMetallicFactor(m.metal || 0).setDoubleSided(true);
    if (m.opacity < 1) mat.setAlphaMode('BLEND');
    const prim = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf)).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf));
    const node = doc.createNode('ws-' + k).setMesh(doc.createMesh('ws-' + k).addPrimitive(prim)); scene.addChild(node);
    if (m.inst){ const M = F32(m.inst), n = M.length/16, T = new Float32Array(n*3), R = new Float32Array(n*4), Sc = new Float32Array(n*3);
      for (let i = 0; i < n; i++){ const e = M.subarray(i*16, i*16 + 16), sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
        T.set([e[12], e[13], e[14]], i*3); Sc.set([sx, sy, sz], i*3);
        const m00 = e[0]/sx, m10 = e[1]/sx, m20 = e[2]/sx, m01 = e[4]/sy, m11 = e[5]/sy, m21 = e[6]/sy, m02 = e[8]/sz, m12 = e[9]/sz, m22 = e[10]/sz, tr = m00 + m11 + m22; let x, y, z, w;
        if (tr > 0){ const s = .5/Math.sqrt(tr + 1); w = .25/s; x = (m21 - m12)*s; y = (m02 - m20)*s; z = (m10 - m01)*s; }
        else if (m00 > m11 && m00 > m22){ const s = 2*Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12)/s; x = .25*s; y = (m01 + m10)/s; z = (m02 + m20)/s; }
        else if (m11 > m22){ const s = 2*Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20)/s; x = (m01 + m10)/s; y = .25*s; z = (m12 + m21)/s; }
        else { const s = 2*Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01)/s; x = (m02 + m20)/s; y = (m12 + m21)/s; z = .25*s; }
        R.set([x, y, z, w], i*4); }
      node.setExtension('EXT_mesh_gpu_instancing', inst.createInstancedMesh()
        .setAttribute('TRANSLATION', doc.createAccessor().setType('VEC3').setArray(T).setBuffer(buf))
        .setAttribute('ROTATION', doc.createAccessor().setType('VEC4').setArray(R).setBuffer(buf))
        .setAttribute('SCALE', doc.createAccessor().setType('VEC3').setArray(Sc).setBuffer(buf)));
      tris += idx.length/3*n; } else tris += idx.length/3;
  });
  await doc.transform(L.fn.weld(), L.fn.meshopt({encoder: L.mo.MeshoptEncoder, level: 'medium'}));
  const out = L.ROOT + '_source-models/winter-station/winter-station.glb'; fs.mkdirSync(require('path').dirname(out), {recursive: true});
  const bin = await io.writeBinary(doc); fs.writeFileSync(out, bin); console.log('winter station', Math.round(tris), 'tris drawn,', Math.round(bin.length/1024), 'KB');
})().catch(e => { console.error(e); process.exit(1); });
