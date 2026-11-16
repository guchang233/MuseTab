# SPDX-License-Identifier: GPL-3.0-only
"""Idempotent source patches that make MuseScore 4.7.4 build as app-web
with Qt 6.7.3 (wasm_singlethread) + emsdk 3.1.50 on Windows.

Usage: python web_patches.py <musescore-source-root>
Each patch is a literal replace; a patch whose result is already present is skipped.
"""
import sys
import re
from pathlib import Path

root = Path(sys.argv[1])
failed = []


def patch(rel, old, new, note):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    if new in s:
        print(f"  ok      {rel}  ({note})")
        return
    if old not in s:
        failed.append((rel, note))
        print(f"  MISSING {rel}  ({note})")
        return
    p.write_text(s.replace(old, new, 1), encoding="utf-8", newline="\n")
    print(f"  patched {rel}  ({note})")


def patch_all(rel, old, new, note):
    """Replace every occurrence; `new` must not contain `old`."""
    p = root / rel
    s = p.read_text(encoding="utf-8")
    if old not in s:
        if new in s:
            print(f"  ok      {rel}  ({note})")
        else:
            failed.append((rel, note))
            print(f"  MISSING {rel}  ({note})")
        return
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")
    print(f"  patched {rel}  ({note})")


def set_line(rel, prefix, line, note):
    """Replace the whole line that starts with `prefix` (for values that keep evolving)."""
    p = root / rel
    lines = p.read_text(encoding="utf-8").split("\n")
    hits = [i for i, l in enumerate(lines) if l.startswith(prefix)]
    if len(hits) != 1:
        failed.append((rel, note))
        print(f"  MISSING {rel}  ({note})")
        return
    if lines[hits[0]] == line:
        print(f"  ok      {rel}  ({note})")
        return
    lines[hits[0]] = line
    p.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"  patched {rel}  ({note})")


# --- build system -----------------------------------------------------------
patch("buildscripts/cmake/SetupQt6.cmake",
      "find_package(Qt6 6.8 REQUIRED", "find_package(Qt6 6.7 REQUIRED",
      "Qt floor 6.8 -> 6.7: no newer wasm kit is published")
patch("buildscripts/cmake/SetupQt6.cmake",
      "REQUIRES 6.8 SUPPORTS_UP_TO 6.10", "REQUIRES 6.7 SUPPORTS_UP_TO 6.7",
      "Qt policy range")
patch("buildscripts/cmake/GetPlatformInfo.cmake",
      'if(${CMAKE_CXX_COMPILER} MATCHES "/em\\\\+\\\\+(-[a-zA-Z0-9.])?$")',
      'if(EMSCRIPTEN OR "${CMAKE_CXX_COMPILER}" MATCHES "/em[+][+]")',
      "detect wasm when the compiler is em++.bat (Windows)")

# --- Qt 6.8-only API ---------------------------------------------------------
patch("src/framework/draw/types/font.cpp",
      "    qf.setStyleStrategy(QFont::PreferTypoLineMetrics);",
      "#if QT_VERSION >= QT_VERSION_CHECK(6, 8, 0)\n"
      "    qf.setStyleStrategy(QFont::PreferTypoLineMetrics);\n#endif",
      "QFont::PreferTypoLineMetrics is 6.8+")

patch("src/framework/draw/internal/qfontprovider.cpp",
      "qRawFont.glyphIndexesForString(QString(QChar::fromUcs4(ucs4)))[0];",
      "qRawFont.glyphIndexesForString(QString::fromUcs4(&ucs4, 1))[0];",
      "QChar::fromUcs4 result is not QString-convertible before 6.8")
SF = "src/framework/uicomponents/qml/Muse/UiComponents/sortfilterproxymodel.cpp"
patch_all(SF,
          "\n    beginFilterChange();\n",
          "\n#if QT_VERSION >= QT_VERSION_CHECK(6, 10, 0)\n    beginFilterChange(); // musetab-guarded\n#endif\n",
          "QSortFilterProxyModel::beginFilterChange is 6.9+")

