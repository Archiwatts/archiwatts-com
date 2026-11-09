"""IFC -> compact GLB + element manifest.
One mesh per site category (Stone, Metal, Plaster, Timber, Glazing, Planting, Water, Landscape, Other); every element's triangles are a
contiguous range, listed in the manifest with its IFC GUID, class, type, material and level, so any piece of geometry can be traced back to
the Revit element it came from.  Usage: python ifc2glb.py in.ifc outdir"""
import sys, json, os, re, struct, time, multiprocessing
import numpy as np
import ifcopenshell, ifcopenshell.geom, ifcopenshell.util.element as U

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
t0 = time.time()
f = ifcopenshell.open(src)
S = ifcopenshell.geom.settings()
S.set('use-world-coords', True)
S.set('mesher-linear-deflection', 0.01)
S.set('mesher-angular-deflection', 0.2)

RULES = [('Glazing', r'glass|glaz|window|acrylic'), ('Water', r'water|pool'), ('Planting', r'grass|plant|tree|leaf|shrub|soil|dirt|mulch|lawn'),
         ('Timber', r'wood|teak|timber|larch|walnut|oak|cabinet|bamboo|ply'), ('Metal', r'steel|alum|metal|iron|chrome|stainless|galv|brass|copper|sprinkler|zinc|alloy|solar|spider|frame'),
         ('Stone', r'concrete|gfrc|cast|stone|granite|marble|brick|masonry|asphalt|paving|tile|ceramic|porcelain|parking|road|stripe|\bcon\b'),
         ('Plaster', r'white|plaster|gyp|paint|wall|default|plastic|drywall|stucco')]
def cat_of(name):
    n = (name or '').lower()
    for c, rx in RULES:
        if re.search(rx, n):
            return c
    return 'Other'

import fast_simplification as FS
# too heavy for a web page and not architecture: fixtures, plumbing, furniture, vehicles, solar kit, sprinklers (still listed in the manifest)
SKIP_CLS = {'IfcLightFixture', 'IfcSanitaryTerminal', 'IfcFlowTerminal', 'IfcFurniture', 'IfcElectricAppliance', 'IfcAudioVisualAppliance'}
SKIP_TYPE = re.compile(r'car|truck|bus|wrecker|sunfix|sprinkler|sink|urinal|shower|stall|changing|grab_bar|lectern|tennis|gymnastic|judo|elevator rail', re.I)
meta, emats, skipped = {}, {}, []
for e in f.by_type('IfcElement'):
    if e.is_a('IfcOpeningElement'):
        continue
    typ = U.get_type(e); st = U.get_container(e)
    m = {'guid': e.GlobalId, 'cls': e.is_a(), 'name': e.Name or '', 'type': (typ.Name if typ else (e.ObjectType or '')), 'level': st.Name if st else ''}
    if e.is_a() in SKIP_CLS or SKIP_TYPE.search(m['type'] or ''):
        m['omitted'] = True; skipped.append(m); continue
    meta[e.id()] = m
    emats[e.id()] = [x.Name for x in U.get_materials(e) if x.Name]
