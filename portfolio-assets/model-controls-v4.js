(()=>{
 function cleanup(){
  const snapshot=document.querySelector('.project-snapshot');if(!snapshot)return false;const guided=document.querySelector('.guided-walk-controls');if(guided&&guided.previousElementSibling!==snapshot)snapshot.after(guided);
  const explorer=window.campusExplorer||window.phalansteryExplorer||window.riverExplorer;if(!explorer?.getState().ready||!window.siteLife&&!window.phalansteryExplorer)return false;
  if(document.getElementById('movement-mode')&&!window.playfulMode)return false;
  for(const id of ['crowd-mode','movement-mode']){const select=document.getElementById(id);if(select){select.value='natural';select.closest('label')?.remove()}}
  for(const p of document.querySelectorAll('.crowd-controls p,.motion-console .source-note'))if(/Move your pointer|Move the pointer/.test(p.textContent))p.textContent='Natural wandering on the project’s supported routes.';
  const controls=document.querySelector('.crowd-controls,.motion-console');if(controls&&!controls.querySelector('.people-variants')){const label=document.createElement('p');label.className='people-variants';label.textContent='8 sketch variants · men, women, children, and older visitors';controls.append(label)}
  if(window.riverTour){const snapshot=document.querySelector('.project-snapshot'),info=document.createElement('section');info.className='guided-walk-controls';info.innerHTML='<b>Guided walk</b><p>Slow tour · entrance → public sanctuary → bridge → intimate sanctuary.</p><div><button id="guided-start">Start / pause tour</button><button id="guided-stop">Stop</button></div>';snapshot?.after(info);info.querySelector('#guided-start').onclick=()=>{if(window.riverTour.state().active)riverTour.pause();else if(!window.riverTour.state().progress&&!window.riverTour.state().index)riverTour.start();else riverTour.pause()};info.querySelector('#guided-stop').onclick=()=>riverTour.stop();window.guidedWalk={start:()=>riverTour.start(),stop:()=>riverTour.stop(),running:()=>riverTour.state().active,state:()=>riverTour.state(),getRoute:()=>({points:riverTour.state().waypoints.map(w=>w.position)})};document.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','Escape'].includes(e.code))riverTour.stop()})}
  window.modelControlsV4Ready=true;return true;
 }
 let attempts=0;function poll(){if(cleanup()||attempts++>1800)return;setTimeout(poll,100)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',poll);else poll();
})();
