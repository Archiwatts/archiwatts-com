// Hidden Gems City: The Run. Wheels: a skateboard and a kick scooter beside the on-foot parkour (B cycles On foot > Skateboard > Scooter).
// Arcade skate physics on the same capsule and colliders as game.js: push, carve with momentum, roll down slopes, ollie, flip tricks,
// spins and grabs in the air, manuals, grinds and slides, bails. Grind edges are found in the geometry under the board (any near-level
// triangle edge with a drop on at least one side: kerbs, ledges, rails, roof edges), so the riding works on any city layout.
// game.js hands the frame to step() while P.ride is set; figures.js reads `pose` to put the rider on the board.
export function init(W){
  const {THREE, scene, canvas, walk, keys, SEA} = W, G = W.game, P = G.P, $ = id => document.getElementById(id);
  const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z), clamp = (v,a,b) => Math.min(b, Math.max(a, v));
  const ad = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)), yawOf = (x, z) => Math.atan2(-x, -z);   // same yaw as walk.yaw: forward = (-sin, -cos)
  const GRAV = 24, RAD = .32, RIDE_H = 1.6, PI = Math.PI, DOWN = V(0,-1,0), UP = V(0,1,0);
  const ORDER = ['foot', 'skate', 'scooter'], NAME = {foot:'On foot', skate:'Skateboard', scooter:'Scooter'}, KEY = 'hgc-run-ride';
  const KIT = {   // push: average push acceleration (m/s²) up to top; turn: carve rate (rad/s) slow > fast; drift: how quickly balance runs away
    skate:   {push:3.6, top:8.4, cycle:.85, on:.45, turn:2.4, turnHi:1.45, grip:9,  pop:7.1, spin:8.6, drift:1.0, deck:.11, brake:6.5, maxV:17, grindPts:70, grab:'INDY GRAB'},
    scooter: {push:5.6, top:9.8, cycle:.62, on:.55, turn:3.3, turnHi:2.1,  grip:13, pop:6.5, spin:9.6, drift:1.75, deck:.11, brake:8.5, maxV:16, grindPts:60, grab:'TABLETOP'}
  };
  const R = {mode:'foot', K:null, yaw:0, fakie:false, steer:0, inF:0, push:false, brake:false, pushT:0, pushB:0, air:0, coyote:0, popped:false,
    spin:0, spinV:0, flip:'', flipName:'', flipT:0, flipDur:.4, flipN:1, grab:0, manual:false, bal:0, balT:0,
    grind:false, gx:0, gz:-1, gs:0, gsp:0, gT:0, gName:'', gSide:false, gCool:0,
    bail:0, bailYaw:0, boardOff:0, boardV:0, landT:0, trickBuf:0, lastLook:-1e9, pitch:0, safeT:0, lastPos:V(1e9,0,0),
    mvG:false, mvWas:false, mvPreVy:0};

  // ================= trick score: names, base points × number of tricks; a combo banks when you roll clean for a moment =================
  const C = {names:[], base:0, mult:0, total:0, best:0, dirty:true, flash:0, flashTop:'', flashPts:'', flashCls:''};
  try { C.best = +localStorage.getItem('hgc-run-best-combo') || 0; } catch (e) {}
  function trick(name, pts){ C.names.push(name); if (C.names.length > 8) C.names.shift(); C.base += pts; C.mult++; C.dirty = true; C.flash = 0; R.landT = 0; }
  function clearCombo(){ C.names.length = 0; C.base = 0; C.mult = 0; C.dirty = true; }
  function bank(){
    if (!C.mult) return; const pts = Math.round(C.base)*C.mult; C.total += pts;
    if (pts > C.best){ C.best = pts; try { localStorage.setItem('hgc-run-best-combo', pts); } catch (e) {} }
    C.flashTop = C.mult > 1 ? C.names.slice(-3).join(' + ') : C.names[0]; C.flashPts = '+' + pts + (pts === C.best && C.mult > 1 ? ' · best' : ''); C.flashCls = 'bank'; C.flash = 1.6; clearCombo();
  }
  function comboFail(why){ C.flashTop = why || ''; C.flashPts = C.mult ? 'BAIL · ' + Math.round(C.base)*C.mult + ' lost' : 'BAIL'; C.flashCls = 'bail'; C.flash = 1.6; clearCombo(); }

  // ================= grind edges, found in the colliders =================
  // A shapecast over the triangles in a small box under the board collects near-level edges close to it (best four kept, no allocation);
  // a candidate is accepted when the ground drops away on at least one side of it and nothing hangs over it.
  const Q = V(), qBox = new THREE.Box3(), CAND = [0,1,2,3].map(() => ({qx:0, qy:0, qz:0, dx:0, dz:0, s:0, score:0}));
  let nC = 0, curOwn, reach = .5, vLo = -.15, vHi = .45, fdx = 0, fdz = 0, dirMin = 0;
  function edge(a, b){
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, h2 = dx*dx + dz*dz;
    if (h2 < .09 || dy*dy > h2*.36) return;                                                     // shorter than 30 cm, or steeper than ~31°
    const hl = Math.sqrt(h2); if (dirMin > 0 && Math.abs(dx*fdx + dz*fdz)/hl < dirMin) return;
    const t = clamp(((Q.x - a.x)*dx + (Q.z - a.z)*dz)/h2, 0, 1), qx = a.x + dx*t, qy = a.y + dy*t, qz = a.z + dz*t;
    const hd = Math.hypot(qx - Q.x, qz - Q.z); if (hd > reach) return;
    const vd = Q.y - qy; if (vd < vLo || vd > vHi) return;
    if (curOwn !== undefined && !G.visibleAt(curOwn, qx, qz)) return;
    const score = hd + Math.abs(vd)*.6; let i;
    if (nC < 4) i = nC++; else { if (score >= CAND[3].score) return; i = 3; }
    const e = CAND[i]; e.qx = qx; e.qy = qy; e.qz = qz; e.dx = dx/hl; e.dz = dz/hl; e.s = dy/hl; e.score = score;
    while (i > 0 && CAND[i-1].score > CAND[i].score){ const t2 = CAND[i]; CAND[i] = CAND[i-1]; CAND[i-1] = t2; i--; }
  }
  const SC_CB = {intersectsBounds: b => b.intersectsBox(qBox), intersectsTriangle: tri => { edge(tri.a, tri.b); edge(tri.b, tri.c); edge(tri.c, tri.a); }};
  function findEdges(x, y, z, r, lo, hi, dx, dz, dmin){
    Q.set(x, y, z); reach = r; vLo = lo; vHi = hi; fdx = dx; fdz = dz; dirMin = dmin; nC = 0;
    qBox.min.set(x - r, y - hi - .05, z - r); qBox.max.set(x + r, y - lo + .05, z + r);
    for (const c of G.colliders){ if (!c.box.intersectsBox(qBox)) continue; curOwn = c.own; c.bvh.shapecast(SC_CB); }
    return nC;
  }
  const o1 = V(), d1 = V(), hit = {point:V(), normal:V(), distance:0};
  function groundBelow(x, y, z, far){ o1.set(x, y, z); return G.cast(o1, DOWN, far, hit) && hit.normal.y > .55 ? hit.point.y : -1e9; }
  function convex(e){   // 1 / -1: the drop is on one side (a ledge or kerb), 2: on both (a rail or a narrow wall top), 0: not a top edge
    const px = -e.dz, pz = e.dx, top = e.qy + .3;
    const hA = groundBelow(e.qx + px*.13, top, e.qz + pz*.13, .9), hB = groundBelow(e.qx - px*.13, top, e.qz - pz*.13, .9);
    const lowA = hA < e.qy - .05, lowB = hB < e.qy - .05;
    if (!lowA && !lowB) return 0;                                                               // a seam in a flat floor, or the foot of a wall
    if ((!lowA && hA > e.qy + .06) || (!lowB && hB > e.qy + .06)) return 0;                     // something rises beside it
    o1.set(e.qx, e.qy + .15, e.qz); if (G.cast(o1, UP, 1.3, hit)) return 0;                     // no room to ride along it
    return lowA && lowB ? 2 : lowB ? 1 : -1;
  }
  function tryGrind(){
    const hv = Math.hypot(P.vel.x, P.vel.z); if (hv < 1.2) return false;
    const n = findEdges(P.pos.x, P.pos.y, P.pos.z, .5, -.12 + Math.min(0, P.vel.y*.018), .45, 0, 0, 0);
    for (let i = 0; i < n; i++){ const e = CAND[i]; if (convex(e)){ startGrind(e); return true; } }
    return false;
  }
  function startGrind(e){
    let dx = e.dx, dz = e.dz, s = e.s; if (dx*P.vel.x + dz*P.vel.z < 0){ dx = -dx; dz = -dz; s = -s; }
    if (R.flip && R.flipT < .75){ bail('Caught the rail mid-flip'); return; }
    const hv = Math.hypot(P.vel.x, P.vel.z), along = dx*P.vel.x + dz*P.vel.z, f = R.inF, sk = R.mode === 'skate';
    let rel = Math.abs(ad(R.yaw, yawOf(dx, dz))); if (rel > PI/2) rel = PI - rel;               // how the board meets the edge (it is the same either way round)
    R.gSide = sk && rel > .95;
    R.gName = sk ? (R.gSide ? 'BOARDSLIDE' : f > .4 ? 'NOSEGRIND' : f < -.4 ? '5-0 GRIND' : rel > .45 ? 'SMITH GRIND' : '50-50 GRIND')
                 : (f > .4 ? 'NOSE GRIND' : f < -.4 ? 'ICEPICK' : rel > .6 ? 'SMITH GRIND' : 'FEEBLE GRIND');
    finishAir();
    R.grind = true; R.gx = dx; R.gz = dz; R.gs = s; R.gsp = clamp(R.gSide ? hv*.85 : Math.max(along, hv*.6), 3.2, R.K.maxV); R.gT = 0;
    R.bal = (Math.random() - .5)*.3; R.balT = 0; R.manual = false; R.popped = false; R.air = 0;
    P.pos.set(e.qx, e.qy, e.qz); R.yaw = yawOf(dx, dz); P.vel.set(dx*R.gsp, s*R.gsp, dz*R.gsp); P.ground = false;
    trick(R.gName, 100);
  }
  function endGrind(){ R.grind = false; R.gCool = .22; R.landT = 0; R.air = 0; R.popped = false; }
  function stepGrind(dt, f, s){
    const K = R.K; R.gT += dt;
    R.gsp += (-GRAV*R.gs/Math.sqrt(1 + R.gs*R.gs)*.85 - (R.gSide ? 1.2 : .55))*dt;             // a sloping rail speeds you up going down
    if (R.gsp < 1){ endGrind(); return; }
    if (balance(dt, s)){ bail(R.bal > 0 ? 'Slipped off the edge' : 'Lost the balance'); return; }
    C.base += K.grindPts*dt;
    if (P.jumpBuf > 0){ P.jumpBuf = 0; endGrind(); P.vel.set(R.gx*R.gsp, K.pop*.92, R.gz*R.gsp); R.popped = true; return; }   // ollie out
    const st = R.gsp*dt, px = P.pos.x + R.gx*st, py = P.pos.y + R.gs*st, pz = P.pos.z + R.gz*st;
    o1.set(P.pos.x, P.pos.y + .55, P.pos.z); d1.set(R.gx, 0, R.gz);
    if (G.cast(o1, d1, st + RAD, hit) && Math.abs(hit.normal.y) < .5){ const sp = R.gsp; endGrind(); P.vel.set(-R.gx*1.2, 0, -R.gz*1.2); if (sp > 8) bail('Grinded into a wall'); return; }
    const n = findEdges(px, py, pz, .28, -.25, .25, R.gx, R.gz, .72), e = CAND[0];
    if (!n || (e.qx - P.pos.x)*R.gx + (e.qz - P.pos.z)*R.gz < st*.3){                            // off the end of it: fly on
      P.pos.set(px, py, pz); P.vel.set(R.gx*R.gsp, Math.max(0, R.gs*R.gsp), R.gz*R.gsp); endGrind(); return; }
    let dx = e.dx, dz = e.dz, sl = e.s; if (dx*R.gx + dz*R.gz < 0){ dx = -dx; dz = -dz; sl = -sl; }
    R.gx += (dx - R.gx)*.5; R.gz += (dz - R.gz)*.5; const l = Math.hypot(R.gx, R.gz); R.gx /= l; R.gz /= l; R.gs += (sl - R.gs)*.5;   // follows curves and kinks
    P.pos.set(e.qx, e.qy, e.qz); P.vel.set(R.gx*R.gsp, R.gs*R.gsp, R.gz*R.gsp); R.yaw = yawOf(R.gx, R.gz); P.ground = false;
  }
  // balance on a grind or a manual: the needle runs away from the middle faster the longer you hold it; push back against it
  function balance(dt, input){
    R.balT += dt; const a = R.K.drift*(1 + R.balT*.18);
    R.bal += ((R.bal*1.1 + (R.bal < 0 ? -.18 : .18))*a + (Math.random() - .5)*.8*a + input*2.4)*dt;
    return Math.abs(R.bal) > 1;
  }

  // ================= rolling, the air, landing, bailing =================
  function move(dt, stick){
    const vel = P.vel, n = clamp(Math.ceil(vel.length()*dt/.14), 1, 8), sdt = dt/n, x0 = P.pos.x, z0 = P.pos.z, preH = Math.hypot(vel.x, vel.z);
    const hx = preH > 1e-4 ? vel.x/preH : 0, hz = preH > 1e-4 ? vel.z/preH : 0;
    R.mvWas = P.ground; R.mvPreVy = vel.y; let grounded = false, bumped = false;
    if (R.mvWas && stick && preH > .8){   // a kerb just ahead, low enough to roll up: hop the wheels onto it before the capsule hits its edge
      const ah = RAD + .14 + preH*dt; o1.set(P.pos.x + hx*ah, P.pos.y + .32, P.pos.z + hz*ah);
      if (G.cast(o1, DOWN, .3, hit) && hit.normal.y > .7){ const up = hit.point.y - P.pos.y;
        if (up > .03 && up < .25){ P.lift += P.pos.y - hit.point.y - .03; P.pos.y = hit.point.y + .03; vel.x *= .94; vel.z *= .94; vel.y = 0; bumped = true; } } }
    for (let i = 0; i < n; i++){ P.pos.addScaledVector(vel, sdt); grounded = G.collide(); }
    if (bumped && !grounded){ grounded = true; vel.y = 0; }                                       // still above the kerb's lip: hold the height for this frame
    else if (!grounded && R.mvWas && stick && vel.y <= .5){                                          // stay on the ground over small drops and down slopes
      let y = groundBelow(P.pos.x, P.pos.y + .3, P.pos.z, .55), ny = hit.normal.y;
      const yf = groundBelow(P.pos.x + hx*(RAD + .16), P.pos.y + .3, P.pos.z + hz*(RAD + .16), .55);        // the front wheels may still be on the kerb top
      if (yf > y && yf < P.pos.y + .05 && hit.normal.y > .62){ y = yf + .02; ny = hit.normal.y; }   // (a hair above, clear of the kerb's lip)
      if (y > -1e8 && ny > .62){ P.lift += P.pos.y - y; P.pos.y = y; vel.y = 0; grounded = true; } }
    if (!bumped && grounded && stick && preH > .8 && Math.hypot(P.pos.x - x0, P.pos.z - z0) < preH*dt*.6){  // blocked: a kerb low enough to roll up?
      o1.set(P.pos.x + hx*(RAD + .18), P.pos.y + .32, P.pos.z + hz*(RAD + .18));
      if (G.cast(o1, DOWN, .3, hit) && hit.normal.y > .7){ const up = hit.point.y - P.pos.y;
        if (up > .03 && up < .25){ P.lift += P.pos.y - hit.point.y; P.pos.y = hit.point.y + .01; P.pos.x += hx*.12; P.pos.z += hz*.12; vel.x = hx*preH*.88; vel.z = hz*preH*.88; bumped = true; } } }
    if (!bumped && preH > 8 && Math.hypot(vel.x, vel.z) < preH*.35) bail('Slammed into a wall');
    R.mvG = grounded;
  }
  function ollie(){ P.jumpBuf = 0; P.vel.y = R.K.pop*(R.manual ? 1.05 : 1); P.ground = false; R.popped = true; R.air = 0; R.coyote = 0; R.manual = false; R.spin = 0; R.landT = 0; }
  function stepRoll(dt, f, s, low){
    const K = R.K, vel = P.vel; let jumped = false;
    R.steer += (s - R.steer)*Math.min(1, dt*10); R.push = R.brake = false;
    if (P.ground){
      let hx = -Math.sin(R.yaw), hz = -Math.cos(R.yaw), sp = vel.x*hx + vel.z*hz;
      const lx0 = vel.x - hx*sp, lz0 = vel.z - hz*sp, a = Math.abs(sp), rate = a < .4 ? K.turn*.7 : K.turn + (K.turnHi - K.turn)*Math.min(1, a/14);
      R.yaw -= R.steer*rate*dt*(R.manual ? .75 : 1); hx = -Math.sin(R.yaw); hz = -Math.cos(R.yaw);   // carve: the speed turns with the board
      if (f > .15 && !R.manual){
        if (sp < K.top){ const ph = R.pushT % 1; R.push = true; if (ph < K.on) sp += K.push/K.on*f*dt*(1 - Math.max(0, sp)/K.top*.5); R.pushT += dt/K.cycle; } else R.pushT = 0; }
      else { R.pushT = 0; if (f < -.15 && !R.manual && a > .05){ R.brake = true; sp -= Math.sign(sp)*Math.min(a, K.brake*-f*dt); } }
      sp -= Math.sign(sp)*Math.min(Math.abs(sp), (.2 + .009*sp*sp)*dt);                         // rolling resistance and air
      if (P.gN.y < .995) sp += GRAV*(P.gN.x*hx + P.gN.z*hz)*P.gN.y*dt;                         // gravity rolls the board down a slope
      if (sp < -.5){ R.yaw += PI; R.fakie = !R.fakie; sp = -sp; hx = -hx; hz = -hz; }           // rolling backwards: now riding switch
      sp = Math.min(sp, K.maxV); const g = Math.exp(-dt*K.grip);
      vel.x = hx*sp + lx0*g; vel.z = hz*sp + lz0*g;                                             // the wheels only roll one way: sideways speed dies off
      if (low && Math.abs(sp) > 1.2){ if (!R.manual){ R.manual = true; R.bal = (Math.random() - .5)*.3; R.balT = 0; trick('MANUAL', 50); } }
      else R.manual = false;
      if (R.manual){ C.base += 40*dt; R.landT = 0; if (balance(dt, -f)){ bail(R.bal > 0 ? 'Fell off the back' : 'Nose dived'); return; } }
      else if (C.mult){ R.landT += dt; if (R.landT > .45) bank(); }
      if (P.jumpBuf > 0){ ollie(); jumped = true; }
    } else {
      if (P.jumpBuf > 0 && R.coyote > 0){ ollie(); jumped = true; }
      R.spinV += (-s*K.spin - R.spinV)*Math.min(1, dt*9); R.yaw += R.spinV*dt; R.spin += R.spinV*dt;   // A / D spin the board in the air
      if (R.trickBuf > 0 && R.air > .04){ R.trickBuf = 0; startFlip(f); }
      if (R.flip){ R.flipT += dt/R.flipDur; if (R.flipT >= 1) R.flip = ''; }
      if (low && !R.flip && R.air > .1) R.grab += dt; else if (R.grab > 0 && !low){ if (R.grab > .2) trick(K.grab, Math.round(100 + R.grab*160)); R.grab = 0; }
      R.landT = 0;
    }
    vel.y -= GRAV*dt;
    if (!P.ground && !jumped && vel.y < .5 && R.gCool <= 0 && (R.popped || R.air > .25) && tryGrind()) return;
    move(dt, !jumped);
    if (R.bail > 0) return;
    if (R.mvG && !R.mvWas) land(R.mvPreVy);
    if (R.bail > 0) return;
    if (R.mvG){ R.air = 0; R.coyote = .1; } else { R.air += dt; R.coyote -= dt; }
    P.ground = R.mvG;
  }
  function startFlip(f){
    if (R.flip){   // a second press while the first is still turning: double it
      if (R.flipN === 1 && R.flipT < .6){ R.flipT *= .5; R.flipDur *= 2; R.flipN = 2; const i = C.names.lastIndexOf(R.flipName); if (i >= 0) C.names[i] = 'DOUBLE ' + R.flipName; C.base += 150; C.dirty = true; }
      return; }
    if (R.grab > .12) return;
    const heel = keys.ShiftLeft || keys.ShiftRight || G.joy.y < -.6;   // W is still held from pushing, so heelflip is Shift + F (on a phone: stick up)
    const k = R.mode === 'skate' ? (f < -.3 ? 'shove' : heel ? 'heel' : 'kick') : (f < -.3 ? 'bar' : 'whip');
    R.flip = k; R.flipT = 0; R.flipN = 1; R.flipDur = k === 'shove' ? .36 : k === 'whip' ? .48 : k === 'bar' ? .42 : .4;
    R.flipName = {kick:'KICKFLIP', heel:'HEELFLIP', shove:'POP SHOVE-IT', whip:'TAILWHIP', bar:'BARSPIN'}[k];
    trick(R.flipName, k === 'shove' ? 80 : k === 'whip' ? 150 : k === 'bar' ? 120 : 100);
  }
  function finishAir(){   // what the air was worth, counted as you touch down (or lock onto a rail)
    const n = Math.floor((Math.abs(R.spin) + .55)/PI);
    if (n > 0) trick((R.spin > 0 ? 'FS ' : 'BS ') + n*180, [0, 100, 250, 450, 700, 1000][Math.min(5, n)]);
    if (R.grab > .2) trick(R.K.grab, Math.round(100 + R.grab*160));
    if (R.air > 1) trick('BIG AIR', Math.round(R.air*90));
    R.spin = R.spinV = R.grab = 0; R.flip = '';
  }
  function land(preVy){
    const hv = Math.hypot(P.vel.x, P.vel.z), ty = yawOf(P.vel.x, P.vel.z);
    if (R.flip && R.flipT < .78) return bail('Caught the board late');
    if (-preVy > 17.5) return bail('Too big a drop');
    if (hv > 1.5){ const d = Math.abs(ad(R.yaw, ty));
      if (d < .8) R.yaw = ty; else if (d > PI - .8){ R.yaw = ty; R.fakie = !R.fakie; } else return bail('Landed sideways'); }
    finishAir(); R.popped = false; R.landT = 0; if (-preVy > 9) P.dip = .45;
  }
  function bail(why){
    if (R.bail > 0) return; comboFail(why);
    const hv = Math.hypot(P.vel.x, P.vel.z); R.bailYaw = hv > .5 ? yawOf(P.vel.x, P.vel.z) : R.yaw; R.boardV = hv*.9; R.boardOff = 0;
    R.bail = 1.4; R.grind = R.manual = false; R.flip = ''; R.grab = R.spin = R.spinV = 0; P.dip = 1;
  }
  function stepBail(dt){
    R.bail -= dt; const k = Math.exp(-dt*2.4); P.vel.x *= k; P.vel.z *= k; P.vel.y -= GRAV*dt; move(dt, true); P.ground = R.mvG;
    R.boardOff += R.boardV*dt; R.boardV *= Math.exp(-dt*1.6);
    if (R.bail <= 0){ R.bail = 0; R.boardOff = 0; R.fakie = false; R.yaw = R.bailYaw; P.vel.x = P.vel.z = 0; }   // back on the board
  }
  function resetMotion(){
    R.grind = R.manual = R.popped = false; R.flip = ''; R.bail = R.spin = R.spinV = R.grab = R.air = R.boardOff = R.pushT = 0; R.gCool = .3; clearCombo();
  }

  // ================= the frame (called by game.js while riding) =================
  function step(dt, now){
    if (!R.K) return;
    if (R.lastPos.distanceToSquared(P.pos) > 16) resetMotion();                                 // teleported or respawned
    P.h = RIDE_H; P.climb = P.wr = null; P.slide = P.low = false; P.djT = 9;
    const jx = Math.abs(G.joy.x) > .15 ? G.joy.x : 0, jy = Math.abs(G.joy.y) > .15 ? G.joy.y : 0;
    const f = clamp((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - jy, -1, 1);
    const s = clamp((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + jx, -1, 1), low = !!keys.KeyC || G.touch.low;
    R.inF = f; R.trickBuf -= dt; R.gCool -= dt; if (C.flash > 0) C.flash -= dt;
    if (R.bail > 0) stepBail(dt); else if (R.grind) stepGrind(dt, f, s); else stepRoll(dt, f, s, low);
    R.pushB += ((R.push ? 1 : 0) - R.pushB)*Math.min(1, dt*8);
    if (!W.inGlobe && P.pos.y < SEA - 1.1){ resetMotion(); comboFail('Splash'); G.respawn('Splash. Back on dry land.'); }
    else if (P.pos.y < -80){ resetMotion(); G.respawn(); }
    if (P.ground && R.bail <= 0){ R.safeT += dt; if (R.safeT > .5){ R.safeT = 0; P.safe.copy(P.pos); } }
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (now - R.lastLook > 900 && hv > 1.5 && R.bail <= 0){                                      // the camera swings round behind the line you ride (until you look yourself)
      const ty = R.grind ? R.yaw : yawOf(P.vel.x, P.vel.z); walk.yaw += ad(ty, walk.yaw)*(1 - Math.exp(-dt*2.2)); }
    visuals(dt);
    R.lastPos.copy(P.pos);
    const K = R.K;
    P.state = R.bail > 0 ? 'BAIL' : R.grind ? R.gName : R.manual ? 'MANUAL' : !P.ground ? (R.flip ? R.flipName : Math.abs(R.spinV) > 3 ? 'SPIN' : R.grab > .12 ? K.grab : 'AIR')
      : R.push ? 'PUSH' : R.brake ? 'BRAKE' : hv > .3 ? (R.fakie ? 'SWITCH' : 'ROLL') : 'READY';
  }

  // ================= the board and the scooter: sketch-style, ink outline on paper like the figures =================
  const INK = new THREE.MeshStandardMaterial({color:0x151515, roughness:.9}), LINE = new THREE.MeshBasicMaterial({color:0x111111, side:THREE.BackSide});
  const PAPER = new THREE.MeshStandardMaterial({color:0xf4efe4, roughness:1}), GOLD = new THREE.MeshStandardMaterial({color:0xe0b057, roughness:.7});
  function part(parent, geo, mat, x, y, z, rx, rz, line){
    const g = new THREE.Group(), m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m);
    if (line){ const l = new THREE.Mesh(geo, LINE); l.scale.set(line[0], line[1], line[2]); g.add(l); }
    g.position.set(x, y, z); g.rotation.set(rx || 0, 0, rz || 0); parent.add(g); return g;
  }
  const nest = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  function rig(rear){   // root (yaw) > pitch about the rear axle > turn (switch stance, shove-its) > the parts
    const root = new THREE.Group(), pitch = nest(root, 0, 0, rear), turn = nest(pitch, 0, 0, -rear);
    root.visible = false; root.userData.noCollide = true; scene.add(root); return {root, pitch, turn};
  }
  const SK = rig(.25); {
    SK.flip = nest(SK.turn, 0, .09, 0); const b = nest(SK.flip, 0, -.09, 0), WL = [1.08, 1.12, 1.25];
    const deck = new THREE.BoxGeometry(.21, .022, .54), kick = new THREE.BoxGeometry(.2, .022, .17);
    part(b, deck, PAPER, 0, .095, 0, 0, 0, [1.06, 1.9, 1.02]);
    part(b, kick, PAPER, 0, .127, -.349, .38, 0, [1.06, 1.9, 1.05]); part(b, kick, PAPER, 0, .127, .349, -.38, 0, [1.06, 1.9, 1.05]);
    part(b, new THREE.BoxGeometry(.19, .006, .52), GOLD, 0, .081, 0);                             // the painted underside, seen in a flip
    const wheel = new THREE.CylinderGeometry(.028, .028, .036, 10), truck = new THREE.BoxGeometry(.17, .028, .05);
    for (const z of [-.24, .24]){ part(b, truck, INK, 0, .058, z); for (const x of [-.088, .088]) part(b, wheel, PAPER, x, .028, z, 0, PI/2, WL); }
  }
  const SCO = rig(.26); {
    SCO.whip = nest(SCO.turn, 0, 0, -.33); const d = nest(SCO.whip, 0, 0, .33), WL = [1.12, 1.1, 1.12];   // the deck turns about the stem in a tailwhip
    part(d, new THREE.BoxGeometry(.12, .035, .5), PAPER, 0, .085, 0, 0, 0, [1.1, 1.5, 1.03]);
    part(d, new THREE.BoxGeometry(.1, .005, .42), INK, 0, .105, .01);                             // grip tape
    part(d, new THREE.BoxGeometry(.06, .012, .1), GOLD, 0, .108, .27, -.15);                      // the rear brake
    part(d, new THREE.BoxGeometry(.06, .05, .08), INK, 0, .09, -.28);
    const wheel = new THREE.CylinderGeometry(.05, .05, .028, 14);
    part(d, wheel, PAPER, 0, .05, .27, 0, PI/2, WL);
    part(SCO.turn, wheel, PAPER, 0, .05, -.33, 0, PI/2, WL);
    part(SCO.turn, new THREE.CylinderGeometry(.016, .016, .9, 8), INK, 0, .5, -.33);
    SCO.bar = nest(SCO.turn, 0, .95, -.33);                                                       // the bars turn about the stem in a barspin
    part(SCO.bar, new THREE.CylinderGeometry(.014, .014, .52, 8), INK, 0, 0, 0, 0, PI/2);
    const grip = new THREE.CylinderGeometry(.021, .021, .1, 8); part(SCO.bar, grip, GOLD, -.22, 0, 0, 0, PI/2, WL); part(SCO.bar, grip, GOLD, .22, 0, 0, 0, PI/2, WL);
  }

  // the rider's pose, read by figures.js (joint angles in the rig's own terms: hips/shoulders + swing forward, knees - bend, spine + leans back)
  const pose = {lift:0, face:0, hipL:0, hipR:0, kneeL:0, kneeR:0, shL:0, shR:0, elL:0, elR:0, hipZL:0, hipZR:0, shZL:-.12, shZR:.12, lean:0, roll:0, hipsY:.95, flipX:0, neckY:0};
  function legs(hl, hr, kl, kr){ pose.hipL = hl; pose.hipR = hr; pose.kneeL = kl; pose.kneeR = kr; }
  function arms(sl, sr, el, er, zl, zr){ pose.shL = sl; pose.shR = sr; pose.elL = el; pose.elR = er; pose.shZL = zl; pose.shZR = zr; }
  const ease = t => 1 - (1 - t)*(1 - t);
  function visuals(dt){
    const K = R.K, sk = R.mode === 'skate', B = sk ? SK : SCO, p = pose, hv = Math.hypot(P.vel.x, P.vel.z), lean = R.steer*Math.min(1, hv/5), air = !P.ground && !R.grind;
    SK.root.visible = sk; SCO.root.visible = !sk;
    // ---- the board ----
    const hx = -Math.sin(R.yaw), hz = -Math.cos(R.yaw);
    let pitch = 0; if (R.manual) pitch = .26 + R.bal*.1; else if (R.grind) pitch = Math.atan(R.gs); else if (P.ground) pitch = -Math.atan2(P.gN.x*hx + P.gN.z*hz, P.gN.y);
    R.pitch += (pitch - R.pitch)*(1 - Math.exp(-dt*14));
    B.root.position.copy(P.pos); B.root.rotation.set(0, R.yaw + (R.grind && R.gSide ? PI/2 : 0), 0); B.pitch.rotation.x = R.pitch;
    const fe = R.flip ? ease(Math.min(1, R.flipT)) : 0, tuck = air ? (R.grab > .12 ? .22 : R.flip ? .16 + Math.sin(PI*R.flipT)*.08 : .1) : 0;
    B.root.position.y += tuck;
    B.turn.rotation.y = (R.fakie ? PI : 0) + (R.flip === 'shove' ? PI*R.flipN*fe : 0);
    if (sk) SK.flip.rotation.z = R.flip === 'kick' ? PI*2*R.flipN*fe : R.flip === 'heel' ? -PI*2*R.flipN*fe : R.bail > 0 ? Math.min(PI, (1.4 - R.bail)*7) : 0;
    else { SCO.whip.rotation.y = R.flip === 'whip' ? PI*2*R.flipN*fe : 0; SCO.bar.rotation.y = R.flip === 'bar' ? PI*2*R.flipN*fe : 0;
      SCO.turn.rotation.z = R.bail > 0 ? Math.min(1.5, (1.4 - R.bail)*6) : -lean*.12*(P.ground ? 1 : 0); }
    if (R.bail > 0){ B.root.position.x += -Math.sin(R.bailYaw)*R.boardOff; B.root.position.z += -Math.cos(R.bailYaw)*R.boardOff; B.root.position.y = P.pos.y; }
    // ---- the rider ----
    const yaw = R.yaw + (R.fakie ? PI : 0);
    p.lift = K.deck + tuck + (R.manual ? .03 : 0); p.flipX = 0; p.roll = 0; p.neckY = 0; p.hipZL = p.hipZR = 0;
    if (R.bail > 0){
      const t = 1.4 - R.bail; p.face = R.bailYaw; p.lift = 0; p.flipX = R.bail > .35 ? -Math.min(1.45, t*4) : 0; p.hipsY = R.bail > .35 ? .45 : .8; p.lean = 0;
      legs(.5, .3, -.4, -.2); arms(2.6, 2.4, .2, .2, -.3, .3);
    } else if (sk){   // side-on, left foot at the nose (regular)
      p.face = R.grind && R.gSide ? R.yaw : yaw - PI/2; p.neckY = R.grind && R.gSide ? 0 : R.fakie ? -1.1 : 1.1;
      legs(.35, .35, -.6, -.6); p.hipZL = -.22; p.hipZR = .22; arms(.15, .15, .35, .35, -.5, .5); p.lean = -.12 - lean*.28; p.hipsY = .9;
      if (R.grind){ legs(.55, .55, -1, -1); arms(.2, .2, .3, .3, -1.25, 1.25); p.hipsY = .84; if (R.gSide) p.roll = R.bal*.35; else p.lean = -.15 + R.bal*.35; }
      else if (R.manual){ legs(.15, .6, -.35, -1.1); arms(.7, -.2, .4, .3, -.6, .6); p.lean = .22 + R.bal*.25; p.hipsY = .88; }
      else if (air){ const t = R.flip ? Math.sin(PI*R.flipT) : 0;
        legs(.95 + t*.3, .95 + t*.3, -1.5 - t*.4, -1.5 - t*.4); arms(.3, .3, .5, .5, -.95, .95); p.hipsY = 1; p.lean = -.2;
        if (R.grab > .12){ legs(1.35, 1.35, -2.1, -2.1); arms(.3, 1.2, .4, .1, -.9, .25); p.lean = -.5; } }
      else if (R.push){ const ph = R.pushT % 1, on = K.on;
        if (ph < on){ p.hipZR = -.1 + ph/on*.75; p.kneeR = -.12; } else { const u = (ph - on)/(1 - on); p.hipZR = .65 - u*.75; p.kneeR = -.2 - Math.sin(PI*u)*.9; }
        p.hipR = .45; p.hipL = .45; p.kneeL = -.8; p.hipZL = -.15; }
      p.face += .45*R.pushB;                                                                      // turn the chest toward the road while pushing
    } else {   // scooter: facing the bars
      p.face = yaw; legs(.12, -.18, -.25, -.3); p.hipZL = -.06; p.hipZR = .06; arms(.95, .95, .45, .45, -.18, .18); p.lean = -.22; p.hipsY = .93; p.roll = -lean*.22;
      if (R.grind){ legs(.45, .4, -.85, -.8); p.hipsY = .86; p.roll = R.bal*.35; }
      else if (R.manual){ legs(.3, .45, -.5, -.9); arms(.7, .7, .35, .35, -.18, .18); p.lean = .3 + R.bal*.25; }
      else if (air){ const w = R.flip === 'whip' ? Math.sin(PI*R.flipT) : 0; legs(.75 + w*.45, .6 + w*.6, -1.3 - w*.6, -1.2 - w*.7); p.hipsY = 1 + w*.08;
        if (R.flip === 'bar' && R.flipT > .15 && R.flipT < .85) arms(1.4, 1.4, .1, .1, -.7, .7); }
      else if (R.push){ const ph = R.pushT % 1, on = K.on;
        if (ph < on){ p.hipR = .45 - ph/on*1.05; p.kneeR = -.12; } else { const u = (ph - on)/(1 - on); p.hipR = -.6 + u*1.05; p.kneeR = -.15 - Math.sin(PI*u)*1.1; }
        p.hipL = .2; p.kneeL = -.45; }
    }
    P.rideLift = R.bail > 0 ? 0 : K.deck; P.rideRoll = sk ? -lean*.04 : -lean*.07;
  }

  // ================= switching, input, HUD =================
  function setRide(m, say){
    if (!ORDER.includes(m)) m = 'foot';
    if (R.K && C.mult) bank();
    const was = P.ride; R.mode = m; R.K = KIT[m] || null; const on = !!R.K;
    if (on && !was){ const hv = Math.hypot(P.vel.x, P.vel.z); R.yaw = hv > 1 ? yawOf(P.vel.x, P.vel.z) : walk.yaw; }
    P.ride = on; resetMotion(); R.fakie = false; R.lastPos.copy(P.pos);
    if (on){ P.climb = P.wr = null; P.slide = P.low = false; P.h = RIDE_H; P.djT = 9; P.rideLift = R.K.deck; }
    else { P.h = G.H_STAND; P.rideLift = 0; P.rideRoll = 0; SK.root.visible = SCO.root.visible = false; }
    try { localStorage.setItem(KEY, m); } catch (e) {}
    const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
    set('mRide', 'Ride: ' + NAME[m]); set('gmRide', m === 'foot' ? 'Foot' : m === 'skate' ? 'Board' : 'Scoot');
    set('gmJump', m === 'foot' ? 'Jump' : m === 'skate' ? 'Ollie' : 'Hop'); set('gmLow', on ? 'Manual' : 'Slide');
    if ($('gmTrick')) $('gmTrick').hidden = !on; $('gmCombo').hidden = !on;
    if (say && matchMedia('(pointer:coarse)').matches) G.toast(NAME[m] + (on ? ' · stick: push, carve · Trick' : ''));
    else if (say) G.toast(NAME[m] + (on ? ' · W push · A D carve · Space ' + (m === 'skate' ? 'ollie' : 'hop') + ' · F trick · C manual' : ''));
  }
  const cycle = () => setRide(ORDER[(ORDER.indexOf(R.mode) + 1) % ORDER.length], true);

  addEventListener('keydown', e => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyB' && !e.repeat){ cycle(); return; }
    if (e.code === 'KeyF' && !e.repeat && P.ride) R.trickBuf = .2;
  });
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas && (e.movementX || e.movementY)) R.lastLook = performance.now(); });
  canvas.addEventListener('pointermove', e => { if (e.buttons) R.lastLook = performance.now(); });

  document.head.insertAdjacentHTML('beforeend', `<style>
    #gmCombo{left:50%;top:44px;transform:translateX(-50%);text-align:center;min-width:190px;max-width:84vw;display:none}
    body[data-mode=walk] #gmCombo{display:block}
    #gmCN{font-size:12px;letter-spacing:.12em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:15px}
    #gmCS{display:block;font:400 19px "Share Tech Mono",monospace;color:#e0b057;letter-spacing:0}
    #gmCombo.bank #gmCS{color:#4fe3f2} #gmCombo.bail #gmCS{color:#ff3d7f} #gmCombo.idle #gmCS{font-size:12px;color:#a4a6ad}
    #gmBal{position:relative;height:5px;width:150px;margin:6px auto 1px;background:rgba(255,255,255,.2);display:none}
    #gmBal.on{display:block} #gmBal.v{transform:rotate(-90deg);margin:62px auto 60px}
    #gmBal i{position:absolute;top:-5px;left:50%;width:3px;height:15px;margin-left:-1px;background:#ff3d7f}
    #gmTrick{right:204px;bottom:118px;border-color:#4fe3f2!important}#gmRide{right:26px;bottom:282px}
    @media (max-width:980px){#gmCombo{bottom:auto;top:128px;min-width:150px}}
  </style>`);
  $('gm').insertAdjacentHTML('beforeend', '<div id="gmCombo" class="pn idle" hidden><div id="gmCN"></div><b id="gmCS"></b><div id="gmBal"><i></i></div></div>');
  const tz = $('gmTouch'); if (tz) tz.insertAdjacentHTML('beforeend', '<button id="gmRide" type="button">Foot</button><button id="gmTrick" type="button" hidden>Trick</button>');
  $('gmRide')?.addEventListener('click', cycle);
  $('gmTrick')?.addEventListener('pointerdown', e => { e.preventDefault(); R.trickBuf = .2; });
  const modes = $('modes'); if (modes){ const b = document.createElement('button'); b.type = 'button'; b.id = 'mRide'; b.textContent = 'Ride: On foot'; b.onclick = cycle; modes.insertBefore(b, $('hint')); }
  const help = document.querySelector('#gmHelp dl'); if (help) help.insertAdjacentHTML('beforeend',
    '<dt>B</dt><dd>On foot · skateboard · scooter.</dd><dt>On wheels</dt><dd>W push, S brake, A D carve. Space ollies (hop on the scooter). In the air: A D spin, F flip trick (Shift + F heelflip, S + F shove-it, F again for a double; scooter: tailwhip, with S barspin), hold C to grab. Land on a ledge, kerb or rail to grind; A D keep your balance. C on the ground: manual, W S balance.</dd>');

  const cn = $('gmCN'), cs = $('gmCS'), box = $('gmCombo'), bal = $('gmBal'), needle = bal.firstElementChild; let tick = 0, lastCls = '', lastTop = null, lastPts = null;
  W.frameHooks.push(() => {
    const show = W.mode === 'walk' && P.ride; if (!show){ SK.root.visible = SCO.root.visible = false; return; }
    if (tick++ % 3) return;
    let top, pts, cls;
    if (C.mult){ cls = ''; top = (C.names.length > 4 ? '… + ' : '') + C.names.slice(-4).join(' + '); pts = Math.round(C.base) + ' × ' + C.mult; }
    else if (C.flash > 0){ cls = C.flashCls; top = C.flashTop; pts = C.flashPts; }
    else { cls = 'idle'; top = NAME[R.mode]; pts = 'score ' + C.total + ' · best combo ' + C.best; }
    if (cls !== lastCls){ box.className = 'pn ' + cls; lastCls = cls; }
    if (top !== lastTop){ cn.textContent = top; lastTop = top; } if (pts !== lastPts){ cs.textContent = pts; lastPts = pts; }
    const b = R.grind || R.manual; bal.classList.toggle('on', b); bal.classList.toggle('v', R.manual);
    if (b) needle.style.left = (50 + clamp(R.bal, -1, 1)*50) + '%';
  });

  W.ride = {step, pose, set:setRide, cycle, R, C, get on(){ return P.ride && W.mode === 'walk'; }, get mode(){ return R.mode; }};
  let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  setRide(saved || 'foot', false);
}
