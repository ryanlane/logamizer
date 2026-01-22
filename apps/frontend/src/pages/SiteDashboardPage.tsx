import { useState } from "react";
import { useDashboard, useFindings, useExplainFinding, useVerifyFinding } from "../api/hooks";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { SummaryCards } from "../components/SummaryCards";
import { TrafficChart } from "../components/TrafficChart";
import { FindingsList } from "../components/FindingsList";
import { FindingDetailModal } from "../components/FindingDetailModal";
import { OverviewPanel } from "../components/OverviewPanel";
import { FileUpload } from "../components/FileUpload";
import { DateRangePicker } from "../components/DateRangePicker";
import { uploadFileToS3, useGetUploadUrl, useConfirmUpload, useJob } from "../api/hooks";
import type { Site, Finding, VerifyFindingResponse } from "../types";
import styles from "./SiteDashboardPage.module.css";

type Props = {
  site: Site;
  onBack: () => void;
};

type UploadState = "idle" | "uploading" | "processing" | "complete" | "error";

export function SiteDashboardPage({ site, onBack }: Props) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const { data: dashboard, isLoading, error } = useDashboard(site.id, startDate, endDate);
  const { data: findingsData } = useFindings(site.id, startDate, endDate);
  const findings = findingsData?.findings ?? [];

  const [isUploadMode, setIsUploadMode] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

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
          <CardHeader title="Traffic over time" subtitle="Request volume by hour" />
          <TrafficChart data={dashboard.hourly_data} />
        </Card>

        <OverviewPanel summary={dashboard.summary} />
      </div>

      {findings.length > 0 && (
        <Card>
          <CardHeader
            title="Security findings"
            subtitle={`${findings.length} issue${findings.length === 1 ? "" : "s"} detected`}
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
