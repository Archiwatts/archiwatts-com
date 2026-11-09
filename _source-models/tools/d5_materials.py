"""Read the D5 Render project's scene (asset/1.save, JSON) and list every material: its name and the parameters that matter for the web
(base colour, roughness, metallic, opacity, texture maps and their tiling). Writes d5_materials.json next to the save file.
usage: python d5_materials.py <d5 asset folder>"""
import json, os, sys, re

A = sys.argv[1]
S = json.load(open(os.path.join(A, '1.save'), encoding='utf-8-sig'))
out = {}

def walk(o):
    if isinstance(o, dict):
        if 'matInfo' in o and 'title' in o:
            try: info = json.loads(o['matInfo'])
            except Exception: info = []
            p = {i.get('name'): i.get('value') for i in info if isinstance(i, dict)}
            key = o.get('title') or o.get('id')
            if key not in out: out[key] = {'id': o.get('id'), 'ue': o.get('uePath'), 'params': p}
        for k, v in o.items():
            if isinstance(v, str) and v[:1] in '[{' and ('matInfo' in v or 'materialData' in v):
                try: walk(json.loads(v))
                except Exception: pass
            else: walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)

walk(S)
json.dump(out, open(os.path.join(A, 'd5_materials.json'), 'w'), indent=1)
for k, v in out.items():
    p = v['params']
    def g(*names):
        for n in names:
            for pk in p:
                if pk and n.lower() in pk.lower(): return p[pk]
        return ''
    print('%-38s | col %-40s | rough %-10s | diff %s' % (k[:38], str(g('Base Color', 'Color', 'Tint'))[:40], str(g('Roughness'))[:10], os.path.basename(str(g('Diffuse Map', 'Albedo')))[:60]))
print(len(out), 'materials')
