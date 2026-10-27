/* Hive phasing diagram: in the Diagram view each building block is coloured by program, in the colours of the project's
   phase diagrams (residential yellow, retail red, office blue, parking grey). Blocks outside the chosen phase stay pale.
   Phase 1: blocks A and D. Phase 2: blocks C and E. Phase 3: block B (from the project's phase diagrams, Hive.pdf pp. 14-15). */
(function () {
  var PHASES = [{ n: 'Phase 1', blocks: 'ad', note: 'Neighborhood edge: supermarket and CVS, offices, parking and residences.' }, { n: 'Phase 2', blocks: 'ce', note: 'Waterfront: residences and commercial frontage.' }, { n: 'Phase 3', blocks: 'b', note: 'Connector: completes the amenity deck, with more residences and retail.' }];
  var COLORS = { residential: '#e3b24d', retail: '#e8706a', office: '#72a8dc', parking: '#7c7c80', common: '#bfcca6', structure: '#d9d2c2', pavilions: '#d9d2c2' }, PALE = '#efe4c8';
  function ready() { return window.newProjectViewer && window.newProjectViewer.ready && window.daylightContext && window.daylightContext.scene; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { console.warn('Hive phases skipped', e); } } else if (tries++ < 600) setTimeout(wait, 150); })();
  function run() {
    var ctx = window.daylightContext, scene = ctx.scene, orig = new Map(), cache = {}, on = false, phase = 0, std = null;
    function stdMat() { if (std) return std; scene.traverse(function (o) { if (!std && o.isMesh) { var m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) std = m; } }); return std; }
    function flat(hex, glass) {
      var k = hex + (glass ? 'g' : ''); if (cache[k]) return cache[k];
      var m = stdMat().clone(); m.name = 'Hive phase ' + k; m.map = null; m.normalMap = null; m.roughnessMap = null; m.vertexColors = false; m.color.set(hex); m.emissive.set(hex); m.emissiveIntensity = .22; m.roughness = 1; m.metalness = 0;
      if (glass) { m.transparent = true; m.opacity = .55; m.depthWrite = false; } m.side = 2; m.needsUpdate = true; return (cache[k] = m);
    }
    function meshes() { var out = []; scene.traverse(function (o) { if (o.isMesh && !(o.userData && o.userData.skEdge)) { var mm = /^HIVE_([a-z]+)-([a-e])_(\w+)/.exec(o.name || ''); if (mm && !/context|water/.test(mm[1])) out.push([o, mm[1], mm[2], mm[3]]); } }); return out; }
    function apply(flag) {
      on = !!flag;
      meshes().forEach(function (x) {
        var o = x[0]; if (!orig.has(o)) orig.set(o, o.material);
        if (!on) { o.material = orig.get(o); return; }
        var inPhase = phase === 0 || PHASES[phase - 1].blocks.indexOf(x[2]) >= 0, hex = inPhase ? (COLORS[x[1]] || PALE) : PALE;
        o.material = flat(hex, x[3] === 'glass');
      });
      scene.traverse(function (o) { if (o.isMesh && (/^Mesh_\d+/.test(o.name || '') || /_aluminum$/.test(o.name || ''))) o.visible = !on; });
      row.hidden = !on; ctx.controls.dispatchEvent({ type: 'change' });
    }
    function setPhase(p) { phase = p; [].forEach.call(row.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(+b.dataset.p === p)); }); note.textContent = p ? PHASES[p - 1].note : 'All three phases together.'; if (on) apply(true); }
    // phase picker and legend, shown under Appearance while the Diagram view is active
    var row = document.createElement('div'), css = document.createElement('style');
    css.textContent = '.hp{display:grid;gap:8px;margin-top:10px}.hp .btns{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.hp button{font:700 12px Archivo,system-ui,sans-serif;color:#f2f0f4;background:#26242a;border:1.5px solid #4d4953;border-radius:10px;min-height:40px;cursor:pointer}.hp button[aria-pressed=true]{background:#e0557c;border-color:#e0557c;color:#1c1b1e}.hp .leg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:#e9e6ee}.hp .leg i{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:5px;vertical-align:-1px}.hp .note{font-size:12.5px;color:#c9c4d0;margin:0}';
    document.head.appendChild(css);
    row.className = 'hp'; row.hidden = true;
    row.innerHTML = '<div class="btns">' + ['All'].concat(PHASES.map(function (p) { return p.n.replace('Phase ', 'Phase '); })).map(function (n, i) { return '<button type="button" data-p="' + i + '" aria-pressed="' + (i === 0) + '">' + n + '</button>'; }).join('') + '</div><div class="leg">' + [['Residential', 'residential'], ['Retail', 'retail'], ['Office', 'office'], ['Parking', 'parking'], ['Amenity', 'common']].map(function (l) { return '<span><i style="background:' + COLORS[l[1]] + '"></i>' + l[0] + '</span>'; }).join('') + '</div><p class="note">All three phases together.</p>';
    var note = row.querySelector('.note'); row.addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (b) setPhase(+b.dataset.p); });
    (function place() { var seg = document.querySelector('.pp .seg.five'); if (seg) seg.after(row); else setTimeout(place, 300); })();
    window.hivePhases = { apply: apply, setPhase: setPhase, phases: PHASES };
  }
})();
