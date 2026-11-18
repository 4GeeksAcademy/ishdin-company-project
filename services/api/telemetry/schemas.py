from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TelemetryEvent(BaseModel):
    """
    Standard TrackFlow telemetry event envelope.

    These field names intentionally match the approved telemetry contract.
    """

    model_config = ConfigDict(extra="forbid")

    eventId: UUID
    timestamp: datetime
    sessionId: str | None
    userId: str | None

    event_type: str = Field(min_length=1)

    schemaVersion: str = Field(min_length=1)

    requestId: str | None

    properties: dict[str, Any]


class TelemetryBatch(BaseModel):
    """
    HTTP body accepted by POST /telemetry/events.
    """

    model_config = ConfigDict(extra="forbid")

    events: list[TelemetryEvent]