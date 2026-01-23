import { ReactNode, useMemo } from "react";
import { clearAuth } from "../api/client";
import type { Site } from "../types";
import styles from "./DashboardLayout.module.css";

type Props = {
  children: ReactNode;
  onNavigate?: (path: string) => void;
  currentPath?: string;
  sites?: Site[];
  activeSiteId?: string | null;
  recentSiteIds?: string[];
};

export function DashboardLayout({
  children,
  onNavigate,
  currentPath = "/",
  sites = [],
  activeSiteId,
  recentSiteIds = [],
}: Props) {
  function handleLogout() {
    clearAuth();
    window.location.href = "/";
  }

  const activeSite = useMemo(
    () => sites.find((site) => site.id === activeSiteId) ?? null,
    [sites, activeSiteId]
  );

  const visibleSites = useMemo(() => {
    if (sites.length <= 5) return sites;
    const recent = recentSiteIds
      .map((id) => sites.find((site) => site.id === id))
      .filter((site): site is Site => Boolean(site));
    if (recent.length > 0) return recent.slice(0, 5);
    return sites.slice(0, 5);
  }, [sites, recentSiteIds]);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="var(--color-primary)" />
            <path d="M14 14V34H34" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <polyline
              points="16,28 22,22 26,26 32,18"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span>Logamizer</span>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <div className={styles.navSectionTitle}>Sites</div>
            <button
              className={currentPath === "/" ? styles.navItemActive : styles.navItem}
              onClick={() => onNavigate?.("/")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>All sites</span>
            </button>
            <div className={styles.siteList}>
              {visibleSites.map((site) => (
                <button
                  key={site.id}
                  className={
                    activeSiteId === site.id ? styles.siteItemActive : styles.siteItem
                  }
                  onClick={() => onNavigate?.(`/sites/${site.id}`)}
                >
                  <span>{site.name}</span>
                </button>
              ))}
            </div>
          </div>

          {activeSite && (
            <div className={styles.navSection}>
              <div className={styles.navSectionTitle}>Active site</div>
              <div className={styles.activeSiteName}>{activeSite.name}</div>
              <div className={styles.subNavList}>
                <button
                  className={
                    currentPath === `/sites/${activeSite.id}`
                      ? styles.subNavItemActive
                      : styles.subNavItem
                  }
                  onClick={() => onNavigate?.(`/sites/${activeSite.id}`)}
                >
                  Dashboard
                </button>
                <button
                  className={
                    currentPath === `/sites/${activeSite.id}/findings`
                      ? styles.subNavItemActive
                      : styles.subNavItem
                  }
                  onClick={() => onNavigate?.(`/sites/${activeSite.id}/findings`)}
                >
                  Security findings
                </button>
                <button
                  className={
                    currentPath === `/sites/${activeSite.id}/anomalies`
                      ? styles.subNavItemActive
                      : styles.subNavItem
                  }
                  onClick={() => onNavigate?.(`/sites/${activeSite.id}/anomalies`)}
                >
                  Anomaly highlights
                </button>
                <button
                  className={
                    currentPath === `/sites/${activeSite.id}/errors`
                      ? styles.subNavItemActive
                      : styles.subNavItem
                  }
                  onClick={() => onNavigate?.(`/sites/${activeSite.id}/errors`)}
                >
                  Error analysis
                </button>
                <button
                  className={
                    currentPath === `/sites/${activeSite.id}/log-sources`
                      ? styles.subNavItemActive
                      : styles.subNavItem
                  }
                  onClick={() => onNavigate?.(`/sites/${activeSite.id}/log-sources`)}
                >
                  Sources
                </button>
              </div>
            </div>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            className={currentPath === "/settings" ? styles.navItemActive : styles.navItem}
            onClick={() => onNavigate?.("/settings")}
          >
            <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">
              <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
            </svg>
            <span>Settings</span>
          </button>
          <button className={styles.logoutButton} onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
