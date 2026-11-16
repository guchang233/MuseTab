import {engine} from '../bridge/engine.svelte';
import {library} from '../library/store.svelte';
import {workspace} from '../library/workspace.svelte';
import {activity} from '../ui/activity.svelte';
import {nav} from '../ui/nav.svelte';
export const instruments=[
  {id:'piano',name:'钢琴',staves:2,program:1,sound:'keyboard.piano',clef:'G',line:2},
  {id:'treble',name:'单行高音谱',staves:1,program:1,sound:'keyboard.piano',clef:'G',line:2},
  {id:'bass',name:'单行低音谱',staves:1,program:1,sound:'keyboard.piano',clef:'F',line:4},
  {id:'violin',name:'小提琴',staves:1,program:41,sound:'strings.violin',clef:'G',line:2},
  {id:'flute',name:'长笛',staves:1,program:74,sound:'wind.flutes.flute',clef:'G',line:2},
] as const;
export type ScoreDraft={title:string;composer:string;instrument:string;beats:number;beatType:number;fifths:number;tempo:number;measures:number};
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export function scoreXml(d:ScoreDraft){
  const instrument=instruments.find(i=>i.id===d.instrument);
  if(!instrument||!Number.isInteger(d.measures)||d.measures<1||d.measures>64||!Number.isInteger(d.fifths)||Math.abs(d.fifths)>7||!Number.isInteger(d.beats)||d.beats<1||d.beats>12||![2,4,8,16].includes(d.beatType)||!Number.isFinite(d.tempo)||d.tempo<30||d.tempo>240)throw Error('请检查新乐谱的参数');
  const duration=480*4*d.beats/d.beatType;
  const measures=Array.from({length:d.measures},(_,index)=>`<measure number="${index+1}">${index===0?`<attributes><divisions>480</divisions><key><fifths>${d.fifths}</fifths></key><time><beats>${d.beats}</beats><beat-type>${d.beatType}</beat-type></time><staves>${instrument.staves}</staves><clef number="1"><sign>${instrument.clef}</sign><line>${instrument.line}</line></clef>${instrument.staves===2?'<clef number="2"><sign>F</sign><line>4</line></clef>':''}</attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${d.tempo}</per-minute></metronome></direction-type><sound tempo="${d.tempo}"/></direction>`:''}${Array.from({length:instrument.staves},(_,staff)=>`${staff?`<backup><duration>${duration}</duration></backup>`:''}<note><rest measure="yes"/><duration>${duration}</duration><voice>${staff*4+1}</voice><staff>${staff+1}</staff></note>`).join('')}</measure>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escape(d.title.trim()||'未命名乐谱')}</work-title></work><identification><creator type="composer">${escape(d.composer.trim())}</creator><encoding><software>MuseTab</software></encoding></identification><part-list><score-part id="P1"><part-name>${instrument.name}</part-name><score-instrument id="I1"><instrument-name>${instrument.name}</instrument-name><instrument-sound>${instrument.sound}</instrument-sound></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>${instrument.program}</midi-program></midi-instrument></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}
export async function createScore(draft:ScoreDraft){
  const xml=new TextEncoder().encode(scoreXml(draft));
  await activity.run('正在创建乐谱…',async()=>{
    await workspace.persist();
    const title=draft.title.trim()||'未命名乐谱';
    const rec=await library.add(new File([xml],title+'.musicxml',{type:'application/vnd.recordare.musicxml+xml'}));
    await engine.open(xml,'musicxml');
    engine.setEditLocked(true);
    await library.touch(rec.id,{title});
    await workspace.persist(true);
    nav.go('editor');
    // A newly created score starts at its first writable beat, including on a
    // short landscape screen where the title would otherwise fill the viewport.
    for(let attempt=0;attempt<12;attempt++){
      await new Promise(resolve=>setTimeout(resolve,30));
      if(!engine.currentAction('first-element').enabled)continue;
      engine.focus();engine.dispatch('first-element');
      for(let i=0;i<80;i++){
        if(engine.selection.type==='Rest'||engine.selection.type==='Note')break;
        engine.dispatch('next-element');
      }
      break;
    }
  },'create-score');
}
