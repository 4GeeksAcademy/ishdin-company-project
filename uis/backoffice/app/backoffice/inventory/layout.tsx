import InventoryNav from "@/components/inventory/InventoryNav";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#3e7468]">Warehouse operations</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Inventory management</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Review warehouse stock, register goods receipts and stock exits, and audit inventory movements.
        </p>
      </header>
      <InventoryNav />
      {children}
    </div>
  );
}
