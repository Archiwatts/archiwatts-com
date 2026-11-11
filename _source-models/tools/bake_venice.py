"""Bakes sun + sky light (soft shadows, ambient occlusion and one bounce) for the Venice page's Real view.
No renderer needed: rays are cast with Open3D (Embree) against the page's own geometry, so the bake lines up with the web model.

  main building (main-apartment TRW1 file, the Revit rebuild): every flat face of a useful size gets its own patch in one lightmap
      image; small and curved pieces (railings, frames) get a light value per vertex instead
  context (the city and partner buildings, dumped from the running page as <name>.pos/.nrm/.idx): a light value per vertex, plus a
      top-down map (light on whatever is highest at each spot: roofs, streets, courtyards) for the up-facing surfaces

Light is stored as sqrt(L / 4) in 8 bits, L being the light a white matte surface would send back (1 = fully sunlit, facing the sun).
usage: python bake_venice.py <main-apartment.bin.gz> <context dump dir> <out dir> [texels per metre]"""
import sys, json, gzip, struct, time, os, re
import numpy as np, cv2, open3d as o3d
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

MAIN, CTX, OUT = sys.argv[1:4]
DENS = float(sys.argv[4]) if len(sys.argv) > 4 else 12.0
W, PAD = 4096, 2
QUICK = os.environ.get('QUICK') == '1'
NSKY_T, NSUN_T, NSKY_V, NSUN_V = (24, 4, 12, 2) if QUICK else (128, 24, 48, 6)
NSKY_C = 9 if QUICK else 36; CTX_ONLY = os.environ.get('CTX_ONLY') == '1'   # CTX_ONLY: redo only the context's per-vertex light
rng = np.random.default_rng(7); T0 = time.time()
def log(*a): print('[%5.0fs]' % (time.time() - T0), *a, flush=True)
def unit(v): v = np.asarray(v, np.float64); return v / np.linalg.norm(v)
SUN = unit([.78, .56, -.22]);   # mid-afternoon, from the side of the usual view: one street front in sun, the other in open shade
SUNC =np.array([1.0, .92, .79]) * 1.6; SUN_SPREAD = .018
def sky(d):   # radiance of the sky dome (and of the far ground for rays that leave downward)
    y = d[:, 1:2]; t = np.clip(1 - y, 0, 1) ** 3
    up = (np.array([.30, .47, .85]) * (1 - t) + np.array([.78, .84, .95]) * t) * .58
    return np.where(y >= 0, up, np.array([.30, .28, .25]))
AMB = .2

def look(n):   # same sorting as venice-look.js
    R = lambda p: re.search(p, n, re.I)
    if R('glass'): return 'glass'
    if R(r'^Default Wall$|^BRIVK$|t.gl.s|korall'): return 'wall'
    if R(r'BASE OUTSIDE|Concrete|Betont|Default Floor|^Finish$|^White$'): return 'wall' if R('Betont') else 'paving'
    if R('Default Roof'): return 'wall'
    if R(r'Sierra Pacific - VG Fir|Black 023|IfcWindow|Door - Frame|Aluminium|Aluminum|Sierra Pacific - White'): return 'frame'
    if R(r'Wood Planks|^Ash$|Door - Panel|divider doors'): return 'wood'
    if R('Wood - Painted White'): return 'whitewood'
    if R(r'Digger|IfcRailing|Kov.csoltvas|GATE|GAIT|Steel|Metal|Perforated|Chrome'): return 'iron'
    if R('Default 2'): return 'foliage'
    if R('Planter'): return 'planter'
    return None
ALB = {'wall': (.58, .42, .34), 'paving': (.68, .66, .61), 'frame': (.2, .21, .22), 'wood': (.5, .32, .18), 'whitewood': (.85, .83, .78),
       'iron': (.08, .08, .09), 'foliage': (.28, .42, .18), 'planter': (.6, .38, .27), 'glass': (.5, .6, .65), 'tile': (.6, .33, .2), 'ctx': (.72, .64, .52)}

