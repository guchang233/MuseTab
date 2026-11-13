import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { appInfo, resetAppInfo, call, deviceForm, inApp, isIos, isTv, appForm, onNative, setTvScale, setUiOverride, tvScale, TV_SCALES, uiOverride, type AppInfo } from "../lib/native";
import { setThemePref, useThemePref, type ThemePref } from "../lib/theme";
import { Toggle } from "./ui";

export const settingsGroup = "settings-group divide-y divide-line";
export const settingsHeading = "settings-heading";
export const SettingOptionContext = createContext<string | null>(null);
/** One settings line: title + detail on the left, the control on the right. */
export function SettingRow({ title, detail, children, as = "div", option }: { title: ReactNode; detail?: ReactNode; children?: ReactNode; as?: "div" | "label"; option?: string }) {
  const selected = useContext(SettingOptionContext);
  if (selected && selected !== option) return null;
  const Tag = as;
  return (
    <Tag className={"setting-row flex min-h-14 items-center justify-between gap-4 " + (as === "label" ? "cursor-pointer" : "")}>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{detail}</span>}
      </span>
      {children && <span className="setting-controls flex shrink-0 items-center gap-2">{children}</span>}
    </Tag>
  );
}
/** Small segmented choice used by the app settings (works with touch and the TV remote). */
export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <span className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.id} type="button" className="seg-item" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </span>
  );
}
const THEMES: { id: ThemePref; label: string }[] = [{ id: "system", label: "跟随系统" }, { id: "light", label: "浅色" }, { id: "dark", label: "深色" }];

/** Appearance works on the website too; everything else in this file only renders inside the app. */
export function AppearanceRow() {
  const pref = useThemePref();
  return <SettingRow option="appearance" title="外观" detail={isTv ? "电视默认深色，夜间观看更柔和" : "浅色、深色或跟随系统"}><Choice label="外观" value={pref} options={THEMES} onChange={setThemePref} /></SettingRow>;
}

