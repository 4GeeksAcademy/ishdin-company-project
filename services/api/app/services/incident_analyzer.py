import csv
from collections import Counter
from io import StringIO
from typing import TextIO

from app.models.incidents import IncidentAnalysisResult


# ---------------------------------------------------------------------------
# TrackFlow validation rules.
# These are the same rules used in the Phase 1 analysis script.
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS = [
    "incident_id",
    "date",
    "country",
    "customer_type",
    "tracking_number",
    "carrier",
    "category",
    "description",
    "status",
    "customer_email",
    "satisfaction_score",
]

VALID_COUNTRIES = {"US", "ES"}

VALID_CARRIERS_BY_COUNTRY = {
    "US": {"UPS", "FEDEX", "DHL_US"},
    "ES": {"MRW", "SEUR", "DHL_ES", "LOCAL_ES"},
}

VALID_CATEGORIES = {
    "LOST_PARCEL",
    "DELAYED_DELIVERY",
    "WRONG_ADDRESS",
    "RETURN_REQUEST",
    "DAMAGE",
}

VALID_STATUSES = {"OPEN", "CLOSED", "DISCARDED"}


class IncidentFileError(ValueError):
    """Raised when the uploaded CSV cannot be analyzed."""


def clean(value: object) -> str:
    """Convert a CSV value into a safe stripped string."""
    if value is None:
        return ""
    return str(value).strip()


def validate_record(row: dict[str, str | None]) -> tuple[list[str], int | None]:
    """
    Validate one TrackFlow incident record.

    Returns:
        A tuple containing:
        - a list of validation-error reasons
        - the parsed satisfaction score, or None

    Important:
        Customer email values are checked, but never returned, logged, or exported.
    """
    reasons: list[str] = []

    country = clean(row.get("country")).upper()
    carrier = clean(row.get("carrier")).upper()
    tracking_number = clean(row.get("tracking_number"))
    category = clean(row.get("category")).upper()
    description = clean(row.get("description"))
    status = clean(row.get("status")).upper()
    customer_email = clean(row.get("customer_email"))
    score_text = clean(row.get("satisfaction_score"))

    # Country
    if country not in VALID_COUNTRIES:
        reasons.append("invalid/missing country")

    # Carrier + carrier/country relationship
    if not carrier:
        reasons.append("invalid/missing carrier or carrier-country mismatch")
    elif country in VALID_COUNTRIES:
        if carrier not in VALID_CARRIERS_BY_COUNTRY[country]:
            reasons.append("invalid/missing carrier or carrier-country mismatch")

    # Tracking number
    if not tracking_number or len(tracking_number) < 8:
        reasons.append("invalid/missing tracking number")

    # Category
    if category not in VALID_CATEGORIES:
        reasons.append("invalid/missing category")

    # Description
    if not description or len(description) < 5:
        reasons.append("too-short/empty description")

    # Status
    if status not in VALID_STATUSES:
        reasons.append("invalid/missing status")

    # Email
    if not customer_email or "@" not in customer_email:
        reasons.append("invalid/missing email")

    # Satisfaction score
    score: int | None = None

    if not score_text:
        if status == "CLOSED":
            reasons.append("CLOSED without satisfaction score")
    else:
        try:
            score = int(score_text)
            if score < 1 or score > 5:
                reasons.append("satisfaction score out of range")
        except ValueError:
            reasons.append("invalid satisfaction score (must be integer 1-5)")

    return reasons, score


