import { authenticatedFetch } from "@/lib/auth";
import type {
  Supplier,
  SupplierCreateInput,
  SupplierFilters,
  SupplierStatus,
} from "@/types/supplier";

class SupplierApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupplierApiError";
    this.status = status;
  }
}

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();

    if (typeof body?.detail === "string") {
      return body.detail;
    }

    if (Array.isArray(body?.detail)) {
      return body.detail
        .map((item: { loc?: (string | number)[]; msg?: string }) => {
          const field = item.loc?.at(-1);
          return `${field ? `${field}: ` : ""}${item.msg ?? "Invalid value"}`;
        })
        .join(" | ");
    }
  } catch {
    // Fall through to the generic message below.
  }

  return `Request failed with HTTP ${response.status}.`;
};

const request = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await authenticatedFetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new SupplierApiError(
      await getErrorMessage(response),
      response.status
    );
  }

  return response.json() as Promise<T>;
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

export { SupplierApiError };
