import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fetchCatalog,downloadScore,REPOSITORY} from '../app/src/library/github.ts';
const original=globalThis.fetch,requests=[],checks=[];
const pass=(name,data)=>{checks.push({name,data});console.log('PASS',name,JSON.stringify(data??''));};
try{
  globalThis.fetch=async(url,options)=>{requests.push(String(url));assert(!String(url).includes('api.github.com'));return original(url,options);};
  const catalog=await fetchCatalog();assert(catalog.scores.length>0);
  const counts=catalog.scores.reduce((out,file)=>(out[file.ext]=(out[file.ext]||0)+1,out),{});
  pass('live static catalog; no REST requests',{count:catalog.scores.length,counts,commit:catalog.commit});
  const entry=catalog.scores.find(f=>f.path==='mid/1.mid')||catalog.scores.find(f=>f.ext==='mid'&&f.size<100000);
  const file=await downloadScore(entry,new AbortController().signal,()=>{});
  assert.equal(new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()).slice(0,4)),'MThd');
  pass('live immutable score download and Git blob checksum',{path:entry.path,bytes:file.size});
  const bytes=Buffer.from('%PDF-1.4\nfixture'),hash=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  const fixture={version:1,repo:REPOSITORY,branch:'main',commit:'a'.repeat(40),updatedAt:Date.now(),scores:[{path:'pdf/曲名 #1.pdf',sha:hash,size:bytes.length}]};
  globalThis.fetch=async()=>Response.json(fixture);
  const c=await fetchCatalog();assert.equal(c.scores[0].name,'曲名 #1');
  for(const bad of [
    {...fixture,version:2},
    {...fixture,scores:[{...fixture.scores[0],path:'pdf/../escape.pdf'}]},
    {...fixture,scores:[{...fixture.scores[0],path:'pdf/back'+String.fromCharCode(92)+'slash.pdf'}]},
    {...fixture,scores:[fixture.scores[0],fixture.scores[0]]},
  ]){
    globalThis.fetch=async()=>Response.json(bad);
    await assert.rejects(fetchCatalog(),/清单/);
  }
  let raw;
  globalThis.fetch=async url=>{raw=String(url);return new Response(bytes);};
  const downloaded=await downloadScore(c.scores[0],new AbortController().signal,()=>{});
  assert.equal(downloaded.name,'曲名 #1.pdf');assert(raw.includes('/'+'a'.repeat(40)+'/pdf/')&&raw.endsWith('%E6%9B%B2%E5%90%8D%20%231.pdf'));
  await assert.rejects(downloadScore({...c.scores[0],sha:'0'.repeat(40)},new AbortController().signal,()=>{}),/校验失败/);
  pass('manifest validation, path encoding, pinned commit and checksum rejection');
  globalThis.fetch=async()=>new Response('',{status:404});await assert.rejects(fetchCatalog(),/尚未发布/);
  assert(requests.every(url=>url.startsWith('https://raw.githubusercontent.com/')));
}finally{globalThis.fetch=original;await fs.mkdir('tests/results',{recursive:true});await fs.writeFile('tests/results/static-catalog.json',JSON.stringify({checks,requests},null,2));}
