# -*- coding: utf-8 -*-
"""Point the links of a LOCAL COPY of the host model at local copies of the linked files (never touches the originals).
Run with plain `pyrevit run revit_links.py` (no model); paths below."""
import io
from Autodesk.Revit.DB import *
W = r'C:\Users\herna\AppData\Local\Temp\claude\fd9fa047545a0060\18a6b605-daed-4515-bf21-b2408da4f76d\scratchpad\D6'
HOST = W + r'\revit stuff\Test-Youth_Render-Model.rvt'
LOG = W + r'\links.txt'
mp = ModelPathUtils.ConvertUserVisiblePathToModelPath(HOST)
td = TransmissionData.ReadTransmissionData(mp)
out = []
for rid in td.GetAllExternalFileReferenceIds():
    ref = td.GetLastSavedReferenceData(rid)
    if ref.ExternalFileReferenceType != ExternalFileReferenceType.RevitLink:
        continue
    old = ModelPathUtils.ConvertModelPathToUserVisiblePath(ref.GetAbsolutePath())
    name = old.replace('/', '\\').split('\\')[-1]
    new = W + '\\site\\' + name
    td.SetDesiredReferenceData(rid, ModelPathUtils.ConvertUserVisiblePathToModelPath(new), PathType.Absolute, True)
    out.append(u'%s -> %s' % (old, new))
td.IsTransmitted = True
TransmissionData.WriteTransmissionData(mp, td)
io.open(LOG, 'w', encoding='utf-8').write(u'\n'.join(out))
