// SPDX-License-Identifier: GPL-3.0-only
// Lyrics command semantics ported from hdi200/aria, commit
// 9dffd7f3feea6d5af068723d5cfff47e7283a69c,
// sandbox/engraving/score_render_edit_commands.cpp. See THIRD_PARTY.md.
#pragma once
#include "engraving/dom/lyrics.h"
namespace musetabAria {
class LyricsCommands {
    mu::engraving::Score* score;
    mu::notation::INotationUndoStackPtr undo;
    bool supportsEditing() const { return score != nullptr; }
    mu::engraving::Score* activeScore() { return score; }
    static mu::engraving::EngravingItem* currentSelectedItem(mu::engraving::Score* s) { return s->selection().element(); }
    static mu::engraving::EngravingItem* noteOrRestSelectionItem(mu::engraving::ChordRest* cr) { return cr && cr->isChord() ? mu::engraving::toChord(cr)->upNote() : static_cast<mu::engraving::EngravingItem*>(cr); }
    void refreshAfterEdit() {}
public:
    LyricsCommands(mu::engraving::Score* s, mu::notation::INotationUndoStackPtr u):score(s),undo(u){}
    enum class LyricsAdvance {
        None,
        Word,
        Syllable,
        Extension,
    };

    struct LyricsEntryContext {
        mu::engraving::ChordRest* chordRest = nullptr;
        mu::engraving::Lyrics* lyrics = nullptr; // nullptr when the lyric was empty and removed
        int verse = 0;
        mu::engraving::PlacementV placement = mu::engraving::PlacementV::BELOW;
        mu::engraving::PropertyFlags placementFlags = mu::engraving::PropertyFlags::STYLED;
        mu::engraving::FontStyle fontStyle = mu::engraving::FontStyle::Normal;
        mu::engraving::PropertyFlags fontStyleFlags = mu::engraving::PropertyFlags::STYLED;
        mu::engraving::TextStyleType styleType = mu::engraving::TextStyleType::LYRICS_ODD;
        bool hasStyle = false;
    };

    static mu::engraving::Lyrics* createLyricsLike(mu::engraving::ChordRest* chordRest,
                                                   const LyricsEntryContext& context,
                                                   const mu::engraving::LyricsSyllabic syllabic)
    {
        mu::engraving::Lyrics* lyrics = mu::engraving::Factory::createLyrics(chordRest);
        lyrics->setTrack(chordRest->track());
        lyrics->setParent(chordRest);
        lyrics->setVerse(context.verse);
        if (context.hasStyle) {
            lyrics->setTextStyleType(context.styleType);
        } else {
            lyrics->setTextStyleType(lyrics->isEven() ? mu::engraving::TextStyleType::LYRICS_EVEN
                                                      : mu::engraving::TextStyleType::LYRICS_ODD);
        }
        lyrics->setPlacement(context.placement);
        lyrics->setPropertyFlags(mu::engraving::Pid::PLACEMENT, context.placementFlags);
        lyrics->setSyllabic(syllabic);
        if (context.hasStyle) {
            lyrics->setFontStyle(context.fontStyle);
            lyrics->setPropertyFlags(mu::engraving::Pid::FONT_STYLE, context.fontStyleFlags);
        }
        return lyrics;
    }

    static void changeSyllabic(mu::engraving::Lyrics* lyrics, const mu::engraving::LyricsSyllabic syllabic)
    {
        if (lyrics && lyrics->syllabic() != syllabic) {
            lyrics->undoChangeProperty(mu::engraving::Pid::SYLLABIC, int(syllabic));
        }
    }

    // Opens the lyrics command: finds the lyric being typed (or the selected note's), applies the
    // text and removes the lyric if it is left empty. The caller ends the command.
    bool beginLyricsEntry(mu::engraving::Score* score,
                          const muse::String& lyricText,
                          const char* commandName,
                          LyricsEntryContext& context,
                          std::string& errorMessage)
    {
        mu::engraving::EngravingItem* selectedItem = currentSelectedItem(score);
        mu::engraving::Lyrics* selectedLyrics = selectedItem && selectedItem->isLyrics()
            ? mu::engraving::toLyrics(selectedItem)
            : nullptr;
        context.chordRest = selectedLyrics ? selectedLyrics->chordRest() : mu::engraving::InputState::chordRest(selectedItem);
        if (!context.chordRest || (!context.chordRest->isChord() && !selectedLyrics)) {
            errorMessage = "Select a note before adding lyrics.";
            return false;
        }

        context.verse = selectedLyrics ? selectedLyrics->verse() : 0;
        context.placement = selectedLyrics ? selectedLyrics->placement() : mu::engraving::PlacementV::BELOW;
        mu::engraving::Lyrics* lyrics = selectedLyrics ? selectedLyrics : context.chordRest->lyrics(context.verse, context.placement);
        if (lyrics) {
            context.placementFlags = lyrics->propertyFlags(mu::engraving::Pid::PLACEMENT);
            context.fontStyle = lyrics->fontStyle();
            context.fontStyleFlags = lyrics->propertyFlags(mu::engraving::Pid::FONT_STYLE);
            context.styleType = lyrics->textStyleType();
            context.hasStyle = true;
        }

        undo->prepareChanges(muse::TranslatableString::untranslatable(commandName));
        if (!lyricText.empty()) {
            if (!lyrics) {
                lyrics = createLyricsLike(context.chordRest, context, mu::engraving::LyricsSyllabic::SINGLE);
                lyrics->setPlainText(lyricText);
                score->undoAddElement(lyrics);
            } else {
                lyrics->undoChangeProperty(mu::engraving::Pid::TEXT, mu::engraving::TextBase::plainToXmlText(lyricText));
            }
            lyrics->adjustPrevious();
        } else if (lyrics && lyrics->plainText().trimmed().empty()) {
            score->undoRemoveElement(lyrics);
            lyrics = nullptr;
        }
        context.lyrics = lyrics;
        return true;
    }

