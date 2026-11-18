"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { track } from "@/services/telemetry";


const recentErrors = new Map<string, number>();
const ERROR_DEDUPE_MS = 10_000;


function sectionNameFromPath(
  pathname: string,
): string {
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
    pathname.startsWith("/incident-analysis")
  ) {
    return "incident_analysis";
  }

  if (pathname.startsWith("/suppliers")) {
    return "suppliers";
  }

  if (pathname.startsWith("/account/profile")) {
    return "account_profile";
  }

  if (
    pathname.startsWith(
      "/account/change-password",
    )
  ) {
    return "change_password";
  }

  if (pathname.startsWith("/login")) {
    return "login";
  }

  return "unknown";
}


function sanitiseMessage(
  message: string,
): string {
  return message
    .toLowerCase()

    // Remove URLs.
    .replace(
      /https?:\/\/\S+/g,
      "[url]",
    )

    // Remove email-like values.
    .replace(
      /\b[\w.+-]+@[\w.-]+\.\w+\b/g,
      "[email]",
    )

    // Remove UUIDs.
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi,
      "[uuid]",
    )

    // Remove numbers that could be IDs.
    .replace(
      /\b\d+\b/g,
      "[number]",
    )

    .slice(0, 200);
}


function simpleHash(
  value: string,
): string {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);

    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return (
    hash >>> 0
  ).toString(16);
}


function createFingerprint(
  errorName: string,
  message: string,
): string {
  const safeMessage =
    sanitiseMessage(message);

  return `${errorName.toLowerCase()}-${simpleHash(
    safeMessage,
  )}`;
}


function shouldTrack(
  fingerprint: string,
): boolean {
  const now = Date.now();

  const previous =
    recentErrors.get(fingerprint);

  if (
    previous &&
    now - previous < ERROR_DEDUPE_MS
  ) {
    return false;
  }

  recentErrors.set(
    fingerprint,
    now,
  );

  return true;
}


export default function FrontendErrorTelemetry() {
  const pathname = usePathname();

  useEffect(() => {
    const sectionName =
      sectionNameFromPath(pathname);


    const reportError = (
      errorName: string,
      message: string,
    ) => {
      const fingerprint =
        createFingerprint(
          errorName,
          message,
        );

      if (!shouldTrack(fingerprint)) {
        return;
      }

      track(
        "frontend_error_recorded",
        {
          section_name: sectionName,
          error_fingerprint:
            fingerprint,
        },
      );
    };


    const handleWindowError = (
      event: ErrorEvent,
    ) => {
      reportError(
        event.error instanceof Error
          ? event.error.name
          : "Error",

        event.error instanceof Error
          ? event.error.message
          : "uncaught_browser_error",
      );
    };


    const handleUnhandledRejection = (
      event: PromiseRejectionEvent,
    ) => {
      const reason = event.reason;

      if (reason instanceof Error) {
        reportError(
          reason.name,
          reason.message,
        );

        return;
      }

      /*
       * Do not stringify arbitrary rejected objects.
       * They could contain sensitive information.
       */
      reportError(
        "PromiseRejection",
        typeof reason === "string"
          ? reason
          : "non_error_rejection",
      );
    };


    window.addEventListener(
      "error",
      handleWindowError,
    );

    window.addEventListener(
      "unhandledrejection",
      handleUnhandledRejection,
    );


    return () => {
      window.removeEventListener(
        "error",
        handleWindowError,
      );

      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, [pathname]);


  return null;
}