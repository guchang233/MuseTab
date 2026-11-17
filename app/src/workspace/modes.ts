import {engine} from '../bridge/engine.svelte';
import {workspace} from '../library/workspace.svelte';
import {reading} from '../reader/layout.svelte';
import {nav,type Screen} from '../ui/nav.svelte';
import {activity} from '../ui/activity.svelte';
import {tick} from 'svelte';
import {flushComposer} from '../composer/session';
export type ScoreMode=Exclude<Screen,'library'>;
let returnView:{fullscreen:boolean;page:number;rect?:{x:number;y:number;w:number;h:number};width:number}|null=null;
function captureView(){
  const metrics=engine.pageMetrics(),width=engine.frame?.clientWidth||innerWidth,height=engine.frame?.clientHeight||innerHeight;
  const page=reading.fullscreen?reading.page:metrics.findIndex(p=>p.rect&&p.rect.x<width&&p.rect.x+p.rect.w>0&&p.rect.y<height&&p.rect.y+p.rect.h>0);
  return {fullscreen:reading.fullscreen,page:Math.max(0,page),rect:metrics[Math.max(0,page)]?.rect,width};
}
export async function changeMode(mode:Screen){
  if(mode===nav.screen)return;
  await activity.run('正在切换…',async()=>{
    if(nav.screen==='editor'){try{await flushComposer();}catch{/* 离开不能被未完成的命令卡住 */}}
    if(mode==='editor')returnView=captureView();
    try{if(engine.noteInput)engine.dispatch('note-input');}catch{/* 只读或未就绪时忽略 */}
    try{await workspace.persist();}catch{/* 保存失败仍要能切换，错误由工作区提示 */}
    if(mode==='library')engine.pause();
    await reading.setFullscreen(false);
    if(mode==='editor'&&returnView?.fullscreen)engine.pageView(returnView.page,engine.frame?.clientWidth||innerWidth,engine.frame?.clientHeight||innerHeight);
    nav.go(mode);
  },'mode-switch');
}
export async function closeComposer(){
  await activity.run('正在返回…',async()=>{
    try{await flushComposer();}catch{/* 退出优先于未完成的编辑 */}
    try{engine.composerState({closePopup:true});}catch{/* 核心未就绪时仍离开界面 */}
    await tick();
    try{if(engine.noteInput)engine.dispatch('note-input');}catch{/* 忽略 */}
    try{await workspace.persist();}catch{/* 保存失败不把人留在编谱里 */}
    const view=returnView;returnView=null;
    nav.go(nav.composerParent);
    await tick();await new Promise(resolve=>setTimeout(resolve,230));
    if(view?.fullscreen){engine.pageView(view.page,engine.frame?.clientWidth||innerWidth,engine.frame?.clientHeight||innerHeight);await reading.setFullscreen(true);return;}
    if(view?.rect&&nav.screen!=='library'){
      const current=engine.pageMetrics()[view.page]?.rect;
      if(current){const ratio=(engine.frame?.clientWidth||innerWidth)/view.width,target=view.rect,factor=target.w*ratio/current.w;engine.gestureView(factor,target.x*ratio-current.x*factor,target.y*ratio-current.y*factor,0,0);}
    }
  },'close-composer');
}
