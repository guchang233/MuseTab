import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../app/package.json',import.meta.url))('typescript');
async function module(name){const source=await readFile(new URL('../app/src/composer/aria/'+name+'.ts',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const {chordType,chordErase,chordComplete}=await module('chord-draft');
for(const s of ['C','Cb','Cbb','F##','C/Eb','C/Ebb','C7b9','Cmin(maj7)','Gaug','Cø'])assert(chordComplete(s),s);
for(const s of ['','b','C/','Cadd','Cno','C7b','C7##','Cmin(maj'])assert(!chordComplete(s),s);
assert.equal(chordType('Cmin','maj'),'Cmin(maj');assert.equal(chordType('C°','maj'),'C°(maj');assert.equal(chordType('Cmin(maj','7'),'Cmin(maj7)');
assert.equal(chordErase('Cmin(maj13)'),'Cmin(maj');assert.equal(chordErase('Cmin(maj'),'Cmin');
for(const token of ['maj','min','sus','add','no','11','13','b5','#5','dim','aug'])assert.equal(chordErase('C'+token),'C');
const {naturalPitch,naturalIndex,visibleCount,clampStart,hitPitch}=await module('keyboard');
for(let pitch=21;pitch<=108;pitch++){const natural=naturalPitch(naturalIndex(pitch));assert(natural<=pitch&&pitch-natural<=1);}
assert.equal(visibleCount(2000,false),22);assert.equal(visibleCount(300,false),14);assert.equal(visibleCount(300,true),7);assert.equal(visibleCount(400,true),8);assert.equal(visibleCount(200,true,true),5);
const start=naturalIndex(60),width=700,count=14;
assert.equal(hitPitch(25,90,width,92,start,count),60);assert.equal(hitPitch(50,10,width,92,start,count),61);
assert.equal(hitPitch(50,71,width,92,start,count),61);assert.equal(hitPitch(50,73,width,92,start,count),62);
assert.equal(hitPitch(150,10,width,92,start,count),65,'E–F has no accidental');
assert.equal(hitPitch(-1,30,width,92,start,count),null);assert.equal(hitPitch(10,93,width,92,start,count),null);
assert.equal(naturalPitch(clampStart(-100,14)),21);assert.equal(naturalPitch(clampStart(1000,14)+13),108);
console.log('PASS Aria chord token/completion and piano range/hit geometry');
