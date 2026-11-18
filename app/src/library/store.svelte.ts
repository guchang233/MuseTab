// 谱匣：导入的乐谱保存在本机（IndexedDB），不上传任何地方。
import { unzipSync } from 'fflate';
import {pageCache} from '../reader/page-cache';

export type CloudSource = { repo: string; path: string; sha: string; commit: string; downloadedAt: number };
export type InkStroke = { points: [number, number][]; color: string; width: number };
export type PdfNotes = Record<number, InkStroke[]>;
export type ScoreRecord = {
  id: string;
  /** 文件名（不含扩展名） */
  name: string;
  /** 乐谱里的曲名，打开过一次后才知道 */
  title?: string;
  /** A local label chosen by the user; never changes the score's own title. */
  displayName?: string;
  ext: string;
  size: number;
  addedAt: number;
  openedAt: number;
  /** mscz 自带的缩略图（data URL） */
  cover?: string;
  source?: CloudSource;
  editedAt?: number;
};

export const SUPPORTED = ['mscz', 'mscx', 'musicxml', 'mxl', 'xml', 'mid', 'midi', 'pdf'];

const DB = 'musetab';
const META = 'scores';
const BLOBS = 'files';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(META)) req.result.createObjectStore(META, { keyPath: 'id' });
      if (!req.result.objectStoreNames.contains(BLOBS)) req.result.createObjectStore(BLOBS);
      if (!req.result.objectStoreNames.contains('annotations')) req.result.createObjectStore('annotations');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(stores, mode);
        const req = run(t);
        t.oncomplete = () => {d.close();resolve(req ? req.result : (undefined as T));};
        t.onerror = () => {d.close();reject(t.error);};
        t.onabort = () => {d.close();reject(t.error);};
      }),
  );
}

function coverOf(bytes: Uint8Array, ext: string): string | undefined {
  if (ext !== 'mscz') return undefined;
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === 'Thumbnails/thumbnail.png' });
    const png = files['Thumbnails/thumbnail.png'];
    if (!png) return undefined;
    let bin = '';
    for (let i = 0; i < png.length; i += 0x8000) bin += String.fromCharCode(...png.subarray(i, i + 0x8000));
    return 'data:image/png;base64,' + btoa(bin);
  } catch {
    return undefined;
  }
}

/**
 * 在同一个事务里读出库中的记录再写回。不能用内存里的旧快照覆盖：
 * 打开时记曲名（touch）可能和自动保存（replace，会把 MIDI 等改成 mscz）交错，
 * 用旧快照写回会把扩展名改回去，下次就按错误的格式打开。
 */
function merge(id: string, change: (rec: ScoreRecord) => ScoreRecord): Promise<boolean> {
  let found = false;
  return tx([META], 'readwrite', (t) => {
    const req = t.objectStore(META).get(id);
    req.onsuccess = () => {
      const rec = req.result as ScoreRecord | undefined;
      if (!rec) return;
      found = true;
      t.objectStore(META).put(change(rec));
    };
  }).then(() => found);
}

let records = $state<ScoreRecord[]>([]);
let loaded = $state(false);
let currentId = $state<string | null>(null);

async function refresh() {
  const all = await tx<ScoreRecord[]>([META], 'readonly', (t) => t.objectStore(META).getAll());
  records = all.sort((a, b) => (b.openedAt || b.addedAt) - (a.openedAt || a.addedAt));
  loaded = true;
}
refresh().catch(() => (loaded = true));

export const library = {
  get records() {
    return records;
  },
  get loaded() {
    return loaded;
  },
  get current(): ScoreRecord | undefined {
    return records.find((r) => r.id === currentId);
  },

  /** 导入一个文件；返回记录。不支持的格式抛错。 */
  async add(file: File, source?: CloudSource): Promise<ScoreRecord> {
    if(!file.size||file.size>32*1024*1024)throw new Error('请选择 32 MB 以内的乐谱文件');
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
    if (!SUPPORTED.includes(ext)) throw new Error(`暂不支持 .${ext || '?'} 文件`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const now = Date.now();
    const rec: ScoreRecord = {
      id: crypto.randomUUID(),
      name: dot >= 0 ? file.name.slice(0, dot) : file.name,
      ext,
      size: bytes.length,
      addedAt: now,
      openedAt: 0,
      cover: coverOf(bytes, ext),
      source,
    };
    await tx([META, BLOBS], 'readwrite', (t) => {
      t.objectStore(META).put(rec);
      t.objectStore(BLOBS).put(bytes, rec.id);
    });
    await refresh();
    return rec;
  },

  bytes(id: string): Promise<Uint8Array> {
    return tx<Uint8Array>([BLOBS], 'readonly', (t) => t.objectStore(BLOBS).get(id));
  },

  /** 标记为刚打开，并可顺带记下曲名 */
  async touch(id: string, patch: Partial<ScoreRecord> = {}) {
    currentId = id;
    if (!records.some((r) => r.id === id)) return;
    await merge(id, (rec) => ({ ...rec, ...patch, openedAt: Date.now() }));
    await refresh();
  },

  /** 用编辑后的内容覆盖已保存的文件（保存为 mscz） */
  async replace(id: string, bytes: Uint8Array) {
    if (!records.some((r) => r.id === id)) return;
    const cover = coverOf(bytes, 'mscz');
    await tx([META, BLOBS], 'readwrite', (t) => {
      const req = t.objectStore(META).get(id);
      req.onsuccess = () => {
        const rec = req.result as ScoreRecord | undefined;
        if (!rec) return;
        t.objectStore(META).put({ ...rec, ext: 'mscz', editedAt: Date.now(), size: bytes.length, cover: cover ?? rec.cover });
        t.objectStore(BLOBS).put(bytes, id);
      };
    });
    await refresh();
  },

  async remove(id: string) {
    await tx([META, BLOBS, 'annotations'], 'readwrite', (t) => {
      t.objectStore(META).delete(id);
      t.objectStore(BLOBS).delete(id);
      t.objectStore('annotations').delete(id);
    });
    if (currentId === id) currentId = null;
    await pageCache.removeScore(id);
    await refresh();
  },
  async rename(id:string,name:string){
    const displayName=name.trim();if(!displayName||displayName.length>240)throw Error('请输入 1–240 个字的名称');
    if(!await merge(id,rec=>({...rec,displayName})))throw Error('这份乐谱已不存在');
    await refresh();
  },
  async notes(id: string): Promise<PdfNotes> { return (await tx<PdfNotes>(['annotations'], 'readonly', t => t.objectStore('annotations').get(id))) || {}; },
  async saveNotes(id: string, notes: PdfNotes) { await tx(['annotations'], 'readwrite', t => { t.objectStore('annotations').put(notes, id); }); },
};
