from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

from packages.shared.incidents import (
    IncidentBranch,
    IncidentCategory,
    IncidentOrigin,
    IncidentStatus,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class IncidentBase(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1)
    category: IncidentCategory
    status: IncidentStatus = IncidentStatus.OPEN
    origin: IncidentOrigin
    branch: IncidentBranch

    @field_validator("title", "description")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank.")
        return value.strip()


class IncidentCreate(IncidentBase):
    pass


class IncidentStored(IncidentBase):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class IncidentResponse(IncidentStored):
    pass


class IncidentStatusUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    status: IncidentStatus


class IncidentSummary(BaseModel):
    total: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_category: dict[str, int] = Field(default_factory=dict)
    by_origin: dict[str, int] = Field(default_factory=dict)
    by_branch: dict[str, int] = Field(default_factory=dict)
