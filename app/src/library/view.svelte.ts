export type LibraryTab='local'|'cloud'|'recent'|'settings';
type ListView={query:string;filter:string;scroll:number;width:number;anchor?:{key:string;offset:number}};
type LibraryView={tab:LibraryTab;lists:Record<LibraryTab,ListView>;personal:{section:string;item:string};detailPath:string;settingsCloudReturn:boolean};
const KEY='musetab.library-view.v1',tabs:LibraryTab[]=['local','cloud','recent','settings'];
function initial():LibraryView{
 const value:LibraryView={tab:'local',lists:Object.fromEntries(tabs.map(tab=>[tab,{query:'',filter:'all',scroll:0,width:0}])) as LibraryView['lists'],personal:{section:'',item:''},detailPath:'',settingsCloudReturn:false};
 try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!saved)return value;
  if(tabs.includes(saved.tab))value.tab=saved.tab;
  for(const tab of tabs){const old=saved.lists?.[tab];if(!old)continue;const next=value.lists[tab];if(typeof old.query==='string')next.query=old.query.slice(0,2000);if(['all','mid','mscz','pdf','xml'].includes(old.filter))next.filter=old.filter;if(Number.isFinite(old.scroll))next.scroll=Math.max(0,old.scroll);if(Number.isFinite(old.width))next.width=Math.max(0,old.width);if(typeof old.anchor?.key==='string'&&Number.isFinite(old.anchor.offset))next.anchor=old.anchor;}
  if(['','app','library','about'].includes(saved.personal?.section))value.personal.section=saved.personal.section;
  if(['','appearance','version','update','local','cloud','info','source'].includes(saved.personal?.item))value.personal.item=saved.personal.item;
  if(typeof saved.detailPath==='string')value.detailPath=saved.detailPath;
  value.settingsCloudReturn=saved.settingsCloudReturn===true;
 }catch{}return value;
}
// Outlives the Library component when a score is opened; sessionStorage also survives reload.
export const libraryView=$state(initial());
let timer:ReturnType<typeof setTimeout>;
export function persistLibraryView(later=false){clearTimeout(timer);const save=()=>{try{sessionStorage.setItem(KEY,JSON.stringify($state.snapshot(libraryView)));}catch{}};if(later)timer=setTimeout(save,120);else save();}
