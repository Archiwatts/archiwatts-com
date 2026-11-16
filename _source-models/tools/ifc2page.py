"""IFC -> GLB for a project's web page: exact IFC geometry, one mesh per Revit material, with each material's own colour and transparency.
Metres, Y up (x = IFC X, y = IFC Z, z = -IFC Y), world coordinates. Only elements above a triangle cap are reduced (vertex clustering on a
small grid), so ordinary walls, floors and frames stay exact while very dense families (planting, perforated panels, entourage) stay loadable.
Prints a census by IFC class and writes <out>.census.json.
usage: python ifc2page.py in.ifc out.glb [cap triangles per element = 40000] [cluster cell m = 0.04]"""
import sys, json, os, re, struct, time, multiprocessing, collections
import numpy as np
import ifcopenshell, ifcopenshell.geom

src, out = sys.argv[1], sys.argv[2]
cap = int(sys.argv[3]) if len(sys.argv) > 3 else 40000
cell = float(sys.argv[4]) if len(sys.argv) > 4 else .04
t0 = time.time(); f = ifcopenshell.open(src); print('opened', round(time.time() - t0), 's', flush=True)
S = ifcopenshell.geom.settings(); S.set('use-world-coords', True)
skip = [e for c in ('IfcOpeningElement', 'IfcSpace') for e in f.by_type(c)]
it = ifcopenshell.geom.iterator(S, f, multiprocessing.cpu_count(), exclude=skip) if skip else ifcopenshell.geom.iterator(S, f, multiprocessing.cpu_count())
def rgb(m):
    d = getattr(m, 'diffuse', None)
    try: c = (d.r(), d.g(), d.b())
    except Exception:
        try: c = tuple(d)[:3]
        except Exception: c = (.8, .8, .8)
    c = [float(x) if x == x else .8 for x in c]
    t = getattr(m, 'transparency', 0) or 0
    return c, (1 - float(t)) if t == t else 1.0
def clean(n): return re.sub(r'[^A-Za-z0-9 _\-\.,()#]+', '', n or 'unnamed').strip()[:70] or 'unnamed'
_names = {}
def real_name(n):
    """IfcOpenShell names a style 'IfcSurfaceStyleRendering-<id>'; the Revit material name sits on the IfcSurfaceStyle that owns it."""
    if n in _names: return _names[n]
    out_n = n; m = re.match(r'Ifc\w+-(\d+)$', n or '')
    if m:
        try:
            for inv in f.get_inverse(f.by_id(int(m.group(1)))):
                if inv.is_a('IfcSurfaceStyle') and inv.Name: out_n = inv.Name; break
        except Exception: pass
    _names[n] = out_n; return out_n
buckets, census, src_tris, n_el, n_red = {}, collections.Counter(), 0, 0, 0
lo, hi = np.full(3, 1e18), np.full(3, -1e18)
if it.initialize():
    while True:
        sh = it.get(); g = sh.geometry
        v = np.array(g.verts, dtype=np.float64).reshape(-1, 3); fc = np.array(g.faces, dtype=np.int64).reshape(-1, 3)
        if len(v) and len(fc):
            n_el += 1; src_tris += len(fc)
            try: cls = f.by_id(sh.id).is_a()
            except Exception: cls = '?'
            census[cls] += len(fc)
            P = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
            mats = list(g.materials); mids = np.array(g.material_ids, dtype=np.int64)
            if len(mids) != len(fc): mids = np.zeros(len(fc), np.int64)
            heavy = len(fc) > cap; q = cell if heavy else .001; n_red += heavy
            _, first, remap = np.unique(np.round(P / q).astype(np.int64), axis=0, return_index=True, return_inverse=True)
            P = P[first]; fc = remap.reshape(-1)[fc]; ok = (fc[:, 0] != fc[:, 1]) & (fc[:, 1] != fc[:, 2]) & (fc[:, 0] != fc[:, 2]); fc = fc[ok]; mids = mids[ok]
            if len(fc):
                lo = np.minimum(lo, P.min(0)); hi = np.maximum(hi, P.max(0))
                for mi in np.unique(mids):
                    m = mats[mi] if 0 <= mi < len(mats) else None
                    name = clean(real_name(getattr(m, 'name', None) or '') if m is not None else 'unnamed')
                    col, a = rgb(m) if m is not None else ([.8, .8, .8], 1.0)
                    b = buckets.setdefault(name, {'pos': [], 'idx': [], 'n': 0, 'tri': 0, 'col': col, 'a': a})
                    sel = fc[mids == mi]; used, inv = np.unique(sel.ravel(), return_inverse=True)
                    b['pos'].append(P[used].astype(np.float32)); b['idx'].append((inv.reshape(-1, 3) + b['n']).astype(np.uint32)); b['n'] += len(used); b['tri'] += len(sel)
            if n_el % 500 == 0: print('  elements', n_el, 'source triangles', src_tris, 'kept', sum(b['tri'] for b in buckets.values()), round(time.time() - t0), 's', flush=True)
        if not it.next(): break
kept = sum(b['tri'] for b in buckets.values())
print('elements', n_el, '(reduced:', n_red, ') source triangles', src_tris, 'kept', kept, 'box', lo.round(1).tolist(), hi.round(1).tolist(), round(time.time() - t0), 's', flush=True)
for c, n in census.most_common(14): print('  %-34s %12d' % (c, n))
print('materials:', ', '.join('%s (%d)' % (k, b['tri']) for k, b in sorted(buckets.items(), key=lambda kv: -kv[1]['tri'])[:40]))
json.dump({'census': census.most_common(), 'materials': {k: {'tris': b['tri'], 'rgb': b['col'], 'alpha': b['a']} for k, b in buckets.items()}, 'box': [lo.tolist(), hi.tolist()], 'source_triangles': src_tris, 'triangles': kept, 'cap': cap, 'cell': cell}, open(out + '.census.json', 'w'), indent=1)

bins, views, accs, meshes, nodes, gm = [], [], [], [], [], []; off = 0
def blob(a, target):
    global off
    raw = a.tobytes(); pad = (-len(raw)) % 4; bins.append(raw + b'\0' * pad); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), 'target': target}); off += len(raw) + pad; return len(views) - 1
lin = lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
for name, b in sorted(buckets.items()):
    P = np.concatenate(b['pos']); I = np.concatenate(b['idx']).ravel()
    m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [lin(b['col'][0]), lin(b['col'][1]), lin(b['col'][2]), b['a']], 'metallicFactor': 0, 'roughnessFactor': .85}, 'doubleSided': True}
    if b['a'] < 1: m['alphaMode'] = 'BLEND'
    gm.append(m)
    accs.append({'bufferView': blob(P, 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
    accs.append({'bufferView': blob(I, 34963), 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'})
    meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': len(accs) - 2}, 'indices': len(accs) - 1, 'material': len(gm) - 1}]}); nodes.append({'name': name, 'mesh': len(meshes) - 1})
j = {'asset': {'version': '2.0', 'generator': 'ifc2page.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'materials': gm, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': off}]}
js = json.dumps(j).encode(); js += b' ' * ((-len(js)) % 4); data = b''.join(bins)
with open(out, 'wb') as fh:
    fh.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(data))); fh.write(struct.pack('<I4s', len(js), b'JSON')); fh.write(js); fh.write(struct.pack('<I4s', len(data), b'BIN\0')); fh.write(data)
print('wrote', out, round(os.path.getsize(out) / 1e6, 1), 'MB', round(time.time() - t0), 's')
