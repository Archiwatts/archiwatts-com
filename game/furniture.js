// Hidden Gems City: street furniture and city life on top of the plan city.
// Street lights and stop signs (instanced, no collision), landmark buildings (Mediterranean markets, supermarkets, post offices),
// and things to ride: skate parks, street spots (ledges, rails, manual pads) and construction sites (barriers, pipes, planks,
// scaffolding, ramps). The landmarks and skate pieces are ordinary meshes, so the game's colliders and ride.js grind finder see them.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildFurniture({THREE, CITY, TOP, ROAD}){
  const out = {group: new THREE.Group()}, G = out.group;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.8}, o));
  // ---- geometry buckets: one merged mesh per material ----
  const B = new Map();
  const put = (mat, g) => { (B.get(mat) || B.set(mat, []).get(mat)).push(g.index ? g.toNonIndexed() : g); };
  const box = (mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); put(mat, g); };
  const cyl = (mat, r0, r1, h, x, y, z, seg = 10, rx = 0, ry = 0) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); put(mat, g); };
  const M = {
    stucco: std(0xf1e9da, {roughness:.9}), stuccoW: std(0xfaf6ee, {roughness:.9}), terracotta: std(0xb5643c, {roughness:.85}), stone: std(0xd8ccb4, {roughness:.9}),
    awnA: std(0x2f6f8f, {roughness:.9, side:THREE.DoubleSide}), awnB: std(0xe9e2d0, {roughness:.9, side:THREE.DoubleSide}), wood: std(0x7a5a3a, {roughness:.85}),
    glass: std(0x9fb8c4, {roughness:.15, metalness:.3}), steel: std(0x9aa1a8, {roughness:.4, metalness:.7}), dark: std(0x2b2e33, {roughness:.6, metalness:.3}),
    superSign: std(0x2f8f4a, {roughness:.6}), postSign: std(0xf2c230, {roughness:.6}), postRed: std(0xb8352f, {roughness:.6}), brick: std(0xa65a44, {roughness:.9}),
    concrete: std(0x8f8c86, {roughness:.95}), ramp: std(0x6f7c86, {roughness:.8}), pad: std(0x9a968e, {roughness:.95}), coping: std(0xd7dbe0, {roughness:.3, metalness:.8}),
    orange: std(0xe0662a, {roughness:.7}), white: std(0xf4f4f0, {roughness:.7}), plywood: std(0xc8a46e, {roughness:.9}), dirt: std(0x8a7556, {roughness:1}),
    fence: std(0x8f969c, {roughness:.5, metalness:.6, transparent:true, opacity:.55, side:THREE.DoubleSide}), yellow: std(0xf0c419, {roughness:.6}),
  };
  const Y = TOP;
  // local frame helpers: c = centre, u = along the front, f = towards the street
  const at = (c, u, f, a, b) => [c[0] + u[0]*a + f[0]*b, c[1] + u[1]*a + f[1]*b];
  const yawOf = u => Math.atan2(-u[1], u[0]);

  // ================= street lights =================
  const L = CITY.lamps || [];
  if (L.length){
    const pole = new THREE.CylinderGeometry(.07, .11, 7.5, 8); pole.translate(0, 3.75, 0);
    const arm = new THREE.BoxGeometry(1.6, .08, .1); arm.translate(.8, 7.4, 0);
    const base = mergeGeometries([pole.toNonIndexed(), arm.toNonIndexed()]);
    const head = new THREE.BoxGeometry(.7, .14, .32); head.translate(1.5, 7.3, 0);
    const poles = new THREE.InstancedMesh(base, M.dark, L.length), heads = new THREE.InstancedMesh(head, new THREE.MeshBasicMaterial({color:0x8d8473}), L.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    L.forEach(([x, z, yaw], i) => { e.set(0, -yaw, 0); q.setFromEuler(e); p.set(x, Y, z); m.compose(p, q, s); poles.setMatrixAt(i, m); heads.setMatrixAt(i, m); });
    heads.userData.noCollide = true; poles.castShadow = true;   // poles are solid (you bump into them); the lamp heads are overhead
    G.add(poles, heads); out.lampHeads = heads;
  }
  // ================= stop signs =================
  const S = CITY.stops || [];
  if (S.length){
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.beginPath(); for (let k = 0; k < 8; k++){ const a = Math.PI/8 + k*Math.PI/4; x.lineTo(64 + 62*Math.cos(a), 64 + 62*Math.sin(a)); } x.fill();
    x.fillStyle = '#c4161c'; x.beginPath(); for (let k = 0; k < 8; k++){ const a = Math.PI/8 + k*Math.PI/4; x.lineTo(64 + 55*Math.cos(a), 64 + 55*Math.sin(a)); } x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 34px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('STOP', 64, 66);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const face = new THREE.PlaneGeometry(.76, .76); face.translate(0, 2.35, .05);
    const back = new THREE.CircleGeometry(.38, 8); back.rotateY(Math.PI); back.rotateZ(Math.PI/8); back.translate(0, 2.35, .04);
    const post = new THREE.CylinderGeometry(.035, .035, 2.4, 6); post.translate(0, 1.2, 0);
    const faces = new THREE.InstancedMesh(face, new THREE.MeshStandardMaterial({map:tex, transparent:true, alphaTest:.5, roughness:.5}), S.length);
    const rest = new THREE.InstancedMesh(mergeGeometries([post.toNonIndexed(), back.toNonIndexed()]), M.steel, S.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    S.forEach(([sx, sz, yaw], i) => { e.set(0, yaw + Math.PI, 0); q.setFromEuler(e); p.set(sx, Y, sz); m.compose(p, q, s); faces.setMatrixAt(i, m); rest.setMatrixAt(i, m); });
    faces.userData.noCollide = true; G.add(faces, rest);   // the post is solid
  }
  // ================= landmarks =================
  for (const b of CITY.landmarks || []){
    const {c, u, f} = b, w = b.w, d = b.d, ry = yawOf(u);
    if (b.type === 'market'){                     // Mediterranean market hall: white stucco, arcade of round arches facing the street, terracotta roof, striped awnings
      const h = 7.5, n = Math.max(3, Math.round(w/4.2)), bay = w/n;
      box(M.stucco, w, h, d - 3, ...[at(c, u, f, 0, -1.5)].map(p => [p[0], Y + h/2, p[1]])[0], ry);
      for (let i = 0; i <= n; i++){ const p = at(c, u, f, -w/2 + i*bay, d/2 - .6); box(M.stuccoW, .7, 4.2, .7, p[0], Y + 2.1, p[1], ry); }   // piers
      for (let i = 0; i < n; i++){                                                                                    // arches: half rings between the piers
        const p = at(c, u, f, -w/2 + (i + .5)*bay, d/2 - .6), g = new THREE.TorusGeometry((bay - .7)/2, .35, 6, 12, Math.PI); g.rotateY(ry); g.translate(p[0], Y + 4.2, p[1]); put(M.stuccoW, g); }
      const fr = at(c, u, f, 0, d/2 - .6); box(M.stuccoW, w + .7, 1.6, .9, fr[0], Y + 5.6, fr[1], ry);              // arcade entablature
      box(M.stone, w + 1, .35, d + 1, c[0], Y + h + .15, c[1], ry);                                                   // cornice
      const roof = new THREE.ConeGeometry(Math.hypot(w, d)/2*1.02, 2.6, 4, 1); roof.rotateY(Math.PI/4); roof.scale(w/Math.hypot(w, d)*1.414, 1, d/Math.hypot(w, d)*1.414); roof.rotateY(ry); roof.translate(c[0], Y + h + 1.6, c[1]); put(M.terracotta, roof);
      for (let i = 0; i < n; i++){ const p = at(c, u, f, -w/2 + (i + .5)*bay, d/2 + 1.1); box(i % 2 ? M.awnA : M.awnB, bay - .4, .08, 2.2, p[0], Y + 3.0, p[1], ry, 0.0, 0); }   // awnings over the stalls
      for (let i = 0; i < n; i += 2){ const p = at(c, u, f, -w/2 + (i + .5)*bay, d/2 + 2.6); box(M.wood, bay*.7, .9, 1.1, p[0], Y + .45, p[1], ry); }   // stalls (ledges to grind)
    } else if (b.type === 'super'){              // supermarket: big box, glass front, green sign band, canopy, trolley bay
      const h = 8;
      box(M.stuccoW, w, h, d, c[0], Y + h/2, c[1], ry);
      const fr = at(c, u, f, 0, d/2 + .05); box(M.glass, w*.7, 3.6, .2, fr[0], Y + 1.9, fr[1], ry);
      const sg = at(c, u, f, 0, d/2 + .2); box(M.superSign, w*.86, 1.6, .4, sg[0], Y + h - 1.2, sg[1], ry);
      const cn = at(c, u, f, 0, d/2 + 2); box(M.dark, w*.75, .3, 4, cn[0], Y + 4.2, cn[1], ry);
      for (const a of [-.35, .35]){ const pp = at(c, u, f, w*a, d/2 + 3.8); cyl(M.steel, .12, .12, 4.2, pp[0], Y + 2.1, pp[1]); }
      const tb = at(c, u, f, -w*.3, d/2 + 7); box(M.steel, 6, .06, .06, tb[0], Y + 1.0, tb[1], ry);                   // trolley rail (grindable)
    } else {                                     // post office: red-brick hall, yellow sign band, stone steps with a handrail
      const h = 9;
      box(M.brick, w, h, d, c[0], Y + h/2, c[1], ry);
      const sg = at(c, u, f, 0, d/2 + .2); box(M.postSign, w*.7, 1.4, .3, sg[0], Y + h - 1.6, sg[1], ry); box(M.postRed, w*.72, .25, .32, sg[0], Y + h - .75, sg[1], ry);
      for (let k = 0; k < 3; k++){ const st = at(c, u, f, 0, d/2 + .6 + k*.45); box(M.stone, w*.5, .45*(3 - k), .45, st[0], Y + .225*(3 - k), st[1], ry); }
      for (const a of [-.15, .15]){ const r0 = at(c, u, f, w*a, d/2 + .5), r1 = at(c, u, f, w*a, d/2 + 2.1);
        const g = new THREE.CylinderGeometry(.04, .04, Math.hypot(1.6, 1.0), 6); g.rotateX(Math.PI/2 - Math.atan2(1.0, 1.6)); g.rotateY(ry + Math.PI/2); g.translate((r0[0] + r1[0])/2, Y + 1.35, (r0[1] + r1[1])/2); put(M.steel, g); }
      const pb = at(c, u, f, w*.42, d/2 + 2); box(M.postRed, .5, 1.2, .5, pb[0], Y + .6, pb[1], ry);                // post box
    }
  }
  // ================= skate parks, spots, construction sites =================
  const quarter = (mat, cx, cz, ry, w, h, r) => {          // a quarter pipe: curved transition + deck + metal coping
    const n = 10;
    // simple and exact: profile y = r - sqrt(r^2 - x^2) for x in [0, r]
    const s2 = new THREE.Shape(); s2.moveTo(0, 0); for (let i = 0; i <= n; i++){ const xx = i/n*r*.98; s2.lineTo(xx, r - Math.sqrt(r*r - xx*xx)); }
    s2.lineTo(r, h); s2.lineTo(r + 1.4, h); s2.lineTo(r + 1.4, 0); s2.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s2, {depth:w, bevelEnabled:false}); g.translate(-(r + 1.4)/2, 0, -w/2); g.rotateY(ry); g.translate(cx, Y, cz); put(mat, g);
    const cp = new THREE.CylinderGeometry(.06, .06, w, 8); cp.rotateX(Math.PI/2); cp.translate(-(r + 1.4)/2 + r, h, 0); cp.rotateY(ry); cp.translate(cx, Y, cz); put(M.coping, cp);
  };
  const ledge = (mat, x, z, ry, l, h = .45, dd = .6) => { box(mat, l, h, dd, x, Y + h/2, z, ry); const g = new THREE.BoxGeometry(l, .05, .05); g.translate(0, h, dd/2); g.rotateY(ry); g.translate(x, Y, z); put(M.coping, g); };
  const rail = (x, z, ry, l, h = .55) => { const g = new THREE.CylinderGeometry(.04, .04, l, 8); g.rotateZ(Math.PI/2); g.translate(0, h, 0); g.rotateY(ry); g.translate(x, Y, z); put(M.steel, g);
    for (const a of [-l/2 + .3, l/2 - .3]) { const p = new THREE.CylinderGeometry(.035, .035, h, 6); p.translate(a, h/2, 0); p.rotateY(ry); p.translate(x, Y, z); put(M.steel, p); } };
  const kicker = (mat, x, z, ry, w, l, h) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(l, h); s.lineTo(l, 0); s.lineTo(0, 0); const g = new THREE.ExtrudeGeometry(s, {depth:w, bevelEnabled:false}); g.translate(-l/2, 0, -w/2); g.rotateY(ry); g.translate(x, Y, z); put(mat, g); };
  const funbox = (x, z, ry) => { box(M.ramp, 5, .7, 3, x, Y + .35, z, ry); const ca = Math.cos(ry), sa = Math.sin(ry);
    kicker(M.ramp, x + ca*3.5, z - sa*3.5, ry + Math.PI, 3, 2, .7); kicker(M.ramp, x - ca*3.5, z + sa*3.5, ry, 3, 2, .7); rail(x, z + 0, ry, 4.6, 1.05); };
  for (const k of CITY.skate || []){
    const [cx, cz] = k.c, a = k.a || 0, ca = Math.cos(a), sa = Math.sin(a), P = (u, v) => [cx + ca*u - sa*v, cz - sa*u - ca*v];
    if (k.type === 'park'){
      const r = Math.max(9, Math.min(k.r, 26)), s = r*1.55;
      box(M.pad, s*1.6, .12, s, cx, Y + .06, cz, a);                                                         // the concrete pad
      quarter(M.ramp, ...P(-s*.8 + 1.6, 0), a + Math.PI, s*.7, 2.2, 2.6); quarter(M.ramp, ...P(s*.8 - 1.6, 0), a, s*.7, 2.2, 2.6);   // two quarter pipes facing each other
      funbox(...P(0, 0), a);
      ledge(M.concrete, ...P(-s*.25, s*.32), a, 7); ledge(M.concrete, ...P(s*.25, -s*.32), a, 7, .35);
      rail(...P(s*.25, s*.32), a, 6, .45); rail(...P(-s*.25, -s*.32), a, 6, .7);
      kicker(M.ramp, ...P(-s*.45, -s*.3), a, 2.4, 2.2, .55); kicker(M.ramp, ...P(s*.45, s*.3), a + Math.PI, 2.4, 2.2, .55);
      for (let i = -1; i <= 1; i += 2){ const p = P(i*s*.85, s*.55); box(M.yellow, .08, 1.1, s*.9, p[0], Y + .55, p[1], a + Math.PI/2); }   // low guard rails
    } else if (k.type === 'build'){                // construction site: hoarding fence, barriers, pipes, plank ramps, scaffolding, a half-built core
      const s = Math.max(16, Math.min(k.r*1.6, 40));
      box(M.dirt, s, .06, s, cx, Y + .03, cz, a);
      for (const [u, v, l, r2] of [[0, s/2, s, 0], [0, -s/2, s, 0], [s/2, 0, s, Math.PI/2], [-s/2, 0, s*.6, Math.PI/2]]){ const p = P(u, v); box(M.fence, l, 2.2, .05, p[0], Y + 1.1, p[1], a + r2); }
      for (let i = 0; i < 6; i++){ const p = P(-s*.35 + i*s*.13, -s*.3); box(M.white, 2, .8, .45, p[0], Y + .4, p[1], a); box(M.orange, 2, .14, .47, p[0], Y + .62, p[1], a); }   // jersey barriers (ledges)
      for (let i = 0; i < 3; i++){ const p = P(s*.2, -s*.05 + i*1.3); cyl(M.concrete, .6, .6, 4, p[0], Y + .6, p[1], 16, 0, a); }   // big pipes lying down
      for (let i = 0; i < 3; i++){ const p = P(-s*.25 + i*3.2, s*.18); kicker(M.plywood, p[0], p[1], a + Math.PI/2, 1.2, 3, .9); }   // plank ramps on blocks
      const core = P(s*.2, s*.25); box(M.concrete, 8, 7, 6, core[0], Y + 3.5, core[1], a); box(M.concrete, 9, .3, 7, core[0], Y + 3.6, core[1], a);   // half-built core with a slab ledge
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++){ const p = P(s*.2 - 4.5 + i*3, s*.25 + 3.6); cyl(M.yellow, .05, .05, 2, p[0], Y + 1 + j*2, p[1], 6); }   // scaffold tubes
      for (let j = 1; j <= 3; j++){ const p = P(s*.2, s*.25 + 3.6); box(M.yellow, 9.2, .06, .06, p[0], Y + j*2, p[1], a); box(M.plywood, 9.2, .05, .8, p[0], Y + j*2 - .02, p[1] + 0, a); }   // scaffold boards (grind the rails)
      const cr = P(-s*.3, s*.3); cyl(M.yellow, .25, .25, 14, cr[0], Y + 7, cr[1], 6); box(M.yellow, 12, .35, .35, cr[0] + ca*4, Y + 13.8, cr[1] - sa*4, a);   // a small tower crane
    } else {                                        // street spot in front of a landmark: a granite ledge and a handrail
      const u = k.u || [1, 0], ry = yawOf(u);
      ledge(M.stone, cx, cz, ry, 6, .5, .7); rail(cx + u[0]*0, cz + u[1]*0 + .0, ry, 5, .9);
      const p2 = [cx - u[1]*2.2, cz + u[0]*2.2]; ledge(M.stone, p2[0], p2[1], ry, 4, .4, 1.2);
    }
  }
  for (const [mat, gs] of B){ const g = mergeGeometries(gs.map(g => { const n = new THREE.BufferGeometry(); n.setAttribute('position', g.attributes.position); if (g.attributes.normal) n.setAttribute('normal', g.attributes.normal); return n; }), false);
    if (!g) continue; g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; G.add(m); }
  return out;
}
