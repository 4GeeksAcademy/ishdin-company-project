"use client";

import { FormEvent, useState } from "react";

import {
  BRANCH_OPTIONS,
  CATEGORY_OPTIONS,
  ORIGIN_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/incidentConstants";
import {
  createIncident,
  IncidentApiError,
} from "@/lib/incidentApi";
import type {
  IncidentCreateInput,
} from "@/types/incident";

const INITIAL_FORM: IncidentCreateInput = {
  title: "",
  description: "",
  category: "lost_parcel",
  status: "open",
  origin: "customer",
  branch: "central",
};

interface Props {
  onCreated?: () => void;
}

export const IncidentRegistrationForm = ({ onCreated }: Props) => {
  const [form, setForm] = useState<IncidentCreateInput>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof IncidentCreateInput>(
    key: K,
    value: IncidentCreateInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSuccess("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    setSuccess("");
    setSubmitting(true);

    try {
      await createIncident(form);
      setForm(INITIAL_FORM);
      setSuccess("Incident registered successfully.");
      onCreated?.();
    } catch (error) {
      if (error instanceof IncidentApiError) {
        setFieldErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("The incident could not be registered. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-800";

  return (
    <section
      aria-labelledby="register-incident-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Incident management
        </p>
        <h2
          id="register-incident-heading"
          className="mt-1 text-xl font-semibold text-slate-950 dark:text-white"
        >
          Register incident
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Log a customer, branch, or internal incident in the shared TrackFlow registry.
        </p>
      </div>

      {success && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {success}
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          {formError}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="incident-title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="incident-title"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className={fieldClass}
            maxLength={120}
            required
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.title)}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-sm text-rose-600">{fieldErrors.title}</p>
          )}
        </div>

        <div>
          <label htmlFor="incident-description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="incident-description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={`${fieldClass} min-h-28 resize-y`}
            required
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.description)}
          />
          {fieldErrors.description && (
            <p className="mt-1 text-sm text-rose-600">
              {fieldErrors.description}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="incident-category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="incident-category"
              value={form.category}
              onChange={(e) =>
                update("category", e.target.value as IncidentCreateInput["category"])
              }
              className={fieldClass}
              disabled={submitting}
            >
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {fieldErrors.category && (
              <p className="mt-1 text-sm text-rose-600">
                {fieldErrors.category}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="incident-status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="incident-status"
              value={form.status}
              onChange={(e) =>
                update("status", e.target.value as IncidentCreateInput["status"])
              }
              className={fieldClass}
              disabled={submitting}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {fieldErrors.status && (
              <p className="mt-1 text-sm text-rose-600">{fieldErrors.status}</p>
            )}
          </div>

          <div>
            <label htmlFor="incident-origin" className="text-sm font-medium">
              Origin
            </label>
            <select
              id="incident-origin"
              value={form.origin}
              onChange={(e) =>
                update("origin", e.target.value as IncidentCreateInput["origin"])
              }
              className={fieldClass}
              disabled={submitting}
            >
              {ORIGIN_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {fieldErrors.origin && (
              <p className="mt-1 text-sm text-rose-600">{fieldErrors.origin}</p>
            )}
          </div>

          <div
            className={
              form.origin === "branch"
                ? "rounded-xl border-2 border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40"
                : ""
            }
          >
            <label htmlFor="incident-branch" className="text-sm font-medium">
              Branch
            </label>
            {form.origin === "branch" && (
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                Confirm the location reporting this incident.
              </p>
            )}
            <select
              id="incident-branch"
              value={form.branch}
              onChange={(e) =>
                update("branch", e.target.value as IncidentCreateInput["branch"])
              }
              className={fieldClass}
              required
              disabled={submitting}
            >
              {BRANCH_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {fieldErrors.branch && (
              <p className="mt-1 text-sm text-rose-600">{fieldErrors.branch}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
        >
          {submitting ? "Registering…" : "Register incident"}
        </button>
      </form>
    </section>
  );
};
