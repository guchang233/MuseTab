# PDF → MusicXML → MSCZ → 原 PDF 同步播放

日期：2026-11-14。依据项目根目录《PDF识别播放_所需技术清单.md》及当前 MuseTab 实现。
状态：实现方案，尚未集成识别模型；当前 PDF 仍是原图看谱和批注，不能直接播放。

## 目标和边界

最终必须在 Android 平板上独立离线识别、播放和编辑。电脑原型只用于对照和排查，不能成为实际使用依赖。第一版支持清晰印刷钢琴谱，先做单页、双谱表，再做跨页；手写谱、复杂管弦总谱和严重倾斜照片不作为首版承诺。

保留原始 PDF 和已有批注。识别后新增关联的 MSCZ，可进入现有 MuseScore 编辑器；播放时可选择在原 PDF 上查看高亮。任何自动校正都有记录，存在歧义的音符、节奏、声部应允许检查，不能把“生成了 XML”当作“识别正确”。

## 技术选择

| 环节 | 首选 | 原因 / 验证点 |
| --- | --- | --- |
| PDF 页面 | 复用现有 PDF.js 本地渲染；必要时 Android PdfRenderer | 不为渲染额外打包 Python。逐页按目标分辨率生成图片，保留旋转、裁剪与坐标变换 |
| OMR 基线 | homr；先对照 Andromr 的 Android 推理代码 | homr 输出 MusicXML；Andromr 已提供基于 homr 的 Android 实现，其 Java 推理使用 LiteRT 和 ONNX Runtime，值得优先做移植验证。[homr](https://github.com/liebharc/homr)、[Andromr](https://github.com/aicelen/Andromr) |
| Android 推理 | 对照 Andromr，Java/JNI 通过桥接调用 | 不复刻其 Kivy 界面。需要盘点 Python 前后处理、模型版本和算子支持，再确定可直接复用范围。ONNX Runtime 官方提供 Android Java/C/C++ 包；能否达到本项目性能要求仍要实测。[官方移动端指南](https://onnxruntime.ai/docs/tutorials/mobile/) |
| 对照引擎 | Audiveris 桌面批处理 | 作为准确率对照和疑难样本诊断。其官方发行面向桌面平台，并可输出 MusicXML，不能把桌面 JRE 安装包当作 Android 集成方案。[Audiveris](https://github.com/Audiveris/audiveris) |
| 校验 | 电脑 music21 对照；应用内 TS/C++ 校验器 | 检查小节时值、backup/forward、声部、谱表号、连音和延音线；不以补休止符掩盖识别错误 |
| 排谱、保存、播放 | 现有本地 MuseScore 核心 | MusicXML 导入 → 原生 MSCZ 保存 → 现有独立音频 Worker 播放，避免再维护第二套 MIDI 播放逻辑 |

矢量 PDF 解析作为后续增强：内嵌字体、字符编码、字形子集并不总是可直接映射 SMuFL。先检测有无可用的字体/路径信息，仅在映射可靠时辅助校正，始终保留图像识别回退。

## 数据流与接口

1. 用户在 PDF 中点“识别为乐谱”，选择页码范围；展示模型是否已准备好。
2. 计算原文件 SHA-256，读取 PDF 页面大小、旋转和裁剪，逐页渲染。
3. 识别器输出 MusicXML、谱表/系统/小节/音符位置、置信信息。必须在识别流程中保留来源坐标，不能仅在最后从 MusicXML 猜位置。
4. 校验并显示需要复核的区域；可预览识别结果与原页，用户确认后保存关联 MSCZ。
5. 复用当前导入、播放、点击选择与编辑接口。原 PDF 播放时依据引擎的实际 tick/小节/拍位更新覆盖层。

桥接接口草案：

```ts
startOmr({jobId, pdfId, pages, modelVersion, rasterDpi}): void
cancelOmr(jobId): void
// 回调：queued / rendering / recognizing / validating / importing / done / error
onOmrProgress({jobId, page, completed, total, stage, message}): void
// 大文件用本地受限句柄交接，避免整本 PDF、模型或图片反复 base64 复制。
```

缓存键必须包含 `pdfSha256 + pageRange + modelSha256 + pipelineVersion + renderOptions`。旧结果保留，模型更新不自动覆盖用户校订后的 MSCZ。

关联记录草案：

```json
{
  "schema": 1,
  "pdfId": "local-document-id",
  "pdfSha256": "…",
  "derivedScoreId": "local-mscz-id",
  "model": {"name": "homr-android", "sha256": "…"},
  "pipelineVersion": "1",
  "pages": [{"index": 0, "rotation": 0, "width": 595, "height": 842}],
  "anchors": [{
    "measureId": "m1", "measureIndex": 0, "page": 0, "system": 0,
    "rect": [0.08, 0.16, 0.84, 0.12],
    "beats": [{"fraction": "0/1", "x": 0.12}, {"fraction": "1/4", "x": 0.29}],
    "confidence": 0.92, "review": []
  }]
}
```

坐标相对原 PDF 旋转、裁剪后的页面归一化到 0..1，与现有批注统一转换。小节使用稳定 ID 与有理数拍位；不能把打印的小节编号直接当作数组索引。弱起、跨行、装饰音、反复、跳房子、变拍和变速都要由 MuseScore 实际播放位置解析。没有音符级锚点时只显示小节高亮，不能伪装成精确音符光标。

编辑识别结果后，音高/力度变更通常可保留来源映射；增删小节、改节奏或重排结构需标记映射待校验。无法可靠对应时保留可播放 MSCZ，并明确提示原 PDF 光标不可用。

## 分阶段实施与验收

| 阶段 | 具体产物 | 验收门槛 |
| --- | --- | --- |
| A：引擎选择实验 | 固定 homr/Andromr 提交和模型校验值；10 页样本及结果报告 | 在当前华为平板断网完成单页识别；记录耗时、峰值 PSS、模型/包体大小；双谱表音符归属正确；不通过则先调整模型/预处理 |
| B：可播放最小流程 | PDF 页面 → XML → 本地 MSCZ → 播放/导出 | 进程重启后仍可打开；可取消、失败重试；原 PDF/批注不变；识别任务不阻塞 UI |
| C：原 PDF 光标 | 小节/拍锚点、点击定位与播放联动 | 缩放、旋转、翻页坐标一致；反复/变拍/变速不漂移；分页自动跟随可关闭 |
| D：多页与复核 | 跨页拼接、可疑区域列表、识别前后对照 | 页码和谱表不串位；断点恢复；用户修正不被重识别覆盖 |
| E：优化与矢量辅助 | 模型裁剪/量化实验、字体辅助校正 | 同一基准集比较准确率与性能，收益达标再启用，不能仅以模型变小判定成功 |

建议门槛是实验目标而非已测结论：清晰单页钢琴谱中音高与时值 F1 ≥ 98%，小节时值一致率 ≥ 99%，小节定位覆盖率 ≥ 99%；并记录声部、谱表归属、和弦、延音线、升降号及每页人工修正次数。先以当前平板单页 ≤ 90 秒、额外峰值 PSS ≤ 500 MB 作为是否继续该路线的初始预算，阶段 A 根据真实内存余量修订。未达到准确率时提供复核，不自动宣称转换成功。

样本分层：自己生成的有真值 MusicXML/PDF；清晰印刷简单钢琴谱；跨行/跨页与反复样本；用户 Frieren/Animenz 的密集谱面作为压力集。用户提供文件只保留本地，不发布到源码仓库。评估时应先建立逐小节真值，不能假设 MIDI 与印刷谱一一对应（延音、踏板、反复和表情会不同）。

## 运行与存储约束

- 识别与音频各自运行；识别默认单页队列、限制 CPU 线程，播放时暂停或降速识别，防止再次出现音频饥饿。
- 模型首次准备与更新明确显示体积、校验值和状态；准备完成后彻底断网仍可用。最终需要提供含模型的离线安装/导入方式。
- 页图和临时张量及时释放；不在 WebView JS 堆里同时保留整本高清图片和所有模型。
- 缓存提供按文件清理入口；不能把有编辑的 MSCZ 当可删除临时缓存。删除识别缓存应保留原 PDF 和批注。
- 测试包括错误/加密/超大 PDF、损坏模型、磁盘不足、后台切换、取消与重启恢复。

## 许可与开工顺序

homr、Andromr 和 Audiveris 的项目许可为 AGPL-3.0。当前 MuseTab 应用源码为 GPL-3.0-only；引入 AGPL 代码或组合分发前应梳理组合方式、源码和模型各自许可、对应源码交付及声明，不能简单沿用当前应用声明，也不能假设“用户自己安装”就自动免除义务。此阶段不把任何模型或新识别器代码混入已发布 APK。

下一步先做阶段 A：审计 Andromr 的 Java 推理、Python 前后处理与模型包，建立复现脚本和逐页基准报告，再确认实际复用范围和集成预算。精确日期取决于这一轮平板实测结果，目前不承诺整首复杂谱的自动正确率。
