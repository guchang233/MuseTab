// 与安卓容器（android/MainActivity.java）的衔接。在浏览器里运行时这些都是空操作。
import { nav } from './ui/nav.svelte';
import { library } from './library/store.svelte';
import { engine } from './bridge/engine.svelte';
import { workspace } from './library/workspace.svelte';
import { openLocal } from './library/open.svelte';
import { reading } from './reader/layout.svelte';

type AndroidBridge = {
  appInfo?():string;
  checkUpdate?():void;
  downloadUpdate?():void;
  cancelUpdate?():void;
  installUpdate?():void;
  saveFile(name: string, base64: string): void;
  setImmersive(on: boolean): void;
  setSystemBars?(color: string, light: boolean): void;
  exitApp(): void;
};

declare global {
  interface Window {
    Android?: AndroidBridge;
    onNativeOpen?: (name: string, base64: string) => void;
    onNativeSaved?: (ok: boolean) => void;
    onNativeBack?: () => boolean;
    onNativeUpdate?: (event:{status:string;data:any})=>void;
  }
}

export const isAndroid = typeof window !== 'undefined' && !!window.Android;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 把内容交给用户保存：安卓上弹系统「另存为」，浏览器里直接下载 */
export function saveAs(name: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  if (window.Android) {
    return new Promise((resolve) => {
      window.onNativeSaved = (ok) => resolve(ok);
      window.Android!.saveFile(name, toBase64(bytes));
    });
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return Promise.resolve(true);
}

// 「用 MuseTab 打开」或文件选择器送来的文件：收进谱匣，并直接翻开
const queue: { name: string; bytes: Uint8Array }[] = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      // 引擎还没起来时先等着
      while (engine.status !== 'ready' && !queue[0].name.toLowerCase().endsWith('.pdf')) {
        if (engine.status === 'error') throw new Error(engine.error || '谱面核心没有启动');
        await new Promise((r) => setTimeout(r, 300));
      }
      const { name, bytes } = queue.shift()!;
      const file = new File([bytes as BlobPart], name);
      const rec = await library.add(file);
      if (!queue.length) {
        await openLocal(rec);
      }
    }
  } catch (e) {
    console.error(e);
    window.dispatchEvent(new CustomEvent('musetab-error',{detail:e instanceof Error?e.message:'没能导入乐谱'}));
  } finally {
    draining = false;
  }
}

window.onNativeOpen = (name, base64) => {
  queue.push({ name, bytes: fromBase64(base64) });
  drain();
};

// 返回键：编辑 → 看谱 → 谱匣 → 退出
window.onNativeBack = () => {
  if (reading.fullscreen) { void reading.setFullscreen(false); return true; }
  if (!window.dispatchEvent(new Event('musetab-back', { cancelable: true }))) return true;
  if (nav.screen === 'editor') {
    workspace.persist().then(()=>nav.go('reader')).catch(console.error);
    return true;
  }
  if (nav.screen === 'reader') {
    if (engine.playing) engine.stop();
    workspace.persist().then(()=>nav.go('library')).catch(console.error);
    return true;
  }
  return false;
};
