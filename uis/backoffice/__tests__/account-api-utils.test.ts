jest.mock("@/lib/auth", () => ({
  API_BASE_URL: "http://localhost:8000",
  authenticatedFetch: jest.fn(),
}));

import { AccountApiError, loginUser } from "../lib/accountApi";

describe("loginUser utility", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  test("happy path: builds the login request and parses the token response", async () => {
    const token = {
      access_token: "signed.jwt.token",
      token_type: "bearer",
      expires_in_minutes: 30,
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(token),
    } as unknown as Response);
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch;

    const result = await loginUser("user@example.com", "Password123");

    expect(result).toEqual(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/auth/login");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });

    const body = init.body as URLSearchParams;
    expect(body.get("username")).toBe("user@example.com");
    expect(body.get("password")).toBe("Password123");
  });

  test("failure mode: rejects a malformed successful API response with a safe error", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError("broken response body")),
    } as unknown as Response);
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch;

    await expect(loginUser("user@example.com", "Password123")).rejects.toMatchObject({
      name: "AccountApiError",
      status: 200,
      message: "The server returned an invalid response. Please try again.",
    } satisfies Partial<AccountApiError>);
  });

  test("failure mode: converts a network failure into AccountApiError without leaking details", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("socket details must not escape"));
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch;

    await expect(loginUser("user@example.com", "Password123")).rejects.toMatchObject({
      name: "AccountApiError",
      status: 0,
      message: "We could not reach the account service. Check your connection and try again.",
    } satisfies Partial<AccountApiError>);
  });
});
