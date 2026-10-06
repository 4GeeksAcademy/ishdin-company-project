const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

test("reset token survives effect replay after removal from the URL", () => {
  const babel = require("next/dist/compiled/babel/core");
  const filename = path.join(__dirname, "..", "app", "reset-password", "ResetPasswordForm.tsx");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    babelrc: false,
    configFile: false,
    presets: [[require.resolve("next/babel"), {
      "preset-env": { modules: "commonjs" },
      "preset-react": { runtime: "automatic" },
    }]],
  });

  for (const search of ["?token=opaque.reset.token", ""]) {
    const effects = [];
    const values = [];
    const historyState = { nextRouter: true };
    const window = {
      location: { search },
      history: {
        state: historyState,
        replaceState: (state, _title, url) => {
          assert.equal(state, historyState);
          assert.equal(url, "/reset-password");
          window.location.search = "";
        },
      },
    };
    const exports = {};
    vm.runInNewContext(code, {
      exports, window, URLSearchParams,
      require: (name) => {
        if (name === "react") return {
          useState: (initial) => {
            const index = values.push(initial) - 1;
            return [initial, (value) => { values[index] = value; }];
          },
          useRef: (initial) => ({ current: initial }),
          useEffect: (effect) => effects.push(effect),
        };
        if (name === "next/navigation") return { useRouter: () => ({}) };
        if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
        if (name.startsWith("@babel/runtime/")) return require(name);
        return {};
      },
    });
    exports.default();
    effects[0]();
    effects[0]();
    assert.equal(values[0], search ? "opaque.reset.token" : "");
    assert.equal(values[1], true);
    assert.equal(window.location.search, "");
  }
});

async function harness(apiBase = "http://api.example", browser = true) {
  const storage = new Map();
  const calls = [];
  const redirects = [];
  const downloads = [];
  const responses = [];
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    location: {
      origin: "http://dashboard.example",
      pathname: "/suppliers",
      search: "?country=USA",
      replace: (url) => redirects.push(url),
    },
  };
  const context = {
    window, Headers, URL, URLSearchParams, FormData, File, Date,
    process: { env: { NEXT_PUBLIC_API_BASE_URL: apiBase } },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return responses.shift() ?? new Response("{}", { headers: { "Content-Type": "application/json" } });
    },
    document: {
      body: { appendChild: () => {} },
      createElement: () => {
        const anchor = { click: () => downloads.push(anchor.download), remove: () => {} };
        return anchor;
      },
    },
  };
  if (!browser) delete context.window;
  const sandbox = vm.createContext(context);
  const modules = new Map();
  async function loadModule(name) {
    if (modules.has(name)) return modules.get(name);
    const filename = path.join(__dirname, "..", "lib", `${name}.ts`);
    const code = stripTypeScriptTypes(fs.readFileSync(filename, "utf8"));
    const module = new vm.SourceTextModule(code, { context: sandbox, identifier: filename });
    modules.set(name, module);
    await module.link((specifier) => loadModule(specifier.replace("@/lib/", "")));
    await module.evaluate();
    return module;
  }
  for (const name of ["auth", "supplierApi", "api", "accountApi"]) await loadModule(name);
  const load = (name) => modules.get(name).namespace;
  const auth = load("auth");
  const login = () => auth.setAuthSession({
    access_token: "test-token", token_type: "bearer", expires_in_minutes: 30,
  });
  return { auth, load, login, storage, calls, responses, redirects, downloads, window, context };
}

test("a login session authenticates every supplier and incident operation", async () => {
  const state = await harness();
  state.login();
  const suppliers = state.load("supplierApi");
  const incidents = state.load("api");
  await suppliers.createSupplier({ name: "Test" });
  await suppliers.listSuppliers({ country: "USA" });
  await suppliers.getSupplier(1);
  await suppliers.updateSupplierRate(1, 8);
  await suppliers.updateSupplierStatus(1, "suspended");
  await suppliers.deleteSupplier(1);
  await incidents.analyzeIncidentsCsv(new File(["csv"], "incidents.csv"));
  state.responses.push(new Response("metric,value\ntotal,1", { headers: { "Content-Type": "text/csv" } }));
  await incidents.downloadLatestResults();
  assert.equal(state.calls.length, 8);
  for (const call of state.calls) {
    assert.equal(call.init.headers.get("Authorization"), "Bearer test-token");
    assert.equal(call.init.redirect, "error");
    assert.ok(call.url.startsWith("http://api.example/"));
  }
  assert.equal(state.calls[0].init.headers.get("Content-Type"), "application/json");
  assert.equal(state.calls[6].init.headers.has("Content-Type"), false);
  assert.ok(state.calls[6].init.body instanceof FormData);
  assert.deepEqual(state.downloads, ["results.csv"]);
});

