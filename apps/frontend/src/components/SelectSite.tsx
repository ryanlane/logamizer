import type { Site } from "../types";
import styles from "./SelectSite.module.css";

type Props = {
  sites: Site[];
  value?: string;
  isLoading?: boolean;
  onChange: (value: string | undefined) => void;
};

export function SelectSite({ sites, value, isLoading, onChange }: Props) {
  if (isLoading) {
    return <div className={styles.loading}>Loading sites…</div>;
  }

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="site-select">
        Site
      </label>
      <select
        id="site-select"
        className={styles.select}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">Select a site</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}