# ---------- read the main building ----------
raw = gzip.open(MAIN).read(); hl = struct.unpack('<I', raw[4:8])[0]; hdr = json.loads(raw[8:8 + hl]); at = 8 + hl; parts = []
for p in hdr['parts']:
    q = np.frombuffer(raw, '<u2', p['nv'] * 3, at).reshape(-1, 3); at += p['nv'] * 6
    I = np.frombuffer(raw, '<u4', p['nt'] * 3, at).reshape(-1, 3).astype(np.int64); at += p['nt'] * 12
    lo, hi = np.array(p['min']), np.array(p['max']); kind = look(p['mat'])
    if kind: parts.append({'mat': p['mat'], 'kind': kind, 'P': lo + q / 65535.0 * (hi - lo), 'I': I})
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import venice_roof
if os.environ.get('NO_ROOF') != '1':
    rp = next(p for p in parts if p['mat'] == 'Default Roof'); parts += venice_roof.build(rp['P'], rp['I'])   # the modelled tile roof
log('main parts', len(parts), 'tris', sum(len(p['I']) for p in parts))

# ---------- read the context ----------
man = json.load(open(os.path.join(CTX, 'manifest.json'))); ctx = []
for m in man:
    f = lambda e, t: np.fromfile(os.path.join(CTX, m['name'] + '.' + e), t)
    ctx.append({'name': m['name'], 'P': f('pos', '<f4').reshape(-1, 3).astype(np.float64), 'N': f('nrm', '<f4').reshape(-1, 3).astype(np.float64), 'I': f('idx', '<u4').reshape(-1, 3).astype(np.int64)})
log('context meshes', len(ctx), 'tris', sum(len(c['I']) for c in ctx))

# ---------- the occluder scene (glass lets light through) ----------
V, T, A, off = [], [], [], 0
for p in parts:
    if p['kind'] == 'glass': continue
    V.append(p['P']); T.append(p['I'] + off); A.append(np.tile(ALB[p['kind']], (len(p['I']), 1))); off += len(p['P'])
for c in ctx:
    if c['name'] == 'Team_buildings__Glazing': continue
    V.append(c['P']); T.append(c['I'] + off); A.append(np.tile(ALB['foliage' if 'trees' in c['name'] else 'ctx'], (len(c['I']), 1))); off += len(c['P'])
V = np.concatenate(V).astype(np.float32); T = np.concatenate(T).astype(np.uint32); TALB = np.concatenate(A).astype(np.float32)
scene = o3d.t.geometry.RaycastingScene(); scene.add_triangles(o3d.core.Tensor(V), o3d.core.Tensor(T))
log('scene', len(V), 'verts', len(T), 'tris')
def cast(o, d):
    r = scene.cast_rays(o3d.core.Tensor(np.concatenate([o, d], 1).astype(np.float32)))
    return r['t_hit'].numpy(), r['primitive_ids'].numpy(), r['primitive_normals'].numpy()
def blocked(o, d):
    return scene.test_occlusions(o3d.core.Tensor(np.concatenate([o, d], 1).astype(np.float32))).numpy()

def frame(n):   # two unit vectors across each normal
    a = np.where(np.abs(n[:, 1:2]) < .95, np.array([[0., 1., 0.]]), np.array([[1., 0., 0.]]))
    u = np.cross(a, n); u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-12); return u, np.cross(n, u)

