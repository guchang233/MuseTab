<script lang="ts">
 import {zh} from './zh';import {practice} from './practice.svelte';
 import {untrack} from 'svelte';import './aria.css';
 import {engine} from '../../bridge/engine.svelte';import {library} from '../../library/store.svelte';import {workspace} from '../../library/workspace.svelte';import {editorInset} from '../../editor/layout.svelte';import {closeComposer} from '../../workspace/modes';import {registerBack} from '../../ui/back';import {saveAs} from '../../native';
 import AriaSelectionCommands from './AriaSelectionCommands.svelte';import AriaChrome from './AriaChrome.svelte';import AriaDeck from './AriaDeck.svelte';import AriaFloatingPalette from './AriaFloatingPalette.svelte';import AriaTextPanels from './AriaTextPanels.svelte';import AriaPopover from './AriaPopover.svelte';import AriaSymbol from './AriaSymbol.svelte';
 import {AriaEditorController} from './controller.svelte';import type {AriaTool} from './tools';import type {AriaCategory} from './reference';
 import {textTools} from './tools';import AriaPanels from './AriaPanels.svelte';
 const controller=new AriaEditorController();
 let width=$state(innerWidth),height=$state(innerHeight),deckHeight=$state(292),dockLeft=$state(localStorage.getItem('ScoreReaderFloatingPaletteDockedLeft')!=='false');
 let playBusy=$state(false);let extending=$state(false);let sheet=$state(''),menu=$state<{items:AriaTool[];left:number;top:number}|null>(null),showText=$state(''),replaceText=$state(false),textDraft=$state(''),duration=$state(0),parts=$state(1);
 let root:HTMLDivElement,resizeTimer:ReturnType<typeof setTimeout>,lastWidth=0;
 const title=$derived(engine.project.title||library.current?.displayName||library.current?.name||'乐谱');
 const phone=$derived(Math.min(width,height)<600),landscape=$derived(width>height),hasSelection=$derived(!engine.selection.none);
 const floating=$derived(!phone&&['notes','repeats','text','expression'].includes(controller.category));
 const docId=$derived(library.current?.id);
 const selectedPitch=$derived(engine.selection.pitch??(engine.selection.chordPitches?.length?Math.max(...engine.selection.chordPitches):undefined)),voice=$derived(engine.noteInput?controller.intent.voice:engine.selection.voice||1);
 const selectionID=$derived([engine.selection.type,engine.selection.tick,engine.selection.pitch,engine.selection.voice].join(':'));
 $effect(()=>controller.attach());
 $effect(()=>{const id=docId;if(!id||engine.status!=='ready')return;untrack(()=>{const value=Number(localStorage.getItem('Aria.PracticeSpeed.'+id)||1);engine.setTempoMultiplier(Math.min(1.5,Math.max(.25,Number.isFinite(value)?value:1)));});});
 $effect(()=>{if(engine.status!=='ready')return;untrack(()=>{engine.setEditLocked(false);engine.readerLayout(0);engine.composerState({enabled:true,locked:false,panel:'',keyboard:false});});return()=>untrack(()=>{practice.cancel();if(engine.noteInput)engine.dispatch('note-input');engine.composerState({enabled:false,locked:true});engine.setEditLocked(true);});});
 $effect(()=>{engine.changeSeq;if(!docId||engine.status!=='ready')return;untrack(()=>{parts=Math.max(engine.scorePanels().parts.length,(engine.composerState({editorInfo:true})?.editorInfo?.parts?.length||1)-1);duration=engine.playbackInfo().duration;});});
 $effect(()=>editorInset.set({top:62,bottom:deckHeight,left:0,right:0}));
 $effect(()=>registerBack(()=>{if(menu){menu=null;return true;}if(showText){showText='';return true;}if(sheet){sheet='';return true;}if(['chord','lyrics','fingering'].includes(controller.category)){void controller.choose('text');return true;}void done();return true;},60));
 function resizeView(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const view=engine.viewRect();if(!view||view.w<100)return;if(lastWidth&&Math.abs(lastWidth-view.w)>2)engine.gestureView(view.w/lastWidth,0,0,view.x,view.y);lastWidth=view.w;},100);}
 $effect(()=>{engine.composerViewportSeq;resizeView();});
 $effect(()=>{const frame=engine.frame;if(!frame)return;const observer=new ResizeObserver(resizeView);observer.observe(frame);return()=>{observer.disconnect();clearTimeout(resizeTimer);};});
 async function play(){if(playBusy&&!practice.counting)return;if(practice.counting){practice.cancel();return;}playBusy=true;await controller.session.flush();if(engine.action('countin').checked)engine.dispatch('countin');try{if(await practice.beforePlay(engine.playbackInfo(),engine.tempoMultiplier))await engine.togglePlay();}catch(e){controller.error=(e as Error).message;}finally{playBusy=false;}}
 function pause(){practice.cancel();engine.pause();}
 function stop(){practice.cancel();engine.stop();}
 async function done(){practice.cancel();await controller.session.flush();await closeComposer();}
 function tool(tool:AriaTool,event?:MouseEvent){
  if(tool.menu){const r=(event?.currentTarget as HTMLElement)?.getBoundingClientRect();menu={items:tool.menu,left:Math.max(8,Math.min(width-260,r?.left||width/2)),top:Math.max(8,Math.min(height-220,r?.top||height/2))};return;}
  menu=null;
  if(tool.id==='extend'){extending=true;return;}
  if(tool.id.startsWith('sheet:')){sheet=tool.id.slice(6);return;}
  if(tool.id==='editText'){if(engine.selection.type==='Harmony'){choose('chord');return;}if(engine.selection.type==='Lyrics'){choose('lyrics');return;}if(engine.selection.type==='TempoText'){sheet='tempo';return;}showText='staff-text';replaceText=true;textDraft=engine.selection.text||'';return;}
  if(tool.id.startsWith('text:')){const code=tool.id.slice(5);void controller.text(code,code==='staff-text'?'谱表文本':code==='system-text'?'谱系文本':'');return;}
  void controller.tool(tool);
 }
 function choose(category:AriaCategory){void controller.choose(category);}
 async function finger(n:number){await controller.edit({op:'fingering',finger:n});}
 function more(){controllerMore=!controllerMore;localStorage.setItem('Aria.NoteEntry.MoreNotesExpanded',String(controllerMore));}
 let controllerMore=$state(localStorage.getItem('Aria.NoteEntry.MoreNotesExpanded')==='true');
 async function textCommit(value:string,advance:boolean,mode?:string,previous=false){const lyrics=controller.category==='lyrics';return await controller.text(lyrics?'lyrics':'chord-text',value,lyrics?engine.selection.type==='Lyrics':engine.selection.type==='Harmony',advance,mode,previous);}
