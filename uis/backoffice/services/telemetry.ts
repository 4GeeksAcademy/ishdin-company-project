import {
  AUTH_SESSION_ID_KEY,
  getAccessToken,
} from "@/lib/auth";

const TELEMETRY_ENDPOINT =
  process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT?.trim();

const SCHEMA_VERSION = "1.0";

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH_SIZE = 20;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;


interface TelemetryEvent {
  eventId: string;
  timestamp: string;
  sessionId: string | null;
  userId: string | null;
  event_type: string;
  schemaVersion: string;
  requestId: string;
  properties: Record<string, unknown>;
}


interface TelemetryBatch {
  events: TelemetryEvent[];
}


let queue: TelemetryEvent[] = [];

let flushTimer: ReturnType<typeof setInterval> | null = null;

let flushInProgress = false;

let listenersInstalled = false;

let memorySessionId: string | null = null;


function createUuid(): string {
  return globalThis.crypto.randomUUID();
}


function getSessionId(): string {
  if (memorySessionId) {
    return memorySessionId;
  }

  if (typeof window !== "undefined") {
    try {
      const existing =
        window.sessionStorage?.getItem(AUTH_SESSION_ID_KEY);

      if (existing) {
        memorySessionId = existing;
        return existing;
      }

      const created = createUuid();

      window.sessionStorage?.setItem(
        AUTH_SESSION_ID_KEY,
        created,
      );

      memorySessionId = created;

      return created;
    } catch {
      // Telemetry must never interrupt the application.
    }
  }

  memorySessionId = createUuid();

  return memorySessionId;
}


function getAuthenticatedUserId(): string | null {
  const token = getAccessToken();

  if (!token || typeof window === "undefined") {
    return null;
  }

  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const base64Url = parts[1];

    const base64 = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(
        base64Url.length + ((4 - (base64Url.length % 4)) % 4),
        "=",
      );

    const payload = JSON.parse(
      window.atob(base64),
    ) as {
      sub?: unknown;
    };

    if (
      typeof payload.sub === "string" &&
      payload.sub.trim()
    ) {
      return payload.sub;
    }

    if (
      typeof payload.sub === "number" &&
      Number.isFinite(payload.sub)
    ) {
      return String(payload.sub);
    }
  } catch {
    // Never expose JWT contents or decoding errors.
  }

  return null;
}


function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}


async function sendBatch(
  batch: TelemetryEvent[],
): Promise<boolean> {
  if (!TELEMETRY_ENDPOINT || batch.length === 0) {
    return false;
  }

  const payload: TelemetryBatch = {
    events: batch,
  };

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt += 1
  ) {
    try {
      const response = await fetch(
        TELEMETRY_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),

          // Allows the browser to continue a small request
          // while a page is being unloaded.
          keepalive: true,
        },
      );

      if (response.ok) {
        return true;
      }
    } catch {
      // Retry below.
    }

    if (attempt < MAX_RETRIES) {
      const delay =
        INITIAL_RETRY_DELAY_MS * 2 ** attempt;

      await wait(delay);
    }
  }

  console.warn(
    `TrackFlow telemetry batch discarded after ${MAX_RETRIES} retries.`,
  );

  return false;
}


async function flush(): Promise<void> {
  if (
    flushInProgress ||
    queue.length === 0 ||
    !TELEMETRY_ENDPOINT
  ) {
    return;
  }

  flushInProgress = true;

  /*
   * Remove only the events that existed when this flush began.
   * Events generated while the request is running remain in queue.
   */
  const batch = queue.splice(
    0,
    MAX_BATCH_SIZE,
  );

  try {
    await sendBatch(batch);
  } finally {
    flushInProgress = false;
  }

  /*
   * More than 20 events may have accumulated while sending.
   */
  if (queue.length >= MAX_BATCH_SIZE) {
    void flush();
  }
}


function flushWithBeacon(): void {
  if (
    typeof window === "undefined" ||
    queue.length === 0 ||
    !TELEMETRY_ENDPOINT ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return;
  }

  const batch = queue.splice(0, queue.length);

  const payload: TelemetryBatch = {
    events: batch,
  };

  const body = new Blob(
    [JSON.stringify(payload)],
    {
      type: "application/json",
    },
  );

  const accepted = navigator.sendBeacon(
    TELEMETRY_ENDPOINT,
    body,
  );

  /*
   * sendBeacon() returning false means the browser
   * refused to queue the request.
   */
  if (!accepted) {
    queue.unshift(...batch);
  }
}


function ensureServiceStarted(): void {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  if (!flushTimer) {
    flushTimer = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);
  }

  if (!listenersInstalled) {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") {
          flushWithBeacon();
        }
      },
    );

    listenersInstalled = true;
  }
}


/**
 * The ONLY public API for TrackFlow frontend telemetry.
 *
 * Components provide only:
 * - event type
 * - schema-approved properties
 *
 * Envelope metadata is added automatically.
 */
export function track(
  eventType: string,
  properties: Record<string, unknown>,
): void {
  if (
    typeof window === "undefined" ||
    !TELEMETRY_ENDPOINT
  ) {
    return;
  }

  const normalizedEventType =
    eventType.trim();

  if (!normalizedEventType) {
    return;
  }

  ensureServiceStarted();

  const telemetryEvent: TelemetryEvent = {
    eventId: createUuid(),
    timestamp: new Date().toISOString(),

    sessionId: getSessionId(),

    userId: getAuthenticatedUserId(),

    event_type: normalizedEventType,

    schemaVersion: SCHEMA_VERSION,

    requestId: createUuid(),

    properties,
  };

  queue.push(telemetryEvent);

  if (queue.length >= MAX_BATCH_SIZE) {
    void flush();
  }
}