def light(P, N, nsky, nsun, lift=.02):
    """-> sun (0..1: how much direct sun arrives, cosine included), sky rgb (sky + bounced light), bad (the point is inside a solid)"""
    n_pts = len(P); sun = np.zeros(n_pts, np.float32); skyL = np.zeros((n_pts, 3), np.float32); bad = np.zeros(n_pts, bool)
    if SKIP: return sun, skyL, bad
    step = max(1000, int(2.5e6 / max(nsky, 1)))
    for s in range(0, n_pts, step):
        p = P[s:s + step]; n = N[s:s + step]; m = len(p); o = p + n * lift; u, v = frame(n)
        # sky and bounce: cosine-weighted directions over the hemisphere, stratified
        k = int(np.sqrt(nsky)); kk = k * k; j = np.arange(kk)
        r1 = ((j % k)[None, :] + rng.random((m, kk))) / k; r2 = ((j // k)[None, :] + rng.random((m, kk))) / k
        rr = np.sqrt(r1); ph = 2 * np.pi * r2; lx = rr * np.cos(ph); ly = rr * np.sin(ph); lz = np.sqrt(np.maximum(0, 1 - r1))
        d = (lx[..., None] * u[:, None, :] + ly[..., None] * v[:, None, :] + lz[..., None] * n[:, None, :]).reshape(-1, 3)
        oo = np.repeat(o, kk, 0); t, pid, pn = cast(oo, d); hit = np.isfinite(t)
        L = sky(d)
        if hit.any():
            hd = d[hit]; hn = pn[hit].astype(np.float64); back = (hn * hd).sum(1) > 0; hn[back] *= -1
            hp = oo[hit] + hd * t[hit][:, None] + hn * .02
            vis = ~blocked(hp, np.tile(SUN, (len(hp), 1)))
            E = SUNC[None, :] * (np.maximum((hn * SUN).sum(1), 0) * vis)[:, None] + AMB
            Lh = TALB[pid[hit]] * E; Lh[back] = 0
            L[hit] = Lh
            bf = np.zeros(len(d), bool); bf[hit] = back & (t[hit] < .6); bad[s:s + m] = bf.reshape(m, kk).mean(1) > .35
        skyL[s:s + m] = L.reshape(m, kk, 3).mean(1)
        # the sun: a small disc, so shadow edges are soft
        cs = np.maximum((n * SUN).sum(1), 0); lit = cs > 1e-3
        if lit.any():
            ml = int(lit.sum()); jd = unit(SUN)[None, None, :] + rng.normal(0, SUN_SPREAD, (ml, nsun, 3)); jd /= np.linalg.norm(jd, axis=2, keepdims=True)
            occ = blocked(np.repeat(o[lit], nsun, 0), jd.reshape(-1, 3)).reshape(ml, nsun)
            sv = np.zeros(m, np.float32); sv[lit] = (1 - occ.mean(1)) * cs[lit]; sun[s:s + m] = sv
    return sun, skyL, bad
SKIP = CTX_ONLY
def corner_light(P, I):
    """light per vertex, sampled a little inside each face the vertex belongs to (a vertex itself often sits buried where pieces meet)"""
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]; ng = np.cross(b - a, c - a); l = np.linalg.norm(ng, axis=1, keepdims=True); ng = np.where(l > 1e-12, ng / np.maximum(l, 1e-12), [0., 1., 0.])
    cen = (a + b + c) / 3; sp, vid = [], []
    for j in range(3):
        d = cen - P[I[:, j]]; dl = np.linalg.norm(d, axis=1, keepdims=True); sp.append(P[I[:, j]] + d * np.minimum(.25, .4 / np.maximum(dl, 1e-9))); vid.append(I[:, j])
    sp = np.concatenate(sp); sn = np.tile(ng, (3, 1)); vid = np.concatenate(vid)
    s, k, _ = light(sp, sn, NSKY_V, NSUN_V, lift=.015); s2, k2, _ = light(sp, -sn, NSKY_V, NSUN_V, lift=.015)
    flip = (s2 + k2.mean(1)) > (s + k.mean(1)); s[flip] = s2[flip]; k[flip] = k2[flip]
    cnt = np.maximum(np.bincount(vid, minlength=len(P)), 1)
    return np.bincount(vid, s, len(P)) / cnt, np.stack([np.bincount(vid, k[:, j], len(P)) / cnt for j in range(3)], 1)
enc = lambda L: np.clip(np.sqrt(np.clip(L, 0, 4) / 4) * 255 + .5, 0, 255).astype(np.uint8)

# ---------- main building: flat patches (charts) ----------
for p in parts:
    P, I = p['P'], p['I']; a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]; n = np.cross(b - a, c - a); ar = np.linalg.norm(n, axis=1) / 2; n = n / np.maximum(2 * ar, 1e-12)[:, None]
    key = np.c_[np.round(n * 50), np.round((n * a).sum(1) * 25)].astype(np.int64)
    _, g = np.unique(key, axis=0, return_inverse=True); g = g.ravel()
    node, ninv = np.unique(g[:, None] * len(P) + I, return_inverse=True); ninv = ninv.reshape(-1, 3)   # (plane, vertex) pairs
    nn = len(node); e0 = np.r_[ninv[:, 0], ninv[:, 1]]; e1 = np.r_[ninv[:, 1], ninv[:, 2]]
    nc, lab = connected_components(coo_matrix((np.ones(len(e0), np.int8), (e0, e1)), shape=(nn, nn)), directed=False)
    tc = lab[ninv[:, 0]]                                                     # chart of each triangle
    cn = np.zeros((nc, 3)); np.add.at(cn, tc, n * ar[:, None]); ca = np.bincount(tc, ar, nc); cn /= np.maximum(np.linalg.norm(cn, axis=1, keepdims=True), 1e-12)
    cu, cv_ = frame(cn); npos = P[node % len(P)]; nl = lab                     # node -> its chart
    uu = (npos * cu[nl]).sum(1); vv = (npos * cv_[nl]).sum(1); dd = (npos * cn[nl]).sum(1)
    mn = lambda x: np.minimum.reduceat(x[o_], st); mx = lambda x: np.maximum.reduceat(x[o_], st)
    o_ = np.argsort(nl, kind='stable'); st = np.r_[0, np.flatnonzero(np.diff(nl[o_])) + 1]
    u0, u1, v0, v1 = mn(uu), mx(uu), mn(vv), mx(vv); cd = np.bincount(nl, dd, nc) / np.maximum(np.bincount(nl, minlength=nc), 1)
    ok = (ca >= .3) & (np.minimum(u1 - u0, v1 - v0) >= .12) if p['kind'] != 'glass' and not p.get('vert') else np.zeros(nc, bool)
    p.update(n=n, ar=ar, ninv=ninv, node=node, tc=tc, nl=nl, uu=uu, vv=vv, ok=ok, cn=cn, cu=cu, cv=cv_, cd=cd, u0=u0, v0=v0, du=u1 - u0, dv=v1 - v0, ca=ca)
