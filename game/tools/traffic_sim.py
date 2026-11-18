"""Heavy traffic test of the game city's road network.
    python game/tools/traffic_sim.py [city.json] [cars] [report.json] [cars per second]
Static tests on every road: reachable both ways from the rest of the network, dead ends, loose ends that stop near
another road without joining it, overlapping duplicate roads, curves too tight for a car, U-turn-only junctions.
Dynamic test: thousands of cars on random trips (shortest-time routes, car following, a car needs room on the next
road before it enters, junctions pass two cars per half second). Reports trips that never arrive, gridlock, the
worst jams and roads no route ever uses. Exit code 1 when a road fails a static test or traffic gridlocks.
"""
import json, sys, math, random, heapq
from collections import defaultdict
import numpy as np
import networkx as NX
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

random.seed(7)
SRC = sys.argv[1] if len(sys.argv) > 1 else 'G:/My Drive/github/archiwatts-com/game/citydata/city.json'
N = int(sys.argv[2]) if len(sys.argv) > 2 else 4000
OUT = sys.argv[3] if len(sys.argv) > 3 else None
RATE = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0      # new cars per second, citywide
C = json.load(open(SRC))
PAV = {'street': 3.3, 'blvd': 7.6, 'site': 3.0}   # site: a project's own roads (Net Zero's campus and streets)
VMAX = {'street': 11.0, 'blvd': 16.0, 'site': 6.7}   # m/s: 25, 35 and 15 mph
K = lambda p: (round(p[0] * 2) / 2, round(p[1] * 2) / 2)


def load_roads():
    R = [dict(c=r['c'], pts=[list(map(float, p)) for p in r['pts']]) for r in C['roads'] if len(r['pts']) > 1 and LineString(r['pts']).length > 1]
    # an end lying on the middle of another road is a T junction: split that road there
    for _ in range(4):
        lines = [LineString(r['pts']) for r in R]; tree = STRtree(lines); ends = defaultdict(int)
        for r in R: ends[K(r['pts'][0])] += 1; ends[K(r['pts'][-1])] += 1
        cut = defaultdict(list)
        for a, r in enumerate(R):
            for e in (r['pts'][0], r['pts'][-1]):
                if ends[K(e)] > 1: continue
                p = Point(e)
                for b in tree.query(p.buffer(PAV[r['c']] + 1)):
                    b = int(b)
                    if b == a: continue
                    t = lines[b].project(p)
                    if 2 < t < lines[b].length - 2 and lines[b].distance(p) < PAV[R[b]['c']] + .5:
                        cut[b].append((t, e)); break
        if not cut: break
        out = []
        for b, r in enumerate(R):
            if b not in cut: out.append(r); continue
            pts = r['pts']; cum = np.r_[0, np.cumsum([math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)])]
            prev_t, prev_p = 0.0, pts[0]
            for t, e in sorted(cut[b]) + [(cum[-1] + 1, pts[-1])]:
                mid = [p for p, c in zip(pts, cum) if prev_t < c < t]
                seg = [prev_p] + mid + [list(e)]
                if LineString(seg).length > .5: out.append(dict(c=r['c'], pts=seg))
                prev_t, prev_p = t, list(e)
        R = out
    return R


R = load_roads()
lines = [LineString(r['pts']) for r in R]
tree = STRtree(lines)
node = defaultdict(list)
for i, r in enumerate(R): node[K(r['pts'][0])].append((i, 0)); node[K(r['pts'][-1])].append((i, 1))
issues = defaultdict(list)

# ---------- static tests ----------
for k, v in node.items():
    if len(v) != 1: continue
    i, e = v[0]; p = Point(k)
    near = [int(b) for b in tree.query(p.buffer(12)) if int(b) != i and lines[int(b)].distance(p) < 12]
    if R[i]['c'] == 'site': issues['site road ends (where the project model is cropped; cars turn round)'].append(k); continue
    if near: issues['loose end (stops near a road, not joined)'].append(k)
    elif lines[i].length < 40: issues['short dead-end stub'].append(k)
    else: issues['dead end (needs its turning circle)'].append(k)
