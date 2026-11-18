"""City collision checker. Run after EVERY change to game/citydata:  python game/tools/city_check.py [--fix]
Checks every object against roads, buildings, project sites, water and each other; --fix removes offenders, then re-checks.
Rules (from the user):
  - nothing (trees, lamps, stop signs, buildings, shops, skate pieces) on a road's driving surface
  - no stacking: trees >= 4 m apart, lamps >= 8 m, stop signs >= 6 m
  - trees, posts and shops never inside or touching a building; buildings never overlap each other
  - nothing of the city inside a project site (projects are never clipped or covered)
  - no voids: no small hole in the land (street or park) that is not the sea or a river
  - buildings that work: every wall >= 10 ft, no part narrower than 10 ft, no corner sharper than 75 deg, no slit or
    notch narrower than 10 ft, no courtyard narrower than the building is tall (it would never get sun)
  - code (Florida): every building 10 ft (3.048 m) from the back of sidewalk, project parcels and water, and 20 ft (6.096 m)
    from other buildings (10 ft each side of a lot line); height <= 85 ft. Road junctions: at most 4 legs (counted);
    legs meeting at < 60 deg are listed as a warning (Florida Greenbook) and do not block the gate.
"""
import json, sys
import numpy as np
from PIL import Image
from shapely.geometry import Polygon, LineString, Point
from shapely.strtree import STRtree
from shapely.ops import unary_union
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

G = 'G:/My Drive/github/archiwatts-com/game/citydata/'
FIX = '--fix' in sys.argv
C = json.load(open(G + 'city.json'))
g = C['ground']
gr = np.array(Image.open(G + 'ground.png'))
PAVE = {'street': 3.3, 'blvd': 7.6}
X0, Z0, PX, GW, GH = g['x0'], g['z0'], g['px'], g['w'], g['h']


def pix(x, z):
    i, j = int((x - X0) / PX), int((z - Z0) / PX)
    return gr[j, i] if 0 <= i < GW and 0 <= j < GH else None


def in_site(x, z):
    v = pix(x, z)
    return v is not None and v[2] > 128


def on_land(x, z):
    v = pix(x, z)
    return v is not None and v[1] > 128


try:      # top-down height map of the 3D project models (1 m, captured from the game; R project, G (height above street + 32) * 4)
    _H = np.array(Image.open(G + 'project-heights.png'))
    SOLID = (_H[..., 3] > 0) & (_H[..., 1] / 4 - 32 > 0.6)
    DSOL = ndi.distance_transform_edt(~SOLID)
except FileNotFoundError:
    DSOL = None
try:      # where the city's ground slab exists in the game (1 m); a building corner off it hangs in the air
    SLAB = np.array(Image.open(G + 'city-slab.png'))[..., 0] > 128
except FileNotFoundError:
    SLAB = None


def on_slab(x, z):
    if SLAB is None: return True
    i, j = int(x - X0), int(z - Z0)
    return 0 <= i < SLAB.shape[1] and 0 <= j < SLAB.shape[0] and SLAB[j, i]


def model_dist(x, z):
    """metres from (x, z) to the nearest part of a project model standing above the street"""
    if DSOL is None: return 1e9
    i, j = int(x - X0), int(z - Z0)
    return DSOL[j, i] if 0 <= i < DSOL.shape[1] and 0 <= j < DSOL.shape[0] else 1e9


def build():
    global carr, carr_t, bpolys, b_t
    carr = [LineString(r['pts']).buffer(PAVE[r['c']]) for r in C['roads'] if len(r['pts']) > 1 and r['c'] in PAVE]   # 'site' roads belong to a project model   # driving surface (kerb line)
    carr_t = STRtree(carr)
    bpolys = [Polygon(b['pts'], b.get('holes', [])).buffer(0) for b in C['buildings']]
    b_t = STRtree(bpolys)


