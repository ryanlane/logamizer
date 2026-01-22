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

function formatDate(isoString: string | null): string {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SummaryCards({ summary }: Props) {
  const errorRate =
    summary.total_requests === 0
      ? 0
      : (summary.status_5xx / summary.total_requests) * 100;

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.icon} data-color="blue">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 10h14M3 5h14M3 15h8" strokeLinecap="round" />
          </svg>
        </div>
        <div className={styles.content}>
          <div className={styles.value}>{summary.total_requests.toLocaleString()}</div>
          <div className={styles.label}>Total requests</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.icon} data-color="purple">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="7" r="3" />
            <path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
          </svg>
        </div>
        <div className={styles.content}>
          <div className={styles.value}>{summary.unique_ips.toLocaleString()}</div>
          <div className={styles.label}>Unique IPs</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.icon} data-color={errorRate > 5 ? "red" : errorRate > 1 ? "yellow" : "green"}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6v4l2 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={styles.content}>
          <div className={styles.value}>{errorRate.toFixed(2)}%</div>
          <div className={styles.label}>Error rate (5xx)</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.icon} data-color="blue">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={styles.content}>
          <div className={styles.value}>{formatBytes(summary.total_bytes)}</div>
          <div className={styles.label}>Data transferred</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.icon} data-color="green">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 2l6 3.5v9L10 18l-6-3.5v-9L10 2z" />
            <path d="M10 8v4M10 14h.01" strokeLinecap="round" />
          </svg>
        </div>
        <div className={styles.content}>
          <div className={styles.value}>{summary.unique_paths.toLocaleString()}</div>
          <div className={styles.label}>Unique paths</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.icon} data-color="gray">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="14" height="12" rx="2" />
            <path d="M3 8h14" />
          </svg>
        </div>
        <div className={styles.content}>
          <div className={styles.value}>{formatDate(summary.first_seen)}</div>
          <div className={styles.label}>First seen</div>
        </div>
      </div>
    </div>
  );
}
