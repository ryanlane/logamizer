const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type ApiError = {
  detail: string | { msg: string }[];
};

export function getStoredToken(): string | null {
  return localStorage.getItem("logamizer_token");
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem("logamizer_refresh_token");
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem("logamizer_token", token);
  } else {
    localStorage.removeItem("logamizer_token");
  }
}

export function setStoredRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem("logamizer_refresh_token", token);
  } else {
    localStorage.removeItem("logamizer_refresh_token");
  }
}

export function clearAuth(): void {
  localStorage.removeItem("logamizer_token");
  localStorage.removeItem("logamizer_refresh_token");
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearAuth();
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };
    setStoredToken(data.access_token);
    setStoredRefreshToken(data.refresh_token);
    return data.access_token;
  } catch {
    clearAuth();
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 by attempting to refresh token
  if (response.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);
        // Retry request with new token
        const retryHeaders = new Headers(options.headers);
        retryHeaders.set("Content-Type", "application/json");
        retryHeaders.set("Authorization", `Bearer ${newToken}`);

        response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: retryHeaders,
        });
      } else {
        // Refresh failed, redirect to login
        window.location.href = "/";
        throw new Error("Session expired");
      }
    } else {
      // Wait for ongoing refresh to complete
      const newToken = await new Promise<string>((resolve) => {
        subscribeTokenRefresh(resolve);
      });

      // Retry request with new token
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set("Content-Type", "application/json");
      retryHeaders.set("Authorization", `Bearer ${newToken}`);

      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ detail: "Request failed" }))) as ApiError;
    if (Array.isArray(error.detail)) {
      const message = error.detail.map((item) => item.msg).join("; ");
      throw new Error(message || "Request failed");
    }
    throw new Error(error.detail || "Request failed");
  }

  return response.json() as Promise<T>;
}
