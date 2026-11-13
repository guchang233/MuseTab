// SPDX-License-Identifier: GPL-3.0-only
#pragma once

#include "appshell/internal/istartupscenario.h"

#include "async/asyncable.h"
#include "modularity/ioc.h"
#include "iinteractive.h"

namespace mu::appshell {
class WebStartupScenario : public IStartupScenario, public muse::Contextable, public muse::async::Asyncable
{
    muse::ContextInject<muse::IInteractive> interactive = { this };

public:
    WebStartupScenario(const muse::modularity::ContextPtr& iocCtx)
        : muse::Contextable(iocCtx) {}

    void setStartupType(const std::optional<std::string>& type) override;

    bool isStartWithNewFileAsSecondaryInstance() const override;

    const project::ProjectFile& startupScoreFile() const override;
    void setStartupScoreFile(const std::optional<project::ProjectFile>& file) override;

    void runOnSplashScreen() override;
    void runAfterSplashScreen() override;
    bool startupCompleted() const override;

private:
    bool m_startupCompleted = false;
};
}
