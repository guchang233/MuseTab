// Reuse the matching ZeraFun 0.7.4 phone UI source; no screenshot measurements.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const snapshot='docs/references/zerafun-0.7.4';
const upstream='D:/AI/management/pending-cleanup/gcys-design-backup/distribution/site-src';
if(process.argv.includes('--vendor')){
  await fs.mkdir(snapshot,{recursive:true});
  const provenance=[];
  for(const name of ['style.css','main.tsx','components/CatalogueHeader.tsx','components/SearchBar.tsx','pages/Personal.tsx','components/AppSettings.tsx']){
    const bytes=await fs.readFile(path.join(upstream,name));
    const destination=path.join(snapshot,name);
    await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
    provenance.push({file:name,source:path.join(upstream,name),sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await fs.writeFile(snapshot+'/provenance.json',JSON.stringify({project:'ZeraFun',version:'0.7.4',scope:'PhoneChrome / CatalogueHeader / SearchBar / shared catalogue CSS',files:provenance},null,2));
}
const source=await fs.readFile(snapshot+'/style.css','utf8');
function blocks(text){
  const result=[];let start=0;
  for(let i=0;i<text.length;i++){
    if(text[i]==='/'&&text[i+1]==='*'){const end=text.indexOf('*/',i+2);i=end+1;continue;}
    if(text[i]!=='{')continue;
    const prelude=text.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim();
    let depth=1,quote='',j=i+1;
    for(;j<text.length;j++){
      const ch=text[j];if(quote){if(ch===quote&&text[j-1]!=='\\')quote='';continue;}
      if(ch==='"'||ch==="'"){quote=ch;continue;}
      if(ch==='/'&&text[j+1]==='*'){j=text.indexOf('*/',j+2)+1;continue;}
      if(ch==='{')depth++;if(ch==='}'&&!--depth)break;
    }
    result.push({prelude,body:text.slice(i+1,j)});start=j+1;i=j;
  }
  return result;
}
function selectors(text){let depth=0,start=0,out=[];for(let i=0;i<text.length;i++){if('(['.includes(text[i]))depth++;if(')]'.includes(text[i]))depth--;if(text[i]===','&&!depth){out.push(text.slice(start,i));start=i+1;}}out.push(text.slice(start));return out;}
const allowed=/^\.(settings-[\w-]+|setting-[\w-]+|shared-search|search-(bar|field|filter|clear|symbol|input|submit|filters|leading)|filter-content|browse-(header|heading|actions|search)|media-grid|media-card|poster|empty-state|seg-item|app-tabbar)(?=[\s.:\[>]|$)/;
function project(text){
  let output='';
  for(const {prelude,body} of blocks(text)){
    if(prelude.startsWith('@media')){
      const inner=project(body);if(inner)output+=prelude+' {\n'+inner+'}\n';continue;
    }
    if(prelude===':root'){output+='.zf-app {'+body+'}\n';continue;}
    if(prelude===':root[data-theme="dark"]'){output+='[data-theme="dark"] .zf-app {'+body+'}\n';continue;}
    if(prelude.startsWith('@'))continue;
    const picked=selectors(prelude).map(s=>s.trim()).filter(s=>!s.includes('[data-app=tv]')).map(s=>s.replace(/^\[data-app(?:=phone)?\]\s*/, '')).filter(s=>allowed.test(s));
    if(!picked.length)continue;
    output+=picked.map(s=>'.zf-app '+s.replace(/\.app-tabbar a/g,'.app-tabbar button')).join(', ')+' {'+body+'}\n';
  }
  return output;
}
const fontSans=source.match(/--font-sans:\s*([^;]+);/)[1],fontReading=source.match(/--font-reading:\s*([^;]+);/)[1];
const adapted= `
/* Tailwind utilities expanded from PhoneChrome and VideoGrid, with buttons in
   place of React Router links. App-specific interaction targets stay >=44px. */
.zf-app { --font-sans: ${fontSans}; --font-reading: ${fontReading}; font: 14px/1.5 var(--font-sans); }
.zf-app .app-tabbar { position:fixed; inset:auto 0 0; z-index:40; display:flex; background:var(--c-paper); border-top:1px solid var(--c-line); padding-bottom:env(safe-area-inset-bottom); }
.zf-app .app-tabbar button { display:flex; height:56px; flex:1; flex-direction:column; align-items:center; justify-content:center; gap:4px; font:500 11px/1.5 var(--font-sans); color:var(--c-faint); }
.zf-app .app-tabbar button[aria-current=page] { color:var(--c-ink); }
.zf-app .app-tabbar svg { stroke-width:1.75; }
.zf-app .search-field svg { stroke-width:1.6; }
.zf-app .media-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); }
@media(min-width:640px) { .zf-app .media-grid { grid-template-columns:repeat(5,minmax(0,1fr)); } }
@media(min-width:768px) { .zf-app .media-grid { grid-template-columns:repeat(6,minmax(0,1fr)); } }
@media(min-width:1024px) { .zf-app .media-grid { grid-template-columns:repeat(7,minmax(0,1fr)); } }
@media(min-width:1280px) { .zf-app .media-grid { grid-template-columns:repeat(8,minmax(0,1fr)); } }
.zf-app .poster { aspect-ratio:2/3; }
.zf-app .poster-fallback { background:var(--c-raised); }
.zf-app .icon-btn { display:flex; width:44px; height:44px; align-items:center; justify-content:center; color:var(--c-muted); border-radius:8px; }
.zf-app .icon-btn:hover { background:var(--c-soft); color:var(--c-ink); }
.zf-app .search-filter, .zf-app .search-clear { width:44px; height:44px; }
`;
await fs.mkdir('app/src/library/zerafun',{recursive:true});
await fs.writeFile('app/src/library/zerafun/source.css','/* Generated from vendored ZeraFun 0.7.4 style.css. Run node tools/import-zerafun-style.mjs.\n   Rules retain source values; selectors are scoped to .zf-app. */\n'+project(source)+adapted);
console.log('Imported ZeraFun phone/catalogue CSS from source snapshot.');
