"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { clearAuthSession } from "@/lib/auth";
import { AccountApiError, changePassword } from "@/lib/accountApi";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword.trim().length < 8) {
      setError("Use a new password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("The new password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword.trim());
      clearAuthSession();
      router.replace("/login?passwordChanged=success");
    } catch (cause) {
      setError(cause instanceof AccountApiError && cause.status === 400
        ? "The current password is incorrect."
        : cause instanceof Error ? cause.message : "Unable to change your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#3e7468]">Account</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Change password</h1>
        <p className="mt-2 text-sm text-slate-600">You'll need to sign in again after changing your password.</p>
      </header>
      <form onSubmit={submit} className="max-w-2xl space-y-5">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="current-password">
          Current password
          <input id="current-password" name="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#3e7468] focus:ring-2 focus:ring-[#3e7468]/20" />
        </label>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="new-password">
          New password
          <input id="new-password" name="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#3e7468] focus:ring-2 focus:ring-[#3e7468]/20" />
        </label>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="confirm-password">
          Confirm new password
          <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#3e7468] focus:ring-2 focus:ring-[#3e7468]/20" />
        </label>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-wait disabled:opacity-60">
          {submitting ? "Changing password..." : "Change password"}
        </button>
      </form>
    </div>
  );
}