type UpdateStatus = { state: string; message: string; version?: string };
export default function AppSettings() {
  const [info, setInfo] = useState<AppInfo | null>(null), [error, setError] = useState("");
  const [update, setUpdate] = useState<UpdateStatus | null>(null), [notice, setNotice] = useState("");
  useEffect(() => {
    if (!inApp) return;
    appInfo().then(value => { setInfo(value); if (!value) setError("暂时无法读取应用信息"); });
    return onNative("update", (s: UpdateStatus) => setUpdate(s));
  }, []);
  if (!inApp) return null;
  const flash = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 3000); };
  const ui = uiOverride(), scale = String(tvScale());
  const engineLabel = info ? (info.engine === "gecko" ? "GeckoView" : "系统 WebView") + " · " + info.engineVersion : "—";
  const setPref = async (key: string, value: unknown) => { try { await call("setPref", { key, value }); resetAppInfo(); setInfo((i) => (i ? { ...i, [key === "engine" ? "enginePref" : key]: value } as AppInfo : i)); } catch (e: any) { flash(e.message); } };
  if (isIos) return <section>
    <h2 className={settingsHeading}>应用</h2>
    <div className={settingsGroup}>
      <SettingRow option="version" title={'ZeraFun ' + (info?.version || '')} detail={error || 'iPhone / iPad · WebKit'}><Link className="btn-ghost btn-sm" to="/download">下载与更新</Link></SettingRow>
      <AppearanceRow />
      <SettingRow option="server" title="站点地址" detail="连接正式站点或本地备份预览"><button className="btn-ghost btn-sm" onClick={() => call('serverSettings').catch(e => flash(e.message))}>更改</button></SettingRow>
      <SettingRow option="cache" title="清除缓存" detail="保留登录、记录和设置"><button className="btn-ghost btn-sm" onClick={() => call('clearCache').then(() => flash('缓存已清除'), e => flash(e.message))}>清除</button></SettingRow>
    </div>
    {notice && <p role="status" className="mt-2 text-xs text-ok">{notice}</p>}
  </section>;
  return (
    <section>
      <h2 className={settingsHeading}>应用</h2>
      <div className={settingsGroup}>
        <SettingRow option="version" title={"ZeraFun " + (info?.version || "")} detail={update ? update.message : error || engineLabel + (info ? " · Android " + info.android : "")}>
          <button className="btn-ghost btn-sm" disabled={update?.state === "checking" || update?.state === "downloading"} onClick={() => { setUpdate({ state: "checking", message: "正在检查更新…" }); call<UpdateStatus>("checkUpdate").then(setUpdate, (e) => setUpdate({ state: "error", message: e.message })); }}>
            <RefreshCw className={"size-3.5 " + (update?.state === "checking" ? "animate-spin" : "")} />检查更新
          </button>
        </SettingRow>
        <SettingRow as="label" option="update" title="自动检查更新" detail="启动时检查已签名的新版本，发现后询问是否安装">
          <Toggle label="自动检查更新" checked={info?.autoUpdate ?? true} onChange={(v) => void setPref("autoUpdate", v)} />
        </SettingRow>
        <SettingRow option="mode" title="界面模式" detail={"本机识别为" + (deviceForm === "tv" ? "电视" : "手机") + "；切换后重新载入"}>
          <Choice label="界面模式" value={ui} options={[{ id: "auto", label: "自动" }, { id: "tv", label: "电视" }, { id: "phone", label: "手机" }]} onChange={(v) => { setUiOverride(v); location.reload(); }} />
        </SettingRow>
        {appForm === "tv" && (
          <SettingRow option="scale" title="界面大小" detail="按投影或电视的观看距离调整，切换后重新载入">
            <Choice label="界面大小" value={scale} options={TV_SCALES} onChange={(v) => { setTvScale(Number(v)); location.reload(); }} />
          </SettingRow>
        )}
        <AppearanceRow />
        <SettingRow option="engine" title="浏览器内核" detail={info ? (info.geckoAvailable ? "自动：系统 WebView " + info.webViewVersion + (info.webViewVersion >= info.webViewMinimum ? " 可用" : " 版本过旧，使用内置 GeckoView") : "此设备使用系统 WebView " + info.webViewVersion) + "；切换后重启应用" : ""}>
          {info?.geckoAvailable && <Choice label="浏览器内核" value={info.enginePref} options={[{ id: "auto", label: "自动" }, { id: "webview", label: "WebView" }, { id: "gecko", label: "Gecko" }]} onChange={async (v) => { await setPref("engine", v); flash("正在重启应用…"); window.setTimeout(() => void call("restart").catch(() => {}), 400); }} />}
        </SettingRow>
        {info?.nativeVideoAvailable && (
          <SettingRow option="player" title="播放器" detail="本机解码器只能在系统播放器中显示画面；网页播放器在这台设备上会只有声音">
            <Choice label="播放器" value={info.nativeVideo ? "native" : "web"} options={[{ id: "native", label: "系统播放器" }, { id: "web", label: "网页播放器" }]} onChange={(v) => void setPref("nativeVideo", v === "native")} />
          </SettingRow>
        )}
        <SettingRow option="cache" title="清除缓存" detail="清除图片与网页缓存，不影响登录、记录和设置">
          <button className="btn-ghost btn-sm" onClick={() => call("clearCache").then(() => flash("缓存已清除"), (e) => flash(e.message))}>清除</button>
        </SettingRow>
        {isTv && (
          <SettingRow option="exit" title="退出应用" detail="也可以在首页连按两次返回键">
            <button className="btn-ghost btn-sm" onClick={() => void call("exit").catch(() => {})}>退出</button>
          </SettingRow>
        )}
      </div>
      {notice && <p role="status" className="mt-2 px-1 text-xs text-ok">{notice}</p>}
    </section>
  );
}
