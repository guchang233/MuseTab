import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const pkg=JSON.parse(await fs.readFile('app/package.json','utf8'));
const manifest=await fs.readFile('android/AndroidManifest.xml','utf8');
const versionCode=Number(manifest.match(/versionCode="(\d+)"/)[1]);
const tag=process.env.GITHUB_REF_NAME||'v'+pkg.version;
if(tag!=='v'+pkg.version||!manifest.includes('versionName="'+pkg.version+'"'))throw Error('Tag, package and Android manifest versions must match');
const file='MuseTab-'+pkg.version+'.apk',bytes=await fs.readFile('release/'+file),sha256=createHash('sha256').update(bytes).digest('hex');
await fs.writeFile('release/'+file+'.sha256',sha256+'  '+file+'\n');
await fs.writeFile('release/update.json',JSON.stringify({version:pkg.version,versionCode,minSdk:28,size:bytes.length,sha256,url:'https://github.com/guchang233/MuseTab/releases/download/'+tag+'/'+file,notes:'本地乐谱长按管理；云端详情下载；全屏单/双页和页面缓存；播放竖线同步修复；可关闭曲谱背景。'},null,2)+'\n');
