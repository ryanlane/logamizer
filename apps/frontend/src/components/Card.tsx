import type { ReactNode } from "react";
import styles from "./Card.module.css";

type Props = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
};

export function Card({ children, className = "", padding = "lg" }: Props) {
  return (
    <div className={`${styles.card} ${styles[`padding-${padding}`]} ${className}`}>
      {children}
    </div>
  );
}

type HeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function CardHeader({ title, subtitle, action }: HeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
