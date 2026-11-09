# -*- coding: utf-8 -*-
"""Exports the model as IFC (IFC2x3 coordination view, 3D view geometry), run inside Revit through `pyrevit run`.
Writes <model folder>/<model name>.ifc. Run it on a copy (never on the read-only backup drive)."""
import io, os, traceback
from Autodesk.Revit.DB import *
try: doc = __revit__.OpenAndActivateDocument(__models__[0]).Document
except Exception: doc = __revit__.ActiveUIDocument.Document
base = __models__[0]; folder = os.path.dirname(base); name = os.path.splitext(os.path.basename(base))[0]
log = io.open(base + '.ifc.log', 'w', encoding='utf-8')
try:
    opt = IFCExportOptions()
    opt.FileVersion = IFCVersion.IFC2x3CV2
    opt.WallAndColumnSplitting = False
    opt.ExportBaseQuantities = False
    t = Transaction(doc, 'IFC export'); t.Start()
    ok = doc.Export(folder, name + '.ifc', opt)
    t.RollBack()
    log.write(u'export ok: %s\n' % ok)
except Exception:
    log.write(unicode(traceback.format_exc()))
log.close()
