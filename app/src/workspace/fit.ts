import {engine} from '../bridge/engine.svelte';
/** Fit the visible page, including its translation, after the surface resizes.
 * MuseScore's PageWidth action changes scale but preserves a previous pan. */
export function fitScore(){
  const timer=setTimeout(()=>{
    if(engine.status!=='ready'||!engine.project.open)return;
    const width=engine.frame?.clientWidth||innerWidth,height=engine.frame?.clientHeight||innerHeight;
    const pages=engine.pageMetrics().map(p=>p.rect).filter((r):r is NonNullable<typeof r>=>!!r);
    const visible=pages.reduce((best,r)=>{
      const area=Math.max(0,Math.min(width,r.x+r.w)-Math.max(0,r.x))*Math.max(0,Math.min(height,r.y+r.h)-Math.max(0,r.y));
      return area>best.area?{rect:r,area}:best;
    },{rect:pages[0],area:-1});
    const rect=visible.rect;if(!rect?.w)return;
    const margin=width<600?8:20,factor=(width-margin*2)/rect.w;
    engine.gestureView(factor,margin-rect.x*factor,margin-rect.y*factor,0,0);
  },180);
  return()=>clearTimeout(timer);
}
