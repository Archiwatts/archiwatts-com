"""Revit export (revit_export.py: tris.bin + meta.json) -> website binaries.
 - every element, as Revit tessellates it, with its own Revit material appearance (materials merged when they look the same)
 - placed in the site viewer's frame (matched on single-instance elements against the IFC alignment)
 - heavy elements simplified with an error budget; small ones kept exact
 - split in two files: main (building, site, links) loads first, detail (fixtures, furniture, cars, piles below grade) streams after
Output layout per file: uint32 header length, header JSON, data (16-bit quantized positions, 16-bit indices, chunks of <= 65k vertices).
Usage: python revit2web.py <revit dir> <page dir>"""
import sys, os, re, json, struct, collections
import numpy as np
import fast_simplification as FS

src, page = sys.argv[1], sys.argv[2]
dt = np.dtype([('m', '<i4'), ('e', '<i4'), ('p', '<f8', (9,))])
R = np.memmap(os.path.join(src, 'tris.bin'), dtype=dt, mode='r')
meta = json.load(open(os.path.join(src, 'meta.json'), encoding='utf-8'))
E, M = meta['elements'], meta['materials']
for m in M:   # Revit bytes/numbers may arrive as strings
    m['rgb'] = [int(float(x)) for x in m['rgb']]; m['transparency'] = float(m['transparency']); m['glossiness'] = float(m.get('glossiness') or 0)

DETAIL_CAT = re.compile(r'^(Entourage|Lighting Fixtures|Plumbing Fixtures|Furniture|Furniture Systems|Specialty Equipment|Mechanical Equipment|Sprinklers|Electrical Fixtures|Electrical Equipment|Structural Foundations|Casework|Food Service Equipment|Medical Equipment)$')
DETAIL_FAM = re.compile(r'car|truck|wrecker|bus|sink|sprinkler|shower|toilet|urinal|stall|grab_bar|lectern|tennis|gymnastic|judo|chair|table|stool|sofa|HP-Bearing Pile', re.I)
def is_detail(e):
    return bool(DETAIL_CAT.match(e['cat']) or DETAIL_FAM.search(e['fam'] or ''))
CARS = re.compile(r'car|suv|truck|wrecker|police|scion|bus_2017|city_bus|automobile|vehicle', re.I)
NOSIMPLIFY = {'Ramps', 'Stairs', 'Runs', 'Landings', 'Floors', 'Site', 'Roofs', 'Walls', 'Topography', 'Toposolid', 'Pads', 'Roads', 'Parking', 'Ceilings'}
def in_skate(e, bb):
    # the sunken skate park west of the building: its surfaces (site link "Site 1" / "Site 4") and the stairs and ramps in it
    if e['link'].startswith('Youth_Center-Site') and e['fam'] in ('Site 1', 'Site 4'): return True
    return bb is not None and e['cat'] in ('Stairs', 'Runs', 'Landings', 'Ramps', 'Floors', 'Site', 'Generic Models') and bb[1][1] < 35.8 and bb[0][0] > -95 and bb[1][0] < -40 and bb[0][2] > 10 and bb[1][2] < 50
def is_glass(mat):
    return mat['transparency'] > .15 or re.search(r'glass|glaz', mat['name'], re.I) is not None
def kind_of(e, mat, bb=None):
    if is_glass(mat): return 'Glazing'
    if in_skate(e, bb): return 'Skate'
    c = e['cat']
    if c in ('Planting',): return 'Planting'
    if c in ('Floors', 'Roads', 'Site', 'Topography', 'Toposolid', 'Parking', 'Ramps', 'Stairs', 'Runs', 'Landings', 'Pads'): return 'Stone'
    if re.search(r'Railing|Baluster|Handrail|Top Rail|Mullion|Structural Framing|Structural Columns', c): return 'Metal'
    return 'Plaster'

