"""Modelled Spanish tile roof for the Venice main apartment (Real view), built over the roof planes of the Revit model:
barrel tiles (a raised cover and a sunken pan per column, in overlapping courses, running past the eave), half-round cap tiles
along ridges, hips and open ends, half-round gutters under the eaves and downpipes on the outer fronts.
build(P, I) takes the 'Default Roof' part (positions, triangles) and returns parts for bake_venice.py:
  {'mat', 'kind', 'P', 'I', 'tint' (a colour factor per vertex: every tile a slightly different shade), 'vert': True}"""
import numpy as np
TW, TL, HC, HP, LIFT, STEP, OVER, SEG = .30, .42, .065, .03, .045, .028, .12, 8   # tile width and length, cover rise, pan depth, ...
GROUND = 3.0

def unit(v):
    v = np.asarray(v, np.float64); return v / max(np.linalg.norm(v), 1e-12)
def hsh(a, b):
    s = np.sin(np.asarray(a, np.float64) * 127.1 + np.asarray(b, np.float64) * 311.7) * 43758.5453; return s - np.floor(s)
def prof(s):
    s = s - np.floor(s); return np.where(s < .5, HC * np.sin(np.pi * s / .5), -HP * np.sin(np.pi * (s - .5) / .5))

class Quads:
    def __init__(self): self.P, self.T = [], []
    def add(self, a, b, c, d, tint):   # corners counter-clockwise seen from outside, each (n, 3); tint (n, 3) or (3,)
        a = np.atleast_2d(a); n = len(a); self.P.append(np.stack([a, np.atleast_2d(b), np.atleast_2d(c), np.atleast_2d(d)], 1).reshape(-1, 3))
        self.T.append(np.repeat(np.broadcast_to(np.asarray(tint, np.float64), (n, 3)), 4, 0))
    def part(self, mat, kind):
        P = np.concatenate(self.P); k = np.arange(len(P) // 4)[:, None] * 4
        return {'mat': mat, 'kind': kind, 'P': P, 'I': np.concatenate([k + [0, 1, 2], k + [0, 2, 3]]).astype(np.int64), 'tint': np.concatenate(self.T), 'vert': True}

def build(P, I):
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]; n = np.cross(b - a, c - a); ar = np.linalg.norm(n, axis=1); ok = ar > 1e-9; n[ok] /= ar[ok][:, None]
    sl = ok & (n[:, 1] > .3) & (n[:, 1] < .985); key = np.c_[np.round(n * 50), np.round((n * a).sum(1) * 10)].astype(np.int64)
    _, vid = np.unique(np.round(P * 100).astype(np.int64), axis=0, return_inverse=True); vid = vid.ravel()
    tiles, metal, edges = Quads(), Quads(), {}
    lo, hi = P[np.unique(I[sl])].min(0), P[np.unique(I[sl])].max(0)
    for kk in np.unique(key[sl], axis=0):
        sel = np.flatnonzero(sl & (key == kk).all(1)); T = P[I[sel]]                       # (m, 3, 3)
        N = unit(n[sel].mean(0)); DN = unit(np.array([0, -1., 0]) + N * N[1]); AC = unit(np.cross(N, DN)); D0 = float((T.reshape(-1, 3) @ N).mean())
        T2 = np.stack([T @ AC, T @ DN], 2); u0, v0 = T2.reshape(-1, 2).min(0); u1, v1 = T2.reshape(-1, 2).max(0)
        def inside(u, v):
            A, B, C = T2[:, 0][None], T2[:, 1][None], T2[:, 2][None]; u = u[:, None]; v = v[:, None]
            d = (B[..., 1] - C[..., 1]) * (A[..., 0] - C[..., 0]) + (C[..., 0] - B[..., 0]) * (A[..., 1] - C[..., 1])
            w1 = ((B[..., 1] - C[..., 1]) * (u - C[..., 0]) + (C[..., 0] - B[..., 0]) * (v - C[..., 1])) / d
            w2 = ((C[..., 1] - A[..., 1]) * (u - C[..., 0]) + (A[..., 0] - C[..., 0]) * (v - C[..., 1])) / d
            return ((w1 >= -1e-4) & (w2 >= -1e-4) & (w1 + w2 <= 1.0001)).any(1)
        Wp = lambda u, v, h: u[:, None] * AC + v[:, None] * DN + (D0 + h)[:, None] * N
        # ---- tiles: courses counted up from the eave, so a whole tile always ends at the edge ----
        nu = int(np.ceil((u1 - u0) / TW)) * SEG; nc = int(np.ceil((v1 + OVER - v0) / TL)); du = TW / SEG
        ii, jj = [g.ravel() for g in np.meshgrid(np.arange(nu), np.arange(nc))]
        ua = u0 + ii * du; ub = ua + du; va = v1 + OVER - (jj + 1) * TL; vb = va + TL
        keep = inside((ua + ub) / 2, np.minimum((va + vb) / 2, v1 - .02)) & (va >= v0 - .05); ua, ub, va, vb, jj = ua[keep], ub[keep], va[keep], vb[keep], jj[keep]
        sa, sb = (ua - u0) / TW, (ub - u0) / TW; col = np.floor(sa * 2 + 1e-6); seed = kk[0] * 3.3 + kk[2] * 7.7 + kk[3]
        h1, h2 = hsh(col + seed, jj), hsh(col * 3.1 + seed, jj * 1.7 + 5); dk = np.where(h2 > .93, .8, 1.)
        tint = np.stack([(.92 + .2 * h1) * dk, (.9 + .16 * h1) * dk, (.88 + .14 * h1) * dk], 1)
        ha, hb = prof(sa) + LIFT, prof(sb) + LIFT
        tiles.add(Wp(ua, vb, ha + STEP), Wp(ub, vb, hb + STEP), Wp(ub, va, hb), Wp(ua, va, ha), tint)
        last = jj == 0; la, lb = np.where(last, 0., ha), np.where(last, 0., hb)   # butt end; at the eave it drops to the roof (open tile ends)
        tiles.add(Wp(ua, vb, la), Wp(ub, vb, lb), Wp(ub, vb, hb + STEP), Wp(ua, vb, ha + STEP), tint * np.where(last, .6, 1.)[:, None])
        # ---- this plane's outer edges ----
        cnt = {}
        for t in sel:
            for e in range(3):
                i0, i1 = I[t, e], I[t, (e + 1) % 3]; k2 = (min(vid[i0], vid[i1]), max(vid[i0], vid[i1])); cnt.setdefault(k2, []).append((P[i0], P[i1], P[I[t]].mean(0)))
        for k2, L in cnt.items():
            if len(L) == 1: edges.setdefault(k2, []).append((L[0][0], L[0][1], L[0][2], N, DN, float(T[..., 1].min())))
    # ---- caps on ridges, hips and open ends; gutters on eaves ----
    ne = 0
    for k2, L in edges.items():
        A, Bp, cin, N, DN, ylow = L[0]; ln = np.linalg.norm(Bp - A)
        if ln < .3: continue
        if len(L) == 1 and max(A[1], Bp[1]) < ylow + .06:                                   # an eave
            d = unit(Bp - A); out = unit([DN[0], 0, DN[2]]); r = .075; base = A + out * (OVER + .02) - np.array([0, .07, 0]); ne += 1
            ang = np.pi + np.pi * np.arange(9) / 8; ring = out[None] * np.cos(ang)[:, None] * r + np.array([0, 1., 0])[None] * np.sin(ang)[:, None] * r
            p0, p1 = base + ring, base + d * ln + ring
            metal.add(p0[:-1], p0[1:], p1[1:], p1[:-1], (1, 1, 1)); metal.add(p0[1:], p0[:-1], p1[:-1], p1[1:], (1, 1, 1))   # outside and inside of the trough
            mid = (A + Bp) / 2 + out * .3; outer = mid[0] < lo[0] or mid[0] > hi[0] or mid[2] < lo[2] or mid[2] > hi[2]
            if outer and ln > 4:                                                             # a downpipe near the start of each outer front
                top = base + d * .6 - np.array([0, r, 0]); cx = top - out * (OVER + .02 - .06); a2 = 2 * np.pi * np.arange(11) / 10; pr = .045
                ring2 = (out[None] * np.cos(a2)[:, None] + d[None] * np.sin(a2)[:, None]) * pr; lo_r = cx + ring2; lo_r[:, 1] = GROUND; hi_r = cx + ring2; hi_r[:, 1] = top[1]
                metal.add(lo_r[:-1], lo_r[1:], hi_r[1:], hi_r[:-1], (1, 1, 1))
            continue
        if len(L) == 2 and np.dot(L[1][3], cin - A) > .01: continue                          # a valley: the other plane rises over this one
        if A[1] > Bp[1]: A, Bp = Bp, A                                                       # caps are laid from the low end up
        d = unit(Bp - A); up = unit(np.array([0, 1., 0]) - d * d[1]); side = unit(np.cross(d, up)); m = max(1, int(round(ln / .4))); cl = ln / m
        ang = np.pi * np.arange(9) / 8; k = np.arange(m)
        def ring3(r, along): return (A[None, None] + d[None, None] * along[:, None, None] + side[None, None] * (np.cos(ang) * r)[None, :, None] + up[None, None] * (np.sin(ang) * r + LIFT)[None, :, None])
        r0, r1 = ring3(.125, k * cl), ring3(.105, (k + 1) * cl + .03); tn = hsh(k + k2[0], k2[1] % 97)
        tint = np.repeat(np.stack([.9 + .18 * tn, .88 + .15 * tn, .86 + .13 * tn], 1), 8, 0)
        tiles.add(r0[:, :-1].reshape(-1, 3), r1[:, :-1].reshape(-1, 3), r1[:, 1:].reshape(-1, 3), r0[:, 1:].reshape(-1, 3), tint)
    out = [tiles.part('Roof tile 3D', 'tile'), metal.part('Roof gutter Steel', 'iron')]
    print('roof: %d tile triangles, %d gutter/pipe triangles, %d eave edges' % (len(out[0]['I']), len(out[1]['I']), ne), flush=True)
    return out
