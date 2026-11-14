<script lang="ts">
 // Port of AppSettings.SettingRow and UpdateFlow's version/notes/size/action hierarchy.
 import Icon from '../../ui/Icon.svelte';import {updates} from '../../update.svelte';import {registerBack} from '../../ui/back';
 let dialog=$state<HTMLDivElement>();
 $effect(()=>{if(!updates.dialogOpen)return;queueMicrotask(()=>dialog?.focus({preventScroll:true}));return registerBack(()=>{updates.dismiss();return true;},120);});
 const size=$derived(((updates.release?.size||0)/1048576).toFixed(1)+' MB');
 const ready=$derived(updates.status==='ready'||updates.status==='permission');
</script>
<div class="setting-row version-row">
 <span><span class="setting-title">MuseTab {updates.current.version}</span><span class="setting-description" role="status">{updates.message||'Android 离线看谱、播放与编辑'}</span></span>
 <span class="setting-controls"><button class="btn-ghost btn-sm check-update" disabled={updates.busy} aria-busy={updates.status==='checking'} onclick={()=>updates.check()}><span class:spinning={updates.status==='checking'}><Icon name="refresh" size={16}/></span>检查更新</button></span>
</div>
{#if updates.available}
 <div class="setting-row version-row"><span><span class="setting-title">新版本 {updates.release?.version}</span><span class="setting-description">{size} · {ready?'已下载，可以安装':updates.status==='downloading'?'下载进行中':'查看更新内容后下载'}</span></span><span class="setting-controls"><button class="btn-ghost btn-sm" onclick={()=>updates.show()}>查看更新</button></span></div>
{/if}
{#if updates.dialogOpen&&updates.release}
 <div class="update-layer">
  <button class="modal-backdrop" aria-label="稍后更新" tabindex="-1" onclick={()=>updates.dismiss()}></button>
  <div class="update-dialog" role="dialog" aria-modal="true" aria-label="应用更新" tabindex="-1" bind:this={dialog} onkeydown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();updates.dismiss();}}}>
   <header><span class="update-mark"><Icon name="download" size={22}/></span><div><h2>发现新版本 {updates.release.version}</h2><p>MuseTab · {size}</p></div></header>
   <div class="update-content"><h3>更新内容</h3><p class="notes">{updates.release.notes||'此版本包含体验改进和问题修复。'}</p>
    {#if updates.status==='downloading'}<div class="download-state" role="status"><span>正在下载</span><strong>{updates.progress}%</strong><progress value={updates.progress} max="100" aria-label="更新下载进度"></progress></div>
    {:else if ready}<p class="download-state" role="status">{updates.message}</p>
    {:else if updates.status==='error'}<p class="download-error" role="alert">{updates.message}</p>{/if}
   </div>
   <footer>{#if updates.status==='downloading'}<button class="btn-ghost btn-sm" onclick={()=>updates.cancel()}>取消下载</button><button class="btn-ghost btn-sm" onclick={()=>updates.dismiss()}>后台下载</button>
    {:else}<button class="btn-ghost btn-sm" onclick={()=>updates.dismiss()}>稍后</button>{#if ready}<button class="btn-ghost btn-sm primary" onclick={()=>updates.install()}>安装更新</button>{:else}<button class="btn-ghost btn-sm primary" disabled={updates.busy} onclick={()=>updates.download()}>下载更新</button>{/if}{/if}</footer>
  </div>
 </div>
{/if}
<style>
 .version-row .setting-title,.version-row .setting-description{display:block}.setting-description{font-size:12px;color:var(--c-muted);line-height:1.7}.setting-controls{display:flex;align-items:center;gap:8px}.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:8px 16px;min-height:44px;border:1px solid var(--c-line);border-radius:999px;font-size:13px;}.check-update>span{display:flex}.spinning{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
 .update-layer{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:20px;pointer-events:auto}.modal-backdrop{position:absolute;inset:0;border:0;border-radius:0;background:#0006;cursor:default}.update-dialog{position:relative;display:flex;flex-direction:column;max-height:calc(100dvh - 40px);width:min(500px,100%);background:var(--c-paper);color:var(--c-ink);border:1px solid var(--c-line);border-radius:24px;box-shadow:var(--lift);outline:none;overflow:hidden}
 header{display:flex;align-items:center;gap:14px;padding:24px 24px 16px;flex:none}.update-mark{display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:50%;background:var(--c-soft);color:var(--c-accent)}h2{font-size:20px;font-weight:550;line-height:1.45;overflow-wrap:anywhere}header p{font-size:12px;color:var(--c-muted);margin-top:5px}.update-content{padding:0 24px 20px;min-height:0;overflow:auto;overscroll-behavior:contain}h3{font-size:12px;color:var(--c-muted);font-weight:500;margin:12px 0}.notes{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.85}.download-state{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:20px;font-size:13px;color:var(--c-muted)}progress{flex-basis:100%;width:100%;height:6px;border:0;border-radius:999px;overflow:hidden;accent-color:var(--c-accent)}.download-error{color:var(--c-danger);font-size:13px;line-height:1.8;margin-top:16px;overflow-wrap:anywhere}
 footer{display:flex;justify-content:flex-end;gap:12px;padding:16px 24px 20px;border-top:1px solid var(--c-line);flex:none}.primary{background:var(--c-ink);color:var(--c-paper);border-color:var(--c-ink)}@media(max-width:479px){.update-layer{padding:16px}header{padding:20px 20px 12px}.update-content{padding:0 20px 20px}footer{padding:16px 20px 20px}.update-dialog{max-height:calc(100dvh - 32px)}h2{font-size:18px}}@media(max-height:480px){header{padding-block:12px}.update-content{padding-bottom:12px}footer{padding-block:12px}}
</style>