test("stored session survives module reload", async () => {
  const state = await harness();
  state.login();
  const reloaded = await harness();
  for (const [key, value] of state.storage) reloaded.storage.set(key, value);
  assert.equal(reloaded.auth.getAccessToken(), "test-token");
});

test("absent session redirects once and never makes a protected request", async () => {
  const state = await harness();
  await assert.rejects(state.auth.authenticatedFetch("/suppliers"), { name: "AuthSessionError" });
  await assert.rejects(state.auth.authenticatedFetch("/suppliers"), { name: "AuthSessionError" });
  assert.equal(state.calls.length, 0);
  assert.deepEqual(state.redirects, ["/login?next=%2Fsuppliers%3Fcountry%3DUSA"]);
});

test("expired or malformed storage is cleared", async () => {
  for (const stored of ["invalid-json", "null", JSON.stringify({ accessToken: "test-token", expiresAt: 0 })]) {
    const state = await harness();
    state.storage.set("trackflow.auth.session", stored);
    await assert.rejects(state.auth.authenticatedFetch("/suppliers"), { name: "AuthSessionError" });
    assert.equal(state.storage.size, 0);
    assert.equal(state.calls.length, 0);
  }
});

test("401 clears session and redirects without retrying", async () => {
  const state = await harness();
  state.login();
  state.responses.push(new Response('{"detail":"Invalid credentials"}', { status: 401 }));
  await assert.rejects(state.load("supplierApi").createSupplier({ name: "Test" }), { status: 401 });
  assert.equal(state.storage.size, 0);
  assert.equal(state.calls.length, 1);
  assert.equal(state.redirects.length, 1);
});

test("403 preserves session and displays backend denial for supplier and export", async () => {
  const state = await harness();
  state.login();
  for (const operation of [
    () => state.load("supplierApi").getSupplier(1),
    () => state.load("api").downloadLatestResults(),
  ]) {
    state.responses.push(new Response('{"detail":"Access denied"}', { status: 403 }));
    await assert.rejects(operation(), { message: "Access denied" });
    assert.equal(state.auth.getAccessToken(), "test-token");
    assert.equal(state.redirects.length, 0);
  }
});

test("401 on upload and export clears session", async () => {
  for (const operation of [
    (api) => api.analyzeIncidentsCsv(new File(["csv"], "incidents.csv")),
    (api) => api.downloadLatestResults(),
  ]) {
    const state = await harness();
    state.login();
    state.responses.push(new Response('{"detail":"Sign in again"}', { status: 401 }));
    await assert.rejects(operation(state.load("api")), { message: "Sign in again" });
    assert.equal(state.storage.size, 0);
    assert.equal(state.redirects.length, 1);
  }
});

test("does not redirect from login and resumes after a new login", async () => {
  const state = await harness();
  state.window.location.pathname = "/login";
  await assert.rejects(state.auth.authenticatedFetch("/suppliers"));
  assert.equal(state.redirects.length, 0);
  state.login();
  assert.equal((await state.auth.authenticatedFetch("/suppliers")).status, 200);
});

test("cannot leak bearer tokens to another origin", async () => {
  const state = await harness("");
  state.login();
  await assert.rejects(state.auth.authenticatedFetch("https://evil.example/suppliers"));
  await assert.rejects(state.auth.authenticatedFetch("//evil.example/suppliers"));
  assert.equal(state.calls.length, 0);
  assert.equal((await state.auth.authenticatedFetch("/suppliers")).status, 200);
  assert.equal(state.calls[0].url, "http://dashboard.example/suppliers");
});

