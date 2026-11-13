// Persist the active document before changing files or leaving the editor.
import { engine } from '../bridge/engine.svelte';
import { library } from './store.svelte';

let inFlight: Promise<void> | null = null;
let saving = $state(false);
let error = $state('');

export const workspace = {
  get saving(){return saving;},
  get error(){return error;},
  async persist(force=false): Promise<void> {
    if(inFlight)return inFlight;
    const id=library.current?.id;
    if(!id||library.current?.ext==='pdf'||!engine.project.open||(!engine.dirty&&!force))return;
    saving=true;
    error='';
    inFlight=(async()=>{
      do{
        const seq=engine.changeSeq;
        const bytes=await engine.exportTo('mscz');
        await library.replace(id,bytes);
        engine.markStored(seq);
      }while(engine.dirty&&library.current?.id===id);
    })().catch(e=>{
      error=e instanceof Error?e.message:'保存没有成功，请留在当前乐谱重试';
      throw e;
    }).finally(()=>{inFlight=null;saving=false;});
    return inFlight;
  },
};

addEventListener('beforeunload',e=>{
  if(engine.dirty&&library.current?.ext!=='pdf'){e.preventDefault();e.returnValue='';}
});
