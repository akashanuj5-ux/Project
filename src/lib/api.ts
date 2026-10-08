const API_BASE = import.meta.env["VITE_API_URL"] || "http://localhost:5000";
export const TOKEN_KEY = "rd_auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions extends RequestInit {
  /**
   * Skip global 401 token cleanup. Used by login/signup so a bad-credentials
   * 401 surfaces the server's message ("Invalid email or password") instead
   * of the generic session-expired error.
   */
  skipSessionCleanup?: boolean;
}

async function request(
  path: string,
  options: ApiOptions = {},
): Promise<{ res: Response; body: unknown }> {
  const { skipSessionCleanup, headers: initHeaders, ...rest } = options;
  const token = getToken();

  const headers = new Headers(initHeaders);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });

  if (res.status === 401 && token && !skipSessionCleanup) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { res, body };
}

function assertOk(res: Response, body: unknown): void {
  if (res.ok) return;
  const message =
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error
      : `Request failed (${res.status})`;
  throw new Error(message);
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { res, body } = await request(path, options);
  if (res.status === 204) return undefined as T;
  assertOk(res, body);
  return body as T;
}

/**
 * Same request/auth/error semantics as apiFetch, but also returns the
 * response headers (used by master-data paging to read X-Total-Count).
 */
export async function apiFetchWithHeaders<T>(
  path: string,
  options: ApiOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const { res, body } = await request(path, options);
  assertOk(res, body);
  return { data: body as T, headers: res.headers };
}

/** Absolute URL for an API path — for elements that cannot send headers. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * Authenticated binary request. Used by attachment preview/download, which
 * need the ORIGINAL bytes plus the server-provided MIME type and filename.
 * Same token/401 semantics as apiFetch, but never forces a JSON content type.
 */
export async function apiFetchBlob(
  path: string,
  options: RequestInit = {},
): Promise<{ blob: Blob; headers: Headers }> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body: unknown = await res.json();
      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
      ) {
        message = (body as { error: string }).error;
      }
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new Error(message);
  }
  return { blob: await res.blob(), headers: res.headers };
}