test("authoritative bearer header replaces caller token and preserves other headers", async () => {
  const state = await harness();
  state.login();
  await state.auth.authenticatedFetch("/suppliers", {
    headers: new Headers({ Authorization: "Bearer wrong-token", "X-Request-ID": "test" }),
  });
  assert.equal(state.calls[0].init.headers.get("Authorization"), "Bearer test-token");
  assert.equal(state.calls[0].init.headers.get("X-Request-ID"), "test");
});

test("invalid login responses do not create a session", async () => {
  const state = await harness();
  for (const response of [
    { access_token: "", token_type: "bearer", expires_in_minutes: 30 },
    { access_token: "token", token_type: "bearer", expires_in_minutes: -1 },
    { access_token: "token", token_type: "other", expires_in_minutes: 30 },
  ]) assert.throws(() => state.auth.setAuthSession(response));
  assert.equal(state.storage.size, 0);
});

test("post-login return path is local and defaults to dashboard", async () => {
  const state = await harness();
  assert.equal(state.auth.getPostLoginPath(), "/");
  state.window.location.search = "?next=%2Fsuppliers%3Fcountry%3DUSA";
  assert.equal(state.auth.getPostLoginPath(), "/suppliers?country=USA");
  for (const next of ["https://evil.example", "//evil.example", "/login", "/register", "/\\evil.example"]) {
    state.window.location.search = `?next=${encodeURIComponent(next)}`;
    assert.equal(state.auth.getPostLoginPath(), "/");
  }
});

test("logout clears local storage and redirects to login", async () => {
  const state = await harness();
  state.login();
  state.auth.logout();
  assert.equal(state.storage.size, 0);
  assert.deepEqual(state.redirects, ["/login"]);
});

test("server-side imports do not access browser storage", async () => {
  const state = await harness("http://api.example", false);
  const auth = state.load("auth");
  assert.equal(auth.getAccessToken(), null);
  assert.throws(() => state.login(), /only be stored in the browser/);
  await assert.rejects(auth.authenticatedFetch("/suppliers"), { name: "AuthSessionError" });
  assert.equal(state.storage.size, 0);
});

