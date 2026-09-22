import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">TrackFlow Backoffice</p>
      <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Internal tools for TrackFlow operations.</p>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Incident file analysis</h2>
        <p className="mt-2 text-sm text-slate-600">Upload a TrackFlow CSV, review validation results, and export the latest summary.</p>
        <Link href="/incident-analysis" className="mt-5 inline-flex rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white">Open Incident Analysis</Link>
      </div>
    </div>
  );
}
