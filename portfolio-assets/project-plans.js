/* Plans on the model, for any project page (generalised from North Beach Youth Center).
   Configure with window.PROJECT_PLANS = { plans: [ { img, name, floor, cut, tl:[x,z], tr:[x,z], bl:[x,z], sub } ] }:
   img is the plan image, tl/tr/bl where its top-left / top-right / bottom-left corners land in page metres (from the Revit crop box
   and the fit of Revit onto the model), floor the floor height, cut the cut height.
   Pressing Plan shows a level bar; each level's plan is draped onto the real surfaces under its cut in 0.25 m tiles. The drawing
   keeps its white where that level's floor exists (traced from the floor's own triangles, feathered), only linework elsewhere. */
(function () {
  var CFG = window.PROJECT_PLANS; if (!CFG || !CFG.plans || !CFG.plans.length) return;
  function ready() { return document.querySelector('.pc-views') && window.daylightContext && window.projectWalk; }
  (function wait() { if (ready()) init(); else setTimeout(wait, 400); })();
  var st = document.createElement('style');
  st.textContent = '.building-panel .pp-viewbar.pc-plans{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:6px}.building-panel .pp-viewbar.pc-plans[hidden]{display:none!important}.building-panel .pp-viewbar.pc-plans>button{white-space:normal;line-height:1.15;padding-left:2px;padding-right:2px;font-size:11px}';
  document.head.appendChild(st);
  function btn(l, t, on) { var b = document.createElement('button'); b.type = 'button'; b.textContent = l; if (t) b.title = t; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', on); return b; }

  function init() {
    var ctx = window.daylightContext, scene = ctx.scene, vb = document.querySelector('.pc-views'), V3 = ctx.camera.position.constructor;
    var any = null, TexC = null; scene.traverse(function (o) { if (!any && o.isMesh && !o.userData.skEdge && o.geometry.attributes.position) any = o; if (!TexC && o.material && o.material.map) TexC = o.material.map.constructor; });
    if (!any) return; var Mesh = any.constructor, BG = any.geometry.constructor, Attr = any.geometry.attributes.position.constructor;
    function plain(C) { try { var a = new Float32Array(3), p = new C(a, 1); return p.array === a; } catch (e) { return false; } }
    if (!plain(Attr)) scene.traverse(function (o) { if (o.isMesh && o.geometry.index && plain(o.geometry.index.constructor)) Attr = o.geometry.index.constructor; });
    if (!TexC) { var c0 = document.createElement('canvas'); c0.width = c0.height = 2; scene.traverse(function (o) { if (!TexC && o.material && o.material.emissiveMap) TexC = o.material.emissiveMap.constructor; }); }
    // a model without any textures: the texture class from the sun's shadow map (made once the first frame renders)
    if (!TexC) scene.traverse(function (o) { if (!TexC && o.isLight && o.shadow && o.shadow.map && o.shadow.map.texture) TexC = o.shadow.map.texture.constructor; });
    if (!TexC) { setTimeout(init, 1500); return; }
    var label = document.createElement('div'); label.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);background:rgba(20,20,22,.8);color:#fff;font:600 12px/1.3 system-ui,sans-serif;letter-spacing:.05em;padding:8px 14px;border-radius:10px;pointer-events:none;z-index:30;text-align:center;max-width:80vw'; label.hidden = true; document.body.appendChild(label);
    // every model triangle (world space), for the surfaces and the floor masks
    function tris(fn) {
      scene.traverse(function (o) {
        if (!o.isMesh || !o.visible || o.userData.skEdge || /context|life|ink|sprite|drape|lawn|glaz|glass/i.test(o.name || '') || (o.material && o.material.transparent)) return;
        o.updateMatrixWorld(); var p = o.geometry.attributes.position, ix = o.geometry.index ? o.geometry.index.array : null, m = o.matrixWorld.elements, n = ix ? ix.length : p.count;
        function V(i) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
        for (var t = 0; t + 2 < n; t += 3) { var a = V(ix ? ix[t] : t), b = V(ix ? ix[t + 1] : t + 1), c = V(ix ? ix[t + 2] : t + 2); fn(a, b, c); }
      });
    }
    var plane = { normal: new V3(0, -1, 0), constant: 0 }, drape = null, cache = {}, on = null, btns = [];
    function build(P, img) {
      // image <-> page: u along tl->tr, v along tl->bl
      var ux = P.tr[0] - P.tl[0], uz = P.tr[1] - P.tl[1], vx = P.bl[0] - P.tl[0], vz = P.bl[1] - P.tl[1], det = ux * vz - uz * vx;
      function toUV(x, z) { var dx = x - P.tl[0], dz = z - P.tl[1]; return [(dx * vz - dz * vx) / det, (ux * dz - uz * dx) / det]; }
      var xs = [P.tl[0], P.tr[0], P.bl[0], P.tr[0] + vx], zs = [P.tl[1], P.tr[1], P.bl[1], P.tr[1] + vz];
      var X0 = Math.min.apply(null, xs), X1 = Math.max.apply(null, xs), Z0 = Math.min.apply(null, zs), Z1 = Math.max.apply(null, zs);
      var CS = Math.max(.25, Math.sqrt((X1 - X0) * (Z1 - Z0) / 160000)), NX = Math.ceil((X1 - X0) / CS), NZ = Math.ceil((Z1 - Z0) / CS);
      var W = img.width, H = img.height, mc = document.createElement('canvas'); mc.width = W; mc.height = H; var mg = mc.getContext('2d'); mg.fillStyle = '#fff';
      var Hh = new Float32Array(NX * NZ).fill(-1e9), PA = new Float32Array(NX * NZ), PB = new Float32Array(NX * NZ), PC = new Float32Array(NX * NZ);
      tris(function (a, b, c) {
        var hi = Math.max(a[1], b[1], c[1]), lo = Math.min(a[1], b[1], c[1]); if (hi > P.cut - .15) return;
        var ux2 = b[0] - a[0], uy2 = b[1] - a[1], uz2 = b[2] - a[2], vx2 = c[0] - a[0], vy2 = c[1] - a[1], vz2 = c[2] - a[2], nx = uy2 * vz2 - uz2 * vy2, ny = uz2 * vx2 - ux2 * vz2, nz = ux2 * vy2 - uy2 * vx2, l = Math.hypot(nx, ny, nz);
        if (l < 1e-8 || Math.abs(ny) / l < .8) return;
        if (lo > P.floor - .8) { var A = toUV(a[0], a[2]), B = toUV(b[0], b[2]), Cc = toUV(c[0], c[2]); mg.beginPath(); mg.moveTo(A[0] * W, A[1] * H); mg.lineTo(B[0] * W, B[1] * H); mg.lineTo(Cc[0] * W, Cc[1] * H); mg.closePath(); mg.fill(); }
        var pa = -nx / ny, pb = -nz / ny, pc = a[1] - pa * a[0] - pb * a[2], d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-9) return;
        for (var gx = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - X0) / CS)); gx <= Math.min(NX - 1, Math.floor((Math.max(a[0], b[0], c[0]) - X0) / CS)); gx++)
          for (var gz = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - Z0) / CS)); gz <= Math.min(NZ - 1, Math.floor((Math.max(a[2], b[2], c[2]) - Z0) / CS)); gz++) {
            var px = X0 + (gx + .5) * CS, pz = Z0 + (gz + .5) * CS, l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / d, l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / d, l3 = 1 - l1 - l2;
            if (l1 < -.02 || l2 < -.02 || l3 < -.02) continue; var h = l1 * a[1] + l2 * b[1] + l3 * c[1], k = gz * NX + gx; if (h > Hh[k]) { Hh[k] = h; PA[k] = pa; PB[k] = pb; PC[k] = pc; }
          }
      });
      var mf = document.createElement('canvas'); mf.width = W; mf.height = H; var mfg = mf.getContext('2d'); mfg.filter = 'blur(2px)'; mfg.drawImage(mc, 0, 0);
      var md = mfg.getImageData(0, 0, W, H).data, gc = document.createElement('canvas'); gc.width = W; gc.height = H; var gg = gc.getContext('2d'); gg.drawImage(img, 0, 0, W, H);
      var src = gg.getImageData(0, 0, W, H), out = gg.createImageData(W, H);
      for (var i = 0; i < W * H * 4; i += 4) {
        var R = src.data[i], G = src.data[i + 1], B2 = src.data[i + 2], w = md[i + 3] / 255, lum = R * .3 + G * .59 + B2 * .11, la = Math.max(0, Math.min(1, (185 - lum) / 80)), lv = 35 + lum * .15;
        var oa = w * .91 + (1 - w) * la; out.data[i + 3] = Math.round(oa * 255);
        if (oa > 0) { out.data[i] = Math.round((w * .91 * R + (1 - w) * la * lv) / oa); out.data[i + 1] = Math.round((w * .91 * G + (1 - w) * la * lv) / oa); out.data[i + 2] = Math.round((w * .91 * B2 + (1 - w) * la * lv) / oa); }
      }
      gg.putImageData(out, 0, 0);
      var P3 = [], UV = [];
      for (var gz2 = 0; gz2 < NZ; gz2++) for (var gx2 = 0; gx2 < NX; gx2++) {
        var k2 = gz2 * NX + gx2, x0 = X0 + gx2 * CS, x1 = x0 + CS, z0 = Z0 + gz2 * CS, z1 = z0 + CS, has = Hh[k2] > -1e8, hb = has ? Hh[k2] : P.floor;
        var uvc = toUV(x0 + CS / 2, z0 + CS / 2); if (uvc[0] < -.02 || uvc[0] > 1.02 || uvc[1] < -.02 || uvc[1] > 1.02) continue;
        [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]].forEach(function (q) { var y = (has ? Math.min(hb + .25, Math.max(hb - .25, PA[k2] * q[0] + PB[k2] * q[1] + PC[k2])) : hb) + .04, uv = toUV(q[0], q[1]); P3.push(q[0], y, q[1]); UV.push(uv[0], 1 - uv[1]); });
      }
      var g = new BG(), N = new Float32Array(P3.length); for (var j = 1; j < N.length; j += 3) N[j] = 1;
      g.setAttribute('position', new Attr(new Float32Array(P3), 3)); g.setAttribute('normal', new Attr(N, 3)); g.setAttribute('uv', new Attr(new Float32Array(UV), 2));
      var t = new TexC(gc); t.colorSpace = 'srgb'; t.anisotropy = 8; t.needsUpdate = true;
      return { geo: g, tex: t };
    }
    function show(i) {
      btns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); }); if (drape) drape.visible = false;
      if (i === null) { on = null; ctx.renderer.clippingPlanes = []; label.hidden = true; ctx.controls.dispatchEvent({ type: 'change' }); return; }
      var P = CFG.plans[i]; on = i; plane.constant = P.cut; ctx.renderer.clippingPlanes = [plane];
      var cx = (P.tl[0] + P.tr[0] + P.bl[0] + P.tr[0] + P.bl[0] - P.tl[0]) / 4, cz = (P.tl[1] + P.tr[1] + P.bl[1] + P.tr[1] + P.bl[1] - P.tl[1]) / 4, span = Math.max(Math.hypot(P.tr[0] - P.tl[0], P.tr[1] - P.tl[1]), Math.hypot(P.bl[0] - P.tl[0], P.bl[1] - P.tl[1]));
      var cam = ctx.camera, half = Math.tan(cam.fov * Math.PI / 360), h = span * .62 / half;
      cam.position.set(cx, P.floor + h, cz + .01); ctx.controls.target.set(cx, P.floor, cz); if (cam.far < h + 200) { cam.far = h + 200; cam.updateProjectionMatrix(); } ctx.controls.update && ctx.controls.update();
      label.innerHTML = ''; var b1 = document.createElement('div'); b1.textContent = (P.name + ' plan').toUpperCase(); var b2 = document.createElement('div'); b2.textContent = P.sub || ''; b2.style.cssText = 'font-weight:400;opacity:.85'; label.appendChild(b1); label.appendChild(b2); label.hidden = false;
      function put(d) {
        if (on !== i) return;
        if (!drape) { var m = new (any.material.constructor)(); m.name = 'Project plan drape'; m.color.set('#000000'); if (m.emissive) m.emissive.set('#ffffff'); m.roughness = 1; m.metalness = 0; m.toneMapped = false; m.transparent = true; m.alphaTest = .03; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -6; m.polygonOffsetUnits = -6; m.side = 2;
          drape = new Mesh(d.geo, m); drape.name = 'Project plan drape'; drape.userData.skEdge = true; drape.userData.noWalk = true; drape.renderOrder = 5; drape.frustumCulled = false; scene.add(drape); }
        drape.geometry = d.geo; drape.material.map = d.tex; drape.material.emissiveMap = d.tex; drape.material.needsUpdate = true; drape.visible = true; ctx.controls.dispatchEvent({ type: 'change' });
      }
      if (cache[i]) { put(cache[i]); return; }
      var img = new Image(); img.onload = function () { setTimeout(function () { cache[i] = build(P, img); put(cache[i]); }, 20); }; img.src = P.img;
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    var row = document.createElement('div'); row.className = 'pp-viewbar pc-plans'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Plan levels'); row.hidden = true;
    if (CFG.plans.length < 4) row.style.gridTemplateColumns = 'repeat(' + CFG.plans.length + ',minmax(0,1fr))';
    CFG.plans.forEach(function (P, i) { var b = btn(P.name, P.sub, function () { show(i); }); btns.push(b); row.appendChild(b); });
    vb.parentNode.insertBefore(row, vb.nextSibling);
    vb.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-v]'); if (!b) return;
      if (b.getAttribute('data-v') === 'top') { row.hidden = false; var last = null, n = 0; (function settle() { var p = ctx.camera.position, s = p.x.toFixed(2) + p.y.toFixed(2) + p.z.toFixed(2); if ((s === last && n > 3) || n > 40) show(on === null ? 0 : on); else { last = s; n++; setTimeout(settle, 60); } })(); }
      else { row.hidden = true; if (on !== null) show(null); }
    });
    window.projectPlans = { show: show, plans: CFG.plans };
  }
})();
