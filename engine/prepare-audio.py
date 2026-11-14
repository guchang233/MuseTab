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
            'src/framework/audio/engine/internal/track.h',
            'src/framework/audio/engine/internal/abstracteventsequencer.h',
            'src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsequencer.h',
            'src/framework/audio/engine/internal/synthesizers/fluidsynth/staffplayback.h',
            'src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsequencer.cpp',
            'src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsynth.cpp',
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
      '#include "log.h"\n#include <malloc.h>\n#include "global/modularity/ioc.h"\n#include "audio/engine/isoundfontrepository.h"\n#include "audio/engine/internal/synthesizers/fluidsynth/staffplayback.h"')
patch('src/web/audioengine/engine_export.cpp', 'extern "C" {', '''extern "C" {
unsigned audioHeapUsed() { return static_cast<unsigned>(mallinfo().uordblks); }
void setStaffPlayback(uintptr_t ptr, unsigned size)
{
    const auto* masks = reinterpret_cast<const unsigned char*>(ptr);
    muse::audio::synth::staffPlaybackMasks.assign(masks, masks + size);
    ++muse::audio::synth::staffPlaybackRevision;
}
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
      'EXPORTED_FUNCTIONS=[_main,_malloc,_free,_Init,_process,_loadSoundFont,_audioHeapUsed,_setStaffPlayback]')
patch('src/web/audioengine/CMakeLists.txt',
      'project(MuseAudio LANGUAGES C CXX)',
      'project(MuseAudio LANGUAGES C CXX)\noption(MUSETAB_AUDIO_SIMD "Build the SIMD audio backend" OFF)\nif(MUSETAB_AUDIO_SIMD)\n    add_compile_options(-msimd128)\n    add_link_options(-msimd128)\nendif()')
patch('src/web/audioengine/CMakeLists.txt',
      'target_link_options(MuseAudio PRIVATE ${EMCC_LINKER_FLAGS})',
      'if(MUSETAB_AUDIO_SIMD)\n    set_target_properties(MuseAudio PROPERTIES OUTPUT_NAME "MuseAudio-simd")\nendif()\ntarget_link_options(MuseAudio PRIVATE ${EMCC_LINKER_FLAGS})')
patch('src/web/audioengine/CMakeLists.txt',
      'target_link_options(MuseAudio PRIVATE "SHELL:-s EXPORT_NAME=MuseAudio_entry")',
      'target_link_options(MuseAudio PRIVATE --emit-symbol-map)\ntarget_link_options(MuseAudio PRIVATE "SHELL:-s EXPORT_NAME=MuseAudio_entry")')
patch('src/web/audioengine/CMakeLists.txt',
      'target_link_options(MuseAudio PRIVATE "SHELL:-s INITIAL_MEMORY=50MB")',
      '''# Reserve the normal soundfont/score working set before Qt/page caches
# fragment the 32-bit renderer address space; keep later growth bounded.
target_link_options(MuseAudio PRIVATE "SHELL:-s INITIAL_MEMORY=224MB")
target_link_options(MuseAudio PRIVATE "SHELL:-s MAXIMUM_MEMORY=512MB")
target_link_options(MuseAudio PRIVATE "SHELL:-s MEMORY_GROWTH_LINEAR_STEP=8MB")''')
patch('src/framework/audio/engine/internal/mixer.cpp',
      '    if (m_masterParams.muted || samplesPerChannel == 0 || (m_isSilence && !m_shouldProcessMasterFxDuringSilence)) {\n        notifyNoAudioSignal();',
      '    if (m_masterParams.muted || samplesPerChannel == 0 || (m_isSilence && !m_shouldProcessMasterFxDuringSilence)) {\n        std::fill(outBuffer, outBuffer + outBufferSize, 0.f);\n        notifyNoAudioSignal();')
patch('src/framework/audio/engine/internal/eventaudiosource.cpp',
      '#include "eventaudiosource.h"', '#include "eventaudiosource.h"\n#include <emscripten.h>')
patch('src/framework/audio/engine/internal/eventaudiosource.cpp',
      '    m_synth->setup(m_playbackData);',
      '''    m_synth->setup(m_playbackData);
    // The sequencer owns the current events. Retaining the initial snapshot
    // here keeps an obsolete full score alive after every stream replacement.
    m_playbackData.originEvents = {};
    m_playbackData.dynamics = {};''')
patch('src/framework/audio/engine/internal/abstracteventsequencer.h',
      'if (m_isActive || m_updateMainStreamWhenInactive) {',
      'if (m_isActive || m_updateMainStreamWhenInactive || events.empty()) {')
patch('src/framework/audio/engine/internal/track.h',
      '    EventTrack()\n        : Track(Event_track) {}',
      '''    EventTrack()
        : Track(Event_track) {}

    ~EventTrack() override { m_data.mainStream.disconnect(this); }''')
patch('src/framework/audio/engine/internal/track.h',
      '''        m_data = newData;
        playbackDataChanged.send(std::move(newData));''',
      '''        m_data.mainStream.disconnect(this);
        m_data = newData;
        // Keep this track's shared snapshot current too. Otherwise it pins the
        // entire initial score even after the synthesizer releases/replaces it.
        m_data.mainStream.onReceive(this, [this](const mpe::PlaybackEventsMap& events,
                                                const mpe::DynamicLevelLayers& dynamics) {
            m_data.originEvents = events;
            m_data.dynamics = dynamics;
        });
        playbackDataChanged.send(std::move(newData));''')
# Staff/voice switches are tiny control messages, not new MPE score snapshots.
# Keep complete events in the sequencer and rebuild only its compact MIDI cache.
(dest / 'src/framework/audio/engine/internal/synthesizers/fluidsynth/staffplayback.h').write_text('''// SPDX-License-Identifier: GPL-3.0-only
#pragma once
#include <vector>
namespace muse::audio::synth {
inline std::vector<unsigned char> staffPlaybackMasks;
inline unsigned staffPlaybackRevision = 0;
inline bool staffVoiceAudible(unsigned staff, unsigned voice) {
    return staff >= staffPlaybackMasks.size() || (staffPlaybackMasks[staff] & (1u << (voice % 4)));
}
}
''', encoding='utf-8', newline='\n')
patch('src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsequencer.h',
      '    int lastStaff() const;',
      '    int lastStaff() const;\n    bool refreshStaffPlayback();')
patch('src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsequencer.h',
      '    int m_lastStaff = -1;',
      '    int m_lastStaff = -1;\n    unsigned m_staffPlaybackRevision = 0;')
patch('src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsequencer.cpp',
      '#include "fluidsequencer.h"', '#include "fluidsequencer.h"\n#include "staffplayback.h"')
patch('src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsequencer.cpp',
      'int FluidSequencer::currentExpressionLevel() const',
      '''bool FluidSequencer::refreshStaffPlayback()
{
    if (m_staffPlaybackRevision == staffPlaybackRevision) return false;
    m_staffPlaybackRevision = staffPlaybackRevision;
    const auto& data = playbackData();
    updateMainStreamEvents(data.originEvents, data.dynamics);
    return true;
}

int FluidSequencer::currentExpressionLevel() const''')
patch('src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsequencer.cpp',
      '    const channel_t channelIdx = channel(noteEvent);',
      '''    const auto& ctx = noteEvent.arrangementCtx();
    if (!staffVoiceAudible(ctx.staffLayerIndex, ctx.voiceLayerIndex)) return;
    const channel_t channelIdx = channel(noteEvent);''')
patch('src/framework/audio/engine/internal/synthesizers/fluidsynth/fluidsynth.cpp',
      '    if (m_flushSoundRequested) {\n        doFlushSound();',
      '''    if (m_sequencer.refreshStaffPlayback()) m_flushSoundRequested = true;
    if (m_flushSoundRequested) {
        doFlushSound();''')
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