    // The lyric a space, hyphen or underscore continues from: the current one, or the nearest
    // earlier one in this voice (only within the same repeat section when `adjacentOnly`).
    static mu::engraving::Lyrics* lyricsBefore(const LyricsEntryContext& context, const bool adjacentOnly, const bool stopAtRest)
    {
        if (context.lyrics) {
            return context.lyrics;
        }
        const mu::engraving::track_idx_t track = context.chordRest->track();
        mu::engraving::Segment* start = context.chordRest->segment();
        for (mu::engraving::Segment* segment = start; segment; segment = segment->prev1(mu::engraving::SegmentType::ChordRest)) {
            if (adjacentOnly && segment != start && !mu::engraving::segmentsAreAdjacent(segment, start)) {
                break;
            }
            mu::engraving::EngravingItem* item = segment->element(track);
            if (!item) {
                continue;
            }
            if (mu::engraving::Lyrics* lyrics = mu::engraving::toChordRest(item)->lyrics(context.verse, context.placement)) {
                return lyrics;
            }
            if (stopAtRest && segment != start && !item->isChord()) {
                break;
            }
        }
        return nullptr;
    }

    bool enterLyrics(const std::string& text,
                     const LyricsAdvance advance,
                     std::string& errorMessage)
    {
        if (!supportsEditing()) {
            errorMessage = "Editing is unavailable for this score session.";
            return false;
        }

        const muse::String lyricText = muse::String::fromUtf8(text.c_str()).trimmed();
        if (lyricText.empty() && advance == LyricsAdvance::None) {
            errorMessage = "Lyrics cannot be empty.";
            return false;
        }

        mu::engraving::Score* score = activeScore();
        if (advance == LyricsAdvance::Extension) {
            mu::engraving::EngravingItem* selectedItem = currentSelectedItem(score);
            if ((!selectedItem || !selectedItem->isLyrics()) && lyricText.empty()) {
                errorMessage = "Select lyrics on a note before adding an extension line.";
                return false;
            }
        }

        const char* commandName = advance == LyricsAdvance::Extension ? "MuseReader add lyrics extension line"
                                  : advance == LyricsAdvance::Syllable ? "MuseReader add lyrics hyphen"
                                  : "MuseReader edit lyrics";
        LyricsEntryContext context;
        if (!beginLyricsEntry(score, lyricText, commandName, context, errorMessage)) {
            return false;
        }

        const mu::engraving::track_idx_t track = context.chordRest->track();
        mu::engraving::Segment* segment = context.chordRest->segment();
        mu::engraving::Lyrics* selectAfter = context.lyrics;

        // The next note: any chord; for a space also a rest that already has this verse.
        mu::engraving::ChordRest* next = nullptr;
        if (advance != LyricsAdvance::None) {
            for (mu::engraving::Segment* s = segment->next1(mu::engraving::SegmentType::ChordRest); s;
                 s = s->next1(mu::engraving::SegmentType::ChordRest)) {
                mu::engraving::EngravingItem* item = s->element(track);
                if (!item) {
                    continue;
                }
                if (item->isChord()
                    || (advance == LyricsAdvance::Word && mu::engraving::toChordRest(item)->lyrics(context.verse, context.placement))) {
                    next = mu::engraving::toChordRest(item);
                    break;
                }
            }
            if (next && advance != LyricsAdvance::Word && !mu::engraving::segmentsAreAdjacent(segment, next->segment())) {
                next = nullptr;
            }
        }

        if (advance == LyricsAdvance::Word && next) {
            mu::engraving::Lyrics* from = lyricsBefore(context, false, false);
            mu::engraving::Lyrics* to = next->lyrics(context.verse, context.placement);
            const bool newLyrics = !to;
            if (to) {
                // Arrived by a space: the next lyric may start a word but not continue one.
                if (to->syllabic() == mu::engraving::LyricsSyllabic::END) {
                    changeSyllabic(to, mu::engraving::LyricsSyllabic::SINGLE);
                } else if (to->syllabic() == mu::engraving::LyricsSyllabic::MIDDLE) {
                    changeSyllabic(to, mu::engraving::LyricsSyllabic::BEGIN);
                }
            } else {
                to = createLyricsLike(next, context, mu::engraving::LyricsSyllabic::SINGLE);
            }
            if (from) {
                // Left by a space: the lyric may end a word but has no hyphen after it.
                if (from->syllabic() == mu::engraving::LyricsSyllabic::BEGIN) {
                    changeSyllabic(from, mu::engraving::LyricsSyllabic::SINGLE);
                } else if (from->syllabic() == mu::engraving::LyricsSyllabic::MIDDLE) {
                    changeSyllabic(from, mu::engraving::LyricsSyllabic::END);
                }
            }
            if (newLyrics) {
                score->undoAddElement(to);
            }
            selectAfter = to;
        } else if (advance == LyricsAdvance::Syllable && next) {
            mu::engraving::Lyrics* from = lyricsBefore(context, true, false);
            mu::engraving::Lyrics* to = next->lyrics(context.verse, context.placement);
            const bool newLyrics = !to;
            if (newLyrics) {
                to = createLyricsLike(next, context, mu::engraving::LyricsSyllabic::END);
            } else if (to->syllabic() == mu::engraving::LyricsSyllabic::BEGIN) {
                changeSyllabic(to, mu::engraving::LyricsSyllabic::MIDDLE);
            } else if (to->syllabic() == mu::engraving::LyricsSyllabic::SINGLE) {
                changeSyllabic(to, mu::engraving::LyricsSyllabic::END);
            }
            if (from) {
                // Left by a hyphen: the lyric starts or continues a word, without an extension line.
                if (from->syllabic() == mu::engraving::LyricsSyllabic::SINGLE) {
                    changeSyllabic(from, mu::engraving::LyricsSyllabic::BEGIN);
                } else if (from->syllabic() == mu::engraving::LyricsSyllabic::END) {
                    changeSyllabic(from, mu::engraving::LyricsSyllabic::MIDDLE);
                }
                if (from->ticks().isNotZero()) {
                    from->undoChangeProperty(mu::engraving::Pid::LYRIC_TICKS, mu::engraving::Fraction(0, 1));
                }
            }
            if (newLyrics) {
                score->undoAddElement(to);
            }
            selectAfter = to;
        } else if (advance == LyricsAdvance::Extension) {
            // The extension runs from the word's lyric, which may be several notes back when "_"
            // is typed repeatedly, up to the current note.
            const mu::engraving::Fraction endTick = segment->tick();
            mu::engraving::Lyrics* from = lyricsBefore(context, true, true);
            if (from) {
                if (from->syllabic() == mu::engraving::LyricsSyllabic::BEGIN
                    || from->syllabic() == mu::engraving::LyricsSyllabic::MIDDLE) {
                    changeSyllabic(from, mu::engraving::LyricsSyllabic::END);
                }
                const mu::engraving::Fraction fromTick = from->segment()->tick();
                if (fromTick < endTick) {
                    from->undoChangeProperty(mu::engraving::Pid::LYRIC_TICKS, endTick - fromTick);
                } else if (next) {
                    from->undoChangeProperty(mu::engraving::Pid::LYRIC_TICKS, mu::engraving::Lyrics::TEMP_MELISMA_TICKS);
                }
            }
            if (next) {
                mu::engraving::Lyrics* to = next->lyrics(context.verse, context.placement);
                if (!to) {
                    to = createLyricsLike(next, context, mu::engraving::LyricsSyllabic::SINGLE);
                    score->undoAddElement(to);
                } else if (to->syllabic() == mu::engraving::LyricsSyllabic::MIDDLE) {
                    changeSyllabic(to, mu::engraving::LyricsSyllabic::BEGIN);
                } else if (to->syllabic() == mu::engraving::LyricsSyllabic::END) {
                    changeSyllabic(to, mu::engraving::LyricsSyllabic::SINGLE);
                }
                selectAfter = to;
            } else {
                selectAfter = from;
            }
        }

        undo->commitChanges();
        refreshAfterEdit();
        if (selectAfter && selectAfter->explicitParent()) {
            score->select(selectAfter, mu::engraving::SelectType::SINGLE, selectAfter->staffIdx());
        } else if (mu::engraving::EngravingItem* note = noteOrRestSelectionItem(context.chordRest)) {
            score->select(note, mu::engraving::SelectType::SINGLE, note->staffIdx());
        }
        return true;
    }

};
}
