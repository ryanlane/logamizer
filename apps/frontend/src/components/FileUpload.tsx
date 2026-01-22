import { useCallback, useState } from "react";
import styles from "./FileUpload.module.css";

type Props = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
};

export function FileUpload({
  file,
  onFileSelect,
  accept = ".log,.txt,.gz",
  maxSize = 100 * 1024 * 1024, // 100MB default
  disabled = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (maxSize && file.size > maxSize) {
        return `File is too large. Maximum size is ${formatBytes(maxSize)}.`;
      }
      return null;
    },
    [maxSize]
  );

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      onFileSelect(file);
    },
    [validateFile, onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      e.target.value = "";
    },
    [handleFile]
  );

  const handleRemoveFile = useCallback(() => {
    onFileSelect(null);
    setError(null);
  }, [onFileSelect]);

  return (
    <div className={styles.wrapper}>
      {file ? (
        <div className={styles.fileSelected}>
          <div className={styles.fileInfo}>
            <div className={styles.fileIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="15" x2="15" y2="15" />
                <line x1="12" y1="12" x2="12" y2="18" />
              </svg>
            </div>
            <div className={styles.fileDetails}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileSize}>{formatBytes(file.size)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            className={styles.removeButton}
            disabled={disabled}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <label
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ""} ${disabled ? styles.disabled : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled}
            className={styles.input}
          />
          <div className={styles.icon}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 32V16M24 16L18 22M24 16L30 22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 32V36C8 38.2091 9.79086 40 12 40H36C38.2091 40 40 38.2091 40 36V32"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className={styles.text}>
            <span className={styles.primary}>Click to upload</span> or drag and drop
          </div>
          <div className={styles.hint}>
            Log files (.log, .txt, .gz) up to {formatBytes(maxSize)}
          </div>
        </label>
      )}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
