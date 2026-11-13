# 第一阶段交付记录

验证日期：2026-11-13。

- 安装包：`release/MuseTab-0.3.0.apk`，129,699,386 字节（123.7 MiB）。
- SHA-256：`975527e3aafe8dea94ab16db22ed2eff9b67eebe0529d03c0827175b977560f9`。
- 源码目录：`D:/AI/2026/MuseTab`，原生源码：`D:/b/ms`。
- 原生谱面和音频模块均为本地源码构建，基于 MuseScore 4.7.4 development。
- Android 包采用开发签名；目标 Android 9+，本次验证设备为 Android 15 平板模拟器。

## 已验证的闭环

| 路径 | 验证结果 |
| --- | --- |
| 导入真实 Frieren MSCZ | 桌面与 Android 系统文件选择器均成功；直接由原生排谱核心绘制。 |
| 精确选音 | 鼠标及 Android 实际触摸均选中一个音符，音高、拍点与目标一致。 |
| 从选中位置播放 | 从 tick 960 起播，拍点持续前进；桌面及 Android WebAudio 均测得非零音频信号。 |
| 修改与撤销 | 共 7,687 个音符；升半音只将第一个音符 77 改为 78，撤销完全恢复，重做正确。 |
| 添加记号 | 网页界面通过原生指法面板添加记号，确认保存到谱面，随后可撤销。 |
| 本机保存 | IndexedDB 自动保存、手动保存、离开前保存；刷新或升级 APK 后可重新打开修改后的谱。 |
| 系统导出 | Android 系统“另存为”成功；取回 MSCZ 验证只有预期的一个音符被修改。 |
| MIDI 导入与切换 | 自动排谱得到 9,014 个记谱音符；桌面及 Android 可从 MSCZ 切到 MIDI，再切回修改后的 MSCZ。 |
| MusicXML | 原谱导出 MusicXML 后可重新导入和导出 MSCZ；保留 7,687 个音符及相同的音高总分布。 |
| 损坏文件 | 核心返回错误后，原先打开的 MIDI 内容保持不变，并可继续打开其他乐谱。 |
| 横竖屏 | Android 1280×800 / 800×1280 CSS 像素；画布与折行后的编辑工具栏对齐。 |
| 离线 | Android 开启飞行模式、关闭 Wi-Fi；包没有 INTERNET 权限，包含核心、字体与内置音色。 |
| 打包 | 签名验证、ZIP 完整性检查通过；没有打入用户 `_test.*` 乐谱或界面 mock。 |

MSCZ 原谱往返：音符 7,687、和弦 4,892、休止符 298、连线 399、延音线 331、
踏板 45、渐强渐弱 37、力度 73、连音组 85、奏法 403、琶音 34，数量均保持。

## 当前范围与限制

这是完成导入、看谱、播放、常用编辑、符号标记和保存导出的第一阶段版本。
完整桌面菜单、全部属性编辑、手写笔墨迹、踏板翻页、曲目集和云同步仍属后续工作。
本次没有实体安卓平板，实机音频延迟、长时间演奏性能及触笔体验需要后续验证。

复杂 MusicXML 往返并非无损：本曲导入时原生核心报告了跨小节连线排版警告，
694 个谱表小节中有 2 个小节的音符归属与 MSCZ 原稿不同。需要保留全部制谱细节时
优先使用已通过保真核对的 MSCZ；MusicXML 转换结果需复核。MIDI 会量化节奏、拆分
延音音符，不包含原始手工制谱标记。

## 证据

私有测试结果在 `tests/results/`，不纳入源码提交或 APK：

- `stage1-web.json`：完整网页操作结果。
- `stage1-android.json`：触摸、离线播放、编辑和横竖屏结果。
- `final-file-verification.json`：实际导出文件的音符比较。
- `release-verification.json`：APK 哈希、私有资源排除与 Android 重开结果。
- `android-reader-portrait-final.png`、`android-reader-selection.png`：真实 Android 画面。
- `android-system-export.mscz`、`android-reopened-final.mscz`：已验证的修改后文件。

构建和开发入口见 [BUILDING.md](BUILDING.md)。