def hits(tree, geoms, shape):
    return [int(i) for i in tree.query(shape) if geoms[i].intersects(shape)]


SB, SEP, HMAX = 3.048, 6.096, 25.9          # 10 ft setbacks, 20 ft between buildings, 85 ft
ROWH = {'street': 3.3 + 2.4, 'blvd': 10.6}    # right-of-way half width: pavement + 2.4 m sidewalk (blvd incl. median kerbs)
WARN = []



def shape_issues(b, P):
    """real-life footprint rules (10 ft = 3.048 m)"""
    import math
    out = []; ext = list(P.exterior.coords)[:-1]; n = len(ext); ccw = P.exterior.is_ccw
    if any(math.dist(ext[i], ext[(i + 1) % n]) < SB - .05 for i in range(n)): out.append('wall shorter than 10 ft')
    for i in range(n):
        a, c, d = ext[i - 1], ext[i], ext[(i + 1) % n]
        v1 = (a[0] - c[0], a[1] - c[1]); v2 = (d[0] - c[0], d[1] - c[1])
        ang = math.degrees(math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1])) % 360
        th = 360 - ang if ccw else ang
        if th < 74.5: out.append('corner sharper than 75 deg'); break
        if th > 300.5: out.append('slit corner (always dark)'); break
    if P.difference(P.buffer(-SB / 2, join_style=2).buffer(SB / 2, join_style=2)).area > 1: out.append('part narrower than 10 ft')
    if P.buffer(SB / 2, join_style=2).buffer(-SB / 2, join_style=2).difference(P).area > 1: out.append('notch narrower than 10 ft')
    for h in P.interiors:
        r = list(Polygon(h).minimum_rotated_rectangle.exterior.coords)
        if min(math.dist(r[0], r[1]), math.dist(r[1], r[2])) < max(6.1, b['h']): out.append('courtyard too narrow for sun'); break
    return out

def code_check():
    row = unary_union([LineString(r['pts']).buffer(ROWH[r['c']]) for r in C['roads'] if len(r['pts']) > 1 and r['c'] in ROWH])
    bad = set(); w = {}
    dbad = np.minimum(ndi.distance_transform_edt(gr[..., 2] <= 128), ndi.distance_transform_edt(gr[..., 1] > 128)) * PX
    for k, (b, P) in enumerate(zip(C['buildings'], bpolys)):
        if b['k'] == 'garage': continue
        if P.distance(row) < SB - .02: bad.add(k); w.setdefault('setback to street < 10 ft', []).append(k)
        for j in b_t.query(P.buffer(SEP)):
            j = int(j)
            if j > k and C['buildings'][j]['k'] != 'garage' and bpolys[j].distance(P) < SEP - .02: bad.add(j); w.setdefault('buildings < 20 ft apart', []).append(j)
        for t in np.linspace(0, 1, 60, endpoint=False):
            q = P.exterior.interpolate(t, normalized=True); i, j = int((q.x - X0) / PX), int((q.y - Z0) / PX)
            if 0 <= i < GW and 0 <= j < GH and dbad[j, i] < SB - PX:
                bad.add(k); w.setdefault('setback to parcel/water < 10 ft', []).append(k); break
        if b['h'] > HMAX: bad.add(k); w.setdefault('taller than 85 ft', []).append(k)
        for why in shape_issues(b, P): bad.add(k); w.setdefault(why, []).append(k)
        if any(model_dist(*P.exterior.interpolate(t, normalized=True).coords[0]) < SB for t in np.linspace(0, 1, 60, endpoint=False)) or model_dist(P.centroid.x, P.centroid.y) < SB:
            bad.add(k); w.setdefault('within 10 ft of a project model', []).append(k)
        if not all(on_slab(*P.exterior.interpolate(t, normalized=True).coords[0]) for t in np.linspace(0, 1, 80, endpoint=False)):
            bad.add(k); w.setdefault('floating: footprint off the ground slab', []).append(k)
    for k, r in enumerate(C['roads']):
        if r['c'] not in PAVE: continue
        L = LineString(r['pts'])
        if any(model_dist(*L.interpolate(s).coords[0]) < PAVE[r['c']] for s in np.arange(0, L.length, 1.0)):
            w.setdefault('road runs into a project model', []).append(k)
    K = lambda p: (round(p[0] * 2) / 2, round(p[1] * 2) / 2)
    at = {}
    for r in C['roads']:
        if len(r['pts']) < 2 or r['c'] not in PAVE: continue
        for p in (r['pts'], r['pts'][::-1]):
            L = LineString(p); q = L.interpolate(min(12, L.length / 2))
            at.setdefault(K(p[0]), []).append(np.arctan2(q.y - p[0][1], q.x - p[0][0]))
    WARN.clear()
    for k, v in at.items():
        if len(v) > 4: w.setdefault('junction with > 4 legs', []).append(k)
        if len(v) >= 3:
            v = sorted(v); gap = min((v[(i + 1) % len(v)] - v[i]) % (2 * np.pi) for i in range(len(v)))
            if gap < np.radians(60): WARN.append(f'junction at {k}: {np.degrees(gap):.0f} deg')
    return {k: len(v) for k, v in w.items()}, bad


