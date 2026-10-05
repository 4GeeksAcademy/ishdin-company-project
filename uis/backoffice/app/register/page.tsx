"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getAccessToken, getPostLoginPath, setAuthSession } from "@/lib/auth";
import { AccountApiError, loginUser, registerUser } from "@/lib/accountApi";

type RegistrationFields = {
  email: string;
  password: string;
  name: string;
  phone: string;
  address: string;
};

const emptyFields: RegistrationFields = { email: "", password: "", name: "", phone: "", address: "" };

export default function RegisterPage() {
  const router = useRouter();
  const [fields, setFields] = useState(emptyFields);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegistrationFields, string>>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getAccessToken()) router.replace("/");
  }, [router]);

  const updateField = (field: keyof RegistrationFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError("");
    const password = fields.password.trim();
    if (password.length < 8) {
      setFieldErrors({ password: "Use at least 8 non-whitespace characters." });
      setFormError("Review the highlighted fields.");
      setSubmitting(false);
      return;
    }
    const input = {
      email: fields.email.trim(),
      password,
      ...(fields.name.trim() ? { name: fields.name.trim() } : {}),
      ...(fields.phone.trim() ? { phone: fields.phone.trim() } : {}),
      ...(fields.address.trim() ? { address: fields.address.trim() } : {}),
    };
    try {
      await registerUser(input);
    } catch (cause) {
      if (cause instanceof AccountApiError) {
        setFieldErrors(cause.fieldErrors);
        setFormError(cause.status === 409 ? "An account already exists for this email." : cause.status === 422 ? "Review the highlighted fields." : cause.message);
      } else {
        setFormError(cause instanceof Error ? cause.message : "Account creation failed. Please try again.");
      }
      setSubmitting(false);
      return;
    }

    try {
      const token = await loginUser(input.email, password);
      setAuthSession(token);
      router.replace(getPostLoginPath());
      router.refresh();
    } catch {
      setFormError("Your account was created, but automatic sign-in failed. Please sign in with your new account.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "h-11 rounded-lg border border-[#d8d2c5] bg-white px-3 font-normal outline-none focus:border-[#3f7669] focus:ring-2 focus:ring-[#3f7669]/20";
  const renderField = (field: keyof RegistrationFields, label: string, type = "text", autoComplete?: string) => (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-900" htmlFor={field} key={field}>
      {label}
      <input id={field} name={field} type={type} autoComplete={autoComplete} required={field === "email" || field === "password"} minLength={field === "password" ? 8 : undefined} value={fields[field]} onChange={(event) => updateField(field, event.target.value)} aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field] ? `${field}-error` : undefined} className={inputClass} />
      {fieldErrors[field] && <span id={`${field}-error`} className="text-xs font-normal text-red-700">{fieldErrors[field]}</span>}
    </label>
  );

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-2xl content-start gap-5 pt-2 md:pt-6">
      <section className="rounded-xl border border-[#d8d2c5] bg-white/45 p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#45685f]">TrackFlow · Authentication</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">Set up your account to access TrackFlow operations.</p>
      </section>

      <form onSubmit={submit} noValidate className="grid gap-4 rounded-xl border border-[#d8d2c5] bg-[#fffefa] p-5 sm:grid-cols-2 sm:p-6">
        {renderField("email", "Email", "email", "email")}
        {renderField("password", "Password", "password", "new-password")}
        {renderField("name", "Name", "text", "name")}
        {renderField("phone", "Phone", "tel", "tel")}
        <div className="sm:col-span-2">{renderField("address", "Address", "text", "street-address")}</div>
        {formError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2" role="alert">{formError}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-1 sm:col-span-2">
          <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-[#3e7468] px-5 text-sm font-semibold text-white hover:bg-[#315d54] disabled:cursor-wait disabled:opacity-60">
            {submitting ? "Creating account..." : "Create account"}
          </button>
          <Link href="/login" className="text-sm font-medium text-[#315d54] underline underline-offset-4">Already have an account? Sign in</Link>
        </div>
      </form>
    </div>
  );
}