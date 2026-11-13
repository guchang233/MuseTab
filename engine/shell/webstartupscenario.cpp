// SPDX-License-Identifier: GPL-3.0-only
#include "webstartupscenario.h"

using namespace muse;
using namespace mu::appshell;

void WebStartupScenario::setStartupType(const std::optional<std::string>&)
{
}

bool WebStartupScenario::isStartWithNewFileAsSecondaryInstance() const
{
    return false;
}

const mu::project::ProjectFile& WebStartupScenario::startupScoreFile() const
{
    static mu::project::ProjectFile file;
    return file;
}

void WebStartupScenario::setStartupScoreFile(const std::optional<project::ProjectFile>&)
{
}

void WebStartupScenario::runOnSplashScreen()
{
}

void WebStartupScenario::runAfterSplashScreen()
{
    interactive()->open("musescore://notation").onResolve(this, [this](const Val&) {
        m_startupCompleted = true;
    });
}

bool WebStartupScenario::startupCompleted() const
{
    return m_startupCompleted;
}
