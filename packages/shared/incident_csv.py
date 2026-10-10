from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping

from packages.shared.incidents import (
    IncidentBranch,
    IncidentCategory,
    IncidentOrigin,
    IncidentStatus,
)


VALID_COUNTRIES = {"US", "ES"}

VALID_CARRIERS_BY_COUNTRY = {
    "US": {"UPS", "FEDEX", "DHL_US"},
    "ES": {"MRW", "SEUR", "DHL_ES", "LOCAL_ES"},
}

VALID_SOURCE_CATEGORIES = {
    "LOST_PARCEL",
    "DELAYED_DELIVERY",
    "WRONG_ADDRESS",
    "RETURN_REQUEST",
    "DAMAGE",
}

VALID_SOURCE_STATUSES = {
    "OPEN",
    "CLOSED",
    "DISCARDED",
}

STATUS_MAP = {
    "OPEN": IncidentStatus.OPEN.value,
    "CLOSED": IncidentStatus.RESOLVED.value,
    "DISCARDED": IncidentStatus.DISCARDED.value,
}

CATEGORY_MAP = {
    "LOST_PARCEL": IncidentCategory.LOST_PARCEL.value,
    "DELAYED_DELIVERY": IncidentCategory.CARRIER_ISSUE.value,
    "WRONG_ADDRESS": IncidentCategory.DELIVERY_FAILURE.value,
    "RETURN_REQUEST": IncidentCategory.RETURNS_ISSUE.value,
    "DAMAGE": IncidentCategory.CARRIER_ISSUE.value,
}

BRANCH_MAP = {
    "US": IncidentBranch.LA_OFFICE.value,
    "ES": IncidentBranch.ZARAGOZA_OFFICE.value,
}


@dataclass(frozen=True)
class ValidationIssue:
    field: str
    message: str


@dataclass(frozen=True)
class SeedIncident:
    source_key: str
    title: str
    description: str
    category: str
    status: str
    origin: str
    branch: str
    created_at: datetime
    updated_at: datetime


class SeedTransformError(ValueError):
    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field
        self.message = message


def clean(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def validate_analyzer_row(
    row: Mapping[str, object],
) -> list[ValidationIssue]:
    """
    Reusable validation from the previous TrackFlow incident-file analyzer.

    The manager seeder must call this before any CSV-to-model transformation.
    Customer email is validated but is never carried into the manager model.
    """
    issues: list[ValidationIssue] = []

    country = clean(row.get("country")).upper()
    carrier = clean(row.get("carrier")).upper()
    tracking_number = clean(row.get("tracking_number"))
    category = clean(row.get("category")).upper()
    description = clean(row.get("description"))
    status = clean(row.get("status")).upper()
    email = clean(row.get("customer_email"))
    score_text = clean(row.get("satisfaction_score"))

    if country not in VALID_COUNTRIES:
        issues.append(
            ValidationIssue(
                "country",
                "Country must be US or ES.",
            )
        )

    if not carrier:
        issues.append(
            ValidationIssue(
                "carrier",
                "Carrier is required.",
            )
        )
    elif country in VALID_COUNTRIES:
        if carrier not in VALID_CARRIERS_BY_COUNTRY[country]:
            issues.append(
                ValidationIssue(
                    "carrier",
                    "Carrier does not match the incident country.",
                )
            )

    if not tracking_number or len(tracking_number) < 8:
        issues.append(
            ValidationIssue(
                "tracking_number",
                "Tracking number must contain at least 8 characters.",
            )
        )

    if category not in VALID_SOURCE_CATEGORIES:
        issues.append(
            ValidationIssue(
                "category",
                "Incident category is missing or invalid.",
            )
        )

    if not description or len(description) < 5:
        issues.append(
            ValidationIssue(
                "description",
                "Description must contain at least 5 characters.",
            )
        )

    if status not in VALID_SOURCE_STATUSES:
        issues.append(
            ValidationIssue(
                "status",
                "Incident status is missing or invalid.",
            )
        )

    if not email or "@" not in email:
        issues.append(
            ValidationIssue(
                "customer_email",
                "Customer email is missing or invalid.",
            )
        )

    if not score_text:
        if status == "CLOSED":
            issues.append(
                ValidationIssue(
                    "satisfaction_score",
                    "Closed incidents require a satisfaction score.",
                )
            )
    else:
        try:
            score = int(score_text)
            if score < 1 or score > 5:
                issues.append(
                    ValidationIssue(
                        "satisfaction_score",
                        "Satisfaction score must be between 1 and 5.",
                    )
                )
        except ValueError:
            issues.append(
                ValidationIssue(
                    "satisfaction_score",
                    "Satisfaction score must be an integer from 1 to 5.",
                )
            )

    return issues


def parse_seed_date(value: object) -> datetime:
    date_text = clean(value)

    if not date_text:
        raise SeedTransformError(
            "date",
            "Date is required for historical incidents.",
        )

    try:
        parsed = datetime.strptime(date_text, "%Y-%m-%d")
    except ValueError as exc:
        raise SeedTransformError(
            "date",
            "Date must use YYYY-MM-DD format.",
        ) from exc

    return parsed.replace(tzinfo=timezone.utc)


def transform_analyzer_row(
    row: Mapping[str, object],
) -> SeedIncident:
    """
    Transform one already-validated analyzer row into the manager schema.

    This function deliberately does not call validate_analyzer_row itself so
    callers can report validation and mapping failures separately.
    """
    description_raw = "" if row.get("description") is None else str(
        row.get("description")
    )
    description_trimmed = description_raw.strip()

    if not description_trimmed:
        raise SeedTransformError(
            "description",
            "Description is empty after trimming.",
        )

    source_status = clean(row.get("status")).upper()
    source_category = clean(row.get("category")).upper()
    source_country = clean(row.get("country")).upper()

    try:
        status = STATUS_MAP[source_status]
    except KeyError as exc:
        raise SeedTransformError(
            "status",
            "Status cannot be mapped to the incident lifecycle.",
        ) from exc

    try:
        category = CATEGORY_MAP[source_category]
    except KeyError as exc:
        raise SeedTransformError(
            "category",
            "Category cannot be mapped to the manager model.",
        ) from exc

    try:
        branch = BRANCH_MAP[source_country]
    except KeyError as exc:
        raise SeedTransformError(
            "country",
            "Country cannot be mapped to a TrackFlow branch.",
        ) from exc

    created_at = parse_seed_date(row.get("date"))
    title = description_trimmed[:120]

    source_incident_id = clean(row.get("incident_id"))

    if source_incident_id:
        source_key = f"incident_id:{source_incident_id}"
    else:
        source_key = (
            f"fallback:{title}|{created_at.isoformat()}"
        )

    return SeedIncident(
        source_key=source_key,
        title=title,
        description=description_raw,
        category=category,
        status=status,
        origin=IncidentOrigin.CUSTOMER.value,
        branch=branch,
        created_at=created_at,
        updated_at=created_at,
    )
