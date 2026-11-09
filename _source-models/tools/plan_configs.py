"""Place exported Revit floor plans on a project page: converts the chosen plan images to webp next to the page and writes
plans-config.js (window.PROJECT_PLANS) with each image's corners in page metres, from its Revit crop box and the project's fit
of Revit onto the web model (tourgen.js: mirror / quarter-turn / offset about the wall-sample centre).
usage: python plan_configs.py <revit-info.json> <plans dir> <page dir> '<fit json>' '<picks json: [[index, name, cut above floor], ...]>'"""
import sys, json, os
from PIL import Image
info = json.load(open(sys.argv[1], encoding='utf-8')); pdir = sys.argv[2]; page = sys.argv[3]; fit = json.loads(open(sys.argv[4]).read() if os.path.isfile(sys.argv[4]) else sys.argv[4]); picks = json.loads(open(sys.argv[5]).read() if os.path.isfile(sys.argv[5]) else sys.argv[5])
F = .3048
walls = info['walls']; step = max(1, len(walls) // 4000); W = [[p[0] * F, p[1] * F] for i, p in enumerate(walls) if i % step == 0]
mx = sum(p[0] for p in W) / len(W); my = sum(p[1] for p in W) / len(W)
def xf(x, y):
    x -= mx; y -= my; a = -x if fit['mir'] else x
    r = [[a, -y], [y, a], [-a, y], [-y, -a]][fit['rot']]
    return [round(r[0] + fit['tx'], 3), round(r[1] + fit['tz'], 3)]
meta = {p['i']: p for p in json.load(open(os.path.join(pdir, 'plans.json'), encoding='utf-8')) if 'min' in p}
files = {int(f.split(' ')[0]): f for f in os.listdir(pdir) if f.endswith('.png')}
os.makedirs(os.path.join(page, 'plans'), exist_ok=True)
plans = []
for idx, name, cut in picks:
    p = meta[idx]; im = Image.open(os.path.join(pdir, files[idx])).convert('RGB')
    if im.width > 3000: im = im.resize((3000, round(im.height * 3000 / im.width)))
    out = 'plans/level-%d.webp' % idx; im.save(os.path.join(page, out), quality=86)
    x0, y0 = p['min'][0] * F, p['min'][1] * F; x1, y1 = p['max'][0] * F, p['max'][1] * F
    floor = round(p['elev'] * F + fit['ty'], 2)
    plans.append({'img': out + '?v=1', 'name': name, 'sub': 'Revit plan: ' + p['view'], 'floor': floor, 'cut': round(floor + cut, 2), 'tl': xf(x0, y1), 'tr': xf(x1, y1), 'bl': xf(x0, y0)})
js = '/* Floor plans exported from the Revit model (_source-models/tools/revit_plans.py), placed by their crop boxes and the fit of\n   Revit onto the web model (plan_configs.py); refined against the model walls in the browser before writing. */\nwindow.PROJECT_PLANS = ' + json.dumps({'plans': plans}) + ';\n'
open(os.path.join(page, 'plans-config.js'), 'w', encoding='utf-8').write(js)
print(json.dumps(plans, indent=0)[:1500])
