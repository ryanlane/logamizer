import { useCallback, useMemo, useState } from "react";
import { useSites } from "./api/hooks";
import { getStoredToken, clearAuth } from "./api/client";
import type { Site } from "./types";
import { DashboardLayout } from "./components/DashboardLayout";
import { SiteListPage } from "./pages/SiteListPage";
import { SiteDashboardPage } from "./pages/SiteDashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Stepper, type Step } from "./components/Stepper";
import { WelcomeStep } from "./components/steps/WelcomeStep";
import { SiteSetupStep } from "./components/steps/SiteSetupStep";
import { UploadStep } from "./components/steps/UploadStep";
import { ResultsStep } from "./components/steps/ResultsStep";
import styles from "./App.module.css";

const WIZARD_STEPS: Step[] = [
  { id: "welcome", title: "Welcome", description: "Sign in" },
  { id: "site", title: "Site", description: "Configure" },
  { id: "upload", title: "Upload", description: "Add logs" },
  { id: "results", title: "Results", description: "Insights" },
];

type WizardStep = "welcome" | "site" | "upload" | "results";
type AppView = "login" | "dashboard" | "wizard" | "site-detail" | "settings";

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [view, setView] = useState<AppView>(() => (getStoredToken() ? "dashboard" : "login"));
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // Wizard state (only used when in wizard mode)
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");

  const sitesQuery = useSites();
  const sites = sitesQuery.data?.sites ?? [];

  // Check if this is the user's first time (no sites yet)
  const isFirstRun = token && sites.length === 0 && !sitesQuery.isLoading;

  // Auto-redirect to wizard on first run
  if (isFirstRun && view === "dashboard") {
    setView("wizard");
    setCurrentStep("site");
  }

  // Compute the step index for the stepper (wizard mode)
  const stepIndex = useMemo(() => {
    const stepMap: Record<WizardStep, number> = {
      welcome: 0,
      site: 1,
      upload: 2,
      results: 3,
    };
    return stepMap[currentStep];
  }, [currentStep]);

  // Handle step clicks in stepper (wizard mode)
  const handleStepClick = useCallback(
    (index: number) => {
      const steps: WizardStep[] = ["welcome", "site", "upload", "results"];
      if (index < stepIndex) {
        setCurrentStep(steps[index]);
      }
    },
    [stepIndex]
  );

  // Auth complete handler
  const handleAuthComplete = useCallback(() => {
    setToken(getStoredToken());
    // Check if user has sites
    if (sites.length === 0) {
      setView("wizard");
      setCurrentStep("site");
    } else {
      setView("dashboard");
    }
  }, [sites.length]);

  // Wizard: Site selection complete handler
  const handleSiteComplete = useCallback((site: Site) => {
    setSelectedSite(site);
    setCurrentStep("upload");
  }, []);

  // Wizard: Upload complete handler
  const handleUploadComplete = useCallback(() => {
    setCurrentStep("results");
  }, []);

  // Wizard: Exit to dashboard
  const handleExitWizard = useCallback(() => {
    setView("dashboard");
    setSelectedSite(null);
    setCurrentStep("site");
  }, []);

  // Dashboard: Create new site
  const handleCreateNewSite = useCallback(() => {
    setView("wizard");
    setCurrentStep("site");
    setSelectedSite(null);
  }, []);

  // Dashboard: View site details
  const handleViewSite = useCallback((site: Site) => {
    setSelectedSite(site);
    setView("site-detail");
  }, []);

  // Site detail: Back to dashboard
  const handleBackToDashboard = useCallback(() => {
    setView("dashboard");
    setSelectedSite(null);
  }, []);

  // Navigation handler for dashboard layout
  const handleNavigate = useCallback((path: string) => {
    if (path === "/") {
      setView("dashboard");
      setSelectedSite(null);
    } else if (path === "/settings") {
      setView("settings");
      setSelectedSite(null);
    }
  }, []);

  // Render login view
  if (!token || view === "login") {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <WelcomeStep onComplete={handleAuthComplete} />
        </main>
        <footer className={styles.footer}>
          <span>Logamizer</span>
          <span className={styles.dot}>·</span>
          <span>Security signals & anomaly insights</span>
        </footer>
      </div>
    );
  }

  // Render wizard view (first run or creating new site)
  if (view === "wizard") {
    const showStepper = currentStep !== "welcome";

    return (
      <div className={styles.app}>
        {showStepper && (
          <header className={styles.header}>
            <Stepper
              steps={WIZARD_STEPS}
              currentStep={stepIndex}
              onStepClick={handleStepClick}
            />
          </header>
        )}

        <main className={styles.main}>
          {currentStep === "site" && (
            <SiteSetupStep
              onComplete={handleSiteComplete}
              onBack={() => {
                if (sites.length > 0) {
                  setView("dashboard");
                } else {
                  clearAuth();
                  setToken(null);
                  setView("login");
                }
              }}
            />
          )}

          {currentStep === "upload" && selectedSite && (
            <UploadStep
              site={selectedSite}
              onComplete={handleUploadComplete}
              onBack={() => setCurrentStep("site")}
            />
          )}

          {currentStep === "results" && selectedSite && (
            <ResultsStep
              site={selectedSite}
              onUploadMore={() => setCurrentStep("upload")}
              onChangeSite={handleExitWizard}
            />
          )}
        </main>

        <footer className={styles.footer}>
          <span>Logamizer</span>
          <span className={styles.dot}>·</span>
          <span>Security signals & anomaly insights</span>
        </footer>
      </div>
    );
  }

  // Render dashboard or site detail view
  const currentPath = view === "dashboard" ? "/" : view === "settings" ? "/settings" : "";

  return (
    <DashboardLayout onNavigate={handleNavigate} currentPath={currentPath}>
      {view === "dashboard" && (
        <SiteListPage onSelectSite={handleViewSite} onCreateNew={handleCreateNewSite} />
      )}

      {view === "site-detail" && selectedSite && (
        <SiteDashboardPage site={selectedSite} onBack={handleBackToDashboard} />
      )}

      {view === "settings" && (
        <SettingsPage onBack={() => setView("dashboard")} />
      )}
    </DashboardLayout>
  );
}