def analyze_csv_stream(stream: TextIO) -> IncidentAnalysisResult:
    """
    Analyze an already-open CSV text stream.

    Only valid records contribute to category, status, country, and satisfaction
    metrics. Invalid rows are counted once as invalid records, while each
    validation problem is also counted in invalid_reasons.
    """
    category_counts: Counter[str] = Counter()
    status_counts: Counter[str] = Counter()
    country_counts: Counter[str] = Counter()
    invalid_reason_counts: Counter[str] = Counter()

    total_records = 0
    valid_records = 0
    invalid_records = 0

    closed_score_total = 0
    closed_score_count = 0

    try:
        reader = csv.DictReader(stream, strict=True)

        if reader.fieldnames is None:
            raise IncidentFileError(
                "The CSV file is empty or does not contain a header row."
            )

        # Normalize only the header whitespace. Field names themselves must
        # still match the TrackFlow CONTEXT exactly.
        reader.fieldnames = [
            clean(name) if name is not None else ""
            for name in reader.fieldnames
        ]

        missing_columns = [
            column
            for column in REQUIRED_COLUMNS
            if column not in reader.fieldnames
        ]

        if missing_columns:
            raise IncidentFileError(
                "Incorrect CSV format. Missing required column(s): "
                + ", ".join(missing_columns)
            )

        for row in reader:
            total_records += 1

            reasons, score = validate_record(row)

            if reasons:
                invalid_records += 1
                for reason in reasons:
                    invalid_reason_counts[reason] += 1
                continue

            valid_records += 1

            country = clean(row["country"]).upper()
            category = clean(row["category"]).upper()
            status = clean(row["status"]).upper()

            country_counts[country] += 1
            category_counts[category] += 1
            status_counts[status] += 1

            if status == "CLOSED" and score is not None:
                closed_score_total += score
                closed_score_count += 1

    except csv.Error as exc:
        raise IncidentFileError(
            f"Incorrect CSV format: {exc}"
        ) from exc

    if total_records == 0:
        raise IncidentFileError(
            "The CSV file contains a header but no incident records."
        )

    if closed_score_count:
        average_satisfaction = round(
            closed_score_total / closed_score_count,
            2,
        )
    else:
        average_satisfaction = 0.0

    # Return every TrackFlow category/status/country even when its count is 0.
    # This gives the frontend a stable JSON shape.
    return IncidentAnalysisResult(
        total_records=total_records,
        valid_records=valid_records,
        invalid_records=invalid_records,
        category_breakdown={
            "LOST_PARCEL": category_counts["LOST_PARCEL"],
            "DELAYED_DELIVERY": category_counts["DELAYED_DELIVERY"],
            "WRONG_ADDRESS": category_counts["WRONG_ADDRESS"],
            "RETURN_REQUEST": category_counts["RETURN_REQUEST"],
            "DAMAGE": category_counts["DAMAGE"],
        },
        status_breakdown={
            "OPEN": status_counts["OPEN"],
            "CLOSED": status_counts["CLOSED"],
            "DISCARDED": status_counts["DISCARDED"],
        },
        average_satisfaction=average_satisfaction,
        invalid_reasons=dict(sorted(invalid_reason_counts.items())),
        country_breakdown={
            "US": country_counts["US"],
            "ES": country_counts["ES"],
        },
    )


def build_results_csv(result: IncidentAnalysisResult) -> str:
    """Build results.csv content with one row per metric."""
    output = StringIO(newline="")
    writer = csv.writer(output)

    writer.writerow(["metric", "value"])
    writer.writerow(["total_records_processed", result.total_records])
    writer.writerow(["valid_records", result.valid_records])
    writer.writerow(["invalid_records", result.invalid_records])

    for category in [
        "LOST_PARCEL",
        "DELAYED_DELIVERY",
        "WRONG_ADDRESS",
        "RETURN_REQUEST",
        "DAMAGE",
    ]:
        writer.writerow(
            [
                f"category_{category}",
                result.category_breakdown[category],
            ]
        )

    for status in ["OPEN", "CLOSED", "DISCARDED"]:
        writer.writerow(
            [
                f"status_{status}",
                result.status_breakdown[status],
            ]
        )

    for country in ["US", "ES"]:
        writer.writerow(
            [
                f"country_{country}",
                result.country_breakdown[country],
            ]
        )

    writer.writerow(
        [
            "average_closed_satisfaction",
            f"{result.average_satisfaction:.2f}",
        ]
    )

    for reason, count in result.invalid_reasons.items():
        safe_reason = (
            reason.lower()
            .replace(" ", "_")
            .replace("/", "_")
            .replace("-", "_")
        )
        writer.writerow([f"invalid_reason_{safe_reason}", count])

    return output.getvalue()
