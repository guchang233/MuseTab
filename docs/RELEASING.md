# Android 发布与更新

源码仓库：`guchang233/MuseTab`；只读曲库仍为 `guchang233/muse-repo`。

## 发布一个版本

1. 修改 `app/package.json` 的 version 和 AndroidManifest 的 versionName，并递增 versionCode。
2. 更新 `docs/RELEASE-NOTES.md`、验证功能并提交源码。
3. 推送形如 `v0.4.5` 的 tag。`.github/workflows/android-release.yml` 自动构建、签名并发布 APK、SHA-256 和 update.json。

工作流验证 tag、Web 包版本和 Android 版本一致。它在 Windows runner 上安装 Node、pnpm、JDK、Python、Android SDK，下载 SHA-256 锁定的原生依赖后构建 App，不需要开发机在线。先创建草稿并上传全部附件，再发布为 latest，防止客户端读到没有 APK 的版本。

`ANDROID_KEYSTORE_BASE64` 在仓库 Actions secret 中，内容为此前开发包的签名密钥，密钥不进入源码或产物。此项目继续使用已有开发签名以保持覆盖安装兼容；后续若更换签名必须单独处理 Android 签名迁移，不能直接换 key。

## 原生依赖

`engine/runtime.lock.json` 锁定 MuseScore 主 WASM、标量/SIMD 音频模块、音色和对应源码附件。APK CI 每次编译应用与 Java 容器，原生核心作为固定构建依赖复用；**不是每次 tag 都重新编译 MuseScore/Qt**。

当 C++ 桥接或排谱/音频代码改变时，先按 BUILDING.md 构建主引擎和两个音频模块，跑对应验证，执行 `node tools/runtime.mjs --pack`。发布新的、不可复用名称的 runtime tag/附件，再更新锁文件 URL/校验值并提交。不能覆盖已锁定的原生附件；CI 校验失败应先排查来源。

runtime 附件的对应 MuseScore 源码包含固定上游版本和本地修改，源码仓库中的 engine/ 保存额外脚本/覆盖文件。Qt 6.7.3 对应源码入口：https://download.qt.io/archive/qt/6.7/6.7.3/single/ 。工具链版本与复现步骤见 BUILDING.md 和 THIRD_PARTY.md。

## 客户端流程

- 直接 HTTPS GET `https://github.com/guchang233/MuseTab/releases/latest/download/update.json`，不调用 GitHub REST API。
- 以已安装 APK 的 versionCode 比较，不按字符串比较版本号，不自动降级，不读取预发布版。
- 自动检查每天最多一次成功检查；只有检查，不自动下载/安装。手动入口展示失败原因。
- 下载使用独立线程，支持取消；校验长度、SHA-256、包名、版本和当前签名后才允许安装。
- 本地 ContentProvider 只读开放 `update.apk`，系统安装界面通过临时授权访问。需要 Android 的“允许此来源安装应用”权限；用户允许后返回 App 再点击安装。
- GitHub 无法连通时更新不可用，但本地看谱、播放、编辑继续离线工作。

用户乐谱、PDF、批注、私有测试文件、签名密钥和设备日志不上传源码仓库。测试报告中引用的本机路径不代表文件本体被提交。
