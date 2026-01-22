import type { DashboardResponse } from "../types";
import styles from "./OverviewPanel.module.css";

type Props = {
  summary: DashboardResponse["summary"];
};

export function OverviewPanel({ summary }: Props) {
  return (
    <div className={styles.wrapper}>
      <div>
        <div className={styles.label}>Top Paths</div>
        <ul className={styles.list}>
          {summary.top_paths.map((item) => (
            <li key={item.path}>
              <span>{item.path}</span>
              <span>{item.count}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className={styles.label}>Top IPs</div>
        <ul className={styles.list}>
          {summary.top_ips.map((item) => (
            <li key={item.ip}>
              <span>{item.ip}</span>
              <span>{item.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
