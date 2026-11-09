"""Unpack a project page's model parts (model-part-NN.js: base64 chunks pushed onto window.projectModelParts) into the GLB they
encode, for Blender. usage: python parts2glb.py <page dir> <out.glb>  -- prints what the GLB uses."""
import sys, os, re, base64, json, struct
d, out = sys.argv[1], sys.argv[2]
meta = open(os.path.join(d, 'model-data.js'), encoding='utf-8').read()
parts = json.loads(re.search(r'"parts":(\[[^\]]*\])', meta).group(1))
data = b''
for p in parts:
    t = open(os.path.join(d, p), encoding='utf-8').read()
    for m in re.finditer(r'push\("([^"]+)"\)', t): data += base64.b64decode(m.group(1))
print('bytes', len(data), 'magic', data[:4])
if data[:4] == b'glTF':
    jl = struct.unpack('<I', data[12:16])[0]; j = json.loads(data[20:20 + jl])
    print('extensions', j.get('extensionsUsed'), 'meshes', len(j.get('meshes', [])), 'nodes', len(j.get('nodes', [])))
open(out, 'wb').write(data)