# --- no QProcess in wasm Qt: plugin API's MsProcess becomes an inert QObject ---
UH = "src/engraving/api/v1/util.h"
patch(UH,
      "class MsProcess : public QProcess\n{",
      "#ifdef __EMSCRIPTEN__\n"
      "class MsProcess : public QObject\n{\n    Q_OBJECT\n\npublic:\n"
      "    MsProcess(QObject* parent = 0)\n        : QObject(parent) {}\n\npublic slots:\n"
      "    Q_INVOKABLE void start(const QString&) {}\n"
      "    Q_INVOKABLE void startWithArgs(const QString&, const QStringList&) {}\n"
      "    Q_INVOKABLE bool waitForFinished(int = 30000) { return false; }\n"
      "    Q_INVOKABLE QByteArray readAllStandardOutput() { return {}; }\n};\n"
      "#else\nclass MsProcess : public QProcess\n{",
      "MsProcess stub (open)")
patch(UH,
      "    Q_INVOKABLE QByteArray readAllStandardOutput() { return QProcess::readAllStandardOutput(); }\n};\n",
      "    Q_INVOKABLE QByteArray readAllStandardOutput() { return QProcess::readAllStandardOutput(); }\n};\n#endif\n",
      "MsProcess stub (close)")
UC = "src/engraving/api/v1/util.cpp"
patch(UC,
      "void MsProcess::start(const QString& command)\n{",
      "#ifndef __EMSCRIPTEN__\nvoid MsProcess::start(const QString& command)\n{",
      "MsProcess bodies guard (open)")
patch(UC,
      "    QProcess::start(program, args, ReadWrite);\n}\n",
      "    QProcess::start(program, args, ReadWrite);\n}\n\n#endif\n",
      "MsProcess bodies guard (close)")

# --- no SSL in wasm Qt -------------------------------------------------------
patch("src/app/main.cpp",
      "#include <QSslSocket>",
      "#include <QtNetwork/qtnetworkglobal.h>\n#if QT_CONFIG(ssl)\n#include <QSslSocket>\n#endif",
      "QSslSocket include guard")
patch("src/app/main.cpp",
      "#ifdef Q_OS_WIN\n        // NOTE: Force schannel",
      "#if defined(Q_OS_WIN) && QT_CONFIG(ssl)\n        // NOTE: Force schannel",
      "schannel guard")
patch("src/app/main.cpp",
      '    LOGI() << QString("SSL Info:',
      '#if QT_CONFIG(ssl)\n    LOGI() << QString("SSL Info:',
      "SSL log guard (open)")
patch("src/app/main.cpp",
      '        .arg(QSslSocket::availableBackends().join(", "));\n',
      '        .arg(QSslSocket::availableBackends().join(", "));\n#endif\n',
      "SSL log guard (close)")

# --- WebInteractive lags behind IInteractive ---------------------------------
WI_H = "src/framework/global/internal/platform/web/webinteractive.h"
WI_C = "src/framework/global/internal/platform/web/webinteractive.cpp"
patch(WI_H,
      "    void close(const muse::UriQuery& uri) override;\n"
      "    void close(const muse::Uri& uri) override;\n"
      "    void closeAllDialogs() override;",
      "    muse::async::Promise<muse::Ret> close(const muse::UriQuery& uri) override;\n"
      "    muse::async::Promise<muse::Ret> close(const muse::Uri& uri) override;\n"
      "    muse::Ret closeSync(const muse::UriQuery& uri) override;\n"
      "    muse::Ret closeAllDialogsSync() override;",
      "close()/closeSync()/closeAllDialogsSync() signatures")
patch(WI_C,
      "void WebInteractive::close(const UriQuery& uri)\n{\n    m_origin->close(uri);\n}\n\n"
      "void WebInteractive::close(const Uri& uri)\n{\n    m_origin->close(uri);\n}\n\n"
      "void WebInteractive::closeAllDialogs()\n{\n    m_origin->closeAllDialogs();\n}",
      "async::Promise<Ret> WebInteractive::close(const UriQuery& uri)\n{\n    return m_origin->close(uri);\n}\n\n"
      "async::Promise<Ret> WebInteractive::close(const Uri& uri)\n{\n    return m_origin->close(uri);\n}\n\n"
      "Ret WebInteractive::closeSync(const UriQuery& uri)\n{\n    return m_origin->closeSync(uri);\n}\n\n"
      "Ret WebInteractive::closeAllDialogsSync()\n{\n    return m_origin->closeAllDialogsSync();\n}",
      "close()/closeSync()/closeAllDialogsSync() bodies")

