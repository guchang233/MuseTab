import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const pkg=JSON.parse(await fs.readFile('app/package.json','utf8'));
const manifest=await fs.readFile('android/AndroidManifest.xml','utf8');
const versionCode=Number(manifest.match(/versionCode="(\d+)"/)[1]);
const tag=process.env.GITHUB_REF_NAME||'v'+pkg.version;
if(tag!=='v'+pkg.version||!manifest.includes('versionName="'+pkg.version+'"'))throw Error('Tag, package and Android manifest versions must match');
const file='MuseTab-'+pkg.version+'.apk',bytes=await fs.readFile('release/'+file),sha256=createHash('sha256').update(bytes).digest('hex');
await fs.writeFile('release/'+file+'.sha256',sha256+'  '+file+'\n');
await fs.writeFile('release/update.json',JSON.stringify({version:pkg.version,versionCode,minSdk:28,size:bytes.length,sha256,url:'https://github.com/guchang233/MuseTab/releases/download/'+tag+'/'+file,notes:'版面显示/隐藏后保留播放位置；修正遮罩及控件圆角；按 ZeraFun 源码重做更新提示；翻页增加轻量淡入过渡。'},null,2)+'\n');
