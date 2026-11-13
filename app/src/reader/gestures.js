// Shared by the App and its Qt iframe. Coordinates are always CSS pixels.
export function readerGestures(target, options) {
  const points=new Map();let start=null,last=null,pinch=null,multiple=false;
  const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const metric=()=>{const [a,b]=[...points.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
  function down(e){
    if(!options.enabled(e))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!options.inking?.()||points.size>1)consume(e);
    if(points.size===1){start={x:e.clientX,y:e.clientY,time:performance.now()};last={...start};multiple=false;}
    else{multiple=true;pinch=metric();options.cancel?.();}
    try{e.target.setPointerCapture(e.pointerId);}catch{}
  }
  function move(e){
    if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(options.inking?.()&&!multiple&&points.size===1)return;consume(e);
    if(points.size>=2){const next=metric();if(pinch)options.zoom(next.d/pinch.d,next.x,next.y,next.x-pinch.x,next.y-pinch.y);pinch=next;}
    else if(!multiple&&last){if(!options.gallery()||options.zoomed())options.pan(e.clientX-last.x,e.clientY-last.y);last={x:e.clientX,y:e.clientY};}
  }
  function up(e){
    if(!points.has(e.pointerId))return;points.delete(e.pointerId);if(options.inking?.()&&!multiple){start=last=pinch=null;return;}consume(e);
    if(!multiple&&start){const dx=e.clientX-start.x,dy=e.clientY-start.y;
      if(Math.hypot(dx,dy)<10&&performance.now()-start.time<500)options.tap(e);
      else if(options.gallery()&&!options.zoomed()&&Math.abs(dx)>=Math.max(36,innerWidth*.08)&&Math.abs(dx)>Math.abs(dy)*1.3)options.turn(dx<0?1:-1);
    }
    if(!points.size){start=last=pinch=null;options.end?.();}
  }
  function cancel(e){if(points.has(e.pointerId)){consume(e);points.delete(e.pointerId);multiple=true;if(!points.size){start=last=pinch=null;options.end?.();}}}
  function wheel(e){if(!options.enabled(e))return;consume(e);if(e.ctrlKey||e.metaKey)options.zoom(Math.exp(-e.deltaY*.004),e.clientX,e.clientY,0,0);else if(!options.gallery()||options.zoomed())options.pan(-e.deltaX,-e.deltaY);}
  const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,wheel};
  for(const [name,handler]of Object.entries(events))target.addEventListener(name,handler,{capture:true,passive:false});
  return()=>{for(const [name,handler]of Object.entries(events))target.removeEventListener(name,handler,true);};
}
