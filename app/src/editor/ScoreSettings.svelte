<script lang="ts">
  import { untrack } from 'svelte';
  import { engine, type ScoreStyle } from '../bridge/engine.svelte';
  import { workspace } from '../library/workspace.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import {registerBack} from '../ui/back';
  import {activity} from '../ui/activity.svelte';
  let { kind, onclose }: { kind: 'page' | 'style' | 'transpose'; onclose: () => void } = $props();
  let draft = $state<ScoreStyle | null>(null), error = $state(''), saving = $state(false);
  let key = $state(0), direction = $state(2), whole = $state(true);
  let dialog: HTMLDivElement;
  let original: ScoreStyle | null = null;
  const pageKeys = ['width','height','left','right','top','bottom','twoSided'] as const;
  const styleKeys = ['spatium','staffDistance','minSystemDistance','maxSystemDistance','measureSpacing','staffLineWidth','verticalSpread'] as const;
  const styleFields = [
    { key:'spatium', label:'谱间距', unit:'mm', min:.5, max:5, step:.05 },
    { key:'staffDistance', label:'同组谱表间距', unit:'sp', min:0, max:30, step:.5 },
    { key:'minSystemDistance', label:'谱表组最小间距', unit:'sp', min:0, max:80, step:.5 },
    { key:'maxSystemDistance', label:'谱表组最大间距', unit:'sp', min:0, max:80, step:.5 },
    { key:'measureSpacing', label:'小节间距倍率', unit:'×', min:.5, max:4, step:.05 },
    { key:'staffLineWidth', label:'五线谱线宽', unit:'sp', min:.03, max:.5, step:.01 },
  ] as const;
  const keyNames=['C♭ / A♭m','G♭ / E♭m','D♭ / B♭m','A♭ / Fm','E♭ / Cm','B♭ / Gm','F / Dm','C / Am','G / Em','D / Bm','A / F♯m','E / C♯m','B / G♯m','F♯ / D♯m','C♯ / A♯m'];
  const title = $derived(kind === 'page' ? '页面设置' : kind === 'style' ? '谱面样式' : '移调');
  $effect(() => {
    const mode=kind;
    untrack(() => {
      try {
        if(mode!=='transpose'){
          const values=engine.scoreStyle();
          for(const name of Object.keys(values) as (keyof ScoreStyle)[])if(typeof values[name]==='number')(values as any)[name]=Math.round((values[name] as number)*10000)/10000;
          original={...values};draft=values;
        }
      } catch(e){error=e instanceof Error?e.message:'设置未能读取';}
      queueMicrotask(()=>dialog?.focus());
    });
  });
  function close(){if(!saving)onclose();}
  $effect(()=>{
    const off=registerBack(()=>{close();return true;},100);
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};
    addEventListener('keydown',escape);
    return()=>{off();removeEventListener('keydown',escape);};
  });
  function paper(value:string){
    if(!draft||value==='custom')return;
    const sizes:Record<string,[number,number]>={a4:[210,297],a3:[297,420],letter:[215.9,279.4]};
    const dimensions=sizes[value],landscape=draft.width>draft.height;
    draft.width=dimensions[landscape?1:0];draft.height=dimensions[landscape?0:1];
  }
  function orientation(landscape:boolean){if(draft&&(draft.width>draft.height)!==landscape)[draft.width,draft.height]=[draft.height,draft.width];}
  async function apply(){
    if(saving)return;
    error='';saving=true;
    try{
      await activity.run('正在应用设置…',async()=>{
      let result;
      if(kind==='transpose')result=engine.transposeScore(key,direction,whole);
      else{
        if(!draft)throw Error('设置尚未读取');
        const values:Partial<ScoreStyle>={};
        for(const name of kind==='page'?pageKeys:styleKeys){
          const value=draft[name];
          if(typeof value!=='boolean'&&!Number.isFinite(value))throw Error('请填写有效的数值');
          if(value!==original?.[name])(values as any)[name]=value;
        }
        result=engine.applyScoreStyle(values);
      }
      if(!result.ok)throw Error(result.message||'设置没有应用，请检查参数');
      await workspace.persist(true);
      engine.dispatch('zoom-page-width');
      onclose();
      });
    }catch(e){error=e instanceof Error?e.message:'设置没有保存，请重试';}
    finally{saving=false;}
  }
</script>

