<script lang="ts">
  import {untrack} from 'svelte';
  import {engine,type ScorePanels,type MixerChannel} from '../bridge/engine.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import {registerBack} from '../ui/back';
  import {activity} from '../ui/activity.svelte';
  let {kind,onclose,onsettings,structure=true}:{kind:'mixer'|'parts';onclose:()=>void;onsettings:(kind:'page'|'style')=>void;structure?:boolean}=$props();
  let data=$state<ScorePanels>({parts:[],channels:[]}),error=$state('');
  const title=$derived(kind==='mixer'?'混音器':'声部');
  function refresh(){try{data=engine.scorePanels();}catch(e){error=String(e);}}
  $effect(()=>{kind;if(kind==='parts')engine.changeSeq;untrack(refresh);});
  $effect(()=>registerBack(()=>{onclose();return true;},50));
  let pending=new Map<number,Record<string,unknown>>(),frame=0;
  function flush(){frame=0;for(const patch of pending.values())if(!engine.changeMixer(patch).ok)error='混音设置未能应用，请重试';pending.clear();}
  function mix(channel:MixerChannel,key:'volume'|'pan'|'muted'|'solo',value:number|boolean){
    (channel as any)[key]=value;pending.set(channel.id,{...pending.get(channel.id),id:channel.id,[key]:value});if(!frame)frame=requestAnimationFrame(flush);
  }
  async function part(data:Record<string,unknown>){error='';await activity.run('正在更新声部…',()=>{if(['part-visible','staff-visible'].includes(String(data.op)))engine.pause();if(!engine.changeParts(data).ok)error='声部操作未能完成';refresh();});}
  $effect(()=>()=>{if(frame){cancelAnimationFrame(frame);flush();}});
