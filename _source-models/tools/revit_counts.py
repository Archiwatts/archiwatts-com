# -*- coding: utf-8 -*-
"""Triangle counts per element and material (no coordinates), run inside Revit through `pyrevit run`; IDS are read from ids.txt next to
the model. Used to see how detailed Revit's own geometry is before deciding what to re-export. Writes <model>.counts.json."""
import io, System
from Autodesk.Revit.DB import *
try: doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception: doc = __revit__.ActiveUIDocument.Document
base = __models__[0]
IDS = [int(x) for x in io.open(base[:base.rfind('\\') + 1] + 'ids.txt').read().split(',') if x]
def solids(g):
    for o in g:
        if isinstance(o, Solid) and o.Faces.Size: yield o
        elif isinstance(o, Mesh): yield o                       # imported meshes (SketchUp symbols and the like)
        elif isinstance(o, GeometryInstance):
            for s in solids(o.GetInstanceGeometry()): yield s
opt = Options(); opt.DetailLevel = ViewDetailLevel.Fine
rows = []
for i in IDS:
    try: eid = ElementId(System.Int64(i))
    except Exception: eid = ElementId(i)
    e = doc.GetElement(eid)
    if e is None: continue
    n = 0; faces = 0; mats = {}
    try:
        for s in solids(e.get_Geometry(opt)):
            if isinstance(s, Mesh):
                n += s.NumTriangles; faces += 1; mats[''] = mats.get('', 0) + s.NumTriangles; continue
            for f in s.Faces:
                m = doc.GetElement(f.MaterialElementId); nm = m.Name if m else ''
                t = f.Triangulate().NumTriangles; n += t; faces += 1; mats[nm] = mats.get(nm, 0) + t
    except Exception as ex: nm = str(ex)
    rows.append('{"id":%d,"cat":"%s","fam":"%s","tris":%d,"faces":%d,"mats":{%s}}' % (i, e.Category.Name if e.Category else '', (getattr(doc.GetElement(e.GetTypeId()), 'FamilyName', '') or '').replace('"', ''), n, faces, ','.join('"%s":%d' % (k.replace('"', ''), v) for k, v in mats.items())))
fo = io.open(base + '.counts.json', 'w', encoding='utf-8'); fo.write(u'[' + u','.join(rows) + u']'); fo.close()
