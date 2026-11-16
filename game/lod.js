// Level of detail for the heavy project meshes. The models carry ~14 M triangles; from far away most of them are sub-pixel.
// Each big mesh gets a simplified twin (meshoptimizer) that SHARES its vertex buffers (only a thinner index is new), and the
// twin is drawn instead of the original beyond FAR metres. The original is never hidden with `visible` (the collision builder
// reads that); the swap uses layers, so physics, picking and the BVH still see the full-detail mesh.
import { MeshoptSimplifier } from 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_simplifier.module.js';

export async function init(W){
  const {THREE, camera, scene} = W;
  const MIN_TRIS = 12000, RATIO = .1, ERROR = .012;
  const NEAR = 150, FAR = 200;              // hysteresis (metres from the camera to the mesh surface)
  const LOW_LAYER = 2;
  try { await MeshoptSimplifier.ready; } catch (e) { console.warn('[lod] simplifier unavailable', e); return; }

  const done = new WeakSet(), entries = [], queue = [], stats = [];
  const sph = new THREE.Sphere(), c = new THREE.Vector3();

  function scan(){
    scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || done.has(o) || o.userData.lodTwin) return;
      const g = o.geometry; if (!g || !g.index || !g.attributes.position) return;
      const t = g.index.count/3; if (t < MIN_TRIS) { done.add(o); return; }
      done.add(o); queue.push(o);
    });
  }

  function build(o){
    const g = o.geometry, idx = g.index.array instanceof Uint32Array ? g.index.array : Uint32Array.from(g.index.array);
    const target = Math.max(3000, Math.floor(idx.length*RATIO/3)*3);
    const pa = g.attributes.position; let pos = pa.array;
    if (pa.isInterleavedBufferAttribute || !(pos instanceof Float32Array)){   // the loader hands back interleaved / quantised buffers: pull out plain xyz for the simplifier
      pos = new Float32Array(pa.count*3); for (let i = 0; i < pa.count; i++){ pos[i*3] = pa.getX(i); pos[i*3+1] = pa.getY(i); pos[i*3+2] = pa.getZ(i); } }
    const [out] = MeshoptSimplifier.simplify(idx, pos, 3, target, ERROR, ['LockBorder']);
    stats.push([o.name, idx.length/3, out ? out.length/3 : -1]);
    if (!out || out.length >= idx.length*.8) return;   // not worth a twin
    const lg = new THREE.BufferGeometry();
    for (const k in g.attributes) lg.setAttribute(k, g.attributes[k]);   // same buffers, no extra memory
    lg.setIndex(new THREE.BufferAttribute(out, 1)); if (!g.boundingSphere) g.computeBoundingSphere(); lg.boundingSphere = g.boundingSphere.clone(); lg.boundingBox = g.boundingBox;
    const low = new THREE.Mesh(lg, o.material);
    low.name = (o.name || 'mesh') + '_lod'; low.userData.lodTwin = true; low.userData.noCollide = true;
    low.castShadow = false; low.receiveShadow = o.receiveShadow; low.renderOrder = o.renderOrder;
    low.position.copy(o.position); low.quaternion.copy(o.quaternion); low.scale.copy(o.scale);
    low.layers.set(LOW_LAYER);
    o.parent.add(low); low.updateMatrixWorld(true);
    sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
    entries.push({hi:o, lo:low, c:sph.center.clone(), r:sph.radius, far:false});
    // keep pointer-style raycasts (click to select) on the real geometry only
    low.raycast = () => {};
  }

  let busy = false;
  function pump(){
    if (busy) return; busy = true;
    const step = () => {
      const o = queue.shift();
      if (!o){ busy = false; return; }
      try { build(o); } catch (e) { console.warn('[lod] skipped', o.name, e); }
      setTimeout(step, 30);   // one mesh at a time: no long freezes
    };
    step();
  }

  setInterval(() => { scan(); if (queue.length) pump(); }, 2500);   // models arrive over time: look again every few seconds
  let tick = 0;
  W.frameHooks.push(() => {
    if ((++tick & 3) !== 0) return;
    const cp = camera.position;
    for (const e of entries){
      const d = cp.distanceTo(e.c) - e.r, far = e.far ? d > NEAR : d > FAR;
      if (far === e.far) continue; e.far = far;
      if (far){ e.hi.layers.set(LOW_LAYER + 1); e.lo.layers.set(0); }   // layer 3 = "hidden": no camera looks at it
      else { e.hi.layers.set(0); e.lo.layers.set(LOW_LAYER); }
    }
  });
  W.lod = {stats, entries, scan, pump, queue, get queued(){ return queue.length; }};
}
