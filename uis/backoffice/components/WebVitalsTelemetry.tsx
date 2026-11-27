"use client";

import { useReportWebVitals } from "next/web-vitals";

import { track } from "@/services/telemetry";


const reportedLcpIds = new Set<string>();

/*
 * During development we capture every page-load measurement
 * so it is easy to test.
 *
 * In production we sample 25% to avoid excessive telemetry.
 */
const PAGE_LOAD_SAMPLE_RATE =
  process.env.NODE_ENV === "production"
    ? 0.25
    : 1;


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


type WebVitalsCallback =
  Parameters<typeof useReportWebVitals>[0];


const handleWebVitals: WebVitalsCallback = (
  metric,
) => {
  /*
   * Next.js reports several metrics:
   *
   * TTFB
   * FCP
   * LCP
   * CLS
   * INP
   *
   * Our approved TrackFlow event is specifically
   * page_load_recorded, so we use LCP as the
   * page-load/render milestone.
   */
  if (metric.name !== "LCP") {
    return;
  }

  /*
   * Prevent the same LCP measurement from being
   * recorded more than once.
   */
  if (reportedLcpIds.has(metric.id)) {
    return;
  }

  reportedLcpIds.add(metric.id);


  /*
   * Production sampling.
   */
  if (
    Math.random() >
    PAGE_LOAD_SAMPLE_RATE
  ) {
    return;
  }


  let pathname =
    window.location.pathname;

  /*
   * navigationURL is useful for Next.js client-side
   * navigation. We extract ONLY the pathname.
   *
   * We never send the raw URL to telemetry.
   */
  if (metric.navigationURL) {
    try {
      pathname =
        new URL(
          metric.navigationURL,
          window.location.origin,
        ).pathname;
    } catch {
      // Fall back to current pathname.
    }
  }


  const sectionName =
    sectionNameFromPath(pathname);

  /*
   * Only approved major TrackFlow sections
   * are recorded.
   */
  if (!sectionName) {
    return;
  }


  track(
    "page_load_recorded",
    {
      section_name: sectionName,

      /*
       * LCP value is measured in milliseconds.
       */
      load_ms: Math.max(
        0,
        Math.round(metric.value),
      ),
    },
  );
};


export default function WebVitalsTelemetry() {
  useReportWebVitals(
    handleWebVitals,
  );

  return null;
}