import { authenticatedFetch } from "@/lib/auth";

export type Warehouse = "LA" | "ZGZ";
export type Category = "fashion" | "electronics" | "cosmetics";
export type ExitType = "dispatch" | "loss";
export type OrderType = "inbound" | "outbound";

export interface InventoryProduct {
  id: number;
  name: string;
  sku: string;
  client_name: string;
  category: Category;
  warehouse: Warehouse;
  current_stock: number;
}

export interface InboundOrderPayload {
  sku_id: number;
  quantity: number;
  reference: string;
  warehouse: Warehouse;
}

export interface InboundOrderResponse extends InboundOrderPayload {
  id: number;
  created_at: string;
  user_uuid: string;
}

export interface OutboundOrderPayload {
  sku_id: number;
  quantity: number;
  exit_type: ExitType;
  tracking_number: string | null;
  warehouse: Warehouse;
}

export interface OutboundOrderResponse extends OutboundOrderPayload {
  id: number;
  created_at: string;
  user_uuid: string;
}

export interface OrderProduct {
  id: number;
  name: string;
  sku: string;
  client_name: string;
  category: Category;
  warehouse: Warehouse;
}

export interface InventoryOrder {
  order_type: OrderType;
  id: number;
  sku_id: number;
  quantity: number;
  warehouse: Warehouse;
  created_at: string;
  user_uuid: string;
  sku: OrderProduct;
  reference: string | null;
  exit_type: ExitType | null;
  tracking_number: string | null;
}

export class InventoryApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InventoryApiError";
    this.status = status;
  }
}

function readableValidationDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (!Array.isArray(detail)) return null;

  const messages = detail
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "msg" in item) {
        const message = (item as { msg?: unknown }).msg;
        return typeof message === "string" ? message : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));

  return messages.length ? messages.join(" ") : null;
}

async function getErrorMessage(response: Response): Promise<string> {
  const fallback =
    response.status >= 500
      ? "The inventory service is temporarily unavailable. Please try again."
      : `The inventory request could not be completed (HTTP ${response.status}).`;

  let raw = "";
  try {
    raw = await response.text();
  } catch {
    return fallback;
  }

  if (!raw.trim()) return fallback;

  try {
    const body = JSON.parse(raw) as { detail?: unknown; message?: unknown };
    const detail = readableValidationDetail(body.detail);
    if (detail) return detail;
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  } catch {
    // Do not expose raw HTML, JSON fragments, stack traces, or proxy responses.
  }

  return fallback;
}

async function inventoryRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await authenticatedFetch(path, { ...init, headers });
  if (!response.ok) {
    throw new InventoryApiError(response.status, await getErrorMessage(response));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function getProducts(): Promise<InventoryProduct[]> {
  return inventoryRequest<InventoryProduct[]>("/inventory/products");
}

export function getProduct(productId: number): Promise<InventoryProduct> {
  return inventoryRequest<InventoryProduct>(`/inventory/products/${productId}`);
}

export function createInboundOrder(payload: InboundOrderPayload): Promise<InboundOrderResponse> {
  return inventoryRequest<InboundOrderResponse>("/inventory/orders/inbound", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createOutboundOrder(payload: OutboundOrderPayload): Promise<OutboundOrderResponse> {
  return inventoryRequest<OutboundOrderResponse>("/inventory/orders/outbound", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getOrders(): Promise<InventoryOrder[]> {
  return inventoryRequest<InventoryOrder[]>("/inventory/orders");
}
