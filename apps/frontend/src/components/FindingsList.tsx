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
        <div
          key={finding.id}
          className={`${styles.item} ${onFindingClick ? styles.clickable : ""}`}
          onClick={() => onFindingClick?.(finding)}
          role={onFindingClick ? "button" : undefined}
          tabIndex={onFindingClick ? 0 : undefined}
          onKeyDown={(event) => {
            if (!onFindingClick) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onFindingClick(finding);
            }
          }}
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
        </div>
      ))}
    </div>
  );
}
