const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

async function harness(apiBase = "http://api.example", browser = true) {
  const storage = new Map();
  const calls = [];
  const redirects = [];
  const downloads = [];
  const responses = [];
  const window = {
    sessionStorage: {
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
  for (const name of ["auth", "supplierApi", "api"]) await loadModule(name);
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

test("server-side imports do not access browser storage", async () => {
  const state = await harness("http://api.example", false);
  const auth = state.load("auth");
  assert.equal(auth.getAccessToken(), null);
  assert.throws(() => state.login(), /only be stored in the browser/);
  await assert.rejects(auth.authenticatedFetch("/suppliers"), { name: "AuthSessionError" });
  assert.equal(state.storage.size, 0);
});