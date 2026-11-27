describe("TelemetryService", () => {
  let fetchMock: jest.Mock;
  let sendBeaconMock: jest.Mock;
  let visibilityHandler: (() => void) | undefined;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT =
      "http://localhost:8000/telemetry/events";

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    sendBeaconMock = jest.fn().mockReturnValue(true);

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    const sessionValues = new Map<string, string>();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        sessionStorage: {
          getItem: jest.fn(
            (key: string) => sessionValues.get(key) ?? null,
          ),
          setItem: jest.fn(
            (key: string, value: string) => {
              sessionValues.set(key, value);
            },
          ),
          removeItem: jest.fn(
            (key: string) => {
              sessionValues.delete(key);
            },
          ),
        },
        localStorage: {
          getItem: jest.fn(() => null),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        atob: (value: string) =>
          Buffer.from(value, "base64").toString("binary"),
      },
    });

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        sendBeacon: sendBeaconMock,
      },
    });

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: {
        visibilityState: "visible",

        addEventListener: jest.fn(
          (
            eventName: string,
            callback: () => void,
          ) => {
            if (eventName === "visibilitychange") {
              visibilityHandler = callback;
            }
          },
        ),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();

    delete process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT;

    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { navigator?: unknown }).navigator;
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  test("queues events and sends them together after 10 seconds", async () => {
    const { track } =
      await import("../services/telemetry");

    track("section_viewed", {
      section_name: "products",
    });

    track("workflow_started", {
      workflow_name: "inbound_order",
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(10_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] =
      fetchMock.mock.calls[0];

    const body = JSON.parse(
      request.body as string,
    );

    expect(body.events).toHaveLength(2);

    expect(body.events[0].event_type)
      .toBe("section_viewed");

    expect(body.events[1].event_type)
      .toBe("workflow_started");
  });

  test("flushes immediately when queue reaches 20 events", async () => {
    const { track } =
      await import("../services/telemetry");

    for (let index = 0; index < 20; index += 1) {
      track("section_viewed", {
        section_name: "products",
      });
    }

    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] =
      fetchMock.mock.calls[0];

    const body = JSON.parse(
      request.body as string,
    );

    expect(body.events).toHaveLength(20);
  });

  test("uses sendBeacon when the page becomes hidden", async () => {
    const { track } =
      await import("../services/telemetry");

    track("section_viewed", {
      section_name: "orders",
    });

    Object.defineProperty(
      document,
      "visibilityState",
      {
        configurable: true,
        value: "hidden",
      },
    );

    expect(visibilityHandler).toBeDefined();

    visibilityHandler?.();

    expect(sendBeaconMock)
      .toHaveBeenCalledTimes(1);
  });

  test("retries failed delivery with exponential backoff", async () => {
    fetchMock
      .mockRejectedValueOnce(
        new Error("temporary failure"),
      )
      .mockRejectedValueOnce(
        new Error("temporary failure"),
      )
      .mockResolvedValue({
        ok: true,
        status: 200,
      });

    const { track } =
      await import("../services/telemetry");

    track("section_viewed", {
      section_name: "products",
    });

    await jest.advanceTimersByTimeAsync(10_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(2_000);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("automatically adds the telemetry envelope", async () => {
    const { track } =
      await import("../services/telemetry");

    track("section_viewed", {
      section_name: "products",
    });

    await jest.advanceTimersByTimeAsync(10_000);

    const [, request] =
      fetchMock.mock.calls[0];

    const body = JSON.parse(
      request.body as string,
    );

    const event = body.events[0];

    expect(event.eventId).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(event.sessionId).toBeTruthy();

    expect(event).toHaveProperty("userId");
    expect(event.event_type)
      .toBe("section_viewed");

    expect(event.schemaVersion)
      .toBe("1.0");

    expect(event.requestId).toBeTruthy();

    expect(event.properties).toEqual({
      section_name: "products",
    });
  });
});