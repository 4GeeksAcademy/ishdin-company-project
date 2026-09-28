# TrackFlow Supplier Management API

Backend location:

```text
/services/api
```

## Technology

- FastAPI
- TinyDB
- Pydantic
- Uvicorn

## Run

From `/services/api`:

```bash
uv sync
uv run uvicorn main:app --reload --port 8000
```

The FastAPI startup lifecycle automatically runs the idempotent supplier
seeder. On a fresh database it inserts the 15 TrackFlow CONTEXT suppliers.

You can also run the seeder manually:

```bash
uv run seed
```

## Useful URLs

```text
http://localhost:8000/health
http://localhost:8000/docs
```

## Endpoints

```text
POST   /suppliers
GET    /suppliers
GET    /suppliers/{id}
PATCH  /suppliers/{id}/rate
PATCH  /suppliers/{id}/status
DELETE /suppliers/{id}
```

### Filter examples

```text
GET /suppliers?country=USA
GET /suppliers?country=Spain
GET /suppliers?category=carrier_last_mile
GET /suppliers?country=Spain&category=carrier_last_mile
```

## Validation

Pydantic rejects invalid requests before database code executes.

Examples that return HTTP 422:

- missing `country`
- country other than `USA` or `Spain`
- status other than `active` or `suspended`
- empty category list
- category outside the TrackFlow category list
- `rate_per_shipment <= 0`
- `USA` with a currency other than `USD`
- `Spain` with a currency other than `EUR`

`updated_at` is system-generated. `PATCH /suppliers/{id}/rate` refreshes it
automatically whenever a rate changes.

## Frontend

Set the existing `/uis/backoffice` environment variable:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

In GitHub Codespaces, use the forwarded port-8000 URL instead.
