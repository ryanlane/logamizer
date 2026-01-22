import { useState } from "react";
import styles from "./DateRangePicker.module.css";

type Props = {
  startDate: string | null;
  endDate: string | null;
  onDateRangeChange: (startDate: string | null, endDate: string | null) => void;
};

type Preset = {
  label: string;
  getValue: () => { start: string; end: string };
};

const PRESETS: Preset[] = [
  {
    label: "Last 24 hours",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return {
        start: start.toISOString().slice(0, 16),
        end: end.toISOString().slice(0, 16),
      };
    },
  },
  {
    label: "Last 7 days",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        start: start.toISOString().slice(0, 16),
        end: end.toISOString().slice(0, 16),
      };
    },
  },
  {
    label: "Last 30 days",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return {
        start: start.toISOString().slice(0, 16),
        end: end.toISOString().slice(0, 16),
      };
    },
  },
  {
    label: "All time",
    getValue: () => ({ start: "", end: "" }),
  },
];

export function DateRangePicker({ startDate, endDate, onDateRangeChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStart, setLocalStart] = useState(startDate || "");
  const [localEnd, setLocalEnd] = useState(endDate || "");

  function handleApply() {
    onDateRangeChange(localStart || null, localEnd || null);
    setIsOpen(false);
  }

  function handleClear() {
    setLocalStart("");
    setLocalEnd("");
    onDateRangeChange(null, null);
    setIsOpen(false);
  }

  function handlePreset(preset: Preset) {
    const { start, end } = preset.getValue();
    setLocalStart(start);
    setLocalEnd(end);
    onDateRangeChange(start || null, end || null);
    setIsOpen(false);
  }

  const hasFilter = startDate || endDate;
  const displayText = hasFilter
    ? `${startDate ? new Date(startDate).toLocaleDateString() : "Start"} - ${endDate ? new Date(endDate).toLocaleDateString() : "End"}`
    : "All time";

  return (
    <div className={styles.wrapper}>
      <button className={styles.trigger} onClick={() => setIsOpen(!isOpen)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{displayText}</span>
        {hasFilter && (
          <span
            className={styles.clearButton}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                handleClear();
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.presets}>
              <div className={styles.presetsLabel}>Quick select</div>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className={styles.presetButton}
                  onClick={() => handlePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            <div className={styles.customRange}>
              <div className={styles.inputGroup}>
                <label htmlFor="start-date">Start date</label>
                <input
                  id="start-date"
                  type="datetime-local"
                  value={localStart}
                  onChange={(e) => setLocalStart(e.target.value)}
                  className={styles.dateInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="end-date">End date</label>
                <input
                  id="end-date"
                  type="datetime-local"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(e.target.value)}
                  className={styles.dateInput}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.cancelButton} onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button className={styles.applyButton} onClick={handleApply}>
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
