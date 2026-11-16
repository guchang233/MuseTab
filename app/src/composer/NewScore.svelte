<script lang="ts">
  import {createScore,instruments,type ScoreDraft} from './new-score';
  import {registerBack} from '../ui/back';
  import IconButton from '../ui/IconButton.svelte';
  import '../workspace/workspace.css';
  let {onclose,native=false}:{onclose:()=>void;native?:boolean}=$props();
  let draft=$state<ScoreDraft>({title:'',composer:'',instrument:'piano',beats:4,beatType:4,fifths:0,tempo:80,measures:8});
  let meter=$state('4/4'),error=$state(''),saving=$state(false);
  $effect(()=>registerBack(()=>{if(!saving)onclose();return true;},100));
  async function submit(){saving=true;error='';try{const [beats,beatType]=meter.split('/').map(Number);await createScore({...draft,beats,beatType});onclose();}catch(e){error=(e as Error).message||'乐谱未能创建';}finally{saving=false;}}
</script>
<div class="create-layer" class:zf-app={!native} class:native>
  <button class="backdrop" aria-label="取消新建乐谱" onclick={()=>{if(!saving)onclose();}}></button>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="新建乐谱" tabindex="-1">
    <header><h2>新建乐谱</h2><IconButton label="关闭新建乐谱" icon="close" disabled={saving} onclick={onclose}/></header>
    <form onsubmit={e=>{e.preventDefault();void submit();}}>
      <label>标题<input aria-label="乐谱标题" maxlength="120" placeholder="未命名乐谱" bind:value={draft.title}/></label>
      <label>作曲者<input aria-label="作曲者" maxlength="120" placeholder="可选" bind:value={draft.composer}/></label>
      <label>乐器与谱表<select aria-label="乐器与谱表" bind:value={draft.instrument}>{#each instruments as instrument}<option value={instrument.id}>{instrument.name}{instrument.staves===2?' · 高音与低音双谱表':''}</option>{/each}</select></label>
      <div class="fields"><label>拍号<select aria-label="拍号" bind:value={meter}>{#each ['2/4','3/4','4/4','6/8','9/8','12/8'] as value}<option>{value}</option>{/each}</select></label><label>调号<select aria-label="调号" bind:value={draft.fifths}>{#each [{n:-7,s:'C♭'},{n:-6,s:'G♭'},{n:-5,s:'D♭'},{n:-4,s:'A♭'},{n:-3,s:'E♭'},{n:-2,s:'B♭'},{n:-1,s:'F'},{n:0,s:'C / a'},{n:1,s:'G'},{n:2,s:'D'},{n:3,s:'A'},{n:4,s:'E'},{n:5,s:'B'},{n:6,s:'F♯'},{n:7,s:'C♯'}] as key}<option value={key.n}>{key.s}</option>{/each}</select></label></div>
      <div class="fields"><label>速度（四分音符 / 分钟）<input type="number" aria-label="初始速度" min="30" max="240" bind:value={draft.tempo}/></label><label>小节数<input type="number" aria-label="小节数" min="1" max="64" bind:value={draft.measures}/></label></div>
      {#if error}<p role="alert">{error}</p>{/if}
      <p class="help">会在本地创建 MSCZ 乐谱。进入编谱后，解锁并点击休止符或琴键开始录入。</p>
      <button class="submit" type="submit" disabled={saving}>{saving?'正在创建…':'创建乐谱'}</button>
    </form>
  </div>
</div>
<style>
  .native .dialog,.native .dialog button,.native .dialog input,.native .dialog select{border-radius:3px;}.native .dialog h2{font:600 18px/1.5 var(--font-ui);}
  .create-layer{position:fixed;inset:0;z-index:var(--z-modal);display:grid;place-items:center;padding:16px;pointer-events:auto;overflow:auto;}.backdrop{position:absolute;inset:0;border-radius:0;background:var(--shade);}.dialog{position:relative;display:flex;flex-direction:column;min-width:0;width:min(500px,calc(100vw - 32px));max-height:min(760px,calc(100dvh - 32px));overflow:hidden;background:var(--paper);color:var(--ink);border:1px solid var(--hairline);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);}header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 12px 0 24px;flex:none;background:var(--paper);}h2{font:500 27px/1.25 var(--font-display);font-style:italic;}form{display:grid;gap:16px;overflow:auto;padding:8px 24px 24px;}label{display:flex;flex-direction:column;gap:7px;font-size:13px;color:var(--ink-soft);}input,select{width:100%;min-width:0;min-height:48px;border:1px solid var(--hairline);background:var(--veil);color:var(--ink);border-radius:var(--radius-pill);padding:10px 16px;font:15px var(--font-ui);}.fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;}.submit{min-height:50px;border-radius:var(--radius-pill);background:var(--rubric);color:var(--on-rubric);}.submit:disabled{opacity:.6;}.help{font-size:12px;color:var(--ink-soft);line-height:1.7;}[role=alert]{color:var(--danger);font-size:14px;}
</style>
