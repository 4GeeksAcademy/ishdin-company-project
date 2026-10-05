export interface LoginTokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

const SESSION_KEY = "trackflow.auth.session";
let redirectingToLogin = false;

export class AuthSessionError extends Error {
  readonly status = 401;

  constructor() {
    super("Your session has expired or is missing. Please sign in.");
    this.name = "AuthSessionError";
  }
}

export function setAuthSession(token: LoginTokenResponse): void {
  if (typeof window === "undefined") {
    throw new Error("Authentication sessions can only be stored in the browser.");
  }
  const expiresAt = Date.now() + token.expires_in_minutes * 60_000;
  if (
    typeof token.access_token !== "string" || !/^\S+$/.test(token.access_token) ||
    token.token_type?.toLowerCase() !== "bearer" ||
    !Number.isFinite(token.expires_in_minutes) || token.expires_in_minutes <= 0 ||
    !Number.isFinite(expiresAt)
  ) {
    throw new Error("Invalid login token response.");
  }
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    accessToken: token.access_token,
    expiresAt,
  }));
  redirectingToLogin = false;
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored);
    if (
      typeof session?.accessToken === "string" && /^\S+$/.test(session.accessToken) &&
      Number.isFinite(session.expiresAt) && session.expiresAt > Date.now()
    ) {
      return session.accessToken;
    }
  } catch {}
  clearAuthSession();
  return null;
}

function redirectToLogin(): void {
  if (typeof window === "undefined" || redirectingToLogin || window.location.pathname === "/login") return;
  redirectingToLogin = true;
  const next = window.location.pathname + window.location.search;
  window.location.replace(`/login?${new URLSearchParams({ next })}`);
}

export async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined") throw new AuthSessionError();
  const apiBase = new URL(API_BASE_URL || window.location.origin, window.location.origin);
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (url.origin !== apiBase.origin || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("Authenticated requests must target the configured API origin.");
  }
  const token = getAccessToken();
  if (!token) {
    redirectToLogin();
    throw new AuthSessionError();
  }
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url.href, { ...init, headers, redirect: "error" });
  if (response.status === 401) {
    clearAuthSession();
    redirectToLogin();
  }
  return response;
}