# --- WebSoundFontController: ContextInject needs a context --------------------
WS_H = "src/framework/audio/main/platform/web/websoundfontcontroller.h"
patch(WS_H,
      "class WebSoundFontController : public ISoundFontController, public async::Asyncable\n{\n"
      "    ContextInject<rpc::IRpcChannel> channel;\n\npublic:\n    WebSoundFontController() = default;",
      "class WebSoundFontController : public ISoundFontController, public async::Asyncable, public muse::Contextable\n{\n"
      "    ContextInject<rpc::IRpcChannel> channel = { this };\n\npublic:\n"
      "    WebSoundFontController(const muse::modularity::ContextPtr& iocCtx)\n"
      "        : muse::Contextable(iocCtx) {}",
      "make WebSoundFontController Contextable")
patch("src/framework/audio/main/audiomodule.cpp",
      "std::make_shared<WebSoundFontController>();",
      "std::make_shared<WebSoundFontController>(iocContext());",
      "pass ioc context to WebSoundFontController")

# --- MuseTab bridge & importers ----------------------------------------------
patch("src/app/CMakeLists.txt",
      '    target_link_options(MuseScoreStudio PRIVATE ${EXPORTED_FUNCTIONS})',
      '    target_link_options(MuseScoreStudio PRIVATE ${EXPORTED_FUNCTIONS})\n'
      '    target_link_options(MuseScoreStudio PRIVATE --emit-symbol-map)',
      "retain native symbol map for WebAssembly error diagnosis")
patch("src/app/CMakeLists.txt",
      '    target_link_options(MuseScoreStudio PRIVATE --emit-symbol-map)',
      '    target_link_options(MuseScoreStudio PRIVATE --emit-symbol-map)\n'
      '    set_property(TARGET MuseScoreStudio PROPERTY QT_WASM_MAXIMUM_MEMORY 768MB)',
      "MuseTab: bound the Qt memory reservation for 32-bit Android WebViews")
BRIDGE_EXPORTS = ["_mtComposerState", "_mtViewRect", "_mtLoadTextFont", "_mtPageMetrics", "_mtSelectPageAt", "_mtSelectionImage", "_mtOpen", "_mtExport", "_mtDispatch", "_mtActionState", "_mtSetTempoMultiplier",
                  "_mtSetViewOnly", "_mtSetCanvasTheme", "_mtPalettes", "_mtPalette", "_mtPaletteApply", "_mtSync",
                  "_mtSetPageLock", "_mtSelectAt", "_mtPageView", "_mtGestureView", "_mtRenderPage", "_mtReaderLayout", "_mtScorePanels", "_mtChangeMixer", "_mtChangeParts", "_mtScoreStyle", "_mtApplyScoreStyle", "_mtTransposeScore", "_mtPlaybackInfo", "_mtSeekSeconds", "_mtAddPitch"]
set_line("src/app/exported_functions.cmake",
         'set(EXPORTED_FUNCTIONS "SHELL:-s EXPORTED_FUNCTIONS=',
         'set(EXPORTED_FUNCTIONS "SHELL:-s EXPORTED_FUNCTIONS=[_main,_malloc,_free,_load,_startAudioProcessing,_addSoundFont,'
         + ",".join(BRIDGE_EXPORTS) + ']")',
         "export the MuseTab bridge entry points")
patch("SetupConfigure.cmake",
      "    set(MUE_BUILD_IMPEXP_MIDI_MODULE OFF)\n    set(MUE_BUILD_IMPEXP_MNX_MODULE OFF)",
      "    set(MUE_BUILD_IMPEXP_MIDI_MODULE ON) # MuseTab\n    set(MUE_BUILD_IMPEXP_MNX_MODULE OFF)",
      "app-web: enable MIDI import/export")
