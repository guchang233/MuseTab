import "./lib/polyfills";
import { installWheelScroll } from "./lib/wheel-scroll";
installWheelScroll();
import { useEffect, useLayoutEffect, useRef, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Link, NavLink, useLocation, useNavigate, useNavigationType, Navigate, Outlet } from "react-router-dom";
import { Clapperboard, Download, History as HistoryIcon, Settings as SettingsIcon, BookOpen, BookMarked, Bookmark, Search, UserRound } from "lucide-react";
import Video from "./pages/Video";
import VideoDetail from "./pages/VideoDetail";
import DownloadPage from "./pages/Download";
import Comics from "./pages/Comics";
import Favorites from "./pages/Favorites";
import Novel from "./pages/Novel";
import NovelBook, { NovelOpen } from "./pages/NovelBook";
import NovelReader from "./pages/NovelReader";
import NovelShelf from "./pages/NovelShelf";
import { NovelMessages, NovelCommunity } from "./pages/NovelSocial";
import { History, Settings } from "./pages/Personal";
import { ErrorBox, Loading } from "./components/ui";
import { SiteNotice, Maintenance } from "./components/SiteNotice";
import { loadSiteConfig, useSiteConfig } from "./lib/site-config";
import { AppProvider, useApp } from "./lib/app";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { AccountMenu } from "./components/AccountMenu";
import { appForm, inApp, isIos, isTv, onNative, setRouterBack, tvScale } from "./lib/native";
import { installTvNavigation, focusElement, restoreFocus } from "./lib/tv-nav";
import { useDark } from "./lib/theme";
import { TabActiveContext } from "./lib/hooks";
import { PUBLIC_BROWSING } from '../shared/access-policy.mjs';

// ---- app-mode bootstrap (before the first render, so nothing flashes) -------------------------
if (appForm) {
  const root = document.documentElement;
  root.dataset.app = appForm;
  const viewport = document.querySelector('meta[name="viewport"]');
  // TV: render at a smaller CSS width so text and focus targets read from the sofa.
  viewport?.setAttribute("content", isTv
    ? `width=${Math.round((screen.width || 1280) / tvScale())}, user-scalable=no`
    : "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
  if (isTv) installTvNavigation();
}

function RequireAccount() {
  const { user, ready, error, refreshMe } = useApp(), route = useLocation(), config = useSiteConfig();
  // Maintenance is decided per account (admins pass), so re-read the config when the account changes.
  useEffect(() => { if (ready) void loadSiteConfig(true); }, [ready, user?.id]);
  if (config.maintenance && !config.maintenance.bypass) return <Maintenance message={config.maintenance.message} />;
  if (PUBLIC_BROWSING) return <Outlet />;
  if (!ready) return <Loading text="正在确认 GCbbs 登录状态…" />;
  if (!user && error) return <ErrorBox error={error} onRetry={() => void refreshMe()} />;
  if (!user) return <Navigate replace to={"/login?next=" + encodeURIComponent(route.pathname + route.search)} />;
  return <>{error && <p role="status" className="mb-4 rounded-lg border border-line px-3 py-2 text-xs text-muted">账号服务暂时无法连接，正在保留本页；恢复后会自动确认登录状态。</p>}<Outlet /></>;
}
class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError() { return { error: "页面暂时无法显示，请刷新重试" }; }
  render() { return this.state.error ? <ErrorBox error={this.state.error} onRetry={() => location.reload()} /> : this.props.children; }
}
const NAV = [
  { to: "/video", label: "在线观看", short: "观看", Icon: Clapperboard },
  { to: "/novel", label: "小说", short: "小说", Icon: BookMarked },
  { to: "/comics", label: "漫画", short: "漫画", Icon: BookOpen },
  { to: "/favorites", label: "收藏", short: "收藏", Icon: Bookmark },
  { to: "/history", label: "记录", short: "记录", Icon: HistoryIcon },
  { to: "/download", label: "下载 App", short: "App", Icon: Download },
];
// In the app: no download page, settings is a tab, and the TV rail also offers search.
const PHONE_TABS = [
  { to: "/video", label: "观看", Icon: Clapperboard },
  { to: "/novel", label: "小说", Icon: BookMarked },
  { to: "/comics", label: "漫画", Icon: BookOpen },
  { to: "/favorites", label: "收藏", Icon: Bookmark },
  { to: "/history", label: "记录", Icon: HistoryIcon },
  { to: "/settings", label: "我的", Icon: UserRound },
];
const TV_RAIL = [
  { to: "/video?focus=search", match: "", label: "搜索", Icon: Search },
  { to: "/video", label: "观看", Icon: Clapperboard },
  { to: "/novel", label: "小说", Icon: BookMarked },
  { to: "/comics", label: "漫画", Icon: BookOpen },
  { to: "/favorites", label: "收藏", Icon: Bookmark },
  { to: "/history", label: "记录", Icon: HistoryIcon },
  { to: "/settings", label: "设置", Icon: SettingsIcon },
];
const TOP_LEVEL = ["/", "/video", "/novel", "/comics", "/favorites", "/history", "/settings"];

