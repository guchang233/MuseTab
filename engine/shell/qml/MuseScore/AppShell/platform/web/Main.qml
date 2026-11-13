// SPDX-License-Identifier: GPL-3.0-only
// MuseTab web shell: a frameless window that contains nothing but the score.
import QtQuick
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
        anchors.fill: parent
        onPinchUpdated: function(pinch) {
            notationView.pinchToZoom(pinch.scale / pinch.previousScale, pinch.center)
        }
        onSmartZoom: function(pinch) {
            notationView.pinchToZoom(pinch.scale === 0 ? 0.5 : 2, pinch.center)
        }

        NotationPaintView {
            id: notationView
            objectName: "MainNotationView"
            anchors.fill: parent
            isMainView: true
            Component.onCompleted: load()
            onActiveFocusRequested: forceActiveFocus()

            Rectangle {
                id: playbackCursor
                Component.onCompleted: notationView.setPlaybackCursorItem(playbackCursor)
            }
        }
    }
}
