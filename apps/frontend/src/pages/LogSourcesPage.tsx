import { useState } from "react";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import {
  useLogSources,
  useDeleteLogSource,
  useUpdateLogSource,
  useFetchNow,
} from "../api/hooks";
import { LogSourceFormModal } from "../components/LogSourceFormModal";
import type { Site, LogSource } from "../types";
import styles from "./LogSourcesPage.module.css";

type Props = {
  site: Site;
  onBack: () => void;
};

export function LogSourcesPage({ site, onBack }: Props) {
  const { data, isLoading, error } = useLogSources(site.id);
  const deleteLogSource = useDeleteLogSource(site.id);
  const fetchNow = useFetchNow(site.id, "");

  const [isCreating, setIsCreating] = useState(false);
  const [editingSource, setEditingSource] = useState<LogSource | null>(null);

  const logSources = data?.log_sources ?? [];

  function handleDelete(logSourceId: string) {
    if (confirm("Are you sure you want to delete this log source?")) {
      deleteLogSource.mutate(logSourceId);
    }
  }

  function handleFetchNow(logSourceId: string) {
    fetchNow.mutate(undefined, {
      mutationKey: ["fetch-now", site.id, logSourceId],
    });
  }

  function formatBytes(bytes: number | null): string {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  function formatLastFetch(lastFetchAt: string | null): string {
    if (!lastFetchAt) return "Never";
    const date = new Date(lastFetchAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
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
          <h1 className={styles.title}>Log Sources</h1>
          <p className={styles.subtitle}>{site.name} - Scheduled fetching</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Log Source
        </Button>
      </div>

      {isLoading && <div className={styles.loading}>Loading log sources...</div>}

      {error && <div className={styles.error}>Failed to load log sources: {error.message}</div>}

      {!isLoading && logSources.length === 0 && (
        <Card>
          <div className={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
              <polyline points="7.5 19.79 7.5 14.6 3 12" />
              <polyline points="21 12 16.5 14.6 16.5 19.79" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <h2>No log sources configured</h2>
            <p>Set up scheduled fetching to automatically download logs from remote servers or cloud storage.</p>
            <Button onClick={() => setIsCreating(true)}>Add your first log source</Button>
          </div>
        </Card>
      )}

      {!isLoading && logSources.length > 0 && (
        <div className={styles.sourcesList}>
          {logSources.map((source) => (
            <Card key={source.id}>
              <div className={styles.sourceCard}>
                <div className={styles.sourceHeader}>
                  <div className={styles.sourceInfo}>
                    <h3 className={styles.sourceName}>{source.name}</h3>
                    <div className={styles.sourceMeta}>
                      <span className={styles.sourceType}>
                        {source.source_type.toUpperCase()}
                      </span>
                      <span className={`${styles.status} ${styles[`status-${source.status}`]}`}>
                        {source.status}
                      </span>
                    </div>
                  </div>
                  <div className={styles.sourceActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleFetchNow(source.id)}
                    >
                      Fetch Now
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingSource(source)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(source.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className={styles.sourceStats}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Last Fetch</span>
                    <span className={styles.statValue}>
                      {formatLastFetch(source.last_fetch_at)}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Status</span>
                    <span className={styles.statValue}>
                      {source.last_fetch_status || "N/A"}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Data Fetched</span>
                    <span className={styles.statValue}>
                      {formatBytes(source.last_fetched_bytes)}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Schedule</span>
                    <span className={styles.statValue}>
                      {source.schedule_type === "interval"
                        ? `Every ${source.schedule_config.interval_minutes}m`
                        : source.schedule_config.cron}
                    </span>
                  </div>
                </div>

                {source.last_fetch_error && (
                  <div className={styles.errorMessage}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {source.last_fetch_error}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {isCreating && (
        <LogSourceFormModal
          site={site}
          onClose={() => setIsCreating(false)}
        />
      )}

      {editingSource && (
        <LogSourceFormModal
          site={site}
          logSource={editingSource}
          onClose={() => setEditingSource(null)}
        />
      )}
    </div>
  );
}
