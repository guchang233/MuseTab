// SPDX-License-Identifier: GPL-3.0-only
// Compose with the actual MuseScore QML panels shipped by mscore-web-engine.
import QtQuick
import MuseScore.AppShell
import QtQuick.Layouts
import Muse.Ui
import Muse.UiComponents
import MuseScore.NotationScene
import MuseScore.Palette
import MuseScore.Inspector
import MuseScore.InstrumentsScene
import MuseScore.Playback

Item {
    id: root
    property var bridge: null
    property var notationView: null
    property bool editLocked: true
    property string panel: "symbols"
    property bool pianoVisible: true
    // Touch tools live in the app layer. Keep upstream panels available as
    // advanced tools without reserving a second desktop toolbar above the score.
    property bool touchMode: true
    readonly property bool wide: width >= 960
    readonly property bool sideVisible: ["symbols", "selection", "parts"].indexOf(panel) !== -1
    readonly property int sideWidth: sideVisible ? Math.min(320, width) : 0
    readonly property int topInset: touchMode ? 0 : 104
    readonly property int leftInset: wide ? sideWidth : 0
    readonly property int bottomInset: panel === "mixer" ? Math.min(360, height * .5) : pianoVisible ? (height < 500 ? 90 : 132) : 0
    signal layoutChanged()
    onLeftInsetChanged: { if (!touchMode) layoutChanged(); else if (bridge) bridge.composerEvent("viewport") }
    onBottomInsetChanged: { if (!touchMode) layoutChanged(); else if (bridge) bridge.composerEvent("viewport") }
    onWidthChanged: { if (!touchMode) layoutChanged(); else if (bridge) bridge.composerEvent("viewport") }

    NavigationSection { id: topNavigation; name: "MuseTabComposerTop"; order: 2; enabled: root.visible }
    NavigationSection { id: sideNavigation; name: "MuseTabComposerSide"; order: 3; enabled: root.visible }
    NavigationSection { id: bottomNavigation; name: "MuseTabComposerBottom"; order: 4; enabled: root.visible }

    Rectangle {
        id: toolbar
        anchors.left: parent.left; anchors.right: parent.right; anchors.top: parent.top
        height: root.topInset
        visible: !root.touchMode
        color: ui.theme.backgroundPrimaryColor
        border.color: ui.theme.strokeColor
        Column {
            anchors.fill: parent
            Flickable {
                width: parent.width; height: 48; contentWidth: panelButtons.width; clip: true
                Row {
                    id: panelButtons
                    spacing: 2
                    Repeater {
                        model: [{key:"symbols",label:"符号面板"},{key:"selection",label:"属性"},{key:"parts",label:"声部"},{key:"mixer",label:"混音器"}]
                        FlatButton {
                            required property var modelData
                            objectName: "mt-panel-" + modelData.key
                            text: modelData.label; width: 86; height: 44
                            accentButton: root.panel === modelData.key
                            onClicked: root.panel = root.panel === modelData.key ? "" : modelData.key
                        }
                    }
                    FlatButton { objectName: "mt-keyboard-toggle"; text: "钢琴键盘"; width: 90; height: 44; accentButton: root.pianoVisible; onClicked: root.pianoVisible = !root.pianoVisible }
                    UndoRedoToolBar { enabled: !root.editLocked; navigationPanel.section: topNavigation; navigationPanel.order: 1 }
                }
            }
            Flickable {
                id: inputScroller
                width: parent.width; height: 56; contentWidth: noteInput.width * noteInput.scale; clip: true
                flickableDirection: Flickable.HorizontalFlick
                boundsBehavior: Flickable.StopAtBounds
                NoteInputBar {
                    id: noteInput
                    objectName: "mt-note-input"
                    anchors.left: parent.left; anchors.verticalCenter: parent.verticalCenter
                    scale: 1.375; transformOrigin: Item.Left
                    maximumWidth: parent.width / scale; maximumHeight: 40
                    enabled: !root.editLocked
                    navigationPanel.section: topNavigation; navigationPanel.order: 2
                }
                MouseArea { width: inputScroller.width; height: inputScroller.height; x: inputScroller.contentX; enabled: root.editLocked; onClicked: root.bridge.composerEvent("unlock") }
            }
        }
    }

    Rectangle {
        id: sidePanel
        x: 0; y: root.topInset; width: root.sideWidth
        height: root.height - root.topInset - (root.wide ? root.bottomInset : 0)
        visible: root.sideVisible
        color: ui.theme.backgroundPrimaryColor; border.color: ui.theme.strokeColor
        StyledTextLabel { id: sideTitle; x: 12; y: 8; height: 36; text: root.panel === "symbols" ? "符号面板" : root.panel === "selection" ? "属性" : "声部" }
        FlatButton { objectName: "mt-side-close"; anchors.right: parent.right; y: 2; width: 44; height: 44; icon: IconCode.CLOSE_X; transparent: true; onClicked: root.panel = "" }
        Loader {
            anchors.left: parent.left; anchors.right: parent.right; anchors.top: sideTitle.bottom; anchors.bottom: parent.bottom
            anchors.margins: 1
            active: root.visible && root.sideVisible
            sourceComponent: root.panel === "symbols" ? palettes : root.panel === "selection" ? inspector : instruments
            enabled: !root.editLocked
        }
        MouseArea { anchors.left: parent.left; anchors.right: parent.right; anchors.top: sideTitle.bottom; anchors.bottom: parent.bottom; enabled: root.editLocked; onClicked: root.bridge.composerEvent("unlock") }
    }
    Component { id: palettes; PalettesPanel { objectName: "mt-palettes"; navigationSection: sideNavigation; navigationOrderStart: 1 } }
    Component { id: inspector; InspectorForm { objectName: "mt-inspector"; notationView: root.notationView; navigationSection: sideNavigation; navigationOrderStart: 1 } }
    Component { id: instruments; LayoutPanel { objectName: "mt-layout"; navigationSection: sideNavigation; navigationOrderStart: 1 } }

    Rectangle {
        id: bottomPanel
        anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
        height: root.bottomInset; visible: height > 0
        color: ui.theme.backgroundPrimaryColor; border.color: ui.theme.strokeColor
        StyledTextLabel { x: 12; y: 2; height: 32; text: root.panel === "mixer" ? "混音器" : "钢琴键盘" }
        FlatButton { objectName: "mt-bottom-menu"; anchors.right: parent.right; anchors.rightMargin: 44; y: 0; width: 44; height: 44; text: "⋯"; transparent: true; onClicked: { if (bottomLoader.item) bottomMenu.toggleOpened(bottomLoader.item.contextMenuModel.items) } }
        FlatButton { objectName: "mt-bottom-close"; anchors.right: parent.right; y: 0; width: 44; height: 44; icon: IconCode.CLOSE_X; transparent: true; onClicked: { root.panel = ""; root.pianoVisible = false } }
        StyledMenuLoader { id: bottomMenu; onHandleMenuItem: function(itemId) { if (bottomLoader.item) bottomLoader.item.contextMenuModel.handleMenuItem(itemId) } }
        Loader {
            id: bottomLoader
            anchors.left: parent.left; anchors.right: parent.right; anchors.top: parent.top; anchors.bottom: parent.bottom
            anchors.margins: 1; anchors.topMargin: 44
            active: root.visible && bottomPanel.visible
            sourceComponent: root.panel === "mixer" ? mixer : piano
            enabled: root.panel === "mixer" || !root.editLocked
        }
        MouseArea { anchors.fill: bottomLoader; enabled: root.panel !== "mixer" && root.editLocked; onClicked: root.bridge.composerEvent("unlock") }
    }
    Component { id: mixer; MixerPanel { objectName: "mt-mixer"; navigationSection: bottomNavigation; contentNavigationPanelOrderStart: 1 } }
    Component { id: piano; PianoKeyboardPanel { objectName: "mt-piano"; navigationSection: bottomNavigation; contentNavigationPanelOrderStart: 1; Component.onCompleted: { if (width < 600) Qt.callLater(contextMenuModel.handleMenuItem, "25") } } }
}
