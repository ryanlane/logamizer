import { useState } from "react";
import styles from "./TokensPanel.module.css";

export function TokensPanel() {
  const [token, setToken] = useState(localStorage.getItem("logamizer_token") ?? "");

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="token-input">
        API Token
      </label>
      <input
        id="token-input"
        className={styles.input}
        placeholder="Paste bearer token"
        value={token}
        onChange={(event) => {
          const value = event.target.value;
          setToken(value);
          if (value) {
            localStorage.setItem("logamizer_token", value);
          } else {
            localStorage.removeItem("logamizer_token");
          }
        }}
      />
      <div className={styles.helper}>Stored locally for API requests.</div>
    </div>
  );
}
