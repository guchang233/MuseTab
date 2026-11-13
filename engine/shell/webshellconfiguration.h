// SPDX-License-Identifier: GPL-3.0-only
#pragma once

#include "appshell/iappshellconfiguration.h"

namespace mu::appshell {
//! Nothing here is user-configurable: the HTML layer owns all preferences.
class WebShellConfiguration : public IAppShellConfiguration
{
public:
    bool hasCompletedFirstLaunchSetup() const override { return true; }
    void setHasCompletedFirstLaunchSetup(bool) override {}

    bool welcomeDialogShowOnStartup() const override { return false; }
    void setWelcomeDialogShowOnStartup(bool) override {}
    muse::async::Notification welcomeDialogShowOnStartupChanged() const override { return m_never; }

    std::string welcomeDialogLastShownVersion() const override { return {}; }
    void setWelcomeDialogLastShownVersion(const std::string&) override {}

    int welcomeDialogLastShownIndex() const override { return 0; }
    void setWelcomeDialogLastShownIndex(int) override {}

    StartupModeType startupModeType() const override { return StartupModeType::StartEmpty; }
    void setStartupModeType(StartupModeType) override {}
    muse::async::Notification startupModeTypeChanged() const override { return m_never; }

    muse::io::path_t startupScorePath() const override { return {}; }
    void setStartupScorePath(const muse::io::path_t&) override {}
    muse::async::Notification startupScorePathChanged() const override { return m_never; }

    std::string handbookUrl() const override { return {}; }
    std::string askForHelpUrl() const override { return {}; }
    std::string accessibilityStatementUrl() const override { return {}; }
    std::string museScoreUrl() const override { return {}; }
    std::string museScoreForumUrl() const override { return {}; }
    std::string museScoreContributionUrl() const override { return {}; }
    std::string museHubFreeMuseSoundsUrl() const override { return {}; }
    std::string musicXMLLicenseUrl() const override { return {}; }
    std::string musicXMLLicenseDeedUrl() const override { return {}; }

    std::string museScoreVersion() const override;
    std::string museScoreRevision() const override;

    bool isNotationNavigatorVisible() const override { return false; }
    void setIsNotationNavigatorVisible(bool) const override {}
    muse::async::Notification isNotationNavigatorVisibleChanged() const override { return m_never; }

    bool needShowSplashScreen() const override { return false; }
    void setNeedShowSplashScreen(bool) override {}

    const QString& preferencesDialogLastOpenedPageId() const override { return m_pageId; }
    void setPreferencesDialogLastOpenedPageId(const QString& id) override { m_pageId = id; }

    void startEditSettings() override {}
    void applySettings() override {}
    void rollbackSettings() override {}

    void revertToFactorySettings(bool, bool, bool) const override {}

    muse::io::paths_t sessionProjectsPaths() const override { return {}; }
    muse::Ret setSessionProjectsPaths(const muse::io::paths_t&) override { return muse::make_ok(); }

private:
    muse::async::Notification m_never;
    QString m_pageId;
};
}
