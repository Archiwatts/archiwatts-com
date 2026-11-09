/* Baked daylight for any project page: a 3D grid of light values (sun + sky with shadows and bounce, baked in Blender with
   _source-models/tools/blender_grid.py) is read here and every project surface is shaded from it by position -- shadowed,
   enclosed and sheltered surfaces darken, open ones stay bright. Works however the model is packed.
   The grid is in the model's own (glTF) coordinates, so the page's model root transform is undone in the shader.
   File: light-grid.bin next to the page (uint32 header length, JSON {min, max, n}, then n.x*n.y*n.z uint8, x fastest, then z,
   then y). Context meshes are left alone (they are the massing model). */
(function () {
  var URL = (window.PROJECT_LIGHT && window.PROJECT_LIGHT.url) || 'light-grid.bin?v=1', STRENGTH = (window.PROJECT_LIGHT && window.PROJECT_LIGHT.strength) || .8;
  function ready() { var c = window.daylightContext; return c && c.scene && window.projectWalk && window.sketchStyle; }
  (function wait() { if (ready()) init(); else setTimeout(wait, 400); })();
  function init() {
    fetch(URL).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
      var ctx = window.daylightContext, scene = ctx.scene, hl = new DataView(buf).getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), g = new Uint8Array(buf, 4 + hl);
      var nx = h.n[0], ny = h.n[1], nz = h.n[2], cols = Math.ceil(Math.sqrt(ny)), rows = Math.ceil(ny / cols);
      // atlas: one slice per height (x across, z down), slices tiled
      var cv = document.createElement('canvas'); cv.width = nx * cols; cv.height = nz * rows; var c2 = cv.getContext('2d'), im = c2.createImageData(cv.width, cv.height);
      for (var y = 0; y < ny; y++) { var ox = (y % cols) * nx, oy = Math.floor(y / cols) * nz; for (var z = 0; z < nz; z++) for (var x = 0; x < nx; x++) { var v = g[(y * nz + z) * nx + x], o = ((oy + z) * cv.width + ox + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255; } }
      c2.putImageData(im, 0, 0);
      var TexC = null; scene.traverse(function (o) { if (!TexC && o.material && (o.material.map || o.material.emissiveMap)) TexC = (o.material.map || o.material.emissiveMap).constructor; });
      // a model without any textures: borrow the texture class from the sun's shadow map (pages here render live shadows)
      if (!TexC) scene.traverse(function (o) { if (!TexC && o.isLight && o.shadow && o.shadow.map && o.shadow.map.texture) TexC = o.shadow.map.texture.constructor; });
      if (!TexC && ctx.renderer.getRenderTarget && ctx.scene.background && ctx.scene.background.isTexture) TexC = ctx.scene.background.constructor;
      if (!TexC) { setTimeout(function () { init(); }, 1500); return; }
      var tex = new TexC(cv); tex.generateMipmaps = false; tex.minFilter = tex.magFilter = 1006; tex.needsUpdate = true;
      // the model root: the topmost parent under the scene; its inverse world matrix takes page positions back to glTF space
      var root = null, P = window.PROJECT_PANEL || {}, ctxRe = P.context && P.context !== 'auto' ? new RegExp(P.context, 'i') : /^Site_context/i;
      scene.traverse(function (o) { if (!root && o.isMesh && !o.userData.skEdge && !ctxRe.test(o.name || '')) { var p = o; while (p.parent && p.parent !== scene) p = p.parent; root = p; } });
      if (!root) return; root.updateMatrixWorld(true);
      var M4 = ctx.camera.matrixWorld.constructor, inv = new M4().copy(root.matrixWorld).invert();
      var U = { lgTex: { value: tex }, lgMin: { value: h.min }, lgSize: { value: [h.max[0] - h.min[0], h.max[1] - h.min[1], h.max[2] - h.min[2]] }, lgN: { value: [nx, ny, nz] }, lgCols: { value: cols }, lgRows: { value: rows }, lgInv: { value: inv }, lgK: { value: STRENGTH } };
      var GL = 'uniform sampler2D lgTex; uniform vec3 lgMin, lgSize, lgN; uniform float lgCols, lgRows, lgK; uniform mat4 lgInv; varying vec3 vLgW; varying vec3 vLgN;\n' +
        'float lgSlice(vec2 xz, float yi) { float c = mod(yi, lgCols), r = floor(yi / lgCols); vec2 uv = (vec2(c, r) * lgN.xz + clamp(xz, vec2(.5), lgN.xz - .5)) / (lgN.xz * vec2(lgCols, lgRows)); return texture2D(lgTex, vec2(uv.x, 1. - uv.y)).r; }\n';
      var done = new WeakSet();
      scene.traverse(function (o) {
        if (!o.isMesh || o.userData.skEdge || ctxRe.test(o.name || '') || /life|sprite|people|car|tree|lawn|drape|ink/i.test(o.name || '')) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
          if (!m || done.has(m) || !m.isMeshStandardMaterial || m.transparent) return; done.add(m);
          var prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
          m.onBeforeCompile = function (sh, r) {
            if (prev) prev.call(this, sh, r); Object.keys(U).forEach(function (k) { sh.uniforms[k] = U[k]; });
            sh.vertexShader = 'uniform mat4 lgInv; varying vec3 vLgW; varying vec3 vLgN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 lgw = modelMatrix * vec4(transformed, 1.0); vLgW = (lgInv * lgw).xyz; vLgN = normalize(mat3(lgInv) * (mat3(modelMatrix) * objectNormal));');
            sh.fragmentShader = GL + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' +
              ' { vec3 q = (vLgW + normalize(vLgN) * .55 - lgMin) / lgSize * (lgN - 1.); float y0 = clamp(floor(q.y), 0., lgN.y - 1.), y1 = min(y0 + 1., lgN.y - 1.), fy = clamp(q.y - y0, 0., 1.);\n' +
              '   float L = mix(lgSlice(q.xz + .5, y0), lgSlice(q.xz + .5, y1), fy); bool inside = all(greaterThanEqual(q, vec3(0.))) && all(lessThanEqual(q, lgN - 1.));\n' +
              '   if (inside) diffuseColor.rgb *= mix(1., .3 + .85 * L, lgK); }');
          };
          m.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + '-lgrid'; }; m.needsUpdate = true;
        });
      });
      ctx.controls.dispatchEvent({ type: 'change' }); window.projectLight = { header: h, materials: true };
    }).catch(function () {});
  }
})();
