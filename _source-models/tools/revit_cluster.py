"""Revit export (revit_export*.py: tris.bin + meta.json) -> a light GLB by vertex clustering, streamed in chunks so exports of
hundreds of millions of triangles (planting, perforated panels) fit in memory. Every vertex snaps to a grid (the linked site model on
a coarser one), triangles that collapse are dropped and duplicates removed. One mesh per Revit material; meshes of linked models are
named "context: <material>". Metres, Y up (x = Revit X, y = Revit Z, z = -Revit Y).
Also prints a census (triangles per category) and writes <out>.census.json.
Usage: python revit_cluster.py <export dir> <out.glb> [building cell m = 0.35] [link cell m = 1.2]"""
import sys, os, json, struct, time, collections
import numpy as np

src, out = sys.argv[1], sys.argv[2]
cb = float(sys.argv[3]) if len(sys.argv) > 3 else .35
cl = float(sys.argv[4]) if len(sys.argv) > 4 else 1.2
meta = json.load(open(os.path.join(src, 'meta.json'), encoding='utf-8'))
mats, elems = meta['materials'], meta['elements']
dt = np.dtype([('m', '<i4'), ('e', '<i4'), ('p', '<f8', (9,))])
R = np.memmap(os.path.join(src, 'tris.bin'), dtype=dt, mode='r')
N = len(R); print('triangles', N, 'materials', len(mats), 'elements', len(elems), flush=True)
cell = np.array([cl if m.get('link') else cb for m in mats] + [cb])           # per material (last: no material)
islink = np.array([bool(m.get('link')) for m in mats] + [False])
ecount = np.zeros(len(elems) + 1, np.int64)
box = {False: [np.full(3, 1e18), np.full(3, -1e18)], True: [np.full(3, 1e18), np.full(3, -1e18)]}
OFF = 1 << 20
keep_k, keep_m = [], []
CH = 4_000_000; t0 = time.time()
for s in range(0, N, CH):
    c = R[s:s + CH]; m = np.where(c['m'] < 0, len(mats), c['m']).astype(np.int32)
    ecount += np.bincount(np.clip(c['e'], -1, len(elems) - 1) + 1, minlength=len(elems) + 1)       # index 0: no element
    p = c['p'].reshape(-1, 3, 3) * .3048
    p = np.stack([p[..., 0], p[..., 2], -p[..., 1]], -1)                         # y up
    for flag in (False, True):
        sel = islink[m] == flag
        if sel.any():
            q = p[sel].reshape(-1, 3); box[flag][0] = np.minimum(box[flag][0], q.min(0)); box[flag][1] = np.maximum(box[flag][1], q.max(0))
    g = np.rint(p / cell[m][:, None, None]).astype(np.int64) + OFF
    k = (g[..., 0] << 42) | (g[..., 1] << 21) | g[..., 2]                        # one int64 per vertex
    ok = (k[:, 0] != k[:, 1]) & (k[:, 1] != k[:, 2]) & (k[:, 0] != k[:, 2])
    k, m = k[ok], m[ok]
    if len(k):
        r = np.argmin(k, 1); i = np.arange(len(k))                               # rotate so the smallest vertex comes first (keeps winding)
        k = np.stack([k[i, r], k[i, (r + 1) % 3], k[i, (r + 2) % 3]], 1)
        h = (k[:, 0] * np.int64(-7046029254386353131)) ^ (k[:, 1] * np.int64(-4658895280553007687)) ^ (k[:, 2] * np.int64(1609587929392839161)) ^ m
        _, u = np.unique(h, return_index=True); keep_k.append(k[u]); keep_m.append(m[u])
    print('  %5.1f%%  kept so far %d  (%.0fs)' % (min(100, (s + CH) / N * 100), sum(len(x) for x in keep_k), time.time() - t0), flush=True)

K = np.concatenate(keep_k); M = np.concatenate(keep_m)
h = (K[:, 0] * np.int64(-7046029254386353131)) ^ (K[:, 1] * np.int64(-4658895280553007687)) ^ (K[:, 2] * np.int64(1609587929392839161)) ^ M
_, u = np.unique(h, return_index=True); K, M = K[u], M[u]
print('triangles after clustering', len(K))

cats = collections.Counter()
for e, n in zip(elems, ecount[1:]): cats[(e.get('link') or 'host', e.get('cat') or '?')] += int(n)
census = [{'link': a, 'cat': b, 'tris': n} for (a, b), n in cats.most_common()]
for r in census[:25]: print('  %-32s %-34s %12d' % (r['link'][:32], r['cat'][:34], r['tris']))
for flag in (False, True): print('box', 'link' if flag else 'host', np.round(box[flag][0], 1), np.round(box[flag][1], 1))
json.dump({'census': census, 'box': {('link' if f else 'host'): [b[0].tolist(), b[1].tolist()] for f, b in box.items()}, 'cells': [cb, cl], 'source_triangles': int(N), 'triangles': int(len(K))}, open(out + '.census.json', 'w'), indent=1)

# GLB: one mesh per material
def lin(c): c = float(c) / 255.; return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
bins, views, accs, meshes, nodes, gmats = [], [], [], [], [], []
off = 0
def blob(a, target):
    global off
    raw = a.tobytes(); pad = (-len(raw)) % 4; bins.append(raw + b'\0' * pad); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), 'target': target}); off += len(raw) + pad; return len(views) - 1
for mi in np.unique(M):
    k = K[M == mi]; uq, inv = np.unique(k.reshape(-1), return_inverse=True)
    pos = np.stack([(uq >> 42) & 0x1FFFFF, (uq >> 21) & 0x1FFFFF, uq & 0x1FFFFF], 1).astype(np.float64) - OFF
    pos = (pos * cell[mi]).astype(np.float32); idx = inv.astype(np.uint32)
    mt = mats[mi] if mi < len(mats) else {'name': '(none)', 'rgb': [200, 200, 200], 'transparency': 0, 'link': ''}
    name = ('context: ' if mt.get('link') else '') + (mt.get('name') or '(none)')
    a = 1 - float(mt.get('transparency') or 0)
    g = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [lin(mt['rgb'][0]), lin(mt['rgb'][1]), lin(mt['rgb'][2]), a], 'metallicFactor': 0, 'roughnessFactor': .9}, 'doubleSided': True}
    if a < 1: g['alphaMode'] = 'BLEND'
    gmats.append(g)
    accs.append({'bufferView': blob(pos, 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
    accs.append({'bufferView': blob(idx, 34963), 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'})
    meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': len(accs) - 2}, 'indices': len(accs) - 1, 'material': len(gmats) - 1}]})
    nodes.append({'name': name, 'mesh': len(meshes) - 1})
j = {'asset': {'version': '2.0', 'generator': 'revit_cluster.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'materials': gmats,
     'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': off}]}
js = json.dumps(j).encode(); js += b' ' * ((-len(js)) % 4); data = b''.join(bins)
with open(out, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(data))); f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js); f.write(struct.pack('<I4s', len(data), b'BIN\0')); f.write(data)
print('wrote', out, round(os.path.getsize(out) / 1e6, 1), 'MB', '(%.0fs)' % (time.time() - t0))
