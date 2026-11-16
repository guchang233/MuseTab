<script lang="ts">
  // Ported from ZeraFun 0.7.4 pages/Personal.tsx Settings + AppSettings rows.
  import Icon from '../../ui/Icon.svelte';
  import {theme,type ThemePref} from '../../ui/theme.svelte';
  import {library} from '../store.svelte';
  import {REPOSITORY} from '../github';
  import {updates} from '../../update.svelte';
  import {registerBack} from '../../ui/back';
  import VersionSettings from './VersionSettings.svelte';
  let {oncloud,section=$bindable(''),item=$bindable('')}:{oncloud:()=>void;section?:string;item?:string}=$props();
  const sections=[{id:'app',title:'应用设置',detail:'外观、版本与更新'},{id:'library',title:'曲库与文件',detail:'本地乐谱、只读云端曲库'},{id:'about',title:'关于 MuseTab',detail:'离线看谱、播放与编辑'}];
  const entries:Record<string,{id:string;title:string;detail?:string}[]>={app:[{id:'appearance',title:'外观'},{id:'version',title:'版本与更新'},{id:'update',title:'自动检查更新'}],library:[{id:'local',title:'本地文件'},{id:'cloud',title:'云端曲库'}],about:[{id:'info',title:'应用信息'},{id:'source',title:'开源与许可'}]};
  const selected=$derived(entries[section]?.find(x=>x.id===item));
  const group=$derived(sections.find(x=>x.id===section));
  function back(){if(item)item='';else section='';}
  $effect(()=>registerBack(()=>{if(!section)return false;back();return true;},40));
</script>
<div class="settings-page settings-drilldown personal">
  <header class="settings-topbar">
    {#if section}<button data-setting-back class="btn-ghost btn-sm" onclick={back}><Icon name="back" size={16}/>返回</button>{:else}<span></span>{/if}
    <h1>{selected?.title||group?.title||'我的'}</h1>
    {#if section}<button class="settings-close icon-btn" aria-label="返回我的" onclick={()=>{section='';item='';}}><Icon name="close" size={16}/></button>{/if}
  </header>
  {#if section}<p class="settings-path">我的 / {group?.title}{selected?' / '+selected.title:''}</p>{/if}
  {#if !selected}
    <nav class="settings-menu" aria-label={group?group.title+'选项':'设置分类'}>
      {#each section?entries[section]:sections as row}
        <button class="settings-menu-row" onclick={()=>{if(section)item=row.id;else section=row.id;}}><span><span class="settings-menu-title">{row.title}</span>{#if (row.id==='app'||row.id==='version')&&updates.available}<span class="settings-menu-detail">发现新版本 {updates.release?.version}</span>{:else if row.detail}<span class="settings-menu-detail">{row.detail}</span>{/if}</span><Icon name="forward" size={16}/></button>
      {/each}
    </nav>
  {:else}
    <div class="settings-detail" aria-label={selected.title+'设置'}>
      {#if item==='version'}<VersionSettings/>{:else}
      <div class="setting-row"><span><span class="setting-title">{selected.title}</span><span class="setting-description">
        {#if item==='appearance'}选择界面主题
        {:else if item==='update'}每天检查一次正式版本，下载和安装由你决定
        {:else if item==='local'}{library.records.length} 份乐谱 · 单文件上限 32 MB。编辑后可导出 MSCZ 备份；PDF 批注保存在此设备。
        {:else if item==='cloud'}{REPOSITORY} · 保存到本地后打开，本地编辑不会上传。
        {:else if item==='source'}GPL-3.0 · MuseScore 核心与第三方组件许可见源码仓库。
        {:else}MuseTab · Android 离线看谱、记号、播放与编辑{/if}
      </span></span>
      <span class="setting-controls">
        {#if item==='appearance'}<span class="seg" role="radiogroup" aria-label="界面主题">{#each [{value:'auto',label:'跟随系统'},{value:'light',label:'浅色'},{value:'dark',label:'深色'}] as o}<button class="seg-item" class:active={theme.pref===o.value} role="radio" aria-checked={theme.pref===o.value} onclick={()=>theme.set(o.value as ThemePref)}>{o.label}</button>{/each}</span>
        {:else if item==='update'}<button class="btn-ghost btn-sm" role="switch" aria-label="自动检查更新" aria-checked={updates.auto} onclick={()=>updates.setAuto(!updates.auto)}>{updates.auto?'已开启':'已关闭'}</button>
        {:else if item==='cloud'}<button class="btn-ghost btn-sm" onclick={oncloud}>打开曲库</button>
        {:else if item==='source'}<code>github.com/guchang233/MuseTab</code>{/if}
      </span></div>
      {/if}
      {#if item==='appearance'}<div class="setting-row"><span><span class="setting-title">曲谱背景</span><span class="setting-description">关闭纸张背景，让音符和五线谱融入界面背景。</span></span><span class="setting-controls"><button class="btn-ghost btn-sm" role="switch" aria-label="曲谱背景" aria-checked={theme.paper} onclick={()=>theme.setPaper(!theme.paper)}>{theme.paper?'已开启':'已关闭'}</button></span></div>{/if}
    </div>
  {/if}
</div>
<style>
 .personal{width:100%;max-width:768px;margin:0 auto}.settings-topbar h1{margin:0}.settings-path,.setting-description{color:var(--c-muted);font-size:12px;line-height:1.8}.setting-row{display:flex;align-items:center;justify-content:space-between;gap:24px}.setting-title,.setting-description{display:block}.setting-controls{display:flex;align-items:center;gap:8px}.seg{display:flex;align-items:center;gap:2px;padding:4px;border-radius:var(--toolbar-radius);background:var(--veil);box-shadow:var(--island-ring)}.seg-item{padding:8px 14px;border-radius:var(--chip-radius);font:500 14px/1.2 var(--font-ui)}.seg-item.active{background:var(--rubric-wash);color:var(--rubric);box-shadow:var(--chip-ring)}.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:var(--island-radius);padding:8px 14px;min-height:44px;background:var(--material);box-shadow:var(--island-ring);font:500 14px/1.2 var(--font-ui)}.settings-menu-row{text-align:left}code{font-size:12px;overflow-wrap:anywhere}
</style>
