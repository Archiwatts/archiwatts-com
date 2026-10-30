/* Tranquil River pond water. The baked light model has no water surface (the pond reads as a hole), so a turquoise
   surface is laid in the pond, tucked under the rim rocks. It drifts gently on computers and stays still on phones. */
(function () {
  var POND = { cx: -12, cz: -0.5, rx: 16.5, rz: 12.5, y: -0.55 };
  var tries = 0;
  (function wait() {
    var c = window.daylightContext;
    if (window.newProjectViewer && window.newProjectViewer.ready && c && c.scene) { try { run(c); } catch (e) { console.warn('Pond water skipped', e); } }
    else if (tries++ < 600) setTimeout(wait, 150);
  })();
  function attrClass(g) {
    var found = null, nor = g.attributes.normal;
    [nor && nor.constructor, g.index && Object.getPrototypeOf(g.index.constructor), g.index && g.index.constructor].forEach(function (C) {
      if (found || typeof C !== 'function') return;
      try { var probe = new C(new Float32Array(4), 2); if (probe.array && probe.itemSize === 2) found = C; } catch (er) {}
    });
    if (!found) throw new Error('no usable BufferAttribute class');
    return found;
  }
  function run(ctx) {
    var ref = null, std = null;
    ctx.scene.traverse(function (o) { if (!ref && o.isMesh && o.geometry && o.geometry.attributes.position) { ref = o; std = Array.isArray(o.material) ? o.material[0] : o.material; } });
    if (!ref || !std) return;
    var Mesh = ref.constructor, BG = ref.geometry.constructor, Attr = attrClass(ref.geometry), Tex = (std.map || ref.material.map).constructor;
    var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g2 = cv.getContext('2d');
    g2.fillStyle = '#58b9aa'; g2.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 38; i++) { var gr = g2.createRadialGradient(0, 0, 0, 0, 0, 30 + (i * 13) % 40); gr.addColorStop(0, 'rgba(176,228,214,.5)'); gr.addColorStop(1, 'rgba(176,228,214,0)'); g2.save(); g2.translate((i * 97) % 256, (i * 61) % 256); g2.fillStyle = gr; g2.fillRect(-80, -80, 160, 160); g2.restore(); }
    for (var row = 0; row < 16; row++) {
      var y0 = row * 16 + 8, amp = 2.5 + (row % 3), ph = row * .9, k = 2 + (row % 2);
      [['rgba(206,242,232,.8)', 0], ['rgba(30,112,116,.5)', 5]].forEach(function (s) {
        g2.beginPath(); for (var x = 0; x <= 256; x += 4) { var y = y0 + s[1] + Math.sin(x / 256 * Math.PI * 2 * k + ph) * amp; if (x) g2.lineTo(x, y); else g2.moveTo(x, y); }
        g2.strokeStyle = s[0]; g2.lineWidth = s[1] ? 1.6 : 2.4; g2.stroke();
      });
    }
    var tex = new Tex(cv); tex.wrapS = tex.wrapT = 1000; tex.colorSpace = 'srgb'; tex.needsUpdate = true;
    var N = 56, P = [], Nn = [], UV = [], I = [];
    P.push(POND.cx, POND.y, POND.cz); Nn.push(0, 1, 0); UV.push(POND.cx / 7, POND.cz / 7);
    for (var s = 0; s < N; s++) {
      var a = s / N * Math.PI * 2, wob = 1 + .06 * Math.sin(a * 3 + 1) + .04 * Math.sin(a * 5), x2 = POND.cx + Math.cos(a) * POND.rx * wob, z2 = POND.cz + Math.sin(a) * POND.rz * wob;
      P.push(x2, POND.y, z2); Nn.push(0, 1, 0); UV.push(x2 / 7, z2 / 7);
      I.push(0, 1 + s, 1 + (s + 1) % N);
    }
    var g = new BG(); g.setAttribute('position', new Attr(new Float32Array(P), 3)); g.setAttribute('normal', new Attr(new Float32Array(Nn), 3)); g.setAttribute('uv', new Attr(new Float32Array(UV), 2)); g.setIndex(I);
    var m = std.clone(); m.name = 'Tranquil pond water'; m.map = tex; m.normalMap = null; m.roughnessMap = null; m.aoMap = null; m.lightMap = null; m.vertexColors = false; m.toneMapped = false;
    m.color.set('#ffffff'); if (m.emissive) { m.emissive.set('#2f8f88'); m.emissiveIntensity = .5; m.roughness = .35; m.metalness = 0; } m.side = 2; m.transparent = true; m.opacity = .93; m.needsUpdate = true;
    var mesh = new Mesh(g, m); mesh.name = 'Tranquil pond water'; mesh.frustumCulled = false; ctx.scene.add(mesh);
    window.tranquilPond = { mesh: mesh, params: POND };
    var phone = window.modelPerformance && window.modelPerformance.mobile;
    if (!phone) setInterval(function () { if (document.hidden) return; tex.offset.x = (tex.offset.x + .004) % 1; tex.offset.y = (tex.offset.y + .0015) % 1; ctx.controls.dispatchEvent({ type: 'change' }); }, 100);
    else ctx.controls.dispatchEvent({ type: 'change' });
  }
})();
