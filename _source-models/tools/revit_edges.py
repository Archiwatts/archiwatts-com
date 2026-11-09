"""Feature edges of the web model, for bold ink outlines: every edge where the two faces meet at more than ANGLE degrees, plus
open (boundary) edges. Edges outside the site block and above grade are marked as context (the neighbours) so the page can
outline just the context in Realistic mode and everything in Diagram mode.
Output: revit-edges.bin.gz = uint32 header length, JSON header {min, max, groups:{project:[start,count], context:[start,count]}},
then int16 x6 per edge (two endpoints, quantized over min..max).
usage: python revit_edges.py <revit-main.bin.gz> <out.bin.gz>"""
import sys, gzip, json, struct
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
ANGLE = 55.0   # only real corners; the faceting of curved surfaces stays below this
SITE = (-95.0, 9.5, 17.5, 78.2)
buf = gzip.open(SRC, 'rb').read()
hl = struct.unpack_from('<I', buf, 0)[0]; hdr = json.loads(buf[4:4 + hl].decode('utf-8')); base = 4 + hl
cos_t = np.cos(np.radians(ANGLE))
segs = []
for m in hdr['meshes']:
    cat = m['name'].replace('Youth_center__', '')
    if cat == 'Glazing' or (m.get('transparency') or 0) > .15: continue
    for c in m['chunks']:
        q = np.frombuffer(buf, '<u2', c['v'] * 3, base + c['pos']).reshape(-1, 3).astype(np.float64)
        p = np.array(c['min']) + q * np.array(c['scale'])
        ix = np.frombuffer(buf, '<u2', c['i'], base + c['idx']).reshape(-1, 3).astype(np.int64)
        # weld coincident vertices (chunks keep hard edges as split vertices)
        key = np.round(p / .01).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
        P = np.zeros((inv.max() + 1, 3)); P[inv] = p
        T = inv[ix]
        T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
        if not len(T): continue
        n = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]); ln = np.linalg.norm(n, axis=1); ok = ln > 1e-9; T = T[ok]; n = n[ok] / ln[ok, None]
        E = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]); F = np.tile(np.arange(len(T)), 3)
        Es = np.sort(E, axis=1); order = np.lexsort((Es[:, 1], Es[:, 0])); Es = Es[order]; F = F[order]
        same = np.all(Es[1:] == Es[:-1], axis=1)
        # boundary edges: appear once
        first = np.ones(len(Es), bool); first[1:] = ~same
        cnt = np.diff(np.append(np.nonzero(first)[0], len(Es)))
        starts = np.nonzero(first)[0]
        single = starts[cnt == 1]
        pair = starts[cnt == 2]
        d = np.einsum('ij,ij->i', n[F[pair]], n[F[pair + 1]])
        sharp = pair[d < cos_t]
        keep = np.concatenate([single, sharp])
        # an edge on a wall face (any adjacent face near vertical): used to keep the line where a wall meets the ground
        st = np.concatenate([np.abs(n[F[single], 1]) < .5, np.minimum(np.abs(n[F[sharp], 1]), np.abs(n[F[sharp + 1], 1])) < .5])
        if len(keep): segs.append(np.concatenate([P[Es[keep, 0]], P[Es[keep, 1]], st[:, None].astype(float)], axis=1))
S = np.concatenate(segs)
STEEP = S[:, 6] > .5; S = S[:, :6]
L = np.linalg.norm(S[:, :3] - S[:, 3:6], axis=1); S = S[L > .25]; STEEP = STEEP[L > .25]
mid = (S[:, :3] + S[:, 3:]) / 2
hi = np.maximum(S[:, 1], S[:, 4])
ctx = ((mid[:, 0] < SITE[0]) | (mid[:, 0] > SITE[1]) | (mid[:, 2] < SITE[2]) | (mid[:, 2] > SITE[3])) & ((mid[:, 1] > 34.75) | (STEEP & (hi > 34.3)))   # incl. the wall's foot at grade
S = np.concatenate([S[~ctx], S[ctx]]); nproj = int((~ctx).sum()); nctx = int(ctx.sum())
mn = S.reshape(-1, 3).min(0) - .01; mx = S.reshape(-1, 3).max(0) + .01
Q = np.round((S.reshape(-1, 3) - mn) / (mx - mn) * 65534 - 32767).astype(np.int16).reshape(-1, 6)
head = json.dumps({'min': mn.tolist(), 'max': mx.tolist(), 'groups': {'project': [0, nproj], 'context': [nproj, nctx]}}).encode()
with gzip.open(OUT, 'wb', 6) as f: f.write(struct.pack('<I', len(head)) + head + Q.tobytes())
print('edges project', nproj, 'context', nctx)