/** The tabs. Each one keeps its pages (and what is open in them) while another tab is shown. */
const TAB_PATHS = ["/video", "/novel", "/comics", "/favorites", "/history", "/settings"];
const tabOf = (pathname: string) => {
  if (pathname === "/") return "/video";
  const first = "/" + pathname.split("/")[1];
  return TAB_PATHS.includes(first) ? first : null;
};
// Where each tab was last left (path + query), so its link returns to it. Clicking the tab you are on starts it over.
const tabLast = new Map<string, string>();
const tabHref = (to: string, current: string | null) => (to.includes("?") || to === current ? to : tabLast.get(to) || to);
// The routes of one tab. Keys follow the tab's own location, so a page kept in the background is not rebuilt by what happens elsewhere.
function tabRoutes(tab: string, at: { pathname: string }) {
  const key = at.pathname;
  switch (tab) {
    case "/video":
      return (
        <Route element={<RequireAccount />}>
          <Route path="/" element={<Video />} />
          <Route path="/video" element={<Video />} />
          <Route path="/video/:id" element={<VideoDetail key={key} />} />
        </Route>
      );
    case "/novel":
      return (
        <>
          <Route path="/novel" element={<Novel />} />
          <Route path="/novel/book/:id" element={<NovelBook key={key} />} />
          <Route path="/novel/open/:id" element={<NovelOpen key={key} />} />
          <Route path="/novel/read/:itemId" element={<NovelReader key={key} />} />
          <Route path="/novel/shelf" element={<NovelShelf />} />
          <Route path="/novel/messages" element={<NovelMessages />} />
          <Route path="/novel/community" element={<NovelCommunity />} />
        </>
      );
    case "/history":
      return <Route element={<RequireAccount />}><Route path="/history" element={<History />} /></Route>;
    case "/settings":
      return <Route element={<RequireAccount />}><Route path="/settings" element={<Settings />} /></Route>;
    case "/comics":
      return <Route element={<RequireAccount />}><Route path="/comics" element={<Comics />} /></Route>;
    default:
      return <Route element={<RequireAccount />}><Route path="/favorites" element={<Favorites />} /></Route>;
  }
}
// Set while a tab is shown for the first time, read by useScrollMemory (a tab shown again resumes its scroll).
let tabFresh = true;

function AppRoutes() {
  const route = useLocation(), { user } = useApp(), tab = tabOf(route.pathname);
  const seen = useRef(new Map<string, ReturnType<typeof useLocation>>()), owner = useRef<number | string | null>(null);
  // Signing out (or into another account) throws the kept pages away: they hold the previous account's data.
  const uid = user?.id ?? null;
  if (owner.current != null && uid != null && owner.current !== uid) { seen.current.clear(); tabLast.clear(); }
  if (uid != null) owner.current = uid;
  tabFresh = !tab || !seen.current.has(tab);
  if (tab) { seen.current.set(tab, route); tabLast.set(tab, route.pathname === "/" ? "/video" : route.pathname + route.search); }
  return (
    <>
      <SiteNotice />
      {[...seen.current].map(([name, at]) => (
        <div key={name} hidden={name !== tab}>
          <TabActiveContext.Provider value={name === tab}>
            <Boundary key={name}><Routes location={name === tab ? route : at}>{tabRoutes(name, name === tab ? route : at)}</Routes></Boundary>
          </TabActiveContext.Provider>
        </div>
      ))}
      {!tab && (
        <Boundary key={route.pathname}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/download" element={inApp && !isIos ? <Navigate replace to="/settings" /> : <DownloadPage />} />
            <Route path="/sources" element={<Navigate replace to="/video" />} />
            <Route path="*" element={<ErrorBox error="这个页面不存在" />} />
          </Routes>
        </Boundary>
      )}
    </>
  );
}