# merge materials that look the same (colour to 1/32 steps, transparency, gloss)
def look(m):
    r, g, b = m['rgb']; return (r // 8, g // 8, b // 8, round(m['transparency'], 1), round((m.get('glossiness') or 0) / 32))
looks, mat_look = {}, []
for m in M:
    k = look(m)
    if k not in looks: looks[k] = {'rgb': m['rgb'], 'transparency': m['transparency'], 'glossiness': m.get('glossiness') or 0, 'names': []}
    looks[k]['names'].append(m['name']); mat_look.append(k)
look_ids = {k: i for i, k in enumerate(looks)}

order = np.argsort(np.asarray(R['e']), kind='stable')
ev = np.asarray(R['e'])[order]
bounds = np.searchsorted(ev, np.arange(len(E) + 1))
buckets = {'main': collections.defaultdict(lambda: {'pos': [], 'idx': [], 'n': 0, 'tri': 0}), 'detail': collections.defaultdict(lambda: {'pos': [], 'idx': [], 'n': 0, 'tri': 0})}
manifest = []
stats = collections.Counter()
seen = set()
# left out: the rhino-site link (the city around the site, already on the page from the lighter context model) and the site link's
# big terrain surface ("Site 3", Earth/Sand), which pokes up through the plaza paving
SKIP = lambda e: e['link'] == 'rhino site' or (e['link'].startswith('Youth_Center-Site') and e['cat'] == 'Site' and e['fam'] == 'Site 3')
# one glass for the whole project: every glass/glazing material is drawn with this
GLASS = {'rgb': [163, 197, 210], 'transparency': .62, 'glossiness': 92, 'name': 'Glass'}
M.append(GLASS); mat_look.append(look(GLASS))
if look(GLASS) not in looks: looks[look(GLASS)] = {'rgb': GLASS['rgb'], 'transparency': GLASS['transparency'], 'glossiness': 92, 'names': ['Glass']}
look_ids = {k: i for i, k in enumerate(looks)}
BB = {int(k): v for k, v in json.load(open(os.path.join(src, 'bbox.json'))).items()} if os.path.exists(os.path.join(src, 'bbox.json')) else {}
cars = []
for ei in range(len(E)):
    a, b = bounds[ei], bounds[ei + 1]
    if a == b: continue
    e = E[ei]
    if SKIP(e): continue
    if e['link']:                      # the same link placed twice at the same spot: keep one copy of each element
        if (e['link'], e['uid']) in seen: continue
        seen.add((e['link'], e['uid']))
    if e['cat'] in ('Levels', 'Grids', 'Cameras'): continue          # level heads and other annotation: the page draws its own levels
    rows = R[order[a:b]]
    if CARS.search(e['fam'] or '') and e['cat'] in ('Entourage', 'Generic Models', 'Site', 'Planting'):
        # Revit cars are swapped for the page's low-poly cars: keep only where each one stands and which way it faces
        P = np.asarray(rows['p'], dtype=np.float64).reshape(-1, 3) * 0.3048; P = np.stack([P[:, 0] + 35.6, P[:, 2] + 34.6, 53.4 - P[:, 1]], 1)
        xz = P[:, [0, 2]]; c = xz.mean(0); w, vec = np.linalg.eigh(np.cov((xz - c).T)); d = vec[:, -1]
        ext = (xz - c) @ d; length = float(ext.max() - ext.min())
        cars.append({'x': float(c[0]), 'y': float(P[:, 1].min()), 'z': float(c[1]), 'dx': float(d[0]), 'dz': float(d[1]), 'len': round(length, 2), 'fam': e['fam']})
        continue
    f = 'detail' if is_detail(e) else 'main'
    P = np.asarray(rows['p'], dtype=np.float64).reshape(-1, 3) * 0.3048
    P = np.stack([P[:, 0] + 35.6, P[:, 2] + 34.6, 53.4 - P[:, 1]], 1)          # Revit (Z up, feet) -> site frame (Y up, metres)
    mats = np.asarray(rows['m'])
    for mi in np.unique(mats):
        sel = np.where(mats == mi)[0]
        tri = np.stack([sel * 3, sel * 3 + 1, sel * 3 + 2], 1)
        _, first, remap = np.unique(np.round(P * 1000).astype(np.int64)[tri.ravel()], axis=0, return_index=True, return_inverse=True)
        v = P[tri.ravel()][first]; fc = remap.reshape(-1, 3)
        ok = (fc[:, 0] != fc[:, 1]) & (fc[:, 1] != fc[:, 2]) & (fc[:, 0] != fc[:, 2]); fc = fc[ok]
        if not len(fc): continue
        t0 = len(fc)
        if t0 > 1000 and e['cat'] not in NOSIMPLIFY:      # ramps, stairs, floors, walls, roofs and site keep their exact faces
            target = 1000 + 0.08 * (t0 - 1000)
            try:
                v2, f2 = FS.simplify(v.astype(np.float32), fc.astype(np.int32), target_reduction=1 - target / t0, agg=5)
                if len(f2) > 12: v, fc = v2.astype(np.float64), f2.astype(np.int64)
            except Exception:
                pass
            cell = .01
            while len(fc) > max(4000, target * 1.6) and cell < .5:   # meshes that refuse to simplify: snap to a grid
                _, f3, r3 = np.unique(np.round(v / cell).astype(np.int64), axis=0, return_index=True, return_inverse=True)
                ff = r3.reshape(-1)[fc]; ok = (ff[:, 0] != ff[:, 1]) & (ff[:, 1] != ff[:, 2]) & (ff[:, 0] != ff[:, 2]); v, fc = v[f3], ff[ok]; cell *= 2
        if is_glass(M[mi]): mi = len(M) - 1
        mat = M[mi]; kind = kind_of(e, mat, BB.get(ei)); lk = look_ids[mat_look[mi]]
        key = (kind, lk); bk = buckets[f][key]
        manifest.append({'file': f, 'kind': kind, 'look': lk, 'tri0': bk['tri'], 'tris': int(len(fc)), 'src': int(t0), 'id': e['id'], 'uid': e['uid'], 'cat': e['cat'],
                         'fam': e['fam'], 'type': e['type'], 'level': e['level'], 'link': e['link'], 'material': mat['name']})
        bk['pos'].append(v.astype(np.float32)); bk['idx'].append((fc + bk['n']).astype(np.uint32)); bk['n'] += len(v); bk['tri'] += len(fc)
        stats[f] += len(fc); stats[f + '_src'] += t0

def write(f, path):
    data, off = [], [0]
    def put(arr):
        raw = arr.tobytes(); raw += b'\0' * ((-len(raw)) % 4); data.append(raw); o = off[0]; off[0] += len(raw); return o
    meshes = []
    for (kind, lk), bk in sorted(buckets[f].items()):
        P = np.concatenate(bk['pos']); I = np.concatenate(bk['idx']).reshape(-1, 3); chunks, t = [], 0
        while t < len(I):
            step = min(len(I) - t, 21000)
            while True:
                blk = I[t:t + step]; u, inv = np.unique(blk.ravel(), return_inverse=True)
                if len(u) <= 65535: break
                step //= 2
            p = P[u]; mn = p.min(0); sc = np.maximum(p.max(0) - mn, 1e-6) / 65535.
            chunks.append({'v': int(len(u)), 'i': int(blk.size), 'pos': put(np.round((p - mn) / sc).astype(np.uint16)), 'idx': put(inv.astype(np.uint16)), 'min': mn.tolist(), 'scale': sc.tolist()})
            t += step
        L = looks[list(looks)[lk]]
        meshes.append({'name': 'Youth_center__' + kind, 'kind': kind, 'look': lk, 'rgb': L['rgb'], 'transparency': L['transparency'], 'glossiness': L['glossiness'], 'material': L['names'][0], 'chunks': chunks})
    extra = {}
    if f == 'main':
        # building levels (Revit / IFC storeys, feet above grade); grade sits at y 34.6 on the page
        LV = [('GRADE', 0), ('JUICE BAR', 8), ('SKATE TOP', 12), ('TABLE T.', 18), ('MAIN', 20), ('CLASSROOM TOP', 32), ('GYM', 36), ('LEVEL 5', 56), ('ROOF', 60)]
        extra = {'cars': cars, 'levels': [{'name': n, 'ft': ft, 'y': round(34.6 + ft * .3048, 3)} for n, ft in LV]}
    hdr = json.dumps(dict(meshes=meshes, **extra)).encode(); hdr += b' ' * ((-len(hdr)) % 4)
    import gzip
    raw = struct.pack('<I', len(hdr)) + hdr + b''.join(data)
    with open(path + '.gz', 'wb') as fh:          # gzip: the browser unpacks it with DecompressionStream
        fh.write(gzip.compress(raw, 9))
    return round(len(raw) / 1e6, 1), round(os.path.getsize(path + '.gz') / 1e6, 1), len(meshes)
print('main', write('main', os.path.join(page, 'revit-main.bin')), 'detail', write('detail', os.path.join(page, 'revit-detail.bin')))
json.dump(manifest, open(os.path.join(src, 'elements.json'), 'w'), separators=(',', ':'))
print(dict(stats))
