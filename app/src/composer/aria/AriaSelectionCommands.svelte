<script lang="ts">
 import {zh} from './zh';
 import {engine} from '../../bridge/engine.svelte';import {registerBack} from '../../ui/back';
 import AriaSymbol from './AriaSymbol.svelte';import type {AriaTool} from './tools';
 let {width,height,deckHeight,onaction}:{width:number;height:number;deckHeight:number;onaction:(tool:AriaTool)=>void}=$props();
 let open=$state(false),similar=$state(false),dismissed=$state('');
 const selection=$derived(engine.selection),type=$derived(selection.type||''),rect=$derived(selection.rect);
 const identity=$derived([type,selection.tick,selection.pitch,selection.count].join(':'));
 const note=$derived(type==='Note'||type==='Chord'),rest=$derived(type==='Rest'),measure=$derived(selection.range||type==='Measure');
 const text=$derived(selection.text!=null&&!['Marker','Jump','Dynamic'].includes(type));
 const removeOnly=$derived(['Dynamic','Articulation','LayoutBreak','HairpinSegment','PedalSegment','SlurSegment','OttavaSegment','VoltaSegment'].includes(type));
 let pillWidth=$state(122);
 const pillCenter=$derived(Math.max((pillWidth+42)/2+8,Math.min(width-(pillWidth+42)/2-8,(rect?.x||0)+(rect?.w||0)+49)));
 const visible=$derived(!selection.none&&!!rect&&!engine.noteInput&&!engine.playing&&identity!==dismissed&&(note||rest||measure||text||removeOnly));
 const x=$derived(Math.max(25,Math.min(width-25,text?pillCenter+(pillWidth+42)/2-17:(rect?.x||0)+(rect?.w||0)+20)));
 const y=$derived(Math.max(82,Math.min(height-deckHeight-22,(rect?.y||0)-(text||removeOnly?26:rest?28:36))));
 type Row={label:string;id:string;icon?:string;symbol?:string;shortcut?:string;destructive?:boolean;divider?:boolean};
 const rows=$derived.by(()=>{
  const copy:Row={label:'Copy',id:'copy',icon:'doc.on.doc',shortcut:'⌘C'},cut:Row={label:'Cut',id:'cut',icon:'scissors',shortcut:'⌘X'},paste:Row={label:'Paste',id:'paste',icon:'doc.on.clipboard',shortcut:'⌘V'};
  const selectSimilar:Row[]=[{label:'Select Similar',id:'similar',icon:'square.on.square',symbol:'⌄'},...(similar?[{label:'In Entire Score',id:'select-similar'},{label:'On Same Staff',id:'select-similar-staff'}]:[])];
  const remove:Row={label:'Delete',id:'action://notation/delete',icon:'trash',destructive:true,divider:true};
  if(text)return [...selectSimilar,copy,remove];
  if(measure)return [copy,cut,paste,{label:'Extend Selection...',id:'extend',icon:'arrow.right'},{label:'Add Measure',id:'insert-measure',icon:'pause',divider:true},{label:'Add Multiple Measures...',id:'sheet:addMeasures',icon:'rectangle.grid.1x2'},...(selection.measureIndex===0?[{label:'Convert to Pickup Measure',id:'sheet:pickup',icon:'forward.end'}]:[]),{label:'Transpose',id:'sheet:transposeSelection',icon:'arrow.up.arrow.down',divider:true},{label:'Key Signature',id:'sheet:key',symbol:'#♭'},{label:'Time Signature',id:'sheet:time',symbol:'4\n4'},{label:'Change Instrument',id:'sheet:instrumentPicker',icon:'music.note.list'},{label:'Tempo',id:'sheet:tempo',icon:'music.note'},{label:'Delete Measure',id:'time-delete',icon:'trash',destructive:true,divider:true},{label:'Clear Measure',id:'action://notation/delete',icon:'eraser'}];
  return [copy,cut,paste,{label:'Transpose',id:'sheet:transposeSelection',icon:'arrow.up.arrow.down'},...selectSimilar,...(note?[{label:'Respell',id:'enh-current',symbol:'#♭'},{label:'Flip Stem',id:'flip',icon:'music.note'}]:[]),{label:'Fermata',id:'fermata',symbol:'𝄐',divider:true},...(note?[{label:'Accent',id:'add-accent',symbol:'>'},{label:'Marcato',id:'add-marcato',symbol:'^'},{label:'Tenuto',id:'add-tenuto',symbol:'−'},{label:'Staccato',id:'add-staccato',symbol:'.'}]:[]),remove];
 });
 const menuWidth=$derived(measure?238:218),menuHeight=$derived(Math.min(height-deckHeight-88,rows.length*36+16+rows.filter(r=>r.divider).length*9));
 const left=$derived(Math.max(8,Math.min(width-menuWidth-8,x<width/2?x-17:x+17-menuWidth)));
 const top=$derived(y+23+menuHeight<=height-deckHeight-8?y+23:Math.max(72,y-23-menuHeight));
 $effect(()=>{identity;open=false;similar=false;});
 $effect(()=>registerBack(()=>{if(!open)return false;open=false;return true;},70));
 function choose(row:Row){if(row.id==='similar'){similar=!similar;return;}open=false;dismissed=identity;onaction({id:row.id,label:row.label});}
