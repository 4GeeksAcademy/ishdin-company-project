import type {
  InventoryProduct,
  Warehouse,
} from "@/lib/inventory";


export type TelemetryWarehouse =
  | "los_angeles"
  | "zaragoza";

export type TelemetryCountry =
  | "US"
  | "ES";

export const STOCK_THRESHOLD_QUANTITY = 10;

export function toTelemetryWarehouse(
  warehouse: Warehouse,
): TelemetryWarehouse {
  return warehouse === "LA"
    ? "los_angeles"
    : "zaragoza";
}


export function toTelemetryCountry(
  warehouse: Warehouse,
): TelemetryCountry {
  return warehouse === "LA"
    ? "US"
    : "ES";
}


/**
 * TrackFlow currently stores the B2B client as client_name rather
 * than a separate client table/id.
 *
 * Until the domain gains a canonical client ID, create a stable,
 * non-sensitive identifier from the business client name.
 *
 * Example:
 * "PureStep Footwear" -> "purestep-footwear"
 */
export function toClientId(
  clientName: string,
): string {
  return clientName
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function crossedStockThreshold(
  previousStock: number,
  currentStock: number,
  threshold = STOCK_THRESHOLD_QUANTITY,
): boolean {
  return (
    previousStock >= threshold &&
    currentStock < threshold
  );
}

export function inventoryEventProperties(
  product: InventoryProduct,
  quantity: number,
) {
  return {
    warehouse:
      toTelemetryWarehouse(product.warehouse),

    client_id:
      toClientId(product.client_name),

    // BRIEFING defines product_id as the SKU.
    product_id:
      product.sku,

    product_category:
      product.category,

    quantity,

    country:
      toTelemetryCountry(product.warehouse),
  };
}