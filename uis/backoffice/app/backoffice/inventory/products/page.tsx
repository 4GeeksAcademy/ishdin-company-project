"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getProducts, InventoryApiError } from "@/lib/inventory";
import type { InventoryProduct } from "@/lib/inventory";

// TrackFlow UI threshold: 0 = out of stock, 1-10 = low stock, >10 = healthy.
const LOW_STOCK_THRESHOLD = 10;

function stockPresentation(stock: number) {
  if (stock <= 0) {
    return {
      label: "Out of stock",
      className: "bg-red-50 text-red-700 ring-red-200",
      dot: "bg-red-500",
    };
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      label: "Low stock",
      className: "bg-amber-50 text-amber-800 ring-amber-200",
      dot: "bg-amber-500",
    };
  }
  return {
    label: "Healthy",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  };
}

export default function InventoryProductsPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProducts(await getProducts());
    } catch (cause) {
      setError(
        cause instanceof InventoryApiError
          ? cause.message
          : "Unable to load inventory products. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.client_name, product.category, product.warehouse]
        .some((field) => field.toLowerCase().includes(value)),
    );
  }, [products, query]);

  return (
    <section className="space-y-5" aria-labelledby="products-heading">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="products-heading" className="text-2xl font-bold text-slate-950">Products and current stock</h2>
          <p className="mt-1 text-sm text-slate-600">
            Stock is computed from inbound minus outbound movements for each warehouse.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadProducts()}
          disabled={loading}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh stock"}
        </button>
      </div>

      <label className="block max-w-md text-sm font-semibold text-slate-800" htmlFor="inventory-search">
        Search products
        <input
          id="inventory-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, SKU, client, category, warehouse"
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#3e7468] focus:ring-2 focus:ring-[#3e7468]/20"
        />
      </label>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void loadProducts()} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800">
            Try again
          </button>
        </div>
      )}

      {loading && products.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Loading inventory...</p>
      ) : !error && filteredProducts.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">No products match your search.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Warehouse</th>
                <th className="px-4 py-3 font-semibold">Current stock</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const stock = stockPresentation(product.current_stock);
                return (
                  <tr key={product.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{product.name}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{product.sku}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{product.client_name}</td>
                    <td className="px-4 py-4 capitalize text-slate-700">{product.category}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{product.warehouse}</td>
                    <td className="px-4 py-4">
                      <p className="text-lg font-bold tabular-nums text-slate-950">{product.current_stock}</p>
                      <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${stock.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stock.dot}`} aria-hidden="true" />
                        {stock.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-44 flex-col gap-2">
                        <Link
                          href={`/backoffice/inventory/orders/inbound?sku_id=${product.id}`}
                          className="rounded-lg bg-[#3e7468] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#315d54]"
                        >
                          Register inbound
                        </Link>
                        <Link
                          href={`/backoffice/inventory/orders/outbound?sku_id=${product.id}`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Register outbound
                        </Link>
                      </div>
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
