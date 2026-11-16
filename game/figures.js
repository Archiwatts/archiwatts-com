// Hidden Gems City: The Run. The third-person body: a hand-sketched 2D scale figure, in the manner of architectural entourage
// (black marker outline, loose coloured hatching, a hatched shadow cast away from the sun). Five figures to choose from.
// Each figure is drawn once on a canvas atlas (stand, walk cycle, run cycle, air, slide, climb); every frame is redrawn
// with fresh jitter, so the lines "boil" like a hand drawing as it moves. The sheet always turns to face the camera.
export function init(W){
  const {THREE, scene, camera} = W, $ = id => document.getElementById(id), P = W.game.P;
  const FW = 256, FH = 512, FRAMES = 19, ACOLS = 10, AROWS = 2;   // 0 stand · 1-4 walk · 5-8 run · 9 air · 10 slide · 11 climb · on wheels: 12 ride · 13 air · 14 grind · 15 manual · 16 scooter · 17 push · 18 bail
  const SKETCH = true;   // the player is the flat 2D sketch sheet; false brings back the 3D jointed rig
  const FIGS = [
    // every figure stands 5'6" (1.676 m) head to toe: s scales the 2D sketch, rs the 3D rig (measured, so hats and hoods are included)
    {key:'commuter', name:'The Commuter', col:'#2f6fe0', body:'coat',  head:'box',   s:.927, rs:.898},
    {key:'tourist',  name:'The Tourist',  col:'#e0892f', body:'hour',  head:'cone',  s:.876, rs:.801},
    {key:'builder',  name:'The Builder',  col:'#2f8a4a', body:'block', head:'box',   s:.925, rs:.889},
    {key:'critic',   name:'The Critic',   col:'#d8344f', body:'dress', head:'brim',  s:.919, rs:.913},
    {key:'dreamer',  name:'The Dreamer',  col:'#b07ad8', body:'tall',  head:'hood',  s:.862, rs:.780}
  ];

  // ---------- drawing ----------
  function rng(seed){ let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), ((s ^= s >>> 16) >>> 0) / 4294967296); }
  function sketch(x, pts, R, w = 5, passes = 2, jit = 3.2){   // a marker line: two loose passes over the same points
    x.strokeStyle = '#141414'; x.lineCap = x.lineJoin = 'round';
    for (let p = 0; p < passes; p++){ x.lineWidth = w*1.4*(p ? .7 : 1); x.beginPath();   // thick enough to survive being seen from a few metres away
      pts.forEach(([px, py], i) => { const jx = px + (R()-.5)*jit, jy = py + (R()-.5)*jit; if (i) x.lineTo(jx, jy); else x.moveTo(jx - (R()-.3)*6, jy - (R()-.3)*6); });
      x.stroke(); }
  }
  function hatch(x, poly, col, R, ang = -1.05, gap = 9){   // coloured diagonal strokes inside a shape, leaving a little paper between them
    x.save(); x.beginPath(); poly.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.clip();
    x.strokeStyle = col; x.lineCap = 'round'; const c = Math.cos(ang), s = Math.sin(ang);
    for (let d = -FH; d < FH; d += gap*(.8 + R()*.5)){ if (R() < .1) continue;
      x.globalAlpha = .55 + R()*.4; x.lineWidth = 6 + R()*5; x.beginPath();
      const ox = 128 + d*-s, oy = 256 + d*c; x.moveTo(ox - c*400 + (R()-.5)*20, oy - s*400); x.lineTo(ox + c*400, oy + s*400 + (R()-.5)*20); x.stroke(); }
    x.restore(); x.globalAlpha = 1;
  }
  const BODY = {   // torso outline (canvas px, 128 = centre) and the height where the legs start
    coat:  {poly:[[73,118],[183,118],[160,300],[96,300]], hip:300},
    hour:  {poly:[[88,122],[168,122],[134,200],[178,292],[78,292],[122,200]], hip:292},
    block: {poly:[[66,116],[190,116],[180,272],[76,272]], hip:272},
    dress: {poly:[[92,122],[164,122],[140,196],[186,306],[70,306],[116,196]], hip:306},
    tall:  {poly:[[90,112],[166,112],[156,330],[100,330]], hip:330}
  };
  function drawHead(x, kind, R, col){
    if (kind === 'box'){ sketch(x, [[112,60],[144,60],[146,104],[110,104],[112,60]], R, 5); sketch(x, [[118,58],[118,38],[140,38],[140,58]], R, 4); sketch(x, [[106,58],[150,58]], R, 4); }
    else if (kind === 'cone'){ x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.moveTo(128,14); x.lineTo(168,82); x.lineTo(88,82); x.fill(); sketch(x, [[90,82],[126,12],[166,82]], R, 5); sketch(x, [[70,84],[186,80]], R, 5); sketch(x, [[116,86],[118,112],[138,112],[140,86]], R, 4); }
    else if (kind === 'brim'){ sketch(x, [[66,74],[110,62],[146,62],[190,74]], R, 5); sketch(x, [[108,64],[112,36],[144,36],[148,64]], R, 5); sketch(x, [[116,76],[118,112],[138,112],[140,76]], R, 4); }
    else { x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.moveTo(128,4); x.quadraticCurveTo(170,70,160,116); x.lineTo(96,116); x.quadraticCurveTo(86,70,128,4); x.fill();
      hatch(x, [[128,4],[160,116],[96,116]], col, R, -.9, 16); sketch(x, [[96,116],[100,60],[128,4],[156,60],[160,116]], R, 5); }
  }
  // legs and arms for a pose: [left foot, right foot] offsets and knee bends; arms swing against the legs
  function pose(f){
    if (f === 0) return {lf:[-14,0], rf:[14,0], lk:0, rk:0, la:.15, ra:-.15};
    if (f >= 1 && f <= 8){ const run = f >= 5, k = (f - (run ? 5 : 1))/4*Math.PI*2, sw = Math.sin(k)*(run ? 62 : 36), lift = run ? 34 : 12;
      return {lf:[-8 + sw, -Math.max(0, Math.cos(k))*lift], rf:[8 - sw, -Math.max(0, -Math.cos(k))*lift], lk:run ? Math.max(0, Math.cos(k))*.9 : 0, rk:run ? Math.max(0, -Math.cos(k))*.9 : 0, la:-sw/70, ra:sw/70}; }
    if (f === 9) return {lf:[-30,-90], rf:[34,-30], lk:1, rk:.5, la:-.9, ra:.8};
    if (f === 10) return {lf:[70,-10], rf:[50,-60], lk:.3, rk:1, la:-1.2, ra:-.4};
    if (f === 12) return {lf:[-46,0], rf:[46,0], lk:.7, rk:.7, la:-1.25, ra:1.25, drop:34};           // side-on on the board, knees soft, arms out
    if (f === 13) return {lf:[-34,-86], rf:[30,-80], lk:1, rk:1, la:-1.5, ra:1.6, drop:10};           // tucked in the air
    if (f === 14) return {lf:[-44,0], rf:[44,0], lk:.6, rk:.6, la:-2.1, ra:2.1, drop:40};             // grinding: low, arms up for balance
    if (f === 15) return {lf:[-34,0], rf:[40,-14], lk:.3, rk:.9, la:-.5, ra:1.9, drop:22, tilt:-.18}; // manual: leaning back
    if (f === 16) return {lf:[-8,0], rf:[14,0], lk:.25, rk:.2, la:1.15, ra:1.3, drop:14};             // scooter: hands forward on the bars
    if (f === 17) return {lf:[18,0], rf:[-72,-4], lk:.5, rk:.05, la:.5, ra:-.5, drop:24};             // pushing: back foot sweeping the ground
    if (f === 18) return {lf:[-30,-40], rf:[40,-20], lk:.8, rk:.4, la:2.6, ra:2.2, tilt:1.35};        // bail: over you go
    return {lf:[-10,-60], rf:[14,-10], lk:1, rk:.3, la:-2.9, ra:-2.7};
  }
  function drawFrame(x, fig, f, ox, oy = 0){
    const R = rng(fig.key.length*7919 + f*131 + 17), B = BODY[fig.body], p = pose(f), drop = p.drop || 0;
    x.save(); x.translate(ox, oy); const tilt = f === 10 ? -.5 : p.tilt || 0; if (tilt){ x.translate(128, 470); x.rotate(tilt); x.translate(-128, -470); }
    const hipY = B.hip - 6 + drop, foot = 492;
    [[-12, p.lf, p.lk], [12, p.rf, p.rk]].forEach(([hx, [fx, fy], kb]) => {
      const hxp = 128 + hx, ex = 128 + fx, ey = foot + fy, mx = (hxp + ex)/2 + kb*34, my = (hipY + ey)/2 - kb*20;
      sketch(x, [[hxp, hipY], [mx, my], [ex, ey]], R, 7, 2, 4); sketch(x, [[ex - 4, ey], [ex + 14, ey + 2]], R, 6, 1); });
    x.translate(0, drop);   // a crouch: the body, arms and head sit lower over the same feet
    hatch(x, B.poly, fig.col, R); sketch(x, [...B.poly, B.poly[0]], R, 5, 2, 4.5);
    const sh = B.poly[0][1] + 6;
    [[B.poly[0][0] + 4, p.la], [B.poly[1][0] - 4, p.ra]].forEach(([sx, a]) => { const L = 150; sketch(x, [[sx, sh], [sx + Math.sin(a)*L*.5 + (sx < 128 ? -6 : 6), sh + Math.cos(a)*L*.5], [sx + Math.sin(a)*L, sh + Math.cos(a)*L]], R, 5, 2, 3); });
    drawHead(x, fig.head, R, fig.col); x.restore();
  }
  function atlas(fig){
    const c = document.createElement('canvas'); c.width = FW*ACOLS; c.height = FH*AROWS; const x = c.getContext('2d');   // two rows, so it stays under 4096 px wide for phones
    for (let f = 0; f < FRAMES; f++) drawFrame(x, fig, f, (f % ACOLS)*FW, Math.floor(f/ACOLS)*FH);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1/ACOLS, 1/AROWS); t.anisotropy = 4; return {t, c};
  }
  function shadowTex(){   // grey hatched strokes, wide at the feet and thinning out
    const c = document.createElement('canvas'); c.width = 128; c.height = 512; const x = c.getContext('2d'), R = rng(99); x.lineCap = 'round';
    for (let i = 0; i < 26; i++){ const y0 = 500 - i*17 - R()*8, w = 46*(1 - i/30) + 6; x.strokeStyle = `rgba(40,40,44,${.55 - i*.012})`; x.lineWidth = 7 + R()*5;
      x.beginPath(); x.moveTo(64 - w + (R()-.5)*8, y0 + 8); x.lineTo(64 + w + (R()-.5)*8, y0 - 14); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ---------- the figure in the world ----------
  const plane = new THREE.PlaneGeometry(1, 2); plane.translate(0, 1 - (FH - 492)/FH*2, 0);   // origin at the soles of the feet
  const mat = new THREE.MeshBasicMaterial({transparent:true, alphaTest:.4, side:THREE.DoubleSide, fog:true});
  const body = new THREE.Mesh(plane, mat); body.renderOrder = 2; body.userData.noCollide = true;
  const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI/2); sg.translate(0, 0, -.5);   // the shadow runs from the feet along -z, turned toward the sun's far side
  const shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({map:shadowTex(), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}));
  shadow.userData.noCollide = true; const fig = new THREE.Group(); fig.add(body, shadow); fig.visible = false; scene.add(fig);
  body.visible = SKETCH;   // the player is the flat sketch sheet (or, with SKETCH off, the 3D figure below)

  // ---------- the player: a 3D sketch figure on a simple rig ----------
  // Ink-black limbs, a hatched coloured body on cream paper with a black outline, one of five silhouettes. Joints:
  // root (feet, faces the way you move) > flip (hips; turns over on a double jump) > spine > neck/head, shoulders > elbows, hips > knees.
  const INK = new THREE.MeshStandardMaterial({color:0x151515, roughness:.9});
  const LINE = new THREE.MeshBasicMaterial({color:0x111111, side:THREE.BackSide});
  const PAPER = new THREE.MeshStandardMaterial({color:0xf4efe4, roughness:1});
  function hatchTex(col){ const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = rng(col.length*31 + 7);
    x.fillStyle = '#f4efe4'; x.fillRect(0, 0, 256, 256); x.strokeStyle = col; x.lineCap = 'round';
    for (let d = -256; d < 512; d += 11 + R()*6){ x.globalAlpha = .55 + R()*.4; x.lineWidth = 6 + R()*5; x.beginPath(); x.moveTo(d + (R()-.5)*10, 256); x.lineTo(d + 150 + (R()-.5)*10, 0); x.stroke(); }
    x.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5); return t; }
  const outlined = (geo, mat, k = 1.07) => { const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), l = new THREE.Mesh(geo, LINE); l.scale.setScalar(k); m.castShadow = true; g.add(m, l); return g; };
  const limb = (len, r0, r1) => { const g = new THREE.CylinderGeometry(r1, r0, len, 6); g.translate(0, -len/2, 0); const m = new THREE.Mesh(g, INK); m.castShadow = true; return m; };
  const TORSO = {   // lathe profiles [radius, height above the hips], flattened front to back
    coat: [[.0,-.28],[.17,-.28],[.2,.05],[.27,.5],[.12,.58],[0,.6]],
    hour: [[0,-.18],[.25,-.18],[.07,.22],[.2,.5],[.1,.57],[0,.58]],
    block: [[0,-.08],[.25,-.08],[.29,.3],[.3,.52],[.14,.6],[0,.61]],
    dress: [[0,-.32],[.3,-.32],[.08,.2],[.17,.5],[.09,.56],[0,.57]],
    tall: [[0,-.42],[.16,-.42],[.17,.1],[.2,.55],[.1,.63],[0,.64]]
  };
  function head(kind, mat){ const g = new THREE.Group();
    if (kind === 'box'){ g.add(outlined(new THREE.BoxGeometry(.19, .25, .19), PAPER, 1.1)); const hat = outlined(new THREE.CylinderGeometry(.08, .08, .14, 8), INK, 1.08); hat.position.y = .19; const br = outlined(new THREE.CylinderGeometry(.15, .15, .02, 10), INK); br.position.y = .125; g.add(hat, br); }
    else if (kind === 'cone'){ g.add(outlined(new THREE.SphereGeometry(.1, 8, 6), PAPER, 1.12)); const c = outlined(new THREE.ConeGeometry(.17, .42, 8), PAPER, 1.06); c.position.y = .27; const br = outlined(new THREE.CylinderGeometry(.3, .3, .02, 12), PAPER); br.position.y = .08; g.add(c, br); }
    else if (kind === 'brim'){ g.add(outlined(new THREE.SphereGeometry(.1, 8, 6), PAPER, 1.12)); const cr = outlined(new THREE.CylinderGeometry(.11, .12, .16, 10), mat, 1.06); cr.position.y = .15; const br = outlined(new THREE.CylinderGeometry(.33, .33, .02, 14), mat); br.position.y = .08; g.add(cr, br); }
    else { const h = outlined(new THREE.ConeGeometry(.2, .62, 8), mat, 1.06); h.position.y = .17; g.add(h, outlined(new THREE.SphereGeometry(.1, 8, 6), PAPER, 1.1)); }
    return g; }
  const rig = {root:new THREE.Group()}; scene.add(rig.root); rig.root.visible = false; rig.root.userData.noCollide = true;
  function buildRig(f){
    while (rig.root.children.length) rig.root.remove(rig.root.children[0]);
    if (rig.tex) rig.tex.dispose(); rig.tex = hatchTex(f.col); const body = new THREE.MeshStandardMaterial({map:rig.tex, roughness:1, side:THREE.DoubleSide});
    const s = f.s, flip = new THREE.Group(); flip.position.y = .95; rig.root.add(flip); rig.flip = flip; rig.root.scale.setScalar(f.rs || s);
    const spine = new THREE.Group(); flip.add(spine); rig.spine = spine;
    const lg = new THREE.LatheGeometry(TORSO[f.body].map(([r, y]) => new THREE.Vector2(r, y)), 8); lg.scale(1, 1, .62);
    spine.add(outlined(lg, body, 1.05));
    const top = TORSO[f.body][3][1], shW = TORSO[f.body][3][0] - .02;
    const neck = new THREE.Group(); neck.position.y = top + .14; spine.add(neck); neck.add(head(f.head, body)); rig.neck = neck;
    const arm = side => { const sh = new THREE.Group(); sh.position.set(side*shW, top - .02, 0); spine.add(sh); sh.add(limb(.32, .045, .04));
      const el = new THREE.Group(); el.position.y = -.32; sh.add(el); el.add(limb(.3, .04, .035)); const hd = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), INK); hd.position.y = -.31; el.add(hd); return {sh, el}; };
    const leg = side => { const hp = new THREE.Group(); hp.position.set(side*.09, 0, 0); flip.add(hp); hp.add(limb(.47, .06, .05));
      const kn = new THREE.Group(); kn.position.y = -.47; hp.add(kn); kn.add(limb(.45, .05, .04)); const ft = new THREE.Mesh(new THREE.BoxGeometry(.09, .06, .22), INK); ft.position.set(0, -.46, -.06); ft.castShadow = true; kn.add(ft); return {hp, kn}; };
    rig.aL = arm(-1); rig.aR = arm(1); rig.lL = leg(-1); rig.lR = leg(1);
  }
  let face = 0, boilT = 0;
  function animateRig(now, dt){
    const r = rig, hv = Math.hypot(P.vel.x, P.vel.z), k = q => 1 - Math.exp(-dt*q), a = P.phase*Math.PI*2, run = Math.min(1, hv/9), air = !P.ground && !P.climb && !P.wr;
    const rp = W.ride && W.ride.on ? W.ride.pose : null;   // on a skateboard or scooter, ride.js poses the figure
    r.root.position.copy(P.pos); if (rp) r.root.position.y += rp.lift;
    const want = hv > .8 && !P.climb ? Math.atan2(-P.vel.x, -P.vel.z) : P.climb ? Math.atan2(-P.climb.dir.x, -P.climb.dir.z) : face;
    if (rp) face = rp.face; else face += Math.atan2(Math.sin(want - face), Math.cos(want - face))*k(14); r.root.rotation.y = face;
    // joint targets in radians, about each joint's x axis. The figure faces -z, so: hips and shoulders + swings the limb forward,
    // elbows + bends the forearm forward, knees - bends the shin back, spine - leans forward
    let hipL, hipR, kneeL, kneeR, shL, shR, elL, elR, lean = -run*.32, roll = 0, hipsY = .95, bob = 0;
    if (rp){ hipL = rp.hipL; hipR = rp.hipR; kneeL = rp.kneeL; kneeR = rp.kneeR; shL = rp.shL; shR = rp.shR; elL = rp.elL; elR = rp.elR; lean = rp.lean; roll = rp.roll; hipsY = rp.hipsY; }
    else if (P.climb){ const t = P.climb.t; hipL = 1.2*(1 - t); hipR = .3; kneeL = -1.5*(1 - t); kneeR = -.6; shL = shR = 2.9 - t*1.6; elL = elR = .3; lean = -.35; }
    else if (P.slide){ hipL = 1.45; hipR = 1.1; kneeL = -.15; kneeR = -.9; shL = -.6; shR = .5; elL = elR = .4; lean = .95; hipsY = .42; }
    else if (air){ const up = P.vel.y > 0; hipL = up ? 1.05 : .55; hipR = up ? -.25 : .15; kneeL = up ? -1.4 : -.7; kneeR = up ? -.5 : -.9; shL = 1.1; shR = -.55; elL = .6; elR = .3; lean = -.15; }
    else if (hv > .4 || P.wr){ const amp = .45 + run*.55; hipL = Math.sin(a)*amp; hipR = -Math.sin(a)*amp;
      kneeL = -(Math.max(0, -Math.cos(a))*(.4 + run*1.2) + .08); kneeR = -(Math.max(0, Math.cos(a))*(.4 + run*1.2) + .08);
      shL = -Math.sin(a)*amp*.9; shR = Math.sin(a)*amp*.9; elL = elR = .25 + run*.95; bob = Math.abs(Math.sin(a))*.05*(.5 + run); }
    else { const br = Math.sin(now*.002)*.03; hipL = hipR = 0; kneeL = kneeR = -.04; shL = .08 + br; shR = -.08 - br; elL = elR = .12; lean = br; }
    if (P.low && !P.slide && !P.climb && !rp){ hipsY = .6; hipL += .9; hipR += .9; kneeL -= 1.5; kneeR -= 1.5; lean -= .2; }
    if (P.wr) roll = .38*P.wr.side;
    const j = (o, ax, v) => { o.rotation[ax] += (v - o.rotation[ax])*k(18); };
    j(r.lL.hp, 'x', hipL); j(r.lR.hp, 'x', hipR); j(r.lL.kn, 'x', kneeL); j(r.lR.kn, 'x', kneeR);
    j(r.aL.sh, 'x', shL); j(r.aR.sh, 'x', shR); j(r.aL.el, 'x', elL); j(r.aR.el, 'x', elR);
    j(r.aL.sh, 'z', rp ? rp.shZL : -.12); j(r.aR.sh, 'z', rp ? rp.shZR : .12); j(r.lL.hp, 'z', rp ? rp.hipZL : 0); j(r.lR.hp, 'z', rp ? rp.hipZR : 0); j(r.neck, 'y', rp ? rp.neckY : 0);
    j(r.spine, 'x', lean); j(r.root, 'z', roll);
    r.flip.position.y += (hipsY + bob - r.flip.position.y)*k(16);
    const ft = Math.min(1, P.djT/.5);
    if (rp) r.flip.rotation.x += (rp.flipX - r.flip.rotation.x)*k(10);                            // a bail: the rider goes over
    else r.flip.rotation.x = ft < 1 ? -Math.PI*2*(1 - (1 - ft)*(1 - ft)) : 0;   // a forward flip on the double jump
    boilT += dt; if (boilT > .11){ boilT = 0; rig.tex.offset.set(Math.random()*.08, Math.random()*.08); rig.tex.rotation = (Math.random() - .5)*.06; }   // the hatching "boils" like a hand drawing
  }
  const atlases = {}; let cur = null, night = 0;
  const KEY = 'hgc-run-figure';
  function choose(key, announce){
    const f = FIGS.find(g => g.key === key) || FIGS[0]; cur = f; atlases[f.key] = atlases[f.key] || atlas(f);
    mat.map = atlases[f.key].t; mat.needsUpdate = true; body.scale.set(f.s*1.02, f.s, 1); buildRig(f);
    try { localStorage.setItem(KEY, f.key); } catch (e) {}
    document.querySelectorAll('.gmFig').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === f.key));
    if (announce && W.mode === 'walk' && !W.third) W.setThird(true);   // picking a figure shows it
  }
  const setNight = W.setNight; W.setNight = n => { setNight(n); night = n; };

  const sunD = new THREE.Vector3(), camR = new THREE.Vector3(); let flip = 1, last = 0;
  let lastNow = 0;
  W.frameHooks.push(now => {
    fig.visible = W.mode === 'walk' && W.third && !!cur; rig.root.visible = fig.visible && !SKETCH;
    const dt = Math.min(.05, Math.max(0, (now - lastNow)/1000)); lastNow = now;
    if (!fig.visible) return;
    if (!SKETCH) animateRig(now, dt);
    const flat = SKETCH || !W.renderer.shadowMap.enabled;   // the sketch casts the hatched shadow; the 3D figure uses real sun shadows on a computer
    fig.position.copy(P.pos);
    body.rotation.y = Math.atan2(camera.position.x - P.pos.x, camera.position.z - P.pos.z);   // turn the sheet to the camera (about the vertical only)
    const hv = Math.hypot(P.vel.x, P.vel.z);
    camR.set(1, 0, 0).applyQuaternion(camera.quaternion); const side = P.vel.x*camR.x + P.vel.z*camR.z;
    if (Math.abs(side) > .6) flip = side < 0 ? -1 : 1;                                             // face the way you are going across the screen
    let f = 0; const ph = ((P.phase % 1) + 1) % 1, rd = W.ride && W.ride.on ? W.ride.R : null;
    if (rd) f = rd.bail > 0 ? 18 : rd.grind ? 14 : rd.manual ? 15 : !P.ground ? 13 : rd.push ? 17 : rd.mode === 'scooter' ? 16 : 12;
    else if (P.climb) f = 11; else if (P.slide) f = 10; else if (!P.ground || P.wr) f = 9;
    else if (hv > 6.5) f = 5 + Math.floor(ph*4); else if (hv > .5) f = 1 + Math.floor(ph*4);
    if (!P.ground && !P.climb && !P.slide && now - last > 140){ last = now; }                     // (air pose holds; boil comes from per-frame jitter)
    mat.map.offset.set((f % ACOLS)/ACOLS, (AROWS - 1 - Math.floor(f/ACOLS))/AROWS); body.scale.x = Math.abs(body.scale.x)*flip;
    body.position.y = rd ? W.ride.pose.lift - (f === 13 ? .29*cur.s : 0) :P.slide ? -.35 : P.low && !P.climb ? -.25 : 0;   // on wheels: stand on the deck
    mat.color.setScalar(1 - .55*night);
    // sketched shadow: long and pale at dawn and dusk, short at noon, almost gone at night
    sunD.copy(W.sun.position).sub(W.sun.target.position).normalize();
    const el = Math.max(.12, sunD.y), len = Math.min(6.5, 1.85/Math.tan(Math.asin(Math.min(.99, el))) + .4);
    shadow.rotation.y = Math.atan2(sunD.x, sunD.z); shadow.scale.set(.95, 1, len);
    o.set(P.pos.x, P.pos.y + .5, P.pos.z); shadow.visible = flat && (P.ground || P.climb ? true : W.game.cast(o, DOWN, 3, hit));
    shadow.position.y = P.ground ? .03 : (shadow.visible ? hit.point.y - P.pos.y + .03 : 0);
    shadow.material.opacity = (1 - night*.85) * (P.ground ? 1 : .6);
  });
  const o = new THREE.Vector3(), DOWN = new THREE.Vector3(0,-1,0), hit = {point:new THREE.Vector3(), normal:new THREE.Vector3(), distance:0};

  // ---------- the chooser: on the welcome panel, and from the Figure button / P key ----------
  document.head.insertAdjacentHTML('beforeend', `<style>
    .gmFigs{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0 4px}
    .gmFig{all:unset;cursor:pointer;background:#f4f1ea;border:2px solid transparent;display:grid;justify-items:center;padding:4px 2px 3px;color:#141414;font:600 10px Rajdhani,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;text-align:center}
    .gmFig canvas{position:static;inset:auto;touch-action:auto;cursor:inherit;width:100%;height:auto;aspect-ratio:1/2;display:block}
    .gmFig[aria-pressed=true]{border-color:#ff3d7f;box-shadow:0 0 0 2px #e0b057 inset}
    #gmPick{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;width:min(520px,94vw);background:rgba(12,12,16,.94);border-left:2px solid #e0b057;padding:12px 14px;color:#fff;font:600 14px Rajdhani,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
    #gmPick small{display:block;color:#4fe3f2;font:400 11px "Share Tech Mono",monospace;letter-spacing:0;text-transform:none}
    #gmPick[hidden]{display:none}
  </style>`);
  function picker(){
    const g = document.createElement('div'); g.className = 'gmFigs';
    FIGS.forEach(f => { const b = document.createElement('button'); b.type = 'button'; b.className = 'gmFig'; b.dataset.k = f.key;
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const x = cv.getContext('2d'); x.scale(.5, .5); drawFrame(x, f, 0, 0);
      b.append(cv, f.name.replace('The ', '')); b.onclick = () => { choose(f.key, true); $('gmPick').hidden = true; }; g.appendChild(b); });
    return g;
  }
  const welcome = $('welcome'); if (welcome){ const h = document.createElement('small'); h.textContent = 'Choose your figure (third person, V)'; h.style.cssText = 'display:block;margin-top:10px'; const row = welcome.querySelector('.row'); welcome.insertBefore(h, row); welcome.insertBefore(picker(), row); }
  document.body.insertAdjacentHTML('beforeend', '<div id="gmPick" hidden><span>Choose your figure</span><small>Shown in third person · P or Esc closes</small></div>');
  $('gmPick').appendChild(picker());
  const modes = $('modes'); if (modes){ const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Figure'; b.onclick = () => $('gmPick').hidden = !$('gmPick').hidden; modes.insertBefore(b, $('hint')); }
  const cam = $('gmCam'); if (cam){ let t; cam.addEventListener('pointerdown', () => t = setTimeout(() => $('gmPick').hidden = false, 550)); ['pointerup','pointerleave'].forEach(n => cam.addEventListener(n, () => clearTimeout(t))); }   // phone: hold View
  addEventListener('keydown', e => { if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyP'){ document.exitPointerLock?.(); $('gmPick').hidden = !$('gmPick').hidden; } else if (e.code === 'Escape') $('gmPick').hidden = true; });
  let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  choose(saved || FIGS[0].key, false);

  // ================= crowds: the same sketch figures, walking the city in small groups =================
  // One instanced mesh for everyone. The vertex shader turns each sheet to the camera and picks its atlas cell
  // (variant x frame), so hundreds of people cost one draw call. Hatched shadows are a second instanced mesh.
  const ALTS = ['#2f8a4a', '#d8344f', '#b07ad8', '#2f6fe0', '#e0892f'];
  const VARS = [...FIGS, ...FIGS.map((f, i) => ({...f, key:f.key + '-b', col:ALTS[i]}))], CW = 128, CH = 256, COLS = VARS.length, ROWS = 5;   // frames: stand + 4 walk
  const sheet = document.createElement('canvas'); sheet.width = CW*COLS; sheet.height = CH*ROWS; { const x = sheet.getContext('2d');
    VARS.forEach((f, c) => { for (let r = 0; r < ROWS; r++){ x.save(); x.translate(c*CW, r*CH); x.scale(CW/FW, CH/FH); drawFrame(x, f, r, 0); x.restore(); } }); }
  const crowdTex = new THREE.CanvasTexture(sheet); crowdTex.colorSpace = THREE.SRGBColorSpace; crowdTex.anisotropy = 4;
  const crowdMat = new THREE.MeshBasicMaterial({map:crowdTex, alphaTest:.4, side:THREE.DoubleSide});
  crowdMat.onBeforeCompile = sh => {
    sh.uniforms.uGrid = {value:new THREE.Vector2(COLS, ROWS)};
    sh.vertexShader = 'attribute vec2 aCell; attribute float aFlip; uniform vec2 uGrid;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = (vec2(aFlip < 0. ? 1. - uv.x : uv.x, uv.y) + vec2(aCell.x, uGrid.y - 1. - aCell.y)) / uGrid;')
      .replace('#include <project_vertex>', `vec3 cC = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        float csx = length(instanceMatrix[0].xyz), csy = length(instanceMatrix[1].xyz);
        vec3 cR = vec3(viewMatrix[0][0], 0., viewMatrix[2][0]); cR = length(cR) > 1e-4 ? normalize(cR) : vec3(1., 0., 0.);   // camera right, kept level
        vec4 mvPosition = viewMatrix * vec4(cC + cR * transformed.x * csx + vec3(0., transformed.y * csy, 0.), 1.);
        gl_Position = projectionMatrix * mvPosition;`);
  };
  crowdMat.customProgramCacheKey = () => 'crowd1';
  const shadowMat = new THREE.MeshBasicMaterial({map:shadow.material.map, transparent:true, opacity:.75, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  const people = []; let crowd = null, crowdShadow = null;

  function spot(x, z, out){   // a free spot on the ground near (x, z): open sky above it and nothing within reach of a body
    o.set(x, LANDY + 60, z); if (!W.game.cast(o, DOWN, 80, hit) || hit.normal.y < .8) return false;
    const y = hit.point.y; if (y > LANDY + 2.2 || y < W.SEA + .6) return false;   // ground level only (streets, quays, decks), not roofs, not water
    o.set(x, y + .4, z); if (W.game.cast(o, UP, 2.2, hit)) return false;
    out.set(x, y, z); return true;
  }
  const LANDY = W.LAND, UP = new THREE.Vector3(0, 1, 0), pt = new THREE.Vector3();
  function spawnCrowd(){
    const low = W.realism && W.realism.quality === 'low', N = low ? 140 : 440, homes = [];
    homes.push({x:-280, z:0, r:12, n:7});                                                             // the arrival quay by the globe
    W.markers.children.forEach(m => homes.push({x:m.position.x, z:m.position.z, r:26, n:low ? 5 : 11})); // around every project's marker
    homes.push({x:-250, z:0, r:30, n:8});                                                             // the street past the arch
    const R = rng(4242);
    let guard = 0; while (homes.reduce((a, h) => a + h.n, 0) < N && guard++ < 4000){                 // the rest on streets and squares across the city
      const x = -500 + R()*1300, z = -700 + R()*1350; if (spot(x, z, pt)) homes.push({x, z, r:40, n:2 + Math.floor(R()*4)}); }
    for (const h of homes){
      let made = 0, tries = 0; const heading = R()*Math.PI*2, speed = 1.1 + R()*.45, idle = R() < .3;
      while (made < h.n && tries++ < h.n*12 && people.length < N){
        const a = R()*Math.PI*2, d = Math.sqrt(R())*h.r; if (!spot(h.x + Math.cos(a)*d, h.z + Math.sin(a)*d, pt)) continue;
        const kid = R() < .12, v = Math.floor(R()*VARS.length);
        people.push({p:pt.clone(), home:new THREE.Vector3(h.x, pt.y, h.z), leash:h.r + 35, dir:heading + (R() - .5)*.5, speed:speed*(kid ? .9 : 1) * (.94 + R()*.12),
          idle:idle && made < 2, s:VARS[v].s*(kid ? .72 : .97 + R()*.06), v, ph:R(), probe:R()*.5, ty:pt.y, flip:1}); made++; }
    }
    const geo = plane.clone(), n = people.length;
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(n*2), 2));
    geo.setAttribute('aFlip', new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1));
    crowd = new THREE.InstancedMesh(geo, crowdMat, n); crowd.frustumCulled = false; crowd.userData.noCollide = true; crowd.renderOrder = 2;
    crowdShadow = new THREE.InstancedMesh(sg, shadowMat, n); crowdShadow.frustumCulled = false; crowdShadow.userData.noCollide = true;
    people.forEach((q, i) => geo.attributes.aCell.setX(i, q.v));
    scene.add(crowdShadow, crowd); console.log('[crowd]', n, 'people in', homes.length, 'places');
  }
  (function wait(){ if (W.game && W.game.gems && W.game.gems.length) spawnCrowd(); else setTimeout(wait, 400); })();

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), POS = new THREE.Vector3(), Yax = new THREE.Vector3(0, 1, 0), fd = new THREE.Vector3(), cR = new THREE.Vector3();
  W.frameHooks.push((now, rdt) => {
    if (!crowd) return;
    const show = !W.inGlobe; crowd.visible = crowdShadow.visible = show; if (!show) return;
    const dt = Math.min(.05, rdt || .016), cam = camera.position, cell = crowd.geometry.attributes.aCell, flp = crowd.geometry.attributes.aFlip;
    cR.set(1, 0, 0).applyQuaternion(camera.quaternion); cR.y = 0; cR.normalize();
    sunD.copy(W.sun.position).sub(W.sun.target.position).normalize();
    const el = Math.max(.12, sunD.y), len = Math.min(6.5, 1.85/Math.tan(Math.asin(Math.min(.99, el))) + .4), sRot = Math.atan2(sunD.x, sunD.z);
    crowdMat.color.setScalar(1 - .55*night); shadowMat.opacity = .75*(1 - night*.85);
    const pl = W.mode === 'walk' ? P.pos : null;
    for (let i = 0; i < people.length; i++){
      const q = people[i], far = Math.abs(q.p.x - cam.x) + Math.abs(q.p.z - cam.z) > 700;
      if (!q.idle && !far){
        const cx = Math.cos(q.dir), cz = Math.sin(q.dir);
        q.probe -= dt;
        if (q.probe <= 0){ q.probe = .45 + Math.random()*.2;                                     // look ahead: ground to step on, no wall, not too far from home
          const ax = q.p.x + cx*1.4, az = q.p.z + cz*1.4; let ok = false;
          o.set(ax, q.p.y + 1.6, az); if (W.game.cast(o, DOWN, 3.2, hit) && hit.normal.y > .7 && Math.abs(hit.point.y - q.p.y) < .6 && hit.point.y > W.SEA + .6){ q.ty = hit.point.y; ok = true; }
          if (ok){ o.set(q.p.x, q.p.y + 1, q.p.z); fd.set(cx, 0, cz); if (W.game.cast(o, fd, 1.5, hit)) ok = false; }
          if (ok && Math.hypot(q.p.x - q.home.x, q.p.z - q.home.z) > q.leash) q.dir = Math.atan2(q.home.z - q.p.z, q.home.x - q.p.x) + (Math.random() - .5)*.6;
          else if (!ok) q.dir += (Math.random() < .5 ? 1 : -1)*(1.6 + Math.random()*1.5);
          else q.dir += (Math.random() - .5)*.25;                                                 // a little wander
        }
        q.p.x += Math.cos(q.dir)*q.speed*dt; q.p.z += Math.sin(q.dir)*q.speed*dt; q.p.y += (q.ty - q.p.y)*Math.min(1, dt*8);
        q.ph += q.speed*dt*1.15/(q.s/.95);
      }
      if (pl){ const dx = q.p.x - pl.x, dz = q.p.z - pl.z, d = Math.hypot(dx, dz); if (d < .75 && d > 1e-3 && Math.abs(q.p.y - pl.y) < 1.5){ q.p.x += dx/d*(.75 - d); q.p.z += dz/d*(.75 - d); } }   // step aside for the runner
      const frame = q.idle || far ? 0 : 1 + Math.floor((((q.ph % 1) + 1) % 1)*4);
      if (cell.getY(i) !== frame) cell.setY(i, frame);
      const side = Math.cos(q.dir)*cR.x + Math.sin(q.dir)*cR.z, fl = q.idle ? (i % 2 ? 1 : -1) : (Math.abs(side) > .2 ? (side < 0 ? -1 : 1) : q.flip); q.flip = fl; flp.setX(i, fl);
      M4.makeScale(q.s*1.02, q.s, 1).setPosition(q.p); crowd.setMatrixAt(i, M4);
      Q.setFromAxisAngle(Yax, sRot); S.set(.95*q.s, 1, len*q.s); POS.set(q.p.x, q.p.y + .03, q.p.z); M4.compose(POS, Q, S); crowdShadow.setMatrixAt(i, M4);
    }
    crowd.instanceMatrix.needsUpdate = crowdShadow.instanceMatrix.needsUpdate = cell.needsUpdate = flp.needsUpdate = true;
  });

  W.figures = {FIGS, choose, people};
}
