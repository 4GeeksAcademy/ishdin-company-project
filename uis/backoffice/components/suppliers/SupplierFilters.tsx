"use client";

import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_COUNTRIES,
  type SupplierCategory,
  type SupplierCountry,
} from "@/types/supplier";

interface SupplierFiltersProps {
  country: SupplierCountry | "";
  category: SupplierCategory | "";
  onCountryChange: (country: SupplierCountry | "") => void;
  onCategoryChange: (category: SupplierCategory | "") => void;
  onClear: () => void;
}

const humanize = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function SupplierFilters({
  country,
  category,
  onCountryChange,
  onCategoryChange,
  onClear,
}: SupplierFiltersProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label
            htmlFor="supplier-country-filter"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Country
          </label>
          <select
            id="supplier-country-filter"
            value={country}
            onChange={(event) =>
              onCountryChange(event.target.value as SupplierCountry | "")
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="">All countries</option>
            {SUPPLIER_COUNTRIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="supplier-category-filter"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Product category
          </label>
          <select
            id="supplier-category-filter"
            value={category}
            onChange={(event) =>
              onCategoryChange(event.target.value as SupplierCategory | "")
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="">All categories</option>
            {SUPPLIER_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={!country && !category}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
