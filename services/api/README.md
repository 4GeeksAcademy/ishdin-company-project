# TrackFlow Incident Analysis API

Phase 2 backend for the TrackFlow incident-file analysis project.

## Technology

- Python
- FastAPI
- Uvicorn
- No database
- Latest analysis is stored in process memory

## Folder

This backend belongs under:

```text
/services/api
```

## Endpoints

### `POST /api/incidents/analyze`

Accepts a CSV file as `multipart/form-data`.

Form field:

```text
file
```

Example frontend call:

```ts
const formData = new FormData();
formData.append("file", file);

await fetch("http://localhost:8000/api/incidents/analyze", {
  method: "POST",
  body: formData,
});
```

The endpoint:

1. checks that a `.csv` file was supplied;
2. rejects an empty file;
3. validates the TrackFlow CSV headers;
4. applies the same Phase 1 record-validation rules;
5. calculates metrics using only valid records;
6. stores the latest analysis in memory;
7. returns the summary as JSON.

JSON shape:

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
  "status_breakdown": {
    "OPEN": 29,
    "CLOSED": 52,
    "DISCARDED": 14
  },
  "average_satisfaction": 3.06,
  "invalid_reasons": {
    "CLOSED without satisfaction score": 1,
    "invalid/missing carrier or carrier-country mismatch": 1,
    "invalid/missing category": 1,
    "invalid/missing email": 1,
    "invalid/missing tracking number": 1
  },
  "country_breakdown": {
    "US": 50,
    "ES": 45
  }
}
```

The numeric example above is the expected TrackFlow 100-row test result.

### `GET /api/incidents/results/export`

Returns the most recent successful analysis as a downloadable:

```text
results.csv
```

If there has not yet been an analysis, it returns HTTP `404`.

### `GET /health`

Simple health check:

```json
{"status": "ok"}
```

## Validation rules

Expected fields:

```text
incident_id
date
country
customer_type
tracking_number
carrier
category
description
status
customer_email
satisfaction_score
```

TrackFlow rules implemented:

- country: `US` or `ES`
- US carriers: `UPS`, `FEDEX`, `DHL_US`
- ES carriers: `MRW`, `SEUR`, `DHL_ES`, `LOCAL_ES`
- categories:
  - `LOST_PARCEL`
  - `DELAYED_DELIVERY`
  - `WRONG_ADDRESS`
  - `RETURN_REQUEST`
  - `DAMAGE`
- statuses:
  - `OPEN`
  - `CLOSED`
  - `DISCARDED`
- tracking number: present and at least 8 characters
- description: present and at least 5 characters
- customer email: present and contains `@`
- satisfaction score, when present: integer `1` to `5`
- `CLOSED` records must contain a satisfaction score
- invalid records are excluded from category/status/country/satisfaction metrics

The API validates email presence/format only. Individual email values are never
returned in JSON and never written to the exported CSV.

## Run locally

From `services/api`:

### 1. Create a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Start FastAPI

```bash
uvicorn app.main:app --reload --port 8000
```

API:

```text
http://localhost:8000
```

Swagger UI:

```text
http://localhost:8000/docs
```

## Connect the Next.js frontend

In `/uis/backoffice/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Then the browser talks to:

```text
Next.js: http://localhost:3000
FastAPI: http://localhost:8000
```

CORS is already configured to allow:

```text
http://localhost:3000
http://127.0.0.1:3000
```

## Run tests

Install development dependencies:

```bash
pip install -r requirements-dev.txt
```

Then:

```bash
pytest
```

## In-memory storage note

`GET /api/incidents/results/export` downloads the latest result held by the
current FastAPI process.

Restarting the FastAPI server clears that result. This is intentional for this
project because no database is required.

For a future production system with multiple FastAPI workers, persistent/shared
storage would be needed for "latest analysis" state.
