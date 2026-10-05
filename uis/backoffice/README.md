# TrackFlow Backoffice - Incident Analysis Frontend

Stack: Next.js App Router, React, TypeScript, Tailwind CSS, component-level React state only.

## Pages
- `/` Dashboard
- `/incident-analysis` Incident CSV upload, summary, validation errors, CSV export

## Backend contract expected by this frontend

### POST `/api/incidents/analyze`
Send `multipart/form-data` with field name `file`.

Expected JSON shape:
```json
{
  "total_records": 100,
  "valid_records": 95,
  "invalid_records": 5,
  "category_breakdown": {
    "LOST_PARCEL": 14,
    "DELAYED_DELIVERY": 38,
    "WRONG_ADDRESS": 19,
    "RETURN_REQUEST": 17,
    "DAMAGE": 7
  },
  "status_breakdown": {"OPEN": 29, "CLOSED": 52, "DISCARDED": 14},
  "average_satisfaction": 3.06,
  "invalid_reasons": {"invalid/missing tracking number": 1},
  "country_breakdown": {"US": 50, "ES": 45}
}
```

### GET `/api/incidents/results/export`
Returns the latest analysis as downloadable CSV.

## Authentication integration

Supplier and incident helpers share the browser-only session utilities in
`lib/auth.ts`. Login UI, dashboard route guards, and logout are intentionally
handled separately, not implemented here.

After a successful `POST /auth/login`, the separate login implementation must
pass the JSON token response to `setAuthSession`:

```ts
import { setAuthSession } from "@/lib/auth";

const response = await fetch(`${apiBaseUrl}/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ username: email, password }),
});
if (!response.ok) throw new Error("Login failed.");
setAuthSession(await response.json());
```

The response must contain `access_token`, bearer `token_type`, and positive
`expires_in_minutes`. The helper writes `trackflow.auth.session` to
`sessionStorage` as `{ accessToken, expiresAt }`; use the helper rather than
writing that record directly. It survives tab reloads, expires according to the
login response, and clears when the browser tab session ends. Browser storage
can be accessed by same-origin JavaScript; tokens must not be logged or put in URLs.

All six supplier helpers (`createSupplier`, `listSuppliers`, `getSupplier`,
`updateSupplierRate`, `updateSupplierStatus`, `deleteSupplier`) and both incident
helpers attach the same `Authorization: Bearer <token>` automatically. Multipart
uploads keep the browser-generated boundary, and CSV export uses an authenticated
fetch followed by the existing blob download.

Missing/expired sessions stop the protected request and navigate to
`/login?next=<encoded local path and query>`. API `401` clears the stored session
and redirects once, without retrying the operation. API `403` preserves the
session and surfaces access denied. The login route must be supplied separately
and must validate `next` as a same-origin local path before navigating after login;
until that route is provided, a redirect to it will reach a missing page.

Suppliers are shared: any logged-in user can list, read, create, update, or delete
records, including legacy/seeded records without `owner_id`. Country/category
filters apply to all suppliers; no supplier ownership check is performed. Incident export
belongs to the creator of the one globally latest successful analysis; another
user's successful analysis replaces it and makes export forbidden for the prior owner.

Focused checks (Node.js 22.13+):

```bash
node --experimental-vm-modules --test tests/auth.test.cjs
npx tsc --noEmit
npm run build
```

## What "host" means
A host is the machine/domain that serves an application. In local development, the frontend is commonly `http://localhost:3000` and FastAPI is `http://localhost:8000`. Same computer, but different ports, so the browser treats them as different origins.

The frontend uses `NEXT_PUBLIC_API_BASE_URL` so both setups work.

Create `.env.local`:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

If both frontend and backend are later served under the same origin, leave the variable blank and relative `/api/...` URLs are used.

## Run
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open `http://localhost:3000/incident-analysis`.

When the frontend calls FastAPI on port 8000 directly, FastAPI must allow `http://localhost:3000` through CORS. We can add that in the backend phase.

## Talent Pipeline Tracker navigation

The sidebar's **Talent Pipeline Tracker** link opens the standalone tracker's
candidate-list landing page in the same tab. It defaults to `http://localhost:3001/`.

To run both apps locally, use separate terminals from the repository root:

```bash
npm --prefix uis/backoffice run dev -- --port 3000
npm --prefix uis/talent-pipeline-tracker run dev -- --port 3001
```

Run `npm install` in each app directory first if dependencies are not installed.

For deployment or Codespaces, set the browser-accessible tracker landing URL in
the Backoffice's `.env.local` or hosting environment:

```bash
NEXT_PUBLIC_TALENT_PIPELINE_TRACKER_URL=https://your-tracker-host.example/
```

In Codespaces, the default is automatically resolved to the forwarded HTTPS URL
for port 3001 using `CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`.
Make sure port 3001 is forwarded in VS Code's Ports panel and the tracker is running.
An explicit `NEXT_PUBLIC_TALENT_PIPELINE_TRACKER_URL` takes precedence over this default.
Restart the Backoffice dev server after changing this variable. For production,
set it before `npm run build` and rebuild when changing the destination, because
Next.js embeds public environment variables at build time.
