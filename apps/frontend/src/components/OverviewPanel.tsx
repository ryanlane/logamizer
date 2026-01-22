import type { DashboardResponse } from "../types";
import styles from "./OverviewPanel.module.css";

type Props = {
  summary: DashboardResponse["summary"];
  topPaths?: { path: string; count: number }[];
  topIps?: { ip: string; count: number }[];
  filterLabel?: string | null;
};

export function OverviewPanel({ summary, topPaths, topIps, filterLabel }: Props) {
  const paths = topPaths ?? summary.top_paths;
  const ips = topIps ?? summary.top_ips;
  const emptyMessage = filterLabel ? "No data for selected day." : "No data yet.";

  return (
    <div className={styles.wrapper}>
      <div>
        <div className={styles.label}>
          Top Paths{filterLabel ? ` · ${filterLabel}` : ""}
        </div>
        {paths.length === 0 ? (
          <div className={styles.empty}>{emptyMessage}</div>
        ) : (
          <ul className={styles.list}>
            {paths.map((item) => (
              <li key={item.path}>
                <span>{item.path}</span>
                <span>{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className={styles.label}>
          Top IPs{filterLabel ? ` · ${filterLabel}` : ""}
        </div>
        {ips.length === 0 ? (
          <div className={styles.empty}>{emptyMessage}</div>
        ) : (
          <ul className={styles.list}>
            {ips.map((item) => (
              <li key={item.ip}>
                <span>{item.ip}</span>
                <span>{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
