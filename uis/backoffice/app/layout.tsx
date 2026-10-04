import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = { title: "TrackFlow Backoffice", description: "TrackFlow incident analysis backoffice" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const codespaceName = process.env.CODESPACE_NAME;
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  const trackerUrl = process.env.NEXT_PUBLIC_TALENT_PIPELINE_TRACKER_URL?.trim() ||
    (codespaceName && forwardingDomain
      ? `https://${codespaceName}-3001.${forwardingDomain}/`
      : "http://localhost:3001/");

  return (
    <html lang="en"><body><div className="min-h-screen md:flex"><Sidebar trackerUrl={trackerUrl} /><main className="min-w-0 flex-1">{children}</main></div></body></html>
  );
}
