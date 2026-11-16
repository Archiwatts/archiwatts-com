// Hidden Gems City: The Run. The realism layer: a physical sky that follows the clock, sky reflections on glass and water,
// distance haze matched to the horizon, stars and a moon at night, ambient occlusion (N8AO), filmic tone, SMAA anti-aliasing,
// a light colour grade, and sharper sun shadows around the player. Graphics: Ultra / High / Low (G, or the Graphics menu).
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Sky } from 'three/addons/objects/Sky.js';

export function init(W){
  const {THREE, scene, camera, renderer} = W, $ = id => document.getElementById(id);
  const COARSE = matchMedia('(pointer:coarse)').matches, KEY = 'hgc-run-gfx';
  const SKY_GAIN = .3;   // brings the physical sky into the same range as the city's lights

  // ---------- tone ----------
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  // ---------- physical sky (seen) and its copy (for reflections and the haze colour) ----------
  const gain = s => { s.material.uniforms.skyGain = {value:SKY_GAIN}; s.material.fragmentShader = 'uniform float skyGain;\n' + s.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );'); s.userData.noCollide = true; return s; };
  const setSkyLook = u => { u.turbidity.value = 3.2; u.rayleigh.value = 1.8; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .82; };
  const sky = gain(new Sky()); sky.scale.setScalar(20000); sky.material.depthWrite = false; sky.renderOrder = -10; sky.frustumCulled = false; setSkyLook(sky.material.uniforms); scene.add(sky);
  const envScene = new THREE.Scene(), skyE = gain(new Sky()); skyE.scale.setScalar(400); setSkyLook(skyE.material.uniforms); envScene.add(skyE);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshBasicMaterial({color:0x3a3d40})); ground.rotation.x = -Math.PI/2; ground.position.y = -6; envScene.add(ground);   // the city below the horizon, for reflections

  // stars and a moon
  const N = 2600, sp = new Float32Array(N*3); for (let i = 0; i < N; i++){ const u = Math.random(), a = Math.random()*Math.PI*2, y = .04 + u*.96, r = Math.sqrt(1 - y*y); sp.set([Math.cos(a)*r*15000, y*15000, Math.sin(a)*r*15000], i*3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({color:0xdfe8ff, size:1.6, sizeAttenuation:false, transparent:true, opacity:0, depthWrite:false, fog:false})); stars.frustumCulled = false; scene.add(stars);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(170, 40), new THREE.MeshBasicMaterial({color:0xeef2ff, transparent:true, opacity:0, fog:false, depthWrite:false})); moon.userData.noCollide = true; scene.add(moon);
  const MOON = new THREE.Vector3(-.4, .8, .45).normalize();

  // ---------- the clock: where the sun really is (below the horizon at night) ----------
  const sunDir = new THREE.Vector3(), haze = new THREE.Color(0xb9c8d4), hudSky = new THREE.Color(), tmp = new THREE.Color();
  let hour = 22, night = 1, dayEnvRT = null, pmrem = new THREE.PMREMGenerator(renderer);
  function sunFor(hr){ const t = (hr - 6)/14, az = Math.PI*t, e = Math.sin(Math.PI*Math.max(-.15, Math.min(1.15, t)))*1.12;
    return sunDir.set(Math.cos(az)*Math.cos(e), Math.sin(e), .45*Math.cos(e)).normalize(); }
  const rt = new THREE.WebGLRenderTarget(8, 8, {type:THREE.FloatType}), hcam = new THREE.PerspectiveCamera(50, 1, .1, 1000), px = new Float32Array(8*8*4);
  function refreshSky(){
    sunFor(hour); sky.material.uniforms.sunPosition.value.copy(sunDir); skyE.material.uniforms.sunPosition.value.copy(sunDir);
    if (sunDir.y < -.18) return;   // full night: the night environment and the HUD's dark sky take over
    if (dayEnvRT) dayEnvRT.dispose(); dayEnvRT = pmrem.fromScene(envScene, 0, .1, 1000);
    if (night <= .5) scene.environment = dayEnvRT.texture;
    try {   // the haze colour: what the horizon looks like, facing away from the sun
      hcam.position.set(0, 0, 0); hcam.lookAt(-sunDir.x, .06, -sunDir.z); const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt); renderer.render(envScene, hcam); renderer.readRenderTargetPixels(rt, 0, 0, 8, 8, px); renderer.setRenderTarget(prev);
      let r = 0, g = 0, b = 0; for (let i = 0; i < 64; i++){ r += px[i*4]; g += px[i*4+1]; b += px[i*4+2]; }
      if (r + g + b > 0) haze.setRGB(r/64, g/64, b/64);
    } catch (e) {}
  }
  const setNight = W.setNight; W.setNight = n => { setNight(n); night = n; if (n <= .5 && dayEnvRT) scene.environment = dayEnvRT.texture; };
  let pending = 0; const slider = $('ghSun');
  if (slider){ hour = +slider.value; slider.addEventListener('input', () => { hour = +slider.value; clearTimeout(pending); pending = setTimeout(refreshSky, 60); }); }
  refreshSky();

  // ---------- post: ambient occlusion -> bloom -> tone -> SMAA -> grade ----------
  const comp = new EffectComposer(renderer), renderPass = new RenderPass(scene, camera); comp.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .85, .55, .72); comp.addPass(bloom);
  comp.addPass(new OutputPass());
  const smaa = new SMAAPass(innerWidth*renderer.getPixelRatio(), innerHeight*renderer.getPixelRatio()); comp.addPass(smaa);
  const grade = new ShaderPass({
    uniforms:{tDiffuse:{value:null}, uTime:{value:0}, uNight:{value:0}, uVig:{value:.32}},
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:`uniform sampler2D tDiffuse; uniform float uTime, uNight, uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, 1.06);                                                            // a touch more colour
        c += mix(vec3(.018, .006, -.016), vec3(-.01, .0, .02), uNight) * (l - .45);             // warm lights / cool shade (cooler at night)
        c = c * c * (3. - 2. * c) * .18 + c * .82;                                              // gentle S-curve
        float d = distance(vUv, vec2(.5)); c *= mix(1., smoothstep(.95, .3, d), uVig);          // lens vignette
        c += (h(vUv * 913. + uTime) - .5) * .014;                                               // fine film grain
        gl_FragColor = vec4(c, 1.); }`});
  comp.addPass(grade);
  let ao = null;
  import('https://cdn.jsdelivr.net/npm/n8ao@1.9.4/dist/N8AO.js').then(({N8AOPass}) => {
    ao = new N8AOPass(scene, camera, innerWidth*renderer.getPixelRatio(), innerHeight*renderer.getPixelRatio());
    Object.assign(ao.configuration, {logarithmicDepthBuffer:true, gammaCorrection:false, aoRadius:3.2, distanceFalloff:1.2, intensity:2.6, color:new THREE.Color(0x0b0a0d)});
    comp.insertPass(ao, 0); renderPass.enabled = false; applyQuality();
  }).catch(e => console.warn('[realism] ambient occlusion unavailable', e));

  // ---------- quality ----------
  const Q = ['ultra', 'high', 'low'], NAMES = {ultra:'Ultra', high:'High', low:'Low'};
  let dyn = 1, fAcc = 0, fN = 0, lastNow = 0;   // adaptive resolution: drop the render scale when frames run long, restore it when there is headroom
  let q = null; try { q = localStorage.getItem(KEY); } catch (e) {} if (!Q.includes(q)) q = COARSE ? 'low' : 'ultra';
  function applyQuality(){
    if (q === 'low') dyn = 1;
    const pr = (q === 'low' ? 1 : Math.min(devicePixelRatio, q === 'ultra' ? 1.5 : 1.25)) * dyn;   // dyn: adaptive resolution (see the frame hook)
    if (renderer.getPixelRatio() !== pr){ renderer.setPixelRatio(pr); dispatchEvent(new Event('resize')); }
    comp.setPixelRatio(pr); comp.setSize(innerWidth, innerHeight);
    if (ao){ ao.enabled = q !== 'low'; renderPass.enabled = !ao.enabled; Object.assign(ao.configuration, q === 'ultra' ? {halfRes:false, aoSamples:16, denoiseSamples:8, denoiseRadius:12} : {halfRes:true, aoSamples:8, denoiseSamples:4, denoiseRadius:8}); }
    if (renderer.shadowMap.enabled){ const s = W.sun.shadow, size = q === 'ultra' ? 4096 : 2048, ext = q === 'ultra' ? 110 : q === 'high' ? 90 : 170;
      if (s.mapSize.x !== size){ s.mapSize.set(size, size); if (s.map){ s.map.dispose(); s.map = null; } }
      Object.assign(s.camera, {left:-ext, right:ext, top:ext, bottom:-ext}); s.camera.updateProjectionMatrix(); s.bias = -.0004; s.normalBias = .06; }
    const sel = $('gmGfx'); if (sel) sel.value = q; try { localStorage.setItem(KEY, q); } catch (e) {}
  }
  const tools = $('ghTools');
  if (tools){ tools.insertAdjacentHTML('afterbegin', `<label>Graphics<select id="gmGfx">${Q.map(k => `<option value="${k}">${NAMES[k]}</option>`).join('')}</select><output id="gmGfxO">G</output></label>`);
    $('gmGfx').addEventListener('change', e => { q = e.target.value; applyQuality(); }); }
  addEventListener('keydown', e => { if (e.code !== 'KeyG' || (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) return; q = Q[(Q.indexOf(q) + 1) % 3]; applyQuality(); const t = $('gmToast'); if (t){ t.textContent = 'Graphics: ' + NAMES[q]; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 1600); } });
  addEventListener('resize', () => comp.setSize(innerWidth, innerHeight));
  applyQuality();

  // ---------- every frame ----------
  W.frameHooks.push(now => {
    const inG = W.inGlobe, cp = camera.position;
    sky.visible = !inG && night < .97; sky.position.copy(cp);
    stars.visible = moon.visible = !inG && night > .05; stars.position.copy(cp); stars.material.opacity = Math.min(1, night*1.2)*.9;
    moon.position.copy(cp).addScaledVector(MOON, 14000); moon.lookAt(cp); moon.material.opacity = night;
    if (!inG){   // haze: the horizon colour by day, the HUD's dusk-to-night colour after sunset; denser near the ground
      hudSky.copy(scene.fog.color); const dayK = Math.max(0, Math.min(1, (sunDir.y + .05)/.2)) * (1 - night);
      tmp.copy(hudSky).lerp(haze, dayK); scene.fog.color.copy(tmp); scene.background.copy(tmp);
      const far = W.mode === 'walk' ? 0 : W.orbit.r; scene.fog.near = 380 + far*.8; scene.fog.far = 5200 + far*2.1;
    }
    grade.uniforms.uTime.value = (now % 10000)*.001; grade.uniforms.uNight.value = night;
    if (document.visibilityState === 'visible' && lastNow){   // ignore gaps (tab switch, loading hitch) over 250 ms
      const d = now - lastNow; if (d < 250){ fAcc += d; if (++fN >= 60){ const avg = fAcc/fN; fAcc = fN = 0;
        const next = avg > 24 ? Math.max(.6, dyn - .1) : avg < 15 ? Math.min(1, dyn + .05) : dyn;
        if (Math.abs(next - dyn) > 1e-3 && q !== 'low'){ dyn = next; applyQuality(); } } } }
    lastNow = now;
  });
  W.render = () => {
    if (q === 'low') return false;
    bloom.enabled = night > .35 && !W.inGlobe;
    if (ao){ const far = W.mode !== 'walk' && W.orbit.r > 450;   // ambient occlusion has a 3 m radius: invisible (and costly) from a far orbit view
      const on = !far; if (ao.enabled !== on){ ao.enabled = on; renderPass.enabled = !on; } }
    comp.render(); return true;
  };
  W.realism = {sky, comp, get quality(){ return q; }, set quality(v){ q = v; applyQuality(); }, refreshSky};
}
