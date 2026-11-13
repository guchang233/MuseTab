# SPDX-License-Identifier: GPL-3.0-only
"""Prepare an isolated, Qt-free audio source tree matching the main engine.

The upstream standalone target lags behind its shared headers. Keep its
compatibility changes isolated so audio iteration does not invalidate every
object in the main notation build.
"""
from pathlib import Path
import shutil
import sys
import os

src, dest = map(lambda p: Path(p).resolve(), sys.argv[1:3])
if src == dest or dest.parent != Path('D:/b').resolve() or dest.name != 'audio-src':
    raise SystemExit('Unexpected isolated audio source path')
modified = ['src/framework/global/settings.h', 'src/framework/audio/common/audiotypes.h',
            'src/web/audioengine/webaudioengine.cpp', 'src/web/audioengine/CMakeLists.txt',
            'src/framework/audio/engine/internal/synthesizers/soundfontrepository.h',
            'src/framework/audio/engine/internal/synthesizers/soundfontrepository.cpp',
            'src/framework/audio/engine/internal/enginecontroller.cpp',
            'src/framework/audio/engine/internal/eventaudiosource.cpp',
            'src/web/audioengine/engine_export.cpp',
            'src/framework/audio/engine/internal/mixer.cpp']
before = {rel: ((dest / rel).read_bytes(), (dest / rel).stat())
          for rel in modified if (dest / rel).exists()}
for rel in ['buildscripts', 'src/web/audioengine', 'src/framework/audio',
            'src/framework/global', 'src/framework/cmake', 'src/framework/mpe',
            'src/framework/midi', 'src/framework/draw']:
    shutil.copytree(src / rel, dest / rel, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('.git', '__pycache__'))

def patch(rel, old, new):
    p = dest / rel
    text = p.read_text(encoding='utf-8')
    if old not in text:
        if new in text:
            return
        raise RuntimeError('Missing audio compatibility patch: ' + rel)
    p.write_text(text.replace(old, new), encoding='utf-8', newline='\n')

patch('src/framework/global/settings.h', '    QString dataPath() const;',
      '#ifndef NO_QT_SUPPORT\n    QString dataPath() const;\n#endif')
p = dest / 'src/framework/audio/common/audiotypes.h'
text = p.read_text(encoding='utf-8')
start = text.index('static const std::map<AudioResourceType, QString> RESOURCE_TYPE_MAP')
end = text.index('\n};', start) + 3
portable = text[start:end].replace('QString', 'String').replace(', "', ', u"')
p.write_text(text[:start] + portable + text[end:], encoding='utf-8', newline='\n')
patch('src/web/audioengine/webaudioengine.cpp',
      'std::make_shared<EngineController>(m_rpcChannel)',
      'std::make_shared<EngineController>(m_rpcChannel, nullptr)')
patch('src/web/audioengine/webaudioengine.cpp',
      '    if (muse::runtime::isDebug()) {',
      '    { // Keep native audio diagnostics available in the development APK.')
patch('src/web/audioengine/webaudioengine.cpp',
      '#include "global/runtime.h"',
      '#include "global/runtime.h"\n#include "global/async/processevents.h"')
patch('src/web/audioengine/webaudioengine.cpp',
      '    m_controller->process(stream, samplesPerChannel);',
      '    // AudioWorklet has no Qt event loop; service queued native promises.\n'
      '    muse::async::processMessages();\n'
      '    m_controller->process(stream, samplesPerChannel);')
patch('src/framework/audio/engine/internal/synthesizers/soundfontrepository.h',
      '#include "audio/engine/isoundfontrepository.h"',
      '#include "audio/engine/isoundfontrepository.h"\n#include "async/asyncable.h"')
patch('src/framework/audio/engine/internal/synthesizers/soundfontrepository.h',
      'class SoundFontRepository : public ISoundFontRepository',
      'class SoundFontRepository : public ISoundFontRepository, public async::Asyncable')
patch('src/web/audioengine/CMakeLists.txt',
      'add_executable(MuseAudio\n',
      'add_executable(MuseAudio\n    ${AUDIO_ROOT}/engine/platform/web/networksfloader.cpp\n')
patch('src/framework/audio/engine/internal/enginecontroller.cpp',
      '    m_rpcChannel->send(rpc::make_notification(rpc::Method::EngineRunning));',
      '    // Announced after the bundled SoundFont is loaded (see SoundFontRepository).')
patch('src/framework/audio/engine/internal/synthesizers/soundfontrepository.cpp',
      '#include "soundfontrepository.h"',
      '#include "soundfontrepository.h"\n#include <emscripten.h>\n'
      '#include "global/modularity/ioc.h"\n#include "audio/common/rpc/irpcchannel.h"')
