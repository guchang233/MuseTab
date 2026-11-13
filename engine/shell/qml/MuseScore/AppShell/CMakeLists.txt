# SPDX-License-Identifier: GPL-3.0-only
muse_create_qml_module(appshell_qml FOR appshell)

# NOTE Qt 6.7 has no "IMPORTS TARGET <target>" form, so module URIs are listed instead.
qt_add_qml_module(appshell_qml
    URI MuseScore.AppShell
    VERSION 1.0
    QML_FILES
        platform/web/Main.qml
    DEPENDENCIES
        Muse.Ui
        Muse.UiComponents
        Muse.Shortcuts
        MuseScore.NotationScene
)

fixup_qml_module_dependencies(appshell_qml)
