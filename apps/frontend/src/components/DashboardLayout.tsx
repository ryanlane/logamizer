import { ReactNode } from "react";
import { clearAuth } from "../api/client";
import styles from "./DashboardLayout.module.css";

type Props = {
  children: ReactNode;
  onNavigate?: (path: string) => void;
  currentPath?: string;
};

export function DashboardLayout({ children, onNavigate, currentPath = "/" }: Props) {
  function handleLogout() {
    clearAuth();
    window.location.href = "/";
  }

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
            <span>Sites</span>
          </button>

          <button
            className={currentPath === "/settings" ? styles.navItemActive : styles.navItem}
            onClick={() => onNavigate?.("/settings")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6m9.22-9.22l-4.24 4.24M6.34 6.34L2.1 2.1m19.8 19.8l-4.24-4.24M6.34 17.66L2.1 21.9M23 12h-6m-6 0H1" />
            </svg>
            <span>Settings</span>
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
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