<div class="settings-layer">
  <button class="backdrop" aria-label="关闭设置面板" onclick={close}></button>
  <div class="score-settings" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={dialog}>
    <header><h2>{title}</h2><IconButton label="关闭{title}" icon="close" disabled={saving} onclick={close}/></header>
    <form novalidate onsubmit={event=>{event.preventDefault();void apply();}}>
      <div class="body">
        {#if error}<p class="error" role="alert">{error}</p>{/if}
        {#if kind==='transpose'}
          <label>目标调号<select aria-label="目标调号" bind:value={key}>{#each keyNames as label,i}<option value={i-7}>{label}</option>{/each}</select></label>
          <label>移调方向<select aria-label="移调方向" bind:value={direction}><option value={2}>就近</option><option value={0}>向上</option><option value={1}>向下</option></select></label>
          <fieldset><legend>范围</legend><label class="check"><input type="radio" bind:group={whole} value={true}/>整份乐谱</label><label class="check"><input type="radio" bind:group={whole} value={false}/>当前选区</label></fieldset>
          <p class="hint">同时移调音符、调号与和弦名称，可用撤销恢复。</p>
        {:else if draft}
          {#if kind==='page'}
            <label>纸张预设<select aria-label="纸张预设" value="custom" onchange={event=>paper(event.currentTarget.value)}><option value="custom">自定义 / 当前尺寸</option><option value="a4">A4</option><option value="a3">A3</option><option value="letter">Letter</option></select></label>
            <div class="orientation" role="group" aria-label="纸张方向"><button type="button" aria-pressed={draft.width<=draft.height} onclick={()=>orientation(false)}>纵向</button><button type="button" aria-pressed={draft.width>draft.height} onclick={()=>orientation(true)}>横向</button></div>
            <div class="fields">
              <label>页面宽度 <small>mm</small><input aria-label="页面宽度" type="number" min="60" max="1000" step="0.1" bind:value={draft.width} required/></label>
              <label>页面高度 <small>mm</small><input aria-label="页面高度" type="number" min="60" max="2000" step="0.1" bind:value={draft.height} required/></label>
              <label>左页边距 <small>mm</small><input aria-label="左页边距" type="number" min="0" step="0.1" bind:value={draft.left} required/></label>
              <label>右页边距 <small>mm</small><input aria-label="右页边距" type="number" min="0" step="0.1" bind:value={draft.right} required/></label>
              <label>上页边距 <small>mm</small><input aria-label="上页边距" type="number" min="0" step="0.1" bind:value={draft.top} required/></label>
              <label>下页边距 <small>mm</small><input aria-label="下页边距" type="number" min="0" step="0.1" bind:value={draft.bottom} required/></label>
            </div>
            <label class="check"><input type="checkbox" bind:checked={draft.twoSided}/>双面排版，镜像左右页边距</label>
          {:else}
            <div class="fields">{#each styleFields as field}
              <label>{field.label} <small>{field.unit}</small><input aria-label={field.label} type="number" min={field.min} max={field.max} step="any" bind:value={draft[field.key]} required/></label>
            {/each}</div>
            <label class="check"><input type="checkbox" bind:checked={draft.verticalSpread}/>自动均匀分配纵向间距</label>
            <p class="hint">sp 为谱间距单位。更改会重新排谱，并保留音符和记号。</p>
          {/if}
        {:else}<p class="hint">正在读取当前乐谱…</p>{/if}
      </div>
      <footer><button type="button" onclick={close} disabled={saving}>取消</button><button type="submit" class="apply" disabled={saving||kind!=='transpose'&&!draft}>{saving?'正在保存…':'应用并保存'}</button></footer>
    </form>
  </div>
</div>

<style>
  .settings-layer{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:16px;}
  .backdrop{position:absolute;inset:0;background:#0006;cursor:default;border-radius:0;}
  .score-settings{position:relative;width:min(600px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:var(--parchment);border:1px solid var(--hairline);border-radius:16px;box-shadow:var(--lift);outline:none;overflow:hidden;}
  header{display:flex;align-items:center;justify-content:space-between;flex:none;padding:8px 12px 8px 20px;border-bottom:1px solid var(--hairline);}
  h2{font-size:20px;font-weight:500;}
  form{display:flex;flex-direction:column;min-height:0;}
  .body{overflow-y:auto;overscroll-behavior:contain;padding:20px;display:flex;flex-direction:column;gap:18px;min-height:0;}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:18px 16px;}
  label{display:flex;flex-direction:column;gap:8px;font-size:14px;}
  small{display:inline;color:var(--ink-soft);font-size:12px;}
  input[type=number],select{width:100%;min-width:0;min-height:48px;padding:8px 12px;border:1px solid var(--hairline);border-radius:8px;background:var(--sheet);color:var(--ink);font:inherit;font-size:16px;}
  .orientation{display:flex;gap:8px;}
  .orientation button{flex:1;border:1px solid var(--hairline);border-radius:999px;min-height:44px;font-size:14px;}
  .orientation button[aria-pressed=true]{background:var(--rubric-wash);border-color:var(--rubric);color:var(--rubric);}
  .check{flex-direction:row;align-items:center;gap:10px;min-height:44px;}
  .check input{width:20px;height:20px;accent-color:var(--rubric);}
  fieldset{border:1px solid var(--hairline);border-radius:8px;padding:12px 16px;}
  legend{font-size:14px;padding:0 6px;}
  .hint{font-size:13px;color:var(--ink-soft);line-height:1.8;}
  .error{font-size:14px;color:var(--rubric);padding:10px;border:1px solid currentColor;border-radius:8px;overflow-wrap:anywhere;}
  footer{display:flex;justify-content:flex-end;gap:12px;padding:12px 20px max(12px,env(safe-area-inset-bottom));border-top:1px solid var(--hairline);flex:none;background:var(--parchment);}
  footer button{min-height:48px;padding:0 20px;border:1px solid var(--hairline);border-radius:999px;font-size:14px;}
  .apply{background:var(--rubric);color:var(--on-rubric);border-color:var(--rubric);}
  @media(max-width:600px){.settings-layer{align-items:flex-end;padding:8px;}.score-settings{max-height:calc(100dvh - 16px);border-radius:16px 16px 8px 8px;}.body{padding:16px;gap:16px;}.fields{gap:14px 12px;}footer{padding-inline:16px;}}
</style>
