// One Back press is consumed by exactly one active layer, independent of mount order.
type Handler={priority:number;order:number;run:()=>boolean};
const handlers=new Set<Handler>();let order=0;
export function registerBack(run:()=>boolean,priority=0){const entry={run,priority,order:++order};handlers.add(entry);return()=>{handlers.delete(entry);};}
export function handleLayerBack(){for(const entry of [...handlers].sort((a,b)=>b.priority-a.priority||b.order-a.order)){if(handlers.has(entry)&&entry.run())return true;}return false;}
