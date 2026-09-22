import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = { title: "TrackFlow Backoffice", description: "TrackFlow incident analysis backoffice" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en"><body><div className="min-h-screen md:flex"><Sidebar /><main className="min-w-0 flex-1">{children}</main></div></body></html>
  );
}
