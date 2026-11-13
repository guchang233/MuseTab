// SPDX-License-Identifier: GPL-3.0-only
#include "webshellmodule.h"

#include "modularity/ioc.h"
#include "ui/iinteractiveuriregister.h"

#include "webshellconfiguration.h"
#include "webstartupscenario.h"

using namespace mu::appshell;
using namespace muse;
using namespace muse::modularity;
using namespace muse::ui;

static const std::string mname("appshell");

std::string WebShellModule::moduleName() const
{
    return mname;
}

void WebShellModule::registerExports()
{
    m_configuration = std::make_shared<WebShellConfiguration>();

    ioc()->registerExport<IAppShellConfiguration>(mname, m_configuration);
    ioc()->registerExport<IStartupScenario>(mname, new WebStartupScenario(iocContext()));
}

void WebShellModule::resolveImports()
{
    auto ir = ioc()->resolve<IInteractiveUriRegister>(mname);
    if (ir) {
        ir->registerPageUri(Uri("musescore://home"));
        ir->registerPageUri(Uri("musescore://notation"));
    }
}
