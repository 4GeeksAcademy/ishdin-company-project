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
