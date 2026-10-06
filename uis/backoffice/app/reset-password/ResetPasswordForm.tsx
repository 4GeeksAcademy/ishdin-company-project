"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { clearAuthSession } from "@/lib/auth";
import { AccountApiError, resetPassword } from "@/lib/accountApi";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tokenInitialized = useRef(false);

  useEffect(() => {
    if (tokenInitialized.current) return;
    tokenInitialized.current = true;
    const resetToken = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(resetToken);
    window.history.replaceState(window.history.state, "", "/reset-password");
    setTokenReady(true);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword.trim().length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("The new password and confirmation do not match.");
      return;
    }
    if (!token) {
      setError("This reset link is incomplete. Request a new link to continue.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, newPassword.trim());
      clearAuthSession();
      router.replace("/login?passwordReset=success");
    } catch (cause) {
      setError(cause instanceof AccountApiError && cause.status === 400
        ? "This reset link is invalid, expired, or already used. Request a new link to continue."
        : "We couldn't reset your password right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-2xl content-start gap-5 pt-2 md:pt-6">
      <section className="rounded-xl border border-[#d8d2c5] bg-white/45 p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#45685f]">TrackFlow · Authentication</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">Reset links expire and can only be used once.</p>
      </section>

      {!tokenReady ? (
        <p className="text-sm text-slate-600" role="status">Checking your reset link...</p>
      ) : !token ? (
        <div className="grid gap-4 rounded-xl border border-[#d8d2c5] bg-[#fffefa] p-5 sm:p-6">
          <p className="text-sm text-red-700" role="alert">This reset link is incomplete. Request a new link to continue.</p>
          <Link href="/forgot-password" className="text-sm font-medium text-[#315d54] underline underline-offset-4">Request a new reset link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 rounded-xl border border-[#d8d2c5] bg-[#fffefa] p-5 sm:p-6">
          <label className="grid gap-2 text-sm font-semibold text-slate-900" htmlFor="new-password">
            New password
            <input id="new-password" name="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-12 rounded-lg border border-[#d8d2c5] bg-white px-3 font-normal outline-none focus:border-[#3f7669] focus:ring-2 focus:ring-[#3f7669]/20" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-900" htmlFor="confirm-password">
            Confirm new password
            <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-12 rounded-lg border border-[#d8d2c5] bg-white px-3 font-normal outline-none focus:border-[#3f7669] focus:ring-2 focus:ring-[#3f7669]/20" />
          </label>
          {error && (
            <div className="grid gap-2" role="alert">
              <p className="text-sm text-red-700">{error}</p>
              <Link href="/forgot-password" className="justify-self-start text-sm font-medium text-[#315d54] underline underline-offset-4">
                Request a new reset link
              </Link>
            </div>
          )}
          <button type="submit" disabled={submitting} className="min-h-11 justify-self-start rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-wait disabled:opacity-60">
            {submitting ? "Resetting password..." : "Reset password"}
          </button>
        </form>
      )}
    </div>
  );
}