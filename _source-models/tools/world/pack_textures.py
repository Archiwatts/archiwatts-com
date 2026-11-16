"""Pack CC0 photo textures (ambientCG, 1K) into the web textures the city uses.
usage: python pack_textures.py <folder with *_Color.jpg / *_NormalGL.jpg> <out folder>
grey.jpg: R = plaster, G = concrete, B = asphalt, each as luminance detail with mean 0.5 (tinted in the shader).
Colour maps and normal maps are re-saved as 1024 px JPEGs."""
import sys, os
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
load = lambda name, kind: Image.open(os.path.join(src, f'{name}_1K-JPG_{kind}.jpg')).convert('RGB').resize((1024, 1024), Image.LANCZOS)

def detail(name):
    a = np.asarray(load(name, 'Color'), np.float32).mean(2)
    return np.clip(a / a.mean() * 127.5, 0, 255)

grey = np.stack([detail('Plaster001'), detail('Concrete034'), detail('Asphalt031')], 2).astype(np.uint8)
Image.fromarray(grey).save(os.path.join(out, 'grey.jpg'), quality=85)
for key, name, normal in [('brick', 'Bricks085', True), ('paving', 'PavingStones128', True), ('roof', 'RoofingTiles006', True),
                          ('grass', 'Grass004', False), ('wood', 'WoodFloor041', False), ('stone', 'Bricks066', True), ('cobble', 'PavingStones138', False)]:
    load(name, 'Color').save(os.path.join(out, key + '.jpg'), quality=82)
    if normal: load(name, 'NormalGL').save(os.path.join(out, key + '_n.jpg'), quality=85)
for f in sorted(os.listdir(out)): print(f, round(os.path.getsize(os.path.join(out, f)) / 1024), 'KB')
