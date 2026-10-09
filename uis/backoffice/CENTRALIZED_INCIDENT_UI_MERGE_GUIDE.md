# Centralized Incident Manager — Frontend merge guide

This package is designed for the existing:

```text
/uis/backoffice
```

Next.js App Router + TypeScript + Tailwind application.

## Routes created

```text
/incidents
/incidents/new
```

### `/incidents`

Contains:

- Summary panel
- Incident list
- Status/origin/branch filters
- Direct lifecycle status update
- Status-update rollback on API failure
- Loading, retry, API-error, and empty states

### `/incidents/new`

Contains:

- Incident registration form
- Exact TrackFlow category/status/origin/branch values
- Always-visible required branch
- Branch emphasis when origin is `branch`
- Submit loading state
- Disabled submit during request
- Field-level API validation errors
- Success confirmation
- Form reset after success

## Files

```text
app/incidents/page.tsx
app/incidents/new/page.tsx

components/incidents/
├── IncidentNav.tsx
├── IncidentRegistrationForm.tsx
├── IncidentListPanel.tsx
└── IncidentSummaryPanel.tsx

lib/
├── incidentApi.ts
└── incidentConstants.ts

types/
└── incident.ts
```

## API base URL

Create or update:

```text
/uis/backoffice/.env.local
```

Local example:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

For Codespaces, use the forwarded **backend port 8000** URL, for example:

```text
NEXT_PUBLIC_API_BASE_URL=https://<your-codespace>-8000.app.github.dev
```

Restart `npm run dev` after changing `.env.local`.

## Authentication

The Incident Manager backend is protected by the AUTH-01 bearer-token
dependency.

The API client currently checks browser local storage using:

```text
access_token
token
```

If your existing login frontend stores the JWT using a different key, change
only `getAccessToken()` in:

```text
lib/incidentApi.ts
```

Do not duplicate token-reading logic across components.

## Existing application menu

Do not replace the existing sidebar/navbar.

Use the small example in:

```text
integration_examples/sidebar-link.tsx
```

to add:

```text
Incident Management -> /incidents
Register Incident   -> /incidents/new
```

## Required backend endpoints

```text
POST   /api/incidents
GET    /api/incidents
GET    /api/incidents/summary
PATCH  /api/incidents/{id}/status
```

The list UI calls the backend with these optional filters:

```text
status
origin
branch
```

## Status update behavior

The UI only offers legal next states:

```text
open -> in_progress
open -> discarded
in_progress -> resolved
in_progress -> discarded
```

`resolved` and `discarded` display as final statuses.

The row changes optimistically. If the API call fails, the UI automatically
restores the previous status and displays a user-friendly error.

## API error handling

The UI recognizes the backend field-error shape:

```json
{
  "error": "validation_error",
  "message": "Please correct the highlighted fields.",
  "fields": {
    "title": "This field is required."
  }
}
```

Raw stack traces or raw response text are intentionally never rendered.

## Empty and failure states

- Empty registry -> explanatory message
- Filters with zero matches -> explanatory message + Clear filters
- List fetch failure -> error + Retry
- Summary failure -> isolated error + Retry
- Slow requests -> independent loading states
- Failed status update -> rollback + notification

A list/summary failure does not break the rest of the page.
