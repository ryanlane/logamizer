import { useCallback, useMemo, useState } from "react";
import { useSites } from "./api/hooks";
import { getStoredToken, setStoredToken } from "./api/client";
import type { Site } from "./types";
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

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [currentStep, setCurrentStep] = useState<WizardStep>(() =>
    getStoredToken() ? "site" : "welcome"
  );
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  const sitesQuery = useSites();
  const sites = sitesQuery.data?.sites ?? [];

  // Compute the step index for the stepper
  const stepIndex = useMemo(() => {
    const stepMap: Record<WizardStep, number> = {
      welcome: 0,
      site: 1,
      upload: 2,
      results: 3,
    };
    return stepMap[currentStep];
  }, [currentStep]);

  // Handle step clicks in stepper
  const handleStepClick = useCallback(
    (index: number) => {
      const steps: WizardStep[] = ["welcome", "site", "upload", "results"];
      // Only allow going back or staying, not forward (forward requires completing steps)
      if (index < stepIndex) {
        setCurrentStep(steps[index]);
      }
    },
    [stepIndex]
  );

  // Auth complete handler
  const handleAuthComplete = useCallback(() => {
    setToken(getStoredToken());
    setCurrentStep("site");
  }, []);

  // Site selection complete handler
  const handleSiteComplete = useCallback((site: Site) => {
    setSelectedSite(site);
    setCurrentStep("upload");
  }, []);

  // Upload complete handler
  const handleUploadComplete = useCallback(() => {
    setCurrentStep("results");
  }, []);

  // Navigation handlers
  const handleBackToWelcome = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setCurrentStep("welcome");
  }, []);

  const handleBackToSite = useCallback(() => {
    setCurrentStep("site");
  }, []);

  const handleUploadMore = useCallback(() => {
    setCurrentStep("upload");
  }, []);

  const handleChangeSite = useCallback(() => {
    setSelectedSite(null);
    setCurrentStep("site");
  }, []);

  // Show stepper only when authenticated
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
        {currentStep === "welcome" && (
          <WelcomeStep onComplete={handleAuthComplete} />
        )}

        {currentStep === "site" && (
          <SiteSetupStep
            onComplete={handleSiteComplete}
            onBack={handleBackToWelcome}
          />
        )}

        {currentStep === "upload" && selectedSite && (
          <UploadStep
            site={selectedSite}
            onComplete={handleUploadComplete}
            onBack={handleBackToSite}
          />
        )}

        {currentStep === "results" && selectedSite && (
          <ResultsStep
            site={selectedSite}
            onUploadMore={handleUploadMore}
            onChangeSite={handleChangeSite}
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