patch("SetupConfigure.cmake",
      "    set(MUE_BUILD_IMPEXP_MUSICXML_MODULE OFF)\n    set(MUE_BUILD_IMPEXP_OVE_MODULE OFF)",
      "    set(MUE_BUILD_IMPEXP_MUSICXML_MODULE ON) # MuseTab\n    set(MUE_BUILD_IMPEXP_OVE_MODULE OFF)",
      "app-web: enable MusicXML import/export")

# --- Qt 6.7: qt_add_qml_module(IMPORTS TARGET x) is a 6.8 feature -------------
# Under 6.7 the words "TARGET" and the target name end up in qmldir as module
# imports ("module TARGET is not installed"). Replace each with the module URI.
import re

qml_uri = {}
for cm in (root / "src").rglob("CMakeLists.txt"):
    text = cm.read_text(encoding="utf-8")
    for m in re.finditer(r"qt_add_qml_module\(\s*(\w+)\s+URI\s+([\w.]+)", text):
        qml_uri[m.group(1)] = m.group(2)

n_fixed = 0
for cm in (root / "src").rglob("CMakeLists.txt"):
    text = cm.read_text(encoding="utf-8")

    def repl(m):
        return f"{m.group(1)}{qml_uri[m.group(2)]}" if m.group(2) in qml_uri else m.group(0)

    fixed = re.sub(r"(?m)^(\s*)TARGET (\w+)[ \t]*$", repl, text)
    if fixed != text:
        cm.write_text(fixed, encoding="utf-8", newline="\n")
        n_fixed += 1
print(f"  {'patched' if n_fixed else 'ok     '} qml IMPORTS TARGET -> URI ({n_fixed} files, {len(qml_uri)} modules known)")

# Qt 6.7 auto-imports qmldir IMPORTS into the caller's namespace. MuseScore's
# module graph reaches UiComponents (which exports Utils.mjs) along multiple
# paths, and QQmlImportInstance::setQmldirContent rejects the duplicate script
# import as ambiguous. QML files already declare the imports they use; keep
# the build/tooling dependency without importing every transitive namespace.
n_dependencies = 0
for cm in (root / "src").rglob("CMakeLists.txt"):
    text = cm.read_text(encoding="utf-8")
    if "qt_add_qml_module(" not in text:
        continue
    fixed = re.sub(r"(?m)^(\s*)IMPORTS[ \t]*$", r"\1DEPENDENCIES", text)
    if fixed != text:
        cm.write_text(fixed, encoding="utf-8", newline="\n")
        n_dependencies += 1
print(f"  {'patched' if n_dependencies else 'ok     '} Qt 6.7 QML imports -> dependencies ({n_dependencies} files)")

# Files in a module's internal/ subdirectory have no implicit import of the
# module's parent directory. With the transitive IMPORTS above removed they
# must explicitly name their own module (e.g. ArrowScrollButton -> FlatButton).
modules = []
for cm in (root / "src").rglob("CMakeLists.txt"):
    text = cm.read_text(encoding="utf-8")
    if "qt_add_qml_module(" in text:
        uri = re.search(r"\bURI\s+([A-Za-z][A-Za-z0-9_.]+)", text)
        if uri:
            modules.append((cm.parent, uri.group(1)))
seen_qml = set()
n_explicit = 0
for base, uri in sorted(modules, key=lambda m: len(m[0].parts), reverse=True):
    for qml in base.rglob("*.qml"):
        if qml in seen_qml:
            continue
        seen_qml.add(qml)
        if qml.parent == base:
            continue
        text = qml.read_text(encoding="utf-8")
        if re.search(r"(?m)^import\s+" + re.escape(uri) + r"(?:\s|$)", text):
            continue
        fixed = re.sub(r"(?m)^(import [^\n]+\n)", r"\1import " + uri + "\n", text, count=1)
        if fixed != text:
            qml.write_text(fixed, encoding="utf-8", newline="\n")
            n_explicit += 1
print(f"  {'patched' if n_explicit else 'ok     '} nested QML explicit module imports ({n_explicit} files)")

