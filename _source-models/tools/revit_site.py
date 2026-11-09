# -*- coding: utf-8 -*-
"""Exact site geometry out of a Revit model, run inside Revit through `pyrevit run`.
Reads <model folder>/site_ids.json: {"terrain": [element ids], "palms": [element ids]} and writes two files next to the model:
 <model>.terrain.json: element id -> material -> flat triangle corners, page metres (x = Revit x, y = Revit z, z = -Revit y)
 <model>.palms.json:   {"templates": {symbol id: material -> flat triangle corners in the family's own (local) feet},
                        "instances": [[symbol id, origin xyz, basis x xyz, basis y xyz, basis z xyz], ...]} (Revit feet)
Each distinct palm shape is written once; the file is streamed so big models do not exhaust memory.
Meshes and solids are both read."""
import io, json, System
from Autodesk.Revit.DB import *
try: doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception: doc = __revit__.ActiveUIDocument.Document
base = __models__[0]
IDS = json.loads(io.open(base[:base.rfind('\\') + 1] + 'site_ids.json', encoding='utf-8').read())
F = 0.3048
opt = Options(); opt.DetailLevel = ViewDetailLevel.Fine
import traceback
ERR = io.open(base + '.site.err.txt', 'w', encoding='utf-8')
def bad(tag):
    ERR.write(unicode(tag) + u'\n' + unicode(traceback.format_exc()) + u'\n'); ERR.flush()

def eid(i):
    try: return ElementId(System.Int64(i))
    except Exception: return ElementId(i)

def walk(g, out):
    for o in g:
        if isinstance(o, Solid):
            if o.Faces.Size: out.append(o)
        elif isinstance(o, Mesh): out.append(o)
        elif isinstance(o, GeometryInstance): walk(o.GetInstanceGeometry(), out)

def corners(items, conv, nd):
    res = {}
    for s in items:
        if isinstance(s, Mesh):
            L = res.setdefault('', [])
            for k in range(s.NumTriangles):
                t = s.get_Triangle(k)
                for j in range(3): L.extend(conv(t.get_Vertex(j), nd))
        else:
            for f in s.Faces:
                m = doc.GetElement(f.MaterialElementId); name = m.Name if m else ''
                mesh = f.Triangulate(); L = res.setdefault(name, [])
                for k in range(mesh.NumTriangles):
                    t = mesh.get_Triangle(k)
                    for j in range(3): L.extend(conv(t.get_Vertex(j), nd))
    return res

def page(p, nd): return [round(p.X * F, nd), round(p.Z * F, nd), round(-p.Y * F, nd)]
def raw(p, nd): return [round(p.X, nd), round(p.Y, nd), round(p.Z, nd)]

def put(fo, key, res, first):
    fo.write(('' if first else u',') + u'"%s":{' % key)
    fo.write(u','.join(u'"%s":[%s]' % (k.replace('"', ''), u','.join(repr(v) for v in L)) for k, L in res.items()))
    fo.write(u'}')


# terrain
fo = io.open(base + '.terrain.json', 'w', encoding='utf-8'); fo.write(u'{'); first = True
for i in [int(x) for x in IDS['terrain']]:
    e = doc.GetElement(eid(i))
    if e is None: continue
    try:
        items = []; walk(e.get_Geometry(opt), items); res = corners(items, page, 3)
    except Exception: continue
    put(fo, str(i), res, first); first = False; fo.flush()
fo.write(u'}'); fo.close()

# palms: one template per symbol, a placement per element
fo = io.open(base + '.palms.json', 'w', encoding='utf-8'); fo.write(u'{"templates":{'); first = True; done = set(); inst = []
for i in [int(x) for x in IDS['palms']]:
    e = doc.GetElement(eid(i))
    if e is None: continue
    try:
        for gi in e.get_Geometry(opt):
            if not isinstance(gi, GeometryInstance): continue
            sid = str(gi.GetSymbolGeometryId().SymbolId)
            t = gi.Transform
            inst.append([sid] + raw(t.Origin, 4) + raw(t.BasisX, 5) + raw(t.BasisY, 5) + raw(t.BasisZ, 5))
            if sid not in done:
                done.add(sid); items = []; walk(gi.GetSymbolGeometry(), items)
                put(fo, sid, corners(items, raw, 4), first); first = False; fo.flush()
            break
    except Exception: bad('palm %d' % i); continue
fo.write(u'},"instances":' + json.dumps(inst) + u'}'); fo.close()
