import { useState } from "react";
import { useFindings, useExplainFinding, useVerifyFinding } from "../api/hooks";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { DateRangePicker } from "../components/DateRangePicker";
import { FindingsList } from "../components/FindingsList";
import { FindingDetailModal } from "../components/FindingDetailModal";
import type { Site, Finding, VerifyFindingResponse } from "../types";
import styles from "./SecurityFindingsPage.module.css";
import inputStyles from "../components/Input.module.css";

type Props = {
  site: Site;
  onBack: () => void;
};

export function SecurityFindingsPage({ site, onBack }: Props) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const { data, isLoading, error } = useFindings(site.id, startDate, endDate, severityFilter);
  const findings = data?.findings ?? [];

  const explainFinding = useExplainFinding();
  const verifyFinding = useVerifyFinding();

  function handleDateRangeChange(start: string | null, end: string | null) {
    setStartDate(start);
    setEndDate(end);
  }

  async function handleExplainFinding(findingId: string): Promise<string> {
    const result = await explainFinding.mutateAsync({ findingId });
    return result.explanation;
  }

  async function handleVerifyFinding(findingId: string): Promise<VerifyFindingResponse> {
    const result = await verifyFinding.mutateAsync({ findingId });
    return result;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Security findings - {site.name}</h1>
          <p className={styles.subtitle}>Detected issues and suspicious activity</p>
        </div>
        <div className={styles.headerActions}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
      </div>

      <Card>
        <CardHeader
          title="Security findings"
          subtitle={`${findings.length} issue${findings.length === 1 ? "" : "s"} detected`}
          action={
            <select
              className={`${inputStyles.input} ${inputStyles.select}`}
              value={severityFilter ?? ""}
              onChange={(event) => setSeverityFilter(event.target.value || null)}
              aria-label="Filter findings by severity"
            >
              <option value="">All levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          }
        />

        {isLoading && <div className={styles.loading}>Loading findings...</div>}
        {error && <div className={styles.error}>Failed to load findings: {error.message}</div>}
        {!isLoading && !error && (
          <FindingsList findings={findings} onFindingClick={setSelectedFinding} />
        )}
      </Card>

      {selectedFinding && (
        <FindingDetailModal
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          onExplain={handleExplainFinding}
          onVerify={site.domain ? handleVerifyFinding : undefined}
        />
      )}
    </div>
  );
}
