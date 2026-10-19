"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  createOutboundOrder,
  getProduct,
  getProducts,
  InventoryApiError,
} from "@/lib/inventory";
import type { ExitType, InventoryProduct } from "@/lib/inventory";

export default function OutboundOrderPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [quantity, setQuantity] = useState("");
  const [exitType, setExitType] = useState<ExitType>("dispatch");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const [success, setSuccess] = useState("");

  const enteredQuantity = Number(quantity);
  const exceedsStock =
    Boolean(selectedProduct) &&
    Number.isFinite(enteredQuantity) &&
    enteredQuantity > 0 &&
    enteredQuantity > (selectedProduct?.current_stock ?? 0);

  const selectProduct = async (nextId: string) => {
    setProductId(nextId);
    setSelectedProduct(null);
    setQuantityError("");
    setFormError("");
    setSuccess("");

    if (!nextId) return;

    setLoadingStock(true);
    try {
      // Explicitly fetch the selected SKU so current_stock is fresh at selection time.
      setSelectedProduct(await getProduct(Number(nextId)));
    } catch (cause) {
      setFormError(
        cause instanceof InventoryApiError
          ? cause.message
          : "Unable to load current stock for this product. Please select it again.",
      );
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      setFormError("");
      try {
        const rows = await getProducts();
        setProducts(rows);
        const requested = new URLSearchParams(window.location.search).get("sku_id");
        if (requested && rows.some((row) => row.id === Number(requested))) {
          await selectProduct(requested);
        }
      } catch (cause) {
        setFormError(
          cause instanceof InventoryApiError
            ? cause.message
            : "Unable to load products. Check your connection and try again.",
        );
      } finally {
        setLoadingProducts(false);
      }
    };
    void loadProducts();
    // selectProduct deliberately reads only stable state setters and API helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setQuantityError("");
    setSuccess("");

    const amount = Number(quantity);
    if (!selectedProduct) {
      setFormError("Select a product and wait for its current stock to load.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setQuantityError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (amount > selectedProduct.current_stock) {
      setQuantityError(`Only ${selectedProduct.current_stock} unit(s) are currently available in ${selectedProduct.warehouse}.`);
      return;
    }
    if (exitType === "dispatch" && !trackingNumber.trim()) {
      setFormError("A carrier tracking number is required for a dispatch.");
      return;
    }

    setSubmitting(true);
    try {
      await createOutboundOrder({
        sku_id: selectedProduct.id,
        quantity: amount,
        exit_type: exitType,
        tracking_number: exitType === "dispatch" ? trackingNumber.trim() : null,
        warehouse: selectedProduct.warehouse,
      });

      const productName = selectedProduct.name;
      const productIdToRefresh = selectedProduct.id;
      setQuantity("");
      setTrackingNumber("");
      setSuccess(`Outbound ${exitType} for ${productName} registered successfully.`);

      // Refresh stock after the write so the available quantity remains accurate.
      setLoadingStock(true);
      try {
        setSelectedProduct(await getProduct(productIdToRefresh));
      } finally {
        setLoadingStock(false);
      }
    } catch (cause) {
      if (cause instanceof InventoryApiError) {
        if (cause.status === 400 && cause.message.toLowerCase().includes("insufficient stock")) {
          setQuantityError(cause.message);
        } else {
          setFormError(cause.message);
        }
      } else {
        setFormError("Unable to register the outbound movement. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#3e7468] focus:ring-2 focus:ring-[#3e7468]/20 disabled:bg-slate-100";

  return (
    <section className="space-y-5" aria-labelledby="outbound-heading">
      <div>
        <h2 id="outbound-heading" className="text-2xl font-bold text-slate-950">Register outbound exit</h2>
        <p className="mt-1 text-sm text-slate-600">Record a customer dispatch or confirmed inventory loss.</p>
      </div>

      <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="outbound-product">
          Product
          <select
            id="outbound-product"
            value={productId}
            onChange={(event) => void selectProduct(event.target.value)}
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available stock</p>
          {loadingStock ? (
            <p className="mt-1 text-sm text-slate-600" role="status">Checking current stock...</p>
          ) : selectedProduct ? (
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">{selectedProduct.current_stock}</p>
                <p className="text-sm text-slate-600">units in {selectedProduct.warehouse}</p>
              </div>
              <p className="text-sm font-medium text-slate-700">{selectedProduct.name}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Select a product to see its current available stock.</p>
          )}
        </div>

        <label className="block text-sm font-semibold text-slate-800" htmlFor="outbound-quantity">
          Quantity leaving stock
          <input
            id="outbound-quantity"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setQuantityError("");
              setSuccess("");
            }}
            disabled={submitting || loadingStock}
            aria-invalid={Boolean(quantityError || exceedsStock)}
            aria-describedby="outbound-quantity-message"
            className={inputClass}
            placeholder="e.g. 5"
          />
          <span id="outbound-quantity-message" className={`mt-1 block text-xs font-medium ${quantityError || exceedsStock ? "text-red-700" : "text-slate-500"}`}>
            {quantityError || (exceedsStock
              ? `Warning: requested quantity exceeds the ${selectedProduct?.current_stock ?? 0} unit(s) currently available.`
              : "The API performs the final stock check before saving the exit.")}
          </span>
        </label>

        <label className="block text-sm font-semibold text-slate-800" htmlFor="outbound-type">
          Exit type
          <select
            id="outbound-type"
            value={exitType}
            onChange={(event) => {
              const value = event.target.value as ExitType;
              setExitType(value);
              if (value === "loss") setTrackingNumber("");
              setFormError("");
            }}
            disabled={submitting}
            className={inputClass}
          >
            <option value="dispatch">Dispatch — customer shipment</option>
            <option value="loss">Loss — confirmed discrepancy or damage</option>
          </select>
        </label>

        {exitType === "dispatch" && (
          <label className="block text-sm font-semibold text-slate-800" htmlFor="tracking-number">
            Carrier tracking number
            <input
              id="tracking-number"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              disabled={submitting}
              className={inputClass}
              placeholder="e.g. 1Z999AA10123456784"
              maxLength={150}
            />
          </label>
        )}

        {formError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{formError}</p>}
        {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{success}</p>}

        <button
          type="submit"
          disabled={submitting || loadingProducts || loadingStock || exceedsStock}
          className="min-h-11 rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Registering exit..." : "Register outbound exit"}
        </button>
      </form>
    </section>
  );
}
