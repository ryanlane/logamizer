import { useEffect, useMemo, useState } from "react";
import { useDashboard, useExplain, useFindings, useExplainFinding, useVerifyFinding } from "../api/hooks";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { SummaryCards } from "../components/SummaryCards";
import { TrafficChart } from "../components/TrafficChart";
import { StatusBreakdownChart } from "../components/StatusBreakdownChart";
import { ErrorRateChart } from "../components/ErrorRateChart";
import { BandwidthChart } from "../components/BandwidthChart";
import { TopUserAgentsChart } from "../components/TopUserAgentsChart";
import { TopStatusCodesChart } from "../components/TopStatusCodesChart";
import { FindingsList } from "../components/FindingsList";
import { FindingDetailModal } from "../components/FindingDetailModal";
import { OverviewPanel } from "../components/OverviewPanel";
import { FileUpload } from "../components/FileUpload";
import { DateRangePicker } from "../components/DateRangePicker";
import { uploadFileToS3, useGetUploadUrl, useConfirmUpload, useJob } from "../api/hooks";
import { useUserSettings } from "../utils/settings";
import type { Site, Finding, VerifyFindingResponse } from "../types";
import styles from "./SiteDashboardPage.module.css";
import inputStyles from "../components/Input.module.css";

type Props = {
  site: Site;
  onBack: () => void;
  onViewLogSources?: () => void;
  onViewErrors?: () => void;
};

type UploadState = "idle" | "uploading" | "processing" | "complete" | "error";

