/* Tranquil River, desktop only: the pond terrain, banks and palms from the Revit model (_source-models/tools/revit_site.py,
   site2web.py) in place of the page's simplified copies. Phones keep the light model.
   Files (gzipped, next to the page): site-terrain.bin.gz  -- terrain parts, each for a page material
                                      site-palms.bin.gz    -- the palm shapes (vertex-coloured trunk / fronds) and a matrix per tree
   Hides the page's own zone-7 bank / bed / terrain meshes and the palm canopy and trunk instances they replace. */
(function () {
  if (window.modelPerformance && window.modelPerformance.mobile) return;
  var CFG = window.TRANQUIL_SITE || {}, HIDE = CFG.hide || /^zone-7_(spring_bank|terrain_bank|spring_bed)|^zone-8_(palm_canopy|palm_trunk)/;
  function ready() { var c = window.daylightContext; return c && c.scene && c.scene.getObjectByName('zone-7_spring_bank') && c.scene.getObjectByName('zone-8_palm_canopy'); }
  (function wait(n) { if (ready()) setTimeout(init, 800); else if (n < 400) setTimeout(function () { wait(n + 1); }, 400); })(0);
  function gunzip(url) { return fetch(url).then(function (r) { if (!r.ok) throw 0; return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }); }
  function parse(buf) { var dv = new DataView(buf), hl = dv.getUint32(4, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl))); return { hdr: hdr, at: 8 + hl }; }
  function init() {
    var ctx = window.daylightContext, scene = ctx.scene, mats = {}, inst0 = scene.getObjectByName('zone-8_palm_canopy');
    scene.traverse(function (o) { if (o.isMesh && o.material && !Array.isArray(o.material)) mats[o.material.name] = o.material; });
    var any = inst0, Mesh = any.constructor.prototype.isInstancedMesh ? null : any.constructor, IM = inst0.constructor, BG = inst0.geometry.constructor, Attr = inst0.geometry.attributes.position.constructor;
    function plain(C) { try { var q = new Float32Array(3); return new C(q, 1).array === q; } catch (e) { return false; } }
    var M = null; scene.traverse(function (o) { if (!M && o.isMesh && !o.isInstancedMesh) M = o.constructor; });
    if (!plain(Attr)) scene.traverse(function (o) { if (o.isMesh && o.geometry.index && plain(o.geometry.index.constructor)) Attr = o.geometry.index.constructor; });
    var std = inst0.material.constructor, made = [];
    function show() { scene.traverse(function (o) { if (o.isMesh && HIDE.test((o.name || '').replace(/ lines$/, '')) && !o.userData.revitSite) { o.visible = false; o.userData.noWalk = true; } }); }
    Promise.all([gunzip('site-terrain.bin.gz?v=' + (CFG.v || 1)), gunzip('site-palms.bin.gz?v=' + (CFG.v || 1))]).then(function (B) {
      // terrain
      var T = parse(B[0]), at = T.at;
      T.hdr.parts.forEach(function (p) {
        var q = new Uint16Array(B[0].slice(at, at + p.nv * 6)); at += p.nv * 6; var I = new Uint32Array(B[0].slice(at, at + p.nt * 12)); at += p.nt * 12;
        var P = new Float32Array(p.nv * 3); for (var i = 0; i < p.nv * 3; i++) { var a = i % 3; P[i] = p.min[a] + q[i] / 65535 * (p.max[a] - p.min[a]); }
        var g = new BG(); g.setAttribute('position', new Attr(P, 3)); g.setIndex(new Attr(I, 1)); g.computeVertexNormals();
        var mat = mats[p.mat]; if (!mat) return; var m = new M(g, mat); m.name = 'zone-7_site_' + p.mat.replace(/\W+/g, '_'); m.receiveShadow = true; m.castShadow = true; m.userData.revitSite = true; m.userData.noWalk = false; scene.add(m); made.push(m);
      });
      // palms
      var Pp = parse(B[1]); at = Pp.at;
      var pm = new std(); pm.name = 'Tranquil palms (Revit)'; pm.vertexColors = true; pm.color.set('#ffffff'); pm.roughness = .8; pm.metalness = 0; pm.side = 2; pm.userData.skKeep = 1;
      if (window.sketchStyle && window.sketchStyle.patch) try { window.sketchStyle.patch(pm); } catch (e) {}
      Pp.hdr.parts.forEach(function (p) {
        var loc = new Float32Array(B[1].slice(at, at + p.nv * 12)); at += p.nv * 12; var col = new Uint8Array(B[1].slice(at, at + p.nv * 3)); at += p.nv * 3; var mx = new Float32Array(B[1].slice(at, at + p.n * 64)); at += p.n * 64;
        var C = new Float32Array(p.nv * 3); for (var i = 0; i < C.length; i++) { var v = col[i] / 255; C[i] = Math.pow(v, 2.2); }       // vertex colours are linear
        var g = new BG(); g.setAttribute('position', new Attr(loc, 3)); g.setAttribute('color', new Attr(C, 3)); g.computeVertexNormals();
        var im = new IM(g, pm, p.n); im.instanceMatrix.array.set(mx); im.instanceMatrix.needsUpdate = true; im.name = 'zone-8_palmrevit_' + p.sid; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.userData.revitSite = true; im.userData.noWalk = true; scene.add(im); made.push(im);
      });
      show(); ctx.controls.dispatchEvent({ type: 'change' }); window.tranquilSite = { parts: made.length };
    }).catch(function (e) { console.warn('Tranquil Revit site not loaded', e); });
  }
})();
