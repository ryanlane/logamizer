import { useCallback, useEffect, useState } from "react";

export type UserSettings = {
  hiddenIps: string[];
};

const STORAGE_KEY = "logamizer-settings";

const DEFAULT_SETTINGS: UserSettings = {
  hiddenIps: [],
};

function normalizeIps(ips: string[]): string[] {
  const cleaned = ips
    .map((ip) => ip.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

export function loadUserSettings(): UserSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      hiddenIps: normalizeIps(parsed.hiddenIps ?? []),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  const payload: UserSettings = {
    hiddenIps: normalizeIps(settings.hiddenIps),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        setSettings(loadUserSettings());
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateSettings = useCallback((next: UserSettings) => {
    setSettings(next);
    saveUserSettings(next);
  }, []);

  return { settings, updateSettings };
}
