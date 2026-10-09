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
      throw new IncidentApiError(error.message, error.status);
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
      // The UI intentionally does not surface raw backend text.
    }

    const message =
      body.message ??
      body.detail ??
      (response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 404
          ? "Incident not found."
          : "The request could not be completed. Please try again.");

    throw new IncidentApiError(
      message,
      response.status,
      body.fields ?? {},
    );
  }

  return (await response.json()) as T;
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
