"""Rebuild the North Beach model parts without the old FBX building: the city context, landscape and water keep their exact (decoded)
quantized data, the building meshes shrink to one empty triangle (their nodes and materials stay, nbyc-ifc.js swaps in the Revit geometry).
Usage: python slim_parts.py <page dir> <dir with ctx_*.bin dumps>"""
import sys, os, re, json, struct, base64
import numpy as np
page, dumps = sys.argv[1], sys.argv[2]
s = open(os.path.join(page, 'model-part-01.js')).read()
b = base64.b64decode(re.search(r'push\("([^"]+)"', s).group(1))
n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n])
KEEP = {'Youth center / Landscape': 'Youth_center__Landscape', 'Youth center / Water': 'Youth_center__Water', 'Site context / Context': 'Site_context__Context'}
CT = {np.dtype('int16'): 5122, np.dtype('uint16'): 5123, np.dtype('uint32'): 5125}
def load(name, k, dt):
    return np.fromfile(os.path.join(dumps, 'ctx_%s_%s.bin' % (name, k)), dtype=dt)
data, views, accs = [], [], []
def view(arr, target, stride=None):
    raw = arr.tobytes(); raw += b'\0' * ((-len(raw)) % 4)
    v = {'buffer': 0, 'byteOffset': sum(len(d) for d in data), 'byteLength': arr.nbytes, 'target': target}
    if stride: v['byteStride'] = stride
    data.append(raw); views.append(v); return len(views) - 1
old = j['accessors']; tris = 0
for m in j['meshes']:
    pr = m['primitives'][0]; po = old[pr['attributes']['POSITION']]
    if m['name'] in KEEP:
        nm = KEEP[m['name']]; P = load(nm, 'pos', np.int16); N = load(nm, 'nrm', np.int16)
        I = load(nm, 'idx', np.uint32 if old[pr['indices']]['componentType'] == 5125 else np.uint16)
        mn, mx = po['min'], po['max']
    else:
        P = np.zeros(9, np.int16); N = np.array([0, 32767, 0] * 3, np.int16); I = np.array([0, 1, 2], np.uint16); mn = mx = [0, 0, 0]
    cnt = len(P) // 3
    # quantized int16 VEC3 attributes must be padded to 4 components per vertex (8-byte stride)
    P4 = np.zeros((cnt, 4), np.int16); P4[:, :3] = P.reshape(-1, 3); N4 = np.zeros((cnt, 4), np.int16); N4[:, :3] = N.reshape(-1, 3)
    accs.append({'bufferView': view(P4, 34962, 8), 'componentType': 5122, 'normalized': True, 'count': cnt, 'type': 'VEC3', 'min': mn, 'max': mx})
    accs.append({'bufferView': view(N4, 34962, 8), 'componentType': 5122, 'normalized': True, 'count': cnt, 'type': 'VEC3'})
    accs.append({'bufferView': view(I, 34963), 'componentType': CT[I.dtype], 'count': int(len(I)), 'type': 'SCALAR'})
    pr['attributes'] = {'POSITION': len(accs) - 3, 'NORMAL': len(accs) - 2}; pr['indices'] = len(accs) - 1; tris += len(I) // 3
j['accessors'] = accs; j['bufferViews'] = views
bn = b''.join(data); j['buffers'] = [{'byteLength': len(bn)}]
j['extensionsUsed'] = ['KHR_mesh_quantization']; j['extensionsRequired'] = ['KHR_mesh_quantization']
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
glb = struct.pack('<4sII', b'glTF', 2, 28 + len(js) + len(bn)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bn), b'BIN\0') + bn
open(os.path.join(page, 'model-part-01.js'), 'w').write('window.projectModelParts.push("' + base64.b64encode(glb).decode() + '");\n')
if os.path.exists(os.path.join(page, 'model-part-02.js')): os.remove(os.path.join(page, 'model-part-02.js'))
md = open(os.path.join(page, 'model-data.js')).read()
md = re.sub(r'"parts":\[[^\]]*\]', '"parts":["model-part-01.js"]', md)
md = re.sub(r'"triangles":\d+', '"triangles":%d' % tris, md); md = re.sub(r'"compressedBytes":\d+', '"compressedBytes":%d' % len(glb), md)
open(os.path.join(page, 'model-data.js'), 'w').write(md)
print('glb', round(len(glb) / 1e6, 2), 'MB', tris, 'triangles')
