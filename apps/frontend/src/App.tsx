import { useCallback, useEffect, useMemo, useState } from "react";
import { useSites } from "./api/hooks";
import { getStoredToken, clearAuth } from "./api/client";
import type { Site } from "./types";
import { DashboardLayout } from "./components/DashboardLayout";
import { SiteListPage } from "./pages/SiteListPage";
import { SiteDashboardPage } from "./pages/SiteDashboardPage";
import { LogSourcesPage } from "./pages/LogSourcesPage";
import { ErrorsPage } from "./pages/ErrorsPage";
import { SecurityFindingsPage } from "./pages/SecurityFindingsPage";
import { AnomalyHighlightsPage } from "./pages/AnomalyHighlightsPage";
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
type AppView =
  | "login"
  | "dashboard"
  | "wizard"
  | "site-detail"
  | "findings"
  | "anomalies"
  | "log-sources"
  | "errors"
  | "settings";

type RouteState = {
  view: AppView;
  step: WizardStep;
  siteId: string | null;
};

function parseRoute(pathname: string, isAuthed: boolean): RouteState {
  if (!isAuthed) {
    return { view: "login", step: "welcome", siteId: null };
  }

  if (pathname.startsWith("/settings")) {
    return { view: "settings", step: "welcome", siteId: null };
  }

  if (pathname.startsWith("/sites/")) {
    const parts = pathname.split("/").filter(Boolean);
    const siteId = parts[1] ?? null;
    const subRoute = parts[2] ?? null;

    if (subRoute === "log-sources") {
      return { view: "log-sources", step: "welcome", siteId };
    }

    if (subRoute === "errors") {
      return { view: "errors", step: "welcome", siteId };
    }

    if (subRoute === "findings") {
      return { view: "findings", step: "welcome", siteId };
    }

    if (subRoute === "anomalies") {
      return { view: "anomalies", step: "welcome", siteId };
    }

    return { view: "site-detail", step: "welcome", siteId };
  }

  if (pathname.startsWith("/wizard")) {
    const step = pathname.split("/").filter(Boolean)[1] as WizardStep | undefined;
    const safeStep: WizardStep = step && ["welcome", "site", "upload", "results"].includes(step)
      ? step
      : "site";
    return { view: "wizard", step: safeStep, siteId: null };
  }

  if (pathname.startsWith("/login")) {
    return { view: "login", step: "welcome", siteId: null };
  }

  return { view: "dashboard", step: "welcome", siteId: null };
}

function buildPath(view: AppView, step: WizardStep, siteId: string | null): string {
  if (view === "login") return "/login";
  if (view === "settings") return "/settings";
  if (view === "site-detail" && siteId) return `/sites/${siteId}`;
  if (view === "findings" && siteId) return `/sites/${siteId}/findings`;
  if (view === "anomalies" && siteId) return `/sites/${siteId}/anomalies`;
  if (view === "log-sources" && siteId) return `/sites/${siteId}/log-sources`;
  if (view === "errors" && siteId) return `/sites/${siteId}/errors`;
  if (view === "wizard") return `/wizard/${step}`;
  return "/";
}

