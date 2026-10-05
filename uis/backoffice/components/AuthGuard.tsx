"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AccountApiError, getCurrentAccount } from "@/lib/accountApi";
import { AUTH_SESSION_KEY, getAccessToken } from "@/lib/auth";

const publicPaths = new Set(["/login", "/register"]);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorizedPath, setAuthorizedPath] = useState<string | null>(null);
  const [validationError, setValidationError] = useState("");
  const redirecting = useRef(false);
  const isPublicPath = publicPaths.has(pathname);

  useEffect(() => {
    if (isPublicPath) return;

    const redirectToLogin = () => {
      setAuthorizedPath(null);
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?${new URLSearchParams({ next })}`);
    };

    const validateSession = async () => {
      if (!getAccessToken()) {
        if (!redirecting.current) {
          redirecting.current = true;
          redirectToLogin();
        }
        return;
      }

      setValidationError("");
      try {
        await getCurrentAccount();
        redirecting.current = false;
        setAuthorizedPath(pathname);
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 404) {
          redirecting.current = false;
          setAuthorizedPath(pathname);
          return;
        }
        setAuthorizedPath(null);
        if (error instanceof AccountApiError && error.status === 401) {
          redirecting.current = true;
          redirectToLogin();
          return;
        }
        setValidationError("Unable to verify your session. Check your connection and try again.");
      }
    };

    void validateSession();
    const interval = window.setInterval(() => {
      if (!getAccessToken()) void validateSession();
    }, 15_000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_KEY || event.key === null) void validateSession();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, [isPublicPath, pathname, router]);

  if (isPublicPath) return children;
  if (authorizedPath !== pathname) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-6" aria-live="polite">
        {validationError ? (
          <div className="grid justify-items-center gap-3 text-center" role="alert">
            <p className="text-sm text-slate-700">{validationError}</p>
            <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-[#3e7468] px-4 py-2 text-sm font-semibold text-white">Try again</button>
          </div>
        ) : <p className="text-sm text-slate-600" role="status">Checking your session...</p>}
      </div>
    );
  }
  return children;
}