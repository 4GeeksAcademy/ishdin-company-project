import { API_BASE_URL, authenticatedFetch } from "@/lib/auth";
import type { LoginTokenResponse } from "@/lib/auth";

export interface RegistrationInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  address?: string;
}

export interface AccountProfile {
  id: number;
  user_id: number;
  name: string | null;
  phone: string | null;
  address: string | null;
}

export interface CurrentAccount {
  id: number;
  email: string;
  role: "admin" | "manager" | "user";
  profile: AccountProfile;
}

export type ProfileUpdate = Pick<AccountProfile, "name" | "phone" | "address">;

export class AccountApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<keyof RegistrationInput, string>>;

  constructor(
    message: string,
    status: number,
    fieldErrors: Partial<Record<keyof RegistrationInput, string>> = {},
  ) {
    super(message);
    this.name = "AccountApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function responseError(response: Response): Promise<AccountApiError> {
  let body: { detail?: unknown } = {};
  try {
    body = await response.json();
  } catch {}

  const fieldErrors: Partial<Record<keyof RegistrationInput, string>> = {};
  const fieldNames = new Set(["email", "password", "name", "phone", "address"]);
  let message = `Request failed with HTTP ${response.status}.`;
  if (Array.isArray(body.detail)) {
    for (const issue of body.detail) {
      if (!issue || typeof issue !== "object") continue;
      const item = issue as { loc?: (string | number)[]; msg?: string };
      const field = item.loc?.at(-1);
      if (typeof field === "string" && fieldNames.has(field)) {
        fieldErrors[field as keyof RegistrationInput] = item.msg ?? "Invalid value.";
      }
    }
    message = Object.values(fieldErrors).join(" ") || message;
  } else if (typeof body.detail === "string") {
    message = body.detail;
    if (response.status === 409) fieldErrors.email = message;
  }
  return new AccountApiError(message, response.status, fieldErrors);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export async function loginUser(email: string, password: string): Promise<LoginTokenResponse> {
  const form = new URLSearchParams({ username: email, password });
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    redirect: "error",
  });
  return parseResponse<LoginTokenResponse>(response);
}

export async function registerUser(input: RegistrationInput): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    redirect: "error",
  });
  await parseResponse(response);
}

export async function getCurrentAccount(): Promise<CurrentAccount> {
  return parseResponse<CurrentAccount>(await authenticatedFetch("/auth/me"));
}

export async function updateMyProfile(input: ProfileUpdate): Promise<AccountProfile> {
  return parseResponse<AccountProfile>(await authenticatedFetch("/profiles/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}