/* Shared limits and lifecycle handling for the existing and future model viewers. */
(()=>{
 if(window.modelPerformance)return;
 const mobile=matchMedia('(max-width:900px)').matches||(matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<=900);
 const release='20261030-phone-r2';
 const style=document.createElement('style');style.textContent='.model-recovery{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1000;width:min(320px,85vw);padding:20px;border:1px solid #77717e;border-radius:14px;background:#303238;color:white;font:14px/1.5 Arial;box-shadow:0 8px 32px #0005}.model-recovery button{padding:10px 18px;border:1px solid #aaa;border-radius:22px;background:#f3edf2;color:#28252b}';document.head.append(style);
 async function script(src){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>{s.remove();resolve()};s.onerror=()=>{s.remove();reject(new Error('Could not load '+src))};document.head.append(s)})}
 async function mapLimit(items,limit,fn){const results=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(items.length,limit)},async()=>{while(next<items.length){const i=next++;results[i]=await fn(items[i],i)}}));return results}
 async function decodeParts(parts){const info=window.projectModelInfo||{};if((!parts||!parts.length)&&info.glb){const res=await fetch(new URL(info.glb,document.baseURI)+(info.release?'?v='+info.release:''));if(!res.ok)throw new Error('Model file could not be loaded ('+res.status+')');return new Uint8Array(await res.arrayBuffer())}const length=parts.reduce((n,s)=>n+s.length/4*3-(s.endsWith('==')?2:s.endsWith('=')?1:0),0),bytes=new Uint8Array(length);let offset=0;for(let i=0;i<parts.length;i++){const text=atob(parts[i]);parts[i]=null;for(let j=0;j<text.length;j++)bytes[offset+j]=text.charCodeAt(j);offset+=text.length;await new Promise(r=>setTimeout(r,0))}return bytes}
 const attached=new WeakSet(),stats={mobile,release,renderedFrames:0,contextLost:false,cleanups:0};
 let closing=false;
 function attach(c){if(!c?.renderer||attached.has(c.renderer))return;const renderer=c.renderer;attached.add(renderer);const setRatio=renderer.setPixelRatio.bind(renderer);let want=Math.max(1,window.devicePixelRatio||1),moving=false,settle=null;const cap=()=>mobile?(moving?1.25:2):1.5;renderer.setPixelRatio=value=>{want=Number(value)||1;const next=Math.min(want,cap());if(Math.abs(next-renderer.getPixelRatio())>.01)setRatio(next)};renderer.setPixelRatio(want);
  if(mobile&&c.controls?.addEventListener){c.controls.addEventListener('start',()=>{clearTimeout(settle);if(!moving){moving=true;renderer.setPixelRatio(want)}});c.controls.addEventListener('end',()=>{clearTimeout(settle);settle=setTimeout(()=>{moving=false;renderer.setPixelRatio(want);renderer.render(c.scene,c.camera)},300)})}
  const render=renderer.render.bind(renderer);let last=0,timer=null,queued=null,lost=false;
  function draw(){timer=null;if(!queued||lost||document.hidden||closing)return;const args=queued;queued=null;render(...args);last=performance.now();stats.renderedFrames++}
  renderer.render=function(...args){if(document.hidden||lost||closing)return;const offscreen=renderer.getRenderTarget?.();if(!mobile||offscreen){render(...args);stats.renderedFrames++;return}queued=args;const delay=34-(performance.now()-last);if(delay<=0){if(timer!==null)clearTimeout(timer);draw()}else if(timer===null)timer=setTimeout(draw,delay)};
  const canvas=renderer.domElement;
  let notice;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stats.contextLost=true;queued=null;if(timer!==null)clearTimeout(timer);timer=null;if(closing)return;notice=document.createElement('div');notice.className='model-recovery';notice.setAttribute('role','status');notice.innerHTML='<p>The 3D view paused to free graphics memory.</p><button type="button">Reload the view</button>';notice.querySelector('button').onclick=()=>location.reload();document.body.append(notice)});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;stats.contextLost=false;notice?.remove();renderer.render(c.scene,c.camera)});
  addEventListener('pagehide',e=>{if(e.persisted)return;closing=true;queued=null;if(timer!==null)clearTimeout(timer);renderer.dispose();renderer.forceContextLoss?.();stats.cleanups++});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){queued=null;if(timer!==null)clearTimeout(timer);timer=null}else if(!lost&&!closing)renderer.render(c.scene,c.camera)});
 }
 window.modelPerformance={mobile,release,script,mapLimit,decodeParts,attach,state:()=>({...stats})};
 const poll=setInterval(()=>{if(window.daylightContext)attach(window.daylightContext)},150);addEventListener('pagehide',e=>{if(!e.persisted)clearInterval(poll)});
})();
