# 独立编谱工作台

> 2026-11-15：本文件记录的原生 QML 工作台实验已按用户要求暂停，源码保留供对照。后续编谱重写采用 [Aria 的分层与触屏编辑方式](ARIA-COMPOSER-PLAN.md)，本文件不代表新的实施方向。

编谱是覆盖在看谱 / 播放界面之上的独立一层。原页面保持挂载，退出时返回进入前的页面，保留页码、视图、声部或混音器面板状态。进入编谱默认锁定，离开后恢复锁定；播放键旁的锁定按钮控制音符修改。

## 原生界面来源

参考项目为 [mscore-web-engine](https://github.com/clclyzybzjsq/mscore-web-engine)，本机参考提交 `107ac38e66bac3d3ec1dd717a8f18e094a56840f`。实际排谱与 QML 面板由 MuseScore Studio 源码编译进同一套 WebAssembly 核心；不额外启动第二个 MuseScore 实例，也不使用图片模拟面板。

`engine/shell/qml/MuseScore/AppShell/platform/web/ComposerWorkspace.qml` 直接实例化以下上游组件：

| 工作区元素 | MuseScore 原生组件 |
| --- | --- |
| 音符输入栏、撤销与重做 | `NoteInputBar`、`UndoRedoToolBar` |
| 符号面板与原生符号库 | `PalettesPanel` |
| 按选中元素变化的属性检查器 | `InspectorForm` |
| 乐器、谱表与版面管理 | `LayoutPanel`，外层标题为“声部” |
| 混音器、声音、音量、声像、静音与独奏 | `MixerPanel` |
| 屏幕钢琴、MIDI 输入 | `PianoKeyboardPanel` |
| 页面设置、谱面样式、移调 | 原生 QWidget 对话框 |

Svelte 仅保留应用层的退出、保存、播放 / 锁定入口、文件与菜单路由、新建参数及解锁提示。编谱界面不导入 ZeraFun 样式；外壳采用原生 FlatButton 的 3 px 圆角与方形停靠面板，不修改原生面板的控件样式。看谱、播放和曲库维持独立的应用外观。

宽屏将符号 / 属性 / 声部面板停靠在谱面旁；窄屏叠放，可快速收起。超出屏幕的原生设置对话框保留原始表单并置于滚动容器，不缩小文字或把部分按钮丢到屏幕外。返回键按原生对话框 → 面板 → 编谱层处理。

## 桥接与约束

- `mtComposerState` 控制工作区显示、面板、键盘、编辑锁与 Qt 主题；原生控件继续使用其原有模型和排谱操作。
- `mtViewRect` 返回真实谱面区域；点击、缩放、选区坐标统一经过 QQuickItem 的场景坐标转换，避免侧栏出现后点击偏移。
- Qt 的视觉树与 QObject 所有权树并不相同，谱面查找必须遍历 `childItems()`；不能从 `contentItem()->findChild()` 推断谱面尺寸。
- 锁定时允许谱面选择与播放，修改区域请求解锁；移调窗口也受保护。原生对话框中的文本输入不会被看谱快捷键拦截。
- 中文字体随 APK 离线提供，在打开首份乐谱前注册到 Qt 字体库，避免中文标题与原生控件标签缺字。
- 播放模式保留声音和显示控制，不提供增删、重排谱表的结构操作。

验证入口：`tools/verify-native-composer.mjs`。运行需要本地开发服务和当前已构建的核心；生成的乐谱、截图和报告保存在忽略提交的 `tests/results/`。
