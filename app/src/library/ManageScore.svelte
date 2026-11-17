<script lang="ts">
 import {library,type ScoreRecord} from './store.svelte';import {saveAs} from '../native';import IconButton from '../ui/IconButton.svelte';
 import {registerBack} from '../ui/back';
 let {record,onclose}:{record:ScoreRecord;onclose:()=>void}=$props();
 let action=$state<'menu'|'rename'|'delete'>('menu'),name=$state(''),busy=$state(false),error=$state('');
 $effect(()=>{name=record.displayName||record.title||record.name;});
 const title=$derived(record.displayName||record.title||record.name);
 $effect(()=>registerBack(()=>{if(action!=='menu')action='menu';else onclose();return true;},100));
 async function run(kind:'rename'|'delete'|'export'){
  busy=true;error='';try{
   if(kind==='rename'){await library.rename(record.id,name);onclose();}
   else if(kind==='delete'){await library.remove(record.id);onclose();}
   else{const bytes=await library.bytes(record.id);const fileName=title.replace(/[\\/:*?"<>|]/g,'_')+'.'+record.ext;await saveAs(fileName,bytes,record.ext==='pdf'?'application/pdf':'application/octet-stream');}
  }catch(e){error=e instanceof Error?e.message:'操作未完成，请重试';}finally{busy=false;}
 }
</script>
<div class="manage-backdrop">
 <div class="manage-sheet" role="dialog" aria-modal="true" aria-label="管理乐谱" tabindex="-1">
  <header><h2>管理乐谱</h2><IconButton label="关闭管理" icon="close" onclick={onclose}/></header>
  <h3>{title}</h3><p class="meta">{record.ext.toUpperCase()} · {(record.size/1024).toFixed(1)} KB · {record.source?'已下载到本地':'本地导入'}</p>
  {#if action==='menu'}<div class="actions"><button onclick={()=>action='rename'}>重命名</button><button disabled={busy} onclick={()=>run('export')}>导出{record.ext==='pdf'?'原始 PDF':'文件'}</button><button class="danger" onclick={()=>action='delete'}>删除乐谱</button></div>
  {:else if action==='rename'}<form onsubmit={e=>{e.preventDefault();void run('rename');}}><label>乐谱名称<input bind:value={name} maxlength="240" required aria-label="乐谱名称"/></label><p>修改本地显示名称，谱面内的标题保持原样。</p><div class="actions row"><button type="button" onclick={()=>action='menu'}>取消</button><button disabled={busy||!name.trim()} type="submit">保存名称</button></div></form>
  {:else}<p class="delete-question">删除“{title}”以及它在此设备上的批注？</p><p>云端仓库里的原文件不会改变。</p><div class="actions row"><button onclick={()=>action='menu'}>取消</button><button class="danger" disabled={busy} onclick={()=>run('delete')}>确认删除</button></div>{/if}
  {#if record.ext==='pdf'&&action==='menu'}<p>导出的原始 PDF 不包含本地手写批注。</p>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
 </div>
</div>
<style>
 .manage-backdrop{position:fixed;inset:0;z-index:90;background:var(--shade);display:grid;place-items:center;padding:20px;pointer-events:auto;overflow:auto;}.manage-sheet{min-width:0;width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto;overscroll-behavior:contain;border-radius:var(--sheet-radius);background:var(--paper);color:var(--ink);padding:20px 24px 28px;box-shadow:var(--island-ring),var(--shadow-lg);border:0;}header{display:flex;align-items:center;justify-content:space-between;gap:12px;}h2{font:600 22px/1.3 var(--font-ui);}h3{font-size:16px;margin:18px 0 8px;overflow-wrap:anywhere;font-weight:500;}p{font-size:12px;color:var(--ink-soft);line-height:1.8;margin:10px 0;}.actions{display:flex;flex-direction:column;gap:12px;margin-top:24px;}.actions.row{flex-direction:row;}.actions button{min-height:48px;flex:1;padding:10px 16px;border:0;border-radius:var(--chip-radius);background:var(--veil);box-shadow:var(--island-ring);font:500 14px/1.2 var(--font-ui);}.danger{color:var(--danger);}.delete-question{font-size:15px;color:var(--ink);}label{display:flex;flex-direction:column;gap:10px;margin-top:20px;}input{min-height:48px;width:100%;padding:10px 14px;border:0;border-radius:var(--chip-radius);box-shadow:var(--island-ring);background:var(--veil);color:var(--ink);font:15px var(--font-ui);}.meta{font-variant-numeric:tabular-nums;}@media(max-width:600px){.manage-backdrop{align-items:end;padding:12px;}.manage-sheet{padding:18px 20px 28px;}}
</style>
