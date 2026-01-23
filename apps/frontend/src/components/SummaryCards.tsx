import type { DashboardResponse, Site } from "../types";
import styles from "./SummaryCards.module.css";

type Props = {
  summary: DashboardResponse["summary"];
  site: Site;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatPercentage(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(2)}%`;
}

export function SummaryCards({ summary, site }: Props) {
  return (
    <div>
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.label}>Total requests</div>
          <div className={styles.value}>{summary.total_requests.toLocaleString()}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Unique IPs</div>
          <div className={styles.value}>{summary.unique_ips.toLocaleString()}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Unique paths</div>
          <div className={styles.value}>{summary.unique_paths.toLocaleString()}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Error rate</div>
          <div className={styles.value}>
            {summary.total_requests === 0
              ? "0%"
              : formatPercentage(summary.status_5xx, summary.total_requests)}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.label}>Bytes</div>
          <div className={styles.value}>{formatBytes(summary.total_bytes)}</div>
        </div>
      </div>
    </div>
  );
}