log('charts', sum(len(p['ok']) for p in parts), 'lightmapped', sum(int(p['ok'].sum()) for p in parts), 'area m2', round(sum(float(p['ca'][p['ok']].sum()) for p in parts)), 'of', round(sum(float(p['ca'].sum()) for p in parts)))

# ---------- pack the patches into one image ----------
while True:
    rects = []
    for pi, p in enumerate(parts):
        p['cdens'] = np.minimum(DENS, 900 / np.maximum(np.maximum(p['du'], p['dv']), 1e-6))   # a very large face (the site slab) gets a coarser patch
        for ci in np.flatnonzero(p['ok']): rects.append((int(np.ceil(p['dv'][ci] * p['cdens'][ci])) + 1 + 2 * PAD, int(np.ceil(p['du'][ci] * p['cdens'][ci])) + 1 + 2 * PAD, pi, ci))
    rects.sort(reverse=True); x = y = sh = 0; place = {}
    for h, w, pi, ci in rects:
        if w > W: w = W
        if x + w > W: x = 0; y += sh; sh = 0
        place[(pi, ci)] = (x, y); x += w; sh = max(sh, h)
    H = y + sh
    if H <= 4096: break
    DENS *= max(.8, min(.95, np.sqrt(4096 / H))); log('atlas too tall (%d), density -> %.2f' % (H, DENS))
H = int(np.ceil(H / 4) * 4); log('atlas', W, 'x', H, 'at', round(DENS, 2), 'texels/m,', len(rects), 'patches')

