import { useState } from "react";
import { useErrorGroup, useExplainErrorGroup } from "../api/hooks";
import { Button } from "./Button";
import { Card } from "./Card";
import type { Site, ErrorGroup } from "../types";
import styles from "./ErrorGroupDetailModal.module.css";

type Props = {
  site: Site;
  group: ErrorGroup;
  onClose: () => void;
  onStatusChange: (status: string) => void;
};

export function ErrorGroupDetailModal({ site, group, onClose, onStatusChange }: Props) {
  const { data, isLoading } = useErrorGroup(site.id, group.id, 20);
  const explainGroup = useExplainErrorGroup(site.id);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  async function handleExplain() {
    setExplainError(null);
    try {
      const result = await explainGroup.mutateAsync({ groupId: group.id });
      setExplanation(result.explanation);
    } catch (err) {
      setExplainError((err as Error).message);
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <Card className={styles.card}>
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h2 className={styles.title}>{group.error_type}</h2>
              <p className={styles.subtitle}>
                {group.occurrence_count} occurrence{group.occurrence_count === 1 ? "" : "s"}
              </p>
            </div>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className={styles.content}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Error Message</h3>
              <div className={styles.errorMessage}>{group.error_message}</div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Timeline</h3>
              <div className={styles.timeline}>
                <div className={styles.timelineItem}>
                  <span className={styles.timelineLabel}>First seen:</span>
                  <span className={styles.timelineValue}>{formatTimestamp(group.first_seen)}</span>
                </div>
                <div className={styles.timelineItem}>
                  <span className={styles.timelineLabel}>Last seen:</span>
                  <span className={styles.timelineValue}>{formatTimestamp(group.last_seen)}</span>
                </div>
                {group.resolved_at && (
                  <div className={styles.timelineItem}>
                    <span className={styles.timelineLabel}>Resolved:</span>
                    <span className={styles.timelineValue}>{formatTimestamp(group.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {group.deployment_id && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Deployment</h3>
                <div className={styles.deploymentId}>{group.deployment_id}</div>
              </div>
            )}

            {isLoading ? (
              <div className={styles.loading}>Loading occurrences...</div>
            ) : data?.recent_occurrences && data.recent_occurrences.length > 0 ? (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Recent Occurrences ({data.recent_occurrences.length} of {group.occurrence_count})
                </h3>
                <div className={styles.occurrencesList}>
                  {data.recent_occurrences.map((occurrence) => (
                    <div key={occurrence.id} className={styles.occurrence}>
                      <div className={styles.occurrenceHeader}>
                        <span className={styles.occurrenceTime}>
                          {formatTimestamp(occurrence.timestamp)}
                        </span>
                        {occurrence.ip_address && (
                          <span className={styles.occurrenceIp}>{occurrence.ip_address}</span>
                        )}
                      </div>

                      {occurrence.request_url && (
                        <div className={styles.occurrenceRequest}>
                          <span className={styles.requestMethod}>{occurrence.request_method}</span>
                          <span className={styles.requestUrl}>{occurrence.request_url}</span>
                        </div>
                      )}

                      {occurrence.file_path && (
                        <div className={styles.occurrenceLocation}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                          </svg>
                          {occurrence.file_path}
                          {occurrence.line_number && `:${occurrence.line_number}`}
                          {occurrence.function_name && ` in ${occurrence.function_name}`}
                        </div>
                      )}

                      {occurrence.stack_trace && (
                        <details className={styles.stackTrace}>
                          <summary>Stack Trace</summary>
                          <pre className={styles.stackTraceContent}>{occurrence.stack_trace}</pre>
                        </details>
                      )}

                      {occurrence.context && Object.keys(occurrence.context).length > 0 && (
                        <details className={styles.context}>
                          <summary>Additional Context</summary>
                          <pre className={styles.contextContent}>
                            {JSON.stringify(occurrence.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>AI Analysis</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleExplain}
                  isLoading={explainGroup.isPending}
                >
                  Explain with AI
                </Button>
              </div>
              {explainError && <div className={styles.inlineError}>{explainError}</div>}
              {explanation ? (
                <div className={styles.explanation}>{explanation}</div>
              ) : (
                <div className={styles.placeholder}>
                  Generate a summary of root cause, impact, and suggested remediation.
                </div>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <div className={styles.statusActions}>
              {group.status === "unresolved" ? (
                <>
                  <Button onClick={() => onStatusChange("resolved")}>Mark as Resolved</Button>
                  <Button variant="secondary" onClick={() => onStatusChange("ignored")}>
                    Ignore
                  </Button>
                </>
              ) : (
                <Button onClick={() => onStatusChange("unresolved")}>Reopen</Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
