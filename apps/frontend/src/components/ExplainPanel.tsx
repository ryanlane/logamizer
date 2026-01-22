import { useState } from "react";
import styles from "./ExplainPanel.module.css";
import { apiFetch } from "../api/client";

type Props = {
  siteId?: string;
};

export function ExplainPanel({ siteId }: Props) {
  const [prompt, setPrompt] = useState("Summarize the security issues from the last upload");
  const [context, setContext] = useState("overview");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExplain() {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ response: string }>(`/api/sites/${siteId}/explain`, {
        method: "POST",
        body: JSON.stringify({ prompt, context }),
      });
      setResponse(data.response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <div>
          <label className={styles.label}>Prompt</label>
          <textarea
            className={styles.textarea}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label}>Context</label>
          <select
            className={styles.select}
            value={context}
            onChange={(event) => setContext(event.target.value)}
          >
            <option value="overview">Overview</option>
            <option value="findings">Findings</option>
            <option value="anomalies">Anomalies</option>
          </select>
          <button
            className={styles.button}
            onClick={handleExplain}
            disabled={!siteId || isLoading}
          >
            {isLoading ? "Explaining…" : "Explain"}
          </button>
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {response && <div className={styles.response}>{response}</div>}
    </div>
  );
}