def check():
    R = {}
    tr = C['trees']; bad = set(); why = {}
    for k, t in enumerate(tr):
        p = Point(t[0], t[1])
        if hits(carr_t, carr, p.buffer(.4)): bad.add(k); why.setdefault('on road', []).append(k)   # trunk on the driving surface
        elif hits(b_t, bpolys, p.buffer(2.0)): bad.add(k); why.setdefault('in/touching building', []).append(k)
        elif in_site(t[0], t[1]) and ((t[0] - 880) ** 2 + (t[1] - 298) ** 2) ** .5 > 110: bad.add(k); why.setdefault('in project site', []).append(k)   # the MOE park's own trees are planted on purpose
        elif not on_land(t[0], t[1]): bad.add(k); why.setdefault('in water', []).append(k)
        elif model_dist(t[0], t[1]) < 2.5 and ((t[0] - 880) ** 2 + (t[1] - 298) ** 2) ** .5 > 110: bad.add(k); why.setdefault('in a project model', []).append(k)
    if tr:
        kd = cKDTree(np.array([[t[0], t[1]] for t in tr]))
        st = {max(a, b) for a, b in kd.query_pairs(4.0) if a not in bad and b not in bad}
        why['stacked (<4 m)'] = sorted(st); bad |= st
    R['trees'] = {k: len(v) for k, v in why.items()}; R['_trees'] = bad
    for name, sep in (('lamps', 8.0), ('stops', 6.0)):
        L = C[name]; bad = set(); w = {}
        for k, l in enumerate(L):
            p = Point(l[0], l[1])
            if hits(carr_t, carr, p.buffer(.3)): bad.add(k); w.setdefault('on road', []).append(k)
            elif hits(b_t, bpolys, p.buffer(.6)): bad.add(k); w.setdefault('in building', []).append(k)
            elif in_site(l[0], l[1]) or not on_land(l[0], l[1]): bad.add(k); w.setdefault('in site/water', []).append(k)
            elif model_dist(l[0], l[1]) < 1.0: bad.add(k); w.setdefault('in a project model', []).append(k)
        if L:
            kd = cKDTree(np.array([[l[0], l[1]] for l in L]))
            st = {max(a, b) for a, b in kd.query_pairs(sep) if a not in bad and b not in bad}
            w['stacked'] = sorted(st); bad |= st
        R[name] = {k: len(v) for k, v in w.items()}; R['_' + name] = bad
    bad = set(); w = {}
    for k, (b, P) in enumerate(zip(C['buildings'], bpolys)):
        if b['k'] == 'garage': continue
        if hits(carr_t, carr, P.buffer(-.2)): bad.add(k); w.setdefault('on road', []).append(k)
        xs = [p[0] for p in b['pts']] + [P.centroid.x]; zs = [p[1] for p in b['pts']] + [P.centroid.y]
        if any(in_site(x, z) for x, z in zip(xs, zs)): bad.add(k); w.setdefault('in project site', []).append(k)
        for j in b_t.query(P):
            j = int(j)
            if j > k and bpolys[j].intersection(P).area > 1.0: bad.add(j); w.setdefault('overlap', []).append(j)
    R['buildings'] = {k: len(v) for k, v in w.items()}; R['_buildings'] = bad
    R['code'], R['_code'] = code_check(); R['_buildings'] |= R['_code']
    for name in ('landmarks', 'skate'):
        bad = set(); w = {}
        for k, l in enumerate(C[name]):
            r = max(l.get('w', 0), l.get('d', 0)) / 2 if name == 'landmarks' else max(l.get('r', 0), 3)
            s = Point(*l['c']).buffer(max(r, 2))
            if hits(carr_t, carr, s): bad.add(k); w.setdefault('on road', []).append(k)
            if hits(b_t, bpolys, s): bad.add(k); w.setdefault('in building', []).append(k)
            if in_site(*l['c']): bad.add(k); w.setdefault('in project site', []).append(k)
        R[name] = {k: len(v) for k, v in w.items()}; R['_' + name] = bad
    land = gr[..., 1] > 128
    lab, n = ndi.label(~land)
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]]).tolist())
    sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    holes = [i + 1 for i in range(n) if (i + 1) not in edge and sizes[i] * PX * PX < 400]
    R['voids'] = {'small holes in land': len(holes)}; R['_voids'] = (lab, holes)
    return R


