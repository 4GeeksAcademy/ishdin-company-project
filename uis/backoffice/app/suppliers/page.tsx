"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import SupplierFilters from "@/components/suppliers/SupplierFilters";
import SupplierForm from "@/components/suppliers/SupplierForm";
import SupplierTable from "@/components/suppliers/SupplierTable";
import {
  createSupplier,
  listSuppliers,
  updateSupplierRate,
  updateSupplierStatus,
} from "@/lib/supplierApi";
import type {
  Supplier,
  SupplierCategory,
  SupplierCountry,
  SupplierCreateInput,
  SupplierStatus,
} from "@/types/supplier";

export default function SupplierDirectoryPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [country, setCountry] = useState<SupplierCountry | "">("");
  const [category, setCategory] = useState<SupplierCategory | "">("");

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busySupplierId, setBusySupplierId] = useState<number | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const data = await listSuppliers({ country, category });
      setSuppliers(data);
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "Unable to load suppliers."
      );
    } finally {
      setLoading(false);
    }
  }, [country, category]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const counts = useMemo(() => {
    const active = suppliers.filter(
      (supplier) => supplier.status === "active"
    ).length;

    const suspended = suppliers.length - active;

    return {
      total: suppliers.length,
      active,
      suspended,
    };
  }, [suppliers]);

  const handleCreate = async (
    input: SupplierCreateInput
  ): Promise<boolean> => {
    setCreating(true);
    setCreateError(null);

    try {
      await createSupplier(input);
      await loadSuppliers();
      return true;
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Unable to register supplier."
      );
      return false;
    } finally {
      setCreating(false);
    }
  };

  const replaceSupplier = (updated: Supplier) => {
    setSuppliers((current) =>
      current.map((supplier) =>
        supplier.id === updated.id ? updated : supplier
      )
    );
  };

  const handleRateUpdate = async (
    supplier: Supplier,
    newRate: number
  ): Promise<boolean> => {
    setActionError(null);

    if (!Number.isFinite(newRate) || newRate <= 0) {
      setActionError("Rate must be greater than zero.");
      return false;
    }

    setBusySupplierId(supplier.id);

    try {
      const updated = await updateSupplierRate(
        supplier.id,
        newRate
      );
      replaceSupplier(updated);
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update the supplier rate."
      );
      return false;
    } finally {
      setBusySupplierId(null);
    }
  };

  const handleStatusUpdate = async (
    supplier: Supplier,
    status: SupplierStatus
  ) => {
    setActionError(null);
    setBusySupplierId(supplier.id);

    try {
      const updated = await updateSupplierStatus(
        supplier.id,
        status
      );
      replaceSupplier(updated);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update the supplier status."
      );
    } finally {
      setBusySupplierId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Procurement
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Supplier Directory
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage TrackFlow suppliers across USA and Spain. Filter the
              directory, register suppliers, update rates, and control
              supplier status without reloading the page.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSuppliers()}
            disabled={loading}
            className="self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 md:self-auto"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Visible suppliers</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {counts.total}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-sm text-emerald-700">Active</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {counts.active}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm text-amber-700">Suspended</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {counts.suspended}
            </p>
          </div>
        </section>

        <SupplierFilters
          country={country}
          category={category}
          onCountryChange={setCountry}
          onCategoryChange={setCategory}
          onClear={() => {
            setCountry("");
            setCategory("");
          }}
        />

        {listError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {listError}
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading supplier directory...
          </div>
        ) : (
          <SupplierTable
            suppliers={suppliers}
            busySupplierId={busySupplierId}
            onRateUpdate={handleRateUpdate}
            onStatusUpdate={handleStatusUpdate}
          />
        )}

        <SupplierForm
          submitting={creating}
          error={createError}
          onSubmit={handleCreate}
        />
      </div>
    </main>
  );
}
