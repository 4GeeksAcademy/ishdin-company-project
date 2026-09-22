"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/incident-analysis", label: "Incident Analysis" }
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-full bg-slate-950 text-white md:min-h-screen md:w-64">
      <div className="px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">TrackFlow</p>
        <h1 className="mt-2 text-xl font-bold">Backoffice</h1>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-4 md:block md:space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`block whitespace-nowrap rounded-lg px-4 py-3 text-sm font-medium ${active ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
