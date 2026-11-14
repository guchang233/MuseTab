# MuseTab

当前版本 **0.6.2**。面向 Android 平板的离线看谱、记号、播放和编辑。

- 支持 MSCZ、MusicXML、MIDI 导入，以及 PDF 看谱和手写批注。
- 看谱提供整页全屏、左右滑动、双指缩放和自由拖动；PDF 有横向、竖向、连续三种排版。
- 编辑界面包含触摸版面与混音器面板；播放只包含显示的谱表。
- 直接移植 ZeraFun 0.7.4 手机 App 的首页与“我的”设置结构、主题和样式。
- 云端曲库只读，保存到本地后打开；切换标签保留分类和滚动位置。
- 本地乐谱长按管理、重命名、导出和删除；云端乐谱点开详情后下载。
- 全屏支持自动/单页/双页，保留相邻页和本地页面缓存；播放竖线对齐音频输出时钟。
- 外观可关闭曲谱背景，采用统一圆角控件。
- “我的 → 应用设置 → 版本与更新”可检查、下载并安装 GitHub Release。

下载：[最新正式版](https://github.com/guchang233/MuseTab/releases/latest)。
[构建](docs/BUILDING.md) · [源码移植](docs/ZERAFUN-UI-REUSE.md) · [自动发布](docs/RELEASING.md) · [PDF 识别方案](docs/PDF-OMR-PLAN.md)。

面向安卓平板的离线看谱和编辑程序。谱面由 MuseScore Studio 的原生排谱核心
编译为 WebAssembly 后绘制，界面使用 Svelte；Android 使用本地 WebView 容器。
乐谱、音色、字体和运行核心都放在本机。

当前接手开发的目录是 **`D:/AI/2026/MuseTab`**，不要与带空格的旧原型目录混用。

## 第一阶段的使用流程

1. 从谱匣导入 MSCZ、MSCX、MusicXML、MXL、MIDI 或 PDF，也可从云端曲库保存文件到本地。
2. 看谱页顶部可进入全屏，整页居中适合屏幕，左右滑动翻页；轻点空白显示工具条，轻点音符后可选择“从这里播放”。
3. 工具条可以播放/暂停、调整播放倍率、切换视图、进入编辑。
4. 编辑界面提供音符时值、变音、声部、连线、引擎符号面板和选中内容操作。
5. 修改自动存入本机谱匣；手动保存和离开编辑时也会等待保存完成。
6. “更多”中的导出用于保存到系统文件夹，方便备份或交给桌面 MuseScore。

PDF 提供独立的翻页、缩放、全屏和本地手写批注。PDF 不识别音符，也不能自动播放；
PDF 的“导出原始 PDF”不包含本地墨迹，批注目前仅保存在本设备中。

## GitHub 只读曲库

默认仓库为 https://github.com/guchang233/muse-repo 。将文件放到 main 分支的仓库根目录：

```text
mid/曲名.mid
mscz/曲名.mscz
pdf/曲名.pdf
```

支持格式目录内的子文件夹和大小写目录名；mid 目录也识别 .midi。
仓库已配置 GitHub Actions；上传后自动生成 `catalog.json`，等待任务完成后刷新 App。
App 直接读取 raw.githubusercontent.com 的静态清单和原始文件，不调用 GitHub REST API，
不需要登录、令牌或手动维护清单。网络失败时保留上次缓存的列表。
自动索引脚本和工作流的可复用副本位于 [cloud-library](cloud-library/README.md)。
每个文件须先“保存到本地”，再从“本地谱匣”打开；下载不会自动打开。
本地修改不上传。云端文件更新后重新保存会生成另一份本地副本，保留旧副本。

看谱时不会通过拖动修改谱面。单个导入文件暂限 32 MB。
MIDI 只有演奏信息，导入后的分声部、节奏量化和排版由 MuseScore 自动推断，
因此不会恢复出原始手工制谱文件的全部标记。

## 开发和构建

```powershell
pnpm --dir app install --frozen-lockfile
pnpm --dir app check
pnpm --dir app dev --host 127.0.0.1 --port 5183
```

浏览器访问 `http://127.0.0.1:5183`。先运行 `node tools/runtime.mjs` 下载校验过的原生依赖，或自行编译引擎。
完整原生编译、Android 打包和验证说明见 [docs/BUILDING.md](docs/BUILDING.md)。

```powershell
node android/build.mjs
```

Android 输出：`release/MuseTab-0.6.2.apk`，包名 `org.musetab.app`。
本地开发签名；支持 Android 9 及以上、WebGL 2 的设备。

## 数据与范围

谱匣保存在应用自己的 IndexedDB 中；卸载应用或清除应用数据会删除谱匣。
导出 MSCZ 可以保留可继续编辑的谱面。原始导入文件不会被覆盖。
网络用于公开曲库以及应用版本检查和安装包下载；本地文件、编辑内容和批注不上传。

本阶段采用 MuseScore 的实际谱面和编辑动作。原生谱面的手写墨迹、云端双向同步、曲目集、
踏板翻页和完整桌面菜单的平板适配属于后续工作。具体已验证内容以
`tests` 下的验证结果和交付说明为准，界面按钮存在本身不代表已经完成验证。

## 许可

GPL-3.0-only，详见 [LICENSE.txt](LICENSE.txt) 和 [THIRD_PARTY.md](THIRD_PARTY.md)。
主谱面核心与独立音频模块均有本地源码构建流程。
这是独立项目，与 MuseScore 官方产品没有隶属关系。
