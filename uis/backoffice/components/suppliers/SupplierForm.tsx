"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  SUPPLIER_CATEGORIES,
  type SupplierCategory,
  type SupplierCountry,
  type SupplierCreateInput,
  type SupplierStatus,
} from "@/types/supplier";

interface SupplierFormProps {
  submitting: boolean;
  error: string | null;
  onSubmit: (input: SupplierCreateInput) => Promise<boolean>;
}

const humanize = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const emptyForm = {
  name: "",
  country: "USA" as SupplierCountry,
  categories: [] as SupplierCategory[],
  rate_per_shipment: "",
  status: "active" as SupplierStatus,
  service_zone: "",
  contact_email: "",
  notes: "",
};

export default function SupplierForm({
  submitting,
  error,
  onSubmit,
}: SupplierFormProps) {
  const [form, setForm] = useState(emptyForm);

  const currency = useMemo(
    () => (form.country === "USA" ? "USD" : "EUR"),
    [form.country]
  );

  const toggleCategory = (category: SupplierCategory) => {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const rate = Number(form.rate_per_shipment);

    const input: SupplierCreateInput = {
      name: form.name,
      country: form.country,
      categories: form.categories,
      rate_per_shipment: rate,
      currency,
      status: form.status,
      service_zone: form.service_zone || null,
      contact_email: form.contact_email || null,
      notes: form.notes || null,
    };

    const created = await onSubmit(input);

    if (created) {
      setForm(emptyForm);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Register supplier
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          New suppliers are validated by the API before they are written to
          TinyDB.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Supplier name
            </label>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="Example Supplier"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Country
            </label>
            <select
              value={form.country}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  country: event.target.value as SupplierCountry,
                }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="USA">USA</option>
              <option value="Spain">Spain</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Rate per shipment
            </label>
            <div className="flex">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.rate_per_shipment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rate_per_shipment: event.target.value,
                  }))
                }
                className="min-w-0 flex-1 rounded-l-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="0.00"
              />
              <span className="rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {currency}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as SupplierStatus,
                }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Service zone
            </label>
            <input
              value={form.service_zone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  service_zone: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Contact email
            </label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contact_email: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="Optional"
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">
            Product categories
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SUPPLIER_CATEGORIES.map((category) => (
              <label
                key={category}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={form.categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                  className="mt-0.5"
                />
                <span>{humanize(category)}</span>
              </label>
            ))}
          </div>
          {form.categories.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Select at least one category.
            </p>
          )}
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Notes
          </label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="Optional"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || form.categories.length === 0}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Registering..." : "Register supplier"}
        </button>
      </form>
    </section>
  );
}
