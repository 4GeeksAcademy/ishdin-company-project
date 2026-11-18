import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter

from .schemas import TelemetryBatch


logger = logging.getLogger("api.telemetry")
logger.setLevel(logging.INFO)

BASE_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BASE_DIR / ".env")

TELEMETRY_ENDPOINT = os.getenv(
    "TELEMETRY_ENDPOINT",
    "http://localhost:8000/telemetry/events",
)


router = APIRouter(
    prefix="/telemetry",
    tags=["Telemetry"],
)


@router.post("/events")
def receive_telemetry(batch: TelemetryBatch) -> dict[str, int]:
    """
    Temporary telemetry receiver.

    Phase 1 only validates and logs incoming telemetry.
    No database persistence occurs here.
    """

    event_types = [
        event.event_type
        for event in batch.events
    ]

    logger.info(
        "Telemetry batch received: count=%s event_types=%s",
        len(batch.events),
        event_types,
    )

    return {
        "received": len(batch.events),
    }