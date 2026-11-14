import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const pkg=JSON.parse(await fs.readFile('app/package.json','utf8'));
const manifest=await fs.readFile('android/AndroidManifest.xml','utf8');
const versionCode=Number(manifest.match(/versionCode="(\d+)"/)[1]);
const tag=process.env.GITHUB_REF_NAME||'v'+pkg.version;
if(tag!=='v'+pkg.version||!manifest.includes('versionName="'+pkg.version+'"'))throw Error('Tag, package and Android manifest versions must match');
const file='MuseTab-'+pkg.version+'.apk',bytes=await fs.readFile('release/'+file),sha256=createHash('sha256').update(bytes).digest('hex');
await fs.writeFile('release/'+file+'.sha256',sha256+'  '+file+'\n');
await fs.writeFile('release/update.json',JSON.stringify({version:pkg.version,versionCode,minSdk:28,size:bytes.length,sha256,url:'https://github.com/guchang233/MuseTab/releases/download/'+tag+'/'+file,notes:'修复多页 MSCZ 在第二页及之后点击音符或纸内空白时，误触翻页导致谱面瞬移的问题；保留谱外空白快捷翻页。'},null,2)+'\n');
