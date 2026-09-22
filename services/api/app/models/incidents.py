from pydantic import BaseModel, Field


class IncidentAnalysisResult(BaseModel):
    """JSON contract returned to the TrackFlow backoffice frontend."""

    total_records: int = Field(ge=0)
    valid_records: int = Field(ge=0)
    invalid_records: int = Field(ge=0)

    category_breakdown: dict[str, int]
    status_breakdown: dict[str, int]
    average_satisfaction: float
    invalid_reasons: dict[str, int]
    country_breakdown: dict[str, int]