owner = np.full((H, W), -1, np.int32); CH = []   # CH: per global chart id -> (origin point, u, v, n)
for p_i, p in enumerate(parts):
    p['ax'] = np.zeros(len(p['ok'])); p['ay'] = np.zeros(len(p['ok'])); p['gid'] = np.full(len(p['ok']), -1)
    for ci in np.flatnonzero(p['ok']):
        ax, ay = place[(p_i, ci)]; p['ax'][ci], p['ay'][ci] = ax, ay; p['gid'][ci] = len(CH)
        CH.append((p['cn'][ci] * p['cd'][ci] + p['cu'][ci] * p['u0'][ci] + p['cv'][ci] * p['v0'][ci], p['cu'][ci], p['cv'][ci], p['cn'][ci], ax + PAD, ay + PAD, p['cdens'][ci]))
    # texel coordinates of every (plane, vertex) node
    p['tx'] = (p['uu'] - p['u0'][p['nl']]) * p['cdens'][p['nl']] + PAD + p['ax'][p['nl']]; p['ty'] = (p['vv'] - p['v0'][p['nl']]) * p['cdens'][p['nl']] + PAD + p['ay'][p['nl']]
    for t in np.flatnonzero(p['ok'][p['tc']]):
        k = p['ninv'][t]; pts = np.round(np.c_[p['tx'][k] - .5, p['ty'][k] - .5] * 16).astype(np.int32)
        cv2.fillConvexPoly(owner, pts, int(p['gid'][p['tc'][t]]), lineType=cv2.LINE_8, shift=4)
owner = cv2.dilate((owner + 1).astype(np.float32), np.ones((3, 3), np.uint8)).astype(np.int32) - 1
ys, xs = np.nonzero(owner >= 0); cid = owner[ys, xs]; log('texels to light', len(ys))
CO = np.array([c[0] for c in CH]); CU = np.array([c[1] for c in CH]); CV = np.array([c[2] for c in CH]); CN = np.array([c[3] for c in CH]); CX = np.array([c[4] for c in CH]); CY = np.array([c[5] for c in CH]); CD = np.array([c[6] for c in CH])
TP = CO[cid] + CU[cid] * ((xs + .5 - CX[cid]) / CD[cid])[:, None] + CV[cid] * ((ys + .5 - CY[cid]) / CD[cid])[:, None]
# the site slab lies a little under the city's street level (3.1 m): its light is taken just above the street, not from underneath it
low = (CN[cid][:, 1] > .9) & (TP[:, 1] < 3.2); TP[low, 1] = 3.14
sun, skyL, bad = light(TP, CN[cid], NSKY_T, NSUN_T); log('lightmap lit;', int(bad.sum()), 'texels inside solids')
good = np.zeros((H, W), np.uint8); good[ys[~bad], xs[~bad]] = 1
img = np.zeros((H, W, 4), np.float32); img[ys, xs, :3] = skyL; img[ys, xs, 3] = sun; img[good == 0] = 0
# soften the sampling noise inside each patch (sky part a little more than the sun part), then fill the gaps from the nearest lit texel
gm = good.astype(np.float32)
for ch, sg in ((0, 1.1), (1, 1.1), (2, 1.1), (3, .6)):
    b = cv2.GaussianBlur(img[..., ch] * gm, (0, 0), sg) / np.maximum(cv2.GaussianBlur(gm, (0, 0), sg), 1e-4); img[..., ch] = np.where(good == 1, b, 0)