patch('src/framework/audio/engine/internal/synthesizers/soundfontrepository.cpp',
      '    m_soundFontsChanged.notify();\n}\n\nvoid SoundFontRepository::doAddSoundFont',
      '''    m_soundFontsChanged.notify();
    // Main initializes its sound profile once, on EngineRunning. Reporting it
    // before the SoundFont arrives caches an empty profile and creates silent
    // tracks. Register RPC first, then announce the usable offline engine.
    static bool announced = false;
    if (meta.ret && !announced) {
        announced = true;
        auto rpcChannel = muse::modularity::globalIoc()->resolve<rpc::IRpcChannel>("audio_engine");
        rpcChannel->send(rpc::make_notification(rpc::Method::EngineRunning));
    }
    EM_ASM({ if (Module.onSoundFontReady) Module.onSoundFontReady(!!$0); }, bool(meta.ret));
}

void SoundFontRepository::doAddSoundFont''')
patch('src/web/audioengine/engine_export.cpp',
      'std::memset(stream, 0.0f, samplesPerChannel * 2);',
      'std::memset(stream, 0, samplesPerChannel * 2 * sizeof(float));')
patch('src/web/audioengine/engine_export.cpp', '#include "log.h"',
      '#include "log.h"\n#include "global/modularity/ioc.h"\n#include "audio/engine/isoundfontrepository.h"')
patch('src/web/audioengine/engine_export.cpp', 'extern "C" {', '''extern "C" {
void loadSoundFont(uintptr_t ptr, unsigned size, const char* uri)
{
    auto repository = muse::modularity::globalIoc()->resolve<muse::audio::synth::ISoundFontRepository>("audio_engine");
    if (!repository || !ptr || !size || !uri) return;
    // addSoundFontData writes the file synchronously; the borrowed buffer stays
    // valid until this call returns. Avoid copying the 51 MB font through the
    // notation heap and MessagePack RPC several times on mobile WebViews.
    repository->addSoundFontData(muse::Uri(uri), muse::ByteArray::fromRawData(reinterpret_cast<const uint8_t*>(ptr), size));
}
''')
patch('src/web/audioengine/CMakeLists.txt',
      'EXPORTED_FUNCTIONS=[_main,_malloc,_free,_Init,_process]',
      'EXPORTED_FUNCTIONS=[_main,_malloc,_free,_Init,_process,_loadSoundFont]')
patch('src/web/audioengine/CMakeLists.txt',
      'project(MuseAudio LANGUAGES C CXX)',
      'project(MuseAudio LANGUAGES C CXX)\noption(MUSETAB_AUDIO_SIMD "Build the SIMD audio backend" OFF)\nif(MUSETAB_AUDIO_SIMD)\n    add_compile_options(-msimd128)\n    add_link_options(-msimd128)\nendif()')
patch('src/web/audioengine/CMakeLists.txt',
      'target_link_options(MuseAudio PRIVATE ${EMCC_LINKER_FLAGS})',
      'if(MUSETAB_AUDIO_SIMD)\n    set_target_properties(MuseAudio PROPERTIES OUTPUT_NAME "MuseAudio-simd")\nendif()\ntarget_link_options(MuseAudio PRIVATE ${EMCC_LINKER_FLAGS})')
patch('src/web/audioengine/CMakeLists.txt',
      'target_link_options(MuseAudio PRIVATE "SHELL:-s EXPORT_NAME=MuseAudio_entry")',
      'target_link_options(MuseAudio PRIVATE --emit-symbol-map)\ntarget_link_options(MuseAudio PRIVATE "SHELL:-s EXPORT_NAME=MuseAudio_entry")')
patch('src/framework/audio/engine/internal/mixer.cpp',
      '    if (m_masterParams.muted || samplesPerChannel == 0 || (m_isSilence && !m_shouldProcessMasterFxDuringSilence)) {\n        notifyNoAudioSignal();',
      '    if (m_masterParams.muted || samplesPerChannel == 0 || (m_isSilence && !m_shouldProcessMasterFxDuringSilence)) {\n        std::fill(outBuffer, outBuffer + outBufferSize, 0.f);\n        notifyNoAudioSignal();')
patch('src/framework/audio/engine/internal/eventaudiosource.cpp',
      '#include "eventaudiosource.h"', '#include "eventaudiosource.h"\n#include <emscripten.h>')
patch('src/framework/audio/engine/internal/eventaudiosource.cpp',
      '        m_synth = synthResolver()->resolveDefaultSynth(m_trackId);',
      '''        const auto defaults = synthResolver()->resolveDefaultInputParams();
        EM_ASM({ debugLog('SYNTH_FALLBACK track='+$0+' required='+UTF8ToString($1)+' default='+UTF8ToString($2)); },
               m_trackId, requiredParams.resourceMeta.id.c_str(), defaults.resourceMeta.id.c_str());
        m_synth = synthResolver()->resolveDefaultSynth(m_trackId);
        EM_ASM({ debugLog('SYNTH_FALLBACK_RESULT '+$0); }, bool(m_synth));''')
patch('src/framework/audio/engine/internal/eventaudiosource.cpp',
      'void EventAudioSource::prepareToPlay()\n{\n    ONLY_AUDIO_ENGINE_THREAD;',
      '''void EventAudioSource::prepareToPlay()
{
    ONLY_AUDIO_ENGINE_THREAD;
    EM_ASM({ debugLog('PREPARE_TRACK '+$0+' synth='+$1); }, m_trackId, bool(m_synth));''')
for rel, (old, stat) in before.items():
    p = dest / rel
    if p.read_bytes() == old:
        os.utime(p, ns=(stat.st_atime_ns, stat.st_mtime_ns))
print('Prepared matching audio source at', dest)
