/* North Beach Youth Center from the Revit model itself: the IFC export is converted (tools in _source-models/) into ifc-model.bin, one
   mesh per material category with every Revit element kept as its own triangle range (elements.json). This swaps the building parts of
   the old FBX for that geometry, using the page's own materials, so glass, timber, steel and concrete come straight from Revit.
   The funnels' screen panels (Revit material "White") are drawn as glass. The city context, landscape and water stay from the old model. */
(function () {
  var URL_MAIN = 'revit-main.bin.gz?v=4', URL_DETAIL = 'revit-detail.bin.gz?v=4';   // exported straight from Revit (tools in _source-models/)
  var MAT_OF = { Stone: 'Stone', Metal: 'Metal', Plaster: 'Plaster', Timber: 'Timber', Glazing: 'Glazing', Planting: 'Planting', ScreenPanel: 'Glazing', Other: 'Plaster' };
  var REPLACES = ['Stone', 'Metal', 'Plaster', 'Timber', 'Glazing', 'Planting', 'Landscape'];   // the skate bowl now comes from Revit too
  /* Normals per triangle corner, smoothed across neighbouring faces that meet at less than about 35 degrees: curved surfaces (round
     columns, the funnels, mullions) shade smoothly, while box edges and corners stay crisp. */
  function smoothNormals(p, ix, nv) {
    var nt = ix.length / 3, fn = new Float32Array(nt * 3), cnt = new Uint32Array(nv + 1), t, k, a, b, c;
    for (t = 0; t < nt; t++) {
      a = ix[t * 3] * 3; b = ix[t * 3 + 1] * 3; c = ix[t * 3 + 2] * 3;
      var ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx;   // length = 2 x area (area weighting)
      for (k = 0; k < 3; k++) cnt[ix[t * 3 + k] + 1]++;
    }
    for (k = 0; k < nv; k++) cnt[k + 1] += cnt[k];
    var fill = cnt.slice(0, nv), adj = new Uint32Array(nt * 3);
    for (t = 0; t < nt; t++) for (k = 0; k < 3; k++) adj[fill[ix[t * 3 + k]]++] = t;
    var N = new Float32Array(nt * 9), COS = .82;
    for (t = 0; t < nt; t++) {
      var fx = fn[t * 3], fy = fn[t * 3 + 1], fz = fn[t * 3 + 2], fl = Math.hypot(fx, fy, fz) || 1;
      for (k = 0; k < 3; k++) {
        var v = ix[t * 3 + k], sx = 0, sy = 0, sz = 0;
        for (var q = cnt[v]; q < cnt[v + 1]; q++) {
          var o = adj[q], gx = fn[o * 3], gy = fn[o * 3 + 1], gz = fn[o * 3 + 2], gl = Math.hypot(gx, gy, gz) || 1;
          if ((fx * gx + fy * gy + fz * gz) / (fl * gl) > COS) { sx += gx; sy += gy; sz += gz; }
        }
        var l = Math.hypot(sx, sy, sz); if (!l) { sx = fx; sy = fy; sz = fz; l = fl; }
        N[t * 9 + k * 3] = sx / l; N[t * 9 + k * 3 + 1] = sy / l; N[t * 9 + k * 3 + 2] = sz / l;
      }
    }
    return N;
  }
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.sketchStyle; }
  var tries = 0; (function wait() { if (ready()) setTimeout(run, 400); else if (tries++ < 600) setTimeout(wait, 150); })();
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, old = {};
    scene.traverse(function (o) { var m = o.isMesh && !(o.userData && o.userData.skEdge) && /^Youth_center__([A-Za-z]+)$/.exec(o.name || ''); if (m && !old[m[1]]) old[m[1]] = o; });
    var proto = old.Stone || old.Plaster; if (!proto) return;
    // the model's own attributes are interleaved/quantized; find the plain BufferAttribute class (index or its parent class)
    var pg = proto.geometry, Attr = null;
    [pg.index && pg.index.constructor, pg.index && Object.getPrototypeOf(pg.index.constructor), pg.attributes.normal && pg.attributes.normal.constructor].forEach(function (C) {
      if (Attr || typeof C !== 'function') return; try { var a = new Float32Array(4), p = new C(a, 2); if (p.array === a && p.itemSize === 2 && !p.data) Attr = C; } catch (e) {}
    });
    var Geo = pg.constructor, Mesh = proto.constructor; if (!Attr) { console.warn('IFC model: no attribute class'); return; }
    function mat(cat) { var o = old[cat] || old.Plaster, m = o.material; return Array.isArray(m) ? m[0] : m; }
    var mats = {}; Object.keys(MAT_OF).forEach(function (k) { mats[k] = k === 'Glazing' || k === 'ScreenPanel' ? (old.Glazing ? (Array.isArray(old.Glazing.material) ? old.Glazing.material[0] : old.Glazing.material) : mat('Plaster')) : mat(MAT_OF[k]); });
    // Revit materials: one page material per look (colour, transparency, gloss) taken from the Revit export
    var lookMats = {}, MatC = mat('Plaster').constructor;
    /* realistic surfaces, after the daytime renders: board-formed concrete with horizontal plank lines, paving with joints, dark asphalt,
       mottled grass, timber grain, brushed metal, and the skate park's concrete with graffiti in patches. World-space, no textures. */
    var HEAD = 'varying vec3 vNbW;\n' +
      'float nbH(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n' +
      'float nbN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(nbH(i),nbH(i+vec2(1.,0.)),f.x),mix(nbH(i+vec2(0.,1.)),nbH(i+vec2(1.,1.)),f.x),f.y); }\n';
    var NW = 'vec3 nw=normalize(cross(dFdx(vNbW),dFdy(vNbW)));\n';
    // vines trailing down from the roof canopy edge in uneven strands, as in the renders
    var VINE = '{ float vs=vNbW.x+vNbW.z; float col=floor(vs*1.4); float h=nbH(vec2(col,7.)); float len=.6+4.2*h*h*step(.25,nbH(vec2(col,3.)))+.5*nbN(vec2(vs*.2,2.));\n' +
      ' float y0=52.6; float fx=fract(vs*1.4); float strand=smoothstep(.5,.2,abs(fx-.5+.12*sin(vNbW.y*2.+h*9.)));\n' +
      // only inside the round roof openings (the interior circles), not around the canopy's outer edge
      ' float inV=max(step(length(vNbW.xz-vec2(-77.,53.)),7.5), step(length(vNbW.xz-vec2(-9.,54.)),7.))*step(vNbW.y,y0+1.2);\n' +
      ' float hang=smoothstep(y0-len-.3,y0-len+.3,vNbW.y)*mix(strand,1.,smoothstep(y0-.6,y0,vNbW.y)); vec2 lq=vec2(vs,vNbW.y)*8.;\n' +
      ' float leaf=step(.35,nbN(lq)+.3*hang); vec3 vc=mix(vec3(.16,.3,.12),vec3(.42,.6,.26),nbN(lq*2.1+4.));\n' +
      ' diffuseColor.rgb=mix(diffuseColor.rgb,vc,inV*hang*leaf); }\n';
    var SURF = {
      lattice: VINE,
      roof: 'vec2 rq=vNbW.xz/1.5; float seam=smoothstep(.47,.5,abs(fract(rq.x)-.5)); diffuseColor.rgb *= (1.-.08*seam)*(.93+.07*nbN(vNbW.xz*.6)+.03*nbN(vNbW.xz*7.));',
      concrete: NW + 'if (abs(nw.y)<.5) { float pl=fract(vNbW.y/.2); float line=smoothstep(.0,.06,pl)*smoothstep(1.,.94,pl); vec2 q=vec2(vNbW.x+vNbW.z,vNbW.y*6.); diffuseColor.rgb *= (.86+.1*line)*(.9+.12*nbN(q*.7)+.05*nbN(q*5.))*(.97+.05*nbH(vec2(floor(vNbW.y/.2),floor((vNbW.x+vNbW.z)/2.4)))); }\n' +
        'else { diffuseColor.rgb *= .9+.12*nbN(vNbW.xz*.9)+.05*nbN(vNbW.xz*6.); }',
      // flat ground: warm sand-coloured sidewalk (no tile grid), and dark asphalt with dashed centre lines along the street lines
      paving: NW + 'if (nw.y>.7) { diffuseColor.rgb = (vNbW.y<37.5 ? vec3(.84,.79,.7) : diffuseColor.rgb)*(.93+.08*nbN(vNbW.xz*.5))*(.96+.05*nbN(vNbW.xz*3.))*(.98+.03*nbH(floor(vNbW.xz*30.)));\n' +
        ' if (vNbW.y<37.5) { float x=vNbW.x, z=vNbW.z, W=5.2, BIG=99.; float dv=min(abs(x+100.), abs(x-14.5)) + (step(83.6+W,z)+step(z,-23.-W))*BIG;\n' +
        '  float dh=min(min(abs(z+23.), abs(z-83.6)) + (step(80.,x)+step(x,-140.))*BIG, abs(z-12.5) + (step(14.5,x)+step(x,-100.))*BIG);\n' +
        '  float d=min(dv,dh); if (d<W) { vec3 asp=vec3(.23,.24,.25)*(.88+.16*nbN(vNbW.xz*3.)+.06*nbH(floor(vNbW.xz*40.))); float along = dv<dh ? z : x; float dash=step(fract(along/6.),.5)*step(d,.12); diffuseColor.rgb=mix(asp,vec3(.93,.92,.86),dash); } } } else { diffuseColor.rgb *= .92+.1*nbN(vec2(vNbW.x+vNbW.z,vNbW.y)*2.); }',
      asphalt: 'diffuseColor.rgb *= .85+.18*nbN(vNbW.xz*3.)+.08*nbH(floor(vNbW.xz*40.));',
      grass: 'float g1=nbN(vNbW.xz*.45), g2=nbN(vNbW.xz*2.6), g3=nbH(floor(vNbW.xz*25.)); diffuseColor.rgb *= vec3(.82+.3*g1+.1*g2, .86+.26*g1+.12*g2, .8+.2*g1)*(.93+.1*g3);',
      // the building's own concrete: light board-formed panels, with a green wall of climbing vegetation wrapping the ground floor
      facade: NW + 'if (abs(nw.y)<.5) { float pl=fract(vNbW.y/.6); float line=smoothstep(.0,.03,pl)*smoothstep(1.,.97,pl); vec2 q=vec2(vNbW.x+vNbW.z,vNbW.y*4.); diffuseColor.rgb *= (.9+.08*line)*(.94+.07*nbN(q*.5)+.03*nbN(q*4.));\n' +
        // green at the foot of the building: about 2.8 m on the curved west end, tapering to a low ~0.7 m band elsewhere
        ' float s=vNbW.x+vNbW.z; float hfull=37.4, hlow=35.3; float ramp=smoothstep(-58.,-74.,vNbW.x); float top = mix(hlow, hfull, ramp)\n' +
        '   + mix(.15,.5,ramp)*nbN(vec2(s,0.)*.3) + .2*nbN(vec2(s,1.)*1.6) + .12*nbN(vec2(s,vNbW.y)*5.);\n' +
        // only the building's outer walls: faces on the outline of the main bar or the pod (rounded rectangles taken from the model).
        // Facing outward on the outline itself; where the facade steps in (entries, recesses) the green follows a few metres inward,
        // dropping lower the deeper it goes, and wraps onto side returns (jambs) too. The canopy's inside and the benches stay bare.
        ' vec2 pp=vNbW.xz; vec2 c1=vec2(clamp(pp.x,-76.79,-11.48),53.41); float d1=length(pp-c1)-12.82; vec2 c2=vec2(clamp(pp.x,-33.77,-25.97),30.98); float d2=length(pp-c2)-9.97;\n' +
        ' vec2 o1=normalize(pp-c1+1e-4), o2=normalize(pp-c2+1e-4); float dd = d1 < d2 ? d1 : d2; vec2 oo = d1 < d2 ? o1 : o2; float fo = dot(nw.xz, oo);\n' +
        ' float inB = step(-5.5, dd) * step(dd, .3) * step(-.25, fo) * step(33.5, vNbW.y) * (dd > -2.4 ? 1. : step(.3, abs(fo)) + step(abs(fo), .3));\n' +
        ' top = mix(top, 34.9 + .35*nbN(vec2(s,3.)*.8), smoothstep(-2.2, -5.5, dd));   /* cascades inward, lower and lower */\n' +
        ' if (inB>.5 && vNbW.y<top+.25) { vec2 lq=vec2(s,vNbW.y)*7.; float l1=nbN(lq), l2=nbN(lq*2.3+5.);\n' +
        // drawn leaves with a little depth: two offset layers of small ellipses, each lit on its upper side and shaded below, with a
        // dark rim, over a deep green ground
        '   vec3 ivy = mix(vec3(.12,.22,.09), vec3(.2,.34,.14), l1);\n' +
        '   for (int ly = 0; ly < 2; ly++) { float fl = float(ly); vec2 lc = vec2(s, vNbW.y) * (5.5 + fl * 1.7) + fl * vec2(.37, .61); vec2 id = floor(lc), f = fract(lc) - .5; float h = nbH(id + fl * 7.1), a = h * 6.283;\n' +
        '     vec2 rf = vec2(cos(a) * f.x + sin(a) * f.y, -sin(a) * f.x + cos(a) * f.y) + (vec2(nbH(id * 1.7), nbH(id * 2.3)) - .5) * .3; float r = length(rf / vec2(.44, .24));\n' +
        '     float leaf = smoothstep(1., .86, r), rim = smoothstep(1., .9, r) - smoothstep(.9, .78, r); vec3 lcol = mix(vec3(.24,.42,.17), vec3(.45,.64,.28), h) * (.78 + .5 * clamp(.5 - f.y * 1.4, 0., 1.));\n' +
        '     ivy = mix(ivy, lcol, leaf); ivy = mix(ivy, vec3(.06,.1,.05), rim * .8); }\n' +
        '   float tuft = nbN(lq*1.8+3.); float m = smoothstep(top+.2, top-.15, vNbW.y + .35*(tuft-.5)); float shade = smoothstep(top-.6, top+.2, vNbW.y)*.25;\n' +
        '   ivy *= 1. - shade*(1.-tuft); diffuseColor.rgb = mix(diffuseColor.rgb*(1.-.25*smoothstep(top+.5,top,vNbW.y)), ivy, m); }\n' + VINE + ' }\n' +
        'else { diffuseColor.rgb *= .93+.08*nbN(vNbW.xz*.9);\n' +
        // the main avenue and the streets are drawn in this same concrete: paint them asphalt with dashed centre lines
        ' if (nw.y>.7 && vNbW.y<35.2) { float x=vNbW.x, z=vNbW.z, W=5.2, BIG=99.; float dv=min(abs(x+100.), abs(x-14.5)) + (step(83.6+W,z)+step(z,-23.-W))*BIG;\n' +
        '  float dh=min(min(abs(z+23.), abs(z-83.6)) + (step(80.,x)+step(x,-140.))*BIG, abs(z-12.5) + (step(14.5,x)+step(x,-100.))*BIG);\n' +
        '  float d=min(dv,dh); if (d<W) { vec3 asp=vec3(.23,.24,.25)*(.88+.16*nbN(vNbW.xz*3.)+.06*nbH(floor(vNbW.xz*40.))); float along = dv<dh ? z : x; float dash=step(fract(along/6.),.5)*step(d,.12); diffuseColor.rgb=mix(asp,vec3(.93,.92,.86),dash); } } }',
      wood: 'float gr=nbN(vec2((vNbW.x+vNbW.z)*1.3, vNbW.y*26.)); diffuseColor.rgb *= (.82+.3*gr);',
      metal: 'diffuseColor.rgb *= .92+.1*nbN(vec2((vNbW.x+vNbW.z)*40., vNbW.y*1.5));',
      skate: NW + 'vec2 p = abs(nw.y)>.8 ? vNbW.xz : vec2(vNbW.x+vNbW.z, vNbW.y*2.);\n' +
        'vec3 con=vec3(.66,.65,.62)*(.9+.14*nbN(p*1.1)+.07*nbN(p*6.)); vec2 jf=abs(fract(p/3.)-.5); con*=1.-.16*smoothstep(.47,.5,max(jf.x,jf.y));\n' +
        // graffiti, skate park only: dense clusters and quieter stretches; five kinds -- script tags, bubble letters, drippy throw-ups, stencil stars, wide colour bands
        'vec2 q=p*.5; vec2 id=floor(q), f=fract(q); float h=nbH(id*3.3+1.7), h2=nbH(id*5.1+9.2), h3=nbH(id*7.7+2.1); float dens=nbN(id*.22+vec2(3.1,7.4)); float on=step(.62-.5*dens,h);\n' +
        'vec3 gc = h2<.17?vec3(.92,.22,.5):(h2<.34?vec3(.18,.62,.92):(h2<.5?vec3(.97,.82,.15):(h2<.67?vec3(.35,.82,.4):(h2<.84?vec3(.98,.5,.15):vec3(.6,.35,.85)))));\n' +
        'float k=floor(h3*5.); float mm=0., ed=0.;\n' +
        'if (k<1.) { float cur=.5+.26*sin(f.x*10.+h*25.); mm=smoothstep(.07,.03,abs(f.y-cur))*step(.08,f.x)*step(f.x,.92); ed=0.; gc=h2<.5?vec3(.08,.08,.1):gc; }\n' +
        'else if (k<2.) { float b=0.; for (int i=0;i<4;i++){ float fi=float(i); b=max(b,smoothstep(.17,.13,length((f-vec2(.17+.22*fi,.5+.08*sin(fi*2.+h*9.)))*vec2(1.,.8)))); } mm=b; ed=0.; for (int i=0;i<4;i++){ float fi=float(i); ed=max(ed,smoothstep(.21,.17,length((f-vec2(.17+.22*fi,.5+.08*sin(fi*2.+h*9.)))*vec2(1.,.8)))); } ed-=mm; }\n' +
        'else if (k<3.) { float blob=smoothstep(.34,.3,length((f-vec2(.5,.58))*vec2(1.,1.5))); float drip=step(abs(fract(f.x*6.)-.5),.08)*step(f.y,.5)*step(.5-nbH(vec2(floor(f.x*6.),id.x))*.4,f.y); mm=max(blob,drip); ed=smoothstep(.4,.34,length((f-vec2(.5,.58))*vec2(1.,1.5)))-blob; }\n' +
        'else if (k<4.) { vec2 c=f-.5; float a=atan(c.y,c.x); float r=length(c); float star=step(r,.2+.1*cos(a*5.+h*6.)); mm=star; ed=step(r,.24+.1*cos(a*5.+h*6.))-star; }\n' +
        'else { mm=step(abs(f.y-.5),.18)*step(.05,f.x)*step(f.x,.95)*(.75+.25*step(.5,fract(f.x*5.))); ed=step(abs(f.y-.5),.22)*step(.03,f.x)*step(f.x,.97)-mm; }\n' +
        'mm*=on; ed*=on; con=mix(con,vec3(.08,.08,.1),clamp(ed,0.,1.)*.85); con=mix(con,gc,clamp(mm,0.,1.)); diffuseColor.rgb=con;'
    };
    function surfOf(m, cat) {
      var n = (m.material || '').toLowerCase();
      if (cat === 'Skate') return 'skate';
      if (cat === 'Glazing') return null;
      if (/con ramp spyy|^con$|cast-in-place/.test(n)) return 'facade';
      if (/^alum$/.test(n)) return 'metal';
      if (n === 'air') return 'lattice';
      if (/default roof/.test(n)) return 'facade';   // the roof in the same board-formed concrete as the facade
      if (/solarworld/.test(n)) return null;
      if (cat === 'Planting' || /grass|lawn|turf|plant/.test(n)) return 'grass';
      if (/asphalt|road|tarmac/.test(n)) return 'asphalt';
      if (/wood|teak|pine|timber|cabinet|larch|oak|ply/.test(n)) return 'wood';
      if (cat === 'Metal' || /steel|alum|metal|iron|galv|chrome/.test(n)) return 'metal';
      if (/path|paving|paver|default floor|tile|sand|dirt/.test(n) || cat === 'Stone') return 'paving';
      if (/concrete|con\b|gfrc|cast|cement|stone|default wall|plaster|stucco|white/.test(n)) return 'concrete';
      return null;
    }
    /* real photo textures (CC0, ambientCG), projected in world space from three sides so no UVs are needed; normalised so they add
       grain and variation without shifting each surface's own colour */
    var TEXFILE = { facade: 'concrete', concrete: 'concrete', asphalt: 'asphalt', grass: 'grass', paving: 'sidewalk', skate: 'concrete' }, TEXSCALE = { facade: 3, concrete: 3, asphalt: 4, grass: 3, paving: 2.5, skate: 3 }, texCache = {};
    var V3 = ctx.camera.position.constructor, TEXAVG = { concrete: new V3(.49, .49, .49), asphalt: new V3(.191, .191, .191), grass: new V3(.118, .153, .026), sidewalk: new V3(.118, .109, .099) };
    var TexC = null; scene.traverse(function (o) { if (!TexC && o.material && o.material.map) TexC = o.material.map.constructor; });
    function photo(name) {
      if (texCache[name] || !TexC) return texCache[name] || null;
      var img = new Image(), t = new TexC(img); t.wrapS = t.wrapT = 1000; t.colorSpace = 'srgb'; t.anisotropy = 8;
      img.onload = function () { t.needsUpdate = true; ctx.controls.dispatchEvent({ type: 'change' }); }; img.src = '../../portfolio-assets/textures/nbyc/' + name + '.jpg';
      return (texCache[name] = t);
    }
    function addSurface(x, kind) {
      var code = SURF[kind]; if (!code) return;
      var tex = TEXFILE[kind] && photo(TEXFILE[kind]), ts = TEXSCALE[kind] || 3;
      if (tex) code = 'vec3 nbn=abs(normalize(cross(dFdx(vNbW),dFdy(vNbW)))); nbn/= (nbn.x+nbn.y+nbn.z);\n' +
        'vec3 nbt = texture2D(nbPhoto, vNbW.zy/' + ts.toFixed(1) + ').rgb*nbn.x + texture2D(nbPhoto, vNbW.xz/' + ts.toFixed(1) + ').rgb*nbn.y + texture2D(nbPhoto, vNbW.xy/' + ts.toFixed(1) + ').rgb*nbn.z;\n' +
        code + '\n diffuseColor.rgb *= clamp(dot(nbt, vec3(.3,.59,.11)) / max(.02, dot(nbAvg, vec3(.3,.59,.11))), .55, 1.45);';
      var prev = x.onBeforeCompile, prevKey = x.customProgramCacheKey;
      x.onBeforeCompile = function (shader, renderer) {
        if (prev) prev.call(this, shader, renderer);
        if (tex) { shader.uniforms.nbPhoto = { value: tex }; shader.uniforms.nbAvg = { value: TEXAVG[TEXFILE[kind]] }; shader.fragmentShader = 'uniform sampler2D nbPhoto; uniform vec3 nbAvg;\n' + shader.fragmentShader; }
        shader.vertexShader = 'varying vec3 vNbW;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = HEAD + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + code);
      };
      x.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '-rv-' + kind; };
    }
    function revitMat(m, cat) {
      var key = m.look + '|' + cat; if (lookMats[key]) return lookMats[key];
      var x = new MatC(), clear = m.transparency > .15;
      x.name = 'Revit ' + (m.material || m.look); x.color.setRGB(m.rgb[0] / 255, m.rgb[1] / 255, m.rgb[2] / 255, 'srgb');
      x.roughness = Math.max(.08, 1 - (m.glossiness || 0) / 100); x.metalness = cat === 'Metal' ? .35 : 0; x.side = 2;
      if (clear) { x.transparent = true; x.opacity = Math.max(.22, 1 - m.transparency); x.depthWrite = false; x.roughness = .05; }
      if (window.sketchStyle.patch) window.sketchStyle.patch(x);
      var sf = surfOf(m, cat); if (sf) addSurface(x, sf);
      // no baked light on the roof: its few huge triangles carry per-corner light as visible triangle shading
      if (cat !== 'Glazing' && !clear && !/default roof/i.test(m.material || '')) bakeLight(x);
      if (cat === 'Glazing') { x.color.setRGB(.64, .77, .82, 'srgb'); x.opacity = .4; x.metalness = .1; x.roughness = .04; }   // one glass, clear with a cool tint
      if (cat === 'Skate') x.color.setRGB(1, 1, 1);
      if (sf === 'grass') x.color.set('#6f8a4e');      // muted lawn green
      if (sf === 'asphalt') x.color.set('#3e4144');
      if (/solarworld aluminum blue/i.test(m.material || '')) { x.color.set('#16181c'); x.roughness = .18; x.metalness = .3; }   // PV cells: near-black glass
      if (/solarworld iron/i.test(m.material || '')) { x.color.set('#3d4045'); x.roughness = .4; x.metalness = .4; }            // frames: dark grey
      if (/default roof/i.test(m.material || '')) { x.color.set('#dcdad3'); x.roughness = .85; }                                  // roof: same light concrete as the facade
      if (/^pine$/i.test(m.material || '')) { x.color.set('#3b3a37'); x.roughness = .6; x.metalness = .3; }   // light and utility poles: dark
      if (sf === 'facade') { x.color.set('#dcdad3'); x.roughness = .85; }          // light concrete, as in the daytime render
      if (/^air$/i.test(m.material || '')) { x.color.set('#8fd3df'); x.roughness = .45; x.metalness = .1; }   // the lattice screens (Revit material "Air"): light blue, as in the render
      x.needsUpdate = true;
      return (lookMats[key] = x);
    }
    var tris = 0, nMeshes = 0, LIGHT = null, lightOff = 0;
    /* the baked light darkens shadowed and enclosed surfaces and lifts bounce-lit ones; it rides on top of the live lights, so the
       strength is kept under 1 to leave the live sun's shading in play */
    function bakeLight(x) {
      var prev = x.onBeforeCompile, prevKey = x.customProgramCacheKey;
      x.onBeforeCompile = function (shader, renderer) {
        if (prev) prev.call(this, shader, renderer);
        shader.vertexShader = 'attribute float nbL; varying float vNbL;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbL = nbL;');
        var M = window.NBYC_MASS; if (M) shader.uniforms.uMass = M.u;
        var hasW = /varying vec3 vNbW/.test(shader.fragmentShader);
        if (!hasW) shader.vertexShader = 'varying vec3 vNbW;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = 'varying float vNbL;\n' + (M ? 'uniform float uMass;\n' : '') + (hasW ? '' : HEAD) + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(1., .28 + .9 * vNbL, .85);\n' + (M ? M.glsl : ''));
      };
      x.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '-bake'; };
    }
    // the files are gzipped; the browser unpacks them as they stream in
    function load(url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return /\.gz(\?|$)/.test(url) && window.DecompressionStream ? new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : r.arrayBuffer();
      }).then(add);
    }
    var phone = !!(window.modelPerformance && window.modelPerformance.mobile) || (window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 700);
    function add(buf) {
      var hl = new DataView(buf).getUint32(0, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl;
      nMeshes += hdr.meshes.length;
      if (hdr.cars) window.nbycCars = hdr.cars;          // where the Revit cars stood: the page parks its own cars there
      if (hdr.levels) window.nbycLevels = hdr.levels;
      hdr.meshes.forEach(function (m) {
        var cat = m.name.replace(/^Youth_center__/, ''), material = m.rgb ? revitMat(m, cat) : (mats[cat] || mats.Other);
        m.chunks.forEach(function (c, ci) {
          var q = new Uint16Array(buf, base + c.pos, c.v * 3), ix = new Uint16Array(buf, base + c.idx, c.i), p = new Float32Array(c.v * 3);
          for (var k = 0; k < c.v; k++) for (var a = 0; a < 3; a++) p[k * 3 + a] = c.min[a] + q[k * 3 + a] * c.scale[a];
          var P = new Float32Array(c.i * 3), N = smoothNormals(p, ix, c.v);
          for (var t = 0; t < c.i; t++) { var v = ix[t] * 3; P[t * 3] = p[v]; P[t * 3 + 1] = p[v + 1]; P[t * 3 + 2] = p[v + 2]; }
          var g = new Geo(); g.setAttribute('position', new Attr(P, 3)); g.setAttribute('normal', new Attr(N, 3)); g.computeBoundingSphere(); g.computeBoundingBox();
          // baked daylight (Blender/Cycles: sun + sky with shadows and bounce), one value per vertex in file order; 1 where none was baked
          var Lb = new Float32Array(c.i), lit = hdr.cars && LIGHT && LIGHT.length >= lightOff + c.v;
          for (var t2 = 0; t2 < c.i; t2++) Lb[t2] = lit ? LIGHT[lightOff + ix[t2]] / 255 : 1;
          if (hdr.cars) lightOff += c.v;
          g.setAttribute('nbL', new Attr(Lb, 1));
          var mesh = new Mesh(g, material); mesh.name = 'Youth_center__' + cat; mesh.userData.ifc = { cat: cat, chunk: ci, tri0: tris }; mesh.renderOrder = cat === 'Glazing' || cat === 'ScreenPanel' ? 2 : 0;
          scene.add(mesh); tris += c.i / 3;
        });
      });
      window.nbycIfc = { triangles: tris, meshes: nMeshes }; ctx.controls.dispatchEvent({ type: 'change' });
    }
    /* Levels: hidden by default; a "Levels" button beside the view buttons shows a thin line around the building at each level and a
       label with its name and height above grade, so the building's scale reads at a glance. */
    function levels() {
      var L = window.nbycLevels; if (!L || !L.length) return;
      var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      scene.traverse(function (o) { if (!o.isMesh || !o.userData.ifc || !/Plaster|Glazing/.test(o.userData.ifc.cat)) return; var b = o.geometry.boundingBox; if (!b || b.min.y < 36 || b.min.x < -110 || b.max.x > 20 || b.min.z < 10 || b.max.z > 90) return; /* the building only */ x0 = Math.min(x0, b.min.x); x1 = Math.max(x1, b.max.x); z0 = Math.min(z0, b.min.z); z1 = Math.max(z1, b.max.z); });
      if (x0 > x1) return; x0 -= 2; x1 += 2; z0 -= 2; z1 += 2;
      var P = [], N = [], h = .06, w = .06;
      function box(ax, ay, az, bx, by, bz) {   // a thin bar from a to b (axis-aligned), as 2 crossed quads
        var q = [[ax, ay - h, az, bx, by - h, bz, bx, by + h, bz, ax, ay + h, az]];
        if (ax === bx) q.push([ax - w, ay, az, bx - w, by, bz, bx + w, by, bz, ax + w, ay, az]); else q.push([ax, ay, az - w, bx, by, bz - w, bx, by, bz + w, ax, ay, az + w]);
        q.forEach(function (v) { [0, 1, 2, 0, 2, 3].forEach(function (i) { P.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]); N.push(0, 1, 0); }); });
      }
      L.forEach(function (l) { box(x0, l.y, z0, x1, l.y, z0); box(x1, l.y, z0, x1, l.y, z1); box(x1, l.y, z1, x0, l.y, z1); box(x0, l.y, z1, x0, l.y, z0); });
      box(x0, L[0].y, z0, x0, L[L.length - 1].y, z0);   // a height rod at the corner
      var g = new Geo(); g.setAttribute('position', new Attr(new Float32Array(P), 3)); g.setAttribute('normal', new Attr(new Float32Array(N), 3)); g.computeBoundingSphere();
      var lm = new MatC(); lm.color.set('#e8467c'); lm.emissive && lm.emissive.set('#e8467c'); lm.roughness = 1; lm.side = 2; lm.name = 'NBYC life levels';
      var lines = new Mesh(g, lm); lines.name = 'NBYC levels'; lines.visible = false; lines.renderOrder = 6; scene.add(lines);
      var host = ctx.renderer.domElement.parentElement, tags = L.map(function (l) {
        var d = document.createElement('div'); d.className = 'nbyc-level-tag';
        d.textContent = l.name + '  +' + (l.ft * .3048).toFixed(1) + ' m / ' + l.ft + ' ft';
        d.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;font:600 11px/1.2 Archivo,system-ui,sans-serif;color:#fff;background:rgba(232,70,124,.92);padding:2px 6px;border-radius:3px;white-space:nowrap;display:none;transform:translate(-100%,-50%);z-index:4';
        host.appendChild(d); return d;
      });
      var on = false;
      function place() {
        if (!on) return; var cam = ctx.camera; cam.updateMatrixWorld(); var vi = cam.matrixWorldInverse.elements, pr = cam.projectionMatrix.elements, W = host.clientWidth, H = host.clientHeight;
        L.forEach(function (l, i) {
          var x = x0, y = l.y, z = z0, vx = vi[0] * x + vi[4] * y + vi[8] * z + vi[12], vy = vi[1] * x + vi[5] * y + vi[9] * z + vi[13], vz = vi[2] * x + vi[6] * y + vi[10] * z + vi[14], vw = vi[3] * x + vi[7] * y + vi[11] * z + vi[15];
          var cx = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12] * vw, cy = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13] * vw, cw = pr[3] * vx + pr[7] * vy + pr[11] * vz + pr[15] * vw;
          var t = tags[i]; if (cw <= 0) { t.style.display = 'none'; return; }
          t.style.display = 'block'; t.style.left = ((cx / cw) * .5 + .5) * W - 6 + 'px'; t.style.top = (1 - ((cy / cw) * .5 + .5)) * H + 'px';
        });
        requestAnimationFrame(place);
      }
      var ref = Array.prototype.find.call(document.querySelectorAll('button'), function (b) { return /guided view/i.test(b.textContent); });
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Levels'; btn.setAttribute('aria-pressed', 'false'); if (ref) btn.className = ref.className;
      btn.addEventListener('click', function () { on = !on; lines.visible = on; btn.setAttribute('aria-pressed', on ? 'true' : 'false'); tags.forEach(function (t) { t.style.display = on ? 'block' : 'none'; }); if (on) place(); ctx.controls.dispatchEvent({ type: 'change' }); });
      if (ref && ref.parentElement) ref.parentElement.insertBefore(btn, ref.nextSibling); else { btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:20'; document.body.appendChild(btn); }
    }
    fetch('revit-main.light.bin.gz?v=1').then(function (r) { if (!r.ok) throw 0; return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); })
      .then(function (b) { LIGHT = new Uint8Array(b); }, function () { LIGHT = null; })
      .then(function () { return load(URL_MAIN); }).then(function () {
      // patch: the Revit grass and dirt floors (434854, 2662756) have a 7.5 x 19 m opening west of the funnel drum; close it with lawn at
      // the lawn's own height (read from the planting faces around it)
      /* no lawn inside the building's interior circle (as in the renders): the grass floors within the footprint become paving; and
         the tall thin light poles get a dark finish */
      var pave = revitMat({ look: 'courtyard paving', material: 'paving courtyard', rgb: [216, 205, 184], transparency: 0, glossiness: 5 }, 'Stone');
      var pole = new MatC(); pole.name = 'Revit pole'; pole.color.set('#2e3135'); pole.roughness = .5; pole.metalness = .4; pole.side = 2; if (window.sketchStyle.patch) window.sketchStyle.patch(pole);
      scene.traverse(function (o) {
        if (!o.isMesh || !o.userData.ifc || !o.geometry.boundingBox) return; var b = o.geometry.boundingBox, mn = o.material && o.material.name || '';
        if (b.max.y - b.min.y > 5 && b.max.x - b.min.x < 1.5 && b.max.z - b.min.z < 1.5 && !/glass/i.test(mn)) o.material = pole;
      });
      (function () {
        var x0 = -89.6, x1 = -82, z0 = 43.8, z1 = 63, gy = -1e9;
        scene.traverse(function (o) {
          if (!o.isMesh || !o.userData.ifc || o.userData.ifc.cat !== 'Planting') return; var a = o.geometry.attributes.position.array;
          for (var k = 0; k < a.length; k += 3) if (a[k] > x0 - 3 && a[k] < x1 + 3 && a[k + 2] > z0 - 3 && a[k + 2] < z1 + 3 && a[k + 1] > gy && a[k + 1] < 36) gy = a[k + 1];
        });
        if (gy < 30) gy = 34.5;
        var y = gy - .01, P = new Float32Array([x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0]), N = new Float32Array(18);
        for (var k = 1; k < 18; k += 3) N[k] = 1;
        var g = new Geo(); g.setAttribute('position', new Attr(P, 3)); g.setAttribute('normal', new Attr(N, 3)); g.computeBoundingSphere(); g.computeBoundingBox();
        var patch = new Mesh(g, mats.Planting); patch.name = 'Youth_center__Planting'; patch.userData.ifc = { cat: 'Planting', patch: true }; scene.add(patch);
      })();
      /* live sun shadows, from the same sun as the bake (high, south-east), so the building throws crisp shadows on the ground,
         the plaza and its own walls; soft-edged, one 4096 map over the site. Phones keep the bake only. */
      if (!phone) (function () {
        var sun = null; scene.traverse(function (o) { if (!sun && o.isDirectionalLight) sun = o; }); if (!sun) return;
        var cx = -45, cy = 35, cz = 45, D = [.34, .85, .41], R = 150;
        sun.position.set(cx + D[0] * R, cy + D[1] * R, cz + D[2] * R); sun.target.position.set(cx, cy, cz); if (!sun.target.parent) scene.add(sun.target);
        sun.castShadow = true; var s = sun.shadow; s.mapSize.set(4096, 4096); s.bias = -.0004; s.normalBias = .04; s.radius = 3;
        var cam = s.camera; cam.left = -125; cam.right = 125; cam.top = 125; cam.bottom = -125; cam.near = 20; cam.far = 340; cam.updateProjectionMatrix();
        ctx.renderer.shadowMap.enabled = true; ctx.renderer.shadowMap.type = 2;
        scene.traverse(function (o) { if (o.isMesh && !(o.material && o.material.transparent)) { o.castShadow = true; o.receiveShadow = true; var ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(function (m) { if (m) m.needsUpdate = true; }); } });
        window.nbycShadows = true;
      })();
      REPLACES.forEach(function (k) { if (old[k]) { old[k].visible = false; old[k].name = 'Old_' + old[k].name; } });
      window.nbycIfc = { triangles: tris, meshes: nMeshes };
      ctx.controls.dispatchEvent({ type: 'change' });
      try { levels(); } catch (e) { console.warn('levels skipped', e); }
      if (phone) return;           // phones get the building and site only
      return load(URL_DETAIL);     // fixtures, furniture, cars and piles stream in after the building is up
    }).then(function () { window.nbycIfc.detail = true; }).catch(function (e) { console.warn('Revit model not fully loaded', e); });
  }
})();
