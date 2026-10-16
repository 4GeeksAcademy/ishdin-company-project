jest.mock("@/lib/auth", () => ({
  AuthSessionError: class AuthSessionError extends Error {
    readonly status = 401;
  },
  authenticatedFetch: jest.fn(),
}));

import { authenticatedFetch } from "@/lib/auth";
import { listSuppliers, SupplierApiError } from "../lib/supplierApi";

const mockedAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

describe("listSuppliers utility", () => {
  beforeEach(() => {
    mockedAuthenticatedFetch.mockReset();
  });

  test("happy path: serializes supplier filters and returns parsed suppliers", async () => {
    const suppliers = [
      {
        id: 7,
        name: "West Coast Carrier",
        country: "USA",
        categories: ["carrier_last_mile"],
        rate_per_shipment: 6.5,
        currency: "USD",
        updated_at: "2026-10-16T12:00:00+00:00",
        status: "active",
      },
    ];

    mockedAuthenticatedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(suppliers),
    } as unknown as Response);

    const result = await listSuppliers({
      country: "USA",
      category: "carrier_last_mile",
    });

    expect(result).toEqual(suppliers);
    expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
    expect(mockedAuthenticatedFetch.mock.calls[0][0]).toBe(
      "/suppliers?country=USA&category=carrier_last_mile",
    );

    const init = mockedAuthenticatedFetch.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  test("failure mode: converts a server error into a safe SupplierApiError", async () => {
    mockedAuthenticatedFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn(),
    } as unknown as Response);

    await expect(listSuppliers()).rejects.toMatchObject({
      name: "SupplierApiError",
      status: 503,
      message: "The supplier service is temporarily unavailable. Please try again.",
    } satisfies Partial<SupplierApiError>);
  });

  test("failure mode: converts a transport failure without leaking the original error", async () => {
    mockedAuthenticatedFetch.mockRejectedValue(new Error("connection refused at private host"));

    await expect(listSuppliers()).rejects.toMatchObject({
      name: "SupplierApiError",
      status: 0,
      message: "We could not reach the supplier service. Check your connection and try again.",
    } satisfies Partial<SupplierApiError>);
  });
});
