import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState<"paths" | "ips">("paths");

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={activeTab === "paths" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("paths")}
        >
          Top Paths
        </button>
        <button
          type="button"
          className={activeTab === "ips" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("ips")}
        >
          Top IPs
        </button>
      </div>

      <div className={styles.label}>
        {activeTab === "paths" ? "Top Paths" : "Top IPs"}
        {filterLabel ? ` · ${filterLabel}` : ""}
      </div>

      {activeTab === "paths" ? (
        paths.length === 0 ? (
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
        )
      ) : ips.length === 0 ? (
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
  );
}
