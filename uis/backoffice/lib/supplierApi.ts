import { AuthSessionError, authenticatedFetch } from "@/lib/auth";
import type {
  Supplier,
  SupplierCreateInput,
  SupplierFilters,
  SupplierStatus,
} from "@/types/supplier";

export class SupplierApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupplierApiError";
    this.status = status;
  }
}

const getErrorMessage = (status: number): string => {
  if (status === 400 || status === 422) {
    return "Supplier details are invalid. Review the form and try again.";
  }
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 403) {
    return "You do not have permission to update supplier data.";
  }
  if (status === 404) {
    return "The supplier could not be found. Refresh the directory and try again.";
  }
  if (status >= 500) {
    return "The supplier service is temporarily unavailable. Please try again.";
  }
  return "The supplier request could not be completed. Please try again.";
};

const request = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await authenticatedFetch(path, {
      ...init,
      headers,
    });
  } catch (error) {
    if (error instanceof AuthSessionError) {
      throw new SupplierApiError(
        "Your session has expired. Please sign in again.",
        error.status,
      );
    }

    throw new SupplierApiError(
      "We could not reach the supplier service. Check your connection and try again.",
      0,
    );
  }

  if (!response.ok) {
    throw new SupplierApiError(
      getErrorMessage(response.status),
      response.status
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new SupplierApiError(
      "The supplier service returned an invalid response. Please try again.",
      response.status,
    );
  }
};

export const listSuppliers = async (
  filters: SupplierFilters = {}
): Promise<Supplier[]> => {
  const params = new URLSearchParams();

  if (filters.country) {
    params.set("country", filters.country);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  const query = params.toString();
  return request<Supplier[]>(`/suppliers${query ? `?${query}` : ""}`);
};

export const createSupplier = async (
  input: SupplierCreateInput
): Promise<Supplier> =>
  request<Supplier>("/suppliers", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getSupplier = async (id: number): Promise<Supplier> =>
  request<Supplier>(`/suppliers/${id}`);

export const deleteSupplier = async (id: number): Promise<{ message: string; id: number }> =>
  request(`/suppliers/${id}`, { method: "DELETE" });

export const updateSupplierRate = async (
  id: number,
  ratePerShipment: number
): Promise<Supplier> =>
  request<Supplier>(`/suppliers/${id}/rate`, {
    method: "PATCH",
    body: JSON.stringify({
      rate_per_shipment: ratePerShipment,
    }),
  });

export const updateSupplierStatus = async (
  id: number,
  status: SupplierStatus
): Promise<Supplier> =>
  request<Supplier>(`/suppliers/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

