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

export interface ApiMessageResponse {
  detail: string;
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

const safeFieldMessage = (field: keyof RegistrationInput): string => {
  if (field === "email") return "Enter a valid email address.";
  if (field === "password") return "Review the password requirements.";
  return "Enter a valid value.";
};

const statusMessage = (status: number): string => {
  if (status === 400) return "The request could not be completed. Review your input and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested account resource could not be found.";
  if (status === 409) return "An account already exists for this email.";
  if (status === 422) return "Review the highlighted fields.";
  if (status >= 500) return "The service is temporarily unavailable. Please try again.";
  return "The request could not be completed. Please try again.";
};

async function responseError(response: Response): Promise<AccountApiError> {
  let body: { detail?: unknown } = {};
  try {
    body = await response.json();
  } catch {
    // Keep the generic status-based message when the error body is not JSON.
  }

  const fieldErrors: Partial<Record<keyof RegistrationInput, string>> = {};
  const fieldNames = new Set<keyof RegistrationInput>([
    "email",
    "password",
    "name",
    "phone",
    "address",
  ]);

  if (Array.isArray(body.detail)) {
    for (const issue of body.detail) {
      if (!issue || typeof issue !== "object") continue;
      const item = issue as { loc?: (string | number)[] };
      const field = item.loc && item.loc.length > 0 ? item.loc[item.loc.length - 1] : undefined;
      if (typeof field === "string" && fieldNames.has(field as keyof RegistrationInput)) {
        const typedField = field as keyof RegistrationInput;
        fieldErrors[typedField] = safeFieldMessage(typedField);
      }
    }
  }

  if (response.status === 409) {
    fieldErrors.email = "An account already exists for this email.";
  }

  return new AccountApiError(
    statusMessage(response.status),
    response.status,
    fieldErrors,
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseError(response);

  try {
    return (await response.json()) as T;
  } catch {
    throw new AccountApiError(
      "The server returned an invalid response. Please try again.",
      response.status,
    );
  }
}

async function publicFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new AccountApiError(
      "We could not reach the account service. Check your connection and try again.",
      0,
    );
  }
}

export async function loginUser(email: string, password: string): Promise<LoginTokenResponse> {
  const form = new URLSearchParams({ username: email, password });
  const response = await publicFetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    redirect: "error",
  });
  return parseResponse<LoginTokenResponse>(response);
}

export async function registerUser(input: RegistrationInput): Promise<void> {
  const response = await publicFetch(`${API_BASE_URL}/users`, {
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

export async function requestPasswordReset(email: string): Promise<ApiMessageResponse> {
  const response = await publicFetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    redirect: "error",
  });
  return parseResponse<ApiMessageResponse>(response);
}

export async function resetPassword(token: string, newPassword: string): Promise<ApiMessageResponse> {
  const response = await publicFetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
    redirect: "error",
  });
  return parseResponse<ApiMessageResponse>(response);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ApiMessageResponse> {
  const response = await authenticatedFetch("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  return parseResponse<ApiMessageResponse>(response);
}
