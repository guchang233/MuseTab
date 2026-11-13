// SPDX-License-Identifier: GPL-3.0-only
#pragma once

#include <memory>

#include "modularity/imodulesetup.h"

namespace mu::appshell {
class WebShellConfiguration;
class WebShellModule : public muse::modularity::IModuleSetup
{
public:
    std::string moduleName() const override;

    void registerExports() override;
    void resolveImports() override;

private:
    std::shared_ptr<WebShellConfiguration> m_configuration;
};
}
