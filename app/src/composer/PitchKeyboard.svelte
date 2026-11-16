<script lang="ts">
  let {onpitch}:{onpitch:(step:number,octave:number,accidental:number)=>void}=$props();
  let octave=$state(4);
  const names=['C','D','E','F','G','A','B'];
</script>
<div class="pitch-keyboard">
  <div class="octaves"><button aria-label="键盘低八度" disabled={octave<=0} onclick={()=>octave--}>−8</button><span>C{octave}–B{octave+1}</span><button aria-label="键盘高八度" disabled={octave>=7} onclick={()=>octave++}>＋8</button></div>
  <div class="keys" aria-label="输入钢琴键盘">
    {#each Array.from({length:14},(_,i)=>i) as index}
      {@const step=index%7}{@const oct=octave+Math.floor(index/7)}
      <div class="key-pair"><button class="white" aria-label={'输入 '+names[step]+oct} onpointerdown={e=>{e.preventDefault();onpitch(step,oct,0);}} onclick={e=>{if(e.detail===0)onpitch(step,oct,0);}}>{names[step]}{step===0?oct:''}</button>{#if ![2,6].includes(step)}<button class="black" aria-label={'输入 '+names[step]+'♯'+oct} onpointerdown={e=>{e.preventDefault();onpitch(step,oct,1);}} onclick={e=>{if(e.detail===0)onpitch(step,oct,1);}}><span>{names[step]}♯</span></button>{/if}</div>
    {/each}
  </div>
</div>
<style>
  .pitch-keyboard{min-width:0;display:flex;gap:8px;align-items:stretch;}.octaves{display:flex;flex-direction:column;justify-content:space-between;align-items:center;gap:4px;font-size:11px;color:var(--c-muted);}.octaves button{min-height:36px;min-width:44px;border:1px solid var(--c-line);border-radius:3px;}.keys{display:flex;min-width:0;flex:1;overflow-x:auto;padding-right:12px;touch-action:pan-x;}.key-pair{flex:1;min-width:32px;position:relative;height:112px;}.white{position:absolute;inset:0;display:flex;align-items:end;justify-content:center;padding-bottom:6px;border:1px solid #aaa;background:#fafafa;color:#444;border-radius:0 0 3px 3px;user-select:none;touch-action:manipulation;}.black{position:absolute;z-index:1;left:67%;width:66%;height:65%;top:0;background:#262626;color:#ddd;border:1px solid #111;border-radius:0 0 3px 3px;display:flex;align-items:end;justify-content:center;padding-bottom:6px;font-size:10px;user-select:none;touch-action:manipulation;}.white:active{background:#aacbfc;}.black:active{background:#477abc;}
  @media(max-height:550px){.key-pair{height:76px;}.octaves button{min-height:30px;}}
</style>
