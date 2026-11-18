// Hidden Gems City: The Run. Traffic: cars driving the city plan's road network (W.city.roads), keeping to the right-hand
// lane and picking another road at every junction. One instanced mesh for the bodies,
// one for the lights (headlights and tail-lights glow at night and bloom).
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function init(W){
  const {THREE, scene, camera} = W, Y = W.ROAD !== undefined ? W.ROAD : W.LAND - .4;

  function start(){
    // the street graph from the city plan: every road is a polyline; roads meet where their ends coincide
    const roads = (W.roadChains || W.city && W.city.roads || []).map(r => { const pts = r.pts, cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
      return {pts, cum, len:cum[cum.length-1], lane:r.c === 'blvd' ? 2.6 : 1.5, fast:r.c === 'blvd', slow:r.c === 'site'}; }).filter(r => r.len > .5);
    const key = p => Math.round(p[0]) + ',' + Math.round(p[1]), ends = new Map();
    const node = k => ends.get(k) || (ends.set(k, []), ends.get(k));
    roads.forEach((r, i) => { node(key(r.pts[0])).push([i, 1]); node(key(r.pts[r.pts.length-1])).push([i, -1]); });
    const list = roads.map((r, i) => i).filter(i => roads[i].len > 15); if (!list.length) return;
    const pointAt = (r, s, out) => { let i = 1; while (i < r.cum.length - 1 && r.cum[i] < s) i++;
      const a = r.pts[i-1], b = r.pts[i], seg = r.cum[i] - r.cum[i-1] || 1, f = Math.min(1, Math.max(0, (s - r.cum[i-1]) / seg));
      out[0] = a[0] + (b[0]-a[0])*f; out[1] = a[1] + (b[1]-a[1])*f; out[2] = (b[0]-a[0]) / seg; out[3] = (b[1]-a[1]) / seg; return out; };

    // cars: a body with a cabin, and a light strip (white at the front, red at the back)
    const body = mergeGeometries([new THREE.BoxGeometry(4.4, .75, 1.9).translate(0, .55, 0), new THREE.BoxGeometry(2.3, .6, 1.7).translate(-.25, 1.2, 0)]);
    const front = new THREE.BoxGeometry(.08, .18, 1.5).translate(2.21, .7, 0), back = new THREE.BoxGeometry(.08, .16, 1.6).translate(-2.21, .75, 0);
    const col = (g, c) => { const a = new Float32Array(g.attributes.position.count*3); for (let i = 0; i < a.length; i += 3) a.set(c, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const lightsG = mergeGeometries([col(front, [1, .95, .8]), col(back, [1, .08, .12])]);
    const low = W.realism && W.realism.quality === 'low', N = low ? 45 : 130;
    const paint = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.25, metalness:.55, envMapIntensity:1.2});
    const lightM = new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false});
    const cars = new THREE.InstancedMesh(body, paint, N), lights = new THREE.InstancedMesh(lightsG, lightM, N);
    cars.userData.noCollide = lights.userData.noCollide = true; cars.castShadow = true; cars.frustumCulled = lights.frustumCulled = false;
    const PAINTS = ['#ff3d7f', '#4fe3f2', '#f7f3ea', '#111317', '#b46bff', '#ffd1dc', '#7fffd4', '#ff8a3d', '#2b2f3a', '#e8e8f0'].map(c => new THREE.Color(c));
    const R = (() => { let s = 777; return () => (s = (s*16807) % 2147483647)/2147483647; })();
    const fleet = [];
    for (let k = 0; k < N; k++){ const ri = list[Math.floor(R()*list.length)], dir = R() < .5 ? 1 : -1;
      fleet.push({ri, dir, s:R()*roads[ri].len, v:7 + R()*5, vv:0}); cars.setColorAt(k, PAINTS[k % PAINTS.length]); }
    scene.add(cars, lights);
    const tmp = [0, 0, 0, 0], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    let night = 0; const setNight = W.setNight; W.setNight = n => { setNight(n); night = n; };

    W.frameHooks.push((now, rdt) => {
      const dt = Math.min(.05, rdt || .016), show = !W.inGlobe; cars.visible = lights.visible = show; if (!show) return;
      lightM.color.setScalar(.35 + 1.4*night);
      const pl = W.mode === 'walk' ? W.game.P.pos : null;
      for (let k = 0; k < N; k++){
        const c = fleet[k], r = roads[c.ri]; let target = r.fast ? c.v + 3 : r.slow ? Math.min(6.7, c.v * .55) : c.v * .7;   // campus roads at 15 mph
        const along = c.dir > 0 ? c.s : r.len - c.s; pointAt(r, along, tmp);
        const ux = tmp[2]*c.dir, uz = tmp[3]*c.dir, x = tmp[0] - uz*r.lane, z = tmp[1] + ux*r.lane;    // keep right
        if (r.len - c.s < 6) target = Math.min(target, 5);                                            // slow into the junction
        if (pl && Math.abs(pl.x - x - ux*5) < 3.5 && Math.abs(pl.z - z - uz*5) < 3.5 && Math.abs(pl.y - Y) < 2) target = 0;   // stop for the runner
        c.vv += (target - c.vv)*Math.min(1, dt*2); c.s += c.vv*dt;
        if (c.s >= r.len){                                                                          // pick another road at this end
          const endP = c.dir > 0 ? r.pts[r.pts.length-1] : r.pts[0], opts = (ends.get(key(endP)) || []).filter(([i]) => i !== c.ri);
          const [ni, nd] = opts.length ? opts[Math.floor(Math.random()*opts.length)] : [c.ri, -c.dir];
          c.ri = ni; c.dir = nd; c.s = 0; }
        Q.setFromAxisAngle(UP, Math.atan2(-uz, ux)); P.set(x, Y, z); M.compose(P, Q, S); cars.setMatrixAt(k, M); lights.setMatrixAt(k, M);
      }
      cars.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true;
    });
    W.traffic = {fleet, roads:roads.length};
    console.log('[traffic]', N, 'cars on', roads.length, 'roads');
  }
  (function wait(){ if (W.city && W.grid && W.game && W.game.gems && W.game.gems.length) start(); else setTimeout(wait, 500); })();
}
