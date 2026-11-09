"""Turns revit_site.py's output into compact files for the Tranquil River page (desktop only).
usage: python site2web.py <model>.terrain.json <model>.palms.json <out dir> [terrain-map json] [palm triangles]
 - terrain: vertices welded to 1 mm, quantised to 16 bits inside each part's box, 32-bit indices; parts are grouped by the page
   material they take (terrain-map: {"<element id>:<revit material>": "<page material name>", ...}; unmapped pieces are skipped)
 - palms: each distinct palm shape is simplified (fast_simplification) to about the given triangle count, vertex-coloured trunk /
   fronds, and written once with a 4x4 matrix per placed tree (page axes)
Container: b'TRW1', uint32 header length, JSON header, then the raw blocks the header lists; the whole file is gzipped."""
import sys, json, struct, gzip, numpy as np
import fast_simplification
F = 0.3048
terr_f, palm_f, out = sys.argv[1], sys.argv[2], sys.argv[3]
tmap = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
ptri = int(sys.argv[5]) if len(sys.argv) > 5 else 12000

def weld(tris):
    a = np.asarray(tris, np.float64).reshape(-1, 3)
    key = np.round(a * 1000).astype(np.int64)
    _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return a[idx], inv.reshape(-1, 3).astype(np.uint32)

def pack(parts, blocks):
    hdr = json.dumps({'parts': parts}, separators=(',', ':')).encode()
    return b'TRW1' + struct.pack('<I', len(hdr)) + hdr + b''.join(blocks)

# ---- terrain ----
T = json.load(open(terr_f)); groups = {}
for eid, mats in T.items():
    for m, v in mats.items():
        name = tmap.get(eid + ':' + m)
        if name: groups.setdefault(name, []).append(v)
parts, blocks = [], []
for name, lists in groups.items():
    v = np.concatenate([np.asarray(x, np.float64) for x in lists])
    P, I = weld(v); lo, hi = P.min(0), P.max(0); q = np.round((P - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')
    parts.append({'kind': 'terrain', 'mat': name, 'nv': len(P), 'nt': len(I), 'min': lo.round(4).tolist(), 'max': hi.round(4).tolist()})
    blocks += [q.tobytes(), I.astype('<u4').tobytes()]
    print('terrain', name, len(I), 'tris', len(P), 'verts')
open(out + '/site-terrain.bin.gz', 'wb').write(gzip.compress(pack(parts, blocks), 9))

# ---- palms ----
Pj = json.load(open(palm_f)); parts, blocks = [], []
LEAF = np.array([.30, .52, .17]); LEAF2 = np.array([.40, .62, .22]); TRUNK = np.array([.46, .34, .22])
for sid, mats in Pj['templates'].items():
    v = np.concatenate([np.asarray(x, np.float64) for x in mats.values()])
    P, I = weld(v)            # local feet
    want = ptri if len(I) > ptri else len(I)
    if want < len(I):
        P2, I2 = fast_simplification.simplify(P.astype(np.float32), I.astype(np.int32), target_reduction=1 - want / len(I)); P, I = P2.astype(np.float64), I2.astype(np.uint32)
    c = P[I].mean(1); r = np.hypot(c[:, 0], c[:, 1]); trunk = (c[:, 2] < 6.2) & (r < 1.7)
    # colour per triangle -> unwelded vertices (so trunk and frond edges stay crisp)
    Pt = P[I].reshape(-1, 3); col = np.where(trunk[:, None], TRUNK, LEAF + (LEAF2 - LEAF) * np.clip((c[:, 2:3] - 6) / 10, 0, 1)); col = np.repeat(col, 3, axis=0)
    loc = np.stack([Pt[:, 0] * F, Pt[:, 2] * F, -Pt[:, 1] * F], 1).astype('<f4')         # page axes, metres
    inst = [i for i in Pj['instances'] if i[0] == sid]; M = []
    Pm = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], np.float64)
    for i in inst:
        o = np.array(i[1:4]); R = np.stack([i[4:7], i[7:10], i[10:13]], 1); Rp = Pm @ R @ Pm.T; t = Pm @ o * F
        m = np.eye(4); m[:3, :3] = Rp; m[:3, 3] = t; M.append(m.T.reshape(-1))    # column-major
    parts.append({'kind': 'palm', 'sid': sid, 'nv': len(loc), 'n': len(inst)})
    blocks += [loc.tobytes(), (col * 255).round().astype('u1').tobytes(), np.asarray(M, '<f4').tobytes()]
    print('palm', sid, len(I), 'tris,', len(inst), 'trees')
open(out + '/site-palms.bin.gz', 'wb').write(gzip.compress(pack(parts, blocks), 9))
