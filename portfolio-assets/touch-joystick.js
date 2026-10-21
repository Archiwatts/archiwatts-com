(()=>{
const state=window.touchJoystick={x:0,y:0,active:false};
const pad=document.createElement('div');pad.className='walk-joystick';pad.tabIndex=0;pad.setAttribute('role','group');pad.setAttribute('aria-label','Movement joystick: drag in any direction');pad.innerHTML='<span></span>';document.body.append(pad);let pointer=null;
function reset(){pointer=null;Object.assign(state,{x:0,y:0,active:false});pad.firstChild.style.transform='translate(0,0)'}
function update(e){const b=pad.getBoundingClientRect(),dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2,length=Math.hypot(dx,dy),radius=34,scale=Math.min(1,radius/Math.max(1,length));state.x=dx*scale/radius;state.y=dy*scale/radius;state.active=length>4;if(!state.active){state.x=state.y=0}pad.firstChild.style.transform=`translate(${state.x*radius}px,${state.y*radius}px)`}
pad.addEventListener('pointerdown',e=>{if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;pad.setPointerCapture(pointer);update(e)});
pad.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();update(e)}});
for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,reset);
addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
setInterval(()=>{const walk=window.modelWalkBridge?.mode?.()==='walk'||document.body.classList.contains('walk-active')||document.body.classList.contains('walking')||document.querySelector('[data-mm-mode="walk"][aria-pressed="true"]');const show=!!walk&&matchMedia('(max-width:900px)').matches&&!document.body.classList.contains('mm-menu-open')&&!window.guidedWalk?.running?.();pad.dataset.active=String(show);if(!show)reset()},120);
})();
