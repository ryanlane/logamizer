const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type ApiError = {
  detail: string | { msg: string }[];
};

export function getStoredToken(): string | null {
  return localStorage.getItem("logamizer_token");
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem("logamizer_token", token);
  } else {
    localStorage.removeItem("logamizer_token");
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

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
