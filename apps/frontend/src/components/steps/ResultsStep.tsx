import { useState } from "react";
import { useDashboard, useExplain, useFindings } from "../../api/hooks";
import type { Site } from "../../types";
import { Button } from "../Button";
import { Card, CardHeader } from "../Card";
import { FindingsList } from "../FindingsList";
import { OverviewPanel } from "../OverviewPanel";
import { SummaryCards } from "../SummaryCards";
import { TrafficChart } from "../TrafficChart";
import styles from "./ResultsStep.module.css";

type Props = {
  site: Site;
  onUploadMore: () => void;
  onChangeSite: () => void;
};

export function ResultsStep({ site, onUploadMore, onChangeSite }: Props) {
  const dashboardQuery = useDashboard(site.id);
  const findingsQuery = useFindings(site.id);
  const explain = useExplain();

  const [explainPrompt, setExplainPrompt] = useState("");
  const [explainContext, setExplainContext] = useState<"findings" | "anomalies" | "overview">("overview");
  const [explainResponse, setExplainResponse] = useState<string | null>(null);

  const dashboard = dashboardQuery.data;
  const findings = findingsQuery.data?.findings ?? [];

  const isLoading = dashboardQuery.isLoading || findingsQuery.isLoading;
  const hasData = dashboard && dashboard.summary.total_requests > 0;

  async function handleExplain() {
    if (!explainPrompt.trim()) return;
    setExplainResponse(null);

    try {
      const result = await explain.mutateAsync({
        siteId: site.id,
        prompt: explainPrompt,
        context: explainContext,
      });
      setExplainResponse(result.response);
    } catch (err) {
      setExplainResponse(`Error: ${(err as Error).message}`);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--color-gray-200)" strokeWidth="4" />
            <path
              d="M44 24a20 20 0 00-20-20"
              stroke="var(--color-primary)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className={styles.container}>
        <Card className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="8" y="12" width="48" height="40" rx="4" stroke="var(--color-gray-300)" strokeWidth="2" />
              <path d="M8 24h48" stroke="var(--color-gray-300)" strokeWidth="2" />
              <circle cx="16" cy="18" r="2" fill="var(--color-gray-300)" />
              <circle cx="24" cy="18" r="2" fill="var(--color-gray-300)" />
              <circle cx="32" cy="18" r="2" fill="var(--color-gray-300)" />
            </svg>
          </div>
          <h2>No data yet</h2>
          <p>Upload a log file to see your security insights and traffic analysis.</p>
          <Button onClick={onUploadMore}>Upload a log file</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{site.name}</h1>
          <p className={styles.subtitle}>{site.domain || "Dashboard"}</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="sm" onClick={onChangeSite}>
            Change site
          </Button>
          <Button size="sm" onClick={onUploadMore}>
            Upload more logs
          </Button>
        </div>
      </div>

      <SummaryCards summary={dashboard.summary} site={site} />

      <div className={styles.grid}>
        <Card className={styles.chartCard}>
          <CardHeader title="Traffic over time" />
          <TrafficChart data={dashboard.hourly_data} />
        </Card>

        <Card className={styles.overviewCard}>
          <CardHeader title="Top paths & IPs" />
          <OverviewPanel summary={dashboard.summary} />
        </Card>
      </div>

      {findings.length > 0 && (
        <Card>
          <CardHeader
            title="Security findings"
            subtitle={`${findings.length} finding${findings.length === 1 ? "" : "s"} detected`}
          />
          <FindingsList findings={findings} />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Ask AI"
          subtitle="Get insights about your logs using AI"
        />
        <div className={styles.explainForm}>
          <div className={styles.contextToggle}>
            <button
              type="button"
              className={explainContext === "overview" ? styles.active : ""}
              onClick={() => setExplainContext("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={explainContext === "findings" ? styles.active : ""}
              onClick={() => setExplainContext("findings")}
            >
              Security
            </button>
            <button
              type="button"
              className={explainContext === "anomalies" ? styles.active : ""}
              onClick={() => setExplainContext("anomalies")}
            >
              Anomalies
            </button>
          </div>
          <div className={styles.promptRow}>
            <input
              type="text"
              value={explainPrompt}
              onChange={(e) => setExplainPrompt(e.target.value)}
              placeholder="Ask about your logs... (e.g., 'Summarize the security issues')"
              className={styles.promptInput}
              onKeyDown={(e) => e.key === "Enter" && handleExplain()}
            />
            <Button onClick={handleExplain} isLoading={explain.isPending} disabled={!explainPrompt.trim()}>
              Ask
            </Button>
          </div>
          {explainResponse && (
            <div className={styles.explainResponse}>
              <pre>{explainResponse}</pre>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
