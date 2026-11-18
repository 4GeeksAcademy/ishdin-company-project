import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request
from uuid import uuid4

from dotenv import load_dotenv

from services.api.telemetry.schemas import (
    TelemetryBatch,
    TelemetryEvent,
)


logger = logging.getLogger("api.telemetry.emitter")


BASE_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BASE_DIR / ".env")


TELEMETRY_ENDPOINT = os.getenv(
    "TELEMETRY_ENDPOINT",
    "http://localhost:8000/telemetry/events",
)


def track_server_event(
    *,
    event_type: str,
    properties: dict,
    user_id: str | None,
    request_id: str | None,
) -> None:
    """
    Best-effort telemetry for events whose authoritative
    source is the FastAPI backend.

    Telemetry failures must never affect business behavior.
    """

    event = TelemetryEvent(
        eventId=uuid4(),
        timestamp=datetime.now(timezone.utc),
        sessionId=None,
        userId=user_id,
        event_type=event_type,
        schemaVersion="1.0",
        requestId=request_id,
        properties=properties,
    )

    batch = TelemetryBatch(
        events=[event],
    )

    body = json.dumps(
        batch.model_dump(mode="json"),
    ).encode("utf-8")

    telemetry_request = request.Request(
        TELEMETRY_ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(
            telemetry_request,
            timeout=2,
        ) as response:
            if response.status != 200:
                logger.warning(
                    "Server telemetry returned status=%s event_type=%s",
                    response.status,
                    event_type,
                )

    except (
        error.URLError,
        TimeoutError,
        OSError,
    ) as exc:
        logger.warning(
            "Server telemetry delivery failed "
            "event_type=%s error_type=%s",
            event_type,
            type(exc).__name__,
        )