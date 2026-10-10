"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/incidents", label: "Incident overview" },
  { href: "/incidents/new", label: "Register incident" },
];

export const IncidentNav = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Incident management"
      className="flex flex-wrap gap-2"
    >
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                : "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-slate-50 dark:border-slate-700 dark:text-emerald-900 dark:hover:bg-slate-100"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};
