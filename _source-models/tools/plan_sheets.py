"""Markup plan sheets for the guided-tour route: horizontal cuts through the Revit export (tris.bin) at each level, drawn in the
web page's own site coordinates (metres) on a shared grid, so a route drawn across sheets lines up floor to floor.
Output: _source-models/north-beach-youth-center/plan-sheets/*.png"""
import os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

ROOT = os.path.join(os.path.dirname(__file__), '..', 'north-beach-youth-center')
OUT = os.path.join(ROOT, 'plan-sheets'); os.makedirs(OUT, exist_ok=True)
rec = np.dtype([('m', '<i4'), ('e', '<i4'), ('p', '<f8', (9,))])
T = np.memmap(os.path.join(ROOT, 'revit', 'tris.bin'), dtype=rec, mode='r')
FT = .3048
# Revit feet -> page metres: x = rx*.3048 + 35.6, z = 53.4 - ry*.3048; height above grade in feet = rz
SITE = (-150, 80, -40, 130); BLDG = (-100, 12, 8, 76)
SHEETS = [  # name, cut height (ft above grade), extent, faint floor band (ft)
    ('0-site-plan', 4, SITE, (-3, 4)),
    ('1-ground-level', 4, BLDG, (-3, 4)),
    ('2-skate-juice-bar-level', 14, BLDG, (7, 14)),
    ('3-main-level-20ft', 24, BLDG, (18, 24)),
    ('4-classroom-gym-level-36ft', 40, BLDG, (31, 40)),
    ('5-level-5-56ft', 59, BLDG, (54, 59)),
]

def chunks(n=2_000_000):
    for i in range(0, len(T), n):
        yield np.asarray(T[i:i + n]['p'])

def run(name, h, ext, band):
    segs, fills = [], []
    for P in chunks():
        P = P.reshape(-1, 3, 3)
        z = P[:, :, 2]
        lo, hi = z.min(1), z.max(1)
        # faint: near-flat faces (floors, slabs, ramps, paving) between band[0] and the cut
        flat = (hi - lo < 1.5) & (hi > band[0]) & (hi < h)
        F = P[flat]
        if len(F): fills.append(F[:, :, :2])
        # cut lines
        c = P[(lo < h) & (hi > h)]
        if not len(c): continue
        a, b, d = c[:, 0], c[:, 1], c[:, 2]
        pts = []
        for u, v in ((a, b), (b, d), (d, a)):
            t = (h - u[:, 2]) / np.where(v[:, 2] - u[:, 2] == 0, 1e-9, v[:, 2] - u[:, 2])
            ok = (t >= 0) & (t <= 1)
            q = u[:, :2] + (v[:, :2] - u[:, :2]) * t[:, None]
            pts.append(np.where(ok[:, None], q, np.nan))
        pts = np.stack(pts, 1)
        for i in range(len(pts)):
            r = pts[i][~np.isnan(pts[i][:, 0])]
            if len(r) >= 2: segs.append(r[:2])
    def tx(xy): return np.stack([xy[..., 0] * FT + 35.6, 53.4 - xy[..., 1] * FT], -1)
    w = ext[1] - ext[0]; hgt = ext[3] - ext[2]
    fig = plt.figure(figsize=(17, 17 * hgt / w + 1.2), dpi=110)
    ax = fig.add_axes([.04, .06, .92, .86])
    if fills:
        from matplotlib.collections import PolyCollection
        Fa = tx(np.concatenate(fills))
        keep = (Fa[:, :, 0].max(1) > ext[0]) & (Fa[:, :, 0].min(1) < ext[1]) & (Fa[:, :, 1].max(1) > ext[2]) & (Fa[:, :, 1].min(1) < ext[3])
        ax.add_collection(PolyCollection(Fa[keep], facecolors='#e9e6df', edgecolors='#d5d1c8', linewidths=.15))
    if segs:
        S = tx(np.array(segs))
        ax.add_collection(LineCollection(S, colors='#1c1c1c', linewidths=.55))
    ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[3], ext[2])   # page +z is south; draw north up
    ax.set_aspect('equal')
    step = 10 if ext is SITE else 5
    ax.set_xticks(np.arange(np.ceil(ext[0] / step) * step, ext[1] + 1, step)); ax.set_yticks(np.arange(np.ceil(ext[2] / step) * step, ext[3] + 1, step))
    ax.grid(color='#9ec3d9', lw=.4, alpha=.6); ax.tick_params(labelsize=7, colors='#557')
    title = name.split('-', 1)[1].replace('-', ' ').upper()
    fig.text(.04, .955, 'NORTH BEACH YOUTH CENTER  |  %s  |  cut at %d ft above grade' % (title, h), fontsize=14, weight='bold')
    fig.text(.04, .935, 'Mark: walk START, END, the path (and which ramp/stair goes up or down), and named STOPS.  Grid in metres (page coordinates).  North is up.', fontsize=9, color='#444')
    ax.annotate('N', xy=(.975, .97), xycoords='axes fraction', ha='center', fontsize=14, weight='bold')
    ax.annotate('', xy=(.975, .995), xytext=(.975, .93), xycoords='axes fraction', arrowprops=dict(arrowstyle='-|>', lw=1.5))
    if ext is SITE:
        for lbl, x, z in (('ALLEY (north)', -40, -23), ('MAIN AVENUE (beach side)', -40, 83.6), ('BEACH', -40, 118)):
            ax.text(x, z, lbl, ha='center', va='center', fontsize=10, color='#a33', weight='bold', bbox=dict(fc='white', ec='none', alpha=.7))
    fig.savefig(os.path.join(OUT, name + '.png')); plt.close(fig)
    print(name, len(segs))

for s in SHEETS: run(*s)
