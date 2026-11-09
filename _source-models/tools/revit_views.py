# -*- coding: utf-8 -*-
"""List the model's section and elevation views with their cut planes, so the web viewer can offer the same cuts.
Run: pyrevit run revit_views.py <model.rvt> --revit=2027   -> _source-models/north-beach-youth-center/revit/views.json
Per view: name, type, origin and view direction (feet, Revit internal coords), crop box extents in view coords, far clip offset."""
import io
from Autodesk.Revit.DB import *

OUT = r'G:\My Drive\github\archiwatts-com\_source-models\north-beach-youth-center\revit\views.json'
doc = None
try:
    doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception:
    doc = __revit__.ActiveUIDocument.Document

def js(x):
    if isinstance(x, dict): return '{' + ','.join(js(unicode(k)) + ':' + js(v) for k, v in x.items()) + '}'
    if isinstance(x, (list, tuple)): return '[' + ','.join(js(y) for y in x) + ']'
    if isinstance(x, bool): return 'true' if x else 'false'
    if isinstance(x, (int, long, float)): return repr(round(x, 4))
    if x is None: return 'null'
    return u'"' + u''.join(ch if (32 <= ord(ch) < 127 and ch not in u'"\\') else (u'\\u%04x' % ord(ch)) for ch in unicode(x)) + u'"'

out = []
for v in FilteredElementCollector(doc).OfClass(ViewSection):
    try:
        if v.IsTemplate or v.ViewType not in (ViewType.Section, ViewType.Elevation, ViewType.Detail): continue
        cb = v.CropBox; t = cb.Transform
        far = None
        try: far = v.get_Parameter(BuiltInParameter.VIEWER_BOUND_OFFSET_FAR).AsDouble()
        except Exception: pass
        out.append({'name': v.Name, 'type': str(v.ViewType), 'origin': [t.Origin.X, t.Origin.Y, t.Origin.Z],
                    'dir': [v.ViewDirection.X, v.ViewDirection.Y, v.ViewDirection.Z], 'right': [v.RightDirection.X, v.RightDirection.Y, v.RightDirection.Z],
                    'min': [cb.Min.X, cb.Min.Y, cb.Min.Z], 'max': [cb.Max.X, cb.Max.Y, cb.Max.Z], 'far': far, 'onSheet': v.get_Parameter(BuiltInParameter.VIEWER_SHEET_NUMBER).AsString() if v.get_Parameter(BuiltInParameter.VIEWER_SHEET_NUMBER) else None})
    except Exception as e:
        out.append({'name': v.Name, 'error': unicode(e)})
fo = io.open(OUT, 'w', encoding='utf-8'); fo.write(js(out)); fo.close()
