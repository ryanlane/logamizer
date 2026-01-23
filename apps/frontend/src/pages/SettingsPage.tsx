import { useState, useEffect } from "react";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { apiFetch, getStoredToken } from "../api/client";
import { useSites, useUpdateSite, useGetPublicIP } from "../api/hooks";
import styles from "./SettingsPage.module.css";

type OllamaModel = {
  name: string;
  size: string;
  modified: string;
};

type Props = {
  onBack: () => void;
  siteId?: string | null;
};

export function SettingsPage({ onBack, siteId }: Props) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [newModelName, setNewModelName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string>("");
  const [pullPercent, setPullPercent] = useState<number | null>(null);
  const [pullDetail, setPullDetail] = useState<string>("");

  const { data: sitesData } = useSites();
  const site = sitesData?.sites.find((s) => s.id === siteId);
  const updateSite = useUpdateSite(siteId || "");
  const getPublicIP = useGetPublicIP();

  const [hiddenIpsText, setHiddenIpsText] = useState<string>("");
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
    loadSelectedModel();
  }, []);

  useEffect(() => {
    if (site?.filtered_ips) {
      setHiddenIpsText(site.filtered_ips.join("\n"));
    }
  }, [site?.filtered_ips]);

  async function loadModels() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ models?: OllamaModel[] }>("/api/ollama/models");
      setModels(data.models || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSelectedModel() {
    try {
      const data = await apiFetch<{ model?: string }>("/api/ollama/config");
      setSelectedModel(data.model || "");
    } catch (err) {
      console.error("Failed to load selected model:", err);
    }
  }

  async function handlePullModel() {
    if (!newModelName.trim()) return;

    setIsPulling(true);
    setError(null);
    setPullProgress("Starting download...");
    setPullPercent(null);
    setPullDetail("");

    try {
      const token = getStoredToken();
      const response = await fetch("/api/ollama/pull/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ model: newModelName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to pull model");
      }

      if (!response.body) {
        throw new Error("No progress stream available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const formatBytes = (value: number) => {
        if (!value) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        let size = value;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024;
          unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed) as {
              status?: string;
              total?: number;
              completed?: number;
              digest?: string;
              error?: string;
            };

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.status) {
              setPullProgress(data.status);
            }

            if (typeof data.total === "number" && typeof data.completed === "number") {
              const percent = Math.min(100, Math.round((data.completed / data.total) * 100));
              setPullPercent(percent);
              setPullDetail(`${formatBytes(data.completed)} / ${formatBytes(data.total)}`);
            } else if (data.digest) {
              setPullDetail(`Layer ${data.digest.slice(0, 12)}…`);
            }
          } catch (err) {
            throw err;
          }
        }
      }

      setPullProgress("Download complete");
      setPullPercent(100);
      setPullDetail("");
      setIsPulling(false);
      setNewModelName("");
      await loadModels();
    } catch (err) {
      setError((err as Error).message);
      setIsPulling(false);
      setPullProgress("");
      setPullPercent(null);
      setPullDetail("");
    }
  }

  async function handleSelectModel(modelName: string) {
    try {
      await apiFetch<{ model?: string }>("/api/ollama/config", {
        method: "PUT",
        body: JSON.stringify({ model: modelName }),
      });

      setSelectedModel(modelName);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function normalizeIps(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split(/[\n,]+/)
          .map((ip) => ip.trim())
          .filter(Boolean)
      )
    );
  }

  async function handleSaveHiddenIps() {
    if (!siteId) return;
    try {
      await updateSite.mutateAsync({ filtered_ips: normalizeIps(hiddenIpsText) });
    } catch (err) {
      setIpError((err as Error).message);
    }
  }

  async function handleAddDetectedIp() {
    if (!publicIp || !siteId) return;
    const next = normalizeIps(`${hiddenIpsText}\n${publicIp}`);
    try {
      await updateSite.mutateAsync({ filtered_ips: next });
      setPublicIp(null);
    } catch (err) {
      setIpError((err as Error).message);
    }
  }

  async function handleDetectPublicIp() {
    setIpError(null);
    try {
      const data = await getPublicIP.mutateAsync();
      setPublicIp(data.ip);
    } catch (err) {
      setIpError((err as Error).message);
    }
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
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Configure Ollama and other settings</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Ollama Configuration"
          subtitle="Manage AI models for security finding explanations"
        />

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Installed Models</h3>

          {isLoading && <div className={styles.loading}>Loading models...</div>}

          {error && <div className={styles.error}>{error}</div>}

          {!isLoading && models.length === 0 && (
            <div className={styles.emptyState}>
              No models installed. Pull a model below to get started.
            </div>
          )}

          {!isLoading && models.length > 0 && (
            <div className={styles.modelsList}>
              {models.map((model) => (
                <div
                  key={model.name}
                  className={`${styles.modelItem} ${selectedModel === model.name ? styles.modelItemActive : ""}`}
                >
                  <div className={styles.modelInfo}>
                    <div className={styles.modelName}>{model.name}</div>
                    <div className={styles.modelMeta}>
                      {model.size} • Modified {new Date(model.modified).toLocaleDateString()}
                    </div>
                  </div>
                  {selectedModel === model.name ? (
                    <span className={styles.activeBadge}>Active</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSelectModel(model.name)}
                    >
                      Use this model
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Pull New Model</h3>
          <p className={styles.sectionDescription}>
            Download a model from the Ollama library. Popular models: llama3.2, llama3.1, mistral, phi3
          </p>

          <div className={styles.pullForm}>
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="Model name (e.g., llama3.2)"
              className={styles.modelInput}
              disabled={isPulling}
            />
            <Button
              onClick={handlePullModel}
              disabled={!newModelName.trim() || isPulling}
              isLoading={isPulling}
            >
              {isPulling ? "Pulling..." : "Pull Model"}
            </Button>
          </div>

          {pullProgress && (
            <div className={styles.pullProgress}>
              <div className={styles.pullProgressHeader}>
                <span>{pullProgress}</span>
                {pullPercent !== null && (
                  <span className={styles.pullPercent}>{pullPercent}%</span>
                )}
              </div>
              {pullPercent !== null && (
                <div className={styles.pullProgressBar}>
                  <div
                    className={styles.pullProgressFill}
                    style={{ width: `${pullPercent}%` }}
                  />
                </div>
              )}
              {pullDetail && (
                <div className={styles.pullProgressDetail}>{pullDetail}</div>
              )}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>About</h3>
          <p className={styles.aboutText}>
            Ollama runs locally to provide AI-powered explanations for security findings.
            Models are stored in the Ollama container and persist across restarts.
          </p>
          <p className={styles.aboutText}>
            Learn more about available models at{" "}
            <a
              href="https://ollama.com/library"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              ollama.com/library
            </a>
          </p>
        </div>
      </Card>

      <Card className={styles.cardSpacing}>
        <CardHeader
          title="Privacy & IP filtering"
          subtitle="Hide traffic from your own IPs in the dashboard"
        />

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Hidden IP addresses</h3>
          {!siteId ? (
            <p className={styles.sectionDescription}>
              Select a site to configure IP filtering.
            </p>
          ) : (
            <>
              <p className={styles.sectionDescription}>
                Add IPs you want excluded from Top IPs and day summaries. One per line or
                comma-separated.
              </p>
              <textarea
                className={styles.textarea}
                rows={5}
                value={hiddenIpsText}
                onChange={(event) => setHiddenIpsText(event.target.value)}
                placeholder="203.0.113.10&#10;198.51.100.42"
              />
              <div className={styles.actionsRow}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSaveHiddenIps}
                  isLoading={updateSite.isPending}
                >
                  Save hidden IPs
                </Button>
                {site?.filtered_ips && site.filtered_ips.length > 0 && (
                  <span className={styles.helperText}>
                    {site.filtered_ips.length} IP{site.filtered_ips.length === 1 ? "" : "s"} hidden
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Detect your public IP</h3>
          {!siteId ? (
            <p className={styles.sectionDescription}>
              Select a site to detect and filter your public IP.
            </p>
          ) : (
            <>
              <p className={styles.sectionDescription}>
                Use this to discover your current public IP, then add it to the hidden list.
              </p>
              <div className={styles.actionsRow}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDetectPublicIp}
                  isLoading={getPublicIP.isPending}
                >
                  Detect public IP
                </Button>
                {publicIp && <span className={styles.publicIp}>{publicIp}</span>}
                {publicIp && (
                  <Button
                    size="sm"
                    onClick={handleAddDetectedIp}
                    isLoading={updateSite.isPending}
                  >
                    Add to hidden list
                  </Button>
                )}
              </div>
              {ipError && <div className={styles.inlineError}>{ipError}</div>}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
