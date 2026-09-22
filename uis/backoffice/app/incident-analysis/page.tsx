"use client";

import { useState } from "react";
import BreakdownTable from "@/components/BreakdownTable";
import FileUpload from "@/components/FileUpload";
import MetricCard from "@/components/MetricCard";
import { analyzeIncidentsCsv, downloadLatestResults } from "@/lib/api";
import type { IncidentAnalysisResult, IncidentCategory, IncidentStatus } from "@/types/incidents";

const categories: IncidentCategory[] = ["LOST_PARCEL", "DELAYED_DELIVERY", "WRONG_ADDRESS", "RETURN_REQUEST", "DAMAGE"];
const statuses: IncidentStatus[] = ["OPEN", "CLOSED", "DISCARDED"];
const readableLabel = (value: string) => value.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

export default function IncidentAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<IncidentAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleAnalyze = async () => {
    if (!file) return setError("Please choose a CSV file before starting the analysis.");
    setLoading(true); setError(""); setResult(null);
    try { setResult(await analyzeIncidentsCsv(file)); }
    catch (e) { setError(e instanceof Error ? e.message : "The CSV could not be analyzed."); }
    finally { setLoading(false); }
  };

  const handleExport = async () => {
    setExporting(true); setError("");
    try { await downloadLatestResults(); }
    catch (e) { setError(e instanceof Error ? e.message : "The latest analysis could not be exported."); }
    finally { setExporting(false); }
  };

  const categoryItems = categories.map((c) => ({ label: readableLabel(c), value: result?.category_breakdown?.[c] ?? 0 }));
  const statusItems = statuses.map((s) => ({ label: readableLabel(s), value: result?.status_breakdown?.[s] ?? 0 }));
  const invalidItems = result ? Object.entries(result.invalid_reasons ?? {}).map(([label, value]) => ({ label, value })) : [];

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <div className="flex flex-col justify-between gap-4 lg:flex-row">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">After-sales support</p>
          <h1 className="mt-2 text-3xl font-bold">Incident Analysis</h1>
          <p className="mt-3 max-w-3xl text-slate-600">Upload an internal TrackFlow incident CSV. Aggregate results are shown; individual customer email values are never displayed.</p>
        </div>
        <button type="button" onClick={handleExport} disabled={!result || exporting}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50">
          {exporting ? "Downloading..." : "Download results CSV"}
        </button>
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Upload CSV</h2>
        <p className="mt-1 text-sm text-slate-500">Select the TrackFlow incident file to send it to the analysis API.</p>
        <div className="mt-5"><FileUpload file={file} disabled={loading} onFileChange={(f) => { setFile(f); setError(""); setResult(null); }} /></div>
        <button type="button" onClick={handleAnalyze} disabled={!file || loading}
          className="mt-5 rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? "Analyzing..." : "Analyze incidents"}
        </button>
      </section>

      {error && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800"><strong>Unable to continue:</strong> {error}</div>}

      {result && (
        <div className="mt-8 space-y-8">
          {result.invalid_records > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"><strong>{result.invalid_records} invalid record(s) found.</strong> Invalid rows are excluded from the valid-record metrics.</div>}

          <section>
            <h2 className="text-lg font-semibold">General metrics</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total processed" value={result.total_records} />
              <MetricCard label="Valid records" value={result.valid_records} />
              <MetricCard label="Invalid records" value={result.invalid_records} />
              <MetricCard label="Closed satisfaction index" value={result.average_satisfaction.toFixed(2)} helper="Average for valid CLOSED cases with a score" />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownTable title="Incident category breakdown" items={categoryItems} />
            <BreakdownTable title="Status breakdown" items={statusItems} />
          </div>

          {result.country_breakdown && <BreakdownTable title="Country breakdown" items={[{ label: "United States (US)", value: result.country_breakdown.US }, { label: "Spain (ES)", value: result.country_breakdown.ES }]} />}

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold">Invalid record details</h2>
              <p className="mt-1 text-sm text-slate-500">Counts grouped by validation reason. No personal values are shown.</p>
            </div>
            {invalidItems.length ? <div className="divide-y divide-slate-100">{invalidItems.map((item) => <div key={item.label} className="flex justify-between gap-4 px-5 py-3"><span className="text-sm text-slate-600">{item.label}</span><span className="rounded-md bg-rose-50 px-2.5 py-1 text-sm font-semibold text-rose-700">{item.value}</span></div>)}</div> : <p className="px-5 py-6 text-sm text-slate-500">No invalid records were reported.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
