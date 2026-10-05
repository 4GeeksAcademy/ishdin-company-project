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

## Authentication

The Backoffice provides `/login`, `/register`, and `/account/profile` views. The
public static Milestone 1 website and standalone Talent Pipeline Tracker are not
part of the Backoffice authentication flow.

`POST /auth/login` expects OAuth2 form fields `username` (the user's email) and
`password`; it returns `access_token`, `token_type`, and `expires_in_minutes`.
`/register` posts email, password, and optional name/phone/address to `POST /users`,
then signs in using the same credentials. The backend requires an eight-character
password and creates the profile during registration. Login and registration
store the token and its expiry in `localStorage` through `lib/auth.ts`.

The client-side route guard protects all Backoffice views except `/login` and
`/register`. The login route returns to a validated local `next` path when present,
otherwise `/`. Logout clears the token and redirects to `/login`. Every protected
API helper sends `Authorization: Bearer <token>`; `401` clears the token and
redirects to login, while `403` keeps the session active.

`/account/profile` loads the user's email and profile through `GET /auth/me`, and
saves name, phone, and address with `PUT /profiles/me`. Email is displayed but
isn't editable from this view.

Browser localStorage is readable by same-origin JavaScript. Tokens are not logged
or placed in URLs. The session lasts according to `expires_in_minutes`; the backend
has no refresh-token or password-reset flow.

All six supplier helpers (`createSupplier`, `listSuppliers`, `getSupplier`,
`updateSupplierRate`, `updateSupplierStatus`, `deleteSupplier`) and both incident
helpers attach the bearer token. Multipart uploads keep the browser-generated
boundary; CSV export uses an authenticated fetch followed by the existing blob
download. Suppliers are shared among authenticated users. Incident export belongs
to the creator of the latest successful analysis; another user's successful
analysis replaces it and makes export forbidden for the prior owner.

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

When the frontend calls FastAPI on port 8000 directly, FastAPI must allow
`http://localhost:3000` through CORS.

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
