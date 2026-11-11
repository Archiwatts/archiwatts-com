/* Venice Apartments: the Real view (desktop). Light is baked ahead of time (_source-models/tools/bake_venice.py): sun with soft
   shadows, sky light, ambient occlusion and one bounce, so it costs nothing while the model is turned.
     real-main.bin.gz     the main building again, every flat face with its place in the lightmap, small pieces with a light per vertex
     real-light.png       the lightmap (sqrt-encoded, 0..4)
     real-context.bin.gz  a light value per vertex for the city and the partner buildings (sun, sky)
     real-ground.png      a top-down light map for roofs, streets and courtyards (r: sun, g: sky, b: height of that surface)
   Loaded the first time Real is picked. In this view the live sun shadows are off, a sky dome and sky reflections come on, and the
   study-model ink lines step aside. */
(function () {
  if (window.modelPerformance && window.modelPerformance.mobile) return;
  var V = 'v=2', loaded = null, on = false, S = null;
  var UR = { value: 0 }, GAIN = { value: .72 }, U = { vlLM: { value: null }, vlGain: GAIN, vlReal: UR, vlTop: { value: null }, vlTMin: { value: [0, 0] }, vlTRes: { value: 1 }, vlTN: { value: [1, 1] }, vlTY: { value: 64 } };
  function ready() { return window.veniceLook && window.veniceRevitMain && window.sketchStyle && window.daylightContext && window.projectLook; }
  (function wait() { if (ready()) init(); else setTimeout(wait, 500); })();
  function init() {
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sk'] }); sync();
  }
  function sync() {
    var want = document.documentElement.getAttribute('data-sk') === 'real';
    if (want && !loaded) { loaded = load().then(function (s) { S = s; apply(); }).catch(function (e) {
      // the texture class is borrowed from the sun's shadow map, which only exists once a frame with shadows has been drawn: ask for a
      // frame and try again (a page opened in a background tab may not have drawn yet)
      loaded = null; if (/texture class/.test(String(e && e.message))) { window.daylightContext.controls.dispatchEvent({ type: 'change' }); setTimeout(sync, 1000); } else console.warn('Venice Real view not loaded', e); }); return; }
    apply();
  }
  function gunzip(r) { if (!r.ok) throw new Error(r.url + ' ' + r.status); return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }
  function image(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
  var DECODE = 'vec3 vlBk = vec3(0.);\n';
  // the baked light replaces the live diffuse light; highlights and sky reflections are held back where the bake is dark
  var APPLY = ' float vlB = dot(vlBk, vec3(.3,.5,.2)); reflectedLight.directDiffuse = vec3(0.); reflectedLight.indirectDiffuse = diffuseColor.rgb * (1. - metalnessFactor) * vlBk;\n' +
    ' reflectedLight.directSpecular *= smoothstep(.55, 1.2, vlB); reflectedLight.indirectSpecular *= clamp(vlB * 1.5, 0., 1.);\n';
  // air: far parts of the city fade a little toward the horizon colour
  var HAZE = ' outgoingLight = mix(outgoingLight, vec3(.60,.72,.88), (1. - exp(-length(vViewPosition) * .0009)) * .85);\n';
  function chain(m, tag, fn) { var prev = m.onBeforeCompile, pk = m.customProgramCacheKey; m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); fn(sh); }; m.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + tag; }; m.needsUpdate = true; return m; }
  // main building: lightmap (or a vertex colour where the alpha says so)
  function bakedMain(m) {
    return chain(m, '-vreal-main', function (sh) {
      sh.uniforms.vlLM = U.vlLM; sh.uniforms.vlGain = GAIN;
      sh.vertexShader = 'attribute vec2 vlUv; attribute vec4 vlC; varying vec2 vVlUv; varying vec4 vVlC;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vVlUv = vlUv; vVlC = vlC;');
      sh.fragmentShader = 'uniform sampler2D vlLM; uniform float vlGain; varying vec2 vVlUv; varying vec4 vVlC;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' +
        '{ vec3 vlT = texture2D(vlLM, vVlUv).rgb; vec3 vlBk = mix(vlT * vlT, vVlC.rgb * vVlC.rgb, step(.5, vVlC.a)) * 4. * vlGain;\n' + APPLY + '}').replace('#include <opaque_fragment>', HAZE + '#include <opaque_fragment>');
    });
  }
  // context: light per vertex; up-facing surfaces read the top-down map where it is the same surface (heights agree)
  function bakedContext(m) {
    return chain(m, '-vreal-ctx', function (sh) {
      ['vlReal', 'vlGain', 'vlTop', 'vlTMin', 'vlTRes', 'vlTN', 'vlTY'].forEach(function (k) { sh.uniforms[k] = U[k]; });
      sh.vertexShader = 'attribute vec2 vlL; varying vec2 vVlL; varying vec3 vVlW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vVlL = vlL; vVlW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform sampler2D vlTop; uniform float vlReal, vlGain, vlTRes, vlTY; uniform vec2 vlTMin, vlTN; varying vec2 vVlL; varying vec3 vVlW;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' +
        'if (vlReal > .5) { vec2 sv = vVlL * vVlL; vec3 vlWn = normalize(cross(dFdx(vVlW), dFdy(vVlW)));\n' +
        ' if (abs(vlWn.y) > .6) { vec2 g = (vVlW.xz - vlTMin) / vlTRes - .5; ivec2 i0 = ivec2(floor(g)); vec2 f = fract(g); vec2 acc = vec2(0.); float ws = 0.; ivec2 nn = ivec2(vlTN);\n' +
        '  for (int j = 0; j < 4; j++) { ivec2 o = ivec2(j & 1, j >> 1); ivec2 q = clamp(i0 + o, ivec2(0), nn - 1); vec3 t = texelFetch(vlTop, ivec2(q.x, nn.y - 1 - q.y), 0).rgb;\n' +
        '   float w = (o.x == 1 ? f.x : 1. - f.x) * (o.y == 1 ? f.y : 1. - f.y) * step(abs(t.b * vlTY - vVlW.y), 1.2); acc += w * t.rg * t.rg; ws += w; }\n' +
        '  if (ws > .001) sv = acc / ws; }\n' +
        ' vec3 vlBk = (vec3(1.6, 1.47, 1.26) * sv.x + vec3(.84, .96, 1.2) * sv.y) * vlGain;\n' + APPLY + '}')
        .replace('if (uCtx > .5) { vec3 c0', 'if (uCtx > .5 && vlReal < .5) { vec3 c0')   // the study model's "no dark faces" rule would wash out real shadows
        .replace('#include <opaque_fragment>', 'if (vlReal > .5) {' + HAZE + '}\n#include <opaque_fragment>');
    });
  }
  function load() {
    var ctx = window.daylightContext, scene = ctx.scene, any = null, sun = null;
    scene.traverse(function (o) { if (!any && o.isMesh && /^Venice main \(Revit\)/.test(o.name || '')) any = o; if (!sun && o.isDirectionalLight) sun = o; });
    var BG = any.geometry.constructor, MESH = any.constructor, Attr = any.geometry.attributes.position.constructor;
    var TexC = sun && sun.shadow && sun.shadow.map && sun.shadow.map.texture ? sun.shadow.map.texture.constructor : null; if (!TexC) return Promise.reject(new Error('no texture class yet'));
    function tex(img, nearest) { var t = new TexC(img); t.generateMipmaps = false; t.minFilter = t.magFilter = nearest ? 1003 : 1006; t.needsUpdate = true; return t; }
    return Promise.all([fetch('real-main.bin.gz?' + V).then(gunzip), fetch('real-context.bin.gz?' + V).then(gunzip), image('real-light.png?' + V), image('real-ground.png?' + V)]).then(function (R) {
      var s = { real: [], plain: [], sun: sun, ink: [], env: null, dome: null, bg: scene.background, ctxMeshes: [], Attr: Attr };
      U.vlLM.value = tex(R[2]); U.vlTop.value = tex(R[3], true);
      // ---- main building ----
      var buf = R[0], dv = new DataView(buf), hl = dv.getUint32(4, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl))), at = 8 + hl, mats = {};
      hdr.parts.forEach(function (p) {
        var q = new Uint16Array(buf.slice(at, at + p.nv * 6)); at += p.nv * 6; var uv = new Uint16Array(buf.slice(at, at + p.nv * 4)); at += p.nv * 4;
        var col = new Uint8Array(buf.slice(at, at + p.nv * 4)); at += p.nv * 4; var I = new Uint32Array(buf.slice(at, at + p.nt * 12)); at += p.nt * 12;
        var k = window.veniceLook.kind(p.mat); if (!k) return;
        var mat = mats[k]; if (!mat) { mat = window.veniceLook.make[k](); mat.name = 'Venice real ' + k;
          if (k === 'glass') { mat.color.set('#9fb4bd'); mat.roughness = .04; mat.metalness = .9; mat.opacity = .62; }   // daylight glass: mostly a reflection of the sky
          else { if (k === 'frame') { mat.roughness = .38; mat.metalness = .55; } if (k === 'iron') { mat.metalness = .6; mat.roughness = .4; } bakedMain(mat); }
          mats[k] = mat; }
        var P = new Float32Array(p.nv * 3); for (var i = 0; i < P.length; i++) { var a = i % 3; P[i] = p.min[a] + q[i] / 65535 * (p.max[a] - p.min[a]); }
        var g = new BG(); g.setAttribute('position', new Attr(P, 3)); g.setAttribute('vlUv', new Attr(uv, 2, true)); g.setAttribute('vlC', new Attr(col, 4, true)); g.setIndex(new Attr(I, 1)); g.computeVertexNormals();
        var m = new MESH(g, mat); m.name = 'Venice real ' + p.mat; m.visible = false; m.userData.noWalk = true; if (mat.transparent) m.renderOrder = 2; scene.add(m); s.real.push(m);
      });
      scene.traverse(function (o) { if (o.isMesh && /^Venice main \(Revit\)/.test(o.name || '')) s.plain.push(o); if (o.isMesh && o.userData.skEdge && o.material) s.ink.push(o); });
      // ---- context ----
      var cb = R[1], ch = JSON.parse(new TextDecoder().decode(new Uint8Array(cb, 8, new DataView(cb).getUint32(4, true)))), ca = 8 + new DataView(cb).getUint32(4, true), L = {};
      ch.meshes.forEach(function (m) { L[m.name] = new Uint8Array(cb.slice(ca, ca + m.nv * 2)); ca += m.nv * 2; });
      U.vlTMin.value = ch.top.min; U.vlTRes.value = ch.top.res; U.vlTN.value = ch.top.n; U.vlTY.value = ch.top.ymax;
      var done = new Set();
      scene.traverse(function (o) {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return; var base = (o.name || '').replace(/_(frame|trees|wood)$/, ''), arr = L[base];
        if (!arr || arr.length !== o.geometry.attributes.position.count * 2) return;
        o.geometry.setAttribute('vlL', new Attr(arr, 2, true)); s.ctxMeshes.push(o);
        if (!done.has(o.material) && o.name !== 'Team_buildings__Glazing') { done.add(o.material); bakedContext(o.material); }
      });
      // ---- sky: a dome behind everything, and the same sky as the environment the glass and water reflect ----
      var sd = hdr.sun, SKY = 'vec3 vlSky(vec3 d){ float y = d.y; vec3 c = mix(vec3(.80,.87,.95), vec3(.24,.46,.82), pow(clamp(y, 0., 1.), .5)); c = mix(c, vec3(.86,.89,.92), smoothstep(.12, -.02, y));\n' +
        ' float s = max(dot(d, vec3(' + sd.map(function (v) { return v.toFixed(4); }).join(',') + ')), 0.); c += vec3(1.,.9,.7) * (pow(s, 900.) * 3. + pow(s, 24.) * .16); return c; }\n';
      var n = 32, m2 = 16, P2 = [], I2 = []; for (var j = 0; j <= m2; j++) for (var i2 = 0; i2 <= n; i2++) { var th = j / m2 * Math.PI, ph = i2 / n * 2 * Math.PI; P2.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); }
      for (var j2 = 0; j2 < m2; j2++) for (var i3 = 0; i3 < n; i3++) { var a0 = j2 * (n + 1) + i3, b0 = a0 + n + 1; I2.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
      var dg = new BG(); dg.setAttribute('position', new Attr(new Float32Array(P2), 3)); dg.setIndex(new Attr(new Uint16Array(I2), 1));
      var dm = new (any.material.constructor)(); dm.name = 'Venice sky'; dm.side = 2; dm.depthWrite = false; dm.fog = false;
      dm.onBeforeCompile = function (sh) {
        sh.vertexShader = 'varying vec3 vSkyD;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSkyD = position;').replace('#include <project_vertex>', 'vec4 mvPosition = vec4(mat3(viewMatrix) * position * 10., 1.0); gl_Position = projectionMatrix * mvPosition; gl_Position.z = gl_Position.w * .99999;');
        sh.fragmentShader = 'varying vec3 vSkyD;\n' + SKY + sh.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor = vec4(vlSky(normalize(vSkyD)), 1.0);');
      };
      dm.customProgramCacheKey = function () { return 'venice-sky'; };
      var dome = new MESH(dg, dm); dome.name = 'Venice sky dome'; dome.frustumCulled = false; dome.renderOrder = -5; dome.visible = false; dome.userData.skEdge = true; dome.userData.noWalk = true; dome.castShadow = false; scene.add(dome); s.dome = dome;
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; var c2 = cv.getContext('2d'), im = c2.createImageData(512, 256);
      for (var y = 0; y < 256; y++) for (var x = 0; x < 512; x++) {
        var el = (.5 - (y + .5) / 256) * Math.PI, az = ((x + .5) / 512 - .5) * 2 * Math.PI, d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
        var t = Math.pow(Math.max(0, Math.min(1, d[1])), .5), c = [.80 + (.24 - .80) * t, .87 + (.46 - .87) * t, .95 + (.82 - .95) * t], h = Math.max(0, Math.min(1, (.12 - d[1]) / .14)); h = h * h * (3 - 2 * h);
        var gnd = d[1] < -.02 ? [.42, .40, .37] : [.86, .89, .92]; c = [c[0] + (gnd[0] - c[0]) * h, c[1] + (gnd[1] - c[1]) * h, c[2] + (gnd[2] - c[2]) * h];
        var sdot = Math.max(0, d[0] * sd[0] + d[1] * sd[1] + d[2] * sd[2]), gl = Math.pow(sdot, 200) * 2 + Math.pow(sdot, 24) * .16; var o2 = (y * 512 + x) * 4;
        im.data[o2] = Math.min(255, (c[0] + gl) * 255); im.data[o2 + 1] = Math.min(255, (c[1] + gl * .9) * 255); im.data[o2 + 2] = Math.min(255, (c[2] + gl * .7) * 255); im.data[o2 + 3] = 255;
      }
      c2.putImageData(im, 0, 0); var env = new TexC(cv); env.mapping = 303; env.colorSpace = 'srgb'; env.needsUpdate = true; s.env = env;
      return s;
    });
  }
  function apply() {
    if (!S) return; var ctx = window.daylightContext, scene = ctx.scene, want = document.documentElement.getAttribute('data-sk') === 'real'; if (want === on) return; on = want;
    UR.value = on ? 1 : 0;
    S.real.forEach(function (m) { m.visible = on; }); S.plain.forEach(function (m) { m.visible = !on; });
    S.ink.forEach(function (m) { m.material.visible = !on; });
    S.dome.visible = on; scene.environment = on ? S.env : null;
    if (S.sun) { if (on) { S.sunShadow = S.sun.castShadow; S.sun.castShadow = false; } else if (S.sunShadow != null) S.sun.castShadow = S.sunShadow; }
    ctx.controls.dispatchEvent({ type: 'change' }); window.veniceReal = { on: on, gain: GAIN, state: S, bake: bakedMain };
    // The context's light was added to geometry that had already been drawn, and the renderer can keep the vertex layout it built
    // before the new data had a buffer. Handing each mesh a fresh attribute object (same data) once the new shaders have drawn makes
    // it rebuild that layout.
    if (on && !S.rebound) { S.rebound = true; [250, 1200].forEach(function (ms) { setTimeout(function () {
      S.ctxMeshes.forEach(function (o) { var a = o.geometry.attributes.vlL; if (a) o.geometry.setAttribute('vlL', new S.Attr(a.array, 2, true)); }); ctx.controls.dispatchEvent({ type: 'change' }); }, ms); }); }
  }
})();
