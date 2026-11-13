import { library, type ScoreRecord } from './store.svelte';
import { workspace } from './workspace.svelte';
import { engine } from '../bridge/engine.svelte';
import { nav } from '../ui/nav.svelte';
let opening = $state(false);
export const documents = { get opening() { return opening; } };
export async function openLocal(rec: ScoreRecord) {
  if (opening) return;
  opening = true;
  try {
    await workspace.persist();
    if (engine.playing) engine.stop();
    if (rec.ext !== 'pdf') {
      if (engine.status !== 'ready') throw new Error(engine.status === 'error' ? engine.error || '谱面核心没有启动' : '谱面核心正在准备，请稍后再打开');
      const bytes = await library.bytes(rec.id);
      if (!bytes) throw new Error('本地文件已丢失，请重新导入');
      await engine.open(bytes, rec.ext);
    }
    await library.touch(rec.id);
    nav.go('reader');
  } finally { opening = false; }
}