# Legacy MIDI parsing still uses QIODevice, while the web port stores imports
# in Muse's MemFileSystem. Bridge those bytes rather than opening an absent
# Qt filesystem path.
MIDI_IMPORT = "src/importexport/midi/internal/midiimport/importmidi.cpp"
patch(MIDI_IMPORT,
      '#include <QFile>\n#include <QFileInfo>',
      '#include <QFile>\n#include <QFileInfo>\n#include <QBuffer>\n#include "global/io/file.h"',
      "MIDI: memory file adapter includes")
patch(MIDI_IMPORT,
      '        QFile fp(name);\n        if (!fp.open(QIODevice::ReadOnly)) {',
      '#ifdef Q_OS_WASM\n'
      '        muse::ByteArray bytes;\n'
      '        if (!muse::io::File::readFile(muse::io::path_t(name), bytes)) {\n'
      '            return Err::FileOpenError;\n        }\n'
      '        QBuffer fp;\n'
      '        fp.setData(QByteArray(reinterpret_cast<const char*>(bytes.constData()), int(bytes.size())));\n'
      '#else\n        QFile fp(name);\n#endif\n'
      '        if (!fp.open(QIODevice::ReadOnly)) {',
      "MIDI: read imported bytes from the web memory filesystem")

# --- audio engine (separate MuseAudio.js build) -------------------------------
patch("src/framework/uicomponents/qml/Muse/UiComponents/CMakeLists.txt",
      'else()\n    qt_target_qml_sources(muse_uicomponents_qml\n        QML_FILES\n            StubStyledRectangularShadow.qml\n    )\n    set_source_files_properties(StubStyledRectangularShadow.qml PROPERTIES\n        QT_QML_SOURCE_TYPENAME StyledRectangularShadow.qml\n    )',
      'else()\n    # Qt 6.7 consumes the type name immediately, before target sources are added.\n'
      '    set_source_files_properties(StubStyledRectangularShadow.qml PROPERTIES\n'
      '        QT_QML_SOURCE_TYPENAME StyledRectangularShadow\n    )\n'
      '    qt_target_qml_sources(muse_uicomponents_qml\n        QML_FILES\n'
      '            StubStyledRectangularShadow.qml\n    )',
      "Qt 6.7: register the shadow fallback under its actual public type name")

AE = "src/web/audioengine/CMakeLists.txt"
patch(AE,
      "target_link_libraries(MuseAudio PRIVATE muse_audio_common muse_audio_engine)\n\nadd_executable(MuseAudio",
      "# MuseTab: the link line that stood here moved below the target declaration\nadd_executable(MuseAudio",
      "audioengine: target was linked before it was declared (1/2)")
patch(AE,
      "target_link_libraries(MuseAudio PRIVATE\n    embind\n    muse::global\n)",
      "target_link_libraries(MuseAudio PRIVATE\n    embind\n    muse::global\n    muse_audio_common\n    muse_audio_engine\n)",
      "audioengine: target was linked before it was declared (2/2)")
patch(AE,
      "set(AUDIO_ROOT ${MU_ROOT}/src/framework/audio)\nadd_subdirectory(${AUDIO_ROOT}/common common)",
      "# MuseTab: these must be set before the sub-directories are added to apply to them\n"
      "add_definitions(-DNO_QT_SUPPORT)\nadd_definitions(-DQ_OS_WASM)\n\n"
      "set(AUDIO_ROOT ${MU_ROOT}/src/framework/audio)\nadd_subdirectory(${AUDIO_ROOT}/common common)",
      "audioengine: NO_QT_SUPPORT was defined after the modules that need it")
patch(AE,
      "include(MuseCreateModule)\ninclude(SetupCompileWarnings)",
      "include(GetPlatformInfo)\ninclude(MuseCreateModule)\ninclude(SetupCompileWarnings)",
      "audioengine: platform macros")

appjs_cmake=root/"src/web/appjs/CMakeLists.txt"
appjs_before=appjs_cmake.read_text(encoding="utf-8")
appjs_base=re.sub(r"\n*# MuseTab: the bridge reaches into the palette module to offer the full symbol set\n"
                  r"target_include_directories\(appjs PRIVATE \$\{PROJECT_SOURCE_DIR\}/src/palette\)\n"
                  r"target_link_libraries\(appjs PRIVATE Qt::Gui Qt::Quick(?: Qt::Widgets)?\)\n?", "", appjs_before)
