/* Line-and-wash render style for the light model pages.
   Views: Watercolor (adobe washes + ink outline), Sketch (black-and-white wash), Massing (white model + outline), Diagram, Realistic.
   Washes are done in the material shader (no extra textures); the ink outline is a layer of screen-space line strokes built from
   precomputed feature edges (light/edges.bin). Configure with window.SKETCH_STYLE = { edges: 'light/edges', mode: 'watercolor' }. */
(function () {
  var CFG = window.SKETCH_STYLE; if (!CFG) return;
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene; }
  var tries = 0;
  (function wait() {
    if (ready()) { try { run(); } catch (e) { console.warn('Sketch style skipped', e); } }
    else if (tries++ < 600) setTimeout(wait, 150);
  })();
  function redraw(ctx) { if (ctx.controls && ctx.controls.dispatchEvent) ctx.controls.dispatchEvent({ type: 'change' }); }
  var SKIP = /^Hive (sketch|canal hatch|road markings|planting bed)|Hive sketch|Hive plan overlay|Amenity pool water/;
  var MODES = {
    realistic: { style: 0, bg: null, edges: false, paper: 0, ink: [.18, .165, .15] },
    watercolor: { style: 1, bg: 0xf4ecdc, edges: true, paper: .55, ink: [.18, .165, .15] },
    sketch: { style: 2, bg: 0xf2f0ea, edges: true, paper: .5, ink: [.12, .12, .12] },
    massing: { style: 3, bg: 0xf6f4ee, edges: true, paper: .3, ink: [.14, .13, .12] },
    diagram: { style: 0, bg: 0x26242a, edges: true, paper: 0, ink: [.93, .92, .88] }
  };
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, mobile = !!(window.modelPerformance && window.modelPerformance.mobile);
    var bg0 = scene.background && scene.background.isColor ? scene.background.getHex() : null;
    var shared = { uStyle: { value: 0 }, uBands: { value: 5 }, uChroma: { value: .55 } }, patched = new WeakSet(), std = null;
    // ---- wash shader, patched onto every lit material ----
    var FRAG_HEAD = 'uniform float uStyle; uniform float uBands; uniform float uChroma; uniform float uCtx; varying vec3 vSkW;\n' +
      'vec3 skRamp(float t){ vec3 c0=vec3(.47,.31,.24), c1=vec3(.80,.60,.43), c2=vec3(.93,.84,.69), c3=vec3(.985,.965,.92); t=clamp(t,0.,1.); if(t<.33) return mix(c0,c1,t/.33); if(t<.66) return mix(c1,c2,(t-.33)/.33); return mix(c2,c3,(t-.66)/.34); }\n' +
      'float skH(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n' +
      'float skN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(skH(i),skH(i+vec2(1.,0.)),f.x),mix(skH(i+vec2(0.,1.)),skH(i+vec2(1.,1.)),f.x),f.y); }\n';
    var FRAG_MAIN = '#include <dithering_fragment>\n' +
      'if (uCtx > .5) { vec3 c0 = gl_FragColor.rgb; float l0 = dot(c0, vec3(.299,.587,.114)); float dk = 1.0 - smoothstep(.05,.11,l0);\n' +
      '  vec3 sand = vec3(.84,.80,.72) * (.94 + .10 * skN(vSkW.xz * .6)); gl_FragColor.rgb = mix(c0, sand, dk); }\n' +
      'if (uStyle > .5) { vec3 col = gl_FragColor.rgb; float l = dot(col, vec3(.299,.587,.114)); float st = uStyle; if (uCtx > .5) st = 3.0;\n' +
      '  float wob = (skN(vSkW.xz*.30 + vSkW.y*.21)-.5)*.16 + (skN(vSkW.xz*1.9)-.5)*.06;\n' +
      '  float lq = floor((l+wob)*uBands+.5)/uBands; lq = mix(l, lq, .8); vec3 o;\n' +
      '  if (st < 1.5) { o = skRamp(lq) + (col - l) * uChroma; }\n' +
      '  else if (st < 2.5) { float g = mix(.30,.985,lq); o = vec3(g, g*.985, g*.955); }\n' +
      '  else { float b = floor(l*3.+.5)/3.; float g = mix(.70,1.0,clamp(b+.1,0.,1.)); o = vec3(g, g*.99, g*.965); }\n' +
      '  gl_FragColor.rgb = o; }\n';
    function patch(m) {
      if (patched.has(m) || SKIP.test(m.name || '') || !m.isMeshStandardMaterial) return; patched.add(m);
      var ctxFlag = { value: /context/i.test(m.name || '') || (m.map && /context/i.test(m.map.name || '')) ? 1 : 0 };
      var prev = m.onBeforeCompile;
      m.onBeforeCompile = function (shader, renderer) {
        if (prev) prev.call(this, shader, renderer);
        shader.uniforms.uStyle = shared.uStyle; shader.uniforms.uBands = shared.uBands; shader.uniforms.uChroma = shared.uChroma; shader.uniforms.uCtx = ctxFlag;
        shader.vertexShader = 'varying vec3 vSkW;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSkW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <dithering_fragment>', FRAG_MAIN);
      };
      m.customProgramCacheKey = function () { return 'sk-wash-1'; };
      m.needsUpdate = true;
    }
    function patchAll() {
      scene.traverse(function (o) {
        if (!o.isMesh || (o.userData && o.userData.skEdge)) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m) { if (!std && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) std = m; patch(m); } });
      });
    }
    patchAll(); (function again(n) { if (n > 30) return; setTimeout(function () { patchAll(); again(n + 1); }, 1500); })(0);
    // ---- ink outline: screen-space strokes built from precomputed edges ----
    var edgeMeshes = [], edgeMat = null, edgeU = { uRes: { value: [1, 1] }, uWorldW: { value: mobile ? .4 : .36 }, uMinW: { value: 3 }, uMaxW: { value: 9 }, uMinPx: { value: mobile ? 12 : 5 }, uInk: { value: [.18, .165, .15] }, uQMin: { value: [0, 0, 0] }, uQRange: { value: [1, 1, 1] } };
    function buildEdges(meta, bin) {
      var Mesh = null, BG = null, Attr = null;
      scene.traverse(function (o) { if (!Mesh && o.isMesh && o.geometry && o.geometry.index) { Mesh = o.constructor; BG = o.geometry.constructor; var C = o.geometry.index.constructor; Attr = Object.getPrototypeOf(C); } });
      // find a BufferAttribute class that accepts typed arrays of any type
      scene.traverse(function (o) { if (Attr && Attr.name === 'BufferAttribute') return; if (o.isMesh && o.geometry && o.geometry.attributes.normal) Attr = o.geometry.attributes.normal.constructor; });
      if (!Mesh || !std) return;
      var q = new Int16Array(bin), range = [0, 1, 2].map(function (i) { return meta.max[i] - meta.min[i]; });
      edgeU.uQMin.value = meta.min; edgeU.uQRange.value = range;
      edgeMat = std.clone(); edgeMat.name = 'Hive sketch outline'; edgeMat.map = null; edgeMat.normalMap = null; edgeMat.roughnessMap = null; edgeMat.side = 2; edgeMat.transparent = false; edgeMat.fog = false;
      edgeMat.onBeforeCompile = function (shader) {
        Object.keys(edgeU).forEach(function (k) { shader.uniforms[k] = edgeU[k]; });
        shader.vertexShader = 'attribute vec3 other; attribute vec4 meta; uniform vec2 uRes; uniform float uWorldW; uniform float uMinW; uniform float uMaxW; uniform float uMinPx; uniform vec3 uQMin; uniform vec3 uQRange; varying vec3 vSk; varying float vSide;\n' + shader.vertexShader
          .replace('#include <project_vertex>',
            'vec3 pa = (position + 32767.0) / 65534.0 * uQRange + uQMin; vec3 pb = (other + 32767.0) / 65534.0 * uQRange + uQMin;\n' +
            'vec4 a4 = modelViewMatrix * vec4(pa, 1.0), b4 = modelViewMatrix * vec4(pb, 1.0); a4.z += 0.07; b4.z += 0.07; vec4 mvPosition = a4; float endf = meta.y; float sd = meta.x * 2.0 - 1.0;\n' +
            'float nz = -0.25; bool gone = (a4.z > nz && b4.z > nz);\n' +
            'if (!gone) { if (a4.z > nz) a4 = a4 + (b4 - a4) * ((nz - a4.z) / (b4.z - a4.z)); else if (b4.z > nz) b4 = b4 + (a4 - b4) * ((nz - b4.z) / (a4.z - b4.z)); }\n' +
            'vec4 ca = projectionMatrix * a4, cb = projectionMatrix * b4;\n' +
            'vec2 sa = ca.xy / ca.w, sb = cb.xy / cb.w; vec2 dir = (sb - sa) * uRes; float dl = length(dir); dir = dl > 1e-5 ? dir / dl : vec2(1.0, 0.0);\n' +
            'vec2 nrm = vec2(-dir.y, dir.x); vec4 cc = endf < .5 ? ca : cb; float dep = max(.5, endf < .5 ? -a4.z : -b4.z);\n' +
            'float focal = projectionMatrix[1][1] * uRes.y * .5; float wpx = clamp(uWorldW * (meta.w > .5 ? 1.25 : 1.0) * focal / dep, uMinW, uMaxW);\n' +
            'cc.xy += nrm * sd * wpx / uRes * cc.w;\n' +
            'if (gone || dl * .5 < uMinPx) cc = vec4(2.0, 2.0, 2.0, 1.0);\n' +            'gl_Position = cc; vSk = vec3(meta.z / 255.0, endf, meta.w); vSide = sd;')
          .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);');
        shader.fragmentShader = 'uniform vec3 uInk; varying vec3 vSk; varying float vSide;\n' + shader.fragmentShader.replace('#include <dithering_fragment>',
          'float tw = .78 + .22 * sin(clamp(vSk.y, 0., 1.) * 3.14159); if (abs(vSide) > tw) discard;\n' +
          'float hh = fract(sin(dot(vec2(vSk.x * 97.0, floor(vSk.y * 7.0)), vec2(12.9898, 78.233))) * 43758.5453); \n' +
          'gl_FragColor = vec4(uInk, 1.0);');
      };
      edgeMat.customProgramCacheKey = function () { return 'sk-edge-1'; };
      meta.meshes.forEach(function (m) {
        var n = m.count, P = new Int16Array(n * 4 * 3), O = new Int16Array(n * 4 * 3), M = new Uint8Array(n * 4 * 4), I = [];
        for (var e = 0; e < n; e++) {
          var s = (m.start + e) * 6, id = Math.floor(((e * 2654435761) >>> 0) % 255);
          for (var v = 0; v < 4; v++) {
            var vi = e * 4 + v, end = v >> 1, side = v & 1;
            for (var k = 0; k < 3; k++) { P[vi * 3 + k] = q[s + k]; O[vi * 3 + k] = q[s + 3 + k]; }
            M[vi * 4] = side; M[vi * 4 + 1] = end; M[vi * 4 + 2] = id; M[vi * 4 + 3] = /context/.test(m.name) ? 1 : 0;
          }
          I.push(e * 4, e * 4 + 1, e * 4 + 2, e * 4 + 1, e * 4 + 3, e * 4 + 2);
        }
        var g = new BG(); g.setAttribute('position', new Attr(P, 3)); g.setAttribute('other', new Attr(O, 3)); g.setAttribute('meta', new Attr(M, 4)); g.setIndex(I);
        var mesh = new Mesh(g, edgeMat); mesh.name = m.name + ' lines'; mesh.frustumCulled = false; mesh.userData.skEdge = true; mesh.renderOrder = 3;
        mesh.onBeforeRender = function (renderer) { var c = renderer.domElement; edgeU.uRes.value = [c.width, c.height]; var pr = c.width / Math.max(1, c.clientWidth); edgeU.uMinW.value = (mobile ? 2.2 : 3) * pr; edgeU.uMaxW.value = (mobile ? 5.5 : 9) * pr; };
        edgeMeshes.push(mesh); scene.add(mesh);
      });
    }
    var base = CFG.edges + (mobile ? '-lite' : '');
    Promise.all([fetch(base + '.json').then(function (r) { return r.json(); }), fetch(base + '.bin').then(function (r) { return r.arrayBuffer(); })]).then(function (res) {
      buildEdges(res[0], res[1]); apply(current);
    }).catch(function (e) { console.warn('Sketch outline unavailable:', e && e.message || e); });
    // ---- paper layer: grain, fibres and a soft vignette over the canvas ----
    var paper = document.createElement('div'); paper.id = 'sk-paper'; paper.setAttribute('aria-hidden', 'true');
    (function () {
      var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d'), s = 99; function r() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }
      x.fillStyle = '#efe6d3'; x.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 5200; i++) { var g = 150 + r() * 100 | 0; x.fillStyle = 'rgba(' + g + ',' + (g - 8) + ',' + (g - 24) + ',' + (.05 + r() * .22) + ')'; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
      for (var f = 0; f < 90; f++) { x.strokeStyle = 'rgba(120,100,70,' + (.05 + r() * .08) + ')'; x.lineWidth = .6; x.beginPath(); var px = r() * 256, py = r() * 256; x.moveTo(px, py); x.lineTo(px + (r() - .5) * 26, py + (r() - .5) * 26); x.stroke(); }
      paper.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;mix-blend-mode:multiply;opacity:0;transition:opacity .4s;background-image:radial-gradient(ellipse at 50% 45%,rgba(255,255,255,0) 55%,rgba(150,120,80,.28) 100%),url(' + c.toDataURL('image/png') + ');background-size:100% 100%,256px 256px';
    })();
    var host = ctx.renderer.domElement.parentElement || document.body; if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(paper);
    var current = CFG.mode || 'watercolor';
    function apply(name) {
      var m = MODES[name] || MODES.realistic; current = name; var phased = name === 'diagram' && !!window.hivePhases; if (phased) m = { style: 0, bg: 0xf4f1ea, edges: true, paper: .15, ink: [.17, .16, .15] };
      shared.uStyle.value = m.style; patchAll();
      if (scene.background && scene.background.isColor) scene.background.setHex(m.bg === null ? (bg0 === null ? 0xdce2e6 : bg0) : m.bg);
      edgeU.uInk.value = m.ink; edgeMeshes.forEach(function (e) { e.visible = m.edges && e.userData.layerOn !== false; });
      paper.style.opacity = m.paper;
      if (window.hivePhases) window.hivePhases.apply(phased);
      if (window.lightViews) window.lightViews.apply(name === 'diagram' && !phased ? 'paper' : 'colors');
      document.documentElement.setAttribute('data-sk', name);
      redraw(ctx);
    }
    window.sketchStyle = { u: edgeU, setMode: apply, mode: function () { return current; }, edges: function () { return edgeMeshes; } };
    apply(current);
  }
})();
