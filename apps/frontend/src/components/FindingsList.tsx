import type { Finding } from "../types";
import styles from "./FindingsList.module.css";

type Props = {
  findings: Finding[];
  onFindingClick?: (finding: Finding) => void;
};

const severityClass: Record<string, string> = {
  critical: styles.critical,
  high: styles.high,
  medium: styles.medium,
  low: styles.low,
  info: styles.info,
};

export function FindingsList({ findings, onFindingClick }: Props) {
  if (!findings.length) {
    return <div className={styles.empty}>No findings yet.</div>;
  }

  return (
    <div className={styles.list}>
      {findings.map((finding) => (
        <button
          key={finding.id}
          className={styles.item}
          onClick={() => onFindingClick?.(finding)}
        >
          <div className={styles.header}>
            <div>
              <div className={styles.title}>{finding.title}</div>
              <div className={styles.type}>{finding.finding_type}</div>
            </div>
            <span className={`${styles.severity} ${severityClass[finding.severity] ?? ""}`}>
              {finding.severity}
            </span>
          </div>
          <p className={styles.description}>{finding.description}</p>
          {onFindingClick && (
            <div className={styles.clickHint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
