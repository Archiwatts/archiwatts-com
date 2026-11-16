// Hidden Gems City: The Run. The game layer over the city: collisions with the real models, a physics player,
// parkour moves (jump, ledge climb, vault, wall kick, wall run, slide), first / third person cameras, hidden gems, touch controls.
// It talks to the city through window.__world (W), the same way hud.js does. The city calls W.step(dt, now) every frame while on foot.
import { MeshBVH } from 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.8/build/index.module.js';

export function init(W){
  const {THREE, scene, camera, canvas, walk, keys, LAND, SEA, PROJECTS} = W, $ = id => document.getElementById(id);
  const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z), clamp = (v,a,b) => Math.min(b, Math.max(a, v));
  const COARSE = matchMedia('(pointer:coarse)').matches;
  const GRAV = 24, RAD = .32, H_STAND = 1.68, H_LOW = 1.0, EYE = 1.56, EYE_LOW = .85,   // 5'6" (1.676 m) tall, eyes ~10 cm below the crown
 FLOOR = W.ROAD !== undefined ? W.ROAD : LAND - .4;   // the street surface (city roads sit at the projects' own road level)
  const UP = V(0,1,0), DOWN = V(0,-1,0);

  // ================= collisions =================
  // Every model becomes a static collider in world space. City pieces overlap and the shader draws each one only on its own blocks,
  // so contacts and ray hits are tested against the same ownership grid: what you cannot see, you cannot touch.
  const colliders = []; let ready = false;
  function visibleAt(own, x, z){
    if (own === -3) return visibleAt(-1, x, z) && !(W.roadAt && W.roadAt(x, z));   // the pavement slab: solid except where a road is cut through it
    if (own === undefined || own < -1.5) return true;
    const g = W.grid, i = Math.floor((x-g.X0)/g.TEX), j = Math.floor((z-g.Z0)/g.TEX);
    if (i < 0 || j < 0 || i >= g.NX || j >= g.NZ) return false;
    const k = (j*g.NX+i)*4; if (g.land[k] < 128) return false;
    return own >= 0 ? g.own[k]-1 === own : g.own[k+2] < 128;
  }
  const floorAt = (x,z) => W.inGlobe ? LAND : visibleAt(-1,x,z) ? FLOOR : null;   // the shared street slab, as a plane

  function addCollider(roots, name, skip){
    const parts = []; let nv = 0, nt = 0, own;
    const visit = o => {
      if (!o.visible || o.userData.noCollide || (skip && skip.has(o))) return;
      if (o.isMesh && o.geometry && o.geometry.attributes.position && !/^water/.test(o.name)){
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && !m.isMeshBasicMaterial && m.userData.own !== -1){
          const n = o.isInstancedMesh ? o.count : 1, g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position.count)/3;
          parts.push(o); nv += g.attributes.position.count*n; nt += Math.floor(tris)*n; if (own === undefined && (m.userData.own >= 0 || m.userData.own === -3)) own = m.userData.own;
        }
      }
      o.children.forEach(visit);
    };
    roots.forEach(r => { r.updateWorldMatrix(true, true); visit(r); });
    if (!nt) return;
    const pos = new Float32Array(nv*3), idx = new Uint32Array(nt*3), v = V(), M = new THREE.Matrix4(); let pv = 0, pi = 0;
    for (const o of parts){
      const g = o.geometry, a = g.attributes.position, ix = g.index, n = o.isInstancedMesh ? o.count : 1, tc = Math.floor((ix ? ix.count : a.count)/3);
      for (let k = 0; k < n; k++){
        if (o.isInstancedMesh){ o.getMatrixAt(k, M); M.premultiply(o.matrixWorld); } else M.copy(o.matrixWorld);
        const base = pv/3;
        for (let i = 0; i < a.count; i++){ v.fromBufferAttribute(a, i).applyMatrix4(M); pos[pv++] = v.x; pos[pv++] = v.y; pos[pv++] = v.z; }
        for (let t = 0; t < tc; t++){
          const A = base + (ix ? ix.getX(t*3) : t*3), B = base + (ix ? ix.getX(t*3+1) : t*3+1), C = base + (ix ? ix.getX(t*3+2) : t*3+2);
          if (own !== undefined){   // drop small triangles that lie wholly in someone else's blocks (big ones are checked at contact time)
            const ax = pos[A*3], az = pos[A*3+2], bx = pos[B*3], bz = pos[B*3+2], cx = pos[C*3], cz = pos[C*3+2];
            const span = Math.max(Math.abs(ax-bx), Math.abs(ax-cx), Math.abs(bx-cx), Math.abs(az-bz), Math.abs(az-cz), Math.abs(bz-cz));
            if (span < 12 && !visibleAt(own,(ax+bx+cx)/3,(az+bz+cz)/3) && !visibleAt(own,ax,az) && !visibleAt(own,bx,bz) && !visibleAt(own,cx,cz)) continue;
          }
          idx[pi++] = A; idx[pi++] = B; idx[pi++] = C;
        }
      }
    }
    if (!pi) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx.slice(0, pi), 1));
    const bvh = new MeshBVH(geo), box = new THREE.Box3(); bvh.getBoundingBox(box);
    colliders.push({name, bvh, box, own, tris:pi/3});
  }

  const ray = new THREE.Ray(), tmp = V();
  // nearest thing along a ray (models first, then the street slab). out: {point, normal, distance}
  function cast(origin, dir, far, out){
    let best = far, found = false; ray.origin.copy(origin); ray.direction.copy(dir);
    const take = h => { best = h.distance; out.point.copy(h.point); out.normal.copy(h.face.normal); if (out.normal.dot(dir) > 0) out.normal.negate(); found = true; };
    for (const c of colliders){
      if (!c.box.containsPoint(origin)){ const p = ray.intersectBox(c.box, tmp); if (!p || p.distanceTo(origin) > best) continue; }
      if (c.own === undefined){ const h = c.bvh.raycastFirst(ray, THREE.DoubleSide, 0, best); if (h && h.distance < best) take(h); }
      else for (const h of c.bvh.raycast(ray, THREE.DoubleSide, 0, best)) if (h.distance < best && visibleAt(c.own, h.point.x, h.point.z)) take(h);
    }
    if (dir.y < -1e-4){ const fy = W.inGlobe ? LAND : FLOOR, t = (fy - origin.y)/dir.y;
      if (t > 0 && t < best){ const x = origin.x + dir.x*t, z = origin.z + dir.z*t; if (floorAt(x,z) !== null){ best = t; out.point.set(x,fy,z); out.normal.set(0,1,0); found = true; } } }
    out.distance = best; return found;
  }
  const hit = {point:V(), normal:V(), distance:0}, hit2 = {point:V(), normal:V(), distance:0};

  // ================= the player =================
  const P = {pos:V(), vel:V(), h:H_STAND, ground:false, gN:V(0,1,0), air:0, coyote:0, jumpBuf:0, low:false, slide:false, slideT:0,
    wr:null, wrCool:0, dj:false, djT:9, camD:4.6, lastWallN:V(), lastWallT:-9, kick:false, climb:null, sprintT:0, stroll:false,
    eye:EYE, dip:0, lift:0, roll:0, bobT:0, fov:72, safe:V(), safeT:0, face:0, phase:0, state:'RUN',
    ride:false, rideLift:0, rideRoll:0};   // set by ride.js while on a skateboard or scooter
  const lastEye = V(1e9,0,0), seg = new THREE.Line3(), aabb = new THREE.Box3(), tp = V(), cp = V(), dv = V(), fwd = V(), right = V(), wish = V(), o1 = V(), o2 = V(), d1 = V();
  let lowEdge = false, jumped = false, placed = false; const joy = {x:0, y:0}, touch = {low:false};

  // push the capsule out of whatever it touches; returns true when it rests on walkable ground
  function collide(){
    const r = RAD, sx = P.pos.x, sy = P.pos.y, sz = P.pos.z; let maxNy = -1;
    seg.start.set(sx, sy + r, sz); seg.end.set(sx, sy + P.h - r, sz);
    aabb.makeEmpty().expandByPoint(seg.start).expandByPoint(seg.end).expandByScalar(r + .05);
    for (const c of colliders){
      if (!c.box.intersectsBox(aabb)) continue;
      c.bvh.shapecast({ intersectsBounds: b => b.intersectsBox(aabb), intersectsTriangle: tri => {
        const d = tri.closestPointToSegment(seg, tp, cp); if (d >= r) return;
        if (c.own !== undefined && !visibleAt(c.own, tp.x, tp.z)) return;
        if (d < 1e-6) tri.getNormal(dv); else dv.copy(cp).sub(tp).multiplyScalar(1/d);
        seg.start.addScaledVector(dv, r - d); seg.end.addScaledVector(dv, r - d);
        if (dv.y > maxNy){ maxNy = dv.y; P.gN.copy(dv); }
      }});
    }
    const fy = floorAt(seg.start.x, seg.start.z);
    if (fy !== null && seg.start.y - r < fy && seg.start.y - r > fy - 1.6){ seg.start.y = fy + r; maxNy = 1; P.gN.set(0,1,0); }
    dv.set(seg.start.x - sx, seg.start.y - r - sy, seg.start.z - sz); P.pos.set(seg.start.x, seg.start.y - r, seg.start.z);
    const l = dv.length(); if (l > 1e-6){ dv.multiplyScalar(1/l); const vn = P.vel.dot(dv); if (vn < 0) P.vel.addScaledVector(dv, -vn); }
    return maxNy > .62;
  }
  function overlaps(lift){   // is the capsule inside something? (used when placing the player after a jump in position)
    seg.start.set(P.pos.x, P.pos.y + RAD + lift, P.pos.z); seg.end.set(P.pos.x, P.pos.y + P.h - RAD + lift, P.pos.z);
    aabb.makeEmpty().expandByPoint(seg.start).expandByPoint(seg.end).expandByScalar(RAD); let any = false;
    for (const c of colliders){ if (any || !c.box.intersectsBox(aabb)) continue;
      c.bvh.shapecast({ intersectsBounds: b => b.intersectsBox(aabb), intersectsTriangle: tri => { if (tri.closestPointToSegment(seg, tp, cp) < RAD && visibleAt(c.own, tp.x, tp.z)){ any = true; return true; } } }); }
    return any;
  }
  function place(){   // stand the player on something solid: the ground here if it is free, otherwise the roof above
    if (!ready) return; placed = true;
    if (overlaps(.45)){ o1.set(P.pos.x, P.pos.y + 400, P.pos.z); if (cast(o1, DOWN, 460, hit)) P.pos.y = hit.point.y + .02; }
    else { o1.set(P.pos.x, P.pos.y + 1.2, P.pos.z); if (cast(o1, DOWN, 400, hit)) P.pos.y = hit.point.y + .02; }
    P.safe.copy(P.pos);
  }
  function teleported(){
    P.pos.set(walk.pos.x, walk.pos.y - 1.6, walk.pos.z); P.vel.set(0,0,0); P.climb = P.wr = null; P.slide = P.low = false; P.h = H_STAND; P.ground = false; placed = false; place();
  }
  function respawn(msg){
    P.pos.copy(P.safe); P.vel.set(0,0,0); P.climb = P.wr = null; P.slide = false; const f = $('flash'); if (f){ f.style.opacity = .7; setTimeout(() => f.style.opacity = 0, 180); } if (msg) toast(msg);
  }
  const headFree = () => { o1.set(P.pos.x, P.pos.y + H_LOW - .1, P.pos.z); return !cast(o1, UP, H_STAND - H_LOW + .2, hit); };

  // ---- ledges: climb (mantle) and vault ----
  // Looks for a flat top in front of the player between minUp and maxUp above the feet, with open air above it.
  function tryClimb(maxUp, minUp){
    for (const reach of [RAD + .3, RAD + .62]){
      o1.copy(P.pos).addScaledVector(fwd, reach); o1.y += maxUp + .05;
      if (!cast(o1, DOWN, maxUp - minUp + .05, hit) || hit.normal.y < .7) continue;
      const top = hit.point.y, up = top - P.pos.y; if (up < minUp || up > maxUp) continue;
      o2.copy(P.pos); o2.y = top + .25;                                                           // open from the player to the landing spot, above the ledge
      if (cast(o2, fwd, reach + .15, hit2)) continue;
      if (top + .25 > P.pos.y + P.h){ o2.copy(P.pos); o2.y += P.h - .1; if (cast(o2, UP, top + .35 - (P.pos.y + P.h), hit2)) continue; }   // nothing overhead on the way up
      o2.set(o1.x, top + .1, o1.z); const room = cast(o2, UP, H_STAND, hit2) ? hit2.distance : 9; if (room < H_LOW + .05) continue;   // room to at least crouch on top
      const hv = Math.hypot(P.vel.x, P.vel.z), vault = P.ground && up <= 1.25;
      P.climb = {t:0, from:P.pos.clone(), to:V(o1.x, top + .02, o1.z), dir:fwd.clone(), dur: vault ? .26 + up*.1 : .3 + up*.17, vault, speed:hv, low: room < H_STAND + .1};
      P.wr = null; P.slide = false; P.vel.set(0,0,0); return true;
    }
    return false;
  }
  function stepClimb(dt){
    const c = P.climb; c.t = Math.min(1, c.t + dt/c.dur); const a = clamp(c.t/.62, 0, 1), b = clamp((c.t - .45)/.55, 0, 1), ea = 1 - (1-a)*(1-a), eb = b*b*(3 - 2*b);
    P.pos.set(c.from.x + (c.to.x - c.from.x)*eb, c.from.y + (c.to.y - c.from.y)*ea, c.from.z + (c.to.z - c.from.z)*eb);
    if (c.t >= 1){ P.climb = null; P.ground = true; P.air = 0; P.kick = false; P.dj = false; if (c.low){ P.low = true; P.h = H_LOW; }
      P.vel.copy(c.dir).multiplyScalar(c.vault ? Math.max(c.speed, 5) : Math.min(c.speed, 3) + 1.5); }
  }

  // ---- wall run ----
  function tryWallRun(now, hv, f){
    if (P.ground || P.wrCool > 0 || P.air < .1 || hv < 5.2 || f < .3 || P.vel.y < -10) return;
    o1.copy(P.pos); o1.y += .1; if (cast(o1, DOWN, 1.1, hit)) return;                               // too close to the ground
    d1.set(-P.vel.z/hv, 0, P.vel.x/hv); o1.copy(P.pos); o1.y += 1.1;
    for (const side of [1, -1]){
      d1.multiplyScalar(side === 1 ? 1 : -1);
      if (!cast(o1, d1, .92, hit) || Math.abs(hit.normal.y) > .3) continue;
      if (hit.normal.dot(P.lastWallN) > .9 && now - P.lastWallT < 1200) continue;                  // not the same wall twice in a row
      P.wr = {n:hit.normal.clone().setY(0).normalize(), t:0, side}; P.vel.y = clamp(P.vel.y + 1.5, 1, 4.2); P.kick = false; P.dj = false; return;   // a wall run gives the double jump back
    }
  }
  function endWallRun(now){ P.lastWallN.copy(P.wr.n); P.lastWallT = now; P.wrCool = .35; P.wr = null; }
  function stepWallRun(dt, now, f){
    const w = P.wr; w.t += dt; o1.copy(P.pos); o1.y += 1.1; d1.copy(w.n).negate();
    if (!cast(o1, d1, 1.15, hit) || Math.abs(hit.normal.y) > .35 || P.ground || f < .2 || lowEdge || w.t > 1.8) return endWallRun(now);
    w.n.copy(hit.normal).setY(0).normalize();                                                      // follows curved walls
    d1.set(w.n.z, 0, -w.n.x); if (d1.x*P.vel.x + d1.z*P.vel.z < 0) d1.negate();
    const sp = Math.max(Math.hypot(P.vel.x, P.vel.z), 7.5), stick = (hit.distance - RAD - .05)*8;
    if (P.jumpBuf > 0){ P.jumpBuf = 0; P.vel.set(d1.x*sp + w.n.x*5.5, 7.8, d1.z*sp + w.n.z*5.5); jumped = true; return endWallRun(now); }
    P.vel.x = d1.x*sp - w.n.x*stick; P.vel.z = d1.z*sp - w.n.z*stick;
    P.vel.y = Math.max(-4, P.vel.y - GRAV*(w.t < .9 ? .1 : .45)*dt);
  }

  // ---- one frame of movement ----
  function stepMove(dt, now, f, s, sprint, lowHeld){
    const vel = P.vel, moving = wish.lengthSq() > .003; let hv = Math.hypot(vel.x, vel.z);
    if (lowEdge && P.ground && hv > 6.2 && !P.slide){ P.slide = true; P.slideT = 0; const k = Math.min(13.5, hv + 1.8)/hv; vel.x *= k; vel.z *= k; }
    if (P.slide){ P.slideT += dt; if ((!lowHeld && P.slideT > .25) || hv < 3 || (!P.ground && P.air > .4)) P.slide = false; }
    const wantLow = lowHeld || P.slide;
    if (wantLow && !P.low){ P.low = true; P.h = H_LOW; } else if (!wantLow && P.low && headFree()){ P.low = false; P.h = H_STAND; }
    if (sprint && moving && f > -.1 && !P.low) P.sprintT = Math.min(2.5, P.sprintT + dt); else if (hv < 5) P.sprintT = 0;
    const top = P.low ? 2.4 : P.stroll ? 1.6 : sprint && f > -.1 ? 8.4 + P.sprintT/2.5*2.4 : 5.2;

    if (P.wr) stepWallRun(dt, now, f);
    if (!P.wr){
      if (P.ground){
        if (P.slide){ const k = Math.max(0, hv - 2.6*dt)/(hv || 1); vel.x = vel.x*k + (P.gN.x*16 + wish.x*4)*dt; vel.z = vel.z*k + (P.gN.z*16 + wish.z*4)*dt; }
        else { const tx = wish.x*top - vel.x, tz = wish.z*top - vel.z, l = Math.hypot(tx, tz), a = (moving ? 46 : 38)*dt; if (l <= a){ vel.x += tx; vel.z += tz; } else { vel.x += tx/l*a; vel.z += tz/l*a; } }
      } else {
        vel.x += wish.x*13*dt; vel.z += wish.z*13*dt; const nh = Math.hypot(vel.x, vel.z), cap = Math.max(hv, 5.2); if (nh > cap){ vel.x *= cap/nh; vel.z *= cap/nh; }
      }
      vel.y -= GRAV*dt;
      if (P.jumpBuf > 0){
        if (P.ground || P.coyote > 0){ P.jumpBuf = 0; if (!tryClimb(2.5, .56)){ vel.y = 7.6; P.slide = false; P.ground = false; P.coyote = 0; jumped = true; } }
        else if (tryClimb(2.45, .3)) P.jumpBuf = 0;
        else { let kicked = false;
          if (!P.kick && f > .3){ o1.copy(P.pos); o1.y += 1; if (cast(o1, fwd, RAD + .75, hit) && Math.abs(hit.normal.y) < .4){ vel.x *= .3; vel.z *= .3; vel.y = 7.4; P.kick = true; P.jumpBuf = 0; jumped = true; kicked = true; } }   // kick up the wall
          if (!kicked && !P.dj){   // double jump: one more push in mid-air, steered toward where you are pressing
            vel.y = 7.2; if (wish.lengthSq() > .01){ const hv2 = Math.max(Math.hypot(vel.x, vel.z), 5.2); vel.x = vel.x*.4 + wish.x*hv2*.6; vel.z = vel.z*.4 + wish.z*hv2*.6; }
            P.dj = true; P.djT = 0; P.jumpBuf = 0; jumped = true; } }
      }
      if (!P.climb && f > .3){   // without pressing anything: grab ledges while in the air, vault low things at a sprint
        if (!P.ground && P.air > .1 && vel.y < 4) tryClimb(2.45, .5); else if (P.ground && hv > 6 && !P.low && !jumped) tryClimb(1.25, .58);
      }
      if (!P.climb && !P.wr) tryWallRun(now, Math.hypot(vel.x, vel.z), f);
    }
    if (P.climb) return;

    // move in small steps so nothing is tunnelled through
    const n = clamp(Math.ceil(vel.length()*dt/.14), 1, 8), sdt = dt/n, x0 = P.pos.x, z0 = P.pos.z, preVy = vel.y, was = P.ground; let grounded = false;
    hv = Math.hypot(vel.x, vel.z);
    for (let i = 0; i < n; i++){ P.pos.addScaledVector(vel, sdt); grounded = collide(); }
    if (!grounded && was && !jumped && vel.y <= .5){   // keep feet on the ground down steps and slopes
      o1.copy(P.pos); o1.y += .3; if (cast(o1, DOWN, .75, hit) && hit.normal.y > .62){ P.lift += P.pos.y - hit.point.y; P.pos.y = hit.point.y; vel.y = 0; grounded = true; } }
    if (grounded && moving && !P.slide && hv*dt > .01 && Math.hypot(P.pos.x - x0, P.pos.z - z0) < hv*dt*.5){   // blocked: is it a step?
      o1.copy(P.pos).addScaledVector(wish, (RAD + .22)/Math.max(.2, wish.length())); o1.y += .62;
      if (cast(o1, DOWN, .56, hit) && hit.normal.y > .7 && hit.point.y - P.pos.y > .06){ P.lift += P.pos.y - hit.point.y; P.pos.y = hit.point.y + .01; P.pos.addScaledVector(wish, .12); } }
    if (grounded){
      if (!was){ const v = -preVy; if (v > 12){ if (lowHeld){ P.dip = .6; } else { P.dip = 1; vel.x *= .45; vel.z *= .45; } } else if (v > 5) P.dip = .3; }
      P.air = 0; P.coyote = .12; P.kick = false; P.dj = false;
    } else { P.air += dt; P.coyote -= dt; }
    P.ground = grounded;
  }

  // ---- cameras and the third-person runner ----
  W.avatar.children.forEach(c => c.visible = false);   // the third-person body is the sketch figure (figures.js)
  function view(dt){
    const hv = Math.hypot(P.vel.x, P.vel.z), k = r => 1 - Math.exp(-dt*r);
    P.eye += ((P.low ? EYE_LOW : EYE) - P.eye)*k(12); P.lift *= Math.exp(-dt*14); P.dip *= Math.exp(-dt*7);
    if (P.ground && hv > 1 && !P.slide && !P.ride) P.bobT += hv*dt*1.9;
    const bob = (P.ride ? 0 : Math.sin(P.bobT)*.035*Math.min(1, hv/6)) + (P.climb ? Math.sin(P.climb.t*Math.PI)*-.12 : 0) + P.rideLift;
    P.roll += ((P.ride ? P.rideRoll : P.wr ? .2*P.wr.side : P.slide ? -.07 : 0) - P.roll)*k(9);
    P.fov += (72 + clamp((hv - 5)/6, 0, 1)*13 - P.fov)*k(5);
    if (Math.abs(camera.fov - P.fov) > .05 || camera.near !== .12){ camera.fov = P.fov; camera.near = .12; camera.updateProjectionMatrix(); }
    walk.pos.set(P.pos.x, P.pos.y + P.eye + bob - P.dip*.35 + P.lift, P.pos.z); lastEye.copy(walk.pos);
    camera.rotation.set(walk.pitch, walk.yaw, P.roll, 'YXZ'); camera.position.copy(walk.pos);
    if (W.third){
      const cpi = Math.cos(walk.pitch); d1.set(Math.sin(walk.yaw)*cpi, -Math.sin(walk.pitch), Math.cos(walk.yaw)*cpi);   // straight back from where you look
      o1.set(P.pos.x, P.pos.y + (P.low ? 1 : 1.5) + P.rideLift, P.pos.z); const d = cast(o1, d1, P.camD, hit) ? Math.max(.5, hit.distance - .3) : P.camD;
      camera.position.copy(o1).addScaledVector(d1, d); camera.position.y += .2; camera.rotation.z = 0;
      W.avatar.position.copy(P.pos);
    }
    P.phase += Math.hypot(P.vel.x, P.vel.z)*dt*(P.ground ? 1.15 : 0);   // stride phase, read by the figure
  }

  // ---- the frame, called by the city while on foot ----
  W.step = (dt, now) => {
    if (walk.pos.distanceToSquared(lastEye) > 1e-6) teleported();
    if (ready && !placed) place();
    if (P.ride && W.ride){ P.jumpBuf -= dt; if (ready) W.ride.step(dt, now); lowEdge = false; view(dt); return; }   // on a board or scooter: ride.js moves the player
    const cy = Math.cos(walk.yaw), sy = Math.sin(walk.yaw); fwd.set(-sy, 0, -cy); right.set(cy, 0, -sy);
    let f = (keys.KeyW||keys.ArrowUp?1:0) - (keys.KeyS||keys.ArrowDown?1:0) - joy.y, s = (keys.KeyD||keys.ArrowRight?1:0) - (keys.KeyA||keys.ArrowLeft?1:0) + joy.x;
    const jm = Math.hypot(joy.x, joy.y), sprint = keys.ShiftLeft || keys.ShiftRight || jm > .92, lowHeld = !!keys.KeyC || touch.low;
    wish.set(0,0,0).addScaledVector(fwd, f).addScaledVector(right, s); const wl = wish.length(); if (wl > 1) wish.multiplyScalar(1/wl);
    P.jumpBuf -= dt; P.wrCool -= dt; P.djT += dt; jumped = false;
    if (ready){
      if (P.climb) stepClimb(dt); else stepMove(dt, now, f, s, sprint, lowHeld);
      if (!W.inGlobe && (P.pos.y < SEA - 1.1)) respawn('Splash. Back on dry land.'); else if (P.pos.y < -80) respawn();
      if (P.ground && !P.slide && !P.climb){ P.safeT += dt; if (P.safeT > .5){ P.safeT = 0; P.safe.copy(P.pos); } }
    }
    lowEdge = false; view(dt);
    const hv = Math.hypot(P.vel.x, P.vel.z);
    P.state = P.climb ? (P.climb.vault ? 'VAULT' : 'CLIMB') : P.wr ? 'WALL RUN' : P.slide ? 'SLIDE' : !P.ground ? 'AIR' : P.low ? 'CROUCH' : hv > 7.5 ? 'SPRINT' : hv > 2.2 ? 'RUN' : hv > .3 ? 'WALK' : 'READY';
  };

  // ================= input =================
  addEventListener('keydown', e => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyO'){ if (W.mode === 'walk'){ document.exitPointerLock?.(); W.setMode('orbit'); W.view.t.copy(P.pos); W.view.r = 110; W.view.ph = 1.05; } else W.setMode('walk'); return; }
    if (e.code === 'KeyH'){ $('gmHelp').hidden = !$('gmHelp').hidden; return; }
    if (W.mode !== 'walk') return;
    if (e.code === 'Space'){ e.preventDefault(); if (!e.repeat) P.jumpBuf = .15; }
    else if (e.code === 'KeyC' && !e.repeat) lowEdge = true;
    else if (e.code === 'KeyX') { P.stroll = !P.stroll; toast(P.stroll ? 'Stroll: slow walk to take in the architecture' : 'Run'); }
    else if (e.code === 'KeyR') respawn('Back to your last footing.');
    if (/^(KeyE|KeyQ|KeyM)$/.test(e.code)) document.exitPointerLock?.();   // these open panels that need the mouse
  });
  const lock = () => { if (!COARSE && W.mode === 'walk' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); };
  canvas.addEventListener('click', () => { if (W.mode !== 'walk' || COARSE) return; if (!$('hud').hidden) $('hud').hidden = true; if ($('welcome').hidden) lock(); });
  $('wWalk').addEventListener('click', lock);
  canvas.addEventListener('wheel', e => { if (W.mode !== 'walk') return;   // on foot: the wheel sets how far behind you the third-person camera sits
    if (!W.third && e.deltaY > 0){ W.setThird(true); P.camD = 2.2; return; } if (!W.third) return;
    P.camD = clamp(P.camD*Math.exp(clamp(e.deltaY*(e.deltaMode === 1 ? 33 : 1), -200, 200)*.0015), 1.6, 12); if (P.camD <= 1.65 && e.deltaY < 0) W.setThird(false); }, {passive:true});
  document.addEventListener('mousemove', e => { if (document.pointerLockElement !== canvas || W.mode !== 'walk') return;
    walk.yaw -= e.movementX*.0022; walk.pitch = clamp(walk.pitch - e.movementY*.0022, -1.45, 1.45); });

  // ================= HUD: speed, gems, help, touch controls =================
  document.head.insertAdjacentHTML('beforeend', `<style>
    #gm{position:fixed;inset:0;pointer-events:none;z-index:3;font:500 13px/1.25 Rajdhani,system-ui,sans-serif;color:#fff;letter-spacing:.08em;text-transform:uppercase}
    #gm>*{position:absolute} #gm [hidden]{display:none!important}
    #gm .pn{background:linear-gradient(rgba(12,12,16,.86),rgba(12,12,16,.86));border-left:2px solid #e0b057;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));padding:8px 14px 7px 12px}
    #gmSpeed{left:50%;bottom:118px;transform:translateX(-50%);display:none;text-align:center;min-width:150px}
    body[data-mode=walk] #gmSpeed{display:block}
    #gmSpeed b{font:400 22px "Share Tech Mono",monospace;color:#4fe3f2;letter-spacing:0}#gmSpeed small{font:400 11px "Share Tech Mono",monospace;color:#a4a6ad;text-transform:none;letter-spacing:0}
    #gmSpeed span{display:block;color:#e0b057;font-size:12px;letter-spacing:.16em}#gmSpeed span.hot{color:#ff3d7f}
    #gmToast{left:50%;top:30%;transform:translateX(-50%);display:none;border-left-color:#ff3d7f;font-size:15px;white-space:nowrap}
    #gmHelp{left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,92vw);pointer-events:auto;font-size:14px}
    #gmHelp h4{margin:0 0 8px;color:#e0b057;font-size:16px;letter-spacing:.14em}#gmHelp dl{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;margin:0;text-transform:none;letter-spacing:.02em}
    #gmHelp dt{font:400 12px "Share Tech Mono",monospace;color:#0c0c10;background:#4fe3f2;padding:1px 6px;align-self:start;white-space:nowrap}#gmHelp dd{margin:0}
    #gmTouch{inset:0;display:none}
    body[data-mode=walk] #gmTouch.on{display:block}
    #gmZone{position:absolute;left:0;bottom:0;width:46vw;height:58vh;pointer-events:auto;touch-action:none}
    #gmStick{position:absolute;width:112px;height:112px;margin:-56px 0 0 -56px;border:2px solid rgba(224,176,87,.7);border-radius:50%;display:none;background:rgba(12,12,16,.3)}
    #gmStick i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:#e0b057}
    #gmTouch button{position:absolute;pointer-events:auto;touch-action:none;width:66px;height:66px;border-radius:50%;border:2px solid #e0b057;background:rgba(12,12,16,.55);color:#fff;font:600 12px Rajdhani,sans-serif;letter-spacing:.08em}
    #gmJump{right:22px;bottom:96px;width:84px!important;height:84px!important;border-color:#ff3d7f!important}#gmLow{right:122px;bottom:74px}#gmCam{right:26px;bottom:200px}
    #gmOrbit{right:122px;bottom:170px}
    @media (max-width:980px){#gmSpeed{bottom:8px;min-width:110px}#gmSpeed small{display:none}
      body[data-mode=walk] #modes{display:none} body[data-mode=walk] #found{top:52px;bottom:auto;max-width:calc(100vw - 24px)}}
  </style>`);
  document.body.insertAdjacentHTML('beforeend', `<div id="gm">
    <div id="gmSpeed" class="pn"><b id="gmV">0.0</b> <small>m/s</small><span id="gmState">READY</span></div>
    <div id="gmToast" class="pn"></div>
    <div id="gmHelp" class="pn" hidden><h4>How to run the city</h4><dl>
      <dt>W A S D</dt><dd>Move. The mouse looks (click the view to capture it, Esc frees it).</dd>
      <dt>Shift</dt><dd>Sprint. Speed builds the longer you hold a line.</dd>
      <dt>Space</dt><dd>Jump. Again in mid-air: double jump. Facing a ledge: climb or vault it. In the air against a wall: kick up it once.</dd>
      <dt>Wall run</dt><dd>Sprint, jump, and travel along a wall. Space jumps off it.</dd>
      <dt>C</dt><dd>Slide when sprinting, crouch when slow. Hold it on a hard landing to keep your speed.</dd>
      <dt>E</dt><dd>Open the file of the project you are near or aiming at.</dd>
      <dt>V · O</dt><dd>First / third person · orbit the city from where you stand.</dd>
      <dt>P</dt><dd>Choose your figure (on a phone: hold View).</dd>
      <dt>G</dt><dd>Graphics: Ultra / High / Low.</dd>
      <dt>X · R</dt><dd>Stroll (slow walk) · back to your last footing.</dd>
      <dt>Q · M</dt><dd>Call-in menu (fast travel) · city map.</dd></dl></div>
    <div id="gmTouch" class="${COARSE ? 'on' : ''}"><div id="gmZone"><div id="gmStick"><i></i></div></div>
      <button id="gmCam" type="button">View</button><button id="gmOrbit" type="button">Orbit</button><button id="gmLow" type="button">Slide</button><button id="gmJump" type="button">Jump</button></div>
  </div>`);
  function toast(t){ const e = $('gmToast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', 2800); }
  if ($('ghBars')) $('ghBars').insertAdjacentHTML('beforeend', '<div class="row"><span>Gems found</span><b id="gmCount">00 / 00</b><div class="bar"><i id="gmFill"></i></div></div>');

  { const zone = $('gmZone'), stick = $('gmStick'), nub = stick.firstElementChild; let id = null, ox = 0, oy = 0;   // left thumb: a stick that appears where you touch
    zone.addEventListener('pointerdown', e => { id = e.pointerId; ox = e.clientX; oy = e.clientY; zone.setPointerCapture(id); const r = zone.getBoundingClientRect(); stick.style.display = 'block'; stick.style.left = ox - r.left + 'px'; stick.style.top = oy - r.top + 'px'; nub.style.transform = ''; });
    zone.addEventListener('pointermove', e => { if (e.pointerId !== id) return; let x = (e.clientX - ox)/52, y = (e.clientY - oy)/52; const l = Math.hypot(x, y); if (l > 1){ x /= l; y /= l; } joy.x = x; joy.y = y; nub.style.transform = `translate(${x*40}px,${y*40}px)`; });
    const end = e => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; stick.style.display = 'none'; }; zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    $('gmJump').addEventListener('pointerdown', e => { e.preventDefault(); P.jumpBuf = .15; });
    $('gmLow').addEventListener('pointerdown', e => { e.preventDefault(); touch.low = true; lowEdge = true; }); ['pointerup','pointercancel','pointerleave'].forEach(n => $('gmLow').addEventListener(n, () => touch.low = false));
    $('gmCam').addEventListener('click', () => W.setThird(!W.third));
    $('gmOrbit').addEventListener('click', () => { W.setMode('orbit'); W.view.t.copy(P.pos); W.view.r = 110; W.view.ph = 1.05; }); }

  // ================= hidden gems: one at every project =================
  const gems = [], gemGroup = new THREE.Group(); scene.add(gemGroup); const KEY = 'hgc-run-gems';
  const loadFound = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const saveFound = () => { try { localStorage.setItem(KEY, JSON.stringify(gems.filter(g => g.found).map(g => g.key))); } catch (e) {} };
  function placeGems(){
    const found = loadFound(), geo = new THREE.OctahedronGeometry(.34, 0); geo.scale(1, 1.45, 1);
    const mat = new THREE.MeshStandardMaterial({color:0xe0b057, emissive:0xe0b057, emissiveIntensity:1.6, roughness:.25, metalness:.6, flatShading:true});
    const beamG = new THREE.CylinderGeometry(.05, .05, 26, 6, 1, true); beamG.translate(0, 13, 0);
    const beamM = new THREE.MeshBasicMaterial({color:0xe0b057, transparent:true, opacity:.28, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide});
    PROJECTS.forEach((p, i) => { if (!p.pos) return;
      let x = p.pos.x, z = p.pos.z, y = null; if (p.piece === 'globe'){ x = W.ARCH_X; z = W.ARCH_Z || 0; }                     // Phalanstery's gem sits on top of the welcome arch
      const top = p.pos.y + (p.top || 10) + 45; o1.set(x, top, z);
      if (cast(o1, DOWN, top + 20, hit) && hit.point.y - LAND < 30) y = hit.point.y;
      if (y === null){ const mk = W.markers.children.find(m => m.userData.pi === i); if (mk){ x = mk.position.x + 3; z = mk.position.z; } o1.set(x, LAND + 8, z); y = cast(o1, DOWN, 12, hit) ? hit.point.y : LAND; }   // too tall to climb yet: by its marker
      const g = new THREE.Group(); g.position.set(x, y + 1.15, z); g.add(new THREE.Mesh(geo, mat)); const beam = new THREE.Mesh(beamG, beamM); g.add(beam); gemGroup.add(g);
      const gem = {key:p.piece, name:p.name, g, found:found.includes(p.piece)}; g.visible = !gem.found; gems.push(gem); });
    countGems();
  }
  function countGems(){ const n = gems.filter(g => g.found).length, c = $('gmCount'); if (c){ c.textContent = String(n).padStart(2,'0') + ' / ' + String(gems.length).padStart(2,'0'); $('gmFill').style.width = (gems.length ? n/gems.length*100 : 0) + '%'; } return n; }

  // ================= every frame (all modes) =================
  let tick = 0;
  W.frameHooks.push((now, rdt) => {
    const onFoot = W.mode === 'walk';
    if (!onFoot && (camera.fov !== 45 || camera.near !== .3)){ camera.fov = 45; camera.near = .3; camera.updateProjectionMatrix(); }
    if (document.pointerLockElement === canvas && (!onFoot || !$('hud').hidden || ['ghCall','ghTravel','ghBig'].some(id => $(id) && !$(id).hidden))) document.exitPointerLock();
    const t = now*.001; gemGroup.visible = !W.inGlobe;
    for (const g of gems){ if (g.found) continue; g.g.children[0].rotation.y = t*1.4; g.g.children[0].position.y = Math.sin(t*2 + g.g.position.x)*.12;
      if (onFoot && Math.abs(g.g.position.x - P.pos.x) < 1.5 && Math.abs(g.g.position.z - P.pos.z) < 1.5 && Math.abs(g.g.position.y - P.pos.y - .9) < 1.9){
        g.found = true; g.g.visible = false; saveFound(); const n = countGems(); toast(n === gems.length ? 'Every gem found. The city is yours.' : `Gem found · ${g.name} · ${n} / ${gems.length}`); } }
    if (onFoot && tick++ % 4 === 0){ $('gmV').textContent = Math.hypot(P.vel.x, P.vel.z).toFixed(1); const s = $('gmState'); s.textContent = P.state; s.classList.toggle('hot', /WALL|SLIDE|CLIMB|VAULT|GRIND|MANUAL|FLIP|WHIP|SPIN|BAIL/.test(P.state)); }
  });

  // ================= build the colliders once the city has loaded =================
  const pause = () => new Promise(r => setTimeout(r, 0));
  async function worldLoaded(){
    const ld = $('load'), t0 = performance.now(), say = t => { if (ld){ ld.hidden = false; ld.textContent = t; } };
    const pieceRoots = new Set(Object.values(W.pieces).map(p => p.g));
    const skip = new Set([W.sea, W.ring, W.hits, W.markers, W.globe, W.inside, W.avatar, gemGroup, ...pieceRoots]);
    say('Building the city you can touch…'); await pause();
    const pave = scene.children.filter(o => o.isMesh && o.material && o.material.userData && o.material.userData.own === -3); pave.forEach(o => skip.add(o));
    addCollider(scene.children.filter(o => !skip.has(o)), 'city', skip);
    if (pave.length) addCollider(pave, 'pavement');                       // its own collider: solid except over the roads (own -3)
    const list = Object.values(W.pieces);
    for (const [i, p] of list.entries()){ say(`Building the city you can touch… ${i+1} / ${list.length}`); await pause(); try { addCollider([p.col || p.g], p.slug); } catch (e) { console.error('collider', p.slug, e); } }
    ready = true; place(); placeGems(); if (ld) ld.hidden = true;
    console.log('[game] colliders', colliders.map(c => c.name + ':' + c.tris).join(' '), Math.round(performance.now() - t0) + ' ms');
  }
  W.game = {P, colliders, cast, gems, respawn, collide, visibleAt, toast, joy, touch, H_STAND, get ready(){ return ready; }};   // ride.js rides on these
  return {worldLoaded};
}
