import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../app/package.json',import.meta.url));
const ts=require('typescript');
const source=await readFile(new URL('../app/src/composer/session.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {ComposerSession}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function fixture(){
  const calls=[],states=[];let locked=false,id='score-a',revision=0,unlock=0;
  const adapter={documentId:()=>id,ready:()=>true,locked:()=>locked,requestUnlock:()=>unlock++,action:()=>({known:true,enabled:true}),dispatch:code=>{calls.push(code);revision++;},save:async()=>{calls.push('save');},snapshot:()=>({revision,noteInput:false,selected:true})};
  const session=new ComposerSession(adapter,state=>states.push(state),()=>new Promise(resolve=>setTimeout(resolve,0)));
  return {adapter,session,calls,states,lock:()=>locked=true,switch:()=>id='score-b',unlocks:()=>unlock};
}
const action=code=>({kind:'action',code,label:code,mutates:true});
{
 const f=fixture(),edits=[];
 f.adapter.edit=value=>edits.push(value);
 // Svelte form state is a Proxy, which structuredClone cannot clone.
 const metadata=new Proxy({workTitle:'Original'},{});
 const job=f.session.submit({kind:'edit',label:'metadata',values:{op:'metadata',metadata}});
 metadata.workTitle='Changed while queued';await job;
 assert.equal(edits[0].metadata.workTitle,'Original');
}
{
 const f=fixture(),pitches=[];
 f.adapter.pitch=command=>pitches.push(command);
 const intent={duration:'pad-note-4',voice:1,dotted:false,chord:false};
 const first=f.session.submit({kind:'pitch',label:'C4',step:0,octave:4,accidental:0,intent});
 intent.duration='pad-note-8';intent.voice=2;
 const second=f.session.submit({kind:'pitch',label:'D4',step:1,octave:4,accidental:0,intent});
 await Promise.all([first,second]);
 assert.equal(pitches[0].intent.duration,'pad-note-4');assert.equal(pitches[0].intent.voice,1);
 assert.equal(pitches[1].intent.duration,'pad-note-8');assert.equal(pitches[1].intent.voice,2);
}
{
 const f=fixture();f.lock();
 for(const command of [{kind:'palette',label:'p',palette:0,cell:0},{kind:'text',label:'t',code:'lyrics',text:'音符',replace:false}])await assert.rejects(f.session.submit(command),/解锁/);
 assert.equal(f.unlocks(),2);assert.deepEqual(f.calls,[]);
}
{
 const f=fixture();
 const jobs=Array.from({length:20},(_,i)=>f.session.submit(action('note-'+i)));
 const save=f.session.submit({kind:'save',label:'保存'});
 await f.session.flush();await Promise.all([...jobs,save]);
 assert.deepEqual(f.calls,[...Array.from({length:20},(_,i)=>'note-'+i),'save']);
 assert.equal(f.states.at(-1).pending,0);
}
{
 const f=fixture();const job=f.session.submit(action('note'));f.lock();
 await assert.rejects(job,/解锁/);await f.session.flush();
 assert.deepEqual(f.calls,[]);assert.equal(f.unlocks(),1);
}
{
 const f=fixture();const jobs=Promise.allSettled([f.session.submit(action('first')),f.session.submit(action('second'))]);f.switch();
 assert.deepEqual((await jobs).map(x=>x.status),['rejected','rejected']);assert.deepEqual(f.calls,[]);
}
{
 const f=fixture();f.adapter.dispatch=()=>{throw new Error('编辑失败');};
 const results=await Promise.allSettled([f.session.submit(action('first')),f.session.submit(action('second'))]);
 assert.deepEqual(results.map(x=>x.status),['rejected','rejected']);await f.session.flush();
 // A reported editing failure must not trap the user in the composer.
 await f.session.submit({kind:'save',label:'保存'});assert.deepEqual(f.calls,['save']);
}
{
 const f=fixture();const result=f.session.submit(action('note'));f.session.dispose();
 await assert.rejects(result,/关闭/);assert.deepEqual(f.calls,[]);
 await assert.rejects(f.session.submit(action('note')),/关闭/);
}
console.log('PASS: ordered editing/save, lock recheck, document isolation, failure recovery, disposal');
