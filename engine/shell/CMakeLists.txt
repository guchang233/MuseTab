# SPDX-License-Identifier: GPL-3.0-only
# MuseTab web shell: replaces the stale src/web/appshell of MuseScore.
# Only the notation canvas is shown; every other piece of UI lives in HTML.

muse_create_module(appshell)

target_sources(appshell PRIVATE
    webshellmodule.cpp
    webshellmodule.h
    webshellconfiguration.cpp
    webshellconfiguration.h
    webstartupscenario.cpp
    webstartupscenario.h
)

target_link_libraries(appshell PRIVATE
    muse::ui
    muse::uicomponents
    Qt::Quick
)

add_subdirectory(qml/MuseScore/AppShell)
