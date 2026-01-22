import { useState } from "react";
import { useCreateSite, useSites } from "../../api/hooks";
import type { Site } from "../../types";
import { Button } from "../Button";
import { Card, CardHeader } from "../Card";
import { Input, Select } from "../Input";
import styles from "./SiteSetupStep.module.css";

type Props = {
  onComplete: (site: Site) => void;
  onBack: () => void;
};

const LOG_FORMAT_OPTIONS = [
  { value: "nginx_combined", label: "Nginx Combined" },
  { value: "apache_combined", label: "Apache Combined" },
];

export function SiteSetupStep({ onComplete, onBack }: Props) {
  const sitesQuery = useSites();
  const createSite = useCreateSite();

  const [mode, setMode] = useState<"select" | "create">(
    sitesQuery.data?.sites.length ? "select" : "create"
  );
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [logFormat, setLogFormat] = useState("nginx_combined");
  const [error, setError] = useState<string | null>(null);

  const sites = sitesQuery.data?.sites ?? [];
  const hasSites = sites.length > 0;

  async function handleCreateSite(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a site name");
      return;
    }
    setError(null);

    try {
      const site = await createSite.mutateAsync({
        name: name.trim(),
        domain: domain.trim() || undefined,
        log_format: logFormat,
      });
      onComplete(site);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleSelectSite() {
    const site = sites.find((s) => s.id === selectedSiteId);
    if (site) {
      onComplete(site);
    }
  }

  return (
    <div className={styles.container}>
      <Card>
        <CardHeader
          title="Set up your site"
          subtitle="Create a new site or select an existing one to analyze"
        />

        {hasSites && (
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={mode === "select" ? styles.active : ""}
              onClick={() => setMode("select")}
            >
              Select existing
            </button>
            <button
              type="button"
              className={mode === "create" ? styles.active : ""}
              onClick={() => setMode("create")}
            >
              Create new
            </button>
          </div>
        )}

        {mode === "select" && hasSites && (
          <div className={styles.siteList}>
            {sites.map((site) => (
              <button
                key={site.id}
                type="button"
                className={`${styles.siteItem} ${selectedSiteId === site.id ? styles.selected : ""}`}
                onClick={() => setSelectedSiteId(site.id)}
              >
                <div className={styles.siteIcon}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M2 10h16M10 2a12 12 0 010 16M10 2a12 12 0 000 16" />
                  </svg>
                </div>
                <div className={styles.siteInfo}>
                  <div className={styles.siteName}>{site.name}</div>
                  <div className={styles.siteDomain}>{site.domain || "No domain"}</div>
                </div>
                <div className={styles.siteFormat}>{site.log_format.replace("_", " ")}</div>
              </button>
            ))}

            <div className={styles.actions}>
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
              <Button onClick={handleSelectSite} disabled={!selectedSiteId}>
                Continue with selected site
              </Button>
            </div>
          </div>
        )}

        {(mode === "create" || !hasSites) && (
          <form onSubmit={handleCreateSite} className={styles.form}>
            <Input
              label="Site name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Website"
              hint="A friendly name for your site"
            />
            <Input
              label="Domain (optional)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              hint="The domain this site serves"
            />
            <Select
              label="Log format"
              value={logFormat}
              onChange={(e) => setLogFormat(e.target.value)}
              options={LOG_FORMAT_OPTIONS}
              hint="The format of your server access logs"
            />

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <Button variant="secondary" type="button" onClick={onBack}>
                Back
              </Button>
              <Button type="submit" isLoading={createSite.isPending}>
                Create site and continue
              </Button>
            </div>
          </form>
        )}
      </Card>

      <div className={styles.helpText}>
        <strong>Which log format should I choose?</strong>
        <p>
          <strong>Nginx Combined</strong> is the default access log format for Nginx servers.
          Look for logs like:
        </p>
        <code>192.168.1.1 - - [01/Jan/2024:00:00:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "Mozilla/5.0..."</code>
        <p>
          <strong>Apache Combined</strong> is similar but used by Apache HTTP Server.
        </p>
      </div>
    </div>
  );
}
