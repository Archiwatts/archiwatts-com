"""IFC -> GLB with one mesh per real material (no lumping), for re-texturing a project from its own Revit materials.
Every face keeps the material IfcOpenShell reports for it (the element's own material when a face has none). Elements are placed in
the page's frame with a fit given as JSON: {"mx":..,"my":..,"tx":..,"tz":..,"ty":..} meaning
  page x = X - mx + tx,  page y = Z + ty,  page z = -(Y - my) + tz      (IFC metres, Z up)
Writes <out>/model.glb (meshes named "<prefix>__<material>") and <out>/elements.json (each element's GUID, class, type, level,
materials and world box).  usage: python ifc2venice.py in.ifc outdir fit.json [prefix] [x0,z0,x1,z1 crop in page metres]"""
import sys, json, os, re, struct, time, multiprocessing
import numpy as np
import ifcopenshell, ifcopenshell.geom, ifcopenshell.util.element as U

src, out, fitf = sys.argv[1], sys.argv[2], sys.argv[3]
prefix = sys.argv[4] if len(sys.argv) > 4 else 'Venice'
crop = [float(x) for x in sys.argv[5].split(',')] if len(sys.argv) > 5 else None
fit = json.load(open(fitf))
os.makedirs(out, exist_ok=True); t0 = time.time()
f = ifcopenshell.open(src)
S = ifcopenshell.geom.settings(); S.set('use-world-coords', True); S.set('mesher-linear-deflection', 0.005); S.set('mesher-angular-deflection', 0.15)
SKIP_CLS = {'IfcLightFixture', 'IfcSanitaryTerminal', 'IfcFlowTerminal', 'IfcFurniture', 'IfcElectricAppliance', 'IfcAudioVisualAppliance', 'IfcFurnishingElement'}
meta = {}; skipped = []
for e in f.by_type('IfcElement'):
    if e.is_a('IfcOpeningElement'): continue
    typ = U.get_type(e); st = U.get_container(e)
    m = {'guid': e.GlobalId, 'cls': e.is_a(), 'name': e.Name or '', 'type': (typ.Name if typ else (e.ObjectType or '')), 'level': st.Name if st else '',
         'materials': [x.Name for x in U.get_materials(e) if x.Name]}
    if e.is_a() in SKIP_CLS: m['omitted'] = True; skipped.append(m); continue
    meta[e.id()] = m
def clean(n): return re.sub(r'[^A-Za-z0-9 _\-\.,()]+', '', n or 'unnamed').strip()[:60] or 'unnamed'
it = ifcopenshell.geom.iterator(S, f, multiprocessing.cpu_count(), include=[f.by_id(i) for i in meta])
buckets, manifest, raw_lo, raw_hi = {}, [], np.full(3, 1e18), np.full(3, -1e18)
if it.initialize():
    while True:
        sh = it.get(); eid = sh.id; g = sh.geometry
        v = np.array(g.verts, dtype=np.float64).reshape(-1, 3); fc = np.array(g.faces, dtype=np.int64).reshape(-1, 3)
        if len(v) and len(fc):
            raw_lo = np.minimum(raw_lo, v.min(0)); raw_hi = np.maximum(raw_hi, v.max(0))
            P = np.stack([v[:, 0] - fit['mx'] + fit['tx'], v[:, 2] + fit['ty'], -(v[:, 1] - fit['my']) + fit['tz']], 1)
            # (x, z, -y) is a proper rotation of (x, y, z), so the triangle winding stays as IFC wrote it
            c = P.mean(0)
            if crop and not (crop[0] <= c[0] <= crop[2] and crop[1] <= c[2] <= crop[3]):
                pass
            else:
                names = [m.name for m in g.materials]; mids = np.array(g.material_ids, dtype=np.int64)
                own = meta[eid]['materials'][0] if meta[eid]['materials'] else 'unnamed'
                mats = np.array([clean(names[m]) if 0 <= m < len(names) else clean(own) for m in mids] if len(mids) == len(fc) else [clean(own)] * len(fc), dtype=object)
                _, first, remap = np.unique(np.round(P * 1000).astype(np.int64), axis=0, return_index=True, return_inverse=True)
                P = P[first]; fc = remap.reshape(-1)[fc]; ok = (fc[:, 0] != fc[:, 1]) & (fc[:, 1] != fc[:, 2]) & (fc[:, 0] != fc[:, 2]); fc = fc[ok]; mats = mats[ok]
                for mname in set(mats.tolist()):
                    sel = fc[mats == mname]; used, inv = np.unique(sel.ravel(), return_inverse=True)
                    b = buckets.setdefault(mname, {'pos': [], 'idx': [], 'n': 0, 'tri': 0})
                    b['pos'].append(P[used].astype(np.float32)); b['idx'].append((inv.reshape(-1, 3) + b['n']).astype(np.uint32))
                    m = dict(meta[eid]); m.update({'id': eid, 'mesh': mname, 'tri0': b['tri'], 'tris': int(len(sel)), 'min': P[used].min(0).round(3).tolist(), 'max': P[used].max(0).round(3).tolist()})
                    b['n'] += len(used); b['tri'] += len(sel); manifest.append(m)
        if not it.next(): break
print('raw IFC box', raw_lo.round(2).tolist(), raw_hi.round(2).tolist(), round(time.time() - t0), 's', flush=True)
bin_parts, views, accessors, meshes, nodes = [], [], [], [], []
def add(arr, target):
    data = arr.tobytes(); pad = (-len(data)) % 4
    views.append({'buffer': 0, 'byteOffset': sum(len(p) for p in bin_parts), 'byteLength': len(data), 'target': target}); bin_parts.append(data + b'\0' * pad); return len(views) - 1
for c, b in sorted(buckets.items()):
    P = np.concatenate(b['pos']); I = np.concatenate(b['idx']).ravel()
    pv = add(P, 34962); iv = add(I, 34963)
    accessors.append({'bufferView': pv, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
    accessors.append({'bufferView': iv, 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'})
    meshes.append({'name': prefix + '__' + c, 'primitives': [{'attributes': {'POSITION': len(accessors) - 2}, 'indices': len(accessors) - 1}]}); nodes.append({'name': prefix + '__' + c, 'mesh': len(meshes) - 1})
gj = {'asset': {'version': '2.0', 'generator': 'ifc2venice'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': sum(len(p) for p in bin_parts)}]}
js = json.dumps(gj, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4); bn = b''.join(bin_parts)
with open(os.path.join(out, 'model.glb'), 'wb') as fh:
    fh.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bn)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bn), b'BIN\0') + bn)
json.dump(manifest + skipped, open(os.path.join(out, 'elements.json'), 'w'), separators=(',', ':'))
print('materials', {c: b['tri'] for c, b in sorted(buckets.items(), key=lambda kv: -kv[1]['tri'])}, 'total', round(time.time() - t0), 's', flush=True)