export function SiteDashboardPage({ site, onBack, onViewLogSources, onViewErrors }: Props) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const { data: dashboard, isLoading, error } = useDashboard(site.id, startDate, endDate);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const { data: findingsData } = useFindings(site.id, startDate, endDate, severityFilter);
  const findings = findingsData?.findings ?? [];

  const [isUploadMode, setIsUploadMode] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const explainFinding = useExplainFinding();
  const explainOverview = useExplain();
  const verifyFinding = useVerifyFinding();

  const { settings } = useUserSettings();
  const hiddenIps = useMemo(
    () => new Set(settings.hiddenIps.map((ip) => ip.trim()).filter(Boolean)),
    [settings.hiddenIps]
  );

  const [daySummary, setDaySummary] = useState<string | null>(null);
  const [daySummaryError, setDaySummaryError] = useState<string | null>(null);
  const [isSummarizingDay, setIsSummarizingDay] = useState(false);

  const activeDayKey = useMemo(() => {
    if (!startDate || !endDate) return null;
    const startKey = new Date(startDate).toLocaleDateString("en-CA");
    const endKey = new Date(endDate).toLocaleDateString("en-CA");
    return startKey === endKey ? startKey : null;
  }, [startDate, endDate]);

  const hourlyData = dashboard?.hourly_data ?? [];

  const dayAggregates = useMemo(() => {
    if (!activeDayKey) return [];
    return hourlyData.filter(
      (item) => new Date(item.hour_bucket).toLocaleDateString("en-CA") === activeDayKey
    );
  }, [hourlyData, activeDayKey]);

  const activeAggregates = useMemo(
    () => (activeDayKey ? dayAggregates : hourlyData),
    [activeDayKey, dayAggregates, hourlyData]
  );

  const dayLabel = activeDayKey
    ? new Date(startDate ?? activeDayKey).toLocaleDateString()
    : null;

  const dayTopPaths = useMemo(() => {
    if (!activeDayKey) return undefined;
    const counts = new Map<string, number>();
    for (const item of dayAggregates) {
      (item.top_paths ?? []).forEach((pathItem) => {
        counts.set(pathItem.path, (counts.get(pathItem.path) ?? 0) + pathItem.count);
      });
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));
  }, [activeDayKey, dayAggregates]);

  const dayTopIps = useMemo(() => {
    if (!activeDayKey) return undefined;
    const counts = new Map<string, number>();
    for (const item of dayAggregates) {
      (item.top_ips ?? []).forEach((ipItem) => {
        counts.set(ipItem.ip, (counts.get(ipItem.ip) ?? 0) + ipItem.count);
      });
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
  }, [activeDayKey, dayAggregates]);

  const filteredDayTopIps = useMemo(() => {
    if (!dayTopIps) return undefined;
    return dayTopIps.filter((item) => !hiddenIps.has(item.ip));
  }, [dayTopIps, hiddenIps]);

  const filteredSummaryTopIps = useMemo(() => {
    if (!dashboard?.summary.top_ips) return [];
    return dashboard.summary.top_ips.filter((item) => !hiddenIps.has(item.ip));
  }, [dashboard?.summary.top_ips, hiddenIps]);

  const dayTotals = useMemo(() => {
    if (!activeDayKey) return null;
    return dayAggregates.reduce(
      (acc, item) => {
        acc.totalRequests += item.requests_count;
        acc.totalBytes += item.total_bytes;
        acc.status2xx += item.status_2xx;
        acc.status3xx += item.status_3xx;
        acc.status4xx += item.status_4xx;
        acc.status5xx += item.status_5xx;
        return acc;
      },
      {
        totalRequests: 0,
        totalBytes: 0,
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
      }
    );
  }, [activeDayKey, dayAggregates]);

  const topUserAgents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activeAggregates) {
      (item.top_user_agents ?? []).forEach((uaItem) => {
        const label = uaItem.user_agent || "Unknown";
        counts.set(label, (counts.get(label) ?? 0) + uaItem.count);
      });
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));
  }, [activeAggregates]);

  const topStatusCodes = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of activeAggregates) {
      (item.top_status_codes ?? []).forEach((statusItem) => {
        if (typeof statusItem.status !== "number") return;
        counts.set(statusItem.status, (counts.get(statusItem.status) ?? 0) + statusItem.count);
      });
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([status, count]) => ({ status, count }));
  }, [activeAggregates]);

  useEffect(() => {
    setDaySummary(null);
    setDaySummaryError(null);
  }, [activeDayKey]);

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

  async function handleExplainDay() {
    if (!activeDayKey || !dayTotals || !dayLabel) return;
    setIsSummarizingDay(true);
    setDaySummaryError(null);

    const topPathsText = (dayTopPaths ?? [])
      .slice(0, 5)
      .map((item) => `${item.path} (${item.count})`)
      .join(", ");
    const topIpsText = (filteredDayTopIps ?? [])
      .slice(0, 5)
      .map((item) => `${item.ip} (${item.count})`)
      .join(", ");

    const prompt = `Summarize the traffic patterns for ${dayLabel}.\n\n`
      + `Totals: ${dayTotals.totalRequests} requests, ${dayTotals.status2xx} 2xx, ${dayTotals.status3xx} 3xx, ${dayTotals.status4xx} 4xx, ${dayTotals.status5xx} 5xx, ${dayTotals.totalBytes} bytes.\n`
      + `Top paths: ${topPathsText || "none"}.\n`
      + `Top IPs: ${topIpsText || "none"}.\n\n`
      + `Explain what kind of traffic this looks like (normal users, bots, scans, errors), highlight anomalies, and suggest any follow-up actions.`;

    try {
      const result = await explainOverview.mutateAsync({
        siteId: site.id,
        prompt,
        context: "overview",
      });
      setDaySummary(result.response);
    } catch (err) {
      setDaySummaryError((err as Error).message);
    } finally {
      setIsSummarizingDay(false);
    }
  }

  const getUploadUrl = useGetUploadUrl();
  const confirmUpload = useConfirmUpload();
  const { data: job } = useJob(currentJobId ?? undefined);

  async function handleUpload() {
    if (!uploadFile) return;

    setUploadState("uploading");
    setUploadError(null);

    try {
      const { upload_url, log_file_id } = await getUploadUrl.mutateAsync({
        siteId: site.id,
        filename: uploadFile.name,
      });

      await uploadFileToS3(upload_url, uploadFile);

      setUploadState("processing");

      const jobData = await confirmUpload.mutateAsync({
        siteId: site.id,
        logFileId: log_file_id,
        sizeBytes: uploadFile.size,
      });

      setCurrentJobId(jobData.id);
    } catch (err) {
      setUploadState("error");
      setUploadError((err as Error).message);
    }
  }

  // Update state based on job status
  if (job && uploadState === "processing") {
    if (job.status === "completed") {
      setUploadState("complete");
      setCurrentJobId(null);
      setTimeout(() => {
        setIsUploadMode(false);
        setUploadFile(null);
        setUploadState("idle");
      }, 2000);
    } else if (job.status === "failed") {
      setUploadState("error");
      setUploadError("Processing failed");
      setCurrentJobId(null);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load dashboard: {error.message}</div>
        <Button onClick={onBack}>Back to sites</Button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No data yet</h2>
          <p>Upload log files to start seeing insights</p>
          <Button onClick={() => setIsUploadMode(true)}>Upload logs</Button>
        </div>
      </div>
    );
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
          <h1 className={styles.title}>{site.name}</h1>
          {site.domain && <p className={styles.domain}>{site.domain}</p>}
        </div>
        <div className={styles.headerActions}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
          />
          {onViewLogSources && (
            <Button variant="secondary" onClick={onViewLogSources}>
              Log Sources
            </Button>
          )}
          {onViewErrors && (
            <Button variant="secondary" onClick={onViewErrors}>
              Error analysis
            </Button>
          )}
          <Button onClick={() => setIsUploadMode(!isUploadMode)}>
            {isUploadMode ? "Cancel upload" : "Upload more logs"}
          </Button>
        </div>
      </div>

      {isUploadMode && (
        <Card className={styles.uploadCard}>
          <CardHeader
            title="Upload log file"
            subtitle="Add another log file to analyze for this site"
          />
          <FileUpload
            file={uploadFile}
            onFileSelect={setUploadFile}
            accept=".log,.txt,.gz"
          />
          {uploadError && <div className={styles.uploadError}>{uploadError}</div>}
          <div className={styles.uploadActions}>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploadState !== "idle"}
              isLoading={uploadState === "uploading" || uploadState === "processing"}
            >
              {uploadState === "uploading"
                ? "Uploading..."
                : uploadState === "processing"
                  ? "Processing..."
                  : uploadState === "complete"
                    ? "Complete!"
                    : "Upload and process"}
            </Button>
          </div>
        </Card>
      )}

      <SummaryCards summary={dashboard.summary} site={site} />

      <div className={styles.chartsGrid}>
        <Card>
          <CardHeader
            title="Traffic over time"
            subtitle="Request volume by hour"
            action={
              activeDayKey ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleExplainDay}
                  isLoading={isSummarizingDay}
                >
                  Explain {dayLabel}
                </Button>
              ) : undefined
            }
          />
          <TrafficChart data={hourlyData} />
          {activeDayKey && (
            <div className={styles.daySummary}>
              <div className={styles.daySummaryHeader}>
                <span>AI summary for {dayLabel}</span>
              </div>
              {daySummaryError && (
                <div className={styles.daySummaryError}>{daySummaryError}</div>
              )}
              {daySummary && <div className={styles.daySummaryText}>{daySummary}</div>}
              {!daySummary && !daySummaryError && !isSummarizingDay && (
                <div className={styles.daySummaryPlaceholder}>
                  Click “Explain {dayLabel}” to generate a traffic summary.
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Top paths & IPs" />
          <OverviewPanel
            summary={dashboard.summary}
            topPaths={activeDayKey ? dayTopPaths : undefined}
            topIps={activeDayKey ? filteredDayTopIps : filteredSummaryTopIps}
            filterLabel={activeDayKey ? dayLabel : null}
          />
        </Card>
      </div>

      <div className={styles.analyticsGrid}>
        <Card>
          <CardHeader title="Status breakdown" subtitle="2xx, 3xx, 4xx, 5xx per hour" />
          <StatusBreakdownChart data={activeAggregates} />
        </Card>

        <Card>
          <CardHeader title="Error rate" subtitle="4xx + 5xx as % of requests" />
          <ErrorRateChart data={activeAggregates} />
        </Card>

        <Card>
          <CardHeader title="Bandwidth" subtitle="Bytes transferred per hour" />
          <BandwidthChart data={activeAggregates} />
        </Card>

        <Card>
          <CardHeader title="Top user agents" subtitle="Most common clients" />
          <TopUserAgentsChart data={topUserAgents} />
        </Card>

        <Card>
          <CardHeader title="Top status codes" subtitle="Most frequent responses" />
          <TopStatusCodesChart data={topStatusCodes} />
        </Card>
      </div>

      {findingsData && (
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
          <FindingsList findings={findings} onFindingClick={setSelectedFinding} />
        </Card>
      )}

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
