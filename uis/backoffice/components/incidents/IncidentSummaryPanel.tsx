"use client";

import { useCallback, useEffect, useState } from "react";

import {
  BRANCH_OPTIONS,
  CATEGORY_OPTIONS,
  ORIGIN_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/incidentConstants";
import {
  getIncidentSummary,
  IncidentApiError,
} from "@/lib/incidentApi";
import type { IncidentSummary } from "@/types/incident";

interface Props {
  refreshKey?: number;
}

const MetricGroup = ({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) => (
  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
      {title}
    </h3>
    <dl className="mt-3 space-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <dt className="text-slate-600 dark:text-slate-400">
            {item.label}
          </dt>
          <dd className="font-semibold text-slate-950 dark:text-white">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);

export const IncidentSummaryPanel = ({ refreshKey = 0 }: Props) => {
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      setSummary(await getIncidentSummary());
    } catch (error) {
      setErrorMessage(
        error instanceof IncidentApiError
          ? error.message
          : "Summary metrics could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section
      aria-labelledby="incident-summary-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Leadership view
          </p>
          <h2
            id="incident-summary-heading"
            className="mt-1 text-xl font-semibold text-slate-950 dark:text-white"
          >
            Incident summary
          </h2>
        </div>

        {summary && !loading && !errorMessage && (
          <div className="rounded-xl bg-slate-950 px-4 py-3 text-white dark:bg-white dark:text-slate-950">
            <p className="text-xs font-medium opacity-70">Total incidents</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </div>
        )}
      </div>

      {loading && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700"
        >
          Loading summary…
        </div>
      )}

      {!loading && errorMessage && (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-10 rounded-lg border border-current px-3 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !errorMessage && summary && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricGroup
            title="By status"
            items={STATUS_OPTIONS.map((item) => ({
              label: item.label,
              value: summary.by_status[item.value] ?? 0,
            }))}
          />

          <MetricGroup
            title="By category"
            items={CATEGORY_OPTIONS.map((item) => ({
              label: item.label,
              value: summary.by_category[item.value] ?? 0,
            }))}
          />

          <MetricGroup
            title="By origin"
            items={ORIGIN_OPTIONS.map((item) => ({
              label: item.label,
              value: summary.by_origin[item.value] ?? 0,
            }))}
          />

          <MetricGroup
            title="By branch"
            items={BRANCH_OPTIONS.map((item) => ({
              label: item.label,
              value: summary.by_branch[item.value] ?? 0,
            }))}
          />
        </div>
      )}
    </section>
  );
};
