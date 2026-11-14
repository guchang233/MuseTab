import {tick} from 'svelte';
let message=$state('');
const pending=new Map<string,Promise<unknown>>();
let tail:Promise<unknown>=Promise.resolve();
/** Paint feedback before entering a synchronous native call; serialize mutations. */
export const activity={
  get message(){return message;},
  run<T>(label:string,task:()=>T|Promise<T>,key=label):Promise<T>{
    const previous=pending.get(key);if(previous)return previous as Promise<T>;
    const operation=tail.catch(()=>{}).then(async()=>{
      message=label;await tick();
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      try{return await task();}finally{message='';pending.delete(key);}
    });
    pending.set(key,operation);tail=operation;return operation;
  },
};
