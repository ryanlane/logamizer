import { useSites } from "../api/hooks";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import type { Site } from "../types";
import styles from "./SiteListPage.module.css";

type Props = {
  onSelectSite: (site: Site) => void;
  onCreateNew: () => void;
};

export function SiteListPage({ onSelectSite, onCreateNew }: Props) {
  const { data, isLoading, error } = useSites();
  const sites = data?.sites ?? [];

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading sites...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load sites: {error.message}</div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h2>No sites yet</h2>
          <p>Create your first site to start analyzing logs</p>
          <Button onClick={onCreateNew} size="lg">
            Create your first site
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Sites</h1>
          <p className={styles.subtitle}>Manage and analyze logs for your sites</p>
        </div>
        <Button onClick={onCreateNew}>Add new site</Button>
      </div>

      <div className={styles.grid}>
        {sites.map((site) => (
          <Card key={site.id} className={styles.siteCard}>
            <div className={styles.siteHeader}>
              <div className={styles.siteIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                </svg>
              </div>
              <div className={styles.siteInfo}>
                <h3 className={styles.siteName}>{site.name}</h3>
                {site.domain && <p className={styles.siteDomain}>{site.domain}</p>}
              </div>
            </div>

            <div className={styles.siteDetails}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Format</span>
                <span className={styles.detailValue}>{site.log_format}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Created</span>
                <span className={styles.detailValue}>
                  {new Date(site.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className={styles.siteActions}>
              <Button onClick={() => onSelectSite(site)} variant="primary" fullWidth>
                View dashboard
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
