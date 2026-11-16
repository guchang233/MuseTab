<script lang="ts">
  import './musescore.css';
  import './touch-workspace.css';
  import {engine} from '../bridge/engine.svelte';
  import {library} from '../library/store.svelte';
  import {workspace} from '../library/workspace.svelte';
  import {editorInset} from '../editor/layout.svelte';
  import {activity} from '../ui/activity.svelte';
  import {registerBack} from '../ui/back';
  import {saveAs} from '../native';
  import {closeComposer} from '../workspace/modes';
  import IconButton from '../ui/IconButton.svelte';
  import NewScore from './NewScore.svelte';
  import ComposerMenu from './ComposerMenu.svelte';
  import {theme} from '../ui/theme.svelte';
  import {ComposerSession,registerComposerBarrier,registerComposerAction,type QueueState,type NoteIntent} from './session';
  import TouchInput from './TouchInput.svelte';
  import PitchKeyboard from './PitchKeyboard.svelte';
  import Symbols from './Symbols.svelte';
  import {categories,tools,paletteGroups,type ToolCategory} from './tools';
  let top=$state(110),creating=$state(false),unlock=$state(false),notice=$state('');
  let seenUnlock=engine.unlockRequestSeq,seenDialog=engine.dialogRequest.seq;
  let noticeTimer:ReturnType<typeof setTimeout>;
  let viewportTimer:ReturnType<typeof setTimeout>,previousViewWidth=0;
  function adaptViewport(){clearTimeout(viewportTimer);viewportTimer=setTimeout(()=>{
    const view=engine.viewRect();if(!view||view.w<100||view.h<80)return;
    if(previousViewWidth&&Math.abs(previousViewWidth-view.w)>2)engine.gestureView(view.w/previousViewWidth,0,0,view.x,view.y);
    previousViewWidth=view.w;
    const selection=engine.selection.rect;if(!selection||engine.selection.none)return;
    const x=selection.x+selection.w/2,y=selection.y+selection.h/2;
    const dx=x<view.x+16?view.x+16-x:x>view.x+view.w-16?view.x+view.w-16-x:0;
    const dy=y<view.y+20?view.y+20-y:y>view.y+view.h-20?view.y+view.h-20-y:0;
    if(dx||dy)engine.gestureView(1,dx,dy,0,0);
  },100);}
  let queue=$state<QueueState>({pending:0,label:'',error:''});
  let bottom=$state(64),category=$state<ToolCategory>('select'),collapsed=$state(false),keyboard=$state(true);
  let menuOpen=$state(false);
  let symbols=$state<string[]|null>(null),textCode=$state(''),textValue=$state(''),textReplace=$state(false),textError=$state('');
  let allActions=$state<{code:string;title:string;enabled:boolean;checked:boolean}[]|null>(null),actionSearch=$state('');
  let intent=$state<NoteIntent>({duration:'pad-note-4',voice:1,dotted:false,chord:false});
  const documentId=$derived(library.current?.id);
  $effect(()=>{if(!documentId)return;intent={duration:'pad-note-4',voice:1,dotted:false,chord:false};category='select';collapsed=false;symbols=null;textCode='';engine.setEditLocked(true);});
  const session=new ComposerSession({
    documentId:()=>library.current?.id,
    ready:()=>engine.status==='ready'&&engine.project.open,
    locked:()=>engine.editLocked,
    requestUnlock:()=>{unlock=true;},
    action:code=>engine.currentAction(code),
    dispatch:code=>{engine.focus();engine.dispatch(code);},
    palette:(palette,cell)=>engine.applyPaletteCell(palette,cell),
    pitch:command=>{
      if(!engine.currentAction('note-input').checked)engine.dispatch('note-input-by-note-name');
      if(!engine.currentAction('note-input').checked)throw Error('请先点选音符或休止符作为输入位置');
      for(const code of ['voice-'+command.intent.voice,command.intent.duration])if(!engine.currentAction(code).checked)engine.dispatch(code);
      if(engine.currentAction('pad-dot').checked!==command.intent.dotted)engine.dispatch('pad-dot');
      if(!engine.addPitch(command.step,command.octave,command.accidental,command.intent.chord))throw Error('音符未能写入，请重新选择输入位置');
    },
    text:command=>{
      if(engine.noteInput)engine.dispatch('note-input');
      const reply=engine.composerState({textCommand:{code:command.code,text:command.text,replace:command.replace}});
      if(!reply?.textOk)throw Error(reply?.textError||'文本未能写入');
    },
    save:()=>workspace.persist(true),
    snapshot:()=>({revision:engine.changeSeq,noteInput:engine.noteInput,selected:!engine.selection.none}),
  },state=>{queue=state;});
  $effect(()=>{const unregister=registerComposerBarrier(()=>session.flush());return()=>{unregister();session.dispose();};});
  $effect(()=>registerComposerAction(act));
  const title=$derived(library.current?.displayName||engine.project.title||library.current?.name||'未命名乐谱');
  $effect(()=>editorInset.set({top,bottom,left:0,right:0}));
  $effect(()=>{
    if(engine.status!=='ready')return;
    engine.readerLayout(0);
    engine.composerState({enabled:true,locked:true,panel:'',keyboard:false});
    return()=>{engine.composerState({enabled:false,locked:true});engine.setEditLocked(true);};
  });
  $effect(()=>{if(engine.status==='ready')engine.composerState({dark:theme.resolved==='dark'});});
  $effect(()=>{if(engine.unlockRequestSeq!==seenUnlock){seenUnlock=engine.unlockRequestSeq;unlock=true;}});
  $effect(()=>{const request=engine.dialogRequest;if(request.seq===seenDialog)return;seenDialog=request.seq;if(request.kind==='toggle-mixer')engine.composerState({panel:'mixer'});else if(request.kind==='toggle-instruments')engine.composerState({panel:'parts'});else say('原生设置窗口尚未就绪，请重新进入编谱');});
  $effect(()=>registerBack(()=>{if(unlock){unlock=false;return true;}if(textCode){textCode='';return true;}if(allActions){allActions=null;return true;}if(symbols){symbols=null;return true;}const state=engine.composerState();if(state?.modalOpen){engine.composerState({closePopup:true});return true;}if(state?.panel){engine.composerState({panel:''});return true;}if(!collapsed){collapsed=true;return true;}return false;},50));
  $effect(()=>()=>clearTimeout(noticeTimer));
  $effect(()=>{engine.composerViewportSeq;adaptViewport();});
  $effect(()=>{const target=engine.frame;if(!target)return;const observer=new ResizeObserver(adaptViewport);observer.observe(target);return()=>{observer.disconnect();clearTimeout(viewportTimer);};});
  function say(message:string){notice=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice='',3500);}
  const aliases:Record<string,string>={'select-next-element':'select-next-chord','select-prev-element':'select-prev-chord','roman-numeral-analysis':'roman-numeral-text',slur:'add-slur',hairpin:'add-hairpin','hairpin-decrescendo':'add-hairpin-reverse',rehearsalmark:'rehearsalmark-text',break:'system-break'};
  const textActions=new Set(['lyrics','chord-text','roman-numeral-text','nashville-number-text','staff-text','system-text','expression-text','rehearsalmark-text','fingering-text','tempo','figured-bass']);
  function act(original:string){
    const code=aliases[original]||original;
    if(textActions.has(code)){textCode=code;textValue='';textReplace=false;textError='';return;}
    const mutates=!/^(action:\/\/notation\/copy|notation-select-all|select-(next|prev)-chord|zoomin|zoomout|zoom-page-width)$/.test(code);
    void session.submit({kind:'action',code,label:'正在处理编辑…',mutates}).catch(e=>say(e.message));
  }
  function command(code:string){
    if(code==='new')void session.flush().then(()=>creating=true);
    else if(code==='save')void save();
    else if(code==='close')void closeComposer();
    else if(code==='panel:symbols')symbols=[];
    else if(code.startsWith('panel:'))void activity.run('正在打开面板…',async()=>{await session.flush();engine.composerState({panel:code.slice(6)==='tools'?'selection':code.slice(6)});}).catch(e=>say(e.message));
    else if(code==='keyboard'){keyboard=!keyboard;category='notes';collapsed=false;}
    else if(code.startsWith('settings:'))openSettings(code.slice(9) as 'page'|'style'|'transpose');
    else if(code.startsWith('action:'))act(code.slice(7));
    else if(code.startsWith('export:')){const ext=code.slice(7);void download(ext,ext==='mid'?'audio/midi':ext==='musicxml'?'application/vnd.recordare.musicxml+xml':'application/octet-stream');}
    else if(code==='help')say('先解锁并点选休止符，在“音符”工具中选择时值，再点钢琴键输入。各分类提供常用操作与完整符号库；“属性”打开选中元素的完整设置。');
  }
  function openSettings(kind:'page'|'style'|'transpose'){if(engine.noteInput)act('note-input');engine.pause();act(kind==='page'?'page-settings':kind==='style'?'edit-style':'transpose');}
  async function save(){try{await session.submit({kind:'save',label:'正在保存乐谱…'});say('已保存到本地乐谱');}catch(e){say((e as Error).message||'保存未能完成');}}
  async function download(ext:string,mime:string){try{await activity.run('正在导出乐谱…',async()=>{await session.flush();const bytes=await engine.exportTo(ext);await saveAs((library.current?.name||title)+'.'+ext,bytes,mime);});}catch(e){say((e as Error).message||'导出未能完成');}}
  function pitch(step:number,octave:number,accidental:number){void session.submit({kind:'pitch',label:'正在输入音符…',step,octave,accidental,intent}).catch(e=>say(e.message));}
  function applySymbol(palette:number,cell:number,label:string){void session.submit({kind:'palette',palette,cell,label:'添加 '+label}).then(()=>{symbols=null;}).catch(e=>say(e.message));}
  async function writeText(){textError='';try{await session.submit({kind:'text',label:'正在写入文本…',code:textCode,text:textValue,replace:textReplace});textCode='';}catch(e){textError=(e as Error).message;}}
  function writeFinger(finger:number){void session.submit({kind:'text',label:'正在添加指法…',code:'fingering-text',text:String(finger),replace:false}).catch(e=>say(e.message));}
  function showActions(){void activity.run('正在加载编谱命令…',async()=>{await session.flush();allActions=engine.composerState({actions:true})?.actions||[];actionSearch='';}).catch(e=>say(e.message));}
  function chooseCategory(key:ToolCategory){if(key!=='notes'&&engine.noteInput)act('note-input');category=key;collapsed=false;}
  function available(code:string){return engine.action(aliases[code]||code).known;}
