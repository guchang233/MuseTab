/** Static catalog and immutable raw files. No GitHub REST requests or credentials. */
export const REPOSITORY = 'guchang233/muse-repo';
export const CATALOG_URL = 'https://raw.githubusercontent.com/' + REPOSITORY + '/main/catalog.json';
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export type CloudScore = { path: string; name: string; ext: 'mid' | 'mscz' | 'pdf'; size: number; sha: string; commit: string };
export type Catalog = { repo: string; branch: string; commit: string; updatedAt: number; scores: CloudScore[] };
const encodedPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const HASH = /^[a-f0-9]{40}$/i;
export async function fetchCatalog(): Promise<Catalog> {
  const response = await fetch(CATALOG_URL + '?v=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(response.status === 404 ? '曲库清单尚未发布，请稍后刷新' : '曲库文件服务暂时不可用（' + response.status + '），请稍后刷新');
  if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024) throw new Error('曲库清单过大');
  const text = await response.text();
  if (text.length > 4 * 1024 * 1024) throw new Error('曲库清单过大');
  let value: any;
  try { value = JSON.parse(text); } catch { throw new Error('曲库清单格式不正确，请稍后刷新'); }
  if (value.version !== 1 || value.repo !== REPOSITORY || !HASH.test(value.commit) || !Array.isArray(value.scores) || !Number.isFinite(value.updatedAt)) throw new Error('曲库清单版本或内容不正确');
  const seen = new Set<string>();
  const scores: CloudScore[] = value.scores.map((entry: any) => {
    if (typeof entry.path !== 'string' || entry.path.includes(String.fromCharCode(92)) || entry.path.split('/').some((part: string) => !part || part === '.' || part === '..') || seen.has(entry.path)) throw new Error('曲库清单中的路径不正确');
    const group = entry.path.split('/')[0].toLowerCase(), ext = entry.path.split('.').pop()?.toLowerCase();
    if (!entry.path.includes('/') || !['mid','mscz','pdf'].includes(group) || (ext !== group && !(group === 'mid' && ext === 'midi')) || !HASH.test(entry.sha) || !Number.isSafeInteger(entry.size) || entry.size < 1) throw new Error('曲库清单中的文件信息不正确');
    seen.add(entry.path);
    const filename = entry.path.split('/').pop()!;
    return { path: entry.path, name: filename.slice(0, filename.lastIndexOf('.')), ext: group, size: entry.size, sha: entry.sha, commit: value.commit };
  });
  return { repo: REPOSITORY, branch: String(value.branch || 'main'), commit: value.commit, updatedAt: value.updatedAt, scores: scores.sort((a,b) => a.name.localeCompare(b.name,'zh-CN')) };
}

export async function downloadScore(file: CloudScore, signal: AbortSignal, progress: (loaded: number) => void): Promise<File> {
  if (file.size > MAX_FILE_BYTES) throw new Error('这份曲谱超过 32 MB，暂不支持保存');
  const url = `https://raw.githubusercontent.com/${REPOSITORY}/${file.commit}/${encodedPath(file.path)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`下载失败（${res.status}），请刷新曲库后重试`);
  if (Number(res.headers.get('content-length')) > MAX_FILE_BYTES) throw new Error('文件超过 32 MB');
  const reader = res.body?.getReader();
  if (!reader) throw new Error('下载没有返回文件内容');
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_BYTES) throw new Error('文件超过 32 MB');
      parts.push(value); progress(size);
    }
  } catch (e) { await reader.cancel().catch(() => {}); throw e; }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  const prefix = new TextDecoder().decode(bytes.subarray(0, 120));
  if (prefix.startsWith('version https://git-lfs.github.com/')) throw new Error('这是 Git LFS 指针，请在仓库中直接上传曲谱文件');
  if ((file.ext === 'pdf' && !prefix.startsWith('%PDF-')) || (file.ext === 'mid' && !prefix.startsWith('MThd')) || (file.ext === 'mscz' && !(bytes[0] === 80 && bytes[1] === 75))) throw new Error('文件内容与格式不符，请检查仓库中的曲谱');
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const blob = new Uint8Array(header.length + bytes.length); blob.set(header); blob.set(bytes, header.length);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', blob)), v => v.toString(16).padStart(2, '0')).join('');
  if (hash !== file.sha) throw new Error('下载校验失败，请刷新曲库后重新保存');
  if (signal.aborted) throw new DOMException('下载已取消', 'AbortError');
  return new File([bytes], file.path.split('/').pop()!);
}
