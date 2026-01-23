import { useMemo, useState } from "react";
import { useDashboard } from "../api/hooks";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { DateRangePicker } from "../components/DateRangePicker";
import type { Site } from "../types";
import styles from "./AnomalyHighlightsPage.module.css";

type Props = {
  site: Site;
  onBack: () => void;
};

type Highlight = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "info";
  summary: string;
  time: string;
  actions: string[];
};

export function AnomalyHighlightsPage({ site, onBack }: Props) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const { data: dashboard, isLoading, error } = useDashboard(site.id, startDate, endDate);
  const hourlyData = dashboard?.hourly_data ?? [];

  const anomalyHighlights = useMemo<Highlight[]>(() => {
    if (!hourlyData.length) return [];

    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const stddev = (values: number[], avg: number) => {
      const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
      return Math.sqrt(variance);
    };

    const requestCounts = hourlyData.map((item) => item.requests_count);
    const ipCounts = hourlyData.map((item) => item.unique_ips);
    const avgRequests = mean(requestCounts);
    const stdRequests = stddev(requestCounts, avgRequests);
    const avgIps = mean(ipCounts);
    const stdIps = stddev(ipCounts, avgIps);

    const highlights: Highlight[] = [];

    for (const item of hourlyData) {
      const hourLabel = new Date(item.hour_bucket).toLocaleString();
      const requests = item.requests_count;
      const safeRequests = Math.max(1, requests);
      const error5xxRate = item.status_5xx / safeRequests;
      const error4xxRate = item.status_4xx / safeRequests;

      if (requests > avgRequests + 2 * stdRequests && requests > 200) {
        highlights.push({
          id: `traffic-${item.hour_bucket}`,
          title: "Traffic spike",
          severity: "high",
          summary: `${requests.toLocaleString()} requests vs baseline ${Math.round(avgRequests).toLocaleString()}.`,
          time: hourLabel,
          actions: [
            "Review top paths for bot traffic",
            "Add rate limits or WAF rules",
            "Verify traffic source changes",
          ],
        });
      }

      if (item.status_5xx >= 10 && error5xxRate >= 0.05) {
        highlights.push({
          id: `5xx-${item.hour_bucket}`,
          title: "5xx error spike",
          severity: "critical",
          summary: `${item.status_5xx} errors (${Math.round(error5xxRate * 100)}%) during this hour.`,
          time: hourLabel,
          actions: [
            "Check recent deploys or outages",
            "Inspect error logs for the failing endpoint",
            "Rollback if regression is confirmed",
          ],
        });
      }

      if (item.status_4xx >= 50 && error4xxRate >= 0.2) {
        highlights.push({
          id: `4xx-${item.hour_bucket}`,
          title: "4xx surge",
          severity: "medium",
          summary: `${item.status_4xx} client errors (${Math.round(error4xxRate * 100)}%).`,
          time: hourLabel,
          actions: [
            "Review auth failures or broken links",
            "Audit top offending paths",
            "Add validation or improve error handling",
          ],
        });
      }

      if (item.unique_ips > avgIps + 2 * stdIps && item.unique_ips > 50) {
        highlights.push({
          id: `ips-${item.hour_bucket}`,
          title: "Unique IP spike",
          severity: "info",
          summary: `${item.unique_ips} unique IPs vs baseline ${Math.round(avgIps)}.`,
          time: hourLabel,
          actions: [
            "Check geo distribution for unusual regions",
            "Confirm campaign or referral changes",
            "Add bot mitigation if needed",
          ],
        });
      }
    }

    const severityRank = {
      critical: 0,
      high: 1,
      medium: 2,
      info: 3,
    };

    return highlights
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
      .slice(0, 10);
  }, [hourlyData]);

  function handleDateRangeChange(start: string | null, end: string | null) {
    setStartDate(start);
    setEndDate(end);
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
          <h1 className={styles.title}>Anomaly highlights - {site.name}</h1>
          <p className={styles.subtitle}>Deviations with recommended actions</p>
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
        <CardHeader title="Anomaly highlights" subtitle="Automated deviations with recommended actions" />

        {isLoading && <div className={styles.loading}>Loading anomalies...</div>}
        {error && <div className={styles.error}>Failed to load anomalies: {error.message}</div>}

        {!isLoading && !error && anomalyHighlights.length === 0 && (
          <div className={styles.empty}>No anomalies detected in the selected time range.</div>
        )}

        {!isLoading && !error && anomalyHighlights.length > 0 && (
          <div className={styles.list}>
            {anomalyHighlights.map((item, index) => (
              <div key={`${item.id}-${index}`} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div>
                    <div className={styles.itemTitle}>{item.title}</div>
                    <div className={styles.itemMeta}>{item.time}</div>
                  </div>
                  <span className={`${styles.badge} ${styles[`badge-${item.severity}`]}`}>
                    {item.severity}
                  </span>
                </div>
                <div className={styles.itemSummary}>{item.summary}</div>
                <div className={styles.itemActions}>
                  {item.actions.map((action) => (
                    <span key={action} className={styles.itemAction}>
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
