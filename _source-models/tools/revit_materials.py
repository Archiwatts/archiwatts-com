# -*- coding: utf-8 -*-
"""Materials and quantities audit of a Revit model, run inside Revit through `pyrevit run`:
for every model element with geometry: category, family, type, level, and each material with its painted/area and volume
(Element.GetMaterialArea / GetMaterialVolume), plus the element's bounding box in feet. Writes <model>.materials.json next to the
model (copy the model off read-only drives first).
Totals per material and per category/material are added, so the web model's materials can be checked against Revit's."""
import io, json, collections
from Autodesk.Revit.DB import *

doc = None
try:
    doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception:
    try: doc = __revit__.ActiveUIDocument.Document
    except Exception: doc = None
OUT = (__models__[0] if __models__ else doc.PathName) + '.materials.json'

def iv(i):
    try: return i.Value
    except Exception: return i.IntegerValue

def nm(x):
    try: return x.Name or ''
    except Exception: return ''

def js(v):
    if isinstance(v, dict): return '{' + ','.join(js(str(k)) + ':' + js(v[k]) for k in v) + '}'
    if isinstance(v, (list, tuple)): return '[' + ','.join(js(x) for x in v) + ']'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, long, float)): return repr(round(float(v), 3))
    if v is None: return 'null'
    s = unicode(v)
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ').replace('\r', ' ') + '"'

rows = []
tot = collections.defaultdict(lambda: [0, 0.0, 0.0])
bycat = collections.defaultdict(lambda: [0, 0.0])
errs = 0
for e in FilteredElementCollector(doc).WhereElementIsNotElementType():
    try:
        cat = e.Category
        if cat is None or cat.CategoryType != CategoryType.Model: continue
        bb = e.get_BoundingBox(None)
        if bb is None: continue
        t = doc.GetElement(e.GetTypeId())
        fam = ''
        try: fam = t.FamilyName
        except Exception: pass
        lvl = ''
        try: lvl = nm(doc.GetElement(e.LevelId))
        except Exception: pass
        mats = []
        ids = list(e.GetMaterialIds(False)) + list(e.GetMaterialIds(True))
        seen = set()
        for mid in ids:
            if iv(mid) in seen: continue
            seen.add(iv(mid))
            m = doc.GetElement(mid)
            if m is None: continue
            try: a = e.GetMaterialArea(mid, False)
            except Exception: a = 0.0
            try: v = e.GetMaterialVolume(mid)
            except Exception: v = 0.0
            mats.append([nm(m), a, v])
            tt = tot[nm(m)]; tt[0] += 1; tt[1] += a; tt[2] += v
            bc = bycat[cat.Name + ' | ' + nm(m)]; bc[0] += 1; bc[1] += a
        rows.append({'id': iv(e.Id), 'cat': cat.Name, 'fam': fam, 'type': nm(t), 'lvl': lvl, 'mats': mats,
                     'min': [bb.Min.X, bb.Min.Y, bb.Min.Z], 'max': [bb.Max.X, bb.Max.Y, bb.Max.Z]})
    except Exception as ex:
        errs += 1
        if errs < 5: rows.append({'error': str(ex)})
out = {'title': doc.Title, 'elements': rows, 'errors': errs,
       'materials': dict((k, {'elements': v[0], 'area_sf': v[1], 'volume_cf': v[2]}) for k, v in tot.items()),
       'category_material': dict((k, {'elements': v[0], 'area_sf': v[1]}) for k, v in bycat.items())}
fo = io.open(OUT, 'w', encoding='utf-8'); fo.write(js(out)); fo.close()
