"use client";

import { FormEvent, useState } from "react";

import type {
  Supplier,
  SupplierStatus,
} from "@/types/supplier";

interface SupplierTableProps {
  suppliers: Supplier[];
  busySupplierId: number | null;
  onRateUpdate: (
    supplier: Supplier,
    newRate: number
  ) => Promise<boolean>;
  onStatusUpdate: (
    supplier: Supplier,
    newStatus: SupplierStatus
  ) => Promise<void>;
}

const humanize = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function RateEditor({
  supplier,
  disabled,
  onSave,
}: {
  supplier: Supplier;
  disabled: boolean;
  onSave: (newRate: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState(String(supplier.rate_per_shipment));

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const numberRate = Number(rate);
    const saved = await onSave(numberRate);

    if (saved) {
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900">
          {supplier.currency} {supplier.rate_per_shipment.toFixed(2)}
        </span>
        <button
          type="button"
          onClick={() => {
            setRate(String(supplier.rate_per_shipment));
            setEditing(true);
          }}
          disabled={disabled}
          className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-40"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-w-52 items-center gap-2">
      <div className="flex">
        <span className="rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
          {supplier.currency}
        </span>
        <input
          autoFocus
          required
          type="number"
          min="0.01"
          step="0.01"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
          className="w-24 rounded-r-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(false)}
        className="text-xs text-slate-500 hover:underline disabled:opacity-40"
      >
        Cancel
      </button>
    </form>
  );
}

export default function SupplierTable({
  suppliers,
  busySupplierId,
  onRateUpdate,
  onStatusUpdate,
}: SupplierTableProps) {
  if (suppliers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No suppliers match the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Categories</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {suppliers.map((supplier) => {
              const isBusy = busySupplierId === supplier.id;
              const nextStatus: SupplierStatus =
                supplier.status === "active"
                  ? "suspended"
                  : "active";

              return (
                <tr
                  key={supplier.id}
                  className={
                    supplier.status === "suspended"
                      ? "bg-amber-50/60"
                      : "bg-white"
                  }
                >
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-slate-900">
                      {supplier.name}
                    </div>
                    {supplier.service_zone && (
                      <div className="mt-1 text-xs text-slate-500">
                        {supplier.service_zone}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4 align-top text-sm text-slate-700">
                    {supplier.country}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex max-w-sm flex-wrap gap-1.5">
                      {supplier.categories.map((category) => (
                        <span
                          key={category}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          {humanize(category)}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <RateEditor
                      supplier={supplier}
                      disabled={isBusy}
                      onSave={(newRate) =>
                        onRateUpdate(supplier, newRate)
                      }
                    />
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span
                      className={
                        supplier.status === "active"
                          ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                      }
                    >
                      {supplier.status === "active"
                        ? "Active"
                        : "Suspended"}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top text-xs text-slate-500">
                    {formatDate(supplier.updated_at)}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        onStatusUpdate(supplier, nextStatus)
                      }
                      className={
                        supplier.status === "active"
                          ? "rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-40"
                          : "rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40"
                      }
                    >
                      {isBusy
                        ? "Saving..."
                        : supplier.status === "active"
                        ? "Suspend"
                        : "Reactivate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
