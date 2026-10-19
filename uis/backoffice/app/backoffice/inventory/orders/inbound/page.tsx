"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { createInboundOrder, getProducts, InventoryApiError } from "@/lib/inventory";
import type { InventoryProduct } from "@/lib/inventory";

export default function InboundOrderPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === Number(productId)) ?? null,
    [productId, products],
  );

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      setError("");
      try {
        const rows = await getProducts();
        setProducts(rows);
        const requested = new URLSearchParams(window.location.search).get("sku_id");
        if (requested && rows.some((row) => row.id === Number(requested))) setProductId(requested);
      } catch (cause) {
        setError(
          cause instanceof InventoryApiError
            ? cause.message
            : "Unable to load products. Check your connection and try again.",
        );
      } finally {
        setLoadingProducts(false);
      }
    };
    void loadProducts();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amount = Number(quantity);
    if (!selectedProduct) {
      setError("Select the product received at the warehouse.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (!reference.trim()) {
      setError("Enter the client dispatch or goods-receipt reference.");
      return;
    }

    setSubmitting(true);
    try {
      await createInboundOrder({
        sku_id: selectedProduct.id,
        quantity: amount,
        reference: reference.trim(),
        warehouse: selectedProduct.warehouse,
      });
      setProductId("");
      setQuantity("");
      setReference("");
      setSuccess("Inbound delivery registered successfully. Stock has been updated from the new movement.");
    } catch (cause) {
      setError(
        cause instanceof InventoryApiError
          ? cause.message
          : "Unable to register the inbound delivery. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#3e7468] focus:ring-2 focus:ring-[#3e7468]/20 disabled:bg-slate-100";

  return (
    <section className="space-y-5" aria-labelledby="inbound-heading">
      <div>
        <h2 id="inbound-heading" className="text-2xl font-bold text-slate-950">Register inbound delivery</h2>
        <p className="mt-1 text-sm text-slate-600">Record goods received from a client brand. This movement increases stock.</p>
      </div>

      <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="inbound-product">
          Product
          <select
            id="inbound-product"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setError("");
              setSuccess("");
            }}
            disabled={loadingProducts || submitting}
            className={inputClass}
          >
            <option value="">{loadingProducts ? "Loading products..." : "Select a product"}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — {product.sku} ({product.warehouse})
              </option>
            ))}
          </select>
        </label>

        {selectedProduct && (
          <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div><span className="block text-xs font-semibold uppercase text-slate-500">Warehouse</span><strong className="text-slate-900">{selectedProduct.warehouse}</strong></div>
            <div><span className="block text-xs font-semibold uppercase text-slate-500">SKU</span><strong className="font-mono text-slate-900">{selectedProduct.sku}</strong></div>
            <div><span className="block text-xs font-semibold uppercase text-slate-500">Current stock</span><strong className="text-slate-900">{selectedProduct.current_stock}</strong></div>
          </div>
        )}

        <label className="block text-sm font-semibold text-slate-800" htmlFor="inbound-quantity">
          Quantity received
          <input
            id="inbound-quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={submitting}
            className={inputClass}
            placeholder="e.g. 50"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800" htmlFor="inbound-reference">
          Delivery reference
          <input
            id="inbound-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            disabled={submitting}
            className={inputClass}
            placeholder="e.g. PO-2024-0098"
            maxLength={150}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Use the client dispatch, purchase order, or goods-receipt reference.</span>
        </label>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{success}</p>}

        <button
          type="submit"
          disabled={submitting || loadingProducts}
          className="min-h-11 rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Registering delivery..." : "Register inbound delivery"}
        </button>
      </form>
    </section>
  );
}
