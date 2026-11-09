# -*- coding: utf-8 -*-
"""Census of a Revit model, run inside Revit through `pyrevit run`. Lists every model element by category / family / type with its
level, phase, workset, design option and whether it has 3D geometry, plus links, phases, design options and topography.
Writes census.json next to this script's OUT path (set below)."""
import json, os, collections
from Autodesk.Revit.DB import *

OUT = r'G:\My Drive\github\archiwatts-com\_source-models\north-beach-youth-center\census.json'
try:
    doc = __revit__.ActiveUIDocument.Document
except Exception:
    doc = None
if doc is None:
    try:
        doc = __models__ and __revit__.OpenAndActivateDocument(__models__[0]).Document
    except Exception:
        doc = None
if doc is None:
    for d in __revit__.Application.Documents:
        doc = d
        break

def name_of(e):
    try:
        return e.Name or ''
    except Exception:
        return ''

rows = collections.Counter()
bycat = collections.Counter()
phases = collections.Counter()
opts = collections.Counter()
inplace = collections.Counter()
nogeo = collections.Counter()
mats = collections.Counter()
col = FilteredElementCollector(doc).WhereElementIsNotElementType()
opt = Options()
opt.DetailLevel = ViewDetailLevel.Fine
total = 0
for e in col:
    c = e.Category
    if c is None or c.CategoryType != CategoryType.Model:
        continue
    total += 1
    cname = c.Name
    t = doc.GetElement(e.GetTypeId()) if e.GetTypeId() != ElementId.InvalidElementId else None
    fam = ''
    try:
        fam = t.FamilyName if t is not None else ''
    except Exception:
        pass
    tname = name_of(t) if t is not None else name_of(e)
    rows[(cname, fam, tname)] += 1
    bycat[cname] += 1
    try:
        ph = doc.GetElement(e.CreatedPhaseId)
        phases[name_of(ph) if ph else '-'] += 1
    except Exception:
        pass
    try:
        do = e.DesignOption
        opts[name_of(do) if do else 'Main model'] += 1
    except Exception:
        pass
    try:
        if isinstance(e, FamilyInstance) and e.Symbol.Family.IsInPlace:
            inplace[cname] += 1
    except Exception:
        pass
    try:
        g = e.get_Geometry(opt)
        if g is None:
            nogeo[cname] += 1
    except Exception:
        nogeo[cname] += 1
    try:
        for mid in e.GetMaterialIds(False):
            m = doc.GetElement(mid)
            if m:
                mats[m.Name] += 1
    except Exception:
        pass

links = [name_of(l) for l in FilteredElementCollector(doc).OfClass(RevitLinkInstance)]
imports = [name_of(i) for i in FilteredElementCollector(doc).OfClass(ImportInstance)]
out = {
    'file': doc.PathName, 'title': doc.Title, 'modelElements': total,
    'byCategory': bycat.most_common(),
    'rows': [[k[0], k[1], k[2], v] for k, v in rows.most_common()],
    'phases': phases.most_common(), 'designOptions': opts.most_common(), 'inPlaceByCategory': inplace.most_common(),
    'noGeometryByCategory': nogeo.most_common(), 'materials': mats.most_common(),
    'links': links, 'imports': imports,
    'phaseList': [name_of(p) for p in doc.Phases],
}
import io
def clean(x):
    if isinstance(x, (list, tuple)):
        return [clean(y) for y in x]
    if isinstance(x, dict):
        return dict((clean(k), clean(v)) for k, v in x.items())
    if isinstance(x, basestring):
        try:
            return unicode(x)
        except Exception:
            return x.decode('latin-1')
    return x
# IronPython's json chokes on accented names, so write the JSON by hand (non-ASCII as \u escapes)
def js(x):
    if isinstance(x, dict):
        return '{' + ','.join(js(unicode(k)) + ':' + js(v) for k, v in x.items()) + '}'
    if isinstance(x, (list, tuple)):
        return '[' + ',\n'.join(js(y) for y in x) + ']'
    if isinstance(x, bool):
        return 'true' if x else 'false'
    if isinstance(x, (int, long, float)):
        return repr(x)
    if x is None:
        return 'null'
    s = u''.join(ch if (32 <= ord(ch) < 127 and ch not in u'"\\') else (u'\\u%04x' % ord(ch)) for ch in unicode(x))
    return u'"' + s + u'"'
with io.open(OUT, 'w', encoding='utf-8') as fh:
    fh.write(js(out))
print('census written', total)
