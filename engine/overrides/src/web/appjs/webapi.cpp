/*
 * SPDX-License-Identifier: GPL-3.0-only
 * MuseScore-Studio-CLA-applies
 *
 * MuseScore Studio
 * Music Composition & Notation
 *
 * Copyright (C) 2025 MuseScore Limited and others
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// Modified for MuseTab: see webapi.h.
#include "webapi.h"

#include <cmath>
#include <algorithm>
#include <vector>
#include <functional>

#include <QBuffer>
#include <QIcon>
#include <QImage>
#include <QPainter>
#include <QCoreApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QUrl>
#include <QDir>
#include <QFile>
#include <QFontDatabase>
#include <QGuiApplication>
#include <QQuickWindow>
#include <QQuickItem>
#include <QApplication>
#include <QDialog>
#include <QScrollArea>
#include <QVBoxLayout>
#include <QPointer>
#include <QTimer>
#include <QInputMethodEvent>
#include <QElapsedTimer>
#include "engraving/dom/textbase.h"

#ifdef Q_OS_WASM
#include <emscripten/val.h>
#endif

#include "global/io/buffer.h"
#include "global/io/file.h"
#include "global/modularity/ioc.h"
#include "global/iapplication.h"
#include "draw/internal/ifontsdatabase.h"
#include "actions/iactionsdispatcher.h"
#include "ui/iuiactionsregister.h"
#include "ui/iuiconfiguration.h"
#include "context/iglobalcontext.h"
#include "audio/main/istartaudiocontroller.h"
#include "audio/main/isoundfontcontroller.h"
#include "playback/iplaybackcontroller.h"
#include "project/inotationwritersregister.h"
#include "project/iprojectcreator.h"
#include "notation/inotationinteraction.h"
#include "notation/inotationselection.h"
#include "notation/inotationnoteinput.h"
#include "notation/inotationviewstate.h"
#include "notation/inotationconfiguration.h"
#include "notation/inotationelements.h"
#include "notation/inotationstyle.h"
#include "notation/inotationpainting.h"
#include "notationscene/qml/MuseScore/NotationScene/playbackcursor.h"
#include "global/async/notifylist.h"
#include "project/iprojectaudiosettings.h"
#include "audio/main/iplayback.h"
#include "engraving/dom/part.h"
#include "engraving/dom/staff.h"
#include "engraving/dom/factory.h"
#include "global/types/translatablestring.h"

#include "palette/internal/palettecreator.h"
#include "palette/internal/palettetree.h"
#include "palette/internal/palette.h"
#include "palette/internal/palettecell.h"
#include "palette/internal/palettecelliconengine.h"

#include "engraving/dom/engravingitem.h"
#include "engraving/dom/note.h"
#include "engraving/dom/chord.h"
#include "engraving/dom/stem.h"
#include "engraving/dom/hook.h"
#include "engraving/dom/accidental.h"
#include "engraving/dom/notedot.h"
#include "engraving/dom/score.h"
#include "engraving/dom/input.h"
#include "engraving/dom/segment.h"
#include "engraving/dom/utils.h"
#include "engraving/dom/rest.h"
#include "engraving/dom/measure.h"
#include "engraving/dom/masterscore.h"
#include "engraving/editing/undo.h"
#include "engraving/editing/editscoreproperties.h"
#include "engraving/dom/tempotext.h"
#include "engraving/dom/timesig.h"
#include "engraving/dom/key.h"
#include "engraving/dom/instrtemplate.h"
#include "engraving/dom/select.h"
#include "engraving/dom/navigate.h"
#include "engraving/dom/layoutbreak.h"
#include "engraving/dom/harmony.h"
#include "notation/iinstrumentsrepository.h"
#include "notation/imasternotation.h"
#include "engraving/editing/editsystemlocks.h"
#include "notation/internal/inotationundostack.h"
#include "engraving/rendering/iscorerenderer.h"
#include "arialyrics.h"

#include "log.h"

using namespace muse;
using namespace mu::appjs;

static const std::string mname("appjs");

static muse::modularity::ContextPtr s_ctx;

template<typename I>
static std::shared_ptr<I> webResolve()
{
    std::shared_ptr<I> p = muse::modularity::ioc(s_ctx)->resolve<I>(mname);
    if (!p && s_ctx) {
        p = muse::modularity::ioc()->resolve<I>(mname);
    }
    if (!p) {
        LOGE() << "not resolved: " << I::modularity_interfaceInfo().id;
    }
    return p;
}

static QQuickWindow* webWindow()
{
    static QPointer<QQuickWindow> cached;if(cached)return cached;
    for(auto* window:QGuiApplication::allWindows())if(window->objectName()=="ApplicationWindow"){cached=qobject_cast<QQuickWindow*>(window);return cached;}
    return nullptr;
}

static std::vector<QQuickItem*> visualItems()
{
    std::vector<QQuickItem*> result;auto* window=webWindow();if(!window)return result;
    std::function<void(QQuickItem*)> visit=[&](QQuickItem* parent){for(auto* child:parent->childItems()){result.push_back(child);visit(child);}};
    visit(window->contentItem());return result;
}

static QQuickItem* notationItem()
{
    static QPointer<QQuickItem> cached;if(cached)return cached;
    for(auto* item:visualItems())if(item->objectName()=="MainNotationView"){cached=item;return cached;}
    return nullptr;
}

static QPointF notationOffset()
{
    auto* item=notationItem();return item?item->mapToScene(QPointF()):QPointF();
}

// ---------------------------------------------------------------------------
// JS side
// ---------------------------------------------------------------------------
#ifdef Q_OS_WASM
static void sendEvent(const char* name, const QJsonObject& data)
{
    emscripten::val fn = emscripten::val::module_property("onEngineEvent");
    if (fn.typeOf().as<std::string>() != "function") {
        return;
    }
    const QByteArray json = QJsonDocument(data).toJson(QJsonDocument::Compact);
    fn(std::string(name), std::string(json.constData(), json.size()));
}

static void sendBytes(const char* fnname, const std::string& tag, const uint8_t* data, size_t size, bool ok)
{
    emscripten::val fn = emscripten::val::module_property(fnname);
    if (fn.typeOf().as<std::string>() != "function") {
        return;
    }
    emscripten::val jsArray = emscripten::val::global("Uint8Array").new_(emscripten::typed_memory_view(size, data));
    fn(tag, jsArray, ok);
}

#else
static void sendEvent(const char*, const QJsonObject&) {}
static void sendBytes(const char*, const std::string&, const uint8_t*, size_t, bool) {}
#endif

WebApi* WebApi::instance()
{
    static WebApi a;

    return &a;
}

// ---------------------------------------------------------------------------
// Lifecycle & subscriptions
// ---------------------------------------------------------------------------
void WebApi::init(const muse::modularity::ContextPtr& ctx)
{
    qApp->installEventFilter(this);
    m_ctx = ctx;
    s_ctx = ctx;

    auto globalContext = webResolve<mu::context::IGlobalContext>();
    if (!globalContext) {
        return;
    }

    globalContext->currentProjectChanged().onNotify(this, [this]() { onProjectChanged(); });
    globalContext->currentNotationChanged().onNotify(this, [this]() { onNotationChanged(); });

    if (auto actionsRegister = webResolve<muse::ui::IUiActionsRegister>()) {
        actionsRegister->actionStateChanged().onReceive(this, [](const actions::ActionCodeList& codes) {
            QJsonArray arr;
            for (const actions::ActionCode& code : codes) {
                arr.append(QString::fromStdString(code));
            }
            sendEvent("actions", QJsonObject { { "codes", arr } });
        });
    }

    if (auto playback = webResolve<mu::playback::IPlaybackController>()) {
        playback->isPlayingChanged().onNotify(this, [this]() { sendPlaying(); });
        playback->currentPlaybackPositionChanged().onReceive(this, [this](muse::audio::secs_t secs, muse::midi::tick_t tick) {
            const double s = secs.to_double();
            //! NOTE The page needs ~10 updates per second, not one per audio buffer
            if (std::abs(s - m_lastPositionSent) < 0.033) {
                return;
            }
            m_lastPositionSent = s;
            QJsonObject position { { "secs", s }, { "tick", static_cast<int>(tick) } };
            if(m_currentNotation){
                notation::PlaybackCursor cursor(m_ctx);cursor.setNotation(m_currentNotation);cursor.move(tick);
                const auto r=cursor.rect();const auto& pages=m_currentNotation->elements()->pages();
                for(size_t i=0;i<pages.size();++i){
                    const auto p=pages[i]->canvasBoundingRect();
                    if(!r.isNull()&&p.contains(r.center())){
                        position["cursor"]=QJsonObject{{"page",int(i)},{"x",(r.x()-p.x())/p.width()},{"y",(r.y()-p.y())/p.height()},{"w",r.width()/p.width()},{"h",r.height()/p.height()}};
                        break;
                    }
                }
            }
            sendEvent("position", position);
        });
    }

    onProjectChanged();
    onNotationChanged();
}

void WebApi::deinit()
{
    if (m_currentProject) {
        m_currentProject->saveComplited().disconnect(this);
    }
}

void WebApi::onProjectChanged()
{
    if (m_currentProject) {
        m_currentProject->saveComplited().disconnect(this);
    }

    auto gc = webResolve<mu::context::IGlobalContext>();
    m_currentProject = gc ? gc->currentProject() : nullptr;

    if (m_currentProject) {
        m_currentProject->saveComplited().onReceive(this, [this](const muse::io::path_t& path, project::SaveMode mode) {
            onProjectSaved(path, mode);
        });
    }

    sendProject();
}

void WebApi::onNotationChanged()
{
    if (m_currentNotation) {
        m_currentNotation->viewState()->matrixChanged().disconnect(this);
        m_currentNotation->interaction()->selectionChanged().disconnect(this);
        m_currentNotation->undoStack()->changesChannel().disconnect(this);
        m_currentNotation->interaction()->noteInput()->stateChanged().disconnect(this);
        m_currentNotation->interaction()->noteInput()->noteInputEnded().disconnect(this);
    }

    auto gc = webResolve<mu::context::IGlobalContext>();
    m_currentNotation = gc ? gc->currentNotation() : nullptr;
    m_pageLocked = false;

    if (m_currentNotation) {
        m_currentNotation->viewState()->matrixChanged().onReceive(this, [this](const muse::draw::Transform&, notation::NotationPaintView*) {
            if (m_pageLocked && m_currentNotation && m_currentNotation->viewState()->matrix() != m_pageMatrix) {
                m_currentNotation->viewState()->setMatrix(m_pageMatrix, nullptr);
            }
        });
        m_currentNotation->interaction()->selectionChanged().onNotify(this, [this]() { sendSelection(); });
        m_currentNotation->undoStack()->changesChannel().onReceive(this, [](const auto&) {
            sendEvent("changed", QJsonObject {});
        });
        m_currentNotation->interaction()->noteInput()->stateChanged().onNotify(this, [this]() { sendNoteInput(); });
        m_currentNotation->interaction()->noteInput()->noteInputEnded().onNotify(this, [this]() { sendNoteInput(); });
    }

    sendProject();
    sendSelection();
    sendNoteInput();
}

void WebApi::sync()
{
    sendProject();
    sendSelection();
    sendNoteInput();
    sendPlaying();
}

// ---------------------------------------------------------------------------
// State events
// ---------------------------------------------------------------------------
void WebApi::sendProject()
{
    QJsonObject o;
    o["open"] = m_currentNotation != nullptr;
    if (m_currentNotation) {
        o["title"] = m_currentNotation->projectWorkTitle();
        o["name"] = m_currentNotation->projectName();
    }
    sendEvent("project", o);
}

void WebApi::sendSelection()
{
    if(qApp->property("musetabBatchSelection").toBool())return;
    QJsonObject o;
    o["none"] = true;
    o["range"] = false;
    o["count"] = 0;

    if (m_currentNotation) {
        notation::INotationSelectionPtr sel = m_currentNotation->interaction()->selection();
        if (sel && !sel->isNone()) {
            o["none"] = false;
            o["range"] = sel->isRange();
            o["count"] = static_cast<int>(sel->elements().size());

            //! NOTE Position in view (CSS) pixels, so the page can anchor a popup to the selection
            const muse::RectF r = m_currentNotation->viewState()->matrix().map(sel->canvasBoundingRect());
            const auto offset=notationOffset();
            o["rect"] = QJsonObject { { "x", r.x()+offset.x() }, { "y", r.y()+offset.y() }, { "w", r.width() }, { "h", r.height() } };

            if (const mu::engraving::EngravingItem* el = sel->element()) {
                o["type"] = QString::fromLatin1(el->typeName());
                o["tick"] = el->tick().ticks();
                if(el->isTextBase())o["text"]=mu::engraving::toTextBase(el)->plainText().toQString();
                if (el->isNote()) {
                    o["pitch"] = mu::engraving::toNote(el)->pitch();
                }
                const engraving::ChordRest* cr=nullptr;
                if(el->isNote())cr=engraving::toNote(el)->chord();
                else if(el->isRest())cr=engraving::toRest(el);
                else if(el->isChord())cr=engraving::toChord(el);
                if(cr){
                    o["voice"]=int(cr->voice())+1;o["dots"]=cr->dots();
                    // A full-measure rest has V_MEASURE, whose duration fraction is
                    // intentionally invalid (0/0). Use its actual measure duration.
                    const auto duration=cr->durationType().fraction();
                    o["durationTicks"]=(duration.denominator()?duration:cr->ticks()).ticks();
                    o["measureIndex"]=cr->measure()->no();
                    if(cr->isChord()){QJsonArray pitches;for(const auto* note:engraving::toChord(cr)->notes())pitches.append(note->pitch());o["chordPitches"]=pitches;}
                }
            }
        }
    }

    sendEvent("selection", o);
}

void WebApi::sendNoteInput()
{
    QJsonObject o;
    o["active"] = m_currentNotation && m_currentNotation->interaction()->noteInput()->isNoteInputMode();
    sendEvent("noteInput", o);
}

void WebApi::sendPlaying()
{
    auto playback = webResolve<mu::playback::IPlaybackController>();
    sendEvent("playing", QJsonObject { { "playing", playback && playback->isPlaying() } });
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
void WebApi::load(const void* source, unsigned int len)
{
    open(source, len, "mscz");
}

bool WebApi::loadTextFont(const void* source, unsigned int len)
{
    static bool loaded=false;
    if(loaded)return true;
    if(!source||len<1024||len>24*1024*1024)return false;
    const int id=QFontDatabase::addApplicationFontFromData(QByteArray(static_cast<const char*>(source),len));
    const auto families=QFontDatabase::applicationFontFamilies(id);
    loaded=id>=0&&!families.isEmpty();
    if(loaded)for(const auto& family:QStringList{"Edwin","FreeSerif","Times New Roman","Arial"})QFont::insertSubstitution(family,families.front());
    sendEvent("text-font",QJsonObject{{"loaded",loaded},{"id",id},{"families",QJsonArray::fromStringList(families)}});
    return loaded;
}

std::string WebApi::viewRect() const
{
    auto* item=notationItem();const auto pos=notationOffset();
    const QJsonObject r{{"x",pos.x()},{"y",pos.y()},{"w",item?item->width():0},{"h",item?item->height():0}};
    return QJsonDocument(r).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::composerState(const std::string& json)
{
    auto* window=webWindow();if(!window)return "{}";
    const auto patch=QJsonDocument::fromJson(QByteArray::fromStdString(json)).object();
    window->setProperty("composerBridge",QVariant::fromValue(static_cast<QObject*>(this)));
    if(patch.contains("dark"))if(auto config=webResolve<muse::ui::IUiConfiguration>())config->setCurrentTheme(patch["dark"].toBool()?muse::ui::DARK_THEME_CODE:muse::ui::LIGHT_THEME_CODE);
    if(patch.contains("locked"))window->setProperty("composerLocked",patch["locked"].toBool());
    if(patch.contains("panel"))window->setProperty("composerPanel",patch["panel"].toString());
    if(patch.contains("keyboard"))window->setProperty("composerKeyboard",patch["keyboard"].toBool());
    if(patch.contains("enabled"))window->setProperty("composerEnabled",patch["enabled"].toBool());
    if(patch["enabled"].toBool())window->requestActivate();
    if(patch.contains("metering")){
        static std::vector<muse::audio::AudioSignalChanges> meters;static unsigned generation=0;
        const unsigned current=++generation;for(auto& meter:meters)meter.disconnect(this);meters.clear();
        if(patch["metering"].toBool()){
            const auto playback=webResolve<muse::audio::IPlayback>();const auto controller=webResolve<mu::playback::IPlaybackController>();
            if(playback&&controller){
                const auto bind=[this,current](int id,muse::audio::AudioSignalChanges changes){
                    if(current!=generation)return;meters.push_back(changes);auto elapsed=std::make_shared<QElapsedTimer>();elapsed->start();
                    changes.onReceive(this,[this,current,id,elapsed](const muse::audio::AudioSignalValuesMap& values){
                        if(current!=generation||elapsed->elapsed()<50)return;elapsed->restart();double level=0;for(const auto& entry:values)level=std::max(level,std::pow(10.,entry.second.pressure.to_double()/20.));
                        sendEvent("mixer-level",QJsonObject{{"id",id},{"level",std::clamp(level,0.,1.)}});
                    });
                };
                playback->masterSignalChanges().onResolve(this,[bind](muse::audio::AudioSignalChanges changes){bind(-1,changes);});
                for(const auto& entry:controller->instrumentTrackIdMap()){const int id=entry.second;playback->signalChanges(controller->currentTrackSequenceId(),id).onResolve(this,[bind,id](muse::audio::AudioSignalChanges changes){bind(id,changes);});}
            }
        }
    }
    bool pitchOk=false;QString pitchError;
    if(patch.contains("pitchCommand")){
        const int pitch=patch["pitchCommand"].toObject()["pitch"].toInt(-1);
        if(!m_currentNotation||!window->property("composerEnabled").toBool()||window->property("composerLocked").toBool())pitchError="请进入编谱模式";
        else if(pitch<21||pitch>108)pitchError="音高超出钢琴范围";
        else{
            const auto interaction=m_currentNotation->interaction();
            auto* selected=interaction->selection()->element();
            if(selected&&selected->isNote()){
                auto* note=engraving::toNote(selected);auto* score=m_currentNotation->elements()->msScore();
                const auto value=score->noteVal(pitch,note->staffIdx(),true);
                const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria keyboard pitch"));
                score->undoChangePitch(note,value.pitch,value.tpc1,value.tpc2);undo->commitChanges();pitchOk=true;sendSelection();
            }else if(selected&&selected->isRest()){
                static const int steps[]={0,0,1,1,2,3,3,4,4,5,5,6};static const int black[]={0,1,0,1,0,0,1,0,1,0,1,0};
                pitchOk=addPitch(steps[pitch%12],pitch/12-1,black[pitch%12],false);
                interaction->noteInput()->endNoteInput(false);sendSelection();sendNoteInput();
            }else pitchError="Select a note or rest before using the keyboard.";
        }
    }
    bool textOk=false;QString textError;
    if(patch.contains("textCommand")){
        const auto command=patch["textCommand"].toObject();
        const QString text=command["text"].toString();
        if(!m_currentNotation||!window->property("composerEnabled").toBool()||window->property("composerLocked").toBool())textError="请先解锁编谱";
        else if(text.size()>10000)textError="文本过长";
        else{
            const auto interaction=m_currentNotation->interaction();
            const std::string code=command["code"].toString().toStdString();
            if(code=="lyrics"){
                musetabAria::LyricsCommands lyrics(m_currentNotation->elements()->msScore(),m_currentNotation->undoStack());
                const auto advance=!command["advance"].toBool()?musetabAria::LyricsCommands::LyricsAdvance::None:command["mode"].toString()=="hyphen"?musetabAria::LyricsCommands::LyricsAdvance::Syllable:command["mode"].toString()=="melisma"?musetabAria::LyricsCommands::LyricsAdvance::Extension:musetabAria::LyricsCommands::LyricsAdvance::Word;
                std::string message;textOk=lyrics.enterLyrics(text.toStdString(),advance,message);textError=QString::fromStdString(message);sendSelection();sendNoteInput();
            }else{
            auto* score=m_currentNotation->elements()->msScore();auto* selected=interaction->selection()->element();
            auto* anchor=engraving::InputState::chordRest(selected);
            if(!anchor&&selected&&selected->isHarmony()&&selected->parentItem()&&selected->parentItem()->isSegment()){
                auto* segment=engraving::toSegment(selected->parentItem());auto* at=segment->element(selected->track());if(at&&at->isChordRest())anchor=engraving::toChordRest(at);
            }
            const std::map<std::string,engraving::TextStyleType> styles={{"staff-text",engraving::TextStyleType::STAFF},{"system-text",engraving::TextStyleType::SYSTEM},{"expression-text",engraving::TextStyleType::EXPRESSION},{"rehearsalmark-text",engraving::TextStyleType::REHEARSAL_MARK},{"chord-text",engraving::TextStyleType::HARMONY_A},{"roman-numeral-text",engraving::TextStyleType::HARMONY_ROMAN},{"nashville-number-text",engraving::TextStyleType::HARMONY_NASHVILLE},{"fingering-text",engraving::TextStyleType::FINGERING}};
            engraving::TextBase* target=command["replace"].toBool()&&selected&&selected->isTextBase()?engraving::toTextBase(selected):nullptr;
            if(code=="chord-text"){
                if(selected&&selected->isHarmony())target=engraving::toTextBase(selected);
                else if(anchor)for(auto* item:anchor->segment()->annotations())if(item->isHarmony()&&item->track()==anchor->track()){target=engraving::toTextBase(item);break;}
            }
            const auto style=styles.find(code);
            if(!target&&(!anchor||style==styles.end()))textError="请先选择音符或可编辑的文字";
            else{
                const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria edit text"));
                const bool existing=target!=nullptr;
                if(!target)target=score->addText(style->second,selected);
                if(!target){undo->rollbackChanges();textError="无法在当前选区添加该文本";}
                else{
                    engraving::EngravingItem* selectionAfter=target;
                    if(existing&&text.trimmed().isEmpty()){selectionAfter=anchor?static_cast<engraving::EngravingItem*>(anchor->isChord()?engraving::toChord(anchor)->upNote():static_cast<engraving::EngravingItem*>(anchor)):nullptr;score->undoRemoveElement(target);}
                    else if(!text.isEmpty()||code!="rehearsalmark-text")target->undoChangeProperty(engraving::Pid::TEXT,engraving::TextBase::plainToXmlText(String::fromQString(text)));
                    undo->commitChanges();
                    if(command["advance"].toBool()&&anchor){engraving::ChordRestNavigateOptions nav;nav.skipGrace=true;auto* next=command["previous"].toBool()?engraving::prevChordRest(anchor,nav):engraving::nextChordRest(anchor,nav);if(next){selectionAfter=next->isChord()?engraving::toChord(next)->upNote():static_cast<engraving::EngravingItem*>(next);for(auto* item:next->segment()->annotations())if(item->isHarmony()&&item->track()==next->track()){selectionAfter=item;break;}}}
                    if(selectionAfter)interaction->select({selectionAfter});else interaction->clearSelection();
                    sendSelection();sendNoteInput();textOk=true;
                }
            }
            }
        }
    }
    bool editOk=false;QString editError;QJsonObject editState;
    if(m_currentNotation){
        auto* score=m_currentNotation->elements()->msScore();auto* master=score->masterScore();
        const auto interaction=m_currentNotation->interaction();
        auto* item=interaction->selection()->element();
        auto* measure=item?item->findMeasure():score->selection().startSegment()?score->selection().startSegment()->measure():score->firstMeasure();
        if(!measure)measure=score->firstMeasure();
        if(patch["editorInfo"].toBool()){
            QJsonObject metadata;
            for(const auto* tag:{"workTitle","subtitle","composer","lyricist","arranger"})metadata[tag]=master->metaTag(String::fromUtf8(tag)).toQString();
            editState["metadata"]=metadata;
            if(const auto masterNotation=m_currentProject->masterNotation()){
                QJsonArray excerpts;excerpts.append(QJsonObject{{"id","full-score"},{"name","Full Score"},{"selected",masterNotation->notation()==m_currentNotation}});
                const auto append=[&](const notation::ExcerptNotationList& list,const QString& prefix){for(size_t i=0;i<list.size();++i)excerpts.append(QJsonObject{{"id",prefix+QString::number(i)},{"name",list[i]->name()},{"selected",list[i]->isInited()&&list[i]->notation()==m_currentNotation}});};
                append(masterNotation->excerpts(),"excerpt:");append(masterNotation->potentialExcerpts(),"potential:");editState["parts"]=excerpts;
            }
            if(auto* first=score->firstMeasure()){
                editState["nominalNumerator"]=first->timesig().numerator();editState["nominalDenominator"]=first->timesig().denominator();
                editState["pickupNumerator"]=first->ticks().numerator();editState["pickupDenominator"]=first->ticks().denominator();
                editState["hasPickup"]=first->ticks()<first->timesig();
                editState["currentNumerator"]=measure?measure->timesig().numerator():first->timesig().numerator();editState["currentDenominator"]=measure?measure->timesig().denominator():first->timesig().denominator();
                editState["key"]=score->nstaves()?int(score->staff(0)->key(measure?measure->tick():first->tick())):0;
            }
        }
        if(patch["instrumentCatalog"].toBool())if(const auto repo=webResolve<notation::IInstrumentsRepository>()){
            QJsonArray instruments;for(const auto* t:repo->instrumentTemplates())if(t)instruments.append(QJsonObject{{"id",t->id.toQString()},{"name",t->trackName.toQString()},{"group",t->groupId.toQString()},{"staves",int(t->staffCount)}});editState["instruments"]=instruments;
        }
        if(patch.contains("editCommand")){
            const auto c=patch["editCommand"].toObject();const auto op=c["op"].toString();
            if(!window->property("composerEnabled").toBool()||window->property("composerLocked").toBool())editError="Open the score editor first.";
            else if(op=="fingering"){
                auto* target=item&&item->isFingering()?item->parentItem():item;
                if(target&&target->isChord())target=engraving::toChord(target)->upNote();
                const int finger=c["finger"].toInt(-1);
                if(!target||!target->isNote()||finger<0||finger>5)editError="Select a note before adding or removing fingering.";
                else{
                    auto* note=engraving::toNote(target);std::vector<engraving::TextBase*> existing;
                    for(auto* attached:note->el())if(attached&&attached->isFingering())existing.push_back(engraving::toTextBase(attached));
                    const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria set fingering"));
                    if(!finger){for(auto* f:existing)score->undoRemoveElement(f);}
                    else{
                        auto* f=existing.empty()?score->addText(engraving::TextStyleType::FINGERING,note):existing.front();
                        if(f)f->undoChangeProperty(engraving::Pid::TEXT,String::number(finger));
                        for(size_t i=1;i<existing.size();++i)score->undoRemoveElement(existing[i]);
                    }
                    undo->commitChanges();interaction->select({note});editOk=true;
                    engraving::ChordRestNavigateOptions navigation;navigation.skipGrace=true;navigation.skipMeasureRepeatRests=false;
                    auto* adjacent=finger?engraving::nextChordRest(note->chord(),navigation):engraving::prevChordRest(note->chord(),navigation);
                    while(adjacent&&adjacent->isRest())adjacent=finger?engraving::nextChordRest(adjacent,navigation):engraving::prevChordRest(adjacent,navigation);
                    if(adjacent&&adjacent->isChord())interaction->select({engraving::toChord(adjacent)->upNote()});
                }
            }else if(op=="selectPart"){
                const auto masterNotation=m_currentProject->masterNotation();const auto id=c["id"].toString();notation::INotationPtr target;
                if(id=="full-score")target=masterNotation->notation();
                else{const bool potential=id.startsWith("potential:");const int index=id.mid(id.indexOf(':')+1).toInt();const auto list=potential?masterNotation->potentialExcerpts():masterNotation->excerpts();if(index>=0&&index<int(list.size())){if(!list[index]->isInited())masterNotation->initExcerpts({list[index]});target=list[index]->notation();}}
                if(target){webResolve<mu::context::IGlobalContext>()->setCurrentNotation(target);editOk=true;}else editError="That part is unavailable.";
            }else if(op=="addInstrument"||op=="removeInstrument"){
                const auto parts=m_currentProject->masterNotation()->parts();
                if(op=="removeInstrument"){
                    const muse::ID id(c["id"].toString());if(!parts->partExists(id)||parts->partList().size()<=1)editError="Keep at least one instrument in the score.";else{parts->removeParts({id});editOk=true;}
                }else if(const auto repo=webResolve<notation::IInstrumentsRepository>()){
                    const auto& t=repo->instrumentTemplate(String::fromQString(c["id"].toString()));
                    if(!t.isValid())editError="That instrument is unavailable.";
                    else{notation::PartInstrumentList list;for(const auto* p:parts->partList()){notation::PartInstrument old;old.partId=p->id();old.isExistingPart=true;old.isSoloist=p->soloist();list.append(old);}notation::PartInstrument added;added.instrumentTemplate=t;list.append(added);parts->setParts(list,parts->scoreOrder());editOk=true;}
                }
            }else if(op=="extendEnd"){
                const auto matrix=m_currentNotation->viewState()->matrix();const auto offset=notationOffset();const auto point=matrix.inverted().map(PointF(c["x"].toDouble()-offset.x(),c["y"].toDouble()-offset.y()));auto* target=interaction->hitElement(point,float(12./std::max(.02,matrix.m11())));
                auto* end=target?target->findMeasure():nullptr;if(end){interaction->select({end},notation::SelectType::RANGE);m_currentNotation->viewState()->setMatrix(matrix,nullptr);editOk=true;}else editError="Tap the last measure in the selection.";
            }else if(op=="addMeasures"){
                const int count=c["count"].toInt();if(count<1||count>64||!measure)editError="Choose between 1 and 64 measures.";
                else{auto* before=measure->nextMeasure();const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria add measures"));for(int i=0;i<count;++i)score->insertMeasure(engraving::ElementType::MEASURE,before);undo->commitChanges();editOk=true;}
            }else if(op=="removeBreak"){
                if(!measure)editError="Select a measure first.";
                else{const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria remove layout break"));std::vector<engraving::EngravingItem*> breaks;for(auto* el:measure->el())if(el->isLayoutBreak())breaks.push_back(el);for(auto* el:breaks)score->undoRemoveElement(el);undo->commitChanges();editOk=true;}
            }else if(op=="keepTogether"){
                interaction->toggleLayoutBreak(engraving::LayoutBreakType::NOBREAK);editOk=true;
            }else if(op=="metadata"){
                auto tags=master->metaTags();const auto metadata=c["metadata"].toObject();
                const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria score setup"));
                for(const auto* tag:{"workTitle","subtitle","composer","lyricist","arranger"})if(metadata.contains(tag))tags[String::fromUtf8(tag)]=String::fromQString(metadata[tag].toString().trimmed());
                master->undo(new engraving::ChangeMetaTags(master,tags));
                const std::vector<std::pair<const char*,engraving::TextStyleType>> fields={{"workTitle",engraving::TextStyleType::TITLE},{"subtitle",engraving::TextStyleType::SUBTITLE},{"composer",engraving::TextStyleType::COMPOSER},{"lyricist",engraving::TextStyleType::LYRICIST}};
                for(const auto& field:fields){if(!metadata.contains(field.first))continue;const auto value=engraving::TextBase::plainToXmlText(tags[String::fromUtf8(field.first)]);engraving::TextBase* text=master->getText(field.second);if(!text&&!value.empty())text=master->addText(field.second);if(text){if(value.empty())master->undoRemoveElement(text);else text->undoChangeProperty(engraving::Pid::TEXT,value);}}
                undo->commitChanges();master->setLayoutAll();sendProject();editOk=true;
            }else if(op=="autoBreaks"){
                const auto mode=c["mode"].toString();const int count=c["count"].toInt();
                if(!score->firstMeasure()||(mode=="measures"&&(count<1||count>32)))editError="Choose between 1 and 32 measures per system.";
                else{const bool whole=!interaction->selection()->isRange();if(whole)interaction->selectAll();const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria auto system breaks"));engraving::EditSystemLocks::addRemoveSystemLocks(score,mode=="measures"?count:0,mode=="lock");undo->commitChanges();if(whole)interaction->clearSelection();editOk=true;}
            }else if(op=="tempo"){
                const int bpm=c["bpm"].toInt();const auto unit=c["unit"].toString();
                if(bpm<20||bpm>300||!measure)editError="Enter a tempo from 20 to 300 BPM.";
                else{
                    auto* segment=measure->undoGetSegment(engraving::SegmentType::ChordRest,measure->tick());
                    if(segment){
                        const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria tempo"));
                        engraving::TempoText* tempo=nullptr;for(auto* annotation:segment->annotations())if(annotation->isTempoText()){tempo=engraving::toTempoText(annotation);break;}
                        const auto symbol=unit=="half"?u"metNoteHalfUp":unit=="eighth"?u"metNote8thUp":u"metNoteQuarterUp";
                        auto xml=String(u"<sym>%1</sym>").arg(String(symbol));if(unit=="dottedQuarter")xml+=u"<sym>space</sym><sym>metAugmentationDot</sym>";xml+=String(u" = %1").arg(bpm);
                        const auto label=String::fromQString(c["text"].toString().trimmed());if(!label.empty())xml=label.toXmlEscaped()+u" "+xml;
                        const double multiplier=unit=="half"?2.:unit=="eighth"?.5:unit=="dottedQuarter"?1.5:1.;
                        const auto value=engraving::BeatsPerSecond::fromBPM(engraving::BeatsPerMinute(bpm*multiplier));
                        if(!tempo){tempo=engraving::Factory::createTempoText(segment);tempo->setTrack(0);tempo->setXmlText(xml);tempo->setTempo(value);tempo->setFollowText(true);score->undoAddElement(tempo);}
                        else{engraving::EngravingItem* tempoItem=tempo;tempoItem->undoChangeProperty(engraving::Pid::TEXT,xml);tempoItem->undoChangeProperty(engraving::Pid::TEMPO,value);tempoItem->undoChangeProperty(engraving::Pid::TEMPO_FOLLOW_TEXT,true);}
                        tempo->updateTempo();score->setTempo(segment,tempo->tempo());undo->commitChanges();interaction->select({tempo});editOk=true;
                    }
                }
            }else if(op=="pickup"){
                auto* first=master->firstMeasure();const engraving::Fraction length(c["numerator"].toInt(),std::max(1,c["denominator"].toInt()));
                const bool remove=c["remove"].toBool();
                if(!first||(!remove&&(length<=engraving::Fraction(0,1)||length>=first->timesig())))editError="A pickup measure must be shorter than one full measure.";
                else{const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria pickup measure"));
                    if(remove){first->adjustToLen(first->timesig());first->undoChangeProperty(engraving::Pid::IRREGULAR,false);}
                    else{if(first->ticks()==first->timesig())first=engraving::toMeasure(master->insertMeasure(first));if(first){first->undoChangeProperty(engraving::Pid::IRREGULAR,true);first->adjustToLen(length);}}
                    undo->commitChanges();editOk=first!=nullptr;
                }
            }else if(op=="time"){
                const int numerator=c["numerator"].toInt(),denominator=c["denominator"].toInt();if(c["fromStart"].toBool())measure=score->firstMeasure();
                if(!measure||numerator<1||numerator>64||!(denominator==1||denominator==2||denominator==4||denominator==8||denominator==16))editError="Choose a valid time signature.";
                else{const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria time signature"));auto* sig=engraving::Factory::createTimeSig(score->dummy()->segment());sig->setSig(engraving::Fraction(numerator,denominator),c["style"].toString()=="common"?engraving::TimeSigType::FOUR_FOUR:c["style"].toString()=="cut"?engraving::TimeSigType::ALLA_BREVE:engraving::TimeSigType::NORMAL);score->cmdAddTimeSig(measure,0,sig,false);undo->commitChanges();editOk=true;}
            }else if(op=="key"){
                const int key=c["key"].toInt(99);if(c["fromStart"].toBool())measure=score->firstMeasure();
                if(!measure||key< -7||key>7)editError="Choose a valid key signature.";
                else{const auto undo=m_currentNotation->undoStack();undo->prepareChanges(TranslatableString::untranslatable("Aria key signature"));engraving::KeySigEvent event;event.setConcertKey(static_cast<engraving::Key>(key));event.setKey(static_cast<engraving::Key>(key));for(auto* staff:score->staves())if(!staff->isDrumStaff(measure->tick()))score->undoChangeKeySig(staff,measure->tick(),event);undo->commitChanges();editOk=true;}
            }else if(op=="transpose"){
                const auto mode=c["mode"].toString();notation::TransposeOptions options;
                options.mode=mode=="key"?notation::TransposeMode::TO_KEY:mode=="diatonic"?notation::TransposeMode::DIATONICALLY:notation::TransposeMode::BY_INTERVAL;
                options.direction=c["down"].toBool()?notation::TransposeDirection::DOWN:notation::TransposeDirection::UP;
                options.interval=c["interval"].toInt();options.key=static_cast<notation::Key>(std::clamp(c["key"].toInt(),-7,7));options.needTransposeKeys=true;options.needTransposeChordNames=true;
                if(c["whole"].toBool())interaction->selectAll();
                editOk=!interaction->selection()->isNone()&&interaction->transpose(options);if(!editOk)editError="Select the notes to transpose.";
            }else editError="Unknown editing command.";
            sendSelection();sendNoteInput();
        }
    }
    QJsonArray actionCatalog;
    if(patch["actions"].toBool())if(auto registry=webResolve<muse::ui::IUiActionsRegister>())for(const auto& action:registry->actionList()){
        // MuseScore aliases notation-opened/focused to project-opened/focused.
        if(action.scCtx.find("notation")==std::string::npos&&action.scCtx.find("project")==std::string::npos)continue;
        const auto state=registry->actionState(action.code);
        actionCatalog.append(QJsonObject{{"code",QString::fromStdString(action.code)},{"title",action.title.qTranslatedWithoutMnemonic()},{"enabled",state.enabled},{"checked",state.checked}});
    }
    QWidget* dialog=QApplication::activeModalWidget();
    if(!dialog)for(auto* widget:QApplication::topLevelWidgets())if(qobject_cast<QDialog*>(widget)&&widget->isVisible()){dialog=widget;break;}
    QWindow* popup=QGuiApplication::focusWindow();
    if(popup==window||(popup&&popup->type()!=Qt::Popup&&popup->type()!=Qt::Dialog))popup=nullptr;
    if(patch["closePopup"].toBool()){if(dialog)dialog->close();else if(popup)popup->close();}
    QJsonArray controls;
    if(patch["inspect"].toBool())for(auto* item:visualItems()){
        if(!item->isVisible())continue;
        const auto name=item->objectName(),tip=item->property("toolTipTitle").toString();
        if(!name.startsWith("mt-")&&tip.isEmpty())continue;
        const auto r=item->mapRectToScene(QRectF(0,0,item->width(),item->height()));
        controls.append(QJsonObject{{"name",name},{"label",tip},{"type",QString::fromLatin1(item->metaObject()->className())},
            {"x",r.x()},{"y",r.y()},{"w",r.width()},{"h",r.height()},{"enabled",item->isEnabled()}});
    }
    return QJsonDocument(QJsonObject{{"enabled",window->property("composerEnabled").toBool()},
        {"locked",window->property("composerLocked").toBool()},{"panel",window->property("composerPanel").toString()},
        {"keyboard",window->property("composerKeyboard").toBool()},{"controls",controls},
        {"actions",actionCatalog},{"textOk",textOk},{"textError",textError},{"editOk",editOk},{"editError",editError},{"editorInfo",editState},
        {"pitchOk",pitchOk},{"pitchError",pitchError},
        {"modalOpen",bool(dialog||popup)},{"applicationActive",QGuiApplication::applicationState()==Qt::ApplicationActive},
        {"activeWindow",window->isActive()}}).toJson(QJsonDocument::Compact).toStdString();
}

static void fitNativeDialog(QDialog* dialog)
{
    auto* window=webWindow();if(!window||!window->property("composerEnabled").toBool()||!dialog)return;
    const QSize available(std::max(220,window->width()-20),std::max(180,window->height()-36));
    if(!dialog->property("musetabScrollDialog").toBool()&&(dialog->width()>available.width()||dialog->height()>available.height())){
        auto* content=new QWidget();auto* original=dialog->layout();if(!original){delete content;return;}
        const auto size=dialog->size().expandedTo(original->minimumSize());
        content->setLayout(original);content->setMinimumSize(size);
        auto* scroll=new QScrollArea(dialog);scroll->setWidget(content);scroll->setWidgetResizable(true);
        auto* outer=new QVBoxLayout(dialog);outer->setContentsMargins(0,0,0,0);outer->setSizeConstraint(QLayout::SetNoConstraint);outer->addWidget(scroll);
        dialog->setProperty("musetabScrollDialog",true);dialog->setMinimumSize(0,0);
    }
    dialog->resize(dialog->size().boundedTo(available));
    dialog->move(std::max(0,(window->width()-dialog->width())/2),std::max(0,(window->height()-dialog->height())/2));
}

bool WebApi::eventFilter(QObject* object,QEvent* event)
{
    if(event->type()!=QEvent::Show&&event->type()!=QEvent::Resize)return QObject::eventFilter(object,event);
    auto* window=webWindow();
    if(window&&window->property("composerEnabled").toBool()){
        if(event->type()==QEvent::Show)if(auto* dialog=qobject_cast<QDialog*>(object)){
            const QPointer<QDialog> guard(dialog);
            if(window->property("composerLocked").toBool()&&QString::fromLatin1(dialog->metaObject()->className()).contains("Transpose")){
                QTimer::singleShot(0,this,[this,guard](){if(guard)guard->reject();composerEvent("unlock");});
            }else QTimer::singleShot(0,this,[guard](){if(guard)fitNativeDialog(guard);});
        }
        if(object==window&&event->type()==QEvent::Resize)QTimer::singleShot(0,this,[]{for(auto* widget:QApplication::topLevelWidgets())if(auto* dialog=qobject_cast<QDialog*>(widget);dialog&&dialog->isVisible())fitNativeDialog(dialog);});
    }
    return QObject::eventFilter(object,event);
}

void WebApi::composerEvent(const QString& kind)
{
    sendEvent(kind=="unlock"?"edit-unlock-request":"composer-ui",QJsonObject{{"kind",kind}});
}

void WebApi::fitComposerView()
{
    auto* window=webWindow();auto* view=notationItem();
    if(!window||!window->property("composerEnabled").toBool()||!view||!m_currentNotation)return;
    const double width=view->width(),height=view->height();if(width<100||height<80)return;
    const auto& pages=m_currentNotation->elements()->pages();if(pages.empty())return;
    const auto matrix=m_currentNotation->viewState()->matrix();
    const auto centre=matrix.inverted().map(PointF(width/2,height/2));
    const engraving::Page* nearest=pages.front();double best=1e100;
    for(const auto* page:pages){const auto c=page->canvasBoundingRect().center();const double distance=std::hypot(centre.x()-c.x(),centre.y()-c.y());if(distance<best){best=distance;nearest=page;}}
    const auto r=nearest->canvasBoundingRect();const double margin=width<600?8:20,scale=(width-margin*2)/r.width();
    m_currentNotation->viewState()->setMatrix(muse::draw::Transform(scale,0,0,scale,margin-r.x()*scale,margin-r.y()*scale),nullptr);
    sendSelection();composerEvent("layout");
}

void WebApi::open(const void* source, unsigned int len, const std::string& ext)
{
    LOGI() << "len: " << len << ", ext: " << ext;
    auto fail = [](const QString& message) {
        sendEvent("error", QJsonObject { { "operation", "open" }, { "message", message } });
    };
    const std::vector<std::string> formats { "mscz", "mscx", "xml", "musicxml", "mxl", "mid", "midi" };
    if (!source || !len || len > 32 * 1024 * 1024 || std::find(formats.begin(), formats.end(), ext) == formats.end()) {
        fail(QStringLiteral("文件格式或大小不受支持（最大 32 MB）"));
        return;
    }
    auto creator = webResolve<mu::project::IProjectCreator>();
    auto gc = webResolve<mu::context::IGlobalContext>();
    if (!creator || !gc) {
        fail(QStringLiteral("乐谱核心尚未就绪"));
        return;
    }
    static unsigned int serial = 0;
    static io::path_t lastPath;
    const io::path_t path("/mu/temp/import-" + std::to_string(++serial) + "." + ext);
    // MemFileSystem retains this array after the JavaScript allocation is freed.
    const ByteArray data(reinterpret_cast<const uint8_t*>(source), len);
    Ret ret = io::File::writeFile(path, data);
    auto candidate = creator->newProject(m_ctx);
    if (ret && candidate) {
        ret = candidate->load(path, project::OpenParams(), ext);
    }
    if (!ret || !candidate) {
        io::File::remove(path);
        fail(QStringLiteral("没能读取这份乐谱：") + QString::fromStdString(ret.toString()));
        return;
    }
    // Commit only a successfully parsed document. The desktop file-open action
    // reuses identical paths and can show save dialogs for a virtual file;
    // IndexedDB persistence and navigation are managed by MuseTab instead.
    // Project and notation notifications are separate. Keep the previous score
    // alive until every subscriber has switched away from its raw score pointer.
    const auto previousProject = gc->currentProject();
    dispatch("stop");
    gc->setCurrentProject(candidate);
    if (!lastPath.empty()) {
        io::File::remove(lastPath);
    }
    lastPath = path;
    sendEvent("opened", QJsonObject {});
}

void WebApi::exportTo(const std::string& ext)
{
    if (!m_currentProject || !m_currentNotation) {
        sendBytes("onEngineExport", ext, nullptr, 0, false);
        return;
    }

    if (ext == "mscz") {
        QByteArray bytes;
        QBuffer buf(&bytes);
        buf.open(QIODevice::WriteOnly);
        Ret ret = m_currentProject->writeToDevice(&buf);
        if (!ret) {
            LOGE() << "failed to write mscz: " << ret.toString();
        }
        sendBytes("onEngineExport", ext, reinterpret_cast<const uint8_t*>(bytes.constData()), bytes.size(), bool(ret));
        return;
    }

    auto writers = webResolve<mu::project::INotationWritersRegister>();
    mu::project::INotationWriterPtr writer = writers ? writers->writer(ext) : nullptr;
    if (!writer) {
        LOGE() << "no writer for: " << ext;
        sendBytes("onEngineExport", ext, nullptr, 0, false);
        return;
    }

    io::Buffer buf;
    buf.open(io::IODevice::WriteOnly);
    Ret ret = writer->write(m_currentNotation, buf);
    if (!ret) {
        LOGE() << "failed to export " << ext << ": " << ret.toString();
    }
    const ByteArray& out = buf.data();
    sendBytes("onEngineExport", ext, out.constData(), out.size(), bool(ret));
}

void WebApi::onProjectSaved(const muse::io::path_t& path, mu::project::SaveMode)
{
    ByteArray data;
    Ret ret = io::File::readFile(path, data);
    if (!ret) {
        LOGE() << "failed read file, path: " << path;
        return;
    }

    sendBytes("onEngineExport", "mscz", data.constData(), data.size(), true);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
void WebApi::dispatch(const std::string& actionCode)
{
    auto* window=webWindow();
    if ((!window||!window->property("composerEnabled").toBool())&&(actionCode == "page-settings" || actionCode == "edit-style" || actionCode == "transpose")) {
        sendEvent("mobile-dialog", QJsonObject { { "kind", QString::fromStdString(actionCode) } });
        return;
    }
    auto dispatcher = webResolve<muse::actions::IActionsDispatcher>();
    if (dispatcher) {
        dispatcher->dispatch(actionCode);
    }
}

void WebApi::setPageLock(bool enabled)
{
    qApp->setProperty("musetabBitmapReader",enabled);
    if (enabled && m_currentNotation) m_pageMatrix = m_currentNotation->viewState()->matrix();
    m_pageLocked = enabled;
}

void WebApi::selectAt(double x, double y)
{
    if(!m_currentNotation || !std::isfinite(x) || !std::isfinite(y))return;
    const auto view=m_currentNotation->viewState();const auto matrix=view->matrix();
    const auto interaction=m_currentNotation->interaction();
    const auto offset=notationOffset();
    const auto point=matrix.inverted().map(PointF(x-offset.x(),y-offset.y()));
    auto* item=interaction->hitElement(point,float(8.0/std::max(.02,matrix.m11())));
    if(item){
        interaction->select({item},notation::SelectType::REPLACE);
        const auto playback=webResolve<playback::IPlaybackController>();
        if(playback&&playback->isPlaying())playback->seekElement(item);
    }else interaction->clearSelection();
    // Selecting a note must never trigger the mouse controller's canvas drag or recentering.
    view->setMatrix(matrix,nullptr);
    sendSelection();
}

void WebApi::selectPageAt(int page, double x, double y)
{
    if(!m_currentNotation||!std::isfinite(x)||!std::isfinite(y)||x<0||x>1||y<0||y>1)return;
    const auto& pages=m_currentNotation->elements()->pages();if(page<0||page>=int(pages.size()))return;
    const auto r=pages[page]->canvasBoundingRect();
    const auto point=m_currentNotation->viewState()->matrix().map(PointF(r.x()+r.width()*x,r.y()+r.height()*y));
    const auto offset=notationOffset();selectAt(point.x()+offset.x(),point.y()+offset.y());
}

std::string WebApi::pageMetrics() const
{
    QJsonArray list;if(m_currentNotation)for(const auto* page:m_currentNotation->elements()->pages()){
        const auto r=page->canvasBoundingRect();
        // Read the live view transform without fitting or moving the canvas.
        const auto view=m_currentNotation->viewState()->matrix().map(r);
        list.append(QJsonObject{{"w",r.width()},{"h",r.height()},
            {"rect",QJsonObject{{"x",view.x()+notationOffset().x()},{"y",view.y()+notationOffset().y()},{"w",view.width()},{"h",view.height()}}}});
    }
    return QJsonDocument(list).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::selectionImage(int pixels)
{
    if(!m_currentNotation)return "{}";
    const auto sel=m_currentNotation->interaction()->selection();
    if(sel->isNone()||sel->isRange()||sel->elements().size()>64)return "{}";
    const auto& pages=m_currentNotation->elements()->pages();
    const auto* first=sel->elements().front();int index=-1;
    for(size_t i=0;i<pages.size();++i)if(pages[i]->canvasBoundingRect().contains(first->canvasBoundingRect().center())){index=int(i);break;}
    if(index<0)return "{}";
    const auto page=pages[index]->canvasBoundingRect();std::vector<const engraving::EngravingItem*> items;
    for(const auto* item:sel->elements()){
        items.push_back(item);
        if(item->isNote()){
            const auto* note=engraving::toNote(item);const auto* chord=note->chord();
            if(note->accidental())items.push_back(note->accidental());
            for(const auto* dot:note->dots())items.push_back(dot);
            if(chord&&chord->stem())items.push_back(chord->stem());
            if(chord&&chord->hook())items.push_back(chord->hook());
        }
    }
    RectF bounds;for(const auto* item:items)bounds=bounds.united(item->pageBoundingRect());
    bounds=bounds.adjusted(-2,-2,2,2);const double scale=std::clamp(pixels,800,2400)/page.width();
    const int width=std::clamp(int(std::ceil(bounds.width()*scale)),1,4096),height=std::clamp(int(std::ceil(bounds.height()*scale)),1,4096);
    QImage image(width,height,QImage::Format_ARGB32_Premultiplied);image.fill(Qt::transparent);
    const auto renderer=webResolve<engraving::rendering::IScoreRenderer>();if(!renderer)return "{}";
    {
        muse::draw::Painter painter(&image,"MuseTab native selected elements");painter.scale(scale,scale);painter.translate(-bounds.x(),-bounds.y());
        engraving::rendering::PaintOptions opt;opt.isPrinting=false;
        const auto config=webResolve<notation::INotationConfiguration>();opt.invertColors=config&&config->shouldInvertScore();
        for(const auto* item:items)renderer->paintItem(painter,item,opt);
    }
    QByteArray bytes;QBuffer buffer(&bytes);buffer.open(QIODevice::WriteOnly);image.save(&buffer,"PNG");
    return QJsonDocument(QJsonObject{{"page",index},{"x",bounds.x()/page.width()},{"y",bounds.y()/page.height()},{"w",bounds.width()/page.width()},{"h",bounds.height()/page.height()},{"src",QString::fromLatin1(bytes.toBase64())}}).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::pageView(int page, double width, double height)
{
    QJsonObject result { { "index", 0 }, { "count", 0 } };
    if (!m_currentNotation || width <= 0 || height <= 0) return QJsonDocument(result).toJson(QJsonDocument::Compact).toStdString();
    m_currentNotation->setViewMode(notation::ViewMode::PAGE);
    const auto& pages = m_currentNotation->elements()->pages();
    if (pages.empty()) return QJsonDocument(result).toJson(QJsonDocument::Compact).toStdString();
    if (page < 0) {
        const PointF centre = m_currentNotation->viewState()->matrix().inverted().map(PointF(width / 2, height / 2));
        double best = 1e100;
        for (size_t i = 0; i < pages.size(); ++i) {
            const RectF r = pages[i]->canvasBoundingRect();
            const double distance = std::hypot(centre.x() - r.center().x(), centre.y() - r.center().y());
            if (distance < best) { best = distance; page = int(i); }
        }
    }
    page = std::clamp(page, 0, int(pages.size()) - 1);
    m_readerPage = page;
    const RectF r = pages[page]->canvasBoundingRect();
    if (r.width() <= 0 || r.height() <= 0) return "{}";
    const double scale = std::min(width / r.width(), height / r.height());
    const double x = (width - r.width() * scale) / 2 - r.x() * scale;
    const double y = (height - r.height() * scale) / 2 - r.y() * scale;
    m_pageMatrix = muse::draw::Transform(scale, 0, 0, scale, x, y);
    m_currentNotation->viewState()->setMatrix(m_pageMatrix, nullptr);
    sendSelection();
    result["index"] = page; result["count"] = int(pages.size());
    result["rect"] = QJsonObject { { "x", (width-r.width()*scale)/2 }, { "y", (height-r.height()*scale)/2 }, { "w", r.width()*scale }, { "h", r.height()*scale } };
    return QJsonDocument(result).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::gestureView(double factor, double dx, double dy, double cx, double cy)
{
    if (!m_currentNotation || !std::isfinite(factor) || factor<=0 || !std::isfinite(dx) || !std::isfinite(dy)) return "{}";
    const auto offset=notationOffset();cx-=offset.x();cy-=offset.y();
    const auto old = m_currentNotation->viewState()->matrix();
    if(!std::isfinite(old.m11())||old.m11()<0.0001||!std::isfinite(old.m22())||!std::isfinite(cx)||!std::isfinite(cy))return "{}";
    factor=std::clamp(old.m11()*factor,.02,20.)/old.m11();
    const muse::draw::Transform next(old.m11()*factor,0,0,old.m22()*factor,
        (old.dx()-cx)*factor+cx+dx,(old.dy()-cy)*factor+cy+dy);
    if (m_pageLocked) m_pageMatrix=next;
    m_currentNotation->viewState()->setMatrix(next,nullptr);
    sendSelection();
    const auto& pages=m_currentNotation->elements()->pages();
    if(pages.empty())return "{}";
    const auto r=next.map(pages[std::clamp(m_readerPage,0,int(pages.size())-1)]->canvasBoundingRect());
    return QJsonDocument(QJsonObject{{"rect",QJsonObject{{"x",r.x()},{"y",r.y()},{"w",r.width()},{"h",r.height()}}}}).toJson(QJsonDocument::Compact).toStdString();
}

void WebApi::readerLayout(int mode)
{
    if(!m_currentNotation)return;
    auto config=webResolve<notation::INotationConfiguration>();
    if(config)config->setCanvasOrientation(mode==0?muse::Orientation::Horizontal:muse::Orientation::Vertical);
    m_currentNotation->setViewMode(mode==2?notation::ViewMode::SYSTEM:notation::ViewMode::PAGE);
}

std::string WebApi::renderPage(int page, int pixels)
{
    if(!m_currentNotation)return "";
    const auto painting=m_currentNotation->painting();
    if(page<0||page>=painting->pageCount())return "";
    const auto size=painting->pageSizeInch();
    const int dpi=std::clamp(int(std::clamp(pixels,600,2400)/size.width()),40,300);
    QImage image(std::ceil(size.width()*dpi),std::ceil(size.height()*dpi),QImage::Format_ARGB32_Premultiplied);
    image.setDotsPerMeterX(std::lround(dpi*1000/25.4));image.setDotsPerMeterY(std::lround(dpi*1000/25.4));
    auto config=webResolve<notation::INotationConfiguration>();
    image.fill(config&&config->shouldInvertScore()?QColor(32,26,20):(config?config->foregroundColor():QColor(Qt::white)));
    {
        muse::draw::Painter painter(&image,"MuseTab reader page");
        notation::INotationPainting::Options opt;opt.fromPage=page;opt.toPage=page;opt.deviceDpi=dpi;opt.printPageBackground=false;
        opt.invertColors=config&&config->shouldInvertScore();
        painting->paintPng(&painter,opt);
    }
    QByteArray bytes;QBuffer buffer(&bytes);buffer.open(QIODevice::WriteOnly);image.save(&buffer,"PNG");
    return bytes.toBase64().toStdString();
}

std::string WebApi::scoreStyle() const
{
    if (!m_currentNotation) return "{}";
    using Sid = mu::engraving::Sid;
    const auto style = m_currentNotation->style();
    const auto real = [&](Sid id) { return style->styleValue(id).toDouble(); };
    const auto sp = [&](Sid id) { return style->styleValue(id).value<mu::engraving::Spatium>().val(); };
    QJsonObject o {
        { "width", real(Sid::pageWidth)*25.4 }, { "height", real(Sid::pageHeight)*25.4 },
        { "left", real(Sid::pageOddLeftMargin)*25.4 },
        { "right", (real(Sid::pageWidth)-real(Sid::pagePrintableWidth)-real(Sid::pageOddLeftMargin))*25.4 },
        { "top", real(Sid::pageOddTopMargin)*25.4 }, { "bottom", real(Sid::pageOddBottomMargin)*25.4 },
        { "twoSided", style->styleValue(Sid::pageTwosided).toBool() },
        { "spatium", real(Sid::spatium)/mu::engraving::DPMM },
        { "staffDistance", sp(Sid::staffDistance) }, { "minSystemDistance", sp(Sid::minSystemDistance) },
        { "maxSystemDistance", sp(Sid::maxSystemDistance) }, { "measureSpacing", real(Sid::measureSpacing) },
        { "staffLineWidth", sp(Sid::staffLineWidth) },
        { "verticalSpread", style->styleValue(Sid::enableVerticalSpread).toBool() }
    };
    return QJsonDocument(o).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::scorePanels() const
{
    if(!m_currentProject||!m_currentNotation)return "{}";
    QJsonArray parts,channels;
    const auto p=m_currentNotation->parts();
    const auto controller=webResolve<mu::playback::IPlaybackController>();
    for(const auto* part:p->partList()){
        QJsonArray staves;
        for(const auto* staff:p->staffList(part->id())){
            int playbackMask=0;
            for(int voice=0;voice<mu::engraving::VOICES;++voice)if(staff->playbackVoice(voice))playbackMask|=1<<voice;
            staves.append(QJsonObject{{"id",QString::fromStdString(staff->id().toStdString())},{"index",int(staff->idx())},{"playbackMask",playbackMask},{"visible",p->staffConfig(staff->id()).visible},{"audible",playbackMask!=0},{"lines",staff->lines(mu::engraving::Fraction(0,1))}});
        }
        bool audible=true,found=false;
        if(controller)for(const auto& entry:controller->instrumentTrackIdMap())if(entry.first.partId==part->id()){
            if(!found)audible=false;
            found=true;audible|=!controller->trackSoloMuteState(entry.first).mute;
        }
        parts.append(QJsonObject{{"id",QString::fromStdString(part->id().toStdString())},{"name",part->partName().toQString()},{"visible",part->show()},{"audible",audible},{"staves",staves}});
    }
    const auto settings=m_currentProject->audioSettings();
    if(controller)for(const auto& entry:controller->instrumentTrackIdMap()){
        const auto& id=entry.first;const auto& out=settings->trackOutputParams(id);const auto& sm=controller->trackSoloMuteState(id);
        const auto* part=p->part(id.partId);
        channels.append(QJsonObject{{"id",int(entry.second)},{"name",part?part->partName().toQString():QStringLiteral("节拍器")},
            {"sound",QString::fromStdString(settings->trackInputParams(id).resourceMeta.id)},
            {"volume",out.volume.to_double()},{"pan",double(out.balance)},{"muted",sm.mute},{"solo",sm.solo}});
    }
    const auto& master=settings->masterAudioOutputParams();
    channels.append(QJsonObject{{"id",-1},{"name",QStringLiteral("全局")},{"sound",QStringLiteral("主输出")},{"volume",master.volume.to_double()},{"pan",double(master.balance)},{"muted",master.muted},{"solo",false}});
    return QJsonDocument(QJsonObject{{"parts",parts},{"channels",channels}}).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::changeMixer(const std::string& json)
{
    if(!m_currentProject||!m_currentNotation)return "{\"ok\":false}";
    const auto data=QJsonDocument::fromJson(QByteArray::fromStdString(json)).object();
    if(!data["id"].isDouble())return "{\"ok\":false}";
    const int id=data["id"].toInt();const auto settings=m_currentProject->audioSettings();
    const auto controller=webResolve<mu::playback::IPlaybackController>();const auto playback=webResolve<muse::audio::IPlayback>();
    if(!controller||!playback)return "{\"ok\":false}";
    mu::engraving::InstrumentTrackId instrumentId;bool found=false;
    for(const auto& entry:controller->instrumentTrackIdMap())if(int(entry.second)==id){instrumentId=entry.first;found=true;break;}
    if(id!=-1&&!found)return "{\"ok\":false}";
    auto out=id==-1?settings->masterAudioOutputParams():settings->trackOutputParams(instrumentId);
    if(data.contains("volume")){const double v=data["volume"].toDouble(999);if(!std::isfinite(v)||v< -60||v>12)return "{\"ok\":false}";out.volume=v;}
    if(data.contains("pan")){const double v=data["pan"].toDouble(999);if(!std::isfinite(v)||v< -1||v>1)return "{\"ok\":false}";out.balance=v;}
    if(id==-1){if(data.contains("muted"))out.muted=data["muted"].toBool();settings->setMasterAudioOutputParams(out);playback->setMasterOutputParams(out);}
    else{
        settings->setTrackOutputParams(instrumentId,out);playback->setOutputParams(controller->currentTrackSequenceId(),id,out);
        auto sm=controller->trackSoloMuteState(instrumentId);
        if(data.contains("muted"))sm.mute=data["muted"].toBool();if(data.contains("solo"))sm.solo=data["solo"].toBool();
        controller->setTrackSoloMuteState(instrumentId,sm);
    }
    sendEvent("changed",QJsonObject{});return "{\"ok\":true}";
}

std::string WebApi::changeParts(const std::string& json)
{
    if(!m_currentNotation)return "{\"ok\":false}";
    const auto data=QJsonDocument::fromJson(QByteArray::fromStdString(json)).object();const auto parts=m_currentNotation->parts();
    const muse::ID id(data["id"].toString());const auto op=data["op"].toString();
    const bool visibilityChange=op=="part-visible"||op=="staff-visible";
    if(visibilityChange)m_currentNotation->interaction()->clearSelection();
    if(op=="part-visible"&&parts->partExists(id))parts->setPartVisible(id,data["visible"].toBool());
    else if(op=="staff-visible"&&parts->staffExists(id))parts->setStaffVisible(id,data["visible"].toBool());
    else if(op=="part-audible"&&parts->partExists(id)&&data["audible"].isBool()){
        const auto controller=webResolve<mu::playback::IPlaybackController>();if(!controller)return "{\"ok\":false}";
        bool found=false;
        for(const auto& entry:controller->instrumentTrackIdMap())if(entry.first.partId==id){
            auto state=controller->trackSoloMuteState(entry.first);state.mute=!data["audible"].toBool();
            controller->setTrackSoloMuteState(entry.first,state);found=true;
        }
        if(!found)return "{\"ok\":false}";
        sendEvent("changed",QJsonObject{});
    }else if(op=="staff-audible"&&parts->staffExists(id)&&data["audible"].isBool()){
        auto* staff=const_cast<mu::engraving::Staff*>(parts->staff(id));
        const bool audible=data["audible"].toBool();
        const mu::engraving::Pid properties[]={mu::engraving::Pid::PLAYBACK_VOICE1,mu::engraving::Pid::PLAYBACK_VOICE2,mu::engraving::Pid::PLAYBACK_VOICE3,mu::engraving::Pid::PLAYBACK_VOICE4};
        const auto undo=m_currentNotation->undoStack();
        undo->prepareChanges(muse::TranslatableString("undoableAction","Change staff playback"));
        for(int voice=0;voice<mu::engraving::VOICES;++voice)if(staff->playbackVoice(voice)!=audible)staff->undoChangeProperty(properties[voice],mu::engraving::PropertyValue(audible));
        undo->commitChanges();
    }
    else if(op=="add-staff"&&parts->partExists(id)){
        auto* part=const_cast<mu::engraving::Part*>(parts->part(id));auto* staff=mu::engraving::Factory::createStaff(part);
        if(!part->staves().empty())staff->init(part->staves().back());
        if(!parts->appendStaff(staff,id)){delete staff;return "{\"ok\":false}";}
    }else if(op=="move-part"&&parts->partExists(id)){
        const muse::ID target(data["target"].toString());if(!parts->partExists(target)||id==target)return "{\"ok\":false}";
        parts->moveParts({id},target,data["after"].toBool()?notation::INotationParts::InsertMode::After:notation::INotationParts::InsertMode::Before);
    }else if(op=="move-staff"&&parts->staffExists(id)){
        const muse::ID target(data["target"].toString());if(!parts->staffExists(target)||id==target)return "{\"ok\":false}";
        parts->moveStaves({id},target,data["after"].toBool()?notation::INotationParts::InsertMode::After:notation::INotationParts::InsertMode::Before);
    }else return "{\"ok\":false}";
    return "{\"ok\":true}";
}

std::string WebApi::applyScoreStyle(const std::string& json)
{
    const auto fail = [](const char* text) { return QJsonDocument(QJsonObject { { "ok", false }, { "message", QString::fromUtf8(text) } }).toJson(QJsonDocument::Compact).toStdString(); };
    if (!m_currentNotation) return fail("请先打开乐谱");
    QJsonParseError parseError;
    const auto document = QJsonDocument::fromJson(QByteArray::fromStdString(json), &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) return fail("设置格式不正确");
    QJsonObject values = QJsonDocument::fromJson(QByteArray::fromStdString(scoreStyle())).object();
    const auto patch = document.object();
    for (auto it = patch.begin(); it != patch.end(); ++it) {
        if (!values.contains(it.key()) || (it.value().isBool() != values[it.key()].isBool()) || (!it.value().isBool() && !it.value().isDouble())) return fail("设置值不正确");
        values[it.key()] = it.value();
    }
    const auto n = [&](const char* key) { return values[key].toDouble(); };
    const auto range = [&](const char* key, double min, double max) { const double v=n(key); return std::isfinite(v) && v>=min && v<=max; };
    bool pageChanged=false;
    for(const char* key:{"width","height","left","right","top","bottom","twoSided"}) if(patch.contains(key)) pageChanged=true;
    if (pageChanged && (!range("width",60,1000)||!range("height",60,2000)||!range("left",0,990)||!range("right",0,990)
        ||!range("top",0,1990)||!range("bottom",0,1990)||n("left")+n("right")>n("width")-10||n("top")+n("bottom")>n("height")-10)) return fail("页面尺寸或页边距不正确");
    const auto suppliedRange=[&](const char* key,double min,double max){return !patch.contains(key)||range(key,min,max);};
    if (!suppliedRange("spatium",.5,5)||!suppliedRange("staffDistance",0,30)||!suppliedRange("minSystemDistance",0,80)||!suppliedRange("maxSystemDistance",0,80)
        ||((patch.contains("minSystemDistance")||patch.contains("maxSystemDistance"))&&n("maxSystemDistance")<n("minSystemDistance"))
        ||!suppliedRange("measureSpacing",.5,4)||!suppliedRange("staffLineWidth",.03,.5)) return fail("谱面间距或线宽不正确");
    using Sid = mu::engraving::Sid;
    using Property = mu::engraving::PropertyValue;
    using Sp = mu::engraving::Spatium;
    const bool twoSided = values["twoSided"].toBool();
    std::vector<std::pair<Sid, Property>> changes {
        {Sid::pageWidth,Property(n("width")/25.4)}, {Sid::pageHeight,Property(n("height")/25.4)},
        {Sid::pagePrintableWidth,Property((n("width")-n("left")-n("right"))/25.4)},
        {Sid::pageOddLeftMargin,Property(n("left")/25.4)}, {Sid::pageEvenLeftMargin,Property((twoSided?n("right"):n("left"))/25.4)},
        {Sid::pageOddTopMargin,Property(n("top")/25.4)}, {Sid::pageEvenTopMargin,Property(n("top")/25.4)},
        {Sid::pageOddBottomMargin,Property(n("bottom")/25.4)}, {Sid::pageEvenBottomMargin,Property(n("bottom")/25.4)},
        {Sid::pageTwosided,Property(twoSided)}, {Sid::spatium,Property(n("spatium")*mu::engraving::DPMM)},
        {Sid::staffDistance,Property(Sp(n("staffDistance")))}, {Sid::minSystemDistance,Property(Sp(n("minSystemDistance")))},
        {Sid::maxSystemDistance,Property(Sp(n("maxSystemDistance")))}, {Sid::measureSpacing,Property(n("measureSpacing"))},
        {Sid::staffLineWidth,Property(Sp(n("staffLineWidth")))}, {Sid::enableVerticalSpread,Property(values["verticalSpread"].toBool())}
    };
    const auto style = m_currentNotation->style();
    changes.erase(std::remove_if(changes.begin(),changes.end(),[&](const auto& v){
        const char* key=nullptr;
        switch(v.first){
        case Sid::spatium:key="spatium";break;case Sid::staffDistance:key="staffDistance";break;
        case Sid::minSystemDistance:key="minSystemDistance";break;case Sid::maxSystemDistance:key="maxSystemDistance";break;
        case Sid::measureSpacing:key="measureSpacing";break;case Sid::staffLineWidth:key="staffLineWidth";break;
        case Sid::enableVerticalSpread:key="verticalSpread";break;default:break;
        }
        return (key ? !patch.contains(key) : !pageChanged) || style->styleValue(v.first)==v.second;
    }),changes.end());
    if (!changes.empty()) {
        const auto undo = m_currentNotation->undoStack();
        undo->prepareChanges(muse::TranslatableString("undoableAction", "Change score style"));
        for (const auto& change : changes) style->setStyleValue(change.first, change.second);
        undo->commitChanges();
    }
    return "{\"ok\":true}";
}

std::string WebApi::transposeScore(int key, int direction, bool wholeScore)
{
    if (!m_currentNotation || key < -7 || key > 7 || direction < 0 || direction > 2) return "{\"ok\":false}";
    if (wholeScore) m_currentNotation->interaction()->selectAll();
    if (m_currentNotation->interaction()->selection()->isNone()) return "{\"ok\":false,\"message\":\"请先选择要移调的音符或乐句\"}";
    notation::TransposeOptions options;
    options.mode = notation::TransposeMode::TO_KEY;
    options.direction = static_cast<notation::TransposeDirection>(direction);
    options.key = static_cast<notation::Key>(key);
    options.needTransposeKeys = true; options.needTransposeChordNames = true;
    const bool ok = m_currentNotation->interaction()->transpose(options);
    return ok ? "{\"ok\":true}" : "{\"ok\":false,\"message\":\"移调没有成功，请检查音符范围\"}";
}

int WebApi::actionState(const std::string& actionCode) const
{
    auto actionsRegister = webResolve<muse::ui::IUiActionsRegister>();
    if (!actionsRegister) {
        return -1;
    }

    if (!actionsRegister->action(actionCode).isValid()) {
        return -1;
    }

    muse::ui::UiActionState st = actionsRegister->actionState(actionCode);
    return (st.enabled ? 1 : 0) | (st.checked ? 2 : 0);
}

// ---------------------------------------------------------------------------
// Symbol palettes
// ---------------------------------------------------------------------------
static mu::palette::PaletteTreePtr paletteTree(const muse::modularity::ContextPtr& ctx)
{
    static mu::palette::PaletteTreePtr tree;
    if (!tree) {
        tree = mu::palette::PaletteCreator(ctx).newMasterPaletteTree();
    }
    return tree;
}

std::string WebApi::palettes()
{
    QJsonArray arr;
    for (const mu::palette::PalettePtr& p : paletteTree(m_ctx)->palettes) {
        arr.append(QJsonObject { { "name", p->translatedName() }, { "id", p->id() }, { "cells", p->cellsCount() } });
    }
    return QJsonDocument(arr).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::palette(int index)
{
    mu::palette::PaletteTreePtr tree = paletteTree(m_ctx);
    if (index < 0 || index >= static_cast<int>(tree->palettes.size())) {
        return "{}";
    }

    mu::palette::PalettePtr p = tree->palettes.at(index);

    //! NOTE Cells are drawn by the engine itself, so the panel shows exactly what will be added
    const qreal dpr = 2.0;
    const QSize grid = p->scaledGridSize();

    QJsonArray cells;
    for (const mu::palette::PaletteCellPtr& cell : p->cells()) {
        QImage img(grid * dpr, QImage::Format_ARGB32_Premultiplied);
        img.setDevicePixelRatio(dpr);
        img.fill(Qt::transparent);
        {
            QPainter painter(&img);
            painter.setRenderHint(QPainter::Antialiasing, true);
            mu::palette::PaletteCellIconEngine icon(cell, m_ctx);
            icon.paint(&painter, QRect(QPoint(0, 0), grid), QIcon::Normal, QIcon::Off);
        }

        QByteArray png;
        QBuffer buf(&png);
        buf.open(QIODevice::WriteOnly);
        img.save(&buf, "PNG");

        cells.append(QJsonObject {
            { "name", cell->translatedName() },
            { "png", QString::fromLatin1(png.toBase64()) },
        });
    }

    QJsonObject o { { "name", p->translatedName() }, { "id", p->id() }, { "w", grid.width() }, { "h", grid.height() },
                    { "cells", cells } };
    return QJsonDocument(o).toJson(QJsonDocument::Compact).toStdString();
}

bool WebApi::applyPaletteCell(int paletteIndex, int cellIndex)
{
    if (!m_currentNotation) {
        return false;
    }

    mu::palette::PaletteTreePtr tree = paletteTree(m_ctx);
    if (paletteIndex < 0 || paletteIndex >= static_cast<int>(tree->palettes.size())) {
        return false;
    }

    mu::palette::PalettePtr p = tree->palettes.at(paletteIndex);
    if (cellIndex < 0 || cellIndex >= p->cellsCount()) {
        return false;
    }

    mu::palette::PaletteCellPtr cell = p->cellAt(cellIndex);
    if (!cell || !cell->element) {
        return false;
    }

    return m_currentNotation->interaction()->applyPaletteElement(cell->element.get());
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
void WebApi::addSoundFont(const std::string& uri)
{
    auto controller = webResolve<muse::audio::ISoundFontController>();
    if (controller) {
        controller->addSoundFont(Uri(uri));
    }
}

void WebApi::startAudioProcessing()
{
    auto controller = webResolve<muse::audio::IStartAudioController>();
    if (controller) {
        controller->startAudioProcessing(IApplication::RunMode::GuiApp);
    }
}

void WebApi::setCanvasTheme(bool dark, const std::string& paper, const std::string& canvas)
{
    qApp->setProperty("musetabTransparentPaper",paper=="none");
    auto conf = webResolve<mu::notation::INotationConfiguration>();
    if (!conf) {
        return;
    }
    conf->setForegroundUseColor(true);
    conf->setForegroundColor(paper=="none"?QColor(Qt::transparent):QColor(QString::fromStdString(paper)));
    conf->setBackgroundUseColor(true);
    conf->setBackgroundColor(QColor(QString::fromStdString(canvas)));
    conf->setOnlyInvertInDarkTheme(false);
    conf->setScoreInversionEnabled(dark);
}

void WebApi::setViewOnly(bool viewOnly)
{
    qApp->setProperty("musetabViewOnly", viewOnly);
}

void WebApi::setTempoMultiplier(double multiplier)
{
    auto playback = webResolve<mu::playback::IPlaybackController>();
    if (playback) {
        playback->setTempoMultiplier(multiplier);
    }
}

std::string WebApi::playbackInfo() const
{
    const auto controller=webResolve<mu::playback::IPlaybackController>();
    QJsonObject info{{"duration",controller?controller->totalPlayTime().to_double():0.0}};
    if(m_currentNotation){auto* score=m_currentNotation->elements()->msScore();auto* measure=score->firstMeasure();const int index=controller?controller->currentBeat().measureIndex:0;for(int i=0;measure&&i<index;++i)measure=measure->nextMeasure();if(!measure)measure=score->firstMeasure();if(measure){info["bpm"]=score->tempo(measure->tick()).toBPM().val;info["numerator"]=measure->timesig().numerator();info["denominator"]=measure->timesig().denominator();}}
    return QJsonDocument(info).toJson(QJsonDocument::Compact).toStdString();
}

bool WebApi::seekSeconds(double seconds)
{
    const auto controller=webResolve<mu::playback::IPlaybackController>();
    if(!controller||!m_currentNotation||!std::isfinite(seconds))return false;
    controller->seek(std::clamp(seconds,0.0,controller->totalPlayTime().to_double()),true);
    return true;
}

bool WebApi::addPitch(int step, int octave, int accidental, bool chord)
{
    if(!m_currentNotation||qApp->property("musetabViewOnly").toBool()||step<0||step>6||octave<0||octave>8||accidental<0||accidental>1)return false;
    const auto input=m_currentNotation->interaction()->noteInput();
    if(!input->isNoteInputMode())input->startNoteInput(mu::notation::NoteInputMethod::BY_NOTE_NAME,false);
    if(!input->isNoteInputMode())return false;
    input->setRestMode(false);
    auto* score=m_currentNotation->elements()->msScore();
    engraving::Position pos;pos.segment=score->inputState().segment();pos.staffIdx=score->inputState().track()/engraving::VOICES;
    const auto* selected=m_currentNotation->interaction()->selection()->element();
    if(chord&&selected&&selected->isNote()){
        const auto* selectedChord=engraving::toNote(selected)->chord();pos.segment=selectedChord->segment();pos.staffIdx=selectedChord->vStaffIdx();
    }
    if(!pos.segment||pos.staffIdx>=score->nstaves())return false;
    pos.line=engraving::relStep((octave+1)*7+step,score->staff(pos.staffIdx)->clef(pos.segment->tick()));
    bool pitchError=false;const auto automatic=score->noteValForPosition(pos,engraving::AccidentalType::NONE,pitchError);
    static const int semitones[]={0,2,4,5,7,9,11};const int wanted=(octave+1)*12+semitones[step]+accidental;
    const auto required=accidental?engraving::AccidentalType::SHARP:engraving::AccidentalType::NATURAL;
    input->setAccidental(!pitchError&&automatic.pitch==wanted?engraving::AccidentalType::NONE:required);
    mu::notation::NoteInputParams params;params.step=(octave+1)*7+step;
    input->addNote(params,chord?mu::notation::NoteAddingMode::CurrentChord:mu::notation::NoteAddingMode::NextChord);
    sendSelection();sendNoteInput();
    return true;
}

