/* North Beach Youth Center: real-looking materials. The model's surfaces are flat single colours (stone and plaster even share one),
   so each material gets its true colour, roughness and metalness, the glass and water become see-through, and a faint world-space
   variation (grass mottling, paving joints, timber grain, plaster staining) breaks the flat fills up. The same colours feed the
   Watercolor wash, which keeps each material's hue, so the washes read as stone, plaster, timber, glass, grass and water. */
(function () {
  var PAL = {
    Stone: { c: '#b4ada0', r: .88 }, Plaster: { c: '#ece6d8', r: .93 }, Metal: { c: '#5b6b66', r: .42, m: .3 },
    Landscape: { c: '#7f8b66', r: 1 }, Timber: { c: '#a06a38', r: .7 }, Planting: { c: '#66744f', r: 1 },   /* muted, dusty greens */
    Glazing: { c: '#86b6c8', r: .05, m: .1, o: .5 }, Water: { c: '#2f8fb0', r: .04, o: .8 }, Context: { c: '#dedcd5', r: .95 }
  };
  // [grain scale, strength] and the pattern, per material
  var VAR = { Landscape: 'skate', Planting: 'grass', Stone: 'paving', Plaster: 'stain', Timber: 'grain', Context: 'paving' };
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.sketchStyle && window.sketchStyle.patch; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Youth center look skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();
  var FRAG_HEAD = 'varying vec3 vNbW;\n' +
    'float nbH(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n' +
    'float nbN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(nbH(i),nbH(i+vec2(1.,0.)),f.x),mix(nbH(i+vec2(0.,1.)),nbH(i+vec2(1.,1.)),f.x),f.y); }\n';
  /* massing model for the site context: everything outside the site block and above grade reads as a physical study model --
     1 white card, 2 basswood, 3 grey chipboard (0 off) -- with faint floor and window scoring on walls and a dark ink line at
     every crease (where the face normal changes inside a pixel). Shared with nbyc-ifc.js through window.NBYC_MASS. */
  window.NBYC_MASS = window.NBYC_MASS || { u: { value: 2 }, glsl:   // 2: basswood, chosen
    'if (uMass > .5) { vec3 mw = vNbW; bool outSite = (mw.x < -95. || mw.x > 9.5 || mw.z < 17.5 || mw.z > 78.2) && mw.y > 34.75;\n' +
    ' if (outSite) { vec3 n2 = normalize(cross(dFdx(mw), dFdy(mw)));\n' +
    '  vec3 base = uMass < 1.5 ? vec3(.95,.94,.91) : (uMass < 2.5 ? vec3(.91,.84,.70) : vec3(.62,.61,.59));\n' +
    '  float gr = uMass < 1.5 ? .98 + .03*nbN(mw.xz*.4) : (uMass < 2.5 ? .9 + .12*nbN(vec2((mw.x + mw.z)*.7, mw.y*16.)) : .9 + .1*nbH(floor(mw.xz*18. + mw.y*18.)));\n' +
    '  vec3 cm = base * gr;\n' +
    '  if (abs(n2.y) < .5) { float fy = fract((mw.y - 34.6) / 3.1); float fl = 1. - smoothstep(0., .035, min(fy, 1. - fy)); float fw = fract((mw.x + mw.z) / 3.6); float wv = 1. - smoothstep(0., .03, min(fw, 1. - fw)); cm *= 1. - .14*fl - .07*wv; }\n' +
    '  float e = length(fwidth(n2)); cm = mix(cm, vec3(.09,.09,.1), smoothstep(.2, .55, e));\n' +
    '  diffuseColor.rgb = cm; } }\n' };
  var CODE = {
    grass: 'float g1=nbN(vNbW.xz*.45), g2=nbN(vNbW.xz*2.6); diffuseColor.rgb *= vec3(.84+.30*g1+.12*g2, .86+.26*g1+.14*g2, .82+.2*g1); diffuseColor.rgb += vec3(.03,.02,-.02)*(g2-.5);',
    // no tile grid: plain warm sidewalk, and dark asphalt with dashed centre lines on the streets (the same road lines the cars drive)
    paving: 'vec3 nw=normalize(cross(dFdx(vNbW),dFdy(vNbW))); diffuseColor.rgb = (nw.y>.8 && vNbW.y<37.5 ? vec3(.85,.8,.71) : diffuseColor.rgb)*(.94+.08*nbN(vNbW.xz*.5)+.03*nbN(vNbW.xz*4.));\n' +
      'if (nw.y>.8 && vNbW.y<37.5) { float x=vNbW.x, z=vNbW.z, W=5.2; float dv=min(abs(x+100.)+step(83.6+W,z)*99.+step(z,-23.-W)*99., abs(x-14.5)+step(83.6+W,z)*99.+step(z,-23.-W)*99.);\n' +
      ' float dh=min(min(abs(z+23.)+step(80.,x)*99.+step(x,-140.)*99., abs(z-83.6)+step(80.,x)*99.+step(x,-140.)*99.), abs(z-12.5)+step(14.5,x)*99.+step(x,-100.)*99.);\n' +
      ' float d=min(dv,dh); if (d<W) { vec3 asp=vec3(.24,.25,.26)*(.88+.16*nbN(vNbW.xz*3.)+.06*nbH(floor(vNbW.xz*40.))); float along = dv<dh ? z : x; float dash=step(fract(along/6.),.5)*step(d,.12); diffuseColor.rgb=mix(asp,vec3(.93,.92,.86),dash); } }',
    stain: 'diffuseColor.rgb *= .93+.1*nbN(vNbW.xz*.35+vNbW.y*.5) + .03*(nbN(vec2(vNbW.x*3.+vNbW.z*3.,vNbW.y*.4))-.5);',
    skate: 'if (vNbW.y < 34.6) { vec3 nw=normalize(cross(dFdx(vNbW),dFdy(vNbW))); vec2 p = abs(nw.y)>.8 ? vNbW.xz : vec2(vNbW.x+vNbW.z, vNbW.y*2.);\n' +
      'vec3 con=vec3(.68,.67,.64)*(.9+.14*nbN(p*1.1)+.07*nbN(p*6.)); vec2 jq=p/3.; vec2 jf=abs(fract(jq)-.5); con*=1.-.16*smoothstep(.47,.5,max(jf.x,jf.y));\n' +
      'vec2 q=p*.38; vec2 id=floor(q), f=fract(q); float h=nbH(id*3.3+1.7), h2=nbH(id*5.1+9.2); float on=0.;   /* graffiti now lives only on the Revit skate park surfaces */\n' +
      'vec3 gc = h2<.25?vec3(.92,.22,.5):(h2<.5?vec3(.18,.62,.92):(h2<.75?vec3(.97,.82,.15):vec3(.35,.82,.4)));\n' +
      'float cur=.5+.26*sin(f.x*10.+h*25.); float stroke=smoothstep(.1,.05,abs(f.y-cur))*step(f.x,.9)*step(.1,f.x); float blob=smoothstep(.36,.3,length((f-.5)*vec2(1.,1.4)+vec2(.12*sin(h*30.),0.)));\n' +
      'float m=on*(h2<.5?stroke:blob*.85); float edge=on*(h2<.5?smoothstep(.17,.1,abs(f.y-cur))-stroke:smoothstep(.42,.34,length((f-.5)*vec2(1.,1.4)+vec2(.12*sin(h*30.),0.)))-blob);\n' +
      'con=mix(con,vec3(.1,.1,.12),clamp(edge,0.,1.)*.8); con=mix(con,gc,clamp(m,0.,1.)); diffuseColor.rgb=con; }\n' +
      'else { float g1=nbN(vNbW.xz*.45), g2=nbN(vNbW.xz*2.6); diffuseColor.rgb *= vec3(.84+.30*g1+.12*g2, .86+.26*g1+.14*g2, .82+.2*g1); diffuseColor.rgb += vec3(.03,.02,-.02)*(g2-.5); }',
    grain: 'float gr=nbN(vec2((vNbW.x+vNbW.z)*1.3, vNbW.y*26.)); float pl=step(.5,fract((vNbW.x+vNbW.z)*3.2)); diffuseColor.rgb *= (.82+.3*gr)*(.94+.08*pl);'
  };
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, done = new WeakSet();
    scene.traverse(function (o) {
      if (!o.isMesh || (o.userData && o.userData.skEdge)) return;
      var key = /__([A-Za-z]+)$/.exec(o.name || ''); if (!key || !PAL[key[1]]) return; key = key[1];
      var m = o.material; if (!m || Array.isArray(m) || done.has(m)) return; done.add(m);
      var p = PAL[key]; m.color.set(p.c); m.roughness = p.r; m.metalness = p.m || 0;
      if (p.o) { m.transparent = true; m.opacity = p.o; m.depthWrite = false; m.side = 2; }
      window.sketchStyle.patch(m);   // the wash shader first, so the variation sits on top of it
      var code = (CODE[VAR[key]] || '') + '\n' + window.NBYC_MASS.glsl;
      if (code) {
        var prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
        m.onBeforeCompile = function (shader, renderer) {
          if (prev) prev.call(this, shader, renderer);
          shader.vertexShader = 'varying vec3 vNbW;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          shader.uniforms.uMass = window.NBYC_MASS.u;
          shader.fragmentShader = 'uniform float uMass;\n' + FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + code);
        };
        m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '-nb-' + key; };
      }
      m.needsUpdate = true;
    });
    ctx.controls.dispatchEvent({ type: 'change' });
  }
  /* Glass from the model's own faces (nothing is added): the funnels under the round roof openings are steel torus rings with panels
     between them (they carry the roof and shed water to the catch basin), and the east pod's roof has grid cells. Those panels sit in
     the Plaster mesh, so the faces seen from above inside each opening are moved to a second material slot, the model's Glazing. */
  function glassPanels(ctx, scene) {
    var plaster = null, timber = null, glaz = null;
    scene.traverse(function (o) { if (!o.isMesh || (o.userData && o.userData.skEdge)) return; if (o.name === 'Youth_center__Plaster') plaster = o; else if (o.name === 'Youth_center__Timber') timber = o; else if (o.name === 'Youth_center__Glazing' && !glaz) glaz = o; });
    if (!plaster || !glaz) return;
    var AREAS = [], total = 0, pod = [-28.5, 27.8];
    [plaster, timber].forEach(function (m) { if (m && m.geometry.index && !Array.isArray(m.material)) total += glassMesh(m); });
    window.nbycGlassFaces = total;
    function glassMesh(plaster) {
    var g = plaster.geometry, P = g.attributes.position, I = g.index, ia = I.array, n = I.count / 3, CS = .35; plaster.updateWorldMatrix(true, false); var E = plaster.matrixWorld.elements;
    function w(i) { var x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [E[0] * x + E[4] * y + E[8] * z + E[12], E[1] * x + E[5] * y + E[9] * z + E[13], E[2] * x + E[6] * y + E[10] * z + E[14]]; }
    var cx = new Float32Array(n), cy = new Float32Array(n), cz = new Float32Array(n), ny = new Float32Array(n);
    for (var t = 0; t < n; t++) {
      var a = w(ia[t * 3]), b = w(ia[t * 3 + 1]), d = w(ia[t * 3 + 2]), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      var nx = uy * vz - uz * vy, yy = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, yy, nz) || 1;
      cx[t] = (a[0] + b[0] + d[0]) / 3; cy[t] = (a[1] + b[1] + d[1]) / 3; cz[t] = (a[2] + b[2] + d[2]) / 3; ny[t] = Math.abs(yy / l);
    }
    // the pod roof's grid cells: empty areas of the roof deck seen from above (the deck's up-facing faces, every mesh, rasterised)
    var cells = [];
    if (!AREAS.cells) try {
      var X0 = -52, Z0 = 8, C = .5, NX = 70, NZ = 70, occ = new Uint8Array(NX * NZ), deckY = 45;
      scene.traverse(function (o) {
        if (!o.isMesh || (o.userData && o.userData.skEdge) || !o.geometry.index || !/^Youth_center__/.test(o.name)) return;
        var G = o.geometry, PP = G.attributes.position, II = G.index; o.updateWorldMatrix(true, false); var e = o.matrixWorld.elements;
        function ww(i) { var x = PP.getX(i), y = PP.getY(i), z = PP.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
        for (var k = 0; k < II.count; k += 3) {
          var a = ww(II.getX(k)), b = ww(II.getX(k + 1)), c = ww(II.getX(k + 2)); if (Math.min(a[1], b[1], c[1]) < deckY - .6 || Math.max(a[1], b[1], c[1]) > deckY + .6) continue;
          var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nxx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nzz = ux * vy - uy * vx; if (nyy / (Math.hypot(nxx, nyy, nzz) || 1) < .95) continue;
          var x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), z0 = Math.min(a[2], b[2], c[2]), z1 = Math.max(a[2], b[2], c[2]); if (x1 < X0 || z1 < Z0 || x0 > X0 + NX * C || z0 > Z0 + NZ * C) continue;
          var dd = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(dd) < 1e-9) continue;
          for (var ix = Math.max(0, Math.floor((x0 - X0) / C)); ix <= Math.min(NX - 1, Math.floor((x1 - X0) / C)); ix++) for (var iz = Math.max(0, Math.floor((z0 - Z0) / C)); iz <= Math.min(NZ - 1, Math.floor((z1 - Z0) / C)); iz++) {
            var x = X0 + (ix + .5) * C, z = Z0 + (iz + .5) * C, l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / dd, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / dd, l3 = 1 - l1 - l2; if (l1 >= -.02 && l2 >= -.02 && l3 >= -.02) occ[iz * NX + ix] = 1;
          }
        }
      });
      var o2 = occ.slice(); for (var qz = 1; qz < NZ - 1; qz++) for (var qx = 1; qx < NX - 1; qx++) { var qi = qz * NX + qx; if (!occ[qi] && (occ[qi - 1] || occ[qi + 1] || occ[qi - NX] || occ[qi + NX])) o2[qi] = 1; } occ = o2;
      var lab = new Int32Array(NX * NZ).fill(-1);
      for (var s = 0; s < occ.length; s++) {
        if (occ[s] || lab[s] >= 0) continue; var st = [s], cnt = 0, sx = 0, sz = 0, mnx = 1e9, mxx = -1, mnz = 1e9, mxz = -1, edge = false; lab[s] = 1;
        while (st.length) { var v = st.pop(), ix2 = v % NX, iz2 = (v / NX) | 0; cnt++; sx += ix2; sz += iz2; mnx = Math.min(mnx, ix2); mxx = Math.max(mxx, ix2); mnz = Math.min(mnz, iz2); mxz = Math.max(mxz, iz2); if (ix2 === 0 || iz2 === 0 || ix2 === NX - 1 || iz2 === NZ - 1) edge = true;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dv) { var jx = ix2 + dv[0], jz = iz2 + dv[1]; if (jx < 0 || jz < 0 || jx >= NX || jz >= NZ) return; var j = jz * NX + jx; if (!occ[j] && lab[j] < 0) { lab[j] = 1; st.push(j); } }); }
        var area = cnt * C * C, ccx = X0 + (sx / cnt + .5) * C, ccz = Z0 + (sz / cnt + .5) * C;
        if (!edge && area > .3 && area < 40 && Math.hypot(ccx - pod[0], ccz - pod[1]) > 7.5) cells.push({ x0: X0 + mnx * C - .45, x1: X0 + (mxx + 1) * C + .45, z0: Z0 + mnz * C - .45, z1: Z0 + (mxz + 1) * C + .45, top: deckY });
      }
    } catch (e) { console.warn('pod roof cells skipped', e); }
    AREAS = [
      { inside: function (x, z) { return Math.hypot(x + 11.1, z - 53.4) < 7.9; }, top: 53.15 },
      { inside: function (x, z) { return Math.hypot(x + 76.4, z - 53.4) < 7.9; }, top: 53.15 },
      { inside: function (x, z) { return Math.hypot(x - pod[0], z - pod[1]) < 5.9; }, top: 45 }
    ].concat(cells.map(function (r) { return { inside: function (x, z) { return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }, top: r.top }; }));
    var pick = new Uint8Array(n);
    AREAS.forEach(function (A) {
      var hm = {}, idx = [];
      for (var t = 0; t < n; t++) { if (cy[t] > A.top - .6 || cy[t] < A.top - 22 || !A.inside(cx[t], cz[t])) continue; idx.push(t); var k = Math.round(cx[t] / CS) + ',' + Math.round(cz[t] / CS); if (hm[k] === undefined || cy[t] > hm[k]) hm[k] = cy[t]; }
      idx.forEach(function (t) { var k = Math.round(cx[t] / CS) + ',' + Math.round(cz[t] / CS); if (cy[t] >= hm[k] - (ny[t] < .5 ? 6 : .7)) pick[t] = 1; });
    });
    var keep = [], glass = []; for (var t2 = 0; t2 < n; t2++) (pick[t2] ? glass : keep).push(t2);
    if (!glass.length) return 0;
    var src = ia.slice(), pos = 0;
    keep.forEach(function (t) { ia[pos++] = src[t * 3]; ia[pos++] = src[t * 3 + 1]; ia[pos++] = src[t * 3 + 2]; });
    glass.forEach(function (t) { ia[pos++] = src[t * 3]; ia[pos++] = src[t * 3 + 1]; ia[pos++] = src[t * 3 + 2]; });
    I.needsUpdate = true; g.clearGroups(); g.addGroup(0, keep.length * 3, 0); g.addGroup(keep.length * 3, glass.length * 3, 1);
    plaster.material = [plaster.material, glaz.material];
    return glass.length;
    }
  }
})();