export default function App() {
  const initialToken = getStoredToken();
  const initialRoute = parseRoute(window.location.pathname, Boolean(initialToken));

  const [token, setToken] = useState(() => initialToken);
  const [view, setView] = useState<AppView>(() => initialRoute.view);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(() => initialRoute.siteId);
  const [recentSiteIds, setRecentSiteIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("logamizer-recent-sites");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Wizard state (only used when in wizard mode)
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => initialRoute.step);

  const sitesQuery = useSites();
  const sites = sitesQuery.data?.sites ?? [];

  // Check if this is the user's first time (no sites yet)
  const isFirstRun = token && sites.length === 0 && !sitesQuery.isLoading;

  // Auto-redirect to wizard on first run
  if (isFirstRun && view === "dashboard") {
    setView("wizard");
    setCurrentStep("site");
    setSelectedSiteId(null);
  }

  useEffect(() => {
    if (!selectedSiteId) return;
    if (selectedSite && selectedSite.id === selectedSiteId) return;
    const site = sites.find((item) => item.id === selectedSiteId) ?? null;
    if (site) {
      setSelectedSite(site);
    }
  }, [selectedSiteId, selectedSite, sites]);

  useEffect(() => {
    if (!selectedSiteId) return;
    setRecentSiteIds((prev) => {
      const next = [selectedSiteId, ...prev.filter((id) => id !== selectedSiteId)].slice(0, 5);
      localStorage.setItem("logamizer-recent-sites", JSON.stringify(next));
      return next;
    });
  }, [selectedSiteId]);

  useEffect(() => {
    if (view === "wizard" && !selectedSite && (currentStep === "upload" || currentStep === "results")) {
      setCurrentStep("site");
    }
  }, [view, currentStep, selectedSite]);

  useEffect(() => {
    const handlePopState = () => {
      const route = parseRoute(window.location.pathname, Boolean(getStoredToken()));
      setView(route.view);
      setCurrentStep(route.step);
      setSelectedSiteId(route.siteId);
      if (
        route.view !== "site-detail" &&
        route.view !== "log-sources" &&
        route.view !== "errors" &&
        route.view !== "findings" &&
        route.view !== "anomalies"
      ) {
        setSelectedSite(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const path = buildPath(view, currentStep, selectedSiteId);
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  }, [view, currentStep, selectedSiteId]);

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
      setSelectedSiteId(null);
    } else {
      setView("dashboard");
      setSelectedSiteId(null);
    }
  }, [sites.length]);

  // Wizard: Site selection complete handler
  const handleSiteComplete = useCallback((site: Site) => {
    setSelectedSite(site);
    setSelectedSiteId(site.id);
    setCurrentStep("upload");
  }, []);

  // Wizard: Upload complete handler
  const handleUploadComplete = useCallback(() => {
    if (selectedSite) {
      setSelectedSiteId(selectedSite.id);
      setView("site-detail");
      return;
    }
    if (selectedSiteId) {
      setView("site-detail");
      return;
    }
    setCurrentStep("results");
  }, [selectedSite, selectedSiteId]);

  // Wizard: Exit to dashboard
  const handleExitWizard = useCallback(() => {
    setView("dashboard");
    setSelectedSite(null);
    setSelectedSiteId(null);
    setCurrentStep("site");
  }, []);

  // Dashboard: Create new site
  const handleCreateNewSite = useCallback(() => {
    setView("wizard");
    setCurrentStep("site");
    setSelectedSite(null);
    setSelectedSiteId(null);
  }, []);

  // Dashboard: View site details
  const handleViewSite = useCallback((site: Site) => {
    setSelectedSite(site);
    setSelectedSiteId(site.id);
    setView("site-detail");
  }, []);

  // Site detail: Back to dashboard
  const handleBackToDashboard = useCallback(() => {
    setView("dashboard");
    setSelectedSite(null);
    setSelectedSiteId(null);
  }, []);

  const handleViewLogSources = useCallback(() => {
    if (!selectedSite && !selectedSiteId) return;
    setView("log-sources");
  }, [selectedSite, selectedSiteId]);

  const handleViewErrors = useCallback(() => {
    if (!selectedSite && !selectedSiteId) return;
    setView("errors");
  }, [selectedSite, selectedSiteId]);

  const handleViewFindings = useCallback(() => {
    if (!selectedSite && !selectedSiteId) return;
    setView("findings");
  }, [selectedSite, selectedSiteId]);

  const handleViewAnomalies = useCallback(() => {
    if (!selectedSite && !selectedSiteId) return;
    setView("anomalies");
  }, [selectedSite, selectedSiteId]);

  // Navigation handler for dashboard layout
  const handleNavigate = useCallback((path: string) => {
    const route = parseRoute(path, true);
    setView(route.view);
    setCurrentStep(route.step);
    setSelectedSiteId(route.siteId);
    if (
      route.view !== "site-detail" &&
      route.view !== "log-sources" &&
      route.view !== "errors" &&
      route.view !== "findings" &&
      route.view !== "anomalies"
    ) {
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
  const currentPath = buildPath(view, currentStep, selectedSiteId);

  return (
    <DashboardLayout
      onNavigate={handleNavigate}
      currentPath={currentPath}
      sites={sites}
      activeSiteId={selectedSiteId}
      recentSiteIds={recentSiteIds}
    >
      {view === "dashboard" && (
        <SiteListPage onSelectSite={handleViewSite} onCreateNew={handleCreateNewSite} />
      )}

      {view === "site-detail" && selectedSite && (
        <SiteDashboardPage
          site={selectedSite}
          onBack={handleBackToDashboard}
          onViewLogSources={handleViewLogSources}
          onViewErrors={handleViewErrors}
          onViewFindings={handleViewFindings}
          onViewAnomalies={handleViewAnomalies}
        />
      )}

      {view === "findings" && selectedSite && (
        <SecurityFindingsPage site={selectedSite} onBack={() => setView("site-detail")} />
      )}

      {view === "anomalies" && selectedSite && (
        <AnomalyHighlightsPage site={selectedSite} onBack={() => setView("site-detail")} />
      )}

      {view === "log-sources" && selectedSite && (
        <LogSourcesPage site={selectedSite} onBack={() => setView("site-detail")} />
      )}

      {view === "errors" && selectedSite && (
        <ErrorsPage site={selectedSite} onBack={() => setView("site-detail")} />
      )}

      {view === "settings" && (
        <SettingsPage onBack={() => setView("dashboard")} />
      )}
    </DashboardLayout>
  );
}
