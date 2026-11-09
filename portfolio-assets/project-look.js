/* Shared look for every project page (from the North Beach Youth Center work):
   - the surrounding context as a study model: whiter basswood blocks with grey ink outlines and a ground line where each wall meets
     the ground; the line weight follows distance and edge size, so zoomed out only the masses are outlined and detail drops away
   - Diagram view: bold outlines on the project too
   - live sun shadows (soft, one map over the site; phones skip them)
   Context meshes are the page's PROJECT_PANEL.context, or names starting "Site_context". */
(function () {
  var CFG = window.PROJECT_LOOK || {};
  function ready() { var c = window.daylightContext; return c && c.scene && c.renderer && window.projectWalk && window.sketchStyle; }
  (function wait() { if (ready()) setTimeout(init, 600); else setTimeout(wait, 400); })();
  var ANGLE = Math.cos(55 * Math.PI / 180), BASSWOOD = CFG.massing || '#e9dcc0';

  function init() {
    var ctx = window.daylightContext, scene = ctx.scene, P = window.PROJECT_PANEL || {}, ctxRe = P.context && P.context !== 'auto' ? new RegExp(P.context, 'i') : /^Site_context/i;
    var any = null; scene.traverse(function (o) { if (!any && o.isMesh && o.geometry && o.geometry.attributes.position && !o.userData.skEdge) any = o; }); if (!any) return;
    var Mesh = any.constructor, BG = any.geometry.constructor, Attr = any.geometry.attributes.position.constructor;
    function plainAttr(C) { try { var a = new Float32Array(3), p = new C(a, 1); return p.array === a; } catch (e) { return false; } }
    if (!plainAttr(Attr)) { scene.traverse(function (o) { if (o.isMesh && o.geometry.index && plainAttr(o.geometry.index.constructor)) Attr = o.geometry.index.constructor; }); }
    var isCtx = function (o) { return ctxRe.test(o.name || '') || (o.material && ctxRe.test(o.material.name || '')); };
    // ground, water and planting in the context keep their own look (and draw no ink): only buildings become the study model
    var SOFT = new RegExp('landscape|water|canal|grass|lawn|tree|plant|terrain|topo' + (CFG.soft ? '|' + CFG.soft : ''), 'i'), isSoft = function (o) { return SOFT.test(o.name || ''); };

    // ---- massing context: whiter basswood (tiled roofs in terracotta when PROJECT_LOOK.roofs is set) ----
    var ROOF = CFG.roofs ? new (any.material.color.constructor)(CFG.roofs === true ? '#c8714a' : CFG.roofs) : null;
    // PROJECT_LOOK.massing === false: the context keeps its own colours and draws no ink (a ship or large object as context)
    var KEEP = CFG.massing === false;
    if (!KEEP) scene.traverse(function (o) { if (o.isMesh && isCtx(o) && !isSoft(o) && o.material && !Array.isArray(o.material) && o.material.color && !o.userData.skEdge) { var mm = o.material; mm.map = null; mm.vertexColors = false; mm.emissiveMap = null; mm.color.set(BASSWOOD); if (mm.emissive) mm.emissive.set('#000000'); mm.roughness = .9; mm.metalness = 0;   /* textures off: plain model material */
        // pages that paint their city in a shader (Venice's roofs) still end up basswood: the colour is set again after any such painting
        if (!mm.userData.pcMass) { mm.userData.pcMass = true; var prev = mm.onBeforeCompile, pk = mm.customProgramCacheKey; var bc = new (mm.color.constructor)(BASSWOOD);
          var v3 = function (c) { return 'vec3(' + c.r.toFixed(3) + ',' + c.g.toFixed(3) + ',' + c.b.toFixed(3) + ')'; };
          var body = 'diffuseColor.rgb = ' + v3(bc) + ';\n';
          // sloped faces are pitched tile roofs: world normal from the screen-space derivatives of the view position
          if (ROOF) body += '{ vec3 pcN = normalize((vec4(normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition))), 0.) * viewMatrix).xyz); float ay = abs(pcN.y);\n' +
            '  if (ay > .3 && ay < .985) { ' + (CFG.roofTile ? 'vec3 pcP = (inverse(viewMatrix) * vec4(-vViewPosition, 1.)).xyz; diffuseColor.rgb = pcTile(pcN, pcP, ' + v3(ROOF) + ');' : 'diffuseColor.rgb = ' + v3(ROOF) + ';') + ' } }\n';
          // Spanish (barrel) tile for pitched roofs: columns of half-round tiles, overlapping courses, a shade per tile, fading to the average colour at a distance
          var TILE = 'vec3 pcG = vec3(0.); float pcA = 0.;\n' + 'float pcH(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }\n' +
            'vec3 pcTile(vec3 N, vec3 P, vec3 base){ N = normalize(floor(N*24.+.5)/24.); P -= vec3(170.,0.,-200.); vec3 dn = normalize(vec3(0.,-1.,0.) - N*dot(N, vec3(0.,-1.,0.))); vec3 ac = normalize(cross(N, dn)); float u = dot(P, ac)/.36, v = dot(P, dn)/.6; float cu = fract(u), cv = fract(v); float prof = .5+.5*cos(6.2832*cu);\n' +
            ' vec2 id = vec2(floor(u*2.), floor(v)); float h1 = pcH(id*1.7+3.3), h2 = pcH(id*2.9+8.1); float fw = max(fwidth(u), fwidth(v)); float fade = 1. - smoothstep(.1,.38,fw);\n' +
            ' float shade = .66+.46*prof; shade *= .8+.2*smoothstep(0.,.16,cv); shade *= 1.-.22*smoothstep(.86,1.,cv)*(1.-prof); vec3 tint = mix(vec3(1.05,.86,.72), vec3(.92,.74,.62), h1); vec3 c = base*tint*(.94+.12*h2)*shade; if (h2 > .94) c *= .86;\n' +
            ' float dprof = -.5*6.2832*sin(6.2832*cu)/.36; float dov = ((cv<.16 ? .2/.16 : 0.) - (cv>.86 ? .22/.14 : 0.))/.6; pcG = dprof*ac*.075; pcA = (1. - smoothstep(.05,.2,fw));\n' +
            ' return mix(base*vec3(.98,.8,.67)*.86, c, fade); }\n';
          mm.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); sh.fragmentShader = (CFG.roofTile ? TILE : '') + sh.fragmentShader.replace('#include <roughnessmap_fragment>', body + '#include <roughnessmap_fragment>').replace('#include <normal_fragment_maps>', CFG.roofTile ? '#include <normal_fragment_maps>\n normal = normalize(normal - pcA*(viewMatrix*vec4(pcG,0.)).xyz);' : '#include <normal_fragment_maps>'); };
          mm.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + '-pcmass' + (ROOF ? 'r' : ''); }; }
        mm.needsUpdate = true; } });

    // ---- ink lines: thick screen-space strips, weight scaled by distance and edge length ----
    var U = { uRes: { value: [1, 1] }, uMinW: { value: 1.4 }, uMaxW: { value: 3.2 }, uWorldW: { value: .5 }, uInk: { value: [.3, .3, .31] } };
    var mat = new (any.material.constructor)(); mat.name = 'Hive sketch project ink'; mat.side = 2; mat.fog = false;
    mat.onBeforeCompile = function (shader) {
      Object.keys(U).forEach(function (k) { shader.uniforms[k] = U[k]; });
      shader.vertexShader = 'attribute vec3 other; attribute vec2 side; attribute float elen; uniform vec2 uRes; uniform float uMinW; uniform float uMaxW; uniform float uWorldW;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);')
        .replace('#include <project_vertex>',
          'vec4 a4 = modelViewMatrix * vec4(position, 1.0), b4 = modelViewMatrix * vec4(other, 1.0); a4.z += .06 + .003 * abs(a4.z); b4.z += .06 + .003 * abs(b4.z); vec4 mvPosition = a4;\n' +
          'float nz = -.2; bool gone = a4.z > nz && b4.z > nz; if (!gone) { if (a4.z > nz) a4 = a4 + (b4 - a4) * ((nz - a4.z) / (b4.z - a4.z)); else if (b4.z > nz) b4 = b4 + (a4 - b4) * ((nz - b4.z) / (a4.z - b4.z)); }\n' +
          'vec4 ca = projectionMatrix * a4, cb = projectionMatrix * b4; vec2 sa = ca.xy / ca.w, sb = cb.xy / cb.w; vec2 dir = (sb - sa) * uRes; float dl = length(dir); dir = dl > 1e-5 ? dir / dl : vec2(1., 0.);\n' +
          'vec2 nrm = vec2(-dir.y, dir.x); float focal = projectionMatrix[1][1] * uRes.y * .5;\n' +
          'float imp = clamp(elen / 8., .25, 1.); float wpx = min(uWorldW * imp * focal / max(.5, -a4.z), uMaxW); float minPx = mix(26., 6., imp);\n' +
          'if (wpx < uMinW * .45 || dl < minPx) gone = true; wpx = max(wpx, uMinW * .6);\n' +
          'vec4 cc = ca; cc.xy += nrm * side.x * wpx / uRes * cc.w; if (gone) cc = vec4(2., 2., 2., 1.); gl_Position = cc;');
      shader.fragmentShader = 'uniform vec3 uInk;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor = vec4(uInk, 1.0);');
    };
    mat.customProgramCacheKey = function () { return 'project-ink'; };
    function strips(E, name) {
      var n = E.length / 6, Pp = new Float32Array(n * 12), O = new Float32Array(n * 12), S = new Float32Array(n * 8), LN = new Float32Array(n * 4), I = new Uint32Array(n * 6);
      for (var e = 0; e < n; e++) {
        var a = [E[e * 6], E[e * 6 + 1], E[e * 6 + 2]], b = [E[e * 6 + 3], E[e * 6 + 4], E[e * 6 + 5]], el = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        [[a, b, -1], [a, b, 1], [b, a, 1], [b, a, -1]].forEach(function (v, k) { var j = (e * 4 + k) * 3; Pp[j] = v[0][0]; Pp[j + 1] = v[0][1]; Pp[j + 2] = v[0][2]; O[j] = v[1][0]; O[j + 1] = v[1][1]; O[j + 2] = v[1][2]; S[(e * 4 + k) * 2] = v[2]; LN[e * 4 + k] = el; });
        var q = e * 4; I.set([q, q + 1, q + 2, q, q + 2, q + 3], e * 6);
      }
      var g = new BG(); g.setAttribute('position', new Attr(Pp, 3)); g.setAttribute('other', new Attr(O, 3)); g.setAttribute('side', new Attr(S, 2)); g.setAttribute('elen', new Attr(LN, 1)); g.setIndex(new Attr(I, 1));
      var m = new Mesh(g, mat); m.name = name; m.frustumCulled = false; m.renderOrder = 4; m.userData.skEdge = true; m.userData.noWalk = true; m.visible = false; scene.add(m);
      m.onBeforeRender = function (r) { var c = r.domElement, pr = c.width / Math.max(1, c.clientWidth); U.uRes.value = [c.width, c.height]; U.uMinW.value = 1.4 * pr; U.uMaxW.value = 3.2 * pr; };
      return m;
    }
    // feature edges of a set of meshes (welded; faces meeting at more than 55 degrees, and open edges), plus their ground line
    var G = groundLevel();
    // street level: the height with the most upward-facing context area near the project (canal water and the model's lowest point
    // sit below the streets, and a ground line drawn there floats in the water)
    function groundLevel() {
      var bx = window.projectWalk.box, pad = 80, H = new Map();
      scene.traverse(function (o) {
        if (!o.isMesh || o.userData.skEdge || !isCtx(o) || /water|canal/i.test(o.name || '') || !o.geometry.attributes.position) return;
        o.updateMatrixWorld(); var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, m = o.matrixWorld.elements, n = ix ? ix.length : p.count, st = Math.max(3, Math.floor(n / 600000) * 3);
        function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
        for (var t = 0; t + 2 < n; t += st) {
          var a = V(ix ? ix[t] : t); if (a[0] < bx[0] - pad || a[0] > bx[3] + pad || a[2] < bx[2] - pad || a[2] > bx[5] + pad) continue;
          var b = V(ix ? ix[t + 1] : t + 1), c = V(ix ? ix[t + 2] : t + 2), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz); if (l < 1e-6 || ny / l < .95) continue;   // facing up only (a site base's underside is not the street)
          var k = Math.round((a[1] + b[1] + c[1]) / 3 * 4); H.set(k, (H.get(k) || 0) + l / 2);
        }
      });
      var best = null, bw = 0; H.forEach(function (w, k) { if (k / 4 < bx[1] + 12 && w > bw) { bw = w; best = k / 4; } });
      return best == null ? bx[1] : best;
    }
    function featureEdges(meshes, ground, roofOnly) {
      var E = [];
      meshes.forEach(function (o) {
        o.updateMatrixWorld(); var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, mw = o.matrixWorld.elements, nv = p.count; if (nv > 4000000) return;
        var W = new Float32Array(nv * 3); for (var i = 0; i < nv; i++) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); W[i * 3] = mw[0] * x + mw[4] * y + mw[8] * z + mw[12]; W[i * 3 + 1] = mw[1] * x + mw[5] * y + mw[9] * z + mw[13]; W[i * 3 + 2] = mw[2] * x + mw[6] * y + mw[10] * z + mw[14]; }
        // indexed meshes already share vertices on smooth surfaces and split them at hard creases, so they're used as they are (fast on big
        // models); loose triangles are welded first
        var id = new Int32Array(nv), Pw = W;
        if (ix) { for (var v0 = 0; v0 < nv; v0++) id[v0] = v0; }
        else { var key = new Map(), Pl = []; for (var v = 0; v < nv; v++) { var k = Math.round(W[v * 3] * 50) + ',' + Math.round(W[v * 3 + 1] * 50) + ',' + Math.round(W[v * 3 + 2] * 50), r = key.get(k); if (r === undefined) { r = Pl.length / 3; key.set(k, r); Pl.push(W[v * 3], W[v * 3 + 1], W[v * 3 + 2]); } id[v] = r; } Pw = Pl; }
        var nt = (ix ? ix.length : nv) / 3, N = new Float32Array(nt * 3), edges = new Map(), out = [], steep = [], roofy = [];
        for (var t = 0; t < nt; t++) {
          var a = id[ix ? ix[t * 3] : t * 3], b = id[ix ? ix[t * 3 + 1] : t * 3 + 1], c = id[ix ? ix[t * 3 + 2] : t * 3 + 2]; if (a === b || b === c || a === c) continue;
          var ux = Pw[b * 3] - Pw[a * 3], uy = Pw[b * 3 + 1] - Pw[a * 3 + 1], uz = Pw[b * 3 + 2] - Pw[a * 3 + 2], vx = Pw[c * 3] - Pw[a * 3], vy = Pw[c * 3 + 1] - Pw[a * 3 + 1], vz = Pw[c * 3 + 2] - Pw[a * 3 + 2];
          var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; N[t * 3] = nx / l; N[t * 3 + 1] = ny / l; N[t * 3 + 2] = nz / l;
          [[a, b], [b, c], [c, a]].forEach(function (e) { var k2 = e[0] < e[1] ? e[0] * 4194304 * 16 + e[1] : e[1] * 4194304 * 16 + e[0], f = edges.get(k2); if (f === undefined) edges.set(k2, t); else if (f >= 0) { var d = N[f * 3] * N[t * 3] + N[f * 3 + 1] * N[t * 3 + 1] + N[f * 3 + 2] * N[t * 3 + 2]; if (d < ANGLE) { out.push(e[0], e[1]); steep.push(Math.min(Math.abs(N[f * 3 + 1]), Math.abs(N[t * 3 + 1])) < .5); roofy.push(Math.max(N[f * 3 + 1], N[t * 3 + 1]) > .35); } edges.set(k2, -1); } });
          // ground line: a wall face crossing ground level
          if (ground && Math.abs(N[t * 3 + 1]) < .5) {
            var GY = G + .08, V = [[Pw[a * 3], Pw[a * 3 + 1], Pw[a * 3 + 2]], [Pw[b * 3], Pw[b * 3 + 1], Pw[b * 3 + 2]], [Pw[c * 3], Pw[c * 3 + 1], Pw[c * 3 + 2]]], pts = [];
            for (var e2 = 0; e2 < 3; e2++) { var pa = V[e2], pb = V[(e2 + 1) % 3]; if ((pa[1] - GY) * (pb[1] - GY) < 0) { var tt = (GY - pa[1]) / (pb[1] - pa[1]); pts.push(pa[0] + (pb[0] - pa[0]) * tt, GY, pa[2] + (pb[2] - pa[2]) * tt); } }
            if (pts.length === 6) E.push.apply(E, pts);
          }
        }
        edges.forEach(function (f, k2) { if (f >= 0) { var hi2 = Math.floor(k2 / 67108864); out.push(hi2, k2 - hi2 * 67108864); steep.push(Math.abs(N[f * 3 + 1]) < .5); roofy.push(N[f * 3 + 1] > .35); } });
        for (var j = 0; j < out.length; j += 2) { if (roofOnly && !roofy[j / 2]) continue; var A = out[j] * 3, B = out[j + 1] * 3, hi = Math.max(Pw[A + 1], Pw[B + 1]); if (hi < G - .3 || (hi < G + .35 && !steep[j / 2])) continue; if (Math.hypot(Pw[A] - Pw[B], Pw[A + 1] - Pw[B + 1], Pw[A + 2] - Pw[B + 2]) < .25) continue; E.push(Pw[A], Pw[A + 1], Pw[A + 2], Pw[B], Pw[B + 1], Pw[B + 2]); }
      });
      return E;
    }
    var ctxMeshes = [], projMeshes = [];
    scene.traverse(function (o) { if (!o.isMesh || o.userData.skEdge || !o.geometry || !o.geometry.attributes.position) return; if (/life|sprite|people|car|tree|lawn|drape|overlay|boat/i.test(o.name || '') || isSoft(o)) return; (isCtx(o) ? ctxMeshes : projMeshes).push(o); });
    var ctxInk = ctxMeshes.length && !KEEP ? strips(new Float32Array(featureEdges(ctxMeshes, true)), 'Project ink context') : null, projInk = null;
    // PROJECT_LOOK.roofInk: names of project meshes whose roof edges get a slight ink outline (Realistic and Watercolor)
    var roofMeshes = CFG.roofInk ? projMeshes.filter(function (o) { return new RegExp(CFG.roofInk, 'i').test(o.name || ''); }) : [], roofInk = null;
    function apply() {
      var mode = document.documentElement.getAttribute('data-sk') || 'realistic';
      if (ctxInk) ctxInk.visible = ctxMeshes.some(function (o) { return o.visible; });
      if (mode === 'diagram' && !projInk) { var E = featureEdges(projMeshes, false); if (E.length) projInk = strips(new Float32Array(E), 'Project ink project'); }
      if (projInk) projInk.visible = mode === 'diagram';
      if (roofMeshes.length && !roofInk) { var RE = featureEdges(roofMeshes, false, true); if (RE.length) roofInk = strips(new Float32Array(RE), 'Project ink roof'); }
      if (roofInk) roofInk.visible = mode !== 'diagram';
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sk'] });
    setInterval(function () { if (ctxInk) { var v = ctxMeshes.some(function (o) { return o.visible; }); if (v !== ctxInk.visible) { ctxInk.visible = v; ctx.controls.dispatchEvent({ type: 'change' }); } } }, 800);   // follows the panel's context Hidden setting
    apply();

    // ---- live sun shadows ----
    var phone = !!(window.modelPerformance && window.modelPerformance.mobile);
    if (!phone && CFG.shadows !== false) {
      var sun = null; scene.traverse(function (o) { if (!sun && o.isDirectionalLight) sun = o; });
      if (sun) {
        var b = window.projectWalk.box, cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, cy = b[1], Rr = Math.max(30, Math.hypot(b[3] - b[0], b[5] - b[2]) * .75), D = [.34, .85, .41];
        sun.position.set(cx + D[0] * Rr * 2, cy + D[1] * Rr * 2, cz + D[2] * Rr * 2); sun.target.position.set(cx, cy, cz); if (!sun.target.parent) scene.add(sun.target);
        sun.castShadow = true; var sh = sun.shadow; sh.mapSize.set(4096, 4096); sh.bias = -.0004; sh.normalBias = .04; sh.radius = 3;
        var cam = sh.camera; cam.left = -Rr; cam.right = Rr; cam.top = Rr; cam.bottom = -Rr; cam.near = 1; cam.far = Rr * 5; cam.updateProjectionMatrix();
        ctx.renderer.shadowMap.enabled = true; ctx.renderer.shadowMap.type = 2;
        scene.traverse(function (o) { if (o.isMesh && !o.userData.skEdge && !(o.material && o.material.transparent)) { o.castShadow = true; o.receiveShadow = true; (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m) m.needsUpdate = true; }); } });
      }
    }
    window.projectLook = { ctxInk: ctxInk, apply: apply, contextMeshes: ctxMeshes.length, ground: G };
  }
})();