appjs_after=appjs_base.rstrip()+"\n\n"+(
    "# MuseTab: the bridge reaches into the palette module to offer the full symbol set\n"
    "target_include_directories(appjs PRIVATE ${PROJECT_SOURCE_DIR}/src/palette)\n"
    "target_link_libraries(appjs PRIVATE Qt::Gui Qt::Quick Qt::Widgets)\n")
if appjs_after!=appjs_before:
    appjs_cmake.write_text(appjs_after,encoding="utf-8",newline="\n")
    print("  patched appjs: native panel and dialog dependencies (deduplicated)")

# --- MuseTab view-only mode (reader): select by tap, never edit by gesture ----
NV = "src/notationscene/qml/MuseScore/NotationScene/notationviewinputcontroller.cpp"
patch(NV,
      "using namespace mu;\nusing namespace mu::notation;",
      "//! MuseTab: set by the web bridge while the reader mode is shown\n"
      "static bool musetabViewOnly()\n{\n    return qApp && qApp->property(\"musetabViewOnly\").toBool();\n}\n\n"
      "using namespace mu;\nusing namespace mu::notation;",
      "view-only flag helper")
patch(NV,
      "const bool isDragObjectsAllowed = !(isNoteEnterMode || playbackController()->isPlaying() || isMiddleButton);",
      "const bool isDragObjectsAllowed = !(isNoteEnterMode || playbackController()->isPlaying() || isMiddleButton\n"
      "                                        || musetabViewOnly());",
      "view-only: dragging pans the canvas instead of moving elements")
patch(NV,
      "void NotationViewInputController::mouseDoubleClickEvent(QMouseEvent* event)\n{\n    if (m_view->isNoteEnterMode()) {",
      "void NotationViewInputController::mouseDoubleClickEvent(QMouseEvent* event)\n{\n"
      "    if (m_view->isNoteEnterMode() || musetabViewOnly()) {",
      "view-only: double tap does not start text editing")
patch(NV,
      "    m_view->showContextMenu(selectionType(), ctx.event->pos());\n#endif",
      "    if (!musetabViewOnly()) {\n        m_view->showContextMenu(selectionType(), ctx.event->pos());\n    }\n#endif",
      "view-only: no context menu")

# --- MuseTab web shell -------------------------------------------------------
patch("src/app/appfactory.cpp",
      '// Modules\n#include "appshell/appshellmodule.h"',
      '// Modules\n#ifdef MUE_CONFIGURATION_IS_APPWEB\n#include "web/appshell/webshellmodule.h"\n'
      '#else\n#include "appshell/appshellmodule.h"\n#endif',
      "include the MuseTab web shell instead of the desktop appshell")
patch("src/app/appfactory.cpp",
      "#ifdef MUE_BUILD_APPSHELL_MODULE\n    app->addModule(new mu::appshell::AppShellModule());\n#endif",
      "#ifdef MUE_CONFIGURATION_IS_APPWEB\n    app->addModule(new mu::appshell::WebShellModule());\n"
      "#elif defined(MUE_BUILD_APPSHELL_MODULE)\n    app->addModule(new mu::appshell::AppShellModule());\n#endif",
      "register the MuseTab web shell module")
patch("src/app/internal/guiapp.cpp",
      '#if defined(Q_OS_MAC)\n    QString platform = "mac";',
      '#if defined(Q_OS_WASM)\n    QString platform = "web";\n#elif defined(Q_OS_MAC)\n    QString platform = "mac";',
      "load platform/web/Main.qml")