</script>
<div class="editor composer muse-workbench" class:muse-dark={theme.resolved==='dark'}>
  <header class="composer-header" class:show-menu={menuOpen} bind:clientHeight={top}>
    <IconButton flat label="退出编谱" icon="back" onclick={closeComposer}/>
    <div class="composer-title"><h1>{title}</h1><p>{engine.editLocked?'已锁定 · 可选择和播放':'已解锁 · 可修改音符'}{engine.dirty?' · 尚有更改':''}</p></div>
    <div class="main-actions">
      <IconButton flat label="撤销" icon="undo" disabled={!engine.action('action://notation/undo').enabled} onclick={()=>act('action://notation/undo')}/>
      <IconButton flat label="重做" icon="redo" disabled={!engine.action('action://notation/redo').enabled} onclick={()=>act('action://notation/redo')}/>
      <IconButton flat label={engine.playing?'暂停':'播放'} icon={engine.playing?'pause':'play'} onclick={()=>engine.togglePlay()}/>
      <IconButton flat label={engine.editLocked?'解锁编辑':'锁定编辑'} icon={engine.editLocked?'lock':'unlock'} active={engine.editLocked} onclick={()=>engine.setEditLocked(!engine.editLocked)}/>
      <IconButton flat label="保存" icon="save" onclick={save}/>
      <IconButton flat label="编谱菜单" icon="more" active={menuOpen} onclick={()=>menuOpen=!menuOpen}/>
    </div>
    <ComposerMenu oncommand={command}/>
  </header>
  <footer class="composer-deck" bind:clientHeight={bottom}>
    <div class="category-row"><nav aria-label="编谱工具分类">{#each categories as [key,label]}<button class:active={category===key} aria-pressed={category===key} onclick={()=>chooseCategory(key)}>{label}</button>{/each}</nav><button class="collapse-tools" aria-label={collapsed?'展开编谱工具':'收起编谱工具'} onclick={()=>collapsed=!collapsed}>{collapsed?'展开':'收起'}</button></div>
    {#if !collapsed}
      <div class="context-tools" aria-label="当前工具">
        {#if ['fingering','lyrics','chord','text'].includes(category)}<button onclick={()=>act('select-prev-chord')}>上一音</button><button onclick={()=>act('select-next-chord')}>下一音</button>{/if}
        {#each tools[category].filter(item=>available(item[0])) as [code,label]}<button onclick={()=>act(code)}>{label}</button>{/each}
        {#if category==='select'}<button disabled={typeof engine.selection.text!=='string'} onclick={()=>{textCode='edit';textReplace=true;textValue=engine.selection.text||'';textError='';}}>修改选中文字</button><button onclick={()=>command('panel:selection')}>完整属性</button>{/if}
        <button onclick={()=>symbols=paletteGroups[category]||[]}>符号库</button>
        {#if category==='layout'||category==='more'}<button onclick={()=>command('panel:parts')}>乐器与谱表</button><button onclick={()=>openSettings('page')}>页面设置</button><button onclick={()=>openSettings('style')}>谱面样式</button>{/if}
        {#if category==='more'}<button onclick={()=>command('panel:mixer')}>混音器</button><button onclick={showActions}>全部编谱命令</button><button onclick={()=>openSettings('transpose')}>移调</button>{/if}
        {#if category==='fingering'}{#each [0,1,2,3,4,5] as finger}<button onclick={()=>writeFinger(finger)}>指法 {finger}</button>{/each}{/if}
      </div>
      {#if category==='notes'}<TouchInput {intent} onintent={value=>intent=value} onaction={act}/><div class="keyboard-switch"><button aria-pressed={keyboard} onclick={()=>keyboard=!keyboard}>{keyboard?'收起键盘':'显示键盘'}</button><span>点选输入位置后，再点琴键；“叠加和弦”会加入当前和弦。</span></div>{#if keyboard}<PitchKeyboard onpitch={pitch}/>{/if}{/if}
    {/if}
  </footer>
  {#if queue.pending}<div class="score-command-shield" style:top={top+'px'} style:bottom={bottom+'px'}></div>{/if}
  {#if symbols}<Symbols groups={symbols} onapply={applySymbol} onclose={()=>symbols=null}/>{/if}
  {#if textCode}<div class="composer-modal-layer"><button class="composer-modal-shade" aria-label="关闭文本输入" onclick={()=>textCode=''}></button><form class="composer-modal" aria-label="文本输入" onsubmit={e=>{e.preventDefault();void writeText();}}><h2>{textReplace?'修改选中文字':'添加文字 / 记号'}</h2><p>先在谱面选择对应的音符，再输入内容。</p><label>内容<textarea aria-label="文本内容" rows="3" maxlength="10000" bind:value={textValue}></textarea></label>{#if textError}<p role="alert">{textError}</p>{/if}<div><button type="button" onclick={()=>textCode=''}>取消</button><button type="submit" disabled={queue.pending>0}>写入乐谱</button></div></form></div>{/if}
  {#if allActions}<div class="composer-modal-layer"><button class="composer-modal-shade" aria-label="关闭全部命令" onclick={()=>allActions=null}></button><div class="composer-modal command-catalog" role="dialog" aria-modal="true" aria-label="全部编谱命令" tabindex="-1"><header><h2>全部编谱命令</h2><button onclick={()=>allActions=null}>关闭</button></header><input aria-label="搜索编谱命令" placeholder="搜索命令名称" bind:value={actionSearch}/><div class="command-list">{#each allActions.filter(a=>(a.title+' '+a.code).toLowerCase().includes(actionSearch.toLowerCase())) as action}<button disabled={!action.enabled} onclick={()=>{allActions=null;act(action.code);}}>{action.title||action.code}</button>{/each}</div></div></div>{/if}
  {#if notice}<p class="composer-notice" role="status">{notice}</p>{/if}
  {#if queue.pending}<div class="composer-busy" role="status"><span></span>{queue.label||'正在处理编辑…'}{queue.pending>1?' · '+queue.pending+' 项':''}</div>{/if}
  {#if creating}<NewScore native onclose={()=>creating=false}/>{/if}
  {#if unlock}<div class="unlock-layer"><div class="unlock-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unlock-title" tabindex="-1"><h2 id="unlock-title">解锁编辑？</h2><p>当前乐谱已锁定，这次修改未执行。解锁后可以更改音符、音高和记号。</p><div><button onclick={()=>unlock=false}>保持锁定</button><button class="confirm" onclick={()=>{engine.setEditLocked(false);unlock=false;}}>解锁</button></div></div></div>{/if}
</div>
<style>
  .composer-busy{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:130;display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--c-card);color:var(--c-ink);border:1px solid var(--c-line);pointer-events:none;white-space:nowrap;}
  .composer-busy span{width:16px;height:16px;border:2px solid var(--c-line);border-top-color:var(--c-accent);border-radius:50%;animation:spin .8s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}@media(prefers-reduced-motion:reduce){.composer-busy span{animation-duration:2s;}}
</style>
