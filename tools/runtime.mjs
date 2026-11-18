// Pinned native dependency, built from the corresponding source described in engine/runtime.lock.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),dest=path.join(root,'app/public/engine');
const runtimeTag=process.argv.find(a=>a.startsWith('--tag='))?.slice(6)||'engine-runtime-v1';
if(!/^engine-runtime-v\d+$/.test(runtimeTag))throw Error('Invalid runtime tag');
if(process.argv.includes('--pack')){
  const files=['MuseScoreStudio.js','MuseScoreStudio.wasm','MuseAudio.js','MuseAudio-simd.js','distr','sound','LICENSE.txt','MUSETAB_NOTICE.md','UPSTREAM_NOTICE.txt','host.html','ComposerWorkspace.qml','reader-gestures.js'];
  await fs.mkdir(path.join(root,'release'),{recursive:true});
  const zip=path.join(root,'release/'+runtimeTag+'.zip');
  // tar is available on Windows developer/CI hosts. bsdtar emits zip with -a.
  execFileSync('tar',['-a','-cf',zip,...files],{cwd:dest,stdio:'inherit'});
  const bytes=await fs.readFile(zip),sha256=createHash('sha256').update(bytes).digest('hex');
  const lock={url:'https://github.com/guchang233/MuseTab/releases/download/'+runtimeTag+'/'+runtimeTag+'.zip',sha256,source:'https://github.com/musescore/MuseScore',commit:'7688c005ad963ba09ee715aae53dbc7e8c9d5ef8',qt:'6.7.3',emscripten:'3.1.50',patches:'engine/',sourceArchive:'https://github.com/guchang233/MuseTab/releases/download/'+runtimeTag+'/musescore-corresponding-source.tar.gz'};
  await fs.writeFile(path.join(root,'engine/runtime.lock.json'),JSON.stringify(lock,null,2)+'\n');
  console.log('Runtime packed, SHA-256 '+sha256);
}else{
  const lock=JSON.parse(await fs.readFile(path.join(root,'engine/runtime.lock.json'),'utf8'));
  const sha=b=>createHash('sha256').update(b).digest('hex');
  // 本机已有同一哈希的运行时包（--pack 产物或上次下载）就直接用，不再重复下载上百 MB。
  const local=[path.join(root,'release',path.basename(new URL(lock.url).pathname)),path.join(root,'release/runtime-download.zip')];
  let zip='';
  for(const candidate of local){try{if(sha(await fs.readFile(candidate))===lock.sha256){zip=candidate;console.log('Using local runtime '+path.relative(root,candidate));break;}}catch{}}
  if(!zip){
    const r=await fetch(lock.url);if(!r.ok)throw Error('Runtime download HTTP '+r.status);
    const bytes=Buffer.from(await r.arrayBuffer());if(sha(bytes)!==lock.sha256)throw Error('Native runtime SHA-256 mismatch');
    zip=local[1];await fs.mkdir(path.dirname(zip),{recursive:true});await fs.writeFile(zip,bytes);
  }
  await fs.mkdir(dest,{recursive:true});
  const python=process.env.MUSETAB_PYTHON||(process.platform==='win32'?'python':'python3');
  execFileSync(python,['-c','import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,dest],{stdio:'inherit'});
}
// Current application glue always comes from the checked-out tag.
await fs.cp(path.join(root,'engine/overrides/src/web/appjs/distr'),path.join(dest,'distr'),{recursive:true});
await fs.copyFile(path.join(root,'engine/host/host.html'),path.join(dest,'host.html'));
await fs.copyFile(path.join(root,'engine/shell/qml/MuseScore/AppShell/platform/web/ComposerWorkspace.qml'),path.join(dest,'ComposerWorkspace.qml'));
await fs.copyFile(path.join(root,'app/src/reader/gestures.js'),path.join(dest,'reader-gestures.js'));
await fs.copyFile(path.join(root,'THIRD_PARTY.md'),path.join(dest,'MUSETAB_NOTICE.md'));
