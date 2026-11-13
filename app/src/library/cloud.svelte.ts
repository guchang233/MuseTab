import { fetchCatalog, downloadScore, REPOSITORY, type Catalog, type CloudScore } from './github';
import { library } from './store.svelte';

const KEY = 'musetab.cloud.v1';
let catalog = $state<Catalog | null>(null);
try { const cached = JSON.parse(localStorage.getItem(KEY) || 'null'); if (cached?.repo === REPOSITORY && Array.isArray(cached.scores)) catalog = cached; } catch { /* Fresh install or unavailable cache. */ }
let refreshing = $state(false), error = $state(''), saving = $state(''), received = $state(0);
let controller: AbortController | undefined;
let attempted = false;
export const cloud = {
  get catalog() { return catalog; }, get refreshing() { return refreshing; }, get error() { return error; },
  get saving() { return saving; }, get received() { return received; },
  saved(file: CloudScore) { return library.records.find(r => r.source?.repo === REPOSITORY && r.source.path === file.path && r.source.sha === file.sha); },
  ensure() { if (!attempted) void this.refresh(); },
  async refresh() {
    if (refreshing) return;
    attempted = true; refreshing = true; error = '';
    try { catalog = await fetchCatalog(); try { localStorage.setItem(KEY, JSON.stringify(catalog)); } catch { /* Catalog remains available in memory. */ } }
    catch (e) { error = e instanceof TypeError ? '连接曲库失败，请检查网络后重试；缓存列表和本地谱匣仍可使用' : e instanceof Error && e.name === 'TimeoutError' ? '连接曲库超时，请稍后刷新' : e instanceof Error ? e.message : '连接曲库失败，请检查网络后重试'; }
    finally { refreshing = false; }
  },
  async save(file: CloudScore) {
    if (saving || this.saved(file)) return;
    saving = file.path; received = 0; error = '';
    controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), 120000);
    try {
      const downloaded = await downloadScore(file, controller.signal, n => received = n);
      await library.add(downloaded, { repo: REPOSITORY, path: file.path, sha: file.sha, commit: file.commit, downloadedAt: Date.now() });
    } catch (e) { error = e instanceof Error && e.name === 'AbortError' ? '下载已取消或超时，可以重新保存' : e instanceof Error ? e.message : '保存失败，请重试'; }
    finally { clearTimeout(timer); saving = ''; controller = undefined; }
  },
  cancel() { controller?.abort(); },
};
