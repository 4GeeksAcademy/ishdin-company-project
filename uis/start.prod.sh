#!/bin/sh

echo "Starting TrackFlow website on port 3000..."
cd /app/website
npm run start -- --hostname 0.0.0.0 --port 3000 &
WEBSITE_PID=$!

echo "Starting TrackFlow backoffice on port 3001..."
cd /app/backoffice
npm run start -- --hostname 0.0.0.0 --port 3001 &
BACKOFFICE_PID=$!

# Stop both applications if the container is stopped.
trap 'kill $WEBSITE_PID $BACKOFFICE_PID 2>/dev/null || true' INT TERM EXIT

# Keep the container alive while both dev servers run.
wait $WEBSITE_PID $BACKOFFICE_PID
