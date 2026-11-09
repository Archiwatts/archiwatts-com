import sys, json, collections, time
import ifcopenshell, ifcopenshell.util.element as U
t = time.time()
f = ifcopenshell.open(sys.argv[1])
print('opened', round(time.time() - t), 's', f.schema)
rows = collections.Counter()
mats = collections.Counter()
for e in f.by_type('IfcElement'):
    if e.is_a('IfcOpeningElement'):
        continue
    typ = U.get_type(e)
    tname = typ.Name if typ else (e.ObjectType or '')
    ms = U.get_materials(e)
    mname = '|'.join(sorted({m.Name for m in ms if m.Name})) or '-'
    st = U.get_container(e)
    rows[(e.is_a(), (tname or '')[:48], mname[:60], st.Name if st else '-')] += 1
print(len(rows), 'distinct class/type/material/level rows')
out = [{'cls': k[0], 'type': k[1], 'mat': k[2], 'level': k[3], 'n': v} for k, v in rows.most_common()]
json.dump(out, open(sys.argv[2], 'w'), indent=0)
print('done', round(time.time() - t), 's')
