import {
  AUTH_SESSION_KEY,
  AuthSessionError,
  authenticatedFetch,
  clearAuthSession,
  getAccessToken,
  getPostLoginPath,
  logout,
  setAuthSession,
} from "../lib/auth";

type StorageMap = Map<string, string>;

function makeBrowser(search = "", pathname = "/dashboard") {
  const values: StorageMap = new Map();
  const replace = jest.fn();
  const localStorage = {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => values.set(key, value)),
    removeItem: jest.fn((key: string) => values.delete(key)),
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage,
      location: {
        pathname,
        search,
        origin: "http://localhost:3000",
        replace,
      },
    },
  });

  return { values, localStorage, replace };
}

beforeEach(() => {
  jest.restoreAllMocks();
  makeBrowser();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { fetch?: unknown }).fetch;
});

test("setAuthSession stores a valid bearer session", () => {
  const { values } = makeBrowser();

  setAuthSession({
    access_token: "abc.def.ghi",
    token_type: "bearer",
    expires_in_minutes: 30,
  });

  const stored = JSON.parse(values.get(AUTH_SESSION_KEY) as string);
  expect(stored.accessToken).toBe("abc.def.ghi");
  expect(stored.expiresAt).toBeGreaterThan(Date.now());
});

test.each([
  { access_token: "", token_type: "bearer", expires_in_minutes: 30 },
  { access_token: "abc def", token_type: "bearer", expires_in_minutes: 30 },
  { access_token: "abc", token_type: "basic", expires_in_minutes: 30 },
  { access_token: "abc", token_type: "bearer", expires_in_minutes: 0 },
])("setAuthSession rejects invalid token responses", (token) => {
  expect(() => setAuthSession(token)).toThrow("Invalid login token response");
});

test("setAuthSession reports browser storage failure without leaking details", () => {
  const { localStorage } = makeBrowser();
  localStorage.setItem.mockImplementation(() => {
    throw new Error("disk details should not escape");
  });

  expect(() =>
    setAuthSession({ access_token: "abc", token_type: "bearer", expires_in_minutes: 30 })
  ).toThrow("Your browser could not store the login session");
});

test("getAccessToken returns an unexpired stored token", () => {
  const { values } = makeBrowser();
  values.set(
    AUTH_SESSION_KEY,
    JSON.stringify({ accessToken: "valid-token", expiresAt: Date.now() + 60_000 })
  );

  expect(getAccessToken()).toBe("valid-token");
});

test("getAccessToken clears and rejects an expired session", () => {
  const { values, localStorage } = makeBrowser();
  values.set(
    AUTH_SESSION_KEY,
    JSON.stringify({ accessToken: "expired-token", expiresAt: Date.now() - 1 })
  );

  expect(getAccessToken()).toBeNull();
  expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_SESSION_KEY);
});

test("getAccessToken returns null when storage cannot be read", () => {
  const { localStorage } = makeBrowser();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  localStorage.getItem.mockImplementation(() => {
    throw new Error("storage unavailable");
  });

  expect(getAccessToken()).toBeNull();
  expect(console.warn).toHaveBeenCalled();
});

test("clearAuthSession removes the session", () => {
  const { values, localStorage } = makeBrowser();
  values.set(AUTH_SESSION_KEY, "stored");

  clearAuthSession();

  expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_SESSION_KEY);
  expect(values.has(AUTH_SESSION_KEY)).toBe(false);
});

test("getPostLoginPath accepts a safe same-origin relative path", () => {
  makeBrowser("?next=%2Fsuppliers%3Fcountry%3DUSA", "/login");

  expect(getPostLoginPath()).toBe("/suppliers?country=USA");
});

test.each([
  "?next=https%3A%2F%2Fevil.example",
  "?next=%2F%2Fevil.example",
  "?next=%2Flogin",
  "?next=%2Fregister",
  "?next=%2F%5Cevil",
])("getPostLoginPath rejects unsafe destinations", (search) => {
  makeBrowser(search, "/login");
  expect(getPostLoginPath()).toBe("/");
});

test("authenticatedFetch adds the bearer token for a protected request", async () => {
  makeBrowser();
  setAuthSession({ access_token: "signed-token", token_type: "bearer", expires_in_minutes: 30 });
  const response = { status: 200 } as Response;
  const fetchMock = jest.fn().mockResolvedValue(response);
  (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch;

  const result = await authenticatedFetch("/profiles/me", { method: "GET" });

  expect(result).toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, request] = fetchMock.mock.calls[0];
  const headers = request.headers as Headers;
  expect(headers.get("Authorization")).toBe("Bearer signed-token");
  expect(request.redirect).toBe("error");
});

test("authenticatedFetch rejects a missing session and redirects to login", async () => {
  const { replace } = makeBrowser("?tab=security", "/account/profile");

  await expect(authenticatedFetch("/profiles/me")).rejects.toBeInstanceOf(AuthSessionError);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace.mock.calls[0][0]).toContain("/login?");
});

test("authenticatedFetch clears the session after a backend 401", async () => {
  const { values, replace } = makeBrowser();
  setAuthSession({ access_token: "signed-token", token_type: "bearer", expires_in_minutes: 30 });
  (globalThis as { fetch?: typeof fetch }).fetch = jest
    .fn()
    .mockResolvedValue({ status: 401 } as Response) as typeof fetch;

  await authenticatedFetch("/profiles/me");

  expect(values.has(AUTH_SESSION_KEY)).toBe(false);
  expect(replace).toHaveBeenCalled();
});

test("logout clears storage and redirects to login", () => {
  const { values, replace } = makeBrowser();
  values.set(AUTH_SESSION_KEY, "stored");

  logout();

  expect(values.has(AUTH_SESSION_KEY)).toBe(false);
  expect(replace).toHaveBeenCalledWith("/login");
});
