<script lang="ts">
  import {engine} from '../bridge/engine.svelte';
  import {registerBack} from '../ui/back';
  let {oncommand}:{oncommand:(command:string)=>void}=$props();
  let open=$state<number|null>(null),left=$state(8),top=$state(60);
  const menus=[
    {label:'文件',items:[['新建乐谱','new'],['保存','save'],['导出 MSCZ','export:mscz'],['导出 MusicXML','export:musicxml'],['导出 MIDI','export:mid'],['退出编谱','close']]},
    {label:'编辑',items:[['撤销','action:action://notation/undo'],['重做','action:action://notation/redo'],['剪切','action:action://notation/cut'],['复制','action:action://notation/copy'],['粘贴','action:action://notation/paste'],['全选','action:notation-select-all'],['删除','action:action://notation/delete']]},
    {label:'视图',items:[['符号面板','panel:symbols'],['属性面板','panel:selection'],['声部面板','panel:parts'],['混音器','panel:mixer'],['钢琴键盘','keyboard'],['放大','action:zoomin'],['缩小','action:zoomout'],['适应页宽','action:zoom-page-width']]},
    {label:'添加',items:[['末尾添加一小节','action:append-measure'],['插入一小节','action:insert-measure'],['歌词','action:lyrics'],['谱表文字','action:staff-text'],['系统文字','action:system-text'],['速度标记','action:tempo'],['三连音','action:triplet'],['符号与表情','panel:symbols']]},
    {label:'格式',items:[['页面设置','settings:page'],['谱面样式','settings:style'],['移调','settings:transpose'],['重置位置','action:reset']]},
    {label:'工具',items:[['属性','panel:selection'],['乐器与谱表','panel:parts'],['混音器','panel:mixer']]},
    {label:'帮助',items:[['编谱快速入门','help']]},
  ];
  $effect(()=>registerBack(()=>{if(open===null)return false;open=null;return true;},60));
  function show(index:number,event:MouseEvent){if(open===index){open=null;return;}const rect=(event.currentTarget as HTMLElement).getBoundingClientRect();left=Math.min(innerWidth-284,Math.max(8,rect.left));top=rect.bottom+4;open=index;}
  function choose(command:string){open=null;oncommand(command);}
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&open!==null){event.preventDefault();open=null;}}}/>
<nav class="menubar" aria-label="编谱菜单">{#each menus as menu,index}<button aria-haspopup="menu" aria-expanded={open===index} onclick={event=>show(index,event)}>{menu.label}</button>{/each}</nav>
{#if open!==null}
  <button class="menu-backdrop" aria-label="关闭菜单" onclick={()=>open=null}></button>
  <div class="menu-popup" role="menu" aria-label={menus[open].label} style:left={left+'px'} style:top={top+'px'}>
    {#each menus[open].items.filter(item=>!item[1].startsWith('action:')||engine.action(item[1].slice(7)).known) as item}<button role="menuitem" onclick={()=>choose(item[1])}>{item[0]}</button>{/each}
  </div>
{/if}
<style>
  .menubar{display:flex;flex-basis:100%;align-items:center;gap:1px;min-height:40px;}.menubar>button{min-width:44px;min-height:40px;padding:5px 13px;font-size:13px;border-radius:3px;}.menubar>button[aria-expanded=true]{background:var(--c-raised);}.menu-backdrop{position:fixed;inset:0;z-index:40;border-radius:0;pointer-events:auto;background:transparent;}.menu-popup{position:fixed;z-index:50;min-width:260px;max-width:calc(100vw - 16px);max-height:min(70vh,480px);overflow:auto;background:var(--c-card);border:1px solid var(--c-line);border-radius:3px;box-shadow:0 8px 30px #0004;padding:6px;pointer-events:auto;}.menu-popup button{display:block;width:100%;min-height:44px;padding:8px 16px;border-radius:3px;text-align:left;font-size:14px;}.menu-popup button:hover,.menu-popup button:focus-visible{background:var(--c-soft);}
  @media(max-width:600px){.menubar{justify-content:space-between;}.menubar>button{padding-inline:8px;}}
</style>