def report(R):
    tot = 0
    for k, v in R.items():
        if k.startswith('_'): continue
        n = sum(v.values()); tot += n
        print(f'  {k:10s} ' + (', '.join(f'{a}: {b}' for a, b in v.items() if b) or 'clean'))
    for m in WARN: print('  warning   ', m)
    print('  TOTAL clashes:', tot)
    return tot


build()
print('collision check')
R = check(); total = report(R)
if FIX and total:
    for name in ('lamps', 'stops'):   # posts on the road go back onto the pavement, 0.6 m behind the kerb
        for k in list(R['_' + name]):
            l = C[name][k]; p = Point(l[0], l[1]); best = None
            for i in carr_t.query(p.buffer(25)):
                d = carr[int(i)].exterior.distance(p)
                if best is None or d < best[0]: best = (d, int(i))
            if best is None: continue
            ring = carr[best[1]].exterior; q = ring.interpolate(ring.project(p)); v = np.array([q.x - p.x, q.y - p.y]); n = np.linalg.norm(v) or 1
            nx, nz = q.x + v[0] / n * .6, q.y + v[1] / n * .6
            if not hits(carr_t, carr, Point(nx, nz).buffer(.3)) and not hits(b_t, bpolys, Point(nx, nz).buffer(.6)) and on_land(nx, nz) and not in_site(nx, nz):
                l[0], l[1] = round(nx, 2), round(nz, 2); R['_' + name].discard(k)
    for name in ('trees', 'lamps', 'stops', 'buildings', 'landmarks', 'skate'):
        C[name] = [t for k, t in enumerate(C[name]) if k not in R['_' + name] or (name == 'buildings' and t.get('k') == 'garage')]
    lab, holes = R['_voids']
    if holes:
        m = np.isin(lab, holes)
        gr[..., 1][m] = 255
        gr[..., 0][m] = 2
        Image.fromarray(gr).save(G + 'ground.png')
    json.dump(C, open(G + 'city.json', 'w'), separators=(',', ':'))
    build(); print('after fix'); R = check(); total = report(R)
sys.exit(1 if total else 0)
