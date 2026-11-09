# -*- coding: utf-8 -*-
"""Export a project's floor plans as images, with where each image sits in the model, for draping on the web model.
One plan per level: the floor plan view placed on a sheet if there is one, else the first non-template floor plan of that level.
Writes next to the model: <model>.plans/<n>.png and <model>.plans/plans.json  (crop min/max in feet, Revit internal coordinates;
the image spans the crop box exactly). Run: pyrevit run revit_plans.py <model.rvt> --revit=2027"""
import io, os
from Autodesk.Revit.DB import *
from System.Collections.Generic import List

doc = None
try: doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception:
    try: doc = __revit__.ActiveUIDocument.Document
    except Exception: pass
OUT = (__models__[0] if __models__ else doc.PathName) + '.plans'
if not os.path.isdir(OUT): os.makedirs(OUT)
def js(x):
    if isinstance(x, dict): return '{' + ','.join(js(unicode(k)) + ':' + js(v) for k, v in x.items()) + '}'
    if isinstance(x, (list, tuple)): return '[' + ','.join(js(y) for y in x) + ']'
    if isinstance(x, bool): return 'true' if x else 'false'
    if isinstance(x, (int, long, float)): return repr(round(x, 3))
    if x is None: return 'null'
    return u'"' + u''.join(ch if (32 <= ord(ch) < 127 and ch not in u'"\\') else (u'\\u%04x' % ord(ch)) for ch in unicode(x)) + u'"'

onSheet = set()
for vp in FilteredElementCollector(doc).OfClass(Viewport):
    try: onSheet.add(vp.ViewId.IntegerValue)
    except Exception: onSheet.add(vp.ViewId.Value)
best = {}
for v in FilteredElementCollector(doc).OfClass(ViewPlan):
    try:
        if v.IsTemplate or v.ViewType != ViewType.FloorPlan or v.GenLevel is None: continue
        vid = v.Id.IntegerValue if hasattr(v.Id, 'IntegerValue') else v.Id.Value
        lv = v.GenLevel; key = lv.Id.IntegerValue if hasattr(lv.Id, 'IntegerValue') else lv.Id.Value
        rank = (1 if vid in onSheet else 0, 1 if v.CropBoxActive else 0)
        if key not in best or rank > best[key][0]: best[key] = (rank, v, lv)
    except Exception: pass
out = []
t = Transaction(doc, 'plan crops'); t.Start()
for key, (rank, v, lv) in sorted(best.items(), key=lambda kv: kv[1][2].Elevation):
    try:
        v.CropBoxActive = True; v.CropBoxVisible = False
        try: v.get_Parameter(BuiltInParameter.VIEW_ANNOTATION_CROPPING).Set(0)
        except Exception: pass
    except Exception: pass
t.Commit()
for i, (key, (rank, v, lv)) in enumerate(sorted(best.items(), key=lambda kv: kv[1][2].Elevation)):
    try:
        cb = v.CropBox; tr = cb.Transform
        corners = [tr.OfPoint(XYZ(cb.Min.X, cb.Min.Y, 0)), tr.OfPoint(XYZ(cb.Max.X, cb.Max.Y, 0))]
        opt = ImageExportOptions(); opt.ExportRange = ExportRange.SetOfViews; ids = List[ElementId](); ids.Add(v.Id); opt.SetViewsAndSheets(ids)
        opt.FilePath = os.path.join(OUT, str(i)); opt.HLRandWFViewsFileType = ImageFileType.PNG; opt.ImageResolution = ImageResolution.DPI_150
        opt.ZoomType = ZoomFitType.FitToPage; opt.PixelSize = 3000; opt.FitDirection = FitDirectionType.Horizontal
        doc.ExportImage(opt)
        out.append({'i': i, 'view': v.Name, 'level': lv.Name, 'elev': lv.Elevation, 'onSheet': rank[0] == 1,
                    'min': [min(corners[0].X, corners[1].X), min(corners[0].Y, corners[1].Y)], 'max': [max(corners[0].X, corners[1].X), max(corners[0].Y, corners[1].Y)],
                    'right': [tr.BasisX.X, tr.BasisX.Y]})
    except Exception as e: out.append({'i': i, 'error': unicode(e)})
fo = io.open(os.path.join(OUT, 'plans.json'), 'w', encoding='utf-8'); fo.write(js(out)); fo.close()
