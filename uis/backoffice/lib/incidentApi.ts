import type {
  ApiFieldError,
  Incident,
  IncidentCreateInput,
  IncidentFilters,
  IncidentStatus,
  IncidentSummary,
} from "@/types/incident";
import { AuthSessionError, authenticatedFetch } from "@/lib/auth";

export class IncidentApiError extends Error {
  status: number;
  fields: Record<string, string>;

  constructor(
    message: string,
    status: number,
    fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "IncidentApiError";
    this.status = status;
    this.fields = fields;
  }
}

const safeMessageForStatus = (status: number): string => {
  if (status === 400 || status === 422) {
    return "Review the incident details and try again.";
  }
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 403) {
    return "You do not have permission to perform this incident action.";
  }
  if (status === 404) {
    return "Incident not found. Refresh the list and try again.";
  }
  if (status >= 500) {
    return "The incident service is temporarily unavailable. Please try again.";
  }
  return "The request could not be completed. Please try again.";
};

const safeFields = (fields: Record<string, string> | undefined): Record<string, string> => {
  if (!fields) return {};

  return Object.fromEntries(
    Object.keys(fields).map((field) => [
      field,
      field === "status"
        ? "Choose a permitted status transition."
        : "Enter a valid value.",
    ]),
  );
};

const request = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await authenticatedFetch(path, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof AuthSessionError) {
      throw new IncidentApiError(
        "Your session has expired. Please sign in again.",
        error.status,
      );
    }

    throw new IncidentApiError(
      "We could not reach the incident service. Check your connection and try again.",
      0,
    );
  }

  if (!response.ok) {
    let body: ApiFieldError = {};

    try {
      body = (await response.json()) as ApiFieldError;
    } catch {
      // A malformed error body falls back to the status-based client message.
    }

    throw new IncidentApiError(
      safeMessageForStatus(response.status),
      response.status,
      safeFields(body.fields),
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new IncidentApiError(
      "The incident service returned an invalid response. Please try again.",
      response.status,
    );
  }
};

export const createIncident = (payload: IncidentCreateInput) =>
  request<Incident>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getIncidents = (filters: IncidentFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.status) params.set("status", filters.status);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.branch) params.set("branch", filters.branch);

  const query = params.toString();
  return request<Incident[]>(
    `/api/incidents${query ? `?${query}` : ""}`,
  );
};

export const updateIncidentStatus = (
  incidentId: string,
  status: IncidentStatus,
) =>
  request<Incident>(`/api/incidents/${incidentId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const getIncidentSummary = () =>
  request<IncidentSummary>("/api/incidents/summary");

