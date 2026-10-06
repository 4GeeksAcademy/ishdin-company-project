"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { requestPasswordReset } from "@/lib/accountApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch {
      setError("We couldn't submit your request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-2xl content-start gap-5 pt-2 md:pt-6">
      <section className="rounded-xl border border-[#d8d2c5] bg-white/45 p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#45685f]">TrackFlow · Authentication</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Forgot your password?</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">Enter the email address for your account and we’ll send a reset link if it’s registered.</p>
      </section>

      <form onSubmit={submit} className="grid max-w-2xl gap-4 rounded-xl border border-[#d8d2c5] bg-[#fffefa] p-5 sm:p-6">
        <label className="grid gap-2 text-sm font-semibold text-slate-900" htmlFor="reset-email">
          Email
          <input id="reset-email" name="email" type="email" autoComplete="email" required disabled={submitted || submitting} value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-lg border border-[#d8d2c5] bg-white px-3 font-normal outline-none focus:border-[#3f7669] focus:ring-2 focus:ring-[#3f7669]/20 disabled:bg-slate-100" />
        </label>
        {submitted ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            If that address is registered, you'll receive a link shortly.
          </p>
        ) : (
          <>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <button type="submit" disabled={submitting} className="min-h-11 justify-self-start rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-wait disabled:opacity-60">
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </>
        )}
        <Link href="/login" className="justify-self-start text-sm font-medium text-[#315d54] underline underline-offset-4">Back to sign in</Link>
      </form>
    </div>
  );
}