</script>
<svelte:window bind:innerWidth={width} bind:innerHeight={height}/>
<div class="aria-editor editor" data-aria-editor="true" bind:this={root}>
 <AriaChrome busy={playBusy} counting={practice.counting} countInBars={practice.bars} practiceSpeed={engine.tempoMultiplier} metronome={engine.action('metronome').checked} {title} {phone} {width} {landscape} playing={engine.playing||practice.counting} position={engine.position.secs} {duration} {parts} mixer={sheet==='mixer'} onclose={done} ondone={done} onplay={play} onpause={pause} onstop={stop} onpractice={()=>sheet='practice'} onmixer={()=>sheet=sheet==='mixer'?'':'mixer'} onparts={()=>sheet='parts'} onexport={()=>sheet='export'}/>
 {#if floating}<AriaFloatingPalette category={controller.category} {landscape} left={dockLeft} maxHeight={height-(controller.category==='notes'&&landscape?108:148)-deckHeight-16} enabled={(hasSelection||engine.noteInput)&&!controller.busy} selected={id=>controller.selected(id)} onaction={tool} ondock={()=>{dockLeft=!dockLeft;localStorage.setItem('ScoreReaderFloatingPaletteDockedLeft',String(dockLeft));}}/>{/if}
 {#if extending}<button class="aria-extend-target" aria-label="选择末尾小节" onclick={async e=>{const r=engine.frame?.getBoundingClientRect();if(r&&await controller.edit({op:'extendEnd',x:e.clientX-r.left,y:e.clientY-r.top}))extending=false;}}></button><div class="aria-extend-banner">扩展选区：点击最后一个小节<button onclick={()=>extending=false}>取消</button></div>{/if}
 <AriaSelectionCommands {width} {height} {deckHeight} onaction={tool}/>
 <div class="aria-editor-deck" bind:clientHeight={deckHeight}>
  <AriaDeck category={controller.category} {phone} {landscape} {width} busy={controller.busy} {hasSelection} pitch={selectedPitch} chordPitches={engine.selection.chordPitches||[]} flats={controller.flats} noteInput={engine.noteInput} {voice} more={controllerMore} canUndo={engine.action('action://notation/undo').enabled} canRedo={engine.action('action://notation/redo').enabled} selected={id=>controller.selected(id)} oncategory={choose} onaction={tool} onpitch={p=>controller.pitch(p)} onmore={more}>
   {#snippet subpanel()}{#if ['chord','lyrics','fingering'].includes(controller.category)}<AriaTextPanels kind={controller.category as 'chord'|'lyrics'|'fingering'} {phone} {landscape} enabled={hasSelection} {selectionID} initialText={engine.selection.text||''} measureIndex={engine.selection.measureIndex} onback={()=>choose('text')} oncommit={textCommit} onfinger={finger} onprevious={()=>controller.action('select-prev-chord')} onnext={()=>controller.action('select-next-chord')}/>{/if}{/snippet}
  </AriaDeck>
 </div>
 {#if menu}<button class="aria-menu-shade" aria-label="关闭菜单" onclick={()=>menu=null}></button><div class="aria-menu" role="menu" style:left={menu.left+'px'} style:top={menu.top+'px'}>{#each menu.items as item}<button role="menuitem" onclick={e=>tool(item,e)}>{item.symbol&&item.symbol+' '}{zh(item.label||item.id)}</button>{/each}</div>{/if}
 {#if sheet}<AriaPanels kind={sheet} {phone} {title} {deckHeight} onclose={()=>sheet=''} onerror={message=>controller.error=zh(message)} onedit={values=>controller.edit(values)} onaction={tool}/>{/if}
 {#if showText}<AriaPopover title="文本" height={210} onclose={()=>showText=''}><div class="aria-form-header"><button onclick={()=>showText=''}>取消</button><strong>文本</strong><button onclick={async()=>{if(await controller.text(showText,textDraft,replaceText))showText='';}}>完成</button></div><div class="aria-form-body"><textarea aria-label="文本" rows="1" bind:value={textDraft}></textarea></div></AriaPopover>{/if}
 {#if controller.error}<AriaPopover title="无法编辑" onclose={()=>controller.error=''} width={360}><div class="aria-error-message"><strong>无法编辑</strong><p>{controller.error}</p><button onclick={()=>controller.error=''}>确定</button></div></AriaPopover>{/if}
 {#if practice.counting}<div class="aria-count-in" role="status">预备拍 {practice.beat}／{practice.total}</div>{/if}
 {#if controller.busy}<div class="aria-edit-busy" role="status"><span></span>{zh(controller.queue.label||'Editing…')}</div>{/if}
</div>
