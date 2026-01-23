import { useState } from "react";
import {
  useAnalyzeErrors,
  useErrorGroups,
  useErrorStats,
  useLogFiles,
  useUpdateErrorGroup,
} from "../api/hooks";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { ErrorGroupDetailModal } from "../components/ErrorGroupDetailModal";
import type { Site, ErrorGroup } from "../types";
import styles from "./ErrorsPage.module.css";
import inputStyles from "../components/Input.module.css";

type Props = {
  site: Site;
  onBack: () => void;
};

export function ErrorsPage({ site, onBack }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<ErrorGroup | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [errorTypeFilter, setErrorTypeFilter] = useState<string | null>(null);

  const { data: errorGroupsData, isLoading } = useErrorGroups(
    site.id,
    statusFilter,
    errorTypeFilter
  );
  const { data: stats } = useErrorStats(site.id);
  const { data: logFilesData } = useLogFiles(site.id);
  const updateErrorGroup = useUpdateErrorGroup(site.id);
  const analyzeErrors = useAnalyzeErrors(site.id);

  const errorGroups = errorGroupsData?.error_groups ?? [];
  const logFiles = logFilesData?.log_files ?? [];
  const suggestedLogFile =
    logFiles.find((file) => /error|modsec|modsecurity/i.test(file.filename)) ??
    logFiles[0];

  function handleAnalyzeLatest() {
    if (!suggestedLogFile) return;
    analyzeErrors.mutate({ logFileId: suggestedLogFile.id });
  }

  function handleMarkAsResolved(groupId: string) {
    updateErrorGroup.mutate({ groupId, status: "resolved" });
  }

  function handleMarkAsIgnored(groupId: string) {
    updateErrorGroup.mutate({ groupId, status: "ignored" });
  }

  function handleMarkAsUnresolved(groupId: string) {
    updateErrorGroup.mutate({ groupId, status: "unresolved" });
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function formatRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function getSeverityBadge(occurrenceCount: number): string {
    if (occurrenceCount >= 100) return styles.severityCritical;
    if (occurrenceCount >= 10) return styles.severityHigh;
    if (occurrenceCount >= 3) return styles.severityMedium;
    return styles.severityLow;
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading errors...</div>
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
          <h1 className={styles.title}>Error Analysis - {site.name}</h1>
          <p className={styles.subtitle}>Application errors and exceptions</p>
        </div>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Total Errors</div>
            <div className={styles.statValue}>{stats.total_errors.toLocaleString()}</div>
          </Card>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Error Groups</div>
            <div className={styles.statValue}>{stats.total_groups}</div>
          </Card>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Last 24 Hours</div>
            <div className={styles.statValue}>{stats.errors_24h.toLocaleString()}</div>
          </Card>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Last 7 Days</div>
            <div className={styles.statValue}>{stats.errors_7d.toLocaleString()}</div>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader
          title="Error Groups"
          subtitle={`${errorGroups.length} group${errorGroups.length === 1 ? "" : "s"}`}
          action={
            <div className={styles.filters}>
              <select
                className={`${inputStyles.input} ${inputStyles.select}`}
                value={statusFilter ?? ""}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="unresolved">Unresolved</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          }
        />

        {errorGroups.length === 0 ? (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <h3>No errors found</h3>
            <p>
              {statusFilter || errorTypeFilter
                ? "Try adjusting your filters"
                : "Upload log files containing errors to see analysis here"}
            </p>
            {!statusFilter && !errorTypeFilter && suggestedLogFile && (
              <div className={styles.emptyActions}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAnalyzeLatest}
                  isLoading={analyzeErrors.isPending}
                >
                  Analyze latest upload
                </Button>
                <div className={styles.emptyHint}>
                  Latest: {suggestedLogFile.filename}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.errorList}>
            {errorGroups.map((group) => (
              <div key={group.id} className={styles.errorCard}>
                <div className={styles.errorHeader}>
                  <div className={styles.errorTitle}>
                    <span className={`${styles.errorBadge} ${getSeverityBadge(group.occurrence_count)}`}>
                      {group.occurrence_count}×
                    </span>
                    <span className={styles.errorType}>{group.error_type}</span>
                    {group.status !== "unresolved" && (
                      <span className={`${styles.statusBadge} ${styles[`status${group.status.charAt(0).toUpperCase() + group.status.slice(1)}`]}`}>
                        {group.status}
                      </span>
                    )}
                  </div>
                  <div className={styles.errorMeta}>
                    <span className={styles.errorTime}>Last seen {formatRelativeTime(group.last_seen)}</span>
                  </div>
                </div>
                <div className={styles.errorMessage}>{group.error_message}</div>
                {(group.sample_request_urls?.length || group.sample_request_url) && (
                  <div className={styles.sampleRequest}>
                    <span className={styles.sampleLabel}>Sample request:</span>
                    <span className={styles.sampleValue}>
                      {group.sample_request_urls?.length
                        ? group.sample_request_urls.join(", ")
                        : group.sample_request_url}
                    </span>
                    {group.sample_ip_address && (
                      <span className={styles.sampleIp}>· {group.sample_ip_address}</span>
                    )}
                  </div>
                )}
                <div className={styles.errorFooter}>
                  <span className={styles.errorDate}>
                    First seen: {formatTimestamp(group.first_seen)}
                  </span>
                  <div className={styles.errorActions}>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedGroup(group)}>
                      Details
                    </Button>
                    {group.status === "unresolved" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleMarkAsResolved(group.id)}
                          isLoading={updateErrorGroup.isPending}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleMarkAsIgnored(group.id)}
                          isLoading={updateErrorGroup.isPending}
                        >
                          Ignore
                        </Button>
                      </>
                    )}
                    {group.status !== "unresolved" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkAsUnresolved(group.id)}
                        isLoading={updateErrorGroup.isPending}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedGroup && (
        <ErrorGroupDetailModal
          site={site}
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onStatusChange={(status) => {
            updateErrorGroup.mutate({ groupId: selectedGroup.id, status });
            setSelectedGroup(null);
          }}
        />
      )}
    </div>
  );
}
