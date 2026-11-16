"""Crash-safe version of ifc2page.py for very large IFCs (London Vertical Farm V1 is 1.1 GB, ~200M triangles).
Elements are converted in batches; each finished batch is saved to <work>/batch-NNNN.npz, so a crash loses at most one batch and a
re-run skips every batch already on disk. When all batches exist they are merged into one GLB (one mesh per Revit material).
Dense elements (over `cap` triangles) are reduced by vertex clustering on a `cell` grid; everything else stays exact.
usage: python ifc2page_batched.py in.ifc out.glb workdir [cap = 4000] [cell m = 0.15] [batch size = 300]"""
import sys, os, re, json, struct, time, multiprocessing, glob
import numpy as np
import ifcopenshell, ifcopenshell.geom

src, out, work = sys.argv[1], sys.argv[2], sys.argv[3]
cap = int(sys.argv[4]) if len(sys.argv) > 4 else 4000
cell = float(sys.argv[5]) if len(sys.argv) > 5 else .15
size = int(sys.argv[6]) if len(sys.argv) > 6 else 300
os.makedirs(work, exist_ok=True); t0 = time.time()
f = ifcopenshell.open(src); print('opened', round(time.time() - t0), 's', flush=True)
els = sorted((e for e in f.by_type('IfcProduct') if e.Representation and not e.is_a('IfcOpeningElement') and not e.is_a('IfcSpace')), key=lambda e: e.id())
batches = [els[i:i + size] for i in range(0, len(els), size)]
print('elements', len(els), 'batches', len(batches), flush=True)
S = ifcopenshell.geom.settings(); S.set('use-world-coords', True)
_names = {}
def real_name(n):
    if n in _names: return _names[n]
    o = n; m = re.match(r'Ifc\w+-(\d+)$', n or '')
    if m:
        try:
            for inv in f.get_inverse(f.by_id(int(m.group(1)))):
                if inv.is_a('IfcSurfaceStyle') and inv.Name: o = inv.Name; break
        except Exception: pass
    _names[n] = o; return o
def clean(n): return re.sub(r'[^A-Za-z0-9 _\-\.,()#]+', '', n or 'unnamed').strip()[:70] or 'unnamed'
def rgb(m):
    try: d = m.diffuse; c = [d.r(), d.g(), d.b()]
    except Exception:
        try: c = list(m.diffuse)[:3]
        except Exception: c = [.8, .8, .8]
    c = [float(x) if x == x else .8 for x in c]; t = getattr(m, 'transparency', 0) or 0
    return c, (1 - float(t)) if t == t else 1.0

for bi, batch in enumerate(batches):
    path = os.path.join(work, 'batch-%04d.npz' % bi)
    if os.path.exists(path): continue
    tb = time.time(); buckets = {}; src_tris = 0
    it = ifcopenshell.geom.iterator(S, f, multiprocessing.cpu_count(), include=batch)
    if it.initialize():
        while True:
            g = it.get().geometry
            v = np.array(g.verts, dtype=np.float64).reshape(-1, 3); fc = np.array(g.faces, dtype=np.int64).reshape(-1, 3)
            if len(v) and len(fc):
                src_tris += len(fc); P = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
                mats = list(g.materials); mids = np.array(g.material_ids, dtype=np.int64)
                if len(mids) != len(fc): mids = np.zeros(len(fc), np.int64)
                q = cell if len(fc) > cap else .001
                _, first, remap = np.unique(np.round(P / q).astype(np.int64), axis=0, return_index=True, return_inverse=True)
                P = P[first]; fc = remap.reshape(-1)[fc]; ok = (fc[:, 0] != fc[:, 1]) & (fc[:, 1] != fc[:, 2]) & (fc[:, 0] != fc[:, 2]); fc = fc[ok]; mids = mids[ok]
                if len(fc) > cap and q == cell:   # still dense after the grid: drop duplicate triangles too
                    s = np.sort(fc, 1); _, u = np.unique(s, axis=0, return_index=True); fc = fc[u]; mids = mids[u]
                for mi in np.unique(mids):
                    m = mats[mi] if 0 <= mi < len(mats) else None
                    name = clean(real_name(getattr(m, 'name', '') or '') if m is not None else 'unnamed')
                    col, a = rgb(m) if m is not None else ([.8, .8, .8], 1.0)
                    b = buckets.setdefault(name, {'pos': [], 'idx': [], 'n': 0, 'col': col, 'a': a})
                    sel = fc[mids == mi]; used, inv = np.unique(sel.ravel(), return_inverse=True)
                    b['pos'].append(P[used].astype(np.float32)); b['idx'].append((inv.reshape(-1, 3) + b['n']).astype(np.uint32)); b['n'] += len(used)
            if not it.next(): break
    arrs, meta = {}, {}
    for k, (name, b) in enumerate(buckets.items()):
        arrs['p%d' % k] = np.concatenate(b['pos']); arrs['i%d' % k] = np.concatenate(b['idx']); meta[k] = [name, b['col'], b['a']]
    np.savez(path + '.tmp.npz', meta=json.dumps(meta), **arrs); os.replace(path + '.tmp.npz', path)   # only a complete batch counts
    kept = sum(len(a) for k, a in arrs.items() if k[0] == 'i')
    print('batch %d/%d  source %d  kept %d  %ds (total %ds)' % (bi + 1, len(batches), src_tris, kept, time.time() - tb, time.time() - t0), flush=True)

# merge every batch into one GLB
merged = {}
for path in sorted(glob.glob(os.path.join(work, 'batch-*.npz'))):
    z = np.load(path); meta = json.loads(str(z['meta']))
    for k, (name, col, a) in meta.items():
        b = merged.setdefault(name, {'pos': [], 'idx': [], 'n': 0, 'col': col, 'a': a})
        P = z['p' + k]; I = z['i' + k]; b['pos'].append(P); b['idx'].append(I + b['n']); b['n'] += len(P)
lin = lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
bins, views, accs, meshes, nodes, gm = [], [], [], [], [], []; off = 0
def blob(a, target):
    global off
    raw = a.tobytes(); pad = (-len(raw)) % 4; bins.append(raw + b'\0' * pad); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), 'target': target}); off += len(raw) + pad; return len(views) - 1
total = 0
for name, b in sorted(merged.items()):
    P = np.concatenate(b['pos']); I = np.concatenate(b['idx']).ravel(); total += len(I) // 3
    m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [lin(b['col'][0]), lin(b['col'][1]), lin(b['col'][2]), b['a']], 'metallicFactor': 0, 'roughnessFactor': .85}, 'doubleSided': True}
    if b['a'] < 1: m['alphaMode'] = 'BLEND'
    gm.append(m)
    accs.append({'bufferView': blob(P, 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
    accs.append({'bufferView': blob(I.astype(np.uint32), 34963), 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'})
    meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': len(accs) - 2}, 'indices': len(accs) - 1, 'material': len(gm) - 1}]}); nodes.append({'name': name, 'mesh': len(meshes) - 1})
j = {'asset': {'version': '2.0', 'generator': 'ifc2page_batched.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'materials': gm, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': off}]}
js = json.dumps(j).encode(); js += b' ' * ((-len(js)) % 4); data = b''.join(bins)
with open(out, 'wb') as fh:
    fh.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(data))); fh.write(struct.pack('<I4s', len(js), b'JSON')); fh.write(js); fh.write(struct.pack('<I4s', len(data), b'BIN\0')); fh.write(data)
print('wrote', out, round(os.path.getsize(out) / 1e6, 1), 'MB', total, 'triangles', ', '.join('%s' % k for k in sorted(merged)[:30]), round(time.time() - t0), 's')