_, lbl = cv2.distanceTransformWithLabels(1 - good, cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
gy, gx = np.nonzero(good); look_y = np.zeros(lbl.max() + 1, np.int32); look_x = np.zeros(lbl.max() + 1, np.int32); look_y[lbl[gy, gx]] = gy; look_x[lbl[gy, gx]] = gx
img = img[look_y[lbl], look_x[lbl]]
atlas = enc(img[..., :3] + img[..., 3:4] * SUNC[None, None, :].astype(np.float32))
if not CTX_ONLY: cv2.imwrite(os.path.join(OUT, 'real-light.png'), atlas[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9]); log('wrote real-light.png')

# ---------- main building: output geometry (patch vertices carry lightmap coordinates, the rest a light colour) ----------
out_parts, blocks = [], []
for p in parts:
    P, I = p['P'], p['I']; lm_t = p['ok'][p['tc']]; nlm = p['ninv'][lm_t]; used, inv = np.unique(nlm, return_inverse=True)
    lpos = P[p['node'][used] % len(P)]; luv = np.c_[p['tx'][used] / W, 1 - p['ty'][used] / H]; lidx = inv.reshape(-1, 3)
    vI = I[~lm_t]; vu, vinv = np.unique(vI, return_inverse=True); vpos = P[vu]; vidx = vinv.reshape(-1, 3) + len(lpos)
    vn = np.zeros((len(vu), 3)); wn = p['n'][~lm_t] * p['ar'][~lm_t][:, None]
    for k in range(3): np.add.at(vn, vinv.reshape(-1, 3)[:, k], wn)
    vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-9); bad_n = np.linalg.norm(vn, axis=1) < .5; vn[bad_n] = [0, 1, 0]
    col = np.zeros((len(lpos) + len(vpos), 4), np.uint8)
    if len(vpos):
        if p.get('vert'): s, k = corner_light(vpos, vidx - len(lpos)); tint = p['tint'][vu]
        else: s, k, _ = light(vpos, vn, NSKY_V, NSUN_V, lift=.03); tint = 1.
        col[len(lpos):, :3] = enc((k + s[:, None] * SUNC[None, :]) * tint); col[len(lpos):, 3] = 255
    pos = np.concatenate([lpos, vpos]); uv = np.concatenate([luv, np.zeros((len(vpos), 2))]); idx = np.concatenate([lidx, vidx]).astype('<u4')
    lo, hi = pos.min(0), pos.max(0); q = np.round((pos - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2'); quv = np.round(np.clip(uv, 0, 1) * 65535).astype('<u2')
    out_parts.append({'mat': p['mat'], 'nv': len(pos), 'nt': len(idx), 'min': lo.round(4).tolist(), 'max': hi.round(4).tolist()})
    blocks += [q.tobytes(), quv.tobytes(), col.tobytes(), idx.tobytes()]
h = json.dumps({'parts': out_parts, 'atlas': [W, H], 'sun': SUN.round(4).tolist(), 'sunColor': SUNC.round(3).tolist()}, separators=(',', ':')).encode()
if not CTX_ONLY: open(os.path.join(OUT, 'real-main.bin.gz'), 'wb').write(gzip.compress(b'TRW2' + struct.pack('<I', len(h)) + h + b''.join(blocks), 6))
log('wrote real-main.bin.gz', sum(p['nv'] for p in out_parts), 'verts', sum(p['nt'] for p in out_parts), 'tris')
if os.environ.get('MAIN_ONLY') == '1': sys.exit(0)   # the context's light is left as it is

# ---------- context: a top-down light map, and light per vertex ----------
allp = np.concatenate([c['P'] for c in ctx if 'Water' not in c['name']]); lo2 = np.floor(allp[:, [0, 2]].min(0)); hi2 = np.ceil(allp[:, [0, 2]].max(0)); RES = .4
gw, gh = [int(v) for v in np.ceil((hi2 - lo2) / RES)]; sc = max(gw, gh) / 4096
if sc > 1: RES *= sc; gw, gh = [int(v) for v in np.ceil((hi2 - lo2) / RES)]
gx, gz = np.meshgrid(lo2[0] + (np.arange(gw) + .5) * RES, lo2[1] + (np.arange(gh) + .5) * RES); n_px = gw * gh
o = np.c_[gx.ravel(), np.full(n_px, 400.), gz.ravel()]; t = np.zeros(n_px, np.float32); pn = np.zeros((n_px, 3), np.float32)
for s in range(0, n_px, 4000000):
    t[s:s + 4000000], _, pn[s:s + 4000000] = cast(o[s:s + 4000000], np.tile([0., -1., 0.], (len(o[s:s + 4000000]), 1)))
hit = np.isfinite(t); hp = o[hit] - np.c_[np.zeros(hit.sum()), t[hit], np.zeros(hit.sum())]; hn = pn[hit].astype(np.float64); hn[hn[:, 1] < 0] *= -1
s, k, _ = light(hp, hn, NSKY_V + 16, NSUN_V + 10, lift=.03); YMAX = 64.0
top = np.zeros((n_px, 3), np.uint8); top[:, 0] = 255; top[:, 1] = enc(np.array([1.2]))[0]
top[hit, 0] = enc(s * 4); top[hit, 1] = enc(k.mean(1) * 4); top[hit, 2] = np.clip(hp[:, 1] / YMAX * 255 + .5, 0, 255).astype(np.uint8)
if not CTX_ONLY: cv2.imwrite(os.path.join(OUT, 'real-ground.png'), top.reshape(gh, gw, 3)[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9]); log('wrote real-ground.png', gw, 'x', gh, 'at', round(RES, 3), 'm')
metas, vb = [], []; SKIP = False
for c in ctx:
    if re.search(r'_(frame|trees|wood)$', c['name']): continue   # these share their vertices with the mesh they were split from
    # A vertex sits where walls meet, often buried in the neighbouring wall, so light is sampled a little inside each face it belongs
    # to (a quarter of the way to the face's centre, at most 0.4 m) and averaged per vertex. Some exports have faces wound inside
    # out: both sides are lit and the open one kept.
    I = np.concatenate([d['I'] for d in ctx if d['name'] == c['name'] or re.sub(r'_(frame|trees|wood)$', '', d['name']) == c['name']])
    P = c['P']; a, b, cc = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]; ng = np.cross(b - a, cc - a); ok = np.linalg.norm(ng, axis=1) > 1e-9; I = I[ok]; ng = ng[ok] / np.linalg.norm(ng[ok], axis=1, keepdims=True)
    cen = (P[I[:, 0]] + P[I[:, 1]] + P[I[:, 2]]) / 3; sp, sn = [], []
    for j in range(3):
        d = cen - P[I[:, j]]; dl = np.linalg.norm(d, axis=1, keepdims=True); sp.append(P[I[:, j]] + d * np.minimum(.25, .4 / np.maximum(dl, 1e-9))); sn.append(ng)
    sp = np.concatenate(sp); sn = np.concatenate(sn); vid = np.concatenate([I[:, 0], I[:, 1], I[:, 2]])
    s, k, _ = light(sp, sn, NSKY_C, NSUN_V, lift=.03); s2, k2, _ = light(sp, -sn, NSKY_C, NSUN_V, lift=.03)
    flip = (s2 + k2.mean(1)) > (s + k.mean(1)); s[flip] = s2[flip]; k[flip] = k2[flip]
    cnt = np.maximum(np.bincount(vid, minlength=len(P)), 1); s = np.bincount(vid, s, len(P)) / cnt; k = (np.bincount(vid, k.mean(1), len(P)) / cnt)[:, None]
    vb.append(np.c_[enc(s * 4), enc(k.mean(1) * 4)].astype(np.uint8).tobytes()); metas.append({'name': c['name'], 'nv': len(c['P'])}); log('  context', c['name'], len(c['P']))
h = json.dumps({'meshes': metas, 'top': {'min': lo2.tolist(), 'res': RES, 'n': [gw, gh], 'ymax': YMAX}, 'sun': SUN.round(4).tolist(), 'sunColor': SUNC.round(3).tolist()}, separators=(',', ':')).encode()
open(os.path.join(OUT, 'real-context.bin.gz'), 'wb').write(gzip.compress(b'VRC1' + struct.pack('<I', len(h)) + h + b''.join(vb), 6))
log('wrote real-context.bin.gz; done')
