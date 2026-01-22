import { useState } from "react";
import { apiFetch, setStoredToken, setStoredRefreshToken } from "../../api/client";
import { Button } from "../Button";
import { Card, CardHeader } from "../Card";
import { Input } from "../Input";
import styles from "./WelcomeStep.module.css";

type Props = {
  onComplete: () => void;
};

type AuthResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
};

export function WelcomeStep({ onComplete }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmailValid = email.trim().length > 3 && email.includes("@");
  const isPasswordValid = password.length >= 8;
  const isFormValid = isEmailValid && isPasswordValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      if (data.refresh_token) {
        setStoredRefreshToken(data.refresh_token);
      }
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.logo}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="var(--color-primary)" />
            <path
              d="M14 34V14H18V30H30V14H34V34H14Z"
              fill="white"
            />
          </svg>
        </div>
        <h1 className={styles.title}>Welcome to Logamizer</h1>
        <p className={styles.subtitle}>
          Upload your server logs, discover security signals, and get AI-powered insights
          in minutes.
        </p>
      </div>

      <Card className={styles.authCard}>
        <CardHeader
          title={mode === "login" ? "Sign in to continue" : "Create your account"}
          subtitle={
            mode === "login"
              ? "Enter your credentials to access your dashboard"
              : "Get started with a free account"
          }
        />

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && <div className={styles.error}>{error}</div>}

          <Button type="submit" size="lg" isLoading={isLoading} disabled={!isFormValid}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className={styles.switchMode}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button type="button" onClick={() => setMode("register")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </Card>

      <div className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className={styles.featureText}>
            <strong>Security Signals</strong>
            <span>Detect attacks, probes, and suspicious patterns</span>
          </div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className={styles.featureText}>
            <strong>Anomaly Detection</strong>
            <span>Spot traffic spikes and unusual behavior</span>
          </div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
            </svg>
          </div>
          <div className={styles.featureText}>
            <strong>AI Explanations</strong>
            <span>Get actionable insights from your findings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
