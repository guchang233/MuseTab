// MuseTab's adapter boundary, informed by Aria's serial editing session.
// No score data or playback worker is owned by this UI queue.
export type ComposerCommand =
  | {kind:'action'; code:string; label:string; mutates:boolean}
  | {kind:'pitch'; label:string; step:number;octave:number;accidental:number;intent:NoteIntent;replace?:boolean}
  | {kind:'palette'; label:string;palette:number;cell:number}
  | {kind:'text';label:string;code:string;text:string;replace:boolean;advance?:boolean;previous?:boolean;mode?:string}
  | {kind:'edit';label:string;values:Record<string,unknown>}
  | {kind:'save'; label:string};
export type NoteIntent={duration:string;voice:number;dotted:boolean;chord:boolean};
export type ComposerSnapshot = {revision:number; noteInput:boolean; selected:boolean};
export type ComposerAdapter = {
  documentId():string|undefined;
  ready():boolean;
  locked():boolean;
  requestUnlock():void;
  action(code:string):{known:boolean;enabled:boolean};
  dispatch(code:string):void;
  pitch?(command:Extract<ComposerCommand,{kind:'pitch'}>):void;
  palette?(palette:number,cell:number):boolean;
  text?(command:Extract<ComposerCommand,{kind:'text'}>):void;
  edit?(values:Record<string,unknown>):void;
  save():Promise<void>;
  snapshot():ComposerSnapshot;
};
type Job={command:ComposerCommand;documentId:string|undefined;resolve:(value:ComposerSnapshot)=>void;reject:(error:Error)=>void};
export type QueueState={pending:number;label:string;error:string};
let activeBarrier:(()=>Promise<void>)|undefined;
let activeAction:((code:string)=>void)|undefined;
export function registerComposerAction(handler:(code:string)=>void){activeAction=handler;return()=>{if(activeAction===handler)activeAction=undefined;};}
export function dispatchComposerAction(code:string){if(!activeAction)return false;activeAction(code);return true;}
export function registerComposerBarrier(barrier:()=>Promise<void>){
  activeBarrier=barrier;
  return()=>{if(activeBarrier===barrier)activeBarrier=undefined;};
}
export async function flushComposer(){await activeBarrier?.();}

export class ComposerSession {
  private jobs:Job[]=[];
  private running=false;
  private disposed=false;
  private waiters:(()=>void)[]=[];
  private state:QueueState={pending:0,label:'',error:''};
  constructor(private adapter:ComposerAdapter,private changed:(state:QueueState)=>void,
    private yieldUI:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,16))){}

  submit(command:ComposerCommand):Promise<ComposerSnapshot>{
    if(this.disposed)return Promise.reject(new Error('编谱会话已关闭'));
    if(command.kind!=='save'&&(command.kind!=='action'||command.mutates)&&this.adapter.locked()){
      this.adapter.requestUnlock();
      return Promise.reject(new Error('请先解锁编辑'));
    }
    const result=new Promise<ComposerSnapshot>((resolve,reject)=>{
      // Edit payloads are JSON records. Serializing here also unwraps Svelte's
      // state proxies, which structuredClone rejects, and captures nested values
      // before the user can change a field while the command waits in the queue.
      const captured=command.kind==='pitch'?{...command,intent:{...command.intent}}:command.kind==='edit'?{...command,values:JSON.parse(JSON.stringify(command.values))}:{...command};
      this.jobs.push({command:captured,documentId:this.adapter.documentId(),resolve,reject});
    });
    this.state.error='';
    this.publish();
    if(!this.running)void this.drain();
    return result;
  }

  /** A barrier used before save/export/navigation; accepted edits are never dropped. */
  async flush():Promise<void>{
    if(this.running||this.jobs.length)await new Promise<void>(resolve=>this.waiters.push(resolve));
  }

  dispose(){
    this.disposed=true;
    this.rejectPending(new Error('编谱会话已关闭'));
    this.publish();
  }

  private rejectPending(error:Error){for(const job of this.jobs.splice(0))job.reject(error);}
  private publish(){this.changed({...this.state,pending:this.jobs.length+(this.running?1:0)});}
  private async drain(){
    this.running=true;
    try{
      while(this.jobs.length&&!this.disposed){
        const job=this.jobs.shift()!;
        this.state.label=job.command.label;
        this.publish();
        try{
          // Give the browser an opportunity to display busy feedback before a synchronous WASM call.
          await this.yieldUI();
          if(this.disposed)throw new Error('编谱会话已关闭');
          if(!this.adapter.ready())throw new Error('乐谱引擎尚未就绪');
          if(!job.documentId||job.documentId!==this.adapter.documentId())throw new Error('乐谱已切换，请重新操作');
          if(job.command.kind==='save')await this.adapter.save();
          else{
            if((job.command.kind!=='action'||job.command.mutates)&&this.adapter.locked()){
              this.adapter.requestUnlock();throw new Error('请先解锁编辑');
            }
            if(job.command.kind==='pitch'){
              if(!this.adapter.pitch)throw new Error('音符输入核心尚未就绪');
              this.adapter.pitch(job.command);
            }else if(job.command.kind==='text'){
              if(!this.adapter.text)throw new Error('文本输入核心尚未就绪');
              this.adapter.text(job.command);
            }else if(job.command.kind==='edit'){
              if(!this.adapter.edit)throw new Error('编谱核心尚未就绪');
              this.adapter.edit(job.command.values);
            }else if(job.command.kind==='palette'){
              if(!this.adapter.palette?.(job.command.palette,job.command.cell))throw new Error('请先选中适合添加此记号的音符或小节');
            }else{
              const action=this.adapter.action(job.command.code);
              if(!action.known||!action.enabled)throw new Error('当前选区不能进行这项操作');
              this.adapter.dispatch(job.command.code);
            }
          }
          job.resolve(this.adapter.snapshot());
        }catch(value){
          const error=value instanceof Error?value:new Error(String(value));
          this.state.error=error.message;
          job.reject(error);
          // Subsequent input may depend on the failed operation; don't apply it to another cursor.
          this.rejectPending(error);
          break;
        }
      }
    }finally{
      this.running=false;this.state.label='';this.publish();
      for(const resolve of this.waiters.splice(0))resolve();
    }
  }
}
