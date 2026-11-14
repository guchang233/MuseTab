// Derived page bitmaps only; this DB never stores or deletes library documents.
const NAME='musetab-page-cache',LIMIT=64*1024*1024;
type Entry={key:string;blob:Blob;used:number;size:number};let opening:Promise<IDBDatabase>|undefined;
function database(){return opening??=new Promise<IDBDatabase>((ok,no)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('pages',{keyPath:'key'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
async function operation<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await database();return new Promise((ok,no)=>{const t=db.transaction('pages',mode),r=run(t.objectStore('pages'));t.oncomplete=()=>ok(r.result);t.onabort=()=>no(t.error);t.onerror=()=>no(t.error);});}
export const pageCache={
 async removeScore(id:string){try{const entries=await operation<Entry[]>('readonly',s=>s.getAll()),db=await database();await new Promise<void>((ok,no)=>{const t=db.transaction('pages','readwrite');for(const entry of entries)if(entry.key.includes(':page3:'+id+':'))t.objectStore('pages').delete(entry.key);t.oncomplete=()=>ok();t.onabort=()=>no(t.error);});}catch{}},
 async get(key:string){try{const entry=await operation<Entry|undefined>('readonly',s=>s.get(key));if(!entry)return;void operation('readwrite',s=>s.put({...entry,used:Date.now()})).catch(()=>{});return entry.blob;}catch{return;}},
 async put(key:string,src:string){
  try{const bytes=Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:'image/png'});await operation('readwrite',s=>s.put({key,blob,size:blob.size,used:Date.now()}));
   const entries=await operation<Entry[]>('readonly',s=>s.getAll());let total=entries.reduce((n,e)=>n+e.size,0);if(total<=LIMIT)return;
   const db=await database(),t=db.transaction('pages','readwrite'),store=t.objectStore('pages');for(const e of entries.sort((a,b)=>a.used-b.used)){if(total<=LIMIT)break;store.delete(e.key);total-=e.size;}
  }catch{/* A full/disabled cache must not prevent reading or alter the source. */}
 }
};
