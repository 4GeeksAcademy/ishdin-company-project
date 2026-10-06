"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getAccessToken, getPostLoginPath, setAuthSession } from "@/lib/auth";
import { loginUser } from "@/lib/accountApi";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("passwordReset") === "success") {
      setNotice("Your password has been reset. Sign in with your new password.");
    } else if (query.get("passwordChanged") === "success") {
      setNotice("Your password has been changed. Sign in again to continue.");
    }
    if (getAccessToken()) router.replace("/");
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const token = await loginUser(email.trim(), password);
      setAuthSession(token);
      router.replace(getPostLoginPath());
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed. Check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-2xl content-start gap-5 pt-2 md:pt-6">
      <section className="rounded-xl border border-[#d8d2c5] bg-white/45 p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#45685f]">TrackFlow · Authentication</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Backoffice login</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">Sign in to access operations, incident analysis, and supplier tools.</p>
      </section>

      {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{notice}</p>}

      <form onSubmit={submit} className="grid gap-4 rounded-xl border border-[#d8d2c5] bg-[#fffefa] p-5 sm:p-6">
        <label className="grid gap-2 text-sm font-semibold text-slate-900" htmlFor="email">
          Email
          <input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-lg border border-[#d8d2c5] bg-white px-3 font-normal outline-none focus:border-[#3f7669] focus:ring-2 focus:ring-[#3f7669]/20" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-900" htmlFor="password">
          Password
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-lg border border-[#d8d2c5] bg-white px-3 font-normal outline-none focus:border-[#3f7669] focus:ring-2 focus:ring-[#3f7669]/20" />
        </label>
        <Link href="/forgot-password" className="justify-self-start text-sm font-medium text-[#315d54] underline underline-offset-4">Forgot your password?</Link>
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-wait disabled:opacity-60">
            {submitting ? "Signing in..." : "Login"}
          </button>
          <Link href="/register" className="inline-flex min-h-11 items-center rounded-lg border border-[#3e7468] px-4 text-sm font-medium text-[#315d54] hover:bg-[#edf4f1]">Create account</Link>
        </div>
      </form>
    </div>
  );
}