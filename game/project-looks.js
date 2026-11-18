// Hidden Gems City: the same materials as each project's own 3D page.
// Most pages show their model's own materials (the game loads the same GLB). Two pages restyle theirs at runtime with a look
// script: North Beach Youth Center (nbyc-look.js) and Venice Apartments (venice-look.js). Those scripts publish their palette and
// shader code (window.NBYC_LOOK / window.VENICE_LOOK); this module loads the very same files and applies them to the game's meshes,
// so a change to a page's look shows up in the city too. Patterns are computed in the page's own coordinates (the model's
// 'game-root' node undoes the game's re-centring), so bricks, tiles and stains land where they do on the page.
const SRC = { 'venice-apartments': '../portfolio-assets/venice-look.js' };   // the Youth Center is captured from its page with its final Revit colours (game/tools/page-capture.js)
const loaded = {};
function loadScript(url){
  if (!loaded[url]) loaded[url] = new Promise((res, rej) => { window.LOOK_DATA_ONLY = true; const s = document.createElement('script'); s.src = url + '?v=game1'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return loaded[url];
}
const TIME = { value: 0 };

export async function applyPageLook(slug, root, THREE, frameHooks){
  if (!SRC[slug]) return 0;
  try { await loadScript(SRC[slug]); } catch (e) { console.warn('[looks] could not load', SRC[slug]); return 0; }
  const L = slug === 'venice-apartments' ? window.VENICE_LOOK : window.NBYC_LOOK; if (!L) return 0;
  let gameRoot = null; root.traverse(o => { if (!gameRoot && /^game-?root$/.test(o.name)) gameRoot = o; });
  if (!gameRoot) gameRoot = root;   // the model's own frame (centred on the building, ground at 0)
  const toPage = { value: new THREE.Matrix4() };
  const refresh = () => { if (gameRoot){ gameRoot.updateWorldMatrix(true, false); toPage.value.copy(gameRoot.matrixWorld).invert(); } };
  refresh(); (function tick(){ refresh(); TIME.value = performance.now() / 1000; requestAnimationFrame(tick); })();   // the piece is placed after loading; keep the page frame current
  const own = {}; let n = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const mm = /^(?:project|context)?(.*?)__([A-Za-z]+?)(?:_lod)?$/.exec(o.name || ''); if (!mm || !L.PAL[mm[2]]) return;
    const grp = mm[1], key = mm[2];
    let code, id, setup;
    if (slug === 'venice-apartments'){
      const role = /^Main_apartment/.test(grp) ? 'main' : /^Team_buildings/.test(grp) ? 'team' : 'city';
      id = role + '/' + key;
      code = key === 'Plaster' ? L.CODE[role + 'Plaster'] : key === 'Brick' ? L.CODE.brick : key === 'Stone' && role !== 'team' ? L.CODE.stone : key === 'Landscape' ? L.CODE.grass : key === 'Water' ? L.CODE.water : null;
      setup = m => {   // the page's per-role colours (venice-look.js run())
        if (key === 'Metal' && role === 'main') m.color.set('#2a3133');
        if (role === 'team'){ if (key === 'Metal') m.color.set('#8d9496'); if (key === 'Stone') m.color.set('#d7d1c5'); if (key === 'Glazing'){ m.color.set('#b8d0da'); m.opacity = .5; } if (key === 'Brick') m.color.set('#c9927c'); }
        if (key === 'Water'){ m.roughness = .12; m.metalness = .05; m.opacity = .96; } };
    } else {
      id = key;
      code = L.CODE[L.VAR[key]] || '';
      if (L.VAR[key] === 'paving') code = code.split('\nif (nw.y>.8')[0];   // the page's dashed street lines belong to its own site streets, not the city's
    }
    let m = own[id];
    if (!m){
      const old = o.material, p = L.PAL[key];
      m = own[id] = old.clone(); m.color.set(p.c); m.roughness = p.r; m.metalness = p.m || 0; m.map = null;
      if (p.o){ m.transparent = true; m.opacity = p.o; m.depthWrite = false; m.side = THREE.DoubleSide; }
      if (setup) setup(m);
      if (code){
        const prev = old.onBeforeCompile, prevKey = old.customProgramCacheKey ? old.customProgramCacheKey.bind(old) : () => '';
        m.onBeforeCompile = (sh, r) => {
          if (prev) prev.call(m, sh, r);
          sh.uniforms.uToPage = toPage; sh.uniforms.vlT = TIME;
          sh.vertexShader = 'uniform mat4 uToPage;\nvarying vec3 vNbW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vNbW = (uToPage * modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = 'uniform float vlT;\nuniform float uMass;\n' + L.FRAG_HEAD + sh.fragmentShader
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + code)
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (L.FRAG_HEAD.includes('spA') ? ' normal = normalize(normal - spA*(viewMatrix*vec4(spG,0.)).xyz);' : ''));
          sh.uniforms.uMass = {value: 0};
          if (sh.uniforms.cityCtx) sh.uniforms.cityCtx = {value: 0};   // the page's own colours, not the city's context paint
        };
        m.customProgramCacheKey = () => prevKey() + '-look-' + slug + '-' + id;
      }
      m.needsUpdate = true; n++;
    }
    o.material = m; if (key === 'Water') o.renderOrder = 1;
    if (o.userData.color) o.userData.color = m.color.clone();   // the Context colour/grey switch restores this colour
  });
  console.log('[looks]', slug, n, 'materials from its page look');
  return n;
}
