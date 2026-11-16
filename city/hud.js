// Hidden Gems City: the game HUD. Plain HTML/CSS/canvas layered over the 3D canvas; the layer itself ignores the pointer
// (pointer-events: none) and only its interactive parts take it, so looking and walking stay fluid.
// It talks to the city through one object, W (see "hook-up point" in world.html): state in, a few actions out.
// Look: cyberpunk (angular panels, cyan readouts, scanlines) in the Hidden Gems palette: gold frames, pink for what is active.
export function init(W){
  const {THREE, scene, camera, canvas, renderer, PROJECTS, LAND} = W, $ = id => document.getElementById(id);
  const GOLD = '#e0b057', CYAN = '#4fe3f2', INK = '#0c0c10', PINK = '#ff3d7f', MAPB = {x0:-1350, z0:-1500, x1:1350, z1:1500};
  const no2 = n => String(n).padStart(2,'0'), byTour = [...PROJECTS].sort((a,b) => a.no - b.no);

  document.head.insertAdjacentHTML('beforeend', `<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600&family=Share+Tech+Mono&display=swap" rel="stylesheet"><style>
    #top{display:none}
    body[data-mode=walk] #list{display:none}
    #gh{position:fixed;inset:0;pointer-events:none;z-index:2;font:500 13px/1.25 Rajdhani,"Josefin Sans",system-ui,sans-serif;color:#fff;letter-spacing:.08em;text-transform:uppercase;--cut:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
    #gh>*{position:absolute}
    #gh canvas{position:static;inset:auto;width:auto;height:auto;touch-action:auto;cursor:inherit}
    #gh .pn{background:linear-gradient(rgba(12,12,16,.86),rgba(12,12,16,.86)),repeating-linear-gradient(0deg,rgba(79,227,242,.07) 0 1px,transparent 1px 3px);border-left:2px solid ${GOLD};clip-path:var(--cut);padding:9px 14px 9px 12px}
    #gh .mono{font-family:"Share Tech Mono",monospace;letter-spacing:0;text-transform:none}
    #gh .tag{color:${CYAN};font:400 10px "Share Tech Mono",monospace;letter-spacing:.06em;display:block;margin-bottom:3px}
    #gh #ghCompass{position:absolute;left:50%;top:8px;transform:translateX(-50%);width:min(720px,calc(100vw - 500px));height:auto;aspect-ratio:1040/120}
    #ghObj{left:14px;top:14px;width:250px;display:none}
    body[data-mode=walk] #ghObj{display:block}
    #ghObj b{display:block;font-size:17px;font-weight:600;letter-spacing:.06em;line-height:1.15}
    #ghObj span{color:${GOLD};font:400 12px "Share Tech Mono",monospace}
    #ghReticle{left:50%;top:50%;transform:translate(-50%,-50%);display:none;align-items:center}
    #ghReticle i{width:5px;height:5px;background:#fff;box-shadow:0 0 0 1.5px rgba(12,12,16,.75);display:block;position:relative}
    #ghReticle.on i{background:${PINK}}
    #ghReticle.on i::before,#ghReticle.on i::after{content:"";position:absolute;top:-10px;width:7px;height:23px;border:1.5px solid ${CYAN}}
    #ghReticle.on i::before{left:-15px;border-right:0}#ghReticle.on i::after{right:-15px;border-left:0}
    #ghPrompt{position:absolute;left:30px;white-space:nowrap;display:none;font-size:14px}
    #ghPrompt b{color:${INK};background:${GOLD};font:400 13px "Share Tech Mono",monospace;padding:1px 6px;margin-right:8px}
    #ghReticle.on #ghPrompt{display:block}
    #ghGround{display:none;transform:translate(14px,14px);white-space:nowrap;font:400 11px "Share Tech Mono",monospace;text-transform:none;letter-spacing:0;color:${CYAN};padding:5px 10px 4px}
    #ghMap{right:14px;top:14px;width:212px;pointer-events:auto;cursor:crosshair;padding:8px 8px 6px}
    #gh #ghMap canvas{display:block;width:196px;height:196px;cursor:crosshair}
    #ghMap small{display:block;color:${CYAN};font:400 10px "Share Tech Mono",monospace;text-transform:none;letter-spacing:0;padding-top:5px}
    #hud.side{top:262px}
    #mPanel,#mMark{display:none}
    /* the project file, in the same cyberpunk look */
    #hud{font-family:Rajdhani,system-ui,sans-serif;font-weight:500;border:0;border-left:2px solid #e0b057;background:linear-gradient(rgba(12,12,16,.92),rgba(12,12,16,.92)),repeating-linear-gradient(0deg,rgba(79,227,242,.07) 0 1px,transparent 1px 3px);clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))}
    #hud::before{display:none}
    #hud .kick{color:#4fe3f2;font:400 11px "Share Tech Mono",monospace;letter-spacing:.04em;text-transform:none}
    #hud h3{font-weight:600;letter-spacing:.06em;font-size:clamp(22px,2.1vw,30px)}
    #hud .tabs button{font-weight:600;letter-spacing:.12em}#hud .tabs button.on{border-bottom-color:#ff3d7f}
    #hud .facts{font-family:"Share Tech Mono",monospace}#hud dt{color:#4fe3f2}
    #hud p{font-size:15px;font-weight:400}
    #hud .btns a,#hud .btns button{font-weight:600;letter-spacing:.1em;font-size:13px;border-color:#e0b057;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))}
    #hud .btns .pri{background:#e0b057;color:#0c0c10}
    #hx{color:#ff3d7f}
    #ghBars{left:14px;bottom:64px;width:236px;display:grid;gap:8px}
    #ghBars .row{display:grid;grid-template-columns:1fr auto;align-items:end}
    #ghBars .row b{font:400 12px "Share Tech Mono",monospace;color:${GOLD};letter-spacing:0}
    #ghBars .bar{grid-column:1/3;height:7px;background:rgba(255,255,255,.12);margin-top:4px;transform:skewX(-24deg)}
    #ghBars .bar i{display:block;height:100%;width:0;background:${GOLD};transition:width .25s}
    #ghBars #ghStam{background:${CYAN};transition:none}#ghBars .low #ghStam{background:${PINK}}
    #ghTools{right:14px;bottom:14px;pointer-events:auto;display:grid;gap:5px;font-size:12px}
    #ghTools label{display:grid;grid-template-columns:50px 130px 50px;align-items:center;gap:8px}
    #ghTools select{font:500 12px Rajdhani,sans-serif;background:#16161c;color:#fff;border:1px solid rgba(224,176,87,.5);padding:2px 4px;text-transform:uppercase;width:100%}
    #ghTools output{font:400 11px "Share Tech Mono",monospace;color:${CYAN};letter-spacing:0;text-align:right}
    #ghTools input{accent-color:${GOLD};width:100%}
    #ghCall,#ghTravel{left:14px;top:50%;transform:translateY(-50%);pointer-events:auto;width:250px;display:grid;gap:6px}
    #ghCall button,#ghTravel button{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;padding:7px 10px 6px;border:1px solid rgba(224,176,87,.5);font-size:14px;letter-spacing:.08em}
    #ghCall button:hover,#ghTravel button:hover{background:${GOLD};color:${INK}}
    #ghCall button b,#ghTravel button b{font:400 12px "Share Tech Mono",monospace;color:${INK};background:${CYAN};padding:1px 6px}
    #ghCall button em{margin-left:auto;font:400 10px "Share Tech Mono",monospace;font-style:normal;color:${PINK}}
    #ghTravel{max-height:76vh;overflow:auto;width:290px}#ghTravel button{font-size:13px;padding:5px 9px 4px}#ghTravel button.seen b{background:${GOLD}}
    #ghBig{left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;padding:12px 12px 8px}
    #gh #ghBig canvas{display:block;height:min(74vh,820px);width:auto;aspect-ratio:900/1000;cursor:crosshair}
    #ghBig small{display:block;color:${CYAN};font:400 11px "Share Tech Mono",monospace;text-transform:none;letter-spacing:0;padding-top:6px}
    #ghToast{left:50%;top:22%;transform:translateX(-50%);display:none;border-left-color:${PINK};font-size:14px}
    #gh [hidden]{display:none!important}
    @media (max-width:980px){#ghMap,#ghTools,#ghBars,#ghObj{display:none!important}#gh #ghCompass{width:calc(100vw - 40px)}#hud.side{top:104px}}
  </style>`);
  document.body.insertAdjacentHTML('beforeend', `<div id="gh">
    <canvas id="ghCompass" width="1040" height="120"></canvas>
    <div id="ghObj" class="pn"><span class="tag">// TOUR_OBJECTIVE</span><b id="ghObjName">—</b><span id="ghObjDist"></span></div>
    <div id="ghReticle"><i></i><span id="ghPrompt" class="pn"></span></div>
    <div id="ghGround" class="pn"></div>
    <div id="ghMap" class="pn"><canvas id="ghMapC" width="392" height="392"></canvas><small>N ↑ · click to travel · M opens the full map</small></div>
    <div id="ghBars" class="pn">
      <div class="row"><span>Weather</span><b id="ghWx">clear</b></div>
      <div class="row"><span>Files opened</span><b id="ghCount">00 / 14</b><div class="bar"><i id="ghFill"></i></div></div>
    </div>
    <div id="ghTools" class="pn"><label>Time<input id="ghSun" type="range" min="6" max="24" step="0.25" value="22"><output id="ghSunO">22:00</output></label>
      <label>Season<select id="ghSeason"><option value="auto">Auto (today)</option><option value="winter">Winter</option><option value="spring">Spring</option><option value="summer">Summer</option><option value="autumn">Autumn</option></select><output id="ghSeasonO"></output></label>
      <label>Cut<input id="ghCut" type="range" min="2" max="200" step="1" value="200"><output id="ghCutO">off</output></label></div>
    <div id="ghCall" class="pn" hidden><span class="tag">// CALL_IN · press a number</span>
      <button data-k="1"><b>1</b>Fast travel</button><button data-k="2"><b>2</b>City map</button><button data-k="3"><b>3</b>Call vehicle<em>later step</em></button>
      <span class="tag" style="margin:4px 0 0">Q closes</span></div>
    <div id="ghTravel" class="pn" hidden><span class="tag">// FAST_TRAVEL · tour order</span></div>
    <div id="ghBig" class="pn" hidden><canvas id="ghBigC" width="900" height="1000"></canvas><small>click anywhere on land to travel there · M or Esc closes</small></div>
    <div id="ghToast" class="pn"></div>
  </div>`);

  // ---------- where the player is, and which way they face (works for walking and for orbiting) ----------
  const dir = new THREE.Vector3(), here = new THREE.Vector3();
  const heading = () => { camera.getWorldDirection(dir); return Math.atan2(dir.x, -dir.z); };        // 0 = north, +90° = east
  const where = () => W.mode === 'walk' ? here.copy(W.walk.pos) : here.copy(W.view.t);
  const toast = t => { const e = $('ghToast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', 2600); };
  const travel = (x,z) => { if (W.mode === 'walk'){ if (W.isLand(x,z)) W.teleport(x,z); else toast('That is water. Pick a spot on land.'); } else { W.view.t.set(x,0,z); W.view.r = Math.min(W.view.r, 420); } };

  // ---------- compass ribbon with project waypoints ----------
  const cc = $('ghCompass').getContext('2d');
  function compass(){
    const w = 1040, h = 120, hd = heading(), span = 62 * Math.PI/180, P = where();
    cc.clearRect(0,0,w,h); cc.fillStyle = 'rgba(12,12,16,.72)'; cc.beginPath(); cc.moveTo(0,16); cc.lineTo(w-18,16); cc.lineTo(w,34); cc.lineTo(w,66); cc.lineTo(18,66); cc.lineTo(0,48); cc.closePath(); cc.fill();
    cc.fillStyle = GOLD; cc.fillRect(0,16,w-18,2); cc.fillRect(18,64,w-18,2);
    cc.textAlign = 'center'; cc.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 5){
      let a = d*Math.PI/180 - hd; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > span) continue;
      const x = w/2 + a/span*w/2, big = d % 45 === 0;
      cc.fillStyle = big ? CYAN : 'rgba(79,227,242,.45)'; cc.fillRect(x-1, big ? 22 : 26, 2, big ? 12 : 6);
      if (big){ cc.font = (d % 90 === 0 ? '600 26px' : '500 17px') + ' Rajdhani, sans-serif'; cc.fillStyle = d === 0 ? PINK : '#fff'; cc.fillText(['N','NE','E','SE','S','SW','W','NW'][d/45], x, 50); }
    }
    let best = null;
    if (!W.inGlobe) PROJECTS.forEach(p => { if (!p.pos) return; let a = Math.atan2(p.pos.x-P.x, -(p.pos.z-P.z)) - hd; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > span) return;
      const x = w/2 + a/span*w/2, nx = p === next; cc.fillStyle = nx ? PINK : p.seen ? GOLD : INK; cc.strokeStyle = nx ? PINK : GOLD; cc.lineWidth = 2; cc.beginPath(); cc.moveTo(x,2); cc.lineTo(x+9,12); cc.lineTo(x,22); cc.lineTo(x-9,12); cc.closePath(); cc.fill(); cc.stroke();
      if (!best || Math.abs(a) < best.a) best = {a:Math.abs(a), p}; });
    cc.fillStyle = PINK; cc.beginPath(); cc.moveTo(w/2-8,70); cc.lineTo(w/2+8,70); cc.lineTo(w/2,60); cc.closePath(); cc.fill();
    if (best && best.a < .12){ const m = Math.round(Math.hypot(best.p.pos.x-P.x, best.p.pos.z-P.z)); cc.font = '500 22px Rajdhani, sans-serif'; cc.letterSpacing = '3px'; cc.fillStyle = '#fff';
      cc.shadowColor = INK; cc.shadowBlur = 6; cc.fillText(`N° ${no2(best.p.no)}  ${best.p.name.toUpperCase()}  //  ${m} M`, w/2, 98); cc.shadowBlur = 0; cc.letterSpacing = '0px'; }
  }

  // ---------- maps: the corner map follows you; the full map (M) shows the whole city. Click either to travel. ----------
  const mapImg = new Image(); mapImg.src = 'markup/minimap.png?v=' + Date.now();
  function drawMap(ctx, size, cx, cz, radius, hx, hz, dot){
    const s = size/(2*radius), P = where(), hd = heading();
    ctx.fillStyle = '#31566a'; ctx.fillRect(0,0,hx*2,hz*2);
    if (mapImg.complete && mapImg.naturalWidth) ctx.drawImage(mapImg, (MAPB.x0-cx)*s+hx, (MAPB.z0-cz)*s+hz, (MAPB.x1-MAPB.x0)*s, (MAPB.z1-MAPB.z0)*s);
    ctx.fillStyle = 'rgba(12,12,16,.42)'; ctx.fillRect(0,0,hx*2,hz*2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `400 ${dot}px "Share Tech Mono", monospace`;
    PROJECTS.forEach(p => { if (!p.pos) return; const x = (p.pos.x-cx)*s+hx, y = (p.pos.z-cz)*s+hz; if (x < -10 || y < -10 || x > hx*2+10 || y > hz*2+10) return; const nx = p === next;
      ctx.beginPath(); ctx.rect(x-dot*.85, y-dot*.85, dot*1.7, dot*1.7); ctx.fillStyle = nx ? PINK : p.seen ? GOLD : INK; ctx.fill(); ctx.strokeStyle = nx ? PINK : GOLD; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = p.seen && !nx ? INK : '#fff'; ctx.fillText(p.no, x, y+1); });
    const px = (P.x-cx)*s+hx, py = (P.z-cz)*s+hz; ctx.save(); ctx.translate(px,py); ctx.rotate(hd);
    ctx.fillStyle = 'rgba(79,227,242,.28)'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,dot*6.5,-Math.PI/2-.45,-Math.PI/2+.45); ctx.closePath(); ctx.fill();
    ctx.fillStyle = CYAN; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,-dot); ctx.lineTo(dot*.7,dot*.7); ctx.lineTo(0,dot*.3); ctx.lineTo(-dot*.7,dot*.7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  const mc = $('ghMapC').getContext('2d'), bc = $('ghBigC').getContext('2d'), MR = 430;
  $('ghMapC').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(), P = where(), k = 2*MR/r.width; travel(P.x + (e.clientX-r.left-r.width/2)*k, P.z + (e.clientY-r.top-r.height/2)*k); });
  $('ghBigC').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); travel(MAPB.x0 + (e.clientX-r.left)/r.width*(MAPB.x1-MAPB.x0), MAPB.z0 + (e.clientY-r.top)/r.height*(MAPB.z1-MAPB.z0)); $('ghBig').hidden = true; });

  // ---------- reticle: what the centre of the screen is pointing at ----------
  const ray = new THREE.Raycaster(), mid = new THREE.Vector2(0,0); let lastAim = 0;
  function reticle(now){
    const on = W.mode === 'walk' && !W.inGlobe; $('ghReticle').style.display = on ? 'flex' : 'none'; if (!on){ W.setAim(-1); return; }
    if (now - lastAim < 140) return; lastAim = now;
    ray.setFromCamera(mid, camera); ray.far = 90; const h = ray.intersectObjects([...W.markers.children, W.globeHit, ...W.hits.children], false)[0];
    const i = !h ? -1 : h.object === W.globeHit ? PROJECTS.findIndex(p => p.piece === 'globe') : h.object.userData.pi;
    W.setAim(i); $('ghReticle').classList.toggle('on', i >= 0);
    if (i >= 0){ const p = PROJECTS[i]; $('ghPrompt').innerHTML = p.piece === 'globe' ? '<b>E</b>Shake the globe' : `<b>E</b>Open file · N° ${no2(p.no)} ${p.name}`; }
  }

  // ---------- ground rings: hover the street, click to walk there ----------
  const rings = new THREE.Group(); [.5,1,1.55].forEach((r,k) => { const m = new THREE.Mesh(new THREE.RingGeometry(r, r+.07, 48), new THREE.MeshBasicMaterial({color:0x4fe3f2, transparent:true, opacity:.95-.25*k, depthTest:false, side:THREE.DoubleSide})); m.rotation.x = -Math.PI/2; m.renderOrder = 8; rings.add(m); });
  rings.visible = false; scene.add(rings); let ground = null; const mray = new THREE.Raycaster(), mv = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0,1,0), -(LAND+.35)), hit = new THREE.Vector3();
  canvas.addEventListener('pointermove', e => {
    ground = null; rings.visible = false; $('ghGround').style.display = 'none'; if (W.mode !== 'walk' || W.inGlobe || e.buttons) return;
    mv.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1); mray.setFromCamera(mv, camera); if (!mray.ray.intersectPlane(floor, hit)) return;
    const d = Math.hypot(hit.x-W.walk.pos.x, hit.z-W.walk.pos.z); if (d < 2 || d > 140 || !W.isLand(hit.x, hit.z)) return;
    if (mray.intersectObjects([...W.markers.children, W.globeHit], false).length) return;
    ground = hit.clone(); rings.position.copy(ground); rings.visible = true;
    const g = $('ghGround'); g.style.display = 'block'; g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; g.textContent = 'click to walk · ' + Math.round(d) + ' m';
  });
  W.clickHooks.push(() => { if (!ground) return false; W.walkTo(ground.x, ground.z); ground = null; rings.visible = false; $('ghGround').style.display = 'none'; return true; });

  // ---------- call-in menu (Q), fast travel list, full map (M) ----------
  byTour.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<b>${no2(p.no)}</b>${p.name}`; b.onclick = () => { $('ghTravel').hidden = true; W.select(PROJECTS.indexOf(p)); }; p.tb = b; $('ghTravel').appendChild(b); });
  const callIn = k => { $('ghCall').hidden = true; if (k === '1') $('ghTravel').hidden = false; else if (k === '2') $('ghBig').hidden = false; else if (k === '3') toast('Vehicles arrive in a later step.'); };
  $('ghCall').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) callIn(b.dataset.k); });
  addEventListener('keydown', e => {
    if (e.code === 'KeyQ'){ const open = $('ghCall').hidden; $('ghTravel').hidden = $('ghBig').hidden = true; $('ghCall').hidden = !open; }
    else if (!$('ghCall').hidden && /^Digit[123]$/.test(e.code)) callIn(e.code.slice(5));
    else if (e.code === 'KeyM'){ $('ghCall').hidden = $('ghTravel').hidden = true; $('ghBig').hidden = !$('ghBig').hidden; }
    else if (e.code === 'Escape') $('ghCall').hidden = $('ghTravel').hidden = $('ghBig').hidden = true;
  });

  // ---------- time of day ----------
  const hemi = scene.children.find(o => o.isHemisphereLight), DAY = new THREE.Color(0xa9c3d1), DAWN = new THREE.Color(0xe9b98f), NIGHT = new THREE.Color(0x52658a), WARM = new THREE.Color(0xffb37a), WHITE = new THREE.Color(0xffffff), sky = DAY.clone();
  const DARK = new THREE.Color(0x080c18), MOON = new THREE.Color(0x9db4ff);
  function setSun(hr){   // 06:00-18:00 the sun crosses the sky; after about 18:00 it turns to night: dark sky, moonlight, lit windows and neon
    const t = Math.min(1, (hr-6)/14), el = Math.max(.07, Math.sin(Math.PI*t)), az = Math.PI*t, e = Math.min(1.45, el*1.08), c = Math.cos(e), n = Math.min(1, Math.max(0, (hr-18.2)/1.6));
    W.sun.position.set(Math.cos(az)*c, Math.sin(e), .45*c + .1); if (n > .5) W.sun.position.set(-.4,.8,.45);
    W.sun.intensity = (.8 + 2.6*el)*(1-n) + .22*n; W.sun.color.copy(WARM).lerp(WHITE, Math.min(1, el*1.7)).lerp(MOON, n);   // stronger sun, softer fill, so shadows read
    if (hemi) hemi.intensity = (.7 + .65*el)*(1-n) + .42*n;
    sky.copy(DAWN).lerp(DAY, Math.min(1, el*1.5)).lerp(DARK, n); W.setNight(n);
    $('ghSunO').textContent = no2(Math.floor(hr)) + ':' + no2(Math.round((hr%1)*60));
  }  $('ghSun').addEventListener('input', e => setSun(+e.target.value)); setSun(22);   // the city opens at night

  // ---------- cutaway: hide everything above a height ----------
  const cut = new THREE.Plane(new THREE.Vector3(0,-1,0), 200);
  $('ghCut').addEventListener('input', e => { const v = +e.target.value; cut.constant = v; renderer.clippingPlanes = v >= 200 ? [] : [cut]; $('ghCutO').textContent = v >= 200 ? 'off' : v + ' m'; });

  // ---------- weather: rain and snow fall in their own districts; how hard depends on the season (today's date, or the Season menu) ----------
  const RAIN_Z = [[-85,650,430],[195,410,240]], SNOW_Z = [[-5,-650,420],[-625,-650,340]];           // [x, z, radius]: Hive and London V2 get rain; the School and London V1 get snow
  const zone = (list,x,z) => Math.max(0, ...list.map(([cx,cz,r]) => 1 - Math.hypot(x-cx, z-cz)/r));
  const SEASONS = {winter:[.6,1], spring:[1,.25], summer:[.35,0], autumn:[.85,.55]};                   // [rain, snow] strength
  const autoSeason = () => ['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter'][new Date().getMonth()];
  let season = autoSeason(); const showSeason = () => $('ghSeasonO').textContent = season; showSeason();
  $('ghSeason').addEventListener('change', e => { season = e.target.value === 'auto' ? autoSeason() : e.target.value; showSeason(); });
  const NR = 1400, NS = 1800, BOX = 46, rnd = n => Float32Array.from({length:n}, () => Math.random()*BOX);
  const rx = rnd(NR), ry = rnd(NR), rz = rnd(NR), sx = rnd(NS), sy = rnd(NS), sz = rnd(NS);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR*6), 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({color:0xa9dcff, transparent:true, opacity:0, depthWrite:false})); rain.frustumCulled = false; scene.add(rain);
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS*3), 3));
  const snowP = new THREE.Points(snowGeo, new THREE.PointsMaterial({color:0xffffff, size:.16, sizeAttenuation:true, transparent:true, opacity:0, depthWrite:false})); snowP.frustumCulled = false; scene.add(snowP);
  const wrap = (v, c) => c + ((((v - c) % BOX) + BOX) % BOX) - BOX/2;
  function weather(now, dt){
    const c = camera.position, low = c.y < 140 && !W.inGlobe, S = SEASONS[season] || SEASONS.autumn;
    const ri = low ? Math.min(1, zone(RAIN_Z, c.x, c.z)*2.2) * S[0] : 0, si = low ? Math.min(1, zone(SNOW_Z, c.x, c.z)*2.2) * S[1] : 0;
    rain.visible = ri > .02; snowP.visible = si > .02; rain.material.opacity = ri*.6; snowP.material.opacity = si*.95;
    if (rain.visible){ const p = rainGeo.attributes.position.array; for (let i = 0; i < NR; i++){ ry[i] = (ry[i] - 30*dt + BOX) % BOX; const x = wrap(rx[i], c.x), z = wrap(rz[i], c.z), y = c.y - 14 + ry[i]; p.set([x, y, z, x + .06, y + .9, z], i*6); } rainGeo.attributes.position.needsUpdate = true; }
    if (snowP.visible){ const p = snowGeo.attributes.position.array, t = now*.001; for (let i = 0; i < NS; i++){ sy[i] = (sy[i] - 1.7*dt + BOX) % BOX; p[i*3] = wrap(sx[i] + Math.sin(t + i)*.6, c.x); p[i*3+1] = c.y - 14 + sy[i]; p[i*3+2] = wrap(sz[i] + Math.cos(t*.8 + i)*.6, c.z); } snowGeo.attributes.position.needsUpdate = true; }
    $('ghWx').textContent = ri > .05 ? 'rain' : si > .05 ? 'snow' : 'clear';
  }

  // ---------- every frame ----------
  let n = 0, next = null;
  W.frameHooks.push((now, rdt) => {
    document.body.dataset.mode = W.mode;
    compass(); if (n++ % 2 === 0){ const P = where(); drawMap(mc, 392, P.x, P.z, MR, 196, 196, 13); }
    if (!$('ghBig').hidden && n % 3 === 0) drawMap(bc, 900, 0, 0, 1350, 450, 500, 15);
    reticle(now);
    $('ghMap').style.display = W.inGlobe ? 'none' : '';
    if (!W.inGlobe){ scene.background.copy(sky); scene.fog.color.copy(sky); }
    if (rings.visible) rings.children.forEach((r,k) => r.scale.setScalar(1 + .12*Math.sin(now*.005 - k)));
    weather(now, Math.min(.05, rdt || .016));
    if (n % 20 === 0){
      const seen = PROJECTS.filter(p => p.seen).length; $('ghCount').textContent = no2(seen) + ' / ' + PROJECTS.length; $('ghFill').style.width = seen/PROJECTS.length*100 + '%';
      next = byTour.find(p => !p.seen && p.pos) || null; byTour.forEach(p => p.tb.classList.toggle('seen', !!p.seen));
      if (next){ const P = where(); $('ghObjName').textContent = `N° ${no2(next.no)} ${next.name}`; $('ghObjDist').textContent = 'visit and open its file · ' + Math.round(Math.hypot(next.pos.x-P.x, next.pos.z-P.z)) + ' m'; }
      else { $('ghObjName').textContent = 'Tour complete'; $('ghObjDist').textContent = 'every file opened'; }
    }
  });
}
