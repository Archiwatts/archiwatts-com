# -*- coding: utf-8 -*-
"""Export every visible model element's render geometry from Revit (including linked models), as Revit itself tessellates it, with
its material appearance. Run inside Revit:  pyrevit run revit_export.py <model.rvt> --revit=2027
Writes to OUTDIR:  tris.bin  (records: int32 material, int32 element, 9 x float32 xyz in feet, internal coordinates)
                   meta.json (materials with colour/transparency/gloss, elements with category/family/type/level/link)"""
import io, math
import clr
clr.AddReference('System')
from System.IO import FileStream, FileMode, BinaryWriter
from Autodesk.Revit.DB import *

OUTDIR = r'G:\My Drive\github\archiwatts-com\_source-models\north-beach-youth-center\revit'
LOG = OUTDIR + r'\log.txt'
import os
if not os.path.isdir(OUTDIR):
    os.makedirs(OUTDIR)
logf = io.open(LOG, 'w', encoding='utf-8')
def log(s):
    logf.write(unicode(s) + u'\n'); logf.flush()

doc = None
try:
    doc = __revit__.ActiveUIDocument.Document
except Exception:
    pass
if doc is None:
    try:
        doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
    except Exception as err:
        log(u'open failed: %s' % err)
if doc is None:
    for d in __revit__.Application.Documents:
        if not d.IsLinked:
            doc = d; break
log(u'doc: %s' % doc.PathName)

# a fresh 3D view showing everything at fine detail (in memory only, the copy is never saved)
t = Transaction(doc, 'export view'); t.Start()
vft = [v for v in FilteredElementCollector(doc).OfClass(ViewFamilyType) if v.ViewFamily == ViewFamily.ThreeDimensional][0]
view = View3D.CreateIsometric(doc, vft.Id)
view.DetailLevel = ViewDetailLevel.Fine
try:
    view.get_Parameter(BuiltInParameter.VIEW_PHASE).Set(list(doc.Phases)[-1].Id)
except Exception:
    pass
for c in doc.Settings.Categories:
    try:
        if c.CategoryType == CategoryType.Model and view.CanCategoryBeHidden(c.Id):
            view.SetCategoryHidden(c.Id, False)
    except Exception:
        pass
t.Commit()

fs = FileStream(OUTDIR + r'\tris.bin', FileMode.Create)
bw = BinaryWriter(fs)

def nm(x):
    try:
        return x.Name or u''
    except Exception:
        return u''

class Ctx(IExportContext):
    def __init__(self):
        self.tf = [Transform.Identity]
        self.docs = [doc]
        self.links = [u'']
        self.mat = -1
        self.matkey = {}
        self.mats = []
        self.elem = -1
        self.elems = []
        self.tris = 0
    def Start(self): return True
    def Finish(self): pass
    def IsCanceled(self): return False
    def OnViewBegin(self, node): return RenderNodeAction.Proceed
    def OnViewEnd(self, eid): pass
    def OnElementBegin(self, eid):
        d = self.docs[-1]; e = d.GetElement(eid)
        if e is None: return RenderNodeAction.Skip
        c = e.Category
        typ = d.GetElement(e.GetTypeId()) if e.GetTypeId() != ElementId.InvalidElementId else None
        fam = u''
        try: fam = typ.FamilyName if typ is not None else u''
        except Exception: pass
        lv = u''
        try:
            if e.LevelId != ElementId.InvalidElementId: lv = nm(d.GetElement(e.LevelId))
        except Exception: pass
        self.elems.append({'id': eid.IntegerValue if hasattr(eid, 'IntegerValue') else eid.Value, 'uid': e.UniqueId, 'cat': nm(c) if c else u'',
                           'fam': fam, 'type': nm(typ) if typ is not None else nm(e), 'level': lv, 'link': self.links[-1]})
        self.elem = len(self.elems) - 1
        return RenderNodeAction.Proceed
    def OnElementEnd(self, eid): pass
    def OnInstanceBegin(self, node):
        self.tf.append(self.tf[-1].Multiply(node.GetTransform())); return RenderNodeAction.Proceed
    def OnInstanceEnd(self, node): self.tf.pop()
    def OnLinkBegin(self, node):
        ld = node.GetDocument()
        self.tf.append(self.tf[-1].Multiply(node.GetTransform())); self.docs.append(ld); self.links.append(ld.Title if ld else u'link')
        log(u'link: %s' % (ld.PathName if ld else '?'))
        return RenderNodeAction.Proceed
    def OnLinkEnd(self, node): self.tf.pop(); self.docs.pop(); self.links.pop()
    def OnFaceBegin(self, node): return RenderNodeAction.Proceed
    def OnFaceEnd(self, node): pass
    def OnLight(self, node): pass
    def OnRPC(self, node): pass
    def OnMaterial(self, node):
        d = self.docs[-1]; m = d.GetElement(node.MaterialId) if node.MaterialId != ElementId.InvalidElementId else None
        name = nm(m) if m else u'(none)'
        col = node.Color
        key = (self.links[-1], name, col.Red if col.IsValid else -1, col.Green if col.IsValid else -1, col.Blue if col.IsValid else -1, round(node.Transparency, 2))
        if key not in self.matkey:
            self.matkey[key] = len(self.mats)
            self.mats.append({'name': name, 'link': self.links[-1], 'rgb': [col.Red, col.Green, col.Blue] if col.IsValid else [200, 200, 200],
                              'transparency': node.Transparency, 'glossiness': node.Glossiness, 'smoothness': node.Smoothness,
                              'cls': (m.MaterialClass if m else u''), 'hasTexture': bool(m and m.AppearanceAssetId != ElementId.InvalidElementId)})
        self.mat = self.matkey[key]
    def OnPolymesh(self, node):
        tf = self.tf[-1]; pts = [tf.OfPoint(p) for p in node.GetPoints()]
        for f in node.GetFacets():
            bw.Write(self.mat); bw.Write(self.elem)
            for i in (f.V1, f.V2, f.V3):
                p = pts[i]; bw.Write(float(p.X)); bw.Write(float(p.Y)); bw.Write(float(p.Z))
            self.tris += 1

ctx = Ctx()
ex = CustomExporter(doc, ctx)
ex.IncludeGeometricObjects = False
ex.ShouldStopOnError = False
try:
    ex.Export(view)
except Exception as err:
    log(u'export error: %s' % err)
bw.Flush(); bw.Close(); fs.Close()
log(u'triangles %d elements %d materials %d' % (ctx.tris, len(ctx.elems), len(ctx.mats)))

def js(x):
    if isinstance(x, dict):
        return '{' + ','.join(js(unicode(k)) + ':' + js(v) for k, v in x.items()) + '}'
    if isinstance(x, (list, tuple)):
        return '[' + ',\n'.join(js(y) for y in x) + ']'
    if isinstance(x, bool): return 'true' if x else 'false'
    if isinstance(x, (int, long, float)): return repr(x)
    if x is None: return 'null'
    return u'"' + u''.join(ch if (32 <= ord(ch) < 127 and ch not in u'"\\') else (u'\\u%04x' % ord(ch)) for ch in unicode(x)) + u'"'
io.open(OUTDIR + r'\meta.json', 'w', encoding='utf-8').write(js({'materials': ctx.mats, 'elements': ctx.elems}))
log(u'done')
logf.close()