for a, La in enumerate(lines):
    for b in tree.query(La.buffer(1.0)):
        b = int(b)
        if b <= a: continue
        ov = La.buffer(1.2).intersection(lines[b])
        if ov.length > 12 and 'site' not in (R[a]['c'], R[b]['c']): issues['overlapping roads'].append((a, b, round(ov.length)))
for i, L in enumerate(lines):
    if L.length < 14: continue
    worst, at = 1e9, None
    for s in np.arange(6, L.length - 6, 3):
        a, b, c = [np.array(L.interpolate(t).coords[0]) for t in (s - 6, s, s + 6)]
        A, B, Cc = np.linalg.norm(b - c), np.linalg.norm(a - c), np.linalg.norm(a - b)
        ar = abs((b - a)[0] * (c - a)[1] - (b - a)[1] * (c - a)[0]) / 2
        rad = A * B * Cc / (4 * ar) if ar > 1e-6 else 1e9
        if rad < worst: worst, at = rad, b
    if worst < {'street': 9, 'blvd': 15, 'site': 5}[R[i]['c']]:   # site roads: parking aisles and drop-off loops at 15 mph, a car turns on ~5 m
        issues['curve too tight for a car'].append((i, round(worst, 1), [round(at[0]), round(at[1])]))


def heading(i, e):          # direction leaving the node along road i (e = which end sits at the node)
    L = lines[i]; s = min(6, L.length / 2); p = L.interpolate(s if e == 0 else L.length - s); q = R[i]['pts'][0 if e == 0 else -1]
    return math.atan2(p.y - q[1], p.x - q[0])


arcs = {(i, d): lines[i].length / VMAX[R[i]['c']] for i in range(len(R)) for d in (0, 1)}   # d 0: start -> end
turns = defaultdict(list)
for k, v in node.items():
    for (i, e) in v:
        arr = (i, 1) if e == 0 else (i, 0)            # arriving at this node along road i
        hin = heading(i, e) + math.pi
        for (j, f) in v:
            if j == i and len(v) > 1: continue          # no U-turns at junctions; dead ends turn round
            dev = abs((heading(j, f) - hin + math.pi) % (2 * math.pi) - math.pi)
            if len(v) > 1 and dev > math.radians(150): issues['turn sharper than 150 deg'].append((k, i, j)); continue
            turns[arr].append(((j, 0) if f == 0 else (j, 1), 4.0 + 6.0 * dev / math.pi))
D = NX.DiGraph()
for a in arcs:
    D.add_node(a)
    for b, w in turns[a]: D.add_edge(a, b)
sccs = sorted(NX.strongly_connected_components(D), key=len, reverse=True)
main = sccs[0]
issues['road not reachable both ways'] = sorted({(a[0], tuple(round(x) for x in R[a[0]]['pts'][0])) for a in arcs if a not in main and R[a[0]]['c'] != 'site'})
issues['site roads cut off from the city (info)'] = sorted({a[0] for a in arcs if a not in main and R[a[0]]['c'] == 'site'})


# ---------- dynamic test: heavy traffic ----------
def route(a, b):
    dist = {a: 0}; prev = {}; q = [(0, a)]
    while q:
        d, u = heapq.heappop(q)
        if u == b: break
        if d > dist[u]: continue
        for v, w in turns[u]:
            nd = d + w + arcs[v]
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(q, (nd, v))
    if b not in dist: return None
    p = [b]
    while p[-1] != a: p.append(prev[p[-1]])
    return p[::-1]


mainl = sorted(main); cars = []; noroute = 0
for n in range(N):
    a, b = random.sample(mainl, 2); p = route(a, b)
    if p is None: noroute += 1; continue
    cars.append(dict(p=p, k=0, s=0.0, v=0.0, t0=random.random() * N / RATE, done=None, wait=0.0, on=False))   # rush hour: RATE new cars a second (3/s = 10,800 an hour)
