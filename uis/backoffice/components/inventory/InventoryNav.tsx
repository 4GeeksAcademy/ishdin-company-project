"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/backoffice/inventory/products", label: "Products" },
  { href: "/backoffice/inventory/orders/inbound", label: "Inbound delivery" },
  { href: "/backoffice/inventory/orders/outbound", label: "Outbound exit" },
  { href: "/backoffice/inventory/orders", label: "Order history" },
];

export default function InventoryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Inventory navigation" className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#1c3933] text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
