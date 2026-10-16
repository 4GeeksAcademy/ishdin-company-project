jest.mock("@/lib/auth", () => ({
  AuthSessionError: class AuthSessionError extends Error {
    readonly status = 401;
  },
  authenticatedFetch: jest.fn(),
}));

import { authenticatedFetch } from "@/lib/auth";
import { getIncidents, IncidentApiError } from "../lib/incidentApi";

const mockedAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

describe("getIncidents utility", () => {
  beforeEach(() => {
    mockedAuthenticatedFetch.mockReset();
  });

  test("happy path: serializes incident filters and parses the incident list", async () => {
    const incidents = [
      {
        id: "7d56ad8d-685c-4835-8ab8-cc0838ac54da",
        title: "Missing parcel",
        description: "Parcel did not arrive.",
        category: "lost_parcel",
        status: "open",
        origin: "customer",
        branch: "la_office",
        created_at: "2026-10-16T12:00:00+00:00",
        updated_at: "2026-10-16T12:00:00+00:00",
      },
    ];

    mockedAuthenticatedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(incidents),
    } as unknown as Response);

    const result = await getIncidents({
      status: "open",
      origin: "customer",
      branch: "la_office",
    });

    expect(result).toEqual(incidents);
    expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
    expect(mockedAuthenticatedFetch.mock.calls[0][0]).toBe(
      "/api/incidents?status=open&origin=customer&branch=la_office",
    );

    const init = mockedAuthenticatedFetch.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Accept")).toBe("application/json");
    expect(init.cache).toBe("no-store");
  });

  test("failure mode: sanitizes server field errors before exposing them to the UI", async () => {
    mockedAuthenticatedFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        message: "internal validator details",
        fields: {
          status: "OPEN -> RESOLVED failed in transition matrix",
          title: "database detail that should not be shown",
        },
      }),
    } as unknown as Response);

    await expect(getIncidents()).rejects.toMatchObject({
      name: "IncidentApiError",
      status: 400,
      message: "Review the incident details and try again.",
      fields: {
        status: "Choose a permitted status transition.",
        title: "Enter a valid value.",
      },
    } satisfies Partial<IncidentApiError>);
  });

  test("failure mode: converts malformed success JSON into a safe IncidentApiError", async () => {
    mockedAuthenticatedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
    } as unknown as Response);

    await expect(getIncidents()).rejects.toMatchObject({
      name: "IncidentApiError",
      status: 200,
      message: "The incident service returned an invalid response. Please try again.",
    } satisfies Partial<IncidentApiError>);
  });
});
