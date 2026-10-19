"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getOrders, InventoryApiError } from "@/lib/inventory";
import type { InventoryOrder, OrderType } from "@/lib/inventory";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function InventoryOrdersPage() {
  const [orders, setOrders] = useState<InventoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | OrderType>("all");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrders(await getOrders());
    } catch (cause) {
      setError(
        cause instanceof InventoryApiError
          ? cause.message
          : "Unable to load inventory order history. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const visibleOrders = useMemo(
    () => (typeFilter === "all" ? orders : orders.filter((order) => order.order_type === typeFilter)),
    [orders, typeFilter],
  );

  return (
    <section className="space-y-5" aria-labelledby="orders-heading">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="orders-heading" className="text-2xl font-bold text-slate-950">Inventory order history</h2>
          <p className="mt-1 text-sm text-slate-600">Read-only audit trail of goods receipts, dispatches, and confirmed losses.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={loading}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh history"}
        </button>
      </div>

      <label className="block max-w-xs text-sm font-semibold text-slate-800" htmlFor="order-type-filter">
        Movement type
        <select
          id="order-type-filter"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as "all" | OrderType)}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">All movements</option>
          <option value="inbound">Inbound only</option>
          <option value="outbound">Outbound only</option>
        </select>
      </label>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void loadOrders()} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800">Try again</button>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Loading order history...</p>
      ) : !error && visibleOrders.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">No inventory movements found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Movement</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Warehouse</th>
                <th className="px-4 py-3 font-semibold">Quantity</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 font-semibold">Created by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleOrders.map((order) => {
                const inbound = order.order_type === "inbound";
                return (
                  <tr key={`${order.order_type}-${order.id}`} className="align-top hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${inbound ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-blue-50 text-blue-700 ring-blue-200"}`}>
                        {inbound ? "Inbound" : "Outbound"}
                      </span>
                      {!inbound && order.exit_type && <p className="mt-1 text-xs capitalize text-slate-500">{order.exit_type}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{order.sku.name}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{order.sku.sku}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{order.warehouse}</td>
                    <td className="px-4 py-4 text-lg font-bold tabular-nums text-slate-950">{order.quantity}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {inbound ? (
                        <span>Reference: <strong className="font-medium text-slate-800">{order.reference ?? "—"}</strong></span>
                      ) : order.exit_type === "dispatch" ? (
                        <span>Tracking: <strong className="font-medium text-slate-800">{order.tracking_number ?? "—"}</strong></span>
                      ) : (
                        <span>Confirmed loss</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <code className="break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{order.user_uuid}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