patch("src/app/internal/guiapp.cpp",
      '    QQmlComponent component = QQmlComponent(engine, path);\n',
      '#ifdef Q_OS_WASM\n'
      '    //! MuseTab: Qt 6.7 reports a module as "ambiguous" when the same resource directory is on the\n'
      '    //! import path twice (":/x" and "qrc:/x"). Keep one spelling of each.\n'
      '    {\n'
      '        QStringList unique;\n'
      '        for (QString p : engine->importPathList()) {\n'
      '            if (p.startsWith(":/")) {\n'
      '                p = "qrc" + p;\n'
      '            }\n'
      '            while (p.size() > 5 && p.endsWith("/")) {\n'
      '                p.chop(1);\n'
      '            }\n'
      '            if (!unique.contains(p)) {\n'
      '                unique << p;\n'
      '            }\n'
      '        }\n'
      '        engine->setImportPathList(unique);\n'
      '        LOGI() << "qml import paths: " << unique.join(", ");\n'
      '    }\n'
      '#endif\n'
      '    QQmlComponent component = QQmlComponent(engine, path);\n',
      "wasm: de-duplicate QML import paths")

# Display and audio are independent in MuseTab's parts panel. Remove the old
# visibility-driven patches when iterating an existing native checkout first.
_legacy = {
    "src/engraving/playback/playbackmodel.cpp": [
        ("    auto playbackVoices = [this]() {\n        std::vector<bool> values;\n        for (const Staff* staff : m_score->staves()) for (int voice=0;voice<VOICES;++voice) values.push_back(staff->playbackVoice(voice));\n        return values;\n    };\n"
         "    changesChannel.onReceive(this, [this, playbackVoices, voices = playbackVoices()](const ScoreChanges& changes) mutable {\n"
         "        const auto current = playbackVoices();\n        if (current != voices) {\n            voices = current;\n            reload();\n            return;\n        }\n        if (shouldSkipChanges(changes)) {",
         "    changesChannel.onReceive(this, [this](const ScoreChanges& changes) {\n        if (shouldSkipChanges(changes)) {"),
        ("if (!item || !item->part() || (item->staff() && !item->staff()->playbackVoice(item->voice()))) {", "if (!item || !item->part()) {"),
        ("if (!item || !item->isChordRest() || !item->part() || (item->staff() && !item->staff()->playbackVoice(item->voice()))) {", "if (!item || !item->isChordRest() || !item->part()) {"),
        ("    auto visibleStaves = [this]() {\n        std::vector<bool> values;\n        for (const Staff* staff : m_score->staves()) values.push_back(staff->show() && staff->part()->show());\n        return values;\n    };\n"
         "    changesChannel.onReceive(this, [this, visibleStaves, visibility = visibleStaves()](const ScoreChanges& changes) mutable {\n"
         "        const auto current = visibleStaves();\n        if (current != visibility) {\n            visibility = current;\n            reload();\n            return;\n        }\n        if (shouldSkipChanges(changes)) {",
         "    changesChannel.onReceive(this, [this](const ScoreChanges& changes) {\n        if (shouldSkipChanges(changes)) {"),
        ("if (!item || !item->part() || !item->part()->show() || (item->staff() && !item->staff()->show())) {", "if (!item || !item->part()) {"),
        ("if (!item || !item->isChordRest() || !item->part() || !item->part()->show() || (item->staff() && !item->staff()->show())) {", "if (!item || !item->isChordRest() || !item->part()) {"),
    ],
    "src/notation/internal/notation.cpp": [
        ("        if (part->show()) {\n            for (const Staff* staff : part->staves()) {\n                if (staff->show()) return true;\n            }\n        }",
         "        if (part->show()) {\n            return true;\n        }"),
    ],
}
for _rel, _replacements in _legacy.items():
    _path = root / _rel
    _source = _path.read_text(encoding="utf-8")
    _updated = _source
    for _old, _new in _replacements:
        _updated = _updated.replace(_old, _new, 1)
    if _updated != _source:
        _path.write_text(_updated, encoding="utf-8", newline="\n")

