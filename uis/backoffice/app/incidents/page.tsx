"use client";

import { useState } from "react";

import { IncidentListPanel } from "@/components/incidents/IncidentListPanel";
import { IncidentNav } from "@/components/incidents/IncidentNav";
import { IncidentSummaryPanel } from "@/components/incidents/IncidentSummaryPanel";

export default function IncidentsPage() {
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            TrackFlow backoffice
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Centralized Incident Manager
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Track customer, branch, and internal incidents across Los Angeles,
            Zaragoza, and central operations.
          </p>
        </div>

        <IncidentNav />
      </header>

      <IncidentSummaryPanel refreshKey={summaryRefreshKey} />

      <IncidentListPanel
        onChanged={() =>
          setSummaryRefreshKey((current) => current + 1)
        }
      />
    </main>
  );
}