test("login sends the backend OAuth2 form contract", async () => {
  const state = await harness();
  state.responses.push(new Response(JSON.stringify({
    access_token: "login-token", token_type: "bearer", expires_in_minutes: 30,
  }), { headers: { "Content-Type": "application/json" } }));
  const token = await state.load("accountApi").loginUser("person@example.com", "test-password");
  assert.equal(token.access_token, "login-token");
  assert.equal(state.calls[0].url, "http://api.example/auth/login");
  assert.equal(state.calls[0].init.method, "POST");
  assert.equal(state.calls[0].init.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(state.calls[0].init.redirect, "error");
  assert.equal(state.calls[0].init.body.toString(), "username=person%40example.com&password=test-password");
});

test("registration sends optional profile fields and maps field validation", async () => {
  const state = await harness();
  state.responses.push(new Response("{}", { status: 201 }));
  await state.load("accountApi").registerUser({
    email: "person@example.com", password: "test-password", name: "Test Person", phone: "123", address: "Main St",
  });
  assert.equal(state.calls[0].url, "http://api.example/users");
  assert.equal(state.calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(state.calls[0].init.redirect, "error");
  assert.deepEqual(JSON.parse(state.calls[0].init.body), {
    email: "person@example.com", password: "test-password", name: "Test Person", phone: "123", address: "Main St",
  });

  state.responses.push(new Response(JSON.stringify({ detail: [
    { loc: ["body", "email"], msg: "Invalid email" },
    { loc: ["body", "password"], msg: "Too short" },
  ] }), { status: 422 }));
  await assert.rejects(
    state.load("accountApi").registerUser({ email: "x", password: "short" }),
    (error) => error.fieldErrors.email === "Invalid email" && error.fieldErrors.password === "Too short",
  );
});

test("registration can create an account, log in, and persist the returned token", async () => {
  const state = await harness();
  state.responses.push(
    new Response(JSON.stringify({ user: { id: 2 }, profile: { id: 2 } }), { status: 201 }),
    new Response(JSON.stringify({ access_token: "registered-token", token_type: "bearer", expires_in_minutes: 30 })),
  );
  const api = state.load("accountApi");
  await api.registerUser({ email: "new@example.com", password: "password123", name: "New User" });
  const token = await api.loginUser("new@example.com", "password123");
  state.auth.setAuthSession(token);
  assert.equal(state.calls[0].url, "http://api.example/users");
  assert.equal(state.calls[1].url, "http://api.example/auth/login");
  assert.equal(state.auth.getAccessToken(), "registered-token");
});

test("account endpoints use bearer auth and preserve response data", async () => {
  const state = await harness();
  state.login();
  state.responses.push(new Response(JSON.stringify({
    id: 1, email: "person@example.com", role: "user",
    profile: { id: 1, user_id: 1, name: "Test", phone: null, address: null },
  }), { headers: { "Content-Type": "application/json" } }));
  const account = await state.load("accountApi").getCurrentAccount();
  assert.equal(account.email, "person@example.com");

  state.responses.push(new Response(JSON.stringify({
    id: 1, user_id: 1, name: "Updated", phone: "123", address: "Main St",
  }), { headers: { "Content-Type": "application/json" } }));
  const profile = await state.load("accountApi").updateMyProfile({ name: "Updated", phone: "123", address: "Main St" });
  assert.equal(profile.name, "Updated");
  assert.equal(state.calls[0].url, "http://api.example/auth/me");
  assert.equal(state.calls[1].url, "http://api.example/profiles/me");
  assert.equal(state.calls[1].init.headers.get("Authorization"), "Bearer test-token");
  assert.deepEqual(JSON.parse(state.calls[1].init.body), { name: "Updated", phone: "123", address: "Main St" });
});

test("forgot and reset requests are public and send their secrets only in JSON bodies", async () => {
  const state = await harness();
  state.login();
  state.responses.push(
    new Response(JSON.stringify({ detail: "If that address is registered, you'll receive a link shortly." })),
    new Response(JSON.stringify({ detail: "Password reset successfully." })),
  );
  const api = state.load("accountApi");
  await api.requestPasswordReset("person@example.com");
  await api.resetPassword("opaque.reset.token", "new-password");

  assert.equal(state.calls[0].url, "http://api.example/auth/forgot-password");
  assert.equal(state.calls[1].url, "http://api.example/auth/reset-password");
  for (const call of state.calls) {
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers.Authorization, undefined);
    assert.equal(call.init.redirect, "error");
  }
  assert.deepEqual(JSON.parse(state.calls[0].init.body), { email: "person@example.com" });
  assert.deepEqual(JSON.parse(state.calls[1].init.body), {
    token: "opaque.reset.token", new_password: "new-password",
  });
  assert.ok(!state.calls[1].url.includes("opaque.reset.token"));
});

test("invalid or expired reset responses surface the backend error without sending the token in a URL", async () => {
  const state = await harness();
  state.responses.push(new Response(JSON.stringify({
    detail: "The reset token is invalid, expired, or already used.",
  }), { status: 400 }));
  await assert.rejects(
    state.load("accountApi").resetPassword("stale-token", "new-password"),
    (error) => error.status === 400 && error.message.includes("expired"),
  );
  assert.equal(state.calls[0].url, "http://api.example/auth/reset-password");
  assert.equal(state.calls[0].init.headers.Authorization, undefined);
});

test("change password uses bearer authorization and sends the documented fields", async () => {
  const state = await harness();
  state.login();
  state.responses.push(new Response(JSON.stringify({ detail: "Password changed successfully." })));
  await state.load("accountApi").changePassword("current-password", "new-password");
  assert.equal(state.calls[0].url, "http://api.example/auth/change-password");
  assert.equal(state.calls[0].init.headers.get("Authorization"), "Bearer test-token");
  assert.deepEqual(JSON.parse(state.calls[0].init.body), {
    current_password: "current-password", new_password: "new-password",
  });
});

test("wrong current password keeps the current session available for retry", async () => {
  const state = await harness();
  state.login();
  state.responses.push(new Response(JSON.stringify({ detail: "The current password is incorrect." }), { status: 400 }));
  await assert.rejects(
    state.load("accountApi").changePassword("wrong-password", "new-password"),
    (error) => error.status === 400 && error.message.includes("current password"),
  );
  assert.equal(state.auth.getAccessToken(), "test-token");
  assert.equal(state.redirects.length, 0);
});