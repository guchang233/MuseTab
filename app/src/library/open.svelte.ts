import { library, type ScoreRecord } from './store.svelte';
import { workspace } from './workspace.svelte';
import { engine } from '../bridge/engine.svelte';
import { nav } from '../ui/nav.svelte';
import {activity} from '../ui/activity.svelte';
let opening = $state(false);
export const documents = { get opening() { return opening; } };
export async function openLocal(rec: ScoreRecord) {
  if (opening) return;
  opening = true;
  try {
    await activity.run('正在打开乐谱…',async()=>{
    await workspace.persist();
    if (engine.playing) engine.stop();
    if (rec.ext !== 'pdf') {
      const deadline=Date.now()+90000;
      while(engine.status==='idle'||engine.status==='loading'){
        if(Date.now()>deadline)throw new Error('谱面核心启动超时，请重新打开应用');
        await new Promise(resolve=>setTimeout(resolve,80));
      }
      if (engine.status !== 'ready') throw new Error(engine.error || '谱面核心没有启动');
      const bytes = await library.bytes(rec.id);
      if (!bytes) throw new Error('本地文件已丢失，请重新导入');
      await engine.open(bytes, rec.ext);
    }
    await library.touch(rec.id);
    nav.go('reader');
    });
  } finally { opening = false; }
}