patch("src/engraving/playback/playbackmodel.cpp",
      "    changesChannel.onReceive(this, [this](const ScoreChanges& changes) {\n        if (shouldSkipChanges(changes)) {",
      "    auto playbackVoices = [this]() {\n        std::vector<bool> values;\n        for (const Staff* staff : m_score->staves()) {\n            for (int voice=0;voice<VOICES;++voice) values.push_back(staff->playbackVoice(voice));\n            values.push_back(staff->show());\n            values.push_back(staff->part() && staff->part()->show());\n        }\n        return values;\n    };\n"
      "    auto staffOrder = [this]() {\n        std::vector<muse::ID> ids;\n        for (const Staff* staff : m_score->staves()) ids.push_back(staff->id());\n        return ids;\n    };\n"
      "    changesChannel.onReceive(this, [this, playbackVoices, staffOrder, voices = playbackVoices(), order = staffOrder()](const ScoreChanges& changes) mutable {\n"
      "        const auto current = playbackVoices();\n        const auto currentOrder = staffOrder();\n        const bool controlOnly = currentOrder == order && current != voices;\n        voices = current;\n        order = currentOrder;\n        if (controlOnly) return; // Worker applies masks; display does not change audio.\n        if (shouldSkipChanges(changes)) {",
      "MuseTab: staff playback/display controls avoid score event rebuilds; structural edits still update audio")
patch("src/playback/iplaybackcontroller.h",
      "    virtual void seekBeat(int measureIndex, int beatIndex, bool flushSound = true) = 0;",
      "    virtual void seekBeat(int measureIndex, int beatIndex, bool flushSound = true) = 0;\n    virtual void seek(muse::audio::secs_t seconds, bool flushSound = true) = 0;",
      "MuseTab: expose timeline seeking on the existing playback controller")
patch("src/playback/tests/mocks/playbackcontrollermock.h",
      "    MOCK_METHOD(void, seekBeat, (int, int, bool), (override));",
      "    MOCK_METHOD(void, seekBeat, (int, int, bool), (override));\n    MOCK_METHOD(void, seek, (muse::audio::secs_t, bool), (override));",
      "MuseTab: mock existing-player timeline seeking")
patch_all("src/playback/internal/playbackcontroller.cpp",
      "m_notation->hasVisibleParts()", "m_notation->parts()->hasParts()",
      "MuseTab: hidden notation still supports independent audio playback")
patch("src/playback/internal/playbackconfiguration.cpp",
      "    return settings()->value(MUTE_HIDDEN_INSTRUMENTS).toBool();",
      "    return false; // MuseTab: explicit speaker buttons control sound, independently of visibility.",
      "MuseTab: hiding an instrument must not overwrite its mute state")
patch("src/playback/internal/playbackcontroller.cpp",
      "const bool shouldMute = !part || !part->show();", "const bool shouldMute = !part;",
      "MuseTab: new excerpt tracks inherit explicit audio rather than visibility")

patch("src/notation/internal/notationconfiguration.cpp",
      '#include "notationconfiguration.h"',
      '#include "notationconfiguration.h"\n#include <QCoreApplication>\n#include <QVariant>',
      "MuseTab transparent score paper preference")
patch("src/notation/internal/notationconfiguration.cpp",
      'QColor NotationConfiguration::foregroundColor() const\n{\n',
      'QColor NotationConfiguration::foregroundColor() const\n{\n    if(qApp && qApp->property("musetabTransparentPaper").toBool()) return Qt::transparent;\n',
      "MuseTab: omit page fill in both reading themes")

patch("src/notationscene/qml/MuseScore/NotationScene/abstractnotationpaintview.cpp",
      '#include "abstractnotationpaintview.h"',
      '#include "abstractnotationpaintview.h"\n#include <QCoreApplication>\n#include <QVariant>',
      "MuseTab bitmap reader visibility")
patch("src/notationscene/qml/MuseScore/NotationScene/abstractnotationpaintview.cpp",
      'void AbstractNotationPaintView::movePlaybackCursor(muse::midi::tick_t tick)\n{\n    TRACEFUNC;',
      'void AbstractNotationPaintView::movePlaybackCursor(muse::midi::tick_t tick)\n{\n    TRACEFUNC;\n    if(qApp && qApp->property("musetabBitmapReader").toBool()) return;',
      "MuseTab: bitmap reader draws its cursor; skip hidden full-canvas playback repaints")

if failed:
    print("\nFAILED:", failed)
    sys.exit(1)
print("\nall patches applied")
