"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { track } from "@/services/telemetry";

import { AccountApiError, getCurrentAccount } from "@/lib/accountApi";
import { AUTH_SESSION_KEY, clearAuthSession, getAuthSessionState, getAccessToken } from "@/lib/auth";

const publicPaths = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

function sectionNameFromPath(
  pathname: string,
): string | null {
  if (pathname === "/") {
    return "dashboard";
  }

  if (
    pathname ===
    "/backoffice/inventory/products"
  ) {
    return "products";
  }

  if (
    pathname ===
    "/backoffice/inventory/orders/inbound"
  ) {
    return "inbound";
  }

  if (
    pathname ===
    "/backoffice/inventory/orders/outbound"
  ) {
    return "outbound";
  }

  if (
    pathname ===
    "/backoffice/inventory/orders"
  ) {
    return "history";
  }

  if (pathname.startsWith("/incidents")) {
    return "incidents";
  }

  if (
    pathname.startsWith(
      "/incident-analysis",
    )
  ) {
    return "incident_analysis";
  }

  if (pathname.startsWith("/suppliers")) {
    return "suppliers";
  }

  if (
    pathname.startsWith(
      "/account/profile",
    )
  ) {
    return "account_profile";
  }

  if (
    pathname.startsWith(
      "/account/change-password",
    )
  ) {
    return "change_password";
  }

  return null;
}

function routeGroupFromPath(
  pathname: string,
): string {
  if (
    pathname.startsWith(
      "/backoffice/inventory",
    )
  ) {
    return "inventory";
  }

  if (
    pathname.startsWith("/incidents") ||
    pathname.startsWith(
      "/incident-analysis",
    )
  ) {
    return "incidents";
  }

  if (pathname.startsWith("/suppliers")) {
    return "suppliers";
  }

  if (pathname.startsWith("/account")) {
    return "account";
  }

  return "backoffice";
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorizedPath, setAuthorizedPath] = useState<string | null>(null);
  const [validationError, setValidationError] = useState("");
  const redirecting = useRef(false);
  const previousSection = useRef<string | null>(null);
  const lastTrackedSection = useRef<string | null>(null);
  const isPublicPath = publicPaths.has(pathname);

  useEffect(() => {
    if (isPublicPath) return;

    const redirectToLogin = () => {
      setAuthorizedPath(null);
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?${new URLSearchParams({ next })}`);
    };

    const validateSession = async () => {
      const sessionState =
        getAuthSessionState();

      if (sessionState === "expired") {
        track(
          "session_expired",
          {
            route_group:
              routeGroupFromPath(pathname),
          },
        );

        clearAuthSession();

        if (!redirecting.current) {
          redirecting.current = true;
          redirectToLogin();
        }

        return;
      }


      if (!getAccessToken()) {
        if (!redirecting.current) {
          redirecting.current = true;
          redirectToLogin();
        }

        return;
      }

      setValidationError("");
      try {
        const account =
          await getCurrentAccount();

        redirecting.current = false;

        setAuthorizedPath(pathname);

        const sectionName =
          sectionNameFromPath(pathname);

        if (
          sectionName &&
          lastTrackedSection.current !==
          sectionName
        ) {
          const properties: Record<
            string,
            unknown
          > = {
            section_name: sectionName,
            actor_role: account.role,
          };

          if (previousSection.current) {
            properties.previous_section =
              previousSection.current;
          }

          track(
            "section_viewed",
            properties,
          );

          previousSection.current =
            sectionName;

          lastTrackedSection.current =
            sectionName;
        }
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 404) {
          redirecting.current = false;
          setAuthorizedPath(pathname);
          return;
        }
        setAuthorizedPath(null);
        if (error instanceof AccountApiError &&
          error.status === 401
        ) {
          track(
            "session_expired",
            {
              route_group:
                routeGroupFromPath(pathname),
            },
          );

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