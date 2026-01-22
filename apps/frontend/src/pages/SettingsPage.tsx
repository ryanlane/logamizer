import { useState, useEffect } from "react";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import styles from "./SettingsPage.module.css";

type OllamaModel = {
  name: string;
  size: string;
  modified: string;
};

type Props = {
  onBack: () => void;
};

export function SettingsPage({ onBack }: Props) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [newModelName, setNewModelName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string>("");

  useEffect(() => {
    loadModels();
    loadSelectedModel();
  }, []);

  async function loadModels() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ollama/models");
      if (!response.ok) throw new Error("Failed to fetch models");
      const data = await response.json();
      setModels(data.models || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSelectedModel() {
    try {
      const response = await fetch("/api/ollama/config");
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
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

    try {
      const response = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModelName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to pull model");
      }

      // For now, just poll for completion
      // In a real implementation, you'd want to stream progress
      setPullProgress("Downloading model... This may take several minutes.");

      // Poll until model appears in list
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      const pollInterval = setInterval(async () => {
        attempts++;
        const listResponse = await fetch("/api/ollama/models");
        if (listResponse.ok) {
          const data = await listResponse.json();
          const modelExists = data.models?.some((m: OllamaModel) =>
            m.name.includes(newModelName.trim())
          );

          if (modelExists || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setIsPulling(false);
            setPullProgress("");
            if (modelExists) {
              setNewModelName("");
              await loadModels();
            } else {
              setError("Model download timed out. Check Ollama logs.");
            }
          } else {
            setPullProgress(`Downloading... ${attempts * 5}s elapsed`);
          }
        }
      }, 5000);
    } catch (err) {
      setError((err as Error).message);
      setIsPulling(false);
      setPullProgress("");
    }
  }

  async function handleSelectModel(modelName: string) {
    try {
      const response = await fetch("/api/ollama/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });

      if (!response.ok) throw new Error("Failed to update model");

      setSelectedModel(modelName);
    } catch (err) {
      setError((err as Error).message);
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
              {pullProgress}
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
    </div>
  );
}
