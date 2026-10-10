"use client";

import { useCallback, useEffect, useState } from "react";

import {
  BRANCH_OPTIONS,
  CATEGORY_OPTIONS,
  NEXT_STATUS_OPTIONS,
  ORIGIN_OPTIONS,
  STATUS_OPTIONS,
  branchLabel,
  categoryLabel,
  originLabel,
  statusLabel,
} from "@/lib/incidentConstants";
import {
  getIncidents,
  IncidentApiError,
  updateIncidentStatus,
} from "@/lib/incidentApi";
import type {
  Incident,
  IncidentBranch,
  IncidentFilters,
  IncidentOrigin,
  IncidentStatus,
} from "@/types/incident";

interface Props {
  refreshKey?: number;
  onChanged?: () => void;
}

const emptyFilters: IncidentFilters = {
  status: "",
  origin: "",
  branch: "",
};

export const IncidentListPanel = ({
  refreshKey = 0,
  onChanged,
}: Props) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filters, setFilters] = useState<IncidentFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusErrors, setStatusErrors] = useState<Record<string, string>>({});
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      setIncidents(await getIncidents(filters));
    } catch (error) {
      setLoadError(
        error instanceof IncidentApiError
          ? error.message
          : "Incidents could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const changeStatus = async (
    incident: Incident,
    nextStatus: IncidentStatus,
  ) => {
    const previousStatus = incident.status;

    // Optimistic UI: update immediately, then roll back if the API fails.
    setIncidents((current) =>
      current.map((item) =>
        item.id === incident.id
          ? { ...item, status: nextStatus }
          : item,
      ),
    );

    setUpdatingIds((current) => new Set(current).add(incident.id));
    setStatusErrors((current) => {
      const next = { ...current };
      delete next[incident.id];
      return next;
    });

    try {
      const saved = await updateIncidentStatus(
        incident.id,
        nextStatus,
      );

      setIncidents((current) =>
        current.map((item) =>
          item.id === incident.id ? saved : item,
        ),
      );
      onChanged?.();
    } catch (error) {
      // Required rollback behavior.
      setIncidents((current) =>
        current.map((item) =>
          item.id === incident.id
            ? { ...item, status: previousStatus }
            : item,
        ),
      );

      setStatusErrors((current) => ({
        ...current,
        [incident.id]:
          error instanceof IncidentApiError
            ? error.message
            : "Status could not be updated. The previous status was restored.",
      }));
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(incident.id);
        return next;
      });
    }
  };

  const updateFilter = <K extends keyof IncidentFilters>(
    key: K,
    value: IncidentFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const hasFilters = Boolean(
    filters.status || filters.origin || filters.branch,
  );

  return (
    <section
      aria-labelledby="incident-list-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Central registry
          </p>
          <h2
            id="incident-list-heading"
            className="mt-1 text-xl font-semibold text-slate-950 dark:text-white"
          >
            Incidents
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Filter incidents and advance them through the allowed lifecycle.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Status
            <select
              value={filters.status ?? ""}
              onChange={(e) =>
                updateFilter(
                  "status",
                  e.target.value as IncidentStatus | "",
                )
              }
              className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Origin
            <select
              value={filters.origin ?? ""}
              onChange={(e) =>
                updateFilter(
                  "origin",
                  e.target.value as IncidentOrigin | "",
                )
              }
              className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All origins</option>
              {ORIGIN_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Branch
            <select
              value={filters.branch ?? ""}
              onChange={(e) =>
                updateFilter(
                  "branch",
                  e.target.value as IncidentBranch | "",
                )
              }
              className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All branches</option>
              {BRANCH_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-10 rounded-lg border border-current px-3 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700"
        >
          Loading incidents…
        </div>
      ) : !loadError && incidents.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="font-medium text-slate-900 dark:text-white">
            {hasFilters
              ? "No incidents match these filters."
              : "No incidents have been registered yet."}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {hasFilters
              ? "Change or clear a filter to see more results."
              : "Register an incident to start the central registry."}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="mt-4 min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : !loadError ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <th className="px-3 py-3">Incident</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Origin</th>
                <th className="px-3 py-3">Branch</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Status / action</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => {
                const nextStatuses =
                  NEXT_STATUS_OPTIONS[incident.status];
                const updating = updatingIds.has(incident.id);

                return (
                  <tr
                    key={incident.id}
                    className="border-b border-slate-100 align-top dark:border-slate-900"
                  >
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">
                        {incident.title}
                      </p>
                      <p className="mt-1 max-w-md line-clamp-2 text-xs text-slate-500">
                        {incident.description}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-700 dark:text-slate-100">
                      {categoryLabel(incident.category)}
                    </td>
                    <td className="px-3 py-4 text-slate-700 dark:text-slate-100">
                      {originLabel(incident.origin)}
                    </td>
                    <td className="px-3 py-4 text-slate-700 dark:text-slate-100">
                      {branchLabel(incident.branch)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {new Date(incident.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex min-w-48 flex-col gap-2">
                        <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {statusLabel(incident.status)}
                        </span>

                        {nextStatuses.length > 0 ? (
                          <select
                            value=""
                            disabled={updating}
                            aria-label={`Update status for ${incident.title}`}
                            onChange={(e) => {
                              const next = e.target.value as IncidentStatus;
                              if (next) {
                                void changeStatus(incident, next);
                              }
                            }}
                            className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          >
                            <option value="">
                              {updating ? "Updating…" : "Change status…"}
                            </option>
                            {nextStatuses.map((status) => (
                              <option
                                key={status}
                                value={status}
                                className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white"
                              >
                                Move to {statusLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Final status
                          </span>
                        )}

                        {statusErrors[incident.id] && (
                          <p role="alert" className="text-xs text-rose-600">
                            {statusErrors[incident.id]} Previous status restored.
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
};
