"use client";

import { useEffect, useState } from "react";

import { getProducts, InventoryApiError } from "@/lib/inventory";
import type { InventoryProduct } from "@/lib/inventory";

export function useInventoryProducts() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setLoadingProducts(true);
      setProductsError("");

      try {
        const rows = await getProducts();

        if (!active) return;

        setProducts(rows);

        const requested = new URLSearchParams(window.location.search).get(
          "sku_id",
        );

        if (
          requested &&
          rows.some((product) => product.id === Number(requested))
        ) {
          setProductId(requested);
        }
      } catch (cause) {
        if (!active) return;

        setProductsError(
          cause instanceof InventoryApiError
            ? cause.message
            : "Unable to load products. Check your connection and try again.",
        );
      } finally {
        if (active) {
          setLoadingProducts(false);
        }
      }
    };

    void loadProducts();

    return () => {
      active = false;
    };
  }, []);

  return {
    products,
    productId,
    setProductId,
    loadingProducts,
    productsError,
  };
}