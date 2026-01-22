import { useCallback, useState } from "react";
import { uploadFileToS3, useConfirmUpload, useGetUploadUrl, useJob } from "../../api/hooks";
import type { Site } from "../../types";
import { Button } from "../Button";
import { Card, CardHeader } from "../Card";
import { FileUpload } from "../FileUpload";
import styles from "./UploadStep.module.css";

type Props = {
  site: Site;
  onComplete: () => void;
  onBack: () => void;
};

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; filename: string; progress: number }
  | { status: "processing"; filename: string; jobId: string }
  | { status: "complete"; filename: string }
  | { status: "error"; message: string };

export function UploadStep({ site, onComplete, onBack }: Props) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });

  const getUploadUrl = useGetUploadUrl();
  const confirmUpload = useConfirmUpload();

  const jobId = uploadState.status === "processing" ? uploadState.jobId : undefined;
  const jobQuery = useJob(jobId);

  const job = jobQuery.data;

  // Check if job is complete
  if (uploadState.status === "processing" && job) {
    if (job.status === "completed") {
      setUploadState({ status: "complete", filename: uploadState.filename });
    } else if (job.status === "failed") {
      setUploadState({ status: "error", message: job.error_message || "Processing failed" });
    }
  }

  const handleFileSelect = useCallback(
    async (file: File) => {
      setUploadState({ status: "uploading", filename: file.name, progress: 10 });

      try {
        // Step 1: Get presigned upload URL
        const { upload_url, log_file_id } = await getUploadUrl.mutateAsync({
          siteId: site.id,
          filename: file.name,
        });

        setUploadState({ status: "uploading", filename: file.name, progress: 30 });

        // Step 2: Upload file to S3/MinIO
        await uploadFileToS3(upload_url, file);

        setUploadState({ status: "uploading", filename: file.name, progress: 70 });

        // Step 3: Confirm upload and start processing
        const job = await confirmUpload.mutateAsync({
          siteId: site.id,
          logFileId: log_file_id,
          sizeBytes: file.size,
        });

        setUploadState({ status: "processing", filename: file.name, jobId: job.id });
      } catch (err) {
        setUploadState({ status: "error", message: (err as Error).message });
      }
    },
    [site.id, getUploadUrl, confirmUpload]
  );

  function handleReset() {
    setUploadState({ status: "idle" });
  }

  return (
    <div className={styles.container}>
      <Card>
        <CardHeader
          title="Upload your log file"
          subtitle={`Uploading to ${site.name}`}
        />

        {uploadState.status === "idle" && (
          <>
            <FileUpload file={null} onFileSelect={handleFileSelect} accept=".log,.txt,.gz" />
            <div className={styles.actions}>
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
            </div>
          </>
        )}

        {uploadState.status === "uploading" && (
          <div className={styles.progressContainer}>
            <div className={styles.progressIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={styles.spinner}>
                <circle cx="24" cy="24" r="20" stroke="var(--color-gray-200)" strokeWidth="4" />
                <path
                  d="M44 24a20 20 0 00-20-20"
                  stroke="var(--color-primary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className={styles.progressText}>
              <strong>Uploading {uploadState.filename}</strong>
              <span>Transferring file to storage...</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        {uploadState.status === "processing" && (
          <div className={styles.progressContainer}>
            <div className={styles.progressIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={styles.spinner}>
                <circle cx="24" cy="24" r="20" stroke="var(--color-gray-200)" strokeWidth="4" />
                <path
                  d="M44 24a20 20 0 00-20-20"
                  stroke="var(--color-primary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className={styles.progressText}>
              <strong>Analyzing {uploadState.filename}</strong>
              <span>
                {job?.status === "processing"
                  ? `Processing... ${Math.round(job.progress)}%`
                  : "Queued for processing..."}
              </span>
            </div>
            {job && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {uploadState.status === "complete" && (
          <div className={styles.successContainer}>
            <div className={styles.successIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" fill="var(--color-success-light)" />
                <path
                  d="M16 24l6 6 12-12"
                  stroke="var(--color-success)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={styles.successText}>
              <strong>Analysis complete!</strong>
              <span>{uploadState.filename} has been processed successfully.</span>
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={handleReset}>
                Upload another file
              </Button>
              <Button onClick={onComplete}>View results</Button>
            </div>
          </div>
        )}

        {uploadState.status === "error" && (
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" fill="var(--color-danger-light)" />
                <path
                  d="M18 18l12 12M30 18l-12 12"
                  stroke="var(--color-danger)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className={styles.errorText}>
              <strong>Upload failed</strong>
              <span>{uploadState.message}</span>
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
              <Button onClick={handleReset}>Try again</Button>
            </div>
          </div>
        )}
      </Card>

      {uploadState.status === "idle" && (
        <div className={styles.tips}>
          <strong>Tips for best results</strong>
          <ul>
            <li>Upload complete access log files (not error logs)</li>
            <li>Files up to 100MB are supported</li>
            <li>Analysis typically takes a few seconds per MB</li>
            <li>Supported formats: .log, .txt, .gz (compressed)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
