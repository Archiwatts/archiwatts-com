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
  var CODE = {
    cityPlaster: NRM + 'float hh=nbH(floor(vNbW.xz/16.)*1.7); vec3 wall = hh<.2?vec3(.93,.80,.58):(hh<.4?vec3(.90,.62,.50):(hh<.6?vec3(.94,.88,.74):(hh<.8?vec3(.84,.70,.52):vec3(.88,.74,.62))));\n' +
      'if (abs(nw.y)<.4) { diffuseColor.rgb = wall*(.9+.14*nbN(vNbW.xz*.5+vNbW.y*.7)) * (.96+.06*sin(vNbW.y*3.1)); }\n' +
      'else if (nw.y>.97) { diffuseColor.rgb = vec3(.56,.54,.5)*(.86+.16*nbN(vNbW.xz*1.3)+.06*nbN(vNbW.xz*7.)); }\n' +
      'else if (nw.y>.4) { float tile=.5+.5*sin((vNbW.x+vNbW.z)*10.+vNbW.y*2.5); diffuseColor.rgb = vec3(.68,.34,.22)*(.78+.26*nbN(vNbW.xz*2.1))*(.88+.12*tile); }',
    // the main apartment: warm Venetian stucco, trowelled and weathered (darker and damper toward the street), roofs in tile
    mainPlaster: NRM + 'vec2 sp = vec2(vNbW.x+vNbW.z, vNbW.y);\n' +
      'if (abs(nw.y)<.4) { float trowel = nbN(sp*vec2(1.6,3.2))*.55+nbN(sp*7.)*.3+nbN(sp*23.)*.15; float blot = smoothstep(.55,.8,nbN(sp*.35));\n' +
      '  vec3 c = mix(vec3(.93,.80,.60), vec3(.88,.66,.48), blot*.6) * (.86+.2*trowel); float damp = 1.-smoothstep(0.,2.2,vNbW.y-3.); c *= 1.-.16*damp*(.6+.4*nbN(sp*2.));\n' +
      '  c *= 1.-.07*smoothstep(.6,.9,nbN(vec2(sp.x*4., sp.y*.25))); diffuseColor.rgb = c; }\n' +
      'else if (nw.y>.985) { diffuseColor.rgb = vec3(.62,.6,.56)*(.85+.15*nbN(vNbW.xz*1.4)+.06*nbN(vNbW.xz*9.)); }\n' +
      'else if (nw.y>.3) { float tile=.5+.5*sin((vNbW.x+vNbW.z)*10.+vNbW.y*2.5); diffuseColor.rgb = vec3(.74,.38,.24)*(.8+.24*nbN(vNbW.xz*2.1))*(.86+.14*tile); }',
    // the two partner buildings: lightly tinted, quiet (slightly highlighted against the basswood city)
    teamPlaster: NRM + 'if (abs(nw.y)<.4) { diffuseColor.rgb = vec3(.97,.93,.86)*(.96+.05*nbN(vNbW.xz*.5+vNbW.y*.6)); } else if (nw.y>.985) { diffuseColor.rgb = vec3(.86,.84,.8); } else if (nw.y>.3) { diffuseColor.rgb = vec3(.84,.56,.42); }',
    brick: 'float row=floor(vNbW.y/.22); float off=mod(row,2.)*.5; vec2 q=vec2((vNbW.x+vNbW.z)/.5+off, vNbW.y/.22); vec2 f=fract(q); float mortar=step(f.y,.12)+step(f.x,.07); diffuseColor.rgb *= (.82+.3*nbH(floor(q)))*(1.-.35*clamp(mortar,0.,1.)) ;',
    stone: NRM + 'vec2 q=(abs(nw.y)>.8?vNbW.xz:vec2(vNbW.x+vNbW.z,vNbW.y))/1.4; vec2 f=abs(fract(q)-.5); float joint=smoothstep(.46,.5,max(f.x,f.y)); diffuseColor.rgb *= (1.-.22*joint)*(.9+.14*nbH(floor(q)*3.1))*(.94+.08*nbN(vNbW.xz*1.6));',
    grass: 'float g1=nbN(vNbW.xz*.5), g2=nbN(vNbW.xz*2.8); diffuseColor.rgb *= vec3(.84+.3*g1+.1*g2,.86+.26*g1+.12*g2,.8+.2*g1);',
    // canal water: green-teal Venetian water with drifting ripples and sun glints (vlT is the time in seconds)
    water: 'vec2 wp = vNbW.xz; float r1 = nbN(wp*.9 + vec2(vlT*.35, vlT*.12)), r2 = nbN(wp*2.3 - vec2(vlT*.2, vlT*.45)), r3 = nbN(wp*.12 + vlT*.03);\n' +
      'float rip = r1*.55 + r2*.45; vec3 deep = vec3(.16,.36,.36), lite = vec3(.38,.6,.56); vec3 c = mix(deep, lite, smoothstep(.25,.85,rip*.7+r3*.5));\n' +
      'c += vec3(.3,.34,.32) * smoothstep(.88,1.,r1*r2*1.8); c *= .92+.1*sin(wp.x*1.7+wp.y*1.1+vlT*1.3+r2*4.); diffuseColor.rgb = c;'
  };
  var TIME = { value: 0 }; (function tick() { TIME.value = performance.now() / 1000; requestAnimationFrame(tick); })();
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.sketchStyle && window.sketchStyle.patch; }
  var tries = 0; (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Venice look skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();
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
    if (scene.background && scene.background.isColor) scene.background.set('#dbe6ee');
    ctx.controls.dispatchEvent({ type: 'change' });
  }
})();
