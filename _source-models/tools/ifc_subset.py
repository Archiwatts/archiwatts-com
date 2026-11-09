"""Takes the per-material GLB + manifest from ifc2venice.py and writes the elements of one building as a compact gzipped file for the
page (same container as site2web.py: b'TRW1', uint32 header length, JSON header {parts:[{mat, nv, nt, min, max}]}, then per part
uint16 quantised positions and uint32 indices). Material names come from stylenames.json (IFC style id -> Revit material).
usage: python ifc_subset.py <ifcout dir> <out.bin.gz> x0,z0,x1,z1 [exclude regex]"""
import sys, json, struct, gzip, re
import numpy as np
d, outp, box = sys.argv[1], sys.argv[2], [float(v) for v in sys.argv[3].split(',')]
EX = re.compile(sys.argv[4] if len(sys.argv) > 4 else r'^$', re.I)
b = open(d + '/model.glb', 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; gj = json.loads(b[20:20 + jl]); bin0 = 20 + jl + 8
names = json.load(open(d + '/stylenames.json'))['style']
def acc(i):
    a = gj['accessors'][i]; v = gj['bufferViews'][a['bufferView']]; o = bin0 + v['byteOffset']
    if a['componentType'] == 5126: return np.frombuffer(b, np.float32, a['count'] * 3, o).reshape(-1, 3)
    return np.frombuffer(b, np.uint32, a['count'], o)
mesh = {m['name'].split('__', 1)[1]: (acc(m['primitives'][0]['attributes']['POSITION']), acc(m['primitives'][0]['indices']).reshape(-1, 3)) for m in gj['meshes']}
man = [e for e in json.load(open(d + '/elements.json')) if 'mesh' in e]
take = {}
for e in man:
    c = [(e['min'][i] + e['max'][i]) / 2 for i in range(3)]
    if not (box[0] <= c[0] <= box[2] and box[1] <= c[2] <= box[3]): continue
    mat = names.get(e['mesh'], e['mesh'])
    if EX.search(e['cls'] + ' ' + (e['type'] or '') + ' ' + mat): continue
    take.setdefault(mat, []).append((e['mesh'], e['tri0'], e['tris']))
parts, blocks, tot = [], [], 0
for mat, L in sorted(take.items(), key=lambda kv: -sum(x[2] for x in kv[1])):
    I = np.concatenate([mesh[m][1][t0:t0 + n] for m, t0, n in L]); src = mesh[L[0][0]][0]
    # all ranges of one material come from the same source mesh
    used, inv = np.unique(I.ravel(), return_inverse=True); P = src[used].astype(np.float64); lo, hi = P.min(0), P.max(0)
    q = np.round((P - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')
    parts.append({'mat': mat, 'nv': len(P), 'nt': len(I), 'min': lo.round(4).tolist(), 'max': hi.round(4).tolist()})
    blocks += [q.tobytes(), inv.reshape(-1, 3).astype('<u4').tobytes()]; tot += len(I)
    print('%7d  %s' % (len(I), mat))
hdr = json.dumps({'parts': parts}, separators=(',', ':')).encode()
open(outp, 'wb').write(gzip.compress(b'TRW1' + struct.pack('<I', len(hdr)) + hdr + b''.join(blocks), 9))
print('total', tot)
