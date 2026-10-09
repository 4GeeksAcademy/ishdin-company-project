import type {
  IncidentBranch,
  IncidentCategory,
  IncidentOrigin,
  IncidentStatus,
} from "@/types/incident";

export const STATUS_OPTIONS: Array<{
  value: IncidentStatus;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "discarded", label: "Discarded" },
];

export const ORIGIN_OPTIONS: Array<{
  value: IncidentOrigin;
  label: string;
}> = [
  { value: "customer", label: "Customer" },
  { value: "branch", label: "Branch" },
  { value: "internal", label: "Internal" },
];

export const BRANCH_OPTIONS: Array<{
  value: IncidentBranch;
  label: string;
}> = [
  { value: "central", label: "Central" },
  { value: "la_warehouse", label: "Los Angeles — Warehouse" },
  { value: "la_office", label: "Los Angeles — Office" },
  { value: "zaragoza_warehouse", label: "Zaragoza — Warehouse" },
  { value: "zaragoza_office", label: "Zaragoza — Office" },
];

export const CATEGORY_OPTIONS: Array<{
  value: IncidentCategory;
  label: string;
}> = [
  { value: "lost_parcel", label: "Lost parcel" },
  { value: "delivery_failure", label: "Delivery failure" },
  { value: "inventory_discrepancy", label: "Inventory discrepancy" },
  { value: "carrier_issue", label: "Carrier issue" },
  { value: "returns_issue", label: "Returns issue" },
  { value: "warehouse_incident", label: "Warehouse incident" },
  { value: "system_failure", label: "System failure" },
  { value: "client_complaint", label: "Client complaint" },
  { value: "other", label: "Other" },
];

export const NEXT_STATUS_OPTIONS: Record<
  IncidentStatus,
  IncidentStatus[]
> = {
  open: ["in_progress", "discarded"],
  in_progress: ["resolved", "discarded"],
  resolved: [],
  discarded: [],
};

export const statusLabel = (value: IncidentStatus) =>
  STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;

export const originLabel = (value: IncidentOrigin) =>
  ORIGIN_OPTIONS.find((item) => item.value === value)?.label ?? value;

export const branchLabel = (value: IncidentBranch) =>
  BRANCH_OPTIONS.find((item) => item.value === value)?.label ?? value;

export const categoryLabel = (value: IncidentCategory) =>
  CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value;