DT, TMAX = .5, N / RATE + 1800
cap = lambda a: max(1, int(lines[a[0]].length / 7.5)) * (2 if R[a[0]]['c'] == 'blvd' else 1)
end_key = lambda a: K(R[a[0]]['pts'][-1 if a[1] == 0 else 0])
used = defaultdict(int); jam = defaultdict(float); jwait = defaultdict(float)
t = 0.0
while t < TMAX:
    occ = defaultdict(list)
    for ci, c in enumerate(cars):
        if not c['on'] and t >= c['t0'] and len(occ[c['p'][0]]) < cap(c['p'][0]): c['on'] = True; used[c['p'][0][0]] += 1
        if c['on'] and c['done'] is None: occ[c['p'][c['k']]].append(ci)
    jx = defaultdict(int)
    for a, l in occ.items():
        l.sort(key=lambda ci: -cars[ci]['s']); L = lines[a[0]].length; vmax = VMAX[R[a[0]]['c']]
        for rank, ci in enumerate(l):
            c = cars[ci]
            gap = cars[l[rank - 1]]['s'] - c['s'] - 7.5 if rank else 1e9
            if not rank and c['k'] + 1 < len(c['p']):
                nxt = c['p'][c['k'] + 1]
                if len(occ.get(nxt, [])) >= cap(nxt): gap = min(gap, L - c['s'] - 1)
            c['v'] = v = min(vmax, c['v'] + 2.5 * DT, max(0.0, (gap - 2) / 1.2)); c['s'] += v * DT
            if v < .3: c['wait'] += DT; jam[a] += DT
            else: c['wait'] = 0.0
            if c['s'] >= L:
                if c['k'] + 1 >= len(c['p']): c['done'] = t; continue
                nk = end_key(a)
                if jx[nk] >= 2: c['s'] = L - .01; c['v'] = 0.0; jwait[nk] += DT; continue
                jx[nk] += 1; c['k'] += 1; c['s'] = 0.0; used[c['p'][c['k']][0]] += 1
    t += DT
arr = [c for c in cars if c['done'] is not None]
stuck = [c for c in cars if c['done'] is None and c['wait'] > 120]
tt = [c['done'] - c['t0'] for c in arr]
rep = {'roads (after T splits)': len(R), 'junctions': sum(1 for v in node.values() if len(v) >= 3), 'cars': len(cars), 'no route': noroute,
       'arrived': len(arr), 'still driving at the end': len(cars) - len(arr) - len(stuck), 'gridlocked (stopped > 2 min)': len(stuck),
       'median trip (s)': round(float(np.median(tt)), 1) if tt else None}
rep['worst jams (road, class, car-minutes stopped, start)'] = [(a[0], R[a[0]]['c'], round(v / 60), [round(x) for x in R[a[0]]['pts'][0]]) for a, v in sorted(jam.items(), key=lambda x: -x[1])[:12]]
rep['busiest junction waits (car-minutes)'] = [(k, round(v / 60)) for k, v in sorted(jwait.items(), key=lambda x: -x[1])[:8]]
rep['roads no trip used'] = [(i, [round(x) for x in R[i]['pts'][0]]) for i in range(len(R)) if used[i] == 0 and (i, 0) in main]
rep.update(issues)
print('traffic simulation:', SRC)
for k, v in rep.items(): print(f'  {k}: ' + (f'{len(v)}  {v[:8]}' if isinstance(v, list) else f'{v}'))
if OUT: json.dump({'rep': rep, 'roads': R, 'jam': {f'{a[0]},{a[1]}': v for a, v in jam.items()}, 'used': used}, open(OUT, 'w'), default=str)
blocking = ['road not reachable both ways', 'loose end (stops near a road, not joined)', 'overlapping roads', 'curve too tight for a car', 'short dead-end stub']
bad = sum(len(issues[b]) for b in blocking) + len(stuck)
print('  TRAFFIC FAILURES:', bad)
sys.exit(1 if bad else 0)