function WebChrome() {
  // The novel reader has its own top and bottom menus and fills the window.
  const path = useLocation().pathname, bookPage = path.startsWith("/novel/book/"), authPage = path === "/login" || path === "/register";
  if (path.startsWith("/novel/read/")) return <main className="page-main"><AppRoutes /></main>;
  return (
    <>
      <header className="site-header sticky top-0 z-40 border-b border-line">
        <div className="site-container flex h-16 items-center gap-8">
          <Link to="/video" className="flex shrink-0 items-center gap-1.5" aria-label="ZeraFun首页">
            <img src="/brand/mark-white.png" alt="" className="hidden h-7 dark:block" />
            <img src="/brand/mark-black.png" alt="" className="h-7 dark:hidden" />
            <span className="hidden sm:contents">
              <img src="/brand/wordmark-white.png" alt="ZeraFun" className="hidden h-4 dark:block" />
              <img src="/brand/wordmark-black.png" alt="ZeraFun" className="h-4 dark:hidden" />
            </span>
          </Link>
          <nav className="hidden h-full min-w-0 flex-1 items-stretch gap-6 text-sm lg:flex" aria-label="主导航">
            {NAV.map(({ to, label }) => <NavLink key={to} to={tabHref(to, tabOf(path))} className="tab-link flex items-center whitespace-nowrap font-medium">{label}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className={bookPage ? "page-main min-h-[75vh] pb-28" : "page-main site-content site-container min-h-[75vh] pb-28 lg:pb-16"}><AppRoutes /></main>
      {!bookPage && <footer className="site-footer site-container hidden items-center justify-between gap-3 border-t border-line py-6 text-xs text-faint lg:flex">
        <span>ZeraFun</span>
        <span className="flex items-center gap-4">
          <Link to="/download" className="hover:text-ink">手机客户端</Link>
        </span>
      </footer>}
      {!bookPage && !authPage && <nav className="tabbar glass fixed inset-x-0 bottom-0 z-40 flex border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="底部导航">
        {NAV.map(({ to, short, Icon }) => (
          <NavLink key={to} to={tabHref(to, tabOf(path))} className="flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-faint">
            <Icon className="size-5" strokeWidth={1.75} />{short}
          </NavLink>
        ))}
      </nav>}
    </>
  );
}

/** Phone app: content plus a bottom tab bar; detail and login pages use the full screen. */
function PhoneChrome() {
  const route = useLocation(), bare = route.pathname.startsWith("/video/") || route.pathname.startsWith("/novel/read/") || route.pathname.startsWith("/novel/book/") || route.pathname === "/login" || route.pathname === "/register";
  return (
    <>
      <main className={route.pathname.startsWith("/novel/read/") ? "page-main" : "page-main px-4 pt-4 " + (bare ? "pb-8" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))]")}><AppRoutes /></main>
      {!bare && (
        <nav className="app-tabbar fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]" aria-label="底部导航">
          {PHONE_TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={tabHref(to, tabOf(route.pathname))} replace className="flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-faint">
              <Icon className="size-[22px]" strokeWidth={1.75} />{label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}

/** TV app: a left rail moved by the remote and a roomy content area. */
function TvChrome() {
  const route = useLocation(), bare = route.pathname === "/login" || route.pathname === "/register";
  const current = (to: string) => { const path = to.split("?")[0]; return route.pathname === path || ((path === "/video" || path === "/novel") && route.pathname.startsWith(path + "/")); };
  return (
    <>
      {!bare && (
        <nav data-tv-rail className="tv-rail fixed inset-y-0 left-0 z-40 flex w-[88px] flex-col items-center gap-1.5 border-r border-line bg-paper py-6" aria-label="主导航">
          <img src="/brand/mark-white.png" alt="ZeraFun" className="mb-5 hidden h-7 dark:block" />
          <img src="/brand/mark-black.png" alt="ZeraFun" className="mb-5 h-7 dark:hidden" />
          {TV_RAIL.map(({ to, label, Icon }) => {
            const on = !to.includes("?") && current(to);
            return (
              <Link key={to} to={tabHref(to, tabOf(route.pathname))} replace data-nav-id={"rail:" + to} aria-current={on ? "page" : undefined} className="tv-rail-item">
                <Icon className="size-[22px]" strokeWidth={1.75} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <main className={"page-main min-h-screen py-6 pr-8 " + (bare ? "pl-8" : "pl-[120px]")}><AppRoutes /></main>
    </>
  );
}

// Scroll position per page, so "back" returns to where the list was (new pages still start at the top).
const scrollMemory = new Map<string, number>();
function useScrollMemory(path: string) {
  const current = useRef(path), pop = useNavigationType() === "POP", restoring = useRef(false), lastTab = useRef<string | null | undefined>(undefined);
  // Switch the page being recorded before the browser reports the next scroll. Until the new page has
  // been put back where it was, the browser's clamped scroll position is not its own.
  useLayoutEffect(() => { current.current = path; restoring.current = true; }, [path]);
  useEffect(() => {
    const save = () => { if (!restoring.current) scrollMemory.set(current.current, window.scrollY); };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);
  useEffect(() => {
    const tab = tabOf(path.split("?")[0]), switched = lastTab.current !== tab;
    lastTab.current = tab;
    if (isTv) { restoring.current = false; restoreFocus(path); return; }
    // Back/forward, and a tab shown again (its page was kept), resume the scroll position.
    const resume = pop || (tab !== null && switched && !tabFresh);
    const target = resume ? scrollMemory.get(path) || 0 : 0;
    if (!target) { window.scrollTo(0, 0); restoring.current = false; return; }
    // Lists render from the cache at once, or after their request: wait until the page is tall enough.
    let tries = 0, stop = false;
    const cancel = () => { stop = true; };
    window.addEventListener("wheel", cancel, { passive: true, once: true });
    window.addEventListener("touchstart", cancel, { passive: true, once: true });
    const attempt = () => {
      if (stop) return;
      if (document.documentElement.scrollHeight - window.innerHeight >= target - 4 || ++tries > 60) { window.scrollTo(0, target); restoring.current = false; return; }
      window.setTimeout(attempt, 50);
    };
    attempt();
    return () => { stop = true; restoring.current = false; window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); };
  }, [path]);
}

function App() {
  const route = useLocation(), navigate = useNavigate();
  useDark();
  const path = route.pathname + route.search;
  useScrollMemory(path);
  // Back key: overlays first (handled in lib/native), then up one page, then the home tab, then exit.
  useEffect(() => {
    setRouterBack(() => {
      const p = route.pathname;
      if (p === "/login") return false;
      if (p === "/register") { navigate("/login" + route.search, { replace: true }); return true; }
      // Novel pages follow the history (chapter changes replace it), so back returns to where the reader came from.
      if (p.startsWith("/novel/") && (window.history.state?.idx ?? 0) > 0) { navigate(-1); return true; }
      if (p.startsWith("/novel/read/")) {
        const bookId = new URLSearchParams(route.search).get("bookId");
        if (bookId && /^\d{6,25}$/.test(bookId)) { navigate("/novel/book/" + bookId, { replace: true }); return true; }
        navigate("/novel", { replace: true }); return true;
      }
      if (p.startsWith("/novel/")) { navigate("/novel", { replace: true }); return true; }
      if (p === "/settings" && route.search) {
        const query = new URLSearchParams(route.search);
        navigate(query.has("item") && query.has("tab") ? "/settings?tab=" + query.get("tab") : "/settings", { replace: true });
        return true;
      }
      if (TOP_LEVEL.includes(p)) {
        if (route.search && (p === "/video" || p === "/novel")) { navigate(p, { replace: true }); return true; }
        if (p !== "/video" && p !== "/") { navigate("/video", { replace: true }); return true; }
        return false;
      }
      if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
      else navigate("/video", { replace: true });
      return true;
    });
  }, [route.pathname, route.search, navigate]);
  // Remote keys the page can't see as keyboard events. Pages (the player) may claim them first.
  useEffect(() => onNative("key", (key: string) => {
    const claimed = !window.dispatchEvent(new CustomEvent("gcapp-key", { detail: key, cancelable: true }));
    if (claimed) return;
    if (key === "menu" && isTv) {
      const rail = document.querySelector<HTMLElement>('[data-tv-rail] [aria-current="page"]') || document.querySelector<HTMLElement>("[data-tv-rail] a");
      if (rail) focusElement(rail);
    } else if (key === "next" || key === "previous") {
      window.scrollBy({ top: (key === "next" ? 1 : -1) * window.innerHeight * 0.8, behavior: "smooth" });
    }
  }), []);
  return appForm === "tv" ? <TvChrome /> : appForm === "phone" ? <PhoneChrome /> : <WebChrome />;
}

// Keep previously shared #download / #hongguo bookmarks usable after replacing the old shell.
const old = location.hash.slice(1);
if (old && !old.startsWith("/")) {
  const route = ["download", "history", "settings"].includes(old) ? "/" + old : ["bili", "hongguo", "zhuiju", "anich"].includes(old) ? "/video?provider=" + old : "/video";
  history.replaceState(null, "", "#" + route);
}
createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <AppProvider>
      <App />
    </AppProvider>
  </HashRouter>,
);
