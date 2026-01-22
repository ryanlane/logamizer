import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { useCreateLogSource, useUpdateLogSource } from "../api/hooks";
import type { Site, LogSource } from "../types";
import styles from "./LogSourceFormModal.module.css";

type Props = {
  site: Site;
  logSource?: LogSource;
  onClose: () => void;
};

export function LogSourceFormModal({ site, logSource, onClose }: Props) {
  const isEditing = !!logSource;

  const [name, setName] = useState(logSource?.name ?? "");
  const [sourceType, setSourceType] = useState<"ssh" | "sftp" | "s3">(
    (logSource?.source_type as "ssh" | "sftp" | "s3") ?? "ssh"
  );
  const [scheduleType, setScheduleType] = useState<"interval" | "cron">(
    (logSource?.schedule_type as "interval" | "cron") ?? "interval"
  );

  // SSH/SFTP fields
  const [sshHost, setSshHost] = useState(logSource?.connection_config?.host ?? "");
  const [sshPort, setSshPort] = useState(logSource?.connection_config?.port ?? 22);
  const [sshUsername, setSshUsername] = useState(logSource?.connection_config?.username ?? "");
  const [sshPassword, setSshPassword] = useState("");
  const [sshPrivateKey, setSshPrivateKey] = useState("");
  const [sshRemotePath, setSshRemotePath] = useState(logSource?.connection_config?.remote_path ?? "");
  const [sshPattern, setSshPattern] = useState(logSource?.connection_config?.pattern ?? "*.log");

  // S3 fields
  const [s3Bucket, setS3Bucket] = useState(logSource?.connection_config?.bucket ?? "");
  const [s3Prefix, setS3Prefix] = useState(logSource?.connection_config?.prefix ?? "");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Region, setS3Region] = useState(logSource?.connection_config?.region ?? "us-east-1");
  const [s3Endpoint, setS3Endpoint] = useState(logSource?.connection_config?.endpoint_url ?? "");
  const [s3HoursAgo, setS3HoursAgo] = useState(logSource?.connection_config?.hours_ago ?? 24);

  // Schedule fields
  const [intervalMinutes, setIntervalMinutes] = useState(
    logSource?.schedule_config?.interval_minutes ?? 60
  );
  const [cronExpression, setCronExpression] = useState(logSource?.schedule_config?.cron ?? "");

  const [error, setError] = useState<string | null>(null);

  const createLogSource = useCreateLogSource(site.id);
  const updateLogSource = useUpdateLogSource(site.id, logSource?.id ?? "");

  function buildConnectionConfig() {
    if (sourceType === "ssh" || sourceType === "sftp") {
      return {
        host: sshHost,
        port: sshPort,
        username: sshUsername,
        ...(sshPassword && { password: sshPassword }),
        ...(sshPrivateKey && { private_key: sshPrivateKey }),
        remote_path: sshRemotePath,
        pattern: sshPattern,
      };
    } else if (sourceType === "s3") {
      return {
        bucket: s3Bucket,
        prefix: s3Prefix,
        ...(s3AccessKey && { access_key_id: s3AccessKey }),
        ...(s3SecretKey && { secret_access_key: s3SecretKey }),
        region: s3Region,
        ...(s3Endpoint && { endpoint_url: s3Endpoint }),
        hours_ago: s3HoursAgo,
      };
    }
    return {};
  }

  function buildScheduleConfig() {
    if (scheduleType === "interval") {
      return { interval_minutes: intervalMinutes };
    } else {
      return { cron: cronExpression };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const data = {
        name,
        source_type: sourceType,
        connection_config: buildConnectionConfig(),
        schedule_type: scheduleType,
        schedule_config: buildScheduleConfig(),
      };

      if (isEditing) {
        await updateLogSource.mutateAsync(data);
      } else {
        await createLogSource.mutateAsync(data);
      }

      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <Card className={styles.card}>
          <form onSubmit={handleSubmit}>
            <div className={styles.header}>
              <h2 className={styles.title}>
                {isEditing ? "Edit Log Source" : "Add Log Source"}
              </h2>
              <button type="button" className={styles.closeButton} onClick={onClose}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.section}>
              <label className={styles.label}>
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production Nginx Logs"
                  className={styles.input}
                  required
                />
              </label>

              <label className={styles.label}>
                Source Type
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as "ssh" | "sftp" | "s3")}
                  className={styles.input}
                  disabled={isEditing}
                >
                  <option value="ssh">SSH/SFTP</option>
                  <option value="s3">S3 / MinIO</option>
                </select>
              </label>
            </div>

            {(sourceType === "ssh" || sourceType === "sftp") && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>SSH Connection</h3>

                <div className={styles.row}>
                  <label className={styles.label} style={{ flex: 2 }}>
                    Host
                    <input
                      type="text"
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                      placeholder="example.com"
                      className={styles.input}
                      required
                    />
                  </label>

                  <label className={styles.label} style={{ flex: 1 }}>
                    Port
                    <input
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(Number(e.target.value))}
                      className={styles.input}
                      required
                    />
                  </label>
                </div>

                <label className={styles.label}>
                  Username
                  <input
                    type="text"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    placeholder="ubuntu"
                    className={styles.input}
                    required
                  />
                </label>

                <label className={styles.label}>
                  Password (optional)
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="Leave empty to use SSH key"
                    className={styles.input}
                  />
                </label>

                <label className={styles.label}>
                  Private Key (optional)
                  <textarea
                    value={sshPrivateKey}
                    onChange={(e) => setSshPrivateKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className={styles.textarea}
                    rows={4}
                  />
                </label>

                <label className={styles.label}>
                  Remote Path
                  <input
                    type="text"
                    value={sshRemotePath}
                    onChange={(e) => setSshRemotePath(e.target.value)}
                    placeholder="/var/log/nginx/access.log"
                    className={styles.input}
                    required
                  />
                </label>

                <label className={styles.label}>
                  File Pattern
                  <input
                    type="text"
                    value={sshPattern}
                    onChange={(e) => setSshPattern(e.target.value)}
                    placeholder="*.log"
                    className={styles.input}
                  />
                </label>
              </div>
            )}

            {sourceType === "s3" && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>S3 Configuration</h3>

                <label className={styles.label}>
                  Bucket Name
                  <input
                    type="text"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    placeholder="my-logs-bucket"
                    className={styles.input}
                    required
                  />
                </label>

                <label className={styles.label}>
                  Prefix (optional)
                  <input
                    type="text"
                    value={s3Prefix}
                    onChange={(e) => setS3Prefix(e.target.value)}
                    placeholder="logs/nginx/"
                    className={styles.input}
                  />
                </label>

                <label className={styles.label}>
                  Access Key ID
                  <input
                    type="text"
                    value={s3AccessKey}
                    onChange={(e) => setS3AccessKey(e.target.value)}
                    placeholder={isEditing ? "***REDACTED***" : "AKIAIOSFODNN7EXAMPLE"}
                    className={styles.input}
                    required={!isEditing}
                  />
                </label>

                <label className={styles.label}>
                  Secret Access Key
                  <input
                    type="password"
                    value={s3SecretKey}
                    onChange={(e) => setS3SecretKey(e.target.value)}
                    placeholder={isEditing ? "***REDACTED***" : "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}
                    className={styles.input}
                    required={!isEditing}
                  />
                </label>

                <div className={styles.row}>
                  <label className={styles.label} style={{ flex: 1 }}>
                    Region
                    <input
                      type="text"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="us-east-1"
                      className={styles.input}
                    />
                  </label>

                  <label className={styles.label} style={{ flex: 1 }}>
                    Fetch Last (hours)
                    <input
                      type="number"
                      value={s3HoursAgo}
                      onChange={(e) => setS3HoursAgo(Number(e.target.value))}
                      className={styles.input}
                    />
                  </label>
                </div>

                <label className={styles.label}>
                  Endpoint URL (for MinIO/S3-compatible)
                  <input
                    type="text"
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    placeholder="https://minio.example.com"
                    className={styles.input}
                  />
                </label>
              </div>
            )}

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Schedule</h3>

              <label className={styles.label}>
                Schedule Type
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value as "interval" | "cron")}
                  className={styles.input}
                >
                  <option value="interval">Interval</option>
                  <option value="cron">Cron</option>
                </select>
              </label>

              {scheduleType === "interval" && (
                <label className={styles.label}>
                  Interval (minutes)
                  <input
                    type="number"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    min="5"
                    max="10080"
                    className={styles.input}
                    required
                  />
                  <span className={styles.hint}>Minimum: 5 minutes, Maximum: 7 days</span>
                </label>
              )}

              {scheduleType === "cron" && (
                <label className={styles.label}>
                  Cron Expression
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 */6 * * *"
                    className={styles.input}
                    required
                  />
                  <span className={styles.hint}>Example: "0 */6 * * *" runs every 6 hours</span>
                </label>
              )}
            </div>

            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={createLogSource.isPending || updateLogSource.isPending}
              >
                {isEditing ? "Update" : "Create"} Log Source
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
