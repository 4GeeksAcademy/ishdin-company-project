# Talent Pipeline Tracker

Internal People & Talent frontend for managing the active recruitment campaign.

## Location

Place this project at:

```text
/uis/talent-pipeline-tracker
```

## Stack

- Next.js App Router
- React
- TypeScript
- Plain CSS
- React built-in hooks only
- No Redux, Zustand, Jotai, or UI component libraries

## API

Default base URL:

```text
https://playground.4geeks.com/tracker/api/v1
```

Override it with:

```bash
NEXT_PUBLIC_TRACKER_API_BASE_URL=...
```

## Routes

- `/` — candidate list, search, filters, and new-candidate registration
- `/candidates/[id]` — full candidate detail, pipeline updates, editing, and notes

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API endpoints used

- `GET /records`
- `GET /records/:id`
- `POST /records`
- `PUT /records/:id`
- `PATCH /records/:id`
- `GET /records/:id/notes`
- `POST /records/:id/notes`
- `DELETE /records/:id/notes/:note_id`

All API calls use `async/await` and surface loading, success, and error states in the UI.