it = ifcopenshell.geom.iterator(S, f, multiprocessing.cpu_count(), include=[f.by_id(i) for i in meta])
buckets = {}      # cat -> {'pos': [], 'idx': [], 'n': vertex count, 'tri': triangle count}
manifest = []
count = 0
if it.initialize():
    while True:
        sh = it.get()
        eid = sh.id; g = sh.geometry
        v = np.array(g.verts, dtype=np.float64).reshape(-1, 3)
        fc = np.array(g.faces, dtype=np.int64).reshape(-1, 3)
        if len(v) and len(fc):
            mids = np.array(g.material_ids, dtype=np.int64)
            names = [m.name for m in g.materials]
            clear = [(getattr(m, 'transparency', 0) or 0) > .05 for m in g.materials]
            tname = meta.get(eid, {}).get('type', '')
            solid = [x for x in emats.get(eid, []) if cat_of(x) != 'Glazing']
            base = 'ScreenPanel' if 'parametric_screen' in tname else (next((cat_of(x) for x in solid if cat_of(x) != 'Other'), 'Other') if solid else ('Glazing' if emats.get(eid) else 'Other'))
            if not len(mids):
                cats = np.array([base] * len(fc), dtype=object)
            else:
                cats = np.array([('Glazing' if (0 <= m < len(names) and clear[m]) else base) for m in mids], dtype=object)
                if base == 'Glazing' or (not solid and emats.get(eid)):
                    cats[:] = 'Glazing'
            # IFC is Z-up (metres); glTF is Y-up: (x, z, -y)
            v = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
            # into the site viewer's frame (matched on the pod and east funnel centres): a quarter turn plus offset
            v = np.stack([-v[:, 2] - 76.7, v[:, 1] + 34.6, v[:, 0] + 53.4], 1)
            # (both turns above are proper rotations, so the triangle winding stays as IFC wrote it)
            # weld: the IFC mesher splits vertices per face; join coincident ones (1 mm) so meshes can be simplified and stay small
            _, first, remap = np.unique(np.round(v * 1000).astype(np.int64), axis=0, return_index=True, return_inverse=True)
            v = v[first]; fc = remap.reshape(-1)[fc]
            keep = (fc[:, 0] != fc[:, 1]) & (fc[:, 1] != fc[:, 2]) & (fc[:, 0] != fc[:, 2])
            fc = fc[keep]
            cats = cats[keep]
            if len(mids) == len(keep): mids = mids[keep]
            for c in set(cats.tolist()):
                sel = fc[cats == c]
                if len(sel) > 30000:    # only the pathological imported meshes get simplified; real elements keep full detail
                    try:
                        u0, i0 = np.unique(sel.ravel(), return_inverse=True)
                        pv2, fv2 = FS.simplify(v[u0].astype(np.float32), i0.reshape(-1, 3).astype(np.int32), target_reduction=(0.9 if len(sel) > 100000 else 0.6), agg=5)
                        # imported meshes (a spiral railing, odd column families) barely simplify: snap them to a coarser grid until small
                        cell = .02
                        while len(fv2) > 20000 and cell < 1:
                            _, f3, r3 = np.unique(np.round(pv2 / cell).astype(np.int64), axis=0, return_index=True, return_inverse=True)
                            ff = r3.reshape(-1)[fv2]; ok = (ff[:, 0] != ff[:, 1]) & (ff[:, 1] != ff[:, 2]) & (ff[:, 0] != ff[:, 2]); ff = np.unique(np.sort(ff[ok], 1), axis=0) if False else ff[ok]
                            pv2, fv2 = pv2[f3], ff; cell *= 2
                        if len(fv2) > 12:
                            sel = fv2.astype(np.int64); vv = pv2.astype(np.float64)
                            b = buckets.setdefault(c, {'pos': [], 'idx': [], 'n': 0, 'tri': 0})
                            b['pos'].append(vv.astype(np.float32)); b['idx'].append((sel + b['n']).astype(np.uint32))
                            m = dict(meta.get(eid, {})); m.update({'id': eid, 'cat': c, 'tri0': b['tri'], 'tris': int(len(sel)), 'materials': emats.get(eid, [])})
                            b['n'] += len(vv); b['tri'] += len(sel); manifest.append(m); continue
                    except Exception as ex:
                        print('simplify failed', eid, len(sel), repr(ex)[:120], flush=True)
                b =buckets.setdefault(c, {'pos': [], 'idx': [], 'n': 0, 'tri': 0})
                used, inv = np.unique(sel.ravel(), return_inverse=True)
                b['pos'].append(v[used].astype(np.float32)); b['idx'].append((inv.reshape(-1, 3) + b['n']).astype(np.uint32))
                m = dict(meta.get(eid, {})); m.update({'id': eid, 'cat': c, 'tri0': b['tri'], 'tris': int(len(sel)), 'materials': emats.get(eid, [])})
                b['n'] += len(used); b['tri'] += len(sel); manifest.append(m)
        count += 1
        if count % 2000 == 0:
            print(count, 'elements', round(time.time() - t0), 's', flush=True)
        if not it.next():
            break
print('geometry done', count, round(time.time() - t0), 's', flush=True)

# ---- write the GLB ----
bin_parts, views, accessors, meshes, nodes = [], [], [], [], []
def add(arr, target):
    data = arr.tobytes(); pad = (-len(data)) % 4
    views.append({'buffer': 0, 'byteOffset': sum(len(p) for p in bin_parts), 'byteLength': len(data), 'target': target})
    bin_parts.append(data + b'\0' * pad); return len(views) - 1
for c, b in sorted(buckets.items()):
    P = np.concatenate(b['pos']); I = np.concatenate(b['idx']).ravel()
    pv = add(P, 34962); iv = add(I, 34963)
    accessors.append({'bufferView': pv, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
    accessors.append({'bufferView': iv, 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'})
    meshes.append({'name': 'Youth_center__' + c, 'primitives': [{'attributes': {'POSITION': len(accessors) - 2}, 'indices': len(accessors) - 1}]})
    nodes.append({'name': 'Youth_center__' + c, 'mesh': len(meshes) - 1})
gj = {'asset': {'version': '2.0', 'generator': 'ifc2glb'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
      'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': sum(len(p) for p in bin_parts)}]}
js = json.dumps(gj, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4); bn = b''.join(bin_parts)
with open(os.path.join(out, 'model.glb'), 'wb') as fh:
    fh.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bn)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bn), b'BIN\0') + bn)
manifest += skipped
json.dump(manifest, open(os.path.join(out, 'elements.json'), 'w'), separators=(',', ':'))
print('wrote', {c: b['tri'] for c, b in buckets.items()}, 'total', round(time.time() - t0), 's', flush=True)
