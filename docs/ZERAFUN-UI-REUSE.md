# ZeraFun APP 界面源码移植

参考版本：ZeraFun 0.7.4，Android versionCode 7004。
匹配依据是 APP 的 PhoneChrome、漫画页“漫画书库 / 搜索漫画名、标签”、
胶囊搜索与筛选弹层、宋体标题、底部导航和米白 / 深色主题。

用户提供的 `D:/AI/2026/TV/reference` 仅有 CleanYourTV 电视桌面启动器，
包名 `com.gathin.tvhome`，不是 ZeraFun。最终采用的匹配源码位于：
`D:/AI/management/pending-cleanup/gcys-design-backup`。
之前 TV 目录中的 0.6.0 / 0.6.3 原生 Java 旧副本不作为本次样式依据。

## 实际复用

| ZeraFun 原文件 | MuseTab |
| --- | --- |
| components/CatalogueHeader.tsx | app/src/library/zerafun/CatalogueHeader.svelte；保留原 DOM 和类名 |
| components/SearchBar.tsx | app/src/library/zerafun/SearchBar.svelte；保留表单、筛选弹层、点击外部 / Escape / Android Back 关闭 |
| main.tsx 中 PhoneChrome | app/src/library/zerafun/PhoneNavigation.svelte；改为乐谱、云端、最近、我的 |
| pages/Personal.tsx Settings / components/AppSettings.tsx | app/src/library/zerafun/Personal.svelte；沿用逐级菜单、路径、返回和 SettingRow，替换业务内容 |
| components/AppSettings.tsx SettingRow / client UpdateFlow.java | app/src/library/zerafun/VersionSettings.svelte；移植版本设置行及更新弹窗的标题、说明、安装包大小和操作层级。弹窗在 Svelte 内渲染，下载校验继续使用 MuseTab 的 Android 更新器 |
| style.css | app/src/library/zerafun/source.css；从原文件自动提取，保留原有颜色、尺寸、断点和选择器规则 |

原始文件快照在 `docs/references/zerafun-0.7.4`，`provenance.json`
记录来源与 SHA-256。不是按截图手工量尺寸；生成样式直接来自源码。
React 组件仅转换为 Svelte props / Snippet / bind 语法，不引入 GC 影视的账号、
影视源和网络业务。样式限定在 `.zf-app`，不会覆盖谱面编辑核心。
原 Tailwind 工具类展开为等价 CSS；导航链接改为 App 内按钮，触摸目标至少 44 px。
乐谱卡片保留曲名两行、格式和本地保存状态，云端文件仍必须下载后才打开。

从本项目自带的源码快照重新生成样式：

```powershell
node tools/import-zerafun-style.mjs
```

`--vendor` 仅用于从上述本机原目录更新快照；普通构建不依赖该目录。
验证：`pnpm --dir app check`、`node tools/verify-home.mjs`；
手机 / 平板截图和结果在 `tests/results/zerafun-home`。

0.4.1 安装包：`release/MuseTab-0.4.1.apk`（versionCode 3）。
验证覆盖 360×800、390×844、844×390、800×1280、1280×800；
MuMu 的 `MuseTab-Test` 实例也验证实际触摸、筛选弹层返回键、主题和系统栏、
手机 / 平板布局及覆盖安装保留本地曲谱。最近页仅列出实际打开过的文件。
