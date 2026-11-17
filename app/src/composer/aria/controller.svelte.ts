import {zh} from './zh';
import {engine} from '../../bridge/engine.svelte';
import {library} from '../../library/store.svelte';
import {workspace} from '../../library/workspace.svelte';
import {activity} from '../../ui/activity.svelte';
import {ComposerSession,registerComposerBarrier,registerComposerAction,type QueueState,type NoteIntent} from '../session';
import type {AriaCategory} from './reference';
import type {AriaTool} from './tools';

export class AriaEditorController {
 category=$state<AriaCategory>('select');
 flats=$state(false);
 intent=$state<NoteIntent>({duration:'pad-note-4',voice:1,dotted:false,chord:false});
 queue=$state<QueueState>({pending:0,label:'',error:''});
 error=$state('');loading=$state(false);
 session:ComposerSession;
 constructor(){
  this.session=new ComposerSession({documentId:()=>library.current?.id,ready:()=>engine.status==='ready'&&engine.project.open,locked:()=>false,requestUnlock:()=>{},action:code=>engine.currentAction(code),dispatch:code=>{engine.focus();engine.dispatch(code);},
   palette:(p,c)=>engine.applyPaletteCell(p,c),
   pitch:command=>{
    const natural=[0,2,4,5,7,9,11],midi=(command.octave+1)*12+natural[command.step]+command.accidental;
    if(command.replace){
     if(engine.supports('mtComposerState')){const reply=engine.composerState({pitchCommand:{pitch:midi}});if(!reply?.pitchOk)throw Error(reply?.pitchError||'The selected note could not be changed.');return;}
     if(engine.selection.pitch==null)throw Error('Select a note or rest before using the keyboard.');
     for(let guard=0;guard<128&&engine.selection.pitch!==midi;guard++){
      const current:number|undefined=engine.selection.pitch;if(current==null)throw Error('Select a note or rest before using the keyboard.');
      const delta=midi-current;engine.dispatch(Math.abs(delta)>=12?(delta>0?'pitch-up-octave':'pitch-down-octave'):(delta>0?'pitch-up':'pitch-down'));
      if(engine.selection.pitch===current)throw Error('The selected note could not be changed.');
     }
     if(engine.selection.pitch!==midi)throw Error('The selected note could not be changed.');
     return;
    }
    if(!engine.currentAction('note-input').checked)engine.dispatch('note-input-by-note-name');
    for(const code of ['voice-'+command.intent.voice,command.intent.duration])if(!engine.currentAction(code).checked)engine.dispatch(code);
    if(engine.currentAction('pad-dot').checked!==command.intent.dotted)engine.dispatch('pad-dot');
    if(!engine.addPitch(command.step,command.octave,command.accidental,command.intent.chord))throw Error('Select a note or rest before using the keyboard.');
   },
   text:command=>{if(engine.noteInput)engine.dispatch('note-input');const result=engine.composerState({textCommand:{code:command.code,text:command.text,replace:command.replace,advance:command.advance,previous:command.previous,mode:command.mode}});if(!result?.textOk)throw Error(result?.textError||'The text could not be saved.');},
   edit:values=>{if(engine.noteInput)engine.dispatch('note-input');const result=engine.composerState({editCommand:values});if(!result?.editOk)throw Error(result?.editError||'The score could not be changed.');},
   save:()=>workspace.persist(true),snapshot:()=>({revision:engine.changeSeq,noteInput:engine.noteInput,selected:!engine.selection.none})
  },state=>this.queue=state);
 }
 attach(){const barrier=registerComposerBarrier(()=>this.session.flush()),actions=registerComposerAction(code=>void this.action(code));return()=>{barrier();actions();this.session.dispose();};}
 get busy(){return this.loading||this.queue.pending>0;}
 selected(id:string){
  if(id==='stack')return this.intent.chord;
  if(id.startsWith('pad-note-')&&!engine.noteInput&&engine.selection.durationTicks){const divisor=Number(id.slice(9));const base=engine.selection.durationTicks/(2-Math.pow(.5,engine.selection.dots||0));return Math.abs(base-1920/divisor)<1;}
  if(id==='pad-dot'&&!engine.noteInput)return !!engine.selection.dots;
  if(id.startsWith('pad-note-')&&engine.noteInput)return this.intent.duration===id;
  if(id==='pad-dot'&&engine.noteInput)return this.intent.dotted;
  return engine.action(id).checked;
 }
 async action(code:string){
  if(code==='flat'||code==='flat2')this.flats=true;if(code==='sharp'||code==='sharp2')this.flats=false;
  if(code==='stack'){this.intent={...this.intent,chord:!this.intent.chord};return;}
  if(code.startsWith('pad-note-'))this.intent={...this.intent,duration:code,dotted:false};
  if(code==='pad-dot')this.intent={...this.intent,dotted:!this.intent.dotted};
  if(code.startsWith('voice-'))this.intent={...this.intent,voice:Number(code.slice(6))};
  if(code.startsWith('tuplet:'))code=({2:'duplet',3:'triplet',4:'quadruplet',5:'quintuplet',6:'sextuplet',7:'septuplet',8:'octuplet',9:'nonuplet'} as Record<number,string>)[Number(code.slice(7))];
  try{await this.session.submit({kind:'action',code,label:'Editing…',mutates:!code.includes('copy')&&!code.startsWith('select-')});}catch(e){this.error=zh((e as Error).message);}
 }
 async choose(category:AriaCategory){
  this.category=category;
  if(category==='notes'){
   if(!engine.noteInput){
    // Aria starts note entry at a musical position even when the freshly
    // created score has no selection. The stock action alone is disabled there.
    if(engine.selection.none){
     engine.dispatch('first-element');
     for(let i=0;i<64&&!['Note','Rest','Chord'].includes(engine.selection.type||'');i++)engine.dispatch('next-element');
    }
    await this.action('note-input-by-note-name');
   }
  }
  else if(engine.noteInput)await this.action('note-input');
 }
 async pitch(midi:number){
  const step=[0,0,1,1,2,3,3,4,4,5,5,6][midi%12],accidental=[0,1,0,1,0,0,1,0,1,0,1,0][midi%12];
  try{await this.session.submit({kind:'pitch',label:'Keyboard…',step,octave:Math.floor(midi/12)-1,accidental,intent:this.intent,replace:this.category!=='notes'});}catch(e){this.error=zh((e as Error).message);}
 }
 async text(code:string,text:string,replace=false,advance=false,mode?:string,previous=false){try{await this.session.submit({kind:'text',label:'Saving text…',code,text,replace,advance,mode,previous});return true;}catch(e){this.error=zh((e as Error).message);return false;}}
 async edit(values:Record<string,unknown>){try{await this.session.submit({kind:'edit',label:'Editing…',values});return true;}catch(e){this.error=zh((e as Error).message);return false;}}
 async namedPalette(label:string,groups:string[]){
  this.loading=true;
  try{await activity.run('Adding '+label+'…',async()=>{
   await this.session.flush();
   const catalogs=engine.palettes();const matches=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');const wanted=matches(label);
   for(let p=0;p<catalogs.length;p++){
    if(!groups.some(g=>catalogs[p].name.toLowerCase().includes(g.toLowerCase())))continue;
    const palette=engine.palette(p);if(!palette)continue;
    const cell=palette.cells.findIndex(c=>matches(c.name)===wanted);if(cell>=0){await this.session.submit({kind:'palette',label:'Adding '+label,palette:p,cell});return;}
   }
   throw Error('当前记谱核心不支持该符号：'+zh(label));
  });}catch(e){this.error=zh((e as Error).message);}finally{this.loading=false;}
 }
 async tool(tool:AriaTool){
  const id=tool.id;
  if(id==='no-break'){await this.edit({op:'keepTogether'});return;}
  if(id==='remove-break'){await this.edit({op:'removeBreak'});return;}
  if(id==='insert-measure'){await this.edit({op:'addMeasures',count:1});return;}
  if(id.startsWith('category:')){await this.choose(id.slice(9) as AriaCategory);return;}
  if(id.startsWith('dynamic:')){await this.namedPalette(id.slice(8),['Dynamics']);return;}
  if(id.startsWith('repeat:')){const alias:Record<string,string>={'First ending':'1st ending','Second ending':'2nd ending','Start repeat':'Start repeat barline','End repeat':'End repeat barline'};const label=id.slice(7);await this.namedPalette(alias[label]||label,['Repeats','Barlines']);return;}
  if(id.startsWith('line:')){await this.namedPalette(id.slice(5),['Lines','Keyboard']);return;}
  if(id.startsWith('ornament:')){await this.namedPalette(id.slice(9),['Ornaments','Arpeggios']);return;}
  if(id.startsWith('tremolo:')){const catalogs=engine.palettes(),p=catalogs.findIndex(c=>c.name==='Tremolos');if(p>=0)try{await this.session.submit({kind:'palette',label:'Tremolo…',palette:p,cell:Number(id.slice(8))-1});}catch(e){this.error=zh((e as Error).message);}return;}
  if(id==='fermata'){await this.namedPalette('Fermata',['Breaths','Articulations']);return;}
  await this.action(id);
 }
}
