"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";

const authPaths = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

export default function BackofficeShell({
  children,
  trackerUrl,
}: {
  children: React.ReactNode;
  trackerUrl: string;
}) {
  const pathname = usePathname();

  if (authPaths.has(pathname)) {
    return (
      <div className="min-h-screen bg-[#f4f2eb] text-slate-900">
        <header className="bg-[#1c3933] text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6 md:min-h-12 md:flex-nowrap md:py-0">
            <Link href="/" className="order-1 shrink-0 text-sm font-semibold">TrackFlow Backoffice</Link>
            <nav aria-label="Backoffice navigation" className="order-3 flex w-full gap-5 overflow-x-auto whitespace-nowrap pb-1 text-sm font-medium md:order-2 md:w-auto md:pb-0">
              <Link href="/">Home</Link>
              <Link href="/incident-analysis">Incident analysis</Link>
              <Link href="/suppliers">Suppliers</Link>
              <a href={trackerUrl}>Hiring tracker</a>
            </nav>
            <Link
              href={pathname === "/login" ? "/register" : "/login"}
              className="order-2 shrink-0 rounded-md border border-white/50 px-4 py-2 text-sm font-medium hover:bg-white/10 md:order-3"
            >
              {pathname === "/login" ? "Create account" : "Sign in"}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-10">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar trackerUrl={trackerUrl} />
      <main className="min-w-0 flex-1">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}