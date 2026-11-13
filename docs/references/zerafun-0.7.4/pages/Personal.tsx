import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import {
  loadHistory,
  historyCount,
  removeHistory,
  clearHistory,
  clearSearches,
  loadSearches,
  formatTime,
  formatDate,
  loadSettings,
  saveSettings,
} from "../store.mjs";
import { userData } from "../user-data.mjs";
import { contentControls } from '../content-controls.mjs';
import { Empty, PageHeader, Toggle } from "../components/ui";
import { useTitle, useUserData } from "../lib/hooks";
import { useContentControls } from '../lib/content-controls';
import BiliAccount from '../components/BiliAccount';
import AniChAccount from '../components/AniChAccount';
import { useApp } from '../lib/app';
import AccountVault from '../components/AccountVault';
import AppSettings, { AppearanceRow, Choice, SettingRow, SettingOptionContext } from '../components/AppSettings';
import { FanqieLoginButton, useFanqieMe } from '../components/FanqieAccount';
import { appInfo, inApp, isIos, isTv, type AppInfo } from '../lib/native';
import { directEnabled, setDirectEnabled } from '../lib/media-route';
import SourceConnectivity from '../components/SourceConnectivity';
import ComicAccounts from '../components/ComicAccounts';
import { cleanComicSettings } from '../comic-store.mjs';
const PROVIDERS: Record<string, string> = { zhuiju: "追剧", hongguo: "红果", bili: "B站", omofun: "Omofun", age: "AGE", kazumi: "Kazumi", jcy: "囧次元", anich: "AniCh" };
const KIND_NAMES: Record<string, string> = { video: "影视", comic: "漫画", novel: "小说" };
const COMIC_NAMES: Record<string, string> = { manshe: "漫舍", mangadex: "MangaDex", picacg: "哔咔", jm: "禁漫", eh: "E-Hentai", hitomi: "Hitomi", nhentai: "nhentai", wnacg: "紳士漫畫" };
const ADULT_PROVIDERS = new Set(["pornhub", "rule34", "hanime1", "missav", "picacg", "jm", "eh", "hitomi", "nhentai", "wnacg"]);
type Row = { kind: string; provider: string; id: string; title: string; cover: string; text: string; at: number; position: number; duration: number; to: string };
const clock = (seconds: number) => formatTime(seconds || 0);
function describe(e: any): Row {
  const base = { kind: e.kind, provider: e.provider, id: e.id, title: e.title || e.id, cover: e.cover || "", at: e.lastAt || 0, position: 0, duration: 0 };
  if (e.kind === "comic") {
    const chapter = e.lastKey ? "&chapter=" + encodeURIComponent(e.lastKey) + (e.lastLine ? "&line=" + encodeURIComponent(e.lastLine) : "") : "";
    return { ...base, text: (COMIC_NAMES[e.provider] || e.provider) + (e.lastName ? " · " + e.lastName : "") + (e.lastKey ? " · 第 " + (Math.floor(e.lastPosition || 0) + 1) + " 页" : ""), to: "/comics?id=" + encodeURIComponent(e.id) + "&source=" + encodeURIComponent(e.provider) + chapter };
  }
  if (e.kind === "novel") return { ...base, text: "番茄小说" + (e.lastName ? " · " + e.lastName : ""), to: "/novel/open/" + encodeURIComponent(e.id) };
  return {
    ...base, position: e.lastPosition || 0, duration: e.lastDuration || 0,
    text: (PROVIDERS[e.provider] || e.provider) + (e.lastName ? " · " + e.lastName : "") + " · " + (e.lastFinished ? "已看完" : clock(e.lastPosition) + (e.lastDuration ? " / " + clock(e.lastDuration) : "")),
    to: "/video/" + encodeURIComponent(e.provider + ":" + e.id),
  };
}
/** What was watched and read, newest first: videos, comics and novels in one list. */
export function History() {
  useTitle("记录 · ZeraFun");
  useUserData();
  const content = useContentControls();
  const [params, setParams] = useSearchParams();
  const kind = ["video", "comic", "novel"].includes(params.get("kind") || "") ? (params.get("kind") as string) : "";
  const [limit, setLimit] = useState(60);
  const all = userData.history({ kind: kind || undefined }).filter((e: any) => content.enabled || !ADULT_PROVIDERS.has(e.provider));
  const rows = all.slice(0, limit).map(describe);
  const counts = (k: string) => userData.history({ kind: k }).filter((e: any) => content.enabled || !ADULT_PROVIDERS.has(e.provider)).length;
  const status = userData.status();
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="记录">
        <button
          className="btn-ghost btn-sm"
          disabled={!all.length}
          onClick={() => { if (window.confirm(kind ? "清空全部" + KIND_NAMES[kind] + "记录？" : "清空全部观看和阅读记录？")) userData.hideAll(kind); }}
        >
          <Trash2 className="size-3.5" />
          清空
        </button>
      </PageHeader>
      <nav className="scroller gap-1.5" aria-label="记录类型">
        {[["", "全部"], ["video", "影视"], ["comic", "漫画"], ["novel", "小说"]].map(([key, label]) => (
          <button key={key} className={"chip shrink-0 " + (kind === key ? "chip-on" : "")} aria-pressed={kind === key} onClick={() => setParams(key ? { kind: key } : {}, { replace: true })}>
            {label}{key ? <span className="tab-count ml-1">{counts(key) > 99 ? "99+" : counts(key)}</span> : null}
          </button>
        ))}
      </nav>
      {status !== "synced" && status !== "syncing" && (
        <p role="status" className="text-xs text-muted">{SYNC_TEXT[status]}{userData.pending() ? "（" + userData.pending() + " 条待上传）" : ""}</p>
      )}
      {!rows.length ? (
        <Empty>{kind ? "还没有" + KIND_NAMES[kind] + "记录。" : "还没有观看或阅读记录。"}</Empty>
      ) : (
        <ul className="history-list divide-y divide-line border-y border-line">
          {rows.map((r) => {
            const percent = r.duration ? Math.min(100, (100 * r.position) / r.duration) : 0;
            return (
              <li key={r.kind + ":" + r.provider + ":" + r.id} className="group flex items-center gap-3 py-3">
                <Link to={r.to} data-nav-id={"history:" + r.kind + ":" + r.provider + ":" + r.id} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg">
                  <span className="poster-fallback h-[76px] w-[51px] shrink-0 overflow-hidden rounded-md">
                    {r.cover && <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.hidden = true; }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <h2 className="line-clamp-1 text-sm font-medium group-hover:underline group-hover:underline-offset-4">{r.title}</h2>
                    <span className="mt-0.5 block text-xs text-muted">{kind ? "" : KIND_NAMES[r.kind] + " · "}{r.text}</span>
                    {percent > 0 && (
                      <span className="mt-2 block h-0.5 max-w-60 overflow-hidden rounded-full bg-soft">
                        <span className="block h-full bg-accent" style={{ width: percent + "%" }} />
                      </span>
                    )}
                  </span>
                  {r.at > 0 && <span className="hidden shrink-0 text-xs text-faint sm:block">{formatDate(r.at)}</span>}
                </Link>
                <button className="icon-btn shrink-0 text-faint" aria-label={"删除" + r.title} onClick={() => userData.hide(r.kind, r.provider, r.id)}>
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > rows.length && (
        <div className="flex justify-center">
          <button className="btn-ghost btn-sm" onClick={() => setLimit((n) => n + 60)}>显示更多（还有 {all.length - rows.length} 条）</button>
        </div>
      )}
    </div>
  );
}
const SYNC_TEXT: Record<string, string> = {
  local: "未登录，只保存在本机",
  syncing: "正在同步…",
  synced: "已同步到账号",
  pending: "有修改等待上传",
  offline: "暂时连不上账号服务，修改已保存在本机，恢复后自动上传",
  "signed-out": "登录已失效，重新登录后自动上传",
};

const SKIPS = [0, 30, 60, 90, 120];
type SettingEntry = { id: string; title: string; detail?: string; content: ReactNode };
function FanqieSettings() {
  const { me, reload } = useFanqieMe();
  return <SettingRow title="番茄小说" detail={me?.loggedIn ? me.name || "已登录" : "未登录"}><FanqieLoginButton me={me} reload={reload} /></SettingRow>;
}
function ComicPreference({ option }: { option: string }) {
  useUserData();
  const prefs = cleanComicSettings(userData.setting("comic-reader") || {}) as { mode: string; direction: string; width: number; background: string; perScreen: number };
  const set = (patch: Record<string, unknown>) => userData.saveSetting("comic-reader", cleanComicSettings({ ...prefs, ...patch }));
  const definitions: Record<string, { title: string; value: string; options: { id: string; label: string }[]; change: (v: string) => void; detail?: string }> = {
    mode: { title: "阅读方式", value: prefs.mode, options: [{ id: "scroll", label: "连续" }, { id: "page", label: "逐页" }], change: mode => set({ mode }) },
    direction: { title: "翻页方向", value: prefs.direction, options: [{ id: "ltr", label: "从左到右" }, { id: "rtl", label: "从右到左" }], change: direction => set({ direction }), detail: "逐页阅读时生效" },
    pages: { title: "每屏页数", value: String(prefs.perScreen), options: [1, 2, 3, 4].map(n => ({ id: String(n), label: n + " 页" })), change: v => set({ perScreen: Number(v) }), detail: "逐页阅读时生效" },
    width: { title: "阅读宽度", value: String(prefs.width), options: [640, 768, 960, 1280].map(n => ({ id: String(n), label: String(n) })), change: v => set({ width: Number(v) }), detail: "连续阅读时生效" },
    background: { title: "阅读背景", value: prefs.background, options: [{ id: "paper", label: "跟随主题" }, { id: "sepia", label: "暖纸色" }, { id: "dark", label: "深色" }], change: background => set({ background }) },
  };
  const row = definitions[option];
  return <SettingRow title={row.title} detail={row.detail}><Choice label={row.title} value={row.value} options={row.options} onChange={row.change} /></SettingRow>;
}
const SECTIONS = [
  { id: "account", title: "账号", detail: "本站与平台登录、凭据和设备" },
  { id: "sync", title: "同步与数据", detail: "同步状态、记录和搜索" },
  { id: "play", title: "播放", detail: "播放进度、跳过片头与片尾" },
  { id: "read", title: "阅读", detail: "漫画阅读方式、翻页和背景" },
  { id: "app", title: "应用与外观", detail: "主题与本机应用设置" },
  { id: "content", title: "内容与网络", detail: "连通性检测与内容偏好" },
];
export function Settings() {
  useTitle("设置 · ZeraFun");
  const { user, logout } = useApp();
  const [params] = useSearchParams();
  const section = SECTIONS.find(row => row.id === params.get("tab"));
  const tab = section?.id || "";
  const settings = loadSettings() as Record<string, any>;
  useUserData();
  const content = useContentControls();
  const [notice, setNotice] = useState("");
  const [nativeInfo, setNativeInfo] = useState<AppInfo | null>(null);
  useEffect(() => { if (inApp) void appInfo().then(setNativeInfo); }, []);
  const [direct, setDirect] = useState(directEnabled);
  const pageRef = useRef<HTMLDivElement>(null);
  const status = userData.status(), pending = userData.pending();
  const flash = (text: string) => { setNotice(text); };
  const set = (patch: Record<string, unknown>) => saveSettings(patch);
  const skipOptions = SKIPS.map(n => ({ id: String(n), label: n ? n + " 秒" : "关闭" }));
  const nativeOption = (id: string) => <SettingOptionContext.Provider value={id}><AppSettings /></SettingOptionContext.Provider>;
  const entries: Record<string, SettingEntry[]> = {
    account: [
      { id: "site", title: "本站账号", detail: user?.username || "未登录", content: <SettingRow title={user ? "GCbbs · " + user.username : "本站账号"} detail="收藏、记录和设置跟随本站账号">
        {!inApp && <a className="btn-ghost btn-sm" href="https://www.zeraphym.cyou/" target="_blank" rel="noreferrer">打开论坛 ↗</a>}
        {user ? <button className="btn-danger btn-sm" onClick={() => void logout()}>退出登录</button> : <Link className="btn-ghost btn-sm" to="/login?next=%2Fsettings%3Ftab%3Daccount%26item%3Dsite">登录账号</Link>}
      </SettingRow> },
      { id: "bili", title: "B站", content: <BiliAccount row /> },
      { id: "anich", title: "AniCh", content: <AniChAccount row /> },
      { id: "fanqie", title: "番茄小说", content: <FanqieSettings /> },
      ...["jm", "picacg"].map((id) => ({ id, title: id === "jm" ? "禁漫账号" : "哔咔账号", content: <ComicAccounts source={id} /> })),
      ...(!inApp ? [
        { id: "hongguo", title: "红果", content: <SettingRow title="红果" detail="账号与播放权限由原站管理"><a className="btn-ghost btn-sm" href="https://hongguoduanju.com/" target="_blank" rel="noreferrer">官网 ↗</a></SettingRow> },
        { id: "jcy", title: "囧次元", content: <SettingRow title="囧次元" detail="原站尚未提供 HTTPS 登录服务，请在原客户端登录" /> },
      ] : []),
      { id: "vault", title: "凭据与设备", detail: "已保存的平台、登录过的设备", content: user ? <AccountVault compact={inApp} /> : <SettingRow title="凭据与设备" detail="登录本站账号后管理"><Link className="btn-ghost btn-sm" to="/login?next=%2Fsettings%3Ftab%3Daccount%26item%3Dvault">登录</Link></SettingRow> },
    ],
    sync: [
      { id: "status", title: "同步状态", detail: SYNC_TEXT[status], content: <SettingRow title="同步状态" detail={SYNC_TEXT[status] + (pending ? `（${pending} 条待上传）` : "")}><button className="btn-ghost btn-sm" disabled={!user || status === "syncing"} onClick={() => void userData.sync()}>立即同步</button></SettingRow> },
      { id: "history", title: "观看记录", detail: `当前 ${historyCount()} 部`, content: <SettingRow title="观看记录" detail={`当前 ${historyCount()} 部`}><Link className="btn-ghost btn-sm" to="/history">查看</Link><button className="btn-danger btn-sm" onClick={() => { if (window.confirm("清空观看记录？")) { clearHistory(); flash("观看记录已清空"); } }}>清空</button></SettingRow> },
      { id: "search", title: "最近搜索", detail: `当前 ${loadSearches().length} 条`, content: <SettingRow title="最近搜索"><button className="btn-danger btn-sm" onClick={() => { if (window.confirm("清除最近搜索？")) { clearSearches(); flash("最近搜索已清除"); } }}>清除</button></SettingRow> },
      ...(!inApp && user ? [{ id: "export", title: "导出数据", content: <SettingRow title="导出数据" detail="收藏、记录、进度、搜索和设置（JSON）"><a className="btn-ghost btn-sm" href={userData.exportUrl()} download>导出</a></SettingRow> }] : []),
    ],
    play: [
      ...[["autoplay", "自动播放下一集"], ["remember", "记住播放进度"]].map(([id, title]) => ({ id, title, detail: settings[id] ? "已开启" : "已关闭", content: <SettingRow title={title}><Toggle label={title} checked={!!settings[id]} onChange={value => set({ [id]: value })} /></SettingRow> })),
      { id: "direct", title: "直连源站播放", detail: direct ? "已开启" : "已关闭", content: <SettingRow title="直连源站播放" detail="失败时自动改走本站中转"><Toggle label="直连源站播放" checked={direct} onChange={value => { setDirectEnabled(value); setDirect(value); }} /></SettingRow> },
      ...[["skipIntro", "跳过片头"], ["skipOutro", "跳过片尾"]].map(([id, title]) => ({ id, title, detail: settings[id] ? settings[id] + " 秒" : "关闭", content: <SettingRow title={title}><Choice label={title} value={String(settings[id] || 0)} options={skipOptions} onChange={value => set({ [id]: Number(value) })} /></SettingRow> })),
      ...(!inApp ? [{ id: "keys", title: "键盘快捷键", content: <SettingRow title="键盘快捷键" detail="空格 / K 暂停，← → 快退快进 5 秒，↑ ↓ 音量，F 全屏，M 静音，N / P 下一集 / 上一集；输入文字时不触发" /> }] : []),
    ],
    read: [["mode", "阅读方式"], ["direction", "翻页方向"], ["pages", "每屏页数"], ["width", "阅读宽度"], ["background", "阅读背景"]].map(([id, title]) => ({ id, title, content: <ComicPreference option={id} /> })),
    app: [
      { id: "appearance", title: "外观", content: <AppearanceRow /> },
      ...(inApp ? (isIos ? [["version", "版本信息"], ["server", "站点地址"], ["cache", "清除缓存"]] : [["version", "版本与更新"], ["update", "自动检查更新"], ["mode", "界面模式"], ...(isTv ? [["scale", "界面大小"]] : []), ["engine", "浏览器内核"], ...(nativeInfo?.nativeVideoAvailable ? [["player", "播放器"]] : []), ["cache", "清除缓存"], ...(isTv ? [["exit", "退出应用"]] : [])]).map(([id, title]) => ({ id, title, content: nativeOption(id) })) : []),
    ],
    content: [
      { id: "connectivity", title: "漫画源连通性", content: <SourceConnectivity /> },
      { id: "adult", title: "启用成人内容", detail: content.enabled ? "已开启" : "默认关闭", content: <SettingRow title="启用成人内容" detail="关闭时隐藏成人内容及相关收藏"><Toggle label="启用成人内容" checked={content.enabled} onChange={value => contentControls.setEnabled(value, user?.id)} /></SettingRow> },
    ],
  };
  const options = entries[tab] || [];
  const selected = options.find(row => row.id === params.get("item"));
  const routeKey = tab + ":" + (selected?.id || "");
  useEffect(() => {
    setNotice("");
    // TV: a new list must never leave focus on the now-unmounted previous row.
    const timer = requestAnimationFrame(() => {
      if (isTv) (pageRef.current?.querySelector<HTMLElement>(".settings-menu-row") || pageRef.current?.querySelector<HTMLElement>("[data-setting-back]"))?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [routeKey]);
  const parent = selected ? "/settings?tab=" + tab : tab ? "/settings" : "/video";
  return <div ref={pageRef} className="settings-page settings-drilldown mx-auto max-w-3xl">
    <header className="settings-topbar">
      <Link data-setting-back className="btn-ghost btn-sm" to={parent} aria-label={selected ? "返回" + section?.title : tab ? "返回设置" : "退出设置"}><ChevronLeft className="size-4" />返回</Link>
      <h1>{selected?.title || section?.title || "设置"}</h1>
      {tab && <Link className="settings-close icon-btn" aria-label="退出设置" to="/video"><X className="size-4" /></Link>}
    </header>
    {tab && <p className="settings-path text-xs text-muted">设置 / {section?.title}{selected ? " / " + selected.title : ""}</p>}
    {!selected ? <nav className="settings-menu" aria-label={section ? section.title + "设置选项" : "设置分类"}>
      {(section ? options : SECTIONS).map((row, index) => <Link data-autofocus={index === 0 ? true : undefined} key={row.id} className="settings-menu-row" data-nav-id={"setting:" + tab + ":" + row.id} to={section ? `/settings?tab=${tab}&item=${row.id}` : `/settings?tab=${row.id}`}>
        <span className="min-w-0"><span className="settings-menu-title">{row.title}</span>{row.detail && <span className="settings-menu-detail">{row.detail}</span>}</span><ChevronRight className="size-4 shrink-0 text-faint" />
      </Link>)}
    </nav> : <div key={routeKey} className="settings-detail" aria-label={selected.title + "设置"}>{selected.content}</div>}
    {notice && <p role="status" className="mt-4 text-xs text-ok">{notice}</p>}
  </div>;
}
