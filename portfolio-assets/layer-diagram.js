/* Diagram view by layer: with SKETCH_STYLE's Diagram mode on, every part named by one of the project's layers (PROJECT_PANEL.layers)
   takes that layer's colour, flat, on a light ground with faint grey ink (the colours carry the drawing, the lines only trace it).
   PROJECT_PANEL.diagramColors gives the site's own surfaces a colour ([{re, color}], matched on the part name, e.g. lawns light
   grey and paths concrete); anything else goes pale. Other modes put the original materials and line weights back. Used by
   projects without a diagram of their own. */
(function () {
  var C = window.PROJECT_PANEL; if (!C || !C.layers) return;
  var PAL = ['#e3b24d', '#e8706a', '#72a8dc', '#9c7fc4', '#5fae8f', '#7c7c80', '#d98c4a', '#5b8fa8', '#c46a8a', '#8fae5f', '#b59a6a', '#6a7fb5'], PALE = '#efe4c8';
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene && window.sketchStyle; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Layer diagram skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, layers = [];
    // the layer list may be built by the project panel from the model's own names ('auto'), so it is read when the view is first used
    function loadLayers() { if (layers.length || !Array.isArray(C.layers)) return; layers = C.layers.map(function (l, i) { return { re: new RegExp(l.re, 'i'), col: l.color || PAL[i % PAL.length] }; }); }
    var site = (C.diagramColors || []).map(function (d) { return { re: new RegExp(d.re, 'i'), col: d.color }; });
    var orig = new Map(), cache = {}, on = false, inkSaved = null;
    function colourOf(o) {
      for (var s = 0; s < site.length; s++) if (site[s].re.test(o.name || '')) return site[s].col;
      for (var p = o; p; p = p.parent) for (var i = 0; i < layers.length; i++) if (p.name && layers[i].re.test(p.name)) return layers[i].col;
      return PALE;
    }
    function flat(base, hex) {
      if (cache[hex]) return cache[hex];
      var m = base.clone(); m.name = 'Layer diagram ' + hex; m.map = null; if ('normalMap' in m) m.normalMap = null; if ('roughnessMap' in m) m.roughnessMap = null; if ('aoMap' in m) m.aoMap = null; m.vertexColors = false; m.color.set(hex);
      if (m.emissive) { m.emissive.set(hex); m.emissiveIntensity = .2; } m.transparent = false; m.opacity = 1; m.needsUpdate = true;
      if (window.sketchStyle.patch) window.sketchStyle.patch(m);   // section-cut hatch, as on the other materials
      return (cache[hex] = m);
    }
    // faint lines: a light grey ink at about half the usual weight
    function ink(faint) {
      var u = window.sketchStyle.u; if (!u) return;
      if (faint) {
        if (!inkSaved) inkSaved = { w: u.uWorldW.value, px: u.uMinPx.value, minW: u.uMinW.value, maxW: u.uMaxW.value };
        u.uInk.value = [.6, .59, .57]; u.uWorldW.value = inkSaved.w * .5; u.uMinPx.value = inkSaved.px * .55; u.uMinW.value = inkSaved.minW * .55; u.uMaxW.value = inkSaved.maxW * .55;
      } else if (inkSaved) { u.uWorldW.value = inkSaved.w; u.uMinPx.value = inkSaved.px; u.uMinW.value = inkSaved.minW; u.uMaxW.value = inkSaved.maxW; inkSaved = null; }
    }
    function set(next) {
      on = next; loadLayers();
      scene.traverse(function (o) {
        if (!o.isMesh || (o.userData && o.userData.skEdge) || !o.material || /^(Hive|Phal|Tranquil|NZS life|NBYC life) |sketch|sprite/i.test(o.material.name || '')) return;
        if (!orig.has(o)) orig.set(o, o.material);
        o.material = on ? flat(Array.isArray(orig.get(o)) ? orig.get(o)[0] : orig.get(o), colourOf(o)) : orig.get(o);
      });
      if (on && scene.background && scene.background.isColor) scene.background.setHex(0xf4f1ea);
      ink(on);
      ctx.controls.dispatchEvent({ type: 'change' });
    }
    var setMode = window.sketchStyle.setMode;
    window.sketchStyle.setMode = function (name) { setMode(name); if (name === 'diagram') set(true); else if (on) set(false); };
  }
})();
