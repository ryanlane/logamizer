import { useState } from "react";
import { apiFetch, setStoredToken } from "../api/client";
import styles from "./AuthPanel.module.css";

type Props = {
  onAuthed: () => void;
};

type AuthResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
};

export function AuthPanel({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEmailValid = email.trim().length > 3 && email.includes("@");
  const isPasswordValid = password.length >= 8;
  const isFormValid = isEmailValid && isPasswordValid;

  async function handleSubmit() {
    if (!isFormValid) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AuthResponse>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(data.access_token);
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>
            {mode === "login" ? "Sign in" : "Create account"}
          </div>
          <div className={styles.subtitle}>Authenticate to load site data.</div>
        </div>
        <div className={styles.toggle}>
          <button
            className={mode === "login" ? styles.active : styles.inactive}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "register" ? styles.active : styles.inactive}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        </div>
      </div>

      <div className={styles.form}>
        <label className={styles.label}>Email</label>
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className={styles.label}>Password</label>
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          className={styles.submit}
          onClick={handleSubmit}
          disabled={isLoading || !isFormValid}
        >
          {isLoading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
