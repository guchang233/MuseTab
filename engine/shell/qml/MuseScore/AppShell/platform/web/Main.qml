// SPDX-License-Identifier: GPL-3.0-only
// MuseTab web shell: a frameless window that contains nothing but the score.
import QtQuick
import MuseScore.AppShell
import QtQuick.Window

import Muse.Ui
import Muse.Shortcuts

import MuseScore.NotationScene

Window {
    id: root

    objectName: "ApplicationWindow"

    width: 1280
    height: 800

    visible: false
    flags: Qt.FramelessWindowHint

    color: ui.theme.backgroundPrimaryColor
    property bool composerEnabled: false
    property var composerBridge: null
    property bool composerLocked: true
    property string composerPanel: "symbols"
    property bool composerKeyboard: true
    onComposerPanelChanged: { if (composerLoader.item && composerLoader.item.panel !== composerPanel) composerLoader.item.panel = composerPanel }
    onComposerKeyboardChanged: { if (composerLoader.item && composerLoader.item.pianoVisible !== composerKeyboard) composerLoader.item.pianoVisible = composerKeyboard }
    onComposerEnabledChanged: { if (composerEnabled) Qt.callLater(scoreNavigation.requestActive) }

    // The app shows the window nearly transparent while it loads;
    // nothing else restores it in this shell.
    onVisibleChanged: {
        if (visible) {
            opacity = 1.0
        }
    }

    Component.onCompleted: {
        ui.rootItem = root.contentItem
    }

    MainWindowBridge {
        window: root
    }

    Shortcuts { }
    NavigationSection { id: scoreSection; name: "NotationView"; order: 5; enabled: root.composerEnabled }
    NavigationPanel { id: scorePanel; name: "ScoreView"; section: scoreSection; order: 1; enabled: root.composerEnabled; direction: NavigationPanel.Both }
    NavigationControl {
        id: scoreNavigation
        name: "Score"; panel: scorePanel; order: 1; enabled: root.composerEnabled
        onActiveChanged: { if (active) nativeNotationView.forceFocusIn() }
    }

    InteractiveProvider {
        id: interactiveProvider
        topParent: root

        onRequestedDockPage: function(uri, params) {
            Qt.callLater(interactiveProvider.onPageOpened)
        }
    }

    // Embed the native score item directly. Desktop tabs, sidebars and popup
    // controls are owned by the Svelte tablet interface, not the score canvas.
    PinchArea {
        x: composerLoader.item ? composerLoader.item.leftInset : 0
        y: composerLoader.item ? composerLoader.item.topInset : 0
        width: parent.width - x
        height: parent.height - y - (composerLoader.item ? composerLoader.item.bottomInset : 0)
        onPinchUpdated: function(pinch) {
            nativeNotationView.pinchToZoom(pinch.scale / pinch.previousScale, pinch.center)
        }
        onSmartZoom: function(pinch) {
            nativeNotationView.pinchToZoom(pinch.scale === 0 ? 0.5 : 2, pinch.center)
        }

        NotationPaintView {
            id: nativeNotationView
            objectName: "MainNotationView"
            anchors.fill: parent
            isMainView: true
            Component.onCompleted: load()
            onActiveFocusRequested: { if (root.composerEnabled) scoreNavigation.requestActive(); else forceActiveFocus() }

            Rectangle {
                id: playbackCursor
                Component.onCompleted: nativeNotationView.setPlaybackCursorItem(playbackCursor)
            }
        }
    }
    Loader {
        id: composerLoader
        anchors.fill: parent
        active: root.composerEnabled
        source: "file:///musetab/ComposerWorkspace.qml"
        onLoaded: {
            item.bridge = root.composerBridge
            item.notationView = nativeNotationView
            item.editLocked = Qt.binding(function() { return root.composerLocked })
            item.panel = root.composerPanel
            item.pianoVisible = root.composerKeyboard
            item.panelChanged.connect(function() { if (root.composerPanel !== composerLoader.item.panel) root.composerPanel = composerLoader.item.panel })
            item.pianoVisibleChanged.connect(function() { if (root.composerKeyboard !== composerLoader.item.pianoVisible) root.composerKeyboard = composerLoader.item.pianoVisible })
            item.layoutChanged.connect(function() { if (root.composerEnabled && root.composerBridge) Qt.callLater(root.composerBridge.fitComposerView) })
            Qt.callLater(root.composerBridge.fitComposerView)
        }
    }
}