</script>
{#if visible}
 {#if text}<div class="text-actions" bind:clientWidth={pillWidth} style:left={pillCenter-(pillWidth+42)/2+'px'} style:top={y-17+'px'}><button onclick={()=>onaction({id:'editText'})}><AriaSymbol name="pencil" size={13}/>编辑</button><button onclick={()=>onaction({id:'action://notation/delete'})}><AriaSymbol name="trash" size={13}/>移除</button></div>{/if}
 {#if removeOnly}<button class="remove-action" style:left={Math.max(8,x-40)+'px'} style:top={y-17+'px'} onclick={()=>onaction({id:'action://notation/delete'})}><AriaSymbol name="trash" size={13}/>移除</button>{:else}
 <button class="selection-options" aria-label={zh(measure?'Measure options':'Selection options')} style:left={x-17+'px'} style:top={y-17+'px'} onclick={()=>{open=!open;similar=false;}}><AriaSymbol name="ellipsis" size={13}/></button>
 {#if open}<button class="selection-menu-shade" aria-label="关闭选区菜单" onclick={()=>open=false}></button><div role="menu" aria-label="选区操作" class="selection-command-menu" style:left={left+'px'} style:top={top+'px'} style:width={menuWidth+'px'} style:max-height={menuHeight+'px'}>{#each rows as row}{#if row.divider}<div class="divider"></div>{/if}<button role="menuitem" class:destructive={row.destructive} onclick={()=>choose(row)}><span class="row-icon">{#if row.icon}<AriaSymbol name={row.icon} size={15}/>{:else}{row.symbol}{/if}</span><span>{zh(row.label)}</span>{#if row.shortcut}<small>{row.shortcut}</small>{/if}</button>{/each}</div>{/if}
 {/if}
{/if}
<style>
 .text-actions,.remove-action{position:absolute;display:flex;align-items:center;gap:6px;min-height:32px;padding:7px 10px;border:0;border-radius:20px;background:#1f5ce0;color:white;box-shadow:0 3px 8px #00000029;z-index:24;pointer-events:auto;}.text-actions>button{display:flex;align-items:center;gap:4px;min-height:18px;padding:0;border:0;background:none;color:white;font-size:12px;font-weight:600;}.remove-action{font-size:12px;}.selection-options{position:absolute;width:34px;height:34px;min-height:0;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:#1f5ce0;color:white;box-shadow:0 3px 8px #00000029;z-index:24;pointer-events:auto;}.selection-menu-shade{position:fixed;inset:0;background:transparent;border:0;border-radius:0;z-index:25;pointer-events:auto;}.selection-command-menu{position:absolute;padding:8px 0;border-radius:8px;background:#ffffffed;backdrop-filter:blur(20px);box-shadow:0 10px 20px #0003;outline:.5px solid #00000014;z-index:26;overflow:auto;pointer-events:auto;animation:command-in .12s ease-out;}.selection-command-menu>button{display:flex;align-items:center;gap:12px;width:100%;height:36px;min-height:36px;padding:0 14px;background:none;border:0;border-radius:0;font:600 13px system-ui,sans-serif;color:#000d;text-align:left;white-space:nowrap;}.selection-command-menu>button:active{background:#0001;}.row-icon{width:18px;height:18px;display:grid;place-items:center;font-size:15px;font-weight:700;white-space:pre;flex:none;}.selection-command-menu small{margin-left:auto;font-size:12px;font-weight:500;color:#0006;}.selection-command-menu>button.destructive{color:#f33;}.divider{height:1px;background:#00000014;margin:4px 0;}@keyframes command-in{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:scale(1);}}
</style>
