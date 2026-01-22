import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Finding, VerifyFindingResponse } from "../types";
import { Button } from "./Button";
import { Card } from "./Card";
import { getStoredToken } from "../api/client";
import styles from "./FindingDetailModal.module.css";

type Props = {
  finding: Finding;
  onClose: () => void;
  onExplain: (findingId: string) => Promise<string>;
  onVerify?: (findingId: string) => Promise<VerifyFindingResponse>;
};

export function FindingDetailModal({ finding, onClose, onExplain, onVerify }: Props) {
  const [explanation, setExplanation] = useState<string>("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [verificationResult, setVerificationResult] = useState<VerifyFindingResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  async function handleExplain() {
    setIsExplaining(true);
    setExplainError(null);
    setExplanation("");

    try {
      const token = getStoredToken();
      const response = await fetch(`/api/findings/${finding.id}/explain`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get explanation: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              setExplanation((prev) => prev + data.token);
            }
            if (data.done) {
              setIsExplaining(false);
            }
          }
        }
      }
    } catch (err) {
      setExplainError((err as Error).message);
      setIsExplaining(false);
    }
  }

  async function handleVerify() {
    if (!onVerify) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const result = await onVerify(finding.id);
      setVerificationResult(result);
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setIsVerifying(false);
    }
  }

  const severityColors: Record<string, string> = {
    critical: "var(--color-danger)",
    high: "#f97316",
    medium: "#f59e0b",
    low: "#3b82f6",
    info: "var(--color-text-secondary)",
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <Card className={styles.card}>
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>{finding.title}</h2>
              <button className={styles.closeButton} onClick={onClose}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.meta}>
              <span
                className={styles.severity}
                style={{ color: severityColors[finding.severity] || "var(--color-text)" }}
              >
                {finding.severity.toUpperCase()}
              </span>
              <span className={styles.type}>{finding.finding_type}</span>
              <span className={styles.date}>
                {new Date(finding.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          <div className={styles.content}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Description</h3>
              <p className={styles.description}>{finding.description}</p>
            </section>

            {finding.suggested_action && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Suggested Action</h3>
                <p className={styles.suggestedAction}>{finding.suggested_action}</p>
              </section>
            )}

            {finding.evidence && finding.evidence.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Evidence ({finding.evidence.length} samples)</h3>
                <div className={styles.evidence}>
                  {finding.evidence.slice(0, 5).map((ev, idx) => (
                    <div key={idx} className={styles.evidenceItem}>
                      {ev.line && <span className={styles.lineNumber}>Line {ev.line}</span>}
                      <pre className={styles.evidenceRaw}>{ev.raw}</pre>
                    </div>
                  ))}
                  {finding.evidence.length > 5 && (
                    <div className={styles.evidenceMore}>
                      +{finding.evidence.length - 5} more samples
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>AI Explanation</h3>
                {!explanation && !isExplaining && (
                  <Button size="sm" onClick={handleExplain}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
                    </svg>
                    Explain with AI
                  </Button>
                )}
              </div>

              {explainError && (
                <div className={styles.error}>Failed to generate explanation: {explainError}</div>
              )}

              {(isExplaining || explanation) && (
                <div className={styles.explanation}>
                  {isExplaining && !explanation && (
                    <div className={styles.loadingInline}>
                      <div className={styles.spinner} />
                      <span>Analyzing finding with AI...</span>
                    </div>
                  )}
                  {explanation && (
                    <div className={styles.markdown}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {explanation}
                      </ReactMarkdown>
                    </div>
                  )}
                  {isExplaining && explanation && (
                    <div className={styles.streamingIndicator}>
                      <div className={styles.pulse} />
                      Generating...
                    </div>
                  )}
                </div>
              )}
            </section>

            {onVerify && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Verification</h3>
                  {!verificationResult && !isVerifying && (
                    <Button size="sm" variant="secondary" onClick={handleVerify}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Test against site
                    </Button>
                  )}
                </div>

                {isVerifying && (
                  <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span>Testing vulnerability against live site...</span>
                  </div>
                )}

                {verifyError && (
                  <div className={styles.error}>Verification failed: {verifyError}</div>
                )}

                {verificationResult && (
                  <div
                    className={
                      verificationResult.verified ? styles.verificationDanger : styles.verificationSafe
                    }
                  >
                    <div className={styles.verificationIcon}>
                      {verificationResult.verified ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <strong>
                        {verificationResult.verified
                          ? "Vulnerability confirmed"
                          : "Site appears protected"}
                      </strong>
                      <p>{verificationResult.details}</p>
                      {verificationResult.probes && verificationResult.probes.length > 0 && (
                        <div className={styles.probeList}>
                          <h4 className={styles.probeTitle}>Request details</h4>
                          {verificationResult.probes.map((probe, index) => (
                            <div key={`${probe.url}-${index}`} className={styles.probeItem}>
                              <div className={styles.probeUrl}>{probe.url}</div>
                              <div className={styles.probeMeta}>
                                {probe.status_code !== undefined && probe.status_code !== null && (
                                  <span>Status {probe.status_code}</span>
                                )}
                                {probe.error && <span className={styles.probeError}>{probe.error}</span>}
                              </div>
                              {probe.headers && (
                                <div className={styles.probeHeaders}>
                                  {Object.entries(probe.headers).map(([key, value]) => (
                                    <div key={`${probe.url}-${key}`} className={styles.probeHeaderRow}>
                                      <span className={styles.probeHeaderKey}>{key}</span>
                                      <span className={styles.probeHeaderValue}>{value}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
