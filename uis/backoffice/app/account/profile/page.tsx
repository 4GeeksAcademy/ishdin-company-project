"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AccountApiError, getCurrentAccount, updateMyProfile } from "@/lib/accountApi";
import type { AccountProfile } from "@/lib/accountApi";

type ProfileFields = Pick<AccountProfile, "name" | "phone" | "address">;

export default function AccountProfilePage() {
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<ProfileFields>({ name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const account = await getCurrentAccount();
      setEmail(account.email);
      setFields({
        name: account.profile.name ?? "",
        phone: account.profile.phone ?? "",
        address: account.profile.address ?? "",
      });
    } catch {
      setLoadError("Unable to load your profile. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateField = (field: keyof ProfileFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setSaveError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");

    try {
      const profile = await updateMyProfile(fields);
      setFields({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
      });
      setSaved(true);
    } catch (cause) {
      if (cause instanceof AccountApiError && cause.status === 404) {
        setSaveError("Your profile could not be found. Contact an administrator.");
      } else {
        setSaveError("Unable to save your profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#3e7468] focus:ring-2 focus:ring-[#3e7468]/20";

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#3e7468]">Account</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Profile</h1>
        <p className="mt-2 text-sm text-slate-600">Manage your contact information.</p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-600" role="status">Loading your profile...</p>
      ) : loadError ? (
        <div className="grid max-w-2xl gap-3 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="min-h-10 justify-self-start rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800"
          >
            Try again
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="max-w-2xl space-y-5">
          <div>
            <label htmlFor="account-email" className="text-sm font-semibold text-slate-800">Email</label>
            <p id="account-email" className="mt-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-700">{email}</p>
          </div>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="profile-name">
            Name
            <input id="profile-name" name="name" autoComplete="name" value={fields.name ?? ""} onChange={(event) => updateField("name", event.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="profile-phone">
            Phone
            <input id="profile-phone" name="phone" type="tel" autoComplete="tel" value={fields.phone ?? ""} onChange={(event) => updateField("phone", event.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="profile-address">
            Address
            <input id="profile-address" name="address" autoComplete="street-address" value={fields.address ?? ""} onChange={(event) => updateField("address", event.target.value)} className={inputClass} />
          </label>
          {saveError && <p className="text-sm text-red-700" role="alert">{saveError}</p>}
          {saved && <p className="text-sm text-emerald-700" role="status">Profile updated.</p>}
          <button type="submit" disabled={saving || loading} className="min-h-11 rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-wait disabled:opacity-60">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      )}
    </div>
  );
}
