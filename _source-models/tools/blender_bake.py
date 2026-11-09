"""Bake daylight (sun + sky, with shadows and bounce light) onto every vertex of the web model, in Blender with Cycles on the GPU.
Reads the page's own revit-main.bin.gz, builds one mesh from all its chunks (glass left out so it doesn't block light), lights it with a
daytime sun and a physical sky, bakes diffuse direct + indirect light to a per-vertex colour, and writes revit-main.light.bin.gz: one
uint8 brightness per vertex, chunk by chunk in file order, which the viewer multiplies into each surface.
usage: blender -b --python blender_bake.py -- <revit-main.bin.gz> <out.light.bin.gz> [samples]"""
import bpy, sys, gzip, json, struct, math, time
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 96
t0 = time.time()
buf = gzip.open(SRC, 'rb').read()
hl = struct.unpack_from('<I', buf, 0)[0]
hdr = json.loads(buf[4:4 + hl].decode('utf-8')); base = 4 + hl

verts, faces, order, off = [], [], [], 0
for mi, m in enumerate(hdr['meshes']):
    cat = m['name'].replace('Youth_center__', '')
    glass = cat == 'Glazing' or (m.get('transparency') or 0) > .15
    for ci, c in enumerate(m['chunks']):
        q = np.frombuffer(buf, '<u2', c['v'] * 3, base + c['pos']).reshape(-1, 3).astype(np.float64)
        p = np.array(c['min']) + q * np.array(c['scale'])
        ix = np.frombuffer(buf, '<u2', c['i'], base + c['idx']).reshape(-1, 3).astype(np.int64)
        order.append((c['v'], off, glass))
        verts.append(np.stack([p[:, 0], -p[:, 2], p[:, 1]], 1))          # page (x, y up, z south) -> Blender (x, y north, z up)
        if not glass: faces.append(ix + off)
        off += c['v']
V = np.concatenate(verts); F = np.concatenate(faces)
print('verts', len(V), 'faces', len(F), 'read %.1fs' % (time.time() - t0))

bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new('site')
me.vertices.add(len(V)); me.vertices.foreach_set('co', V.astype(np.float32).ravel())
me.loops.add(len(F) * 3); me.loops.foreach_set('vertex_index', F.astype(np.int32).ravel())
me.polygons.add(len(F)); me.polygons.foreach_set('loop_start', np.arange(0, len(F) * 3, 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(len(F), 3, np.int32))
me.update(); me.validate(clean_customdata=False)
ob = bpy.data.objects.new('site', me); bpy.context.scene.collection.objects.link(ob)
mat = bpy.data.materials.new('white'); mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value = (.8, .8, .8, 1); bsdf.inputs['Roughness'].default_value = 1
me.materials.append(mat)
attr = me.color_attributes.new('light', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = attr

# daytime sun from the south-east, high, as in the garden render; physical sky for the soft fill and bounce
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.0; sun.angle = math.radians(1.5)
so = bpy.data.objects.new('sun', sun); bpy.context.scene.collection.objects.link(so)
elev, azim = math.radians(58), math.radians(140)          # azimuth from north, clockwise (140 = south-east)
d = (math.sin(azim) * math.cos(elev), math.cos(azim) * math.cos(elev), math.sin(elev))
so.rotation_euler = (0, 0, 0); so.rotation_mode = 'QUATERNION'
from mathutils import Vector
so.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(d))
w = bpy.data.worlds.new('sky'); bpy.context.scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.55, .7, .95, 1); bg.inputs['Strength'].default_value = 0.9

sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dev in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = dev; prefs.get_devices()
            for x in prefs.devices: x.use = True
            sc.cycles.device = 'GPU'; print('device', dev); break
        except Exception: pass
except Exception as e: print('gpu setup failed', e)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
t1 = time.time()
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS')
print('bake %.1fs' % (time.time() - t1))

col = np.empty(len(V) * 4, np.float32); attr.data.foreach_get('color', col); col = col.reshape(-1, 4)
lum = col[:, 0] * .3 + col[:, 1] * .59 + col[:, 2] * .11
ref = np.percentile(lum[lum > 0], 97)                  # fully sunlit, facing the sun -> 255
L = np.clip(lum / ref, 0, 1)
out = np.empty(off, np.uint8); k = 0
for n, o, glass in order:
    out[o:o + n] = 255 if glass else np.round(np.power(L[o:o + n], 1 / 2.2) * 255)
gzip.open(OUT, 'wb', 6).write(out.tobytes())
print('wrote', OUT, off, 'verts, total %.1fs' % (time.time() - t0))
