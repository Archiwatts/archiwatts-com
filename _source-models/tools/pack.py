"""model.glb (from ifc2glb.py) -> compact web binary: per category, chunks of <= 65k vertices, 16-bit quantized positions, 16-bit indices.
Layout: uint32 header length, header JSON (padded to 4), then the data. Triangle order is kept, so elements.json ranges stay valid.
Usage: python pack.py model.glb out.bin"""
import sys, json, struct
import numpy as np
b = open(sys.argv[1], 'rb').read()
n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); bin0 = 20 + n + 8
def acc(i, dt, w):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    return np.frombuffer(b, dtype=dt, count=a['count'] * w, offset=bin0 + v['byteOffset']).reshape(-1, w) if w > 1 else np.frombuffer(b, dtype=dt, count=a['count'], offset=bin0 + v['byteOffset'])
meshes, data, off = [], [], 0
def put(arr):
    global off
    raw = arr.tobytes(); raw += b'\0' * ((-len(raw)) % 4); data.append(raw); o = off; off += len(raw); return o
for m in j['meshes']:
    pr = m['primitives'][0]; P = acc(pr['attributes']['POSITION'], np.float32, 3); I = acc(pr['indices'], np.uint32, 1).reshape(-1, 3)
    chunks, t = [], 0
    while t < len(I):
        step = min(len(I) - t, 21000)
        while True:
            blk = I[t:t + step]; u, inv = np.unique(blk.ravel(), return_inverse=True)
            if len(u) <= 65535: break
            step //= 2
        p = P[u]; mn = p.min(0); sc = np.maximum(p.max(0) - mn, 1e-6) / 65535.
        q = np.round((p - mn) / sc).astype(np.uint16)
        chunks.append({'v': int(len(u)), 'i': int(blk.size), 'pos': put(q), 'idx': put(inv.astype(np.uint16)), 'min': mn.tolist(), 'scale': sc.tolist()})
        t += step
    meshes.append({'name': m['name'], 'chunks': chunks})
hdr = json.dumps({'meshes': meshes}).encode(); hdr += b' ' * ((-len(hdr)) % 4)
with open(sys.argv[2], 'wb') as fh:
    fh.write(struct.pack('<I', len(hdr)) + hdr + b''.join(data))
print('packed', round((4 + len(hdr) + off) / 1e6, 1), 'MB', sum(len(m['chunks']) for m in meshes), 'chunks')
