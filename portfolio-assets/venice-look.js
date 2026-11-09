/* Venice Apartments: real-looking materials. Every surface of the model is the same flat grey-white, so each material gets its real
   colour, glass and water become see-through, and a world-space shader gives each its texture: plaster walls in Venetian tones that
   change from building to building, terracotta roofs read from the surface slope, flat roofs grey, brick laid in courses, stone in
   blocks, grass mottled. The project's own buildings (Main_apartment, Team_buildings) get a cleaner cream and brick finish than the
   surrounding city. The Watercolor wash keeps these hues. */
(function () {
  var PAL = {
    Plaster: { c: '#e8dcc4', r: .92 }, Stone: { c: '#b9b2a4', r: .88 }, Metal: { c: '#3d4547', r: .42, m: .35 }, Brick: { c: '#a4604a', r: .9 },
    Landscape: { c: '#6d9150', r: 1 }, Glazing: { c: '#8fb8cb', r: .05, m: .1, o: .42 }, Water: { c: '#4f8aa6', r: .06, o: .92 }
  };
  var FRAG_HEAD = 'varying vec3 vNbW;\n' +
    'float nbH(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n' +
    'float nbN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(nbH(i),nbH(i+vec2(1.,0.)),f.x),mix(nbH(i+vec2(0.,1.)),nbH(i+vec2(1.,1.)),f.x),f.y); }\n';
  var NRM = 'vec3 nw=normalize(cross(dFdx(vNbW),dFdy(vNbW)));\n';
  // Spanish (barrel) tile: columns of half-round tiles, a concave pan then a convex cover, laid up the slope in overlapping courses,
  // each tile its own shade; the pattern fades to the average colour when the tiles are smaller than a pixel
  FRAG_HEAD += 'vec3 spTile(vec3 N, vec3 P, vec3 base){ vec3 dn = normalize(vec3(0.,-1.,0.) - N*dot(N, vec3(0.,-1.,0.))); vec3 ac = normalize(cross(N, dn)); float u = dot(P, ac)/.36, v = dot(P, dn)/.6;\n' +
    ' float cu = fract(u), cv = fract(v); float prof = .5+.5*cos(6.2832*cu); vec2 id = vec2(floor(u*2.), floor(v)); float h1 = nbH(id*1.7+3.3), h2 = nbH(id*2.9+8.1);\n' +
    ' float fw = max(fwidth(u), fwidth(v)); float fade = 1. - smoothstep(.1,.38,fw);\n' +
    ' float shade = .66+.46*prof; shade *= .8+.2*smoothstep(0.,.16,cv); shade *= 1.-.22*smoothstep(.86,1.,cv)*(1.-prof);\n' +
    ' vec3 tint = mix(vec3(1.05,.86,.72), vec3(.92,.74,.62), h1); vec3 c = base*tint*(.94+.12*h2)*shade; if (h2 > .94) c *= .86;\n' +
    ' vec3 avg = base*vec3(.98,.8,.67)*.86; return mix(avg, c, fade); }\n';
  var CODE = {
    cityPlaster: NRM + 'float hh=nbH(floor(vNbW.xz/16.)*1.7); vec3 wall = hh<.2?vec3(.93,.80,.58):(hh<.4?vec3(.90,.62,.50):(hh<.6?vec3(.94,.88,.74):(hh<.8?vec3(.84,.70,.52):vec3(.88,.74,.62))));\n' +
      'if (abs(nw.y)<.4) { diffuseColor.rgb = wall*(.9+.14*nbN(vNbW.xz*.5+vNbW.y*.7)) * (.96+.06*sin(vNbW.y*3.1)); }\n' +
      'else if (nw.y>.97) { diffuseColor.rgb = vec3(.56,.54,.5)*(.86+.16*nbN(vNbW.xz*1.3)+.06*nbN(vNbW.xz*7.)); }\n' +
      'else if (nw.y>.4) { diffuseColor.rgb = spTile(nw, vNbW, vec3(.84,.44,.28)); }',
    // the main apartment: warm Venetian stucco, trowelled and weathered (darker and damper toward the street), roofs in tile
    mainPlaster: NRM + 'vec2 sp = vec2(vNbW.x+vNbW.z, vNbW.y);\n' +
      // exterior walls: red-brown brick laid in running bond (215 x 65 mm bricks, 10 mm joints), each brick a little different, the
      // odd darker or paler one; the pattern fades to its average colour in the distance so it never shimmers
      'if (abs(nw.y)<.4 && vNbW.y < 7.5) { vec2 sq = vec2((vNbW.x+vNbW.z)/.78, vNbW.y/.42); float srow = floor(sq.y); sq.x += mod(srow,2.)*.5; vec2 sc = floor(sq), sf = fract(sq); float sh1 = nbH(sc*1.9+4.1), sh2 = nbH(sc*3.1+7.7); float sj = (step(sf.y,.05)+step(sf.x,.035)) > 0. ? 1. : 0.; float sfw = max(fwidth(sq.x), fwidth(sq.y)); float sfade = 1.-smoothstep(.25,.8,sfw); vec3 stn = mix(vec3(.74,.70,.62), vec3(.84,.80,.72), sh1)*(.9+.14*sh2)*(.94+.1*nbN(vNbW.xz*2.+vNbW.y*3.)); diffuseColor.rgb = mix(stn*.93, mix(stn, vec3(.55,.52,.47), sj*.7), sfade); }\n' +
      'else if (abs(nw.y)<.4) { vec2 bs = vec2(.225,.075); float row = floor(sp.y/bs.y); float off = mod(row,2.)*.5; vec2 q = vec2(sp.x/bs.x + off, sp.y/bs.y); vec2 cell = floor(q), f = fract(q);\n' +
      '  float fw = max(fwidth(q.x), fwidth(q.y)); float fade = 1. - smoothstep(.25, .8, fw);\n' +
      '  float jx = .045/ (bs.x/.225), jy = .13; float mortar = (step(f.y, jy) + step(f.x, jx*1.1)) > 0. ? 1. : 0.;\n' +
      '  float h1 = nbH(cell*1.31+3.7), h2 = nbH(cell*2.17+9.1); vec3 brick = mix(vec3(.55,.24,.17), vec3(.70,.34,.23), h1) * (.86+.24*h2); if (h1 > .93) brick *= .72; if (h2 > .94) brick = mix(brick, vec3(.78,.5,.38), .6);\n' +
      '  float soot = smoothstep(.55,.9,nbN(vec2(sp.x*.7, sp.y*.25))); brick *= 1.-.16*soot; float damp = 1.-smoothstep(0.,1.6,vNbW.y-3.); brick *= 1.-.14*damp;\n' +
      '  vec3 mort = vec3(.74,.70,.63)*(.9+.1*nbN(sp*14.)); vec3 avg = brick*.9+mort*.1; vec3 c = mix(mortar > .5 ? mort : brick, avg, 1.-fade); diffuseColor.rgb = mix(avg, c, fade) * (.96+.08*nbN(sp*vec2(.9,1.8))); }\n' +
      'else if (nw.y>.985) { diffuseColor.rgb = vec3(.62,.6,.56)*(.85+.15*nbN(vNbW.xz*1.4)+.06*nbN(vNbW.xz*9.)); }\n' +
      'else if (nw.y>.3) { diffuseColor.rgb = spTile(nw, vNbW, vec3(.9,.46,.28)); }',
    // the two partner buildings: lightly tinted, quiet (slightly highlighted against the basswood city)
    teamPlaster: NRM + 'if (abs(nw.y)<.4) { diffuseColor.rgb = vec3(.97,.93,.86)*(.96+.05*nbN(vNbW.xz*.5+vNbW.y*.6)); } else if (nw.y>.985) { diffuseColor.rgb = vec3(.86,.84,.8); } else if (nw.y>.3) { diffuseColor.rgb = spTile(nw, vNbW, vec3(.95,.62,.46)); }',
    brick: 'float row=floor(vNbW.y/.22); float off=mod(row,2.)*.5; vec2 q=vec2((vNbW.x+vNbW.z)/.5+off, vNbW.y/.22); vec2 f=fract(q); float mortar=step(f.y,.12)+step(f.x,.07); diffuseColor.rgb *= (.82+.3*nbH(floor(q)))*(1.-.35*clamp(mortar,0.,1.)) ;',
    stone: NRM + 'vec2 q=(abs(nw.y)>.8?vNbW.xz:vec2(vNbW.x+vNbW.z,vNbW.y))/1.4; vec2 f=abs(fract(q)-.5); float joint=smoothstep(.46,.5,max(f.x,f.y)); diffuseColor.rgb *= (1.-.22*joint)*(.9+.14*nbH(floor(q)*3.1))*(.94+.08*nbN(vNbW.xz*1.6));',
    grass: 'float g1=nbN(vNbW.xz*.5), g2=nbN(vNbW.xz*2.8); diffuseColor.rgb *= vec3(.84+.3*g1+.1*g2,.86+.26*g1+.12*g2,.8+.2*g1);',
    // window frames: brushed metal -- fine streaks run along the grain (horizontal on sills and heads, vertical on jambs)
    brushed: NRM + 'float gr = abs(nw.y) > .5 ? nbN(vec2(vNbW.x*60.+vNbW.z*60., vNbW.z*4.+vNbW.x*4.)) : nbN(vec2((vNbW.x+vNbW.z)*3., vNbW.y*90.)); float gr2 = nbN(vec2((vNbW.x+vNbW.z)*9., vNbW.y*140.)); diffuseColor.rgb *= .82+.22*gr+.1*gr2;',
    // canal water: green-teal Venetian water with drifting ripples and sun glints (vlT is the time in seconds)
    water: 'vec2 wp = vNbW.xz; float r1 = nbN(wp*.9 + vec2(vlT*.35, vlT*.12)), r2 = nbN(wp*2.3 - vec2(vlT*.2, vlT*.45)), r3 = nbN(wp*.12 + vlT*.03);\n' +
      'float rip = r1*.55 + r2*.45; vec3 deep = vec3(.16,.36,.36), lite = vec3(.38,.6,.56); vec3 c = mix(deep, lite, smoothstep(.25,.85,rip*.7+r3*.5));\n' +
      'c += vec3(.3,.34,.32) * smoothstep(.88,1.,r1*r2*1.8); c *= .92+.1*sin(wp.x*1.7+wp.y*1.1+vlT*1.3+r2*4.); diffuseColor.rgb = c;'
  };
  var TIME = { value: 0 }; (function tick() { TIME.value = performance.now() / 1000; requestAnimationFrame(tick); })();
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.sketchStyle && window.sketchStyle.patch; }
  var tries = 0; (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Venice look skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();
  // The glazing comes out of the export as one mesh in which every window's pane and frame are fused. Broad sheets stay glass;
  // narrow strips, reveals and tiny faces become the frame, in its own material.
  function splitGlazing(o, frameMat) {
    o.updateMatrixWorld(); var g = o.geometry, p = g.attributes.position, ix = g.index ? g.index.array : null; if (!ix) return null; var m = o.matrixWorld.elements, glass = [], frame = [];
    function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
    // windows are connected pieces (vertices welded by position). In each piece the glass is the face-on sheet: the triangles lying in
    // the one plane that holds the most area (within 1.2 cm) and facing the same way; the rim, reveals and sash are everything else
    var nv = p.count, par = new Int32Array(nv), key = new Map(); for (var i = 0; i < nv; i++) { var w = V(i), k = Math.round(w[0] * 200) + ',' + Math.round(w[1] * 200) + ',' + Math.round(w[2] * 200), r0 = key.get(k); if (r0 === undefined) { key.set(k, i); par[i] = i; } else par[i] = r0; }
    function f(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    var nt = ix.length / 3; for (var t0 = 0; t0 < nt; t0++) { var q = f(ix[t0 * 3]); par[f(ix[t0 * 3 + 1])] = q; par[f(ix[t0 * 3 + 2])] = q; }
    var TN = new Float32Array(nt * 3), TD = new Float32Array(nt * 3), TA = new Float32Array(nt), groups = new Map();
    for (var t = 0; t < nt; t++) {
      var a = V(ix[t * 3]), b = V(ix[t * 3 + 1]), c = V(ix[t * 3 + 2]), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; TA[t] = l / 2; nx /= l; ny /= l; nz /= l;
      if (nx < -1e-4 || (Math.abs(nx) < 1e-4 && (ny < -1e-4 || (Math.abs(ny) < 1e-4 && nz < 0)))) { nx = -nx; ny = -ny; nz = -nz; }   // opposite faces of one sheet share a direction
      TN[t * 3] = nx; TN[t * 3 + 1] = ny; TN[t * 3 + 2] = nz; TD[t * 3] = (a[0] + b[0] + c[0]) / 3; TD[t * 3 + 1] = (a[1] + b[1] + c[1]) / 3; TD[t * 3 + 2] = (a[2] + b[2] + c[2]) / 3;
      var rt = f(ix[t * 3]), L2 = groups.get(rt); if (!L2) groups.set(rt, L2 = []); L2.push(t);
    }
    var isGlass = new Uint8Array(nt);
    groups.forEach(function (L) {
      var dirs = new Map(); L.forEach(function (t) { var k = Math.round(TN[t * 3] * 12) + ',' + Math.round(TN[t * 3 + 1] * 12) + ',' + Math.round(TN[t * 3 + 2] * 12); dirs.set(k, (dirs.get(k) || 0) + TA[t]); });
      var bk = null, ba = 0; dirs.forEach(function (a2, k) { if (a2 > ba) { ba = a2; bk = k; } }); if (!bk) return; var nd = bk.split(',').map(Number); var nl = Math.hypot(nd[0], nd[1], nd[2]) || 1; nd = [nd[0] / nl, nd[1] / nl, nd[2] / nl];
      var planes = new Map(); L.forEach(function (t) { if (TN[t * 3] * nd[0] + TN[t * 3 + 1] * nd[1] + TN[t * 3 + 2] * nd[2] < .985) return; var d = Math.round((TD[t * 3] * nd[0] + TD[t * 3 + 1] * nd[1] + TD[t * 3 + 2] * nd[2]) * 83); planes.set(d, (planes.get(d) || 0) + TA[t]); });
      var bp = null, pa = 0; planes.forEach(function (a2, d) { var s = a2 + (planes.get(d - 1) || 0) + (planes.get(d + 1) || 0); if (s > pa) { pa = s; bp = d; } });
      L.forEach(function (t) { if (TN[t * 3] * nd[0] + TN[t * 3 + 1] * nd[1] + TN[t * 3 + 2] * nd[2] < .985) return; var d = Math.round((TD[t * 3] * nd[0] + TD[t * 3 + 1] * nd[1] + TD[t * 3 + 2] * nd[2]) * 83); if (Math.abs(d - bp) <= 1) isGlass[t] = 1; });
    });
    for (var t3 = 0; t3 < nt; t3++) (isGlass[t3] ? glass : frame).push(ix[t3 * 3], ix[t3 * 3 + 1], ix[t3 * 3 + 2]);
    if (!frame.length) return null;
    function geo(L) { var ng = new (g.constructor)(); Object.keys(g.attributes).forEach(function (k) { ng.setAttribute(k, g.attributes[k]); }); ng.setIndex(new (g.index.constructor)(p.count > 65535 ? new Uint32Array(L) : new Uint16Array(L), 1)); ng.boundingBox = g.boundingBox; ng.boundingSphere = g.boundingSphere; return ng; }
    var fm = new (o.constructor)(geo(frame), frameMat); fm.name = o.name + '_frame'; fm.position.copy(o.position); fm.quaternion.copy(o.quaternion); fm.scale.copy(o.scale); fm.castShadow = true; fm.receiveShadow = true; o.parent.add(fm);
    o.geometry = geo(glass); return [glass.length / 3, frame.length / 3];
  }
  // Sorts a mesh's triangles by the connected piece (vertices welded by position) they belong to: classify(box) is given each piece's
  // world box [minx,miny,minz,maxx,maxy,maxz] and returns a label (or null to leave it). Returns { label: [indices] }.
  function byPiece(o, classify) {
    o.updateMatrixWorld(); var g = o.geometry, p = g.attributes.position, ix = g.index ? g.index.array : null; if (!ix) return {}; var m = o.matrixWorld.elements, nv = p.count, par = new Int32Array(nv), key = new Map();
    function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
    for (var i = 0; i < nv; i++) { var w = V(i), k = Math.round(w[0] * 200) + ',' + Math.round(w[1] * 200) + ',' + Math.round(w[2] * 200), r0 = key.get(k); if (r0 === undefined) { key.set(k, i); par[i] = i; } else par[i] = r0; }
    function f(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    for (var t = 0; t < ix.length; t += 3) { var q = f(ix[t]); par[f(ix[t + 1])] = q; par[f(ix[t + 2])] = q; }
    var S = new Map(); for (var t2 = 0; t2 < ix.length; t2 += 3) { var rt = f(ix[t2]), s = S.get(rt); if (!s) S.set(rt, s = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]); for (var j = 0; j < 3; j++) { var v = V(ix[t2 + j]); for (var a = 0; a < 3; a++) { if (v[a] < s[a]) s[a] = v[a]; if (v[a] > s[a + 3]) s[a + 3] = v[a]; } } }
    var lab = new Map(); S.forEach(function (b, r) { lab.set(r, classify(b)); });
    var out = {}; for (var t3 = 0; t3 < ix.length; t3 += 3) { var l = lab.get(f(ix[t3])); if (l) (out[l] || (out[l] = [])).push(ix[t3], ix[t3 + 1], ix[t3 + 2]); }
    return out;
  }
  // moves the given triangles of mesh o into a new mesh with material mat; o keeps the rest
  function carve(o, L, mat, name) {
    var g = o.geometry, p = g.attributes.position, big = p.count > 65535, rest = [], take = new Set();
    function geo(arr) { var ng = new (g.constructor)(); Object.keys(g.attributes).forEach(function (k) { ng.setAttribute(k, g.attributes[k]); }); ng.setIndex(new (g.index.constructor)(big ? new Uint32Array(arr) : new Uint16Array(arr), 1)); ng.boundingBox = g.boundingBox; ng.boundingSphere = g.boundingSphere; return ng; }
    for (var i = 0; i < L.length; i += 3) take.add(L[i] + ',' + L[i + 1] + ',' + L[i + 2]);
    var ix = g.index.array; for (var t = 0; t < ix.length; t += 3) if (!take.has(ix[t] + ',' + ix[t + 1] + ',' + ix[t + 2])) rest.push(ix[t], ix[t + 1], ix[t + 2]);
    var nm = new (o.constructor)(geo(L), mat); nm.name = name; nm.position.copy(o.position); nm.quaternion.copy(o.quaternion); nm.scale.copy(o.scale); nm.castShadow = true; nm.receiveShadow = true; o.parent.add(nm); o.geometry = geo(rest); return nm;
  }
  // a patched material with a world-space shader snippet
  function shaded(like, name, color, code, extra) {
    var m = new (like.constructor)(); m.name = name; m.color.set(color); m.roughness = .85; m.metalness = 0; m.side = 2; if (extra) extra(m); window.sketchStyle.patch(m); var prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
    m.onBeforeCompile = function (shader, renderer) { if (prev) prev.call(this, shader, renderer); shader.vertexShader = 'varying vec3 vNbW;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbW = (modelMatrix * vec4(transformed, 1.0)).xyz;'); shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + code); };
    m.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + '-vl-' + name; }; m.needsUpdate = true; return m;
  }
  function brushedMaterial(like, silver) {
    var m = new (like.constructor)(); m.name = 'Window frame / brushed metal'; m.color.set(silver); m.roughness = .5; m.metalness = .12; m.side = 2;   // low metalness: with no reflections to pick up, real metal renders black
    window.sketchStyle.patch(m); var prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
    m.onBeforeCompile = function (shader, renderer) { if (prev) prev.call(this, shader, renderer); shader.vertexShader = 'varying vec3 vNbW;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbW = (modelMatrix * vec4(transformed, 1.0)).xyz;'); shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + CODE.brushed); };
    m.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + '-vl-brushed'; }; m.needsUpdate = true; return m;
  }
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, own = {};
    // the export shares materials across groups (the main apartment and the partner buildings use the same ones, and the city's lawns
    // and canals use its plaster), so every group/material pair gets a fresh material of its own (fresh, not a clone: a clone would carry
    // the watercolor patch twice)
    var list = []; scene.traverse(function (o) { if (o.isMesh && !(o.userData && o.userData.skEdge)) list.push(o); });
    list.forEach(function (o) {
      var mm = /^(.*)__([A-Za-z]+)$/.exec(o.name || ''); if (!mm || !PAL[mm[2]]) return;
      var grp = mm[1], key = mm[2], role = /^Main_apartment/.test(grp) ? 'main' : /^Team_buildings/.test(grp) ? 'team' : 'city', old = o.material; if (!old || Array.isArray(old)) return;
      var id = role + '/' + key, m = own[id];
      if (!m) {
        m = own[id] = new (old.constructor)(); m.name = (role === 'city' ? 'Site context / ' : role === 'main' ? 'Main apartment / ' : 'Team buildings / ') + key; m.side = old.side;
        var p = PAL[key]; m.color.set(p.c); m.roughness = p.r; m.metalness = p.m || 0; if (p.o) { m.transparent = true; m.opacity = p.o; m.depthWrite = false; m.side = 2; }
        if (key === 'Metal' && role === 'main') m.color.set('#2a3133');
        if (role === 'team') { if (key === 'Metal') m.color.set('#8d9496'); if (key === 'Stone') m.color.set('#d7d1c5'); if (key === 'Glazing') { m.color.set('#b8d0da'); m.opacity = .5; } if (key === 'Brick') m.color.set('#c9927c'); }
        if (key === 'Water') { m.roughness = .12; m.metalness = .05; m.opacity = .96; }
        // lawns and canals are not part of the study model: named apart from the context, so the washes keep their colour
        if (role === 'city' && (key === 'Water' || key === 'Landscape')) m.name = key === 'Water' ? 'Venice canal water' : 'Venice lawn';
        if (role === 'team') m.userData.skSoft = .72;   // the partner buildings: a light wash only, the main apartment carries the colour
        window.sketchStyle.patch(m);
        var code = key === 'Plaster' ? CODE[role + 'Plaster'] : key === 'Brick' ? CODE.brick : key === 'Stone' && role !== 'team' ? CODE.stone : key === 'Landscape' ? CODE.grass : key === 'Water' ? CODE.water : null;
        if (code) (function (m, code, tag) {
          var prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
          m.onBeforeCompile = function (shader, renderer) {
            if (prev) prev.call(this, shader, renderer); shader.uniforms.vlT = TIME;
            shader.vertexShader = 'varying vec3 vNbW;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            shader.fragmentShader = 'uniform float vlT;\n' + FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + code);
          };
          m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + tag; };
        })(m, code, '-vl-' + id);
        m.needsUpdate = true;
      }
      o.material = m; if (key === 'Water') { o.renderOrder = 1; o.receiveShadow = true; }
    });
    // window frames: brushed metal (a lighter silver on the two partner buildings)
    var bm = { main: brushedMaterial(list[0].material, '#c4cacf'), team: brushedMaterial(list[0].material, '#dde0e2') }; window.veniceFrames = {};
    list.forEach(function (o) { var q = /^(Main_apartment|Team_buildings)__Glazing$/.exec(o.name || ''); if (q) { var r = splitGlazing(o, bm[q[1] === 'Main_apartment' ? 'main' : 'team']); if (r) window.veniceFrames[q[1]] = r; } });
    // courtyard trees: flat cut-out cards that the export painted with the wall material -- tall, wide, paper-thin pieces -> foliage
    var FOLIAGE = shaded(list[0].material, 'Venice foliage', '#5d8e43', 'float lf = nbN(vNbW.xz*2.6+vNbW.y*1.9), lf2 = nbN(vNbW.xz*9.+vNbW.y*6.); diffuseColor.rgb = mix(vec3(.30,.50,.20), vec3(.50,.68,.28), lf)*(.82+.3*lf2)*(.78+.3*smoothstep(0.,14.,vNbW.y));', function (m) { m.userData.skKeep = .9; });
    window.veniceTrees = 0;
    list.forEach(function (o) { if (!/^(Main_apartment|Team_buildings)__Plaster$/.test(o.name || '')) return;
      var B = byPiece(o, function (b) { var dy = b[4] - b[1], dx = b[3] - b[0], dz = b[5] - b[2], hz = Math.max(dx, dz), th = Math.min(dx, dz); return th < .03 && dy > 1.2 && hz > 1.2 ? 'tree' : null; });
      if (B.tree) { var tm = carve(o, B.tree, FOLIAGE, o.name + '_trees'); window.veniceTrees += B.tree.length / 3; } });
    // wood louvers: the pergola frames on the roof terraces and the louvered entrance wall are wood in the Revit model ("Wood Planks"),
    // but the export painted them with the wall and metal materials. Their boxes come from Revit (Pergola_-_Parametric elements and
    // "Walls 2", moved into page metres with the model's stored fit); every piece of the main apartment lying inside one is wood
    // (inside the entrance-wall box only the slender slats, so the walls behind stay brick)
    var PERG = [[163.3,16.5,-220.8,170.7,19.8,-217.2],[163.3,16.5,-210.8,170.7,19.8,-209.3],[167.2,16.5,-209.5,180,19.8,-206.5],[163.3,16.5,-197.6,170.7,19.8,-194.3],[163.3,16.5,-187.9,170.7,19.8,-186.7],[167.2,16.5,-200.4,180,19.8,-197.4],[167.2,16.5,-206.5,180.4,19.8,-203.4],[167.2,16.5,-203.4,180.4,19.8,-200.4]], LWALL = [163.4,5.2,-209.2,167.4,16.5,-197.2], PAD = .45;
    function inBox(b, q) { return b[0] >= q[0] - PAD && b[1] >= q[1] - PAD && b[2] >= q[2] - PAD && b[3] <= q[3] + PAD && b[4] <= q[4] + PAD && b[5] <= q[5] + PAD; }
    var WOOD = shaded(list[0].material, 'Venice wood louvers', '#93603a', 'float wg = nbN(vec2((vNbW.x+vNbW.z)*2.2, vNbW.y*55.))*.5 + nbN(vec2((vNbW.x+vNbW.z)*55., vNbW.y*2.2))*.5; float wk = nbN(vec2((vNbW.x+vNbW.z)*14., vNbW.y*.9)); diffuseColor.rgb = mix(vec3(.40,.24,.12), vec3(.60,.38,.20), wk) * (.84+.3*wg);', function (m) { m.roughness = .7; });
    window.veniceWood = 0;
    list.forEach(function (o) { if (!/^(Main_apartment|Team_buildings)__(Plaster|Metal|Stone)$/.test(o.name || '')) return;
      var B = byPiece(o, function (b) { var dx = b[3] - b[0], dz = b[5] - b[2], dy = b[4] - b[1];
        for (var i = 0; i < PERG.length; i++) if (inBox(b, PERG[i])) return 'wood';
        if (inBox(b, LWALL) && Math.min(dx, dz) < .45 && (dy > 1.2 || Math.max(dx, dz) > 1.2)) return 'wood'; return null; });
      if (B.wood) { carve(o, B.wood, WOOD, o.name + '_wood'); window.veniceWood += B.wood.length / 3; } });
    if (scene.background && scene.background.isColor) scene.background.set('#dbe6ee');
    ctx.controls.dispatchEvent({ type: 'change' });
  }
})();
