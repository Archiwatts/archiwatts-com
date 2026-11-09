# -*- coding: utf-8 -*-
"""Faces of chosen Revit elements, by material, run inside Revit through `pyrevit run`: every face of the element's solids is
triangulated and written with its material name, in metres with the page's axes (x = Revit x, y = Revit z, z = -Revit y).
Used to give back the materials an export merged (e.g. a skylight's wood ribs that came out as glass).
Set IDS below; writes <model>.faces.json next to the model."""
import io, System, traceback
from Autodesk.Revit.DB import *

IDS = [1488903]
doc = None
try:
    doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception:
    doc = __revit__.ActiveUIDocument.Document
OUT = (__models__[0] if __models__ else doc.PathName) + '.faces2.json'
F = 0.3048

def solids(g):
    for o in g:
        if isinstance(o, Solid) and o.Faces.Size: yield o
        elif isinstance(o, GeometryInstance):
            for s in solids(o.GetInstanceGeometry()): yield s

opt = Options(); opt.DetailLevel = ViewDetailLevel.Fine
parts = []
try:
  pass
except Exception: pass
for i in IDS:
    try: eid = ElementId(System.Int64(i))
    except Exception: eid = ElementId(i)
    e = doc.GetElement(eid)
    if e is None: continue
    tris = {}
    for s in solids(e.get_Geometry(opt)):
        for f in s.Faces:
            m = doc.GetElement(f.MaterialElementId); name = m.Name if m else ''
            mesh = f.Triangulate()
            L = tris.setdefault(name, [])
            for k in range(mesh.NumTriangles):
                t = mesh.get_Triangle(k)
                for j in range(3):
                    p = t.get_Vertex(j); L.extend([round(p.X * F, 3), round(p.Z * F, 3), round(-p.Y * F, 3)])
    parts.append('"%d":{%s}' % (i, ','.join('"%s":[%s]' % (k.replace('"', ''), ','.join(repr(v) for v in L)) for k, L in tris.items())))
fo = io.open(OUT, 'w', encoding='utf-8'); fo.write(u'{' + u','.join(parts) + u'}'); fo.close()
