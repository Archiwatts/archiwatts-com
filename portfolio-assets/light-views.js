/* Light model pages: crisper baked textures, and a view switch (model colors, paper diagram, clay) used by the project panel. */
(function () {
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene; }
  var tries = 0;
  (function wait() {
    if (ready()) { try { run(); } catch (e) { console.warn('Light views skipped', e); } }
    else if (tries++ < 500) setTimeout(wait, 150);
  })();
  function redraw(ctx) { if (ctx.controls && ctx.controls.dispatchEvent) ctx.controls.dispatchEvent({ type: 'change' }); }
  var SKIP = /^Hive (sketch|road markings|canal hatch|plan overlay|planting bed)/;
  function run() {
    var ctx = window.daylightContext, orig = new Map(), mode = 'colors';
    function materials() {
      var out = [], seen = new Set();
      ctx.scene.traverse(function (o) {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m && !seen.has(m) && !SKIP.test(m.name || '')) { seen.add(m); out.push(m); } });
      });
      return out;
    }
    // Baked atlases hold many islands side by side: mip-mapping averages neighbouring islands together. Sample the full-size texture instead.
    var fixed = new Set();
    function sharpen() {
      materials().forEach(function (m) { if (m.map && !fixed.has(m.map)) { fixed.add(m.map); if (m.map.minFilter === 1008 || m.map.minFilter === 1007) { m.map.minFilter = 1006; m.map.anisotropy = Math.max(m.map.anisotropy || 1, 8); m.map.needsUpdate = true; } } });
    }
    sharpen(); (function again(n) { if (n > 12) return; setTimeout(function () { sharpen(); again(n + 1); }, 3000); })(0);
    var MODES = {
      colors: null,
      paper: { color: 0xf4f1e8, emissive: 0x000000, ei: 0, rough: 1, metal: 0, bg: 0x26242a },
      clay: { color: 0xd8cebf, emissive: 0x000000, ei: 0, rough: 1, metal: 0 }
    };
    var bg0 = ctx.scene.background && ctx.scene.background.isColor ? ctx.scene.background.getHex() : null;
    function setBg(hex) { if (ctx.scene.background && ctx.scene.background.isColor) ctx.scene.background.setHex(hex === null ? bg0 : hex); }
    function apply(next) {
      mode = next; var s = MODES[next];
      materials().forEach(function (m) {
        if (!orig.has(m)) orig.set(m, { map: m.map, color: m.color ? m.color.getHex() : null, emissive: m.emissive ? m.emissive.getHex() : null, ei: m.emissiveIntensity, rough: m.roughness, metal: m.metalness, vc: m.vertexColors });
        var o = orig.get(m);
        if (!s) { m.map = o.map; if (m.color && o.color !== null) m.color.setHex(o.color); if (m.emissive && o.emissive !== null) m.emissive.setHex(o.emissive); m.emissiveIntensity = o.ei; m.roughness = o.rough; m.metalness = o.metal; m.vertexColors = o.vc; }
        else { m.map = null; m.vertexColors = false; if (m.color) m.color.setHex(s.color); if (m.emissive) m.emissive.setHex(s.emissive); m.emissiveIntensity = s.ei; m.roughness = s.rough; m.metalness = s.metal; }
        m.needsUpdate = true;
      });
      setBg(s && s.bg !== undefined ? s.bg : null);
      redraw(ctx);
    }
    window.lightViews = { apply: apply, mode: function () { return mode; } };
  }
})();
