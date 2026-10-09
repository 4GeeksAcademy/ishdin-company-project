# Centralized Incident Manager backend integration

This package extends the **existing** `/services/api` FastAPI server.

## Copy these files

```text
/packages/shared/incidents.py

/services/api/incidents/
├── __init__.py
├── models.py
├── repository.py
├── errors.py
└── routes.py
```

The historical seeder from the previous step continues to use the same:

```text
/services/api/data/incidents.json
```

TinyDB database.

## Register the router

Merge the contents of:

```text
/services/api/integration_examples/main_incident_manager_integration.py
```

into your existing `main.py`.

Continue starting the same server:

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Important route-order note

Your older Incident File Analyzer may still have:

```text
POST /api/incidents/analyze
GET  /api/incidents/results/export
```

The new manager also contains:

```text
GET /api/incidents/{incident_id}
```

Because `{incident_id}` is a dynamic route, register any older **static**
`/api/incidents/...` routers before the new manager router. This prevents a
request such as `/api/incidents/results/export` from being interpreted as an
incident ID.

Inside the new manager router, `/summary` is already declared before `/{id}`.

## Endpoints

All endpoints are protected with the existing AUTH-01 `get_current_user`
dependency because incident information is sensitive.

```text
POST   /api/incidents
GET    /api/incidents
GET    /api/incidents/summary
GET    /api/incidents/{id}
PATCH  /api/incidents/{id}/status
```

### List filters

All are optional:

```text
?status=open
?origin=customer
?branch=la_office
?category=lost_parcel
```

They can be combined:

```text
/api/incidents?status=open&origin=customer&branch=la_office
```

## Create example

```json
{
  "title": "Parcel missing after carrier handoff",
  "description": "Customer reports that tracking has not moved for three days.",
  "category": "lost_parcel",
  "status": "open",
  "origin": "customer",
  "branch": "la_office"
}
```

Successful result:

```text
201 Created
```

## Lifecycle

Allowed:

```text
open -> in_progress
open -> discarded
in_progress -> resolved
in_progress -> discarded
```

Final states:

```text
resolved
discarded
```

Example PATCH:

```json
{
  "status": "in_progress"
}
```

An invalid transition returns HTTP 400 with:

```json
{
  "error": "validation_error",
  "message": "The requested status change is not allowed.",
  "fields": {
    "status": "Status cannot change from 'resolved' to 'open'."
  }
}
```

## Error handling

### Request validation -> HTTP 400

For example, a missing title returns a field-specific response:

```json
{
  "error": "validation_error",
  "message": "Please correct the highlighted fields.",
  "fields": {
    "title": "This field is required."
  }
}
```

This handling is scoped to the Incident Manager router, so it does not
silently change the 422 behavior of unrelated Supplier/Auth exercises.

### Incident not found -> HTTP 404

```json
{
  "detail": "Incident not found."
}
```

### Unexpected exception -> HTTP 500

The server logs the technical exception, but the client sees only:

```json
{
  "error": "internal_server_error",
  "message": "Something went wrong while processing your request. Please try again."
}
```

No stack trace is returned to the browser.

## Empty database

```text
GET /api/incidents
```

returns:

```json
[]
```

and:

```text
GET /api/incidents/summary
```

returns `total: 0` plus every TrackFlow status/category/origin/branch with a
zero count.

## Summary shape

```json
{
  "total": 95,
  "by_status": {
    "open": 29,
    "in_progress": 0,
    "resolved": 52,
    "discarded": 14
  },
  "by_category": {
    "lost_parcel": 14,
    "delivery_failure": 19,
    "inventory_discrepancy": 0,
    "carrier_issue": 45,
    "returns_issue": 17,
    "warehouse_incident": 0,
    "system_failure": 0,
    "client_complaint": 0,
    "other": 0
  },
  "by_origin": {
    "customer": 95,
    "branch": 0,
    "internal": 0
  },
  "by_branch": {
    "central": 0,
    "la_warehouse": 0,
    "la_office": 50,
    "zaragoza_warehouse": 0,
    "zaragoza_office": 45
  }
}
```

The example above is the expected result immediately after seeding the
official TrackFlow historical CSV.
