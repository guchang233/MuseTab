MuseTab native runtime v2

- Add page metrics, normalized page hit testing, and cropped native selection glyph painting.
- Support transparent score paper in both themes and skip hidden canvas cursor repaint in the bitmap reader.
- Forward playback positions with the PCM blocks that reach the audio output, instead of the synthesis buffer clock.
- Retain the isolated audio Worker, scalar/SIMD modules and bundled offline SoundFont.

The complete corresponding MuseScore source is supplied in musescore-corresponding-source.tar.gz. Project scripts and overrides are in engine/ in the matching MuseTab source revision. Toolchain: Qt 6.7.3, Emscripten 3.1.50; see docs/BUILDING.md and THIRD_PARTY.md.

This is a pinned build dependency, not an installable app release.