</script>
<aside class="score-panel" class:mixer={kind==='mixer'} role="region" aria-label={title}>
  <header><h2>{title}</h2><IconButton label="收起{title}" icon="close" onclick={onclose}/></header>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if kind==='mixer'}
    <div class="channels">
      {#each [...data.channels].sort((a,b)=>a.id===-1?1:b.id===-1?-1:a.id-b.id) as channel (channel.id)}
        <section class="channel" aria-label={channel.name+'通道'}>
          <h3>{channel.name}</h3><small title={channel.sound}>{channel.sound||'MS Basic'}</small>
          <label>音量 <output>{channel.volume.toFixed(1)} dB</output><input aria-label={channel.name+'音量'} type="range" min="-60" max="12" step="0.5" value={channel.volume} oninput={e=>mix(channel,'volume',Number(e.currentTarget.value))}/></label>
          <label>声像 <output>{channel.pan===0?'居中':(channel.pan<0?'左 ':'右 ')+Math.round(Math.abs(channel.pan)*100)+'%'}</output><input aria-label={channel.name+'声像'} type="range" min="-1" max="1" step="0.05" value={channel.pan} oninput={e=>mix(channel,'pan',Number(e.currentTarget.value))}/></label>
          <div class="buttons"><button aria-label={channel.name+'静音'} aria-pressed={channel.muted} onclick={()=>mix(channel,'muted',!channel.muted)}>静音</button>{#if channel.id!==-1&&channel.name!=='节拍器'}<button aria-label={channel.name+'独奏'} aria-pressed={channel.solo} onclick={()=>mix(channel,'solo',!channel.solo)}>独奏</button>{/if}</div>
        </section>
      {/each}
    </div><p class="hint">音量、声像、静音和独奏会应用到实际播放，并自动保存到本地乐谱。</p>
  {:else}
    <div class="parts">
      <div class="settings-actions"><button onclick={()=>onsettings('page')}>页面设置</button><button onclick={()=>onsettings('style')}>谱面样式</button></div>
      {#each data.parts as p,index (p.id)}
        <section class="part">
          <div class="row"><input aria-label={'显示乐器 '+p.name} type="checkbox" checked={p.visible} onchange={e=>part({op:'part-visible',id:p.id,visible:e.currentTarget.checked})}/><h3 title={p.name}>{p.name}</h3><IconButton label={'乐器 '+p.name+' 发声'} icon={p.audible?'speaker':'speaker-off'} aria-pressed={p.audible} onclick={()=>part({op:'part-audible',id:p.id,audible:!p.audible})}/>{#if structure}<IconButton label={'上移乐器 '+p.name} icon="up" disabled={index===0} onclick={()=>part({op:'move-part',id:p.id,target:data.parts[index-1].id})}/><IconButton label={'下移乐器 '+p.name} icon="down" disabled={index===data.parts.length-1} onclick={()=>part({op:'move-part',id:p.id,target:data.parts[index+1].id,after:true})}/>{/if}</div>
          {#each p.staves as staff,i (staff.id)}
            <div class="staff row"><input aria-label={'显示'+p.name+'谱表'+(i+1)} type="checkbox" checked={staff.visible} onchange={e=>part({op:'staff-visible',id:staff.id,visible:e.currentTarget.checked})}/><span>谱表 {i+1} · {staff.lines} 线</span><IconButton label={p.name+' 谱表 '+(i+1)+' 发声'} icon={staff.audible?'speaker':'speaker-off'} aria-pressed={staff.audible} onclick={()=>part({op:'staff-audible',id:staff.id,audible:!staff.audible})}/>{#if structure}<IconButton label={'上移谱表'+(i+1)} icon="up" disabled={i===0} onclick={()=>part({op:'move-staff',id:staff.id,target:p.staves[i-1].id})}/><IconButton label={'下移谱表'+(i+1)} icon="down" disabled={i===p.staves.length-1} onclick={()=>part({op:'move-staff',id:staff.id,target:p.staves[i+1].id,after:true})}/>{/if}</div>
          {/each}
          <!-- Structure changes belong to composition mode. -->
          {#if structure}<button class="add" onclick={()=>part({op:'add-staff',id:p.id})}>＋ 添加空白谱表</button>{/if}
        </section>
      {/each}
      <p class="hint">显示与发声分别控制；乐器静音时，其下所有谱表均不发声。设置会自动保存。谱表开关、排序和添加可撤销。</p>
    </div>
  {/if}
</aside>
<style>
  .score-panel{position:absolute;right:8px;top:8px;z-index:6;width:min(380px,calc(100% - 16px));max-height:calc(100% - 16px);display:flex;flex-direction:column;pointer-events:auto;background:var(--aria-material);color:var(--aria-ink);border:0;outline:.7px solid var(--aria-line);outline-offset:-.7px;border-radius:18px;box-shadow:var(--island-shadow);overflow:hidden;}
  .score-panel.mixer{width:min(680px,calc(100% - 16px));}header{display:flex;align-items:center;justify-content:space-between;padding:4px 8px 4px 16px;border-bottom:1px solid var(--hairline);flex:none;}h2{font-size:18px;font-weight:500;}h3{font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .channels{display:flex;gap:12px;overflow:auto;padding:16px;min-height:0;}.channel{flex:0 0 166px;display:flex;flex-direction:column;gap:12px;padding:14px;border:1px solid var(--hairline);border-radius:10px;background:var(--sheet);}small{font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-soft);}label{font-size:13px;display:flex;flex-direction:column;gap:4px;}output{color:var(--ink-soft);font-size:12px;}
  input[type=range]{width:100%;min-height:44px;accent-color:var(--rubric);touch-action:pan-x;}input[type=checkbox]{width:22px;height:22px;accent-color:var(--rubric);flex:none;}
  button{min-height:44px;padding:0 10px;border:0;border-radius:var(--chip-radius);background:var(--veil);font:500 13px/1.2 var(--font-ui);}button[aria-pressed=true]{background:var(--rubric-wash);color:var(--rubric);box-shadow:var(--chip-ring);}.buttons{display:flex;gap:8px;}.buttons button{flex:1;}.hint{padding:8px 16px 14px;color:var(--ink-soft);font-size:12px;line-height:1.7;}.error{padding:12px;color:var(--rubric);}.parts{overflow-y:auto;padding:12px;min-height:0;}.settings-actions{display:flex;gap:8px;margin-bottom:12px;}.settings-actions button{flex:1;}.part{border-top:1px solid var(--hairline);padding:8px 0;}.row{display:flex;align-items:center;gap:8px;min-height:48px;}.row h3,.row span{flex:1;min-width:0;}.row :global(.ib){padding:0;border:0;}.staff{padding-left:12px;font-size:13px;}.add{width:100%;margin-top:8px;}
  @media(max-width:600px){.score-panel{top:auto;bottom:6px;max-height:75%;}.channels{padding:12px;gap:8px;}.channel{flex-basis:156px;}}
  .row :global(button[aria-pressed=false]){color:var(--ink-mute);}.row span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
</style>
