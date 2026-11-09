# -*- coding: utf-8 -*-
"""Read what the web tour needs from a Revit model, without exporting geometry: rooms (name, number, level, location), levels,
section and elevation views (cut planes and crops), and wall location lines (sampled) for fitting Revit's coordinates onto the
web model. Run: pyrevit run revit_info.py <model.rvt> --revit=2027  ->  writes <model.rvt>.info.json next to the model.
All lengths in feet, Revit internal coordinates."""
import io
from Autodesk.Revit.DB import *

doc = None
try:
    doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception:
    try: doc = __revit__.ActiveUIDocument.Document
    except Exception: pass
OUT = (__models__[0] if __models__ else doc.PathName) + '.info.json'

def js(x):
    if isinstance(x, dict): return '{' + ','.join(js(unicode(k)) + ':' + js(v) for k, v in x.items()) + '}'
    if isinstance(x, (list, tuple)): return '[' + ','.join(js(y) for y in x) + ']'
    if isinstance(x, bool): return 'true' if x else 'false'
    if isinstance(x, (int, long, float)): return repr(round(x, 3))
    if x is None: return 'null'
    return u'"' + u''.join(ch if (32 <= ord(ch) < 127 and ch not in u'"\\') else (u'\\u%04x' % ord(ch)) for ch in unicode(x)) + u'"'
def nm(e):
    try: return e.Name or u''
    except Exception: return u''

out = {'title': doc.Title, 'rooms': [], 'levels': [], 'views': [], 'walls': [], 'errors': []}
# rooms
try:
    for r in FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Rooms):
        try:
            if r.Area <= 0 or r.Location is None: continue
            p = r.Location.Point; lv = doc.GetElement(r.LevelId)
            bb = r.get_BoundingBox(None)
            out['rooms'].append({'name': r.get_Parameter(BuiltInParameter.ROOM_NAME).AsString(), 'number': r.Number, 'level': nm(lv), 'elev': lv.Elevation if lv else 0,
                                 'p': [p.X, p.Y, p.Z], 'area': r.Area, 'min': [bb.Min.X, bb.Min.Y, bb.Min.Z] if bb else None, 'max': [bb.Max.X, bb.Max.Y, bb.Max.Z] if bb else None})
        except Exception as e: out['errors'].append(u'room %s' % e)
except Exception as e: out['errors'].append(u'rooms %s' % e)
# levels
for l in FilteredElementCollector(doc).OfClass(Level):
    try: out['levels'].append({'name': l.Name, 'elev': l.Elevation})
    except Exception: pass
# section / elevation views
for v in FilteredElementCollector(doc).OfClass(ViewSection):
    try:
        if v.IsTemplate or v.ViewType not in (ViewType.Section, ViewType.Elevation): continue
        cb = v.CropBox; t = cb.Transform; far = None
        try: far = v.get_Parameter(BuiltInParameter.VIEWER_BOUND_OFFSET_FAR).AsDouble()
        except Exception: pass
        sh = v.get_Parameter(BuiltInParameter.VIEWER_SHEET_NUMBER)
        out['views'].append({'name': v.Name, 'type': str(v.ViewType), 'origin': [t.Origin.X, t.Origin.Y, t.Origin.Z], 'dir': [v.ViewDirection.X, v.ViewDirection.Y, v.ViewDirection.Z],
                             'right': [v.RightDirection.X, v.RightDirection.Y, v.RightDirection.Z], 'min': [cb.Min.X, cb.Min.Y, cb.Min.Z], 'max': [cb.Max.X, cb.Max.Y, cb.Max.Z], 'far': far,
                             'sheet': sh.AsString() if sh else None})
    except Exception as e: out['errors'].append(u'view %s' % e)
# wall lines, sampled every ~2 ft, for fitting onto the web model
for w in FilteredElementCollector(doc).OfClass(Wall):
    try:
        c = w.Location.Curve; n = max(2, int(c.Length / 2.0))
        for i in range(n + 1):
            p = c.Evaluate(float(i) / n, True); out['walls'].append([p.X, p.Y, p.Z])
    except Exception: pass
fo = io.open(OUT, 'w', encoding='utf-8'); fo.write(js(out)); fo.close()
