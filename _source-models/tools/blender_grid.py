"""Light-grid bake for a project page: sun + sky with shadows and bounce light, stored in a 3D grid of light values around the
project, so the page can shade every surface by position (works for any model, however its parts are packed).
Imports the page's own model (parts2glb.py), puts a tiny tetrahedral probe at every grid point (its four outward normals average the
light from all directions; probes neither cast shadows nor bounce light), bakes Cycles diffuse direct + indirect to the probes'
vertex colours on the GPU, and writes <out>: uint32 header length, JSON header {min, max, n:[nx,ny,nz]} in glTF coordinates
(y up), then nx*ny*nz uint8 light values (x fastest, then z, then y).
usage: blender -b --python blender_grid.py -- <model.glb> <out.bin> [samples] [maxProbes]"""
import bpy, bmesh, sys, math, struct, json, time
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]; SAMPLES = int(argv[2]) if len(argv) > 2 else 64; MAXP = int(argv[3]) if len(argv) > 3 else 350000
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
white = bpy.data.materials.new('white'); white.use_nodes = True
bs = white.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value = (.8, .8, .8, 1); bs.inputs['Roughness'].default_value = 1
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9)); meshes = []
for o in list(sc.objects):
    if o.type != 'MESH': continue
    nm = (o.name + ' ' + ' '.join(m.name for m in o.data.materials if m)).lower()
    if 'glaz' in nm or 'glass' in nm or 'water' in nm: bpy.data.objects.remove(o); continue
    o.data.materials.clear(); o.data.materials.append(white); meshes.append(o)
    if 'context' in o.name.lower(): continue
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); lo = Vector((min(lo[i], w[i]) for i in range(3))); hi = Vector((max(hi[i], w[i]) for i in range(3)))
pad = 4.0; lo -= Vector((pad, pad, 1.0)); hi += Vector((pad, pad, pad))
size = hi - lo; vol = size.x * size.y * size.z; s = max(.5, min(4.0, (vol / MAXP) ** (1 / 3)))
n = [max(2, int(math.ceil(size[i] / s)) + 1) for i in range(3)]
print('box', tuple(lo), tuple(hi), 'spacing', round(s, 2), 'grid', n, 'probes', n[0] * n[1] * n[2], 'load %.1fs' % (time.time() - t0))
# probes: tiny tetrahedra (Blender z up)
r = .06; T = [Vector((1, 1, 1)), Vector((1, -1, -1)), Vector((-1, 1, -1)), Vector((-1, -1, 1))]
gx = np.arange(n[0]) * s + lo.x; gy = np.arange(n[1]) * s + lo.y; gz = np.arange(n[2]) * s + lo.z
P = np.stack(np.meshgrid(gx, gy, gz, indexing='ij'), -1).reshape(-1, 3)            # order: x, y(blender), z(up)
V = (P[:, None, :] + np.array([list(t) for t in T])[None] * r).reshape(-1, 3)
base = np.arange(len(P))[:, None] * 4; F = np.concatenate([base + [0, 1, 2], base + [0, 3, 1], base + [0, 2, 3], base + [1, 3, 2]])
me = bpy.data.meshes.new('probes'); me.vertices.add(len(V)); me.vertices.foreach_set('co', V.astype(np.float32).ravel())
me.loops.add(len(F) * 3); me.loops.foreach_set('vertex_index', F.astype(np.int32).ravel())
me.polygons.add(len(F)); me.polygons.foreach_set('loop_start', np.arange(0, len(F) * 3, 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(len(F), 3, np.int32)); me.update()
po = bpy.data.objects.new('probes', me); sc.collection.objects.link(po); me.materials.append(white)
po.visible_shadow = False; po.visible_diffuse = False; po.visible_glossy = False; po.visible_transmission = False; po.visible_volume_scatter = False
attr = me.color_attributes.new('light', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = attr
# light: the North Beach sun (high, south-east in page terms: page (x, y up, z) -> blender (x, -z, y)), and a soft sky
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.0; sun.angle = math.radians(1.5); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
so.rotation_mode = 'QUATERNION'; so.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector((.34, -.41, .85)).normalized())
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.55, .7, .95, 1); bg.inputs['Strength'].default_value = .9
sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES
try:
    pr = bpy.context.preferences.addons['cycles'].preferences
    for dev in ('OPTIX', 'CUDA'):
        try:
            pr.compute_device_type = dev; pr.get_devices()
            for x in pr.devices: x.use = True
            sc.cycles.device = 'GPU'; break
        except Exception: pass
except Exception as e: print('gpu', e)
for o in sc.objects: o.select_set(False)
bpy.context.view_layer.objects.active = po; po.select_set(True)
t1 = time.time(); bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS'); print('bake %.1fs' % (time.time() - t1))
col = np.empty(len(V) * 4, np.float32); attr.data.foreach_get('color', col); col = col.reshape(-1, 4, 4)[:, :, :3]
lum = (col[..., 0] * .3 + col[..., 1] * .59 + col[..., 2] * .11).mean(1)
ref = np.percentile(lum[lum > 0], 97) if (lum > 0).any() else 1; L = np.clip(lum / ref, 0, 1) ** (1 / 2.2)
G = (L * 255).round().astype(np.uint8).reshape(n[0], n[1], n[2])                     # [x, y_blender, z_up]
# glTF axes: x = x, y(up) = z_blender, z = -y_blender  ->  store [y_up][z_gltf][x]
Gg = np.transpose(G, (2, 1, 0))[:, ::-1, :]                                           # [z_up, y_blender reversed (= z_gltf ascending), x]
mn = [lo.x, lo.z, -(lo.y + (n[1] - 1) * s)]; mx = [lo.x + (n[0] - 1) * s, lo.z + (n[2] - 1) * s, -lo.y]
head = json.dumps({'min': mn, 'max': mx, 'n': [n[0], n[2], n[1]], 'spacing': s}).encode()
open(OUT, 'wb').write(struct.pack('<I', len(head)) + head + np.ascontiguousarray(Gg).tobytes())
print('wrote', OUT, 'total %.1fs' % (time.time() - t0))
