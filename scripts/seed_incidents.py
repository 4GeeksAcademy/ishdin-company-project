from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.shared.incident_csv import (  # noqa: E402
    SeedTransformError,
    transform_analyzer_row,
    validate_analyzer_row,
)
from services.api.incidents.models import IncidentStored  # noqa: E402
from services.api.incidents.seed_store import (  # noqa: E402
    DEFAULT_DB_PATH,
    IncidentSeedStore,
)


EXPECTED_TOTAL_VALID = 95

EXPECTED_STATUS_COUNTS = {
    "open": 29,
    "resolved": 52,
    "discarded": 14,
}

EXPECTED_CATEGORY_COUNTS = {
    "lost_parcel": 14,
    "carrier_issue": 45,
    "delivery_failure": 19,
    "returns_issue": 17,
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate, transform, and seed TrackFlow historical incidents."
        )
    )

    parser.add_argument(
        "csv_path",
        type=Path,
        help="Path to the previous project's incidents-trackflow.csv file.",
    )

    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=(
            "TinyDB destination. Defaults to "
            "services/api/data/incidents.json."
        ),
    )

    return parser


def print_invalid_rows(invalid_rows: list[dict]) -> None:
    if not invalid_rows:
        print("\nInvalid rows: 0")
        return

    print("\nINVALID / DISCARDED ROWS")
    print("-" * 72)

    for item in invalid_rows:
        print(
            f"Row {item['row_number']} "
            f"({item['identifier']}):"
        )

        for issue in item["issues"]:
            print(
                f"  - {issue['field']}: {issue['message']}"
            )


def verify_expected_transformed_counts(
    valid_count: int,
    status_counts: Counter,
    category_counts: Counter,
) -> None:
    print("\nCONTEXT VERIFICATION")
    print("-" * 72)

    checks = [
        (
            "Valid transformed incidents",
            valid_count,
            EXPECTED_TOTAL_VALID,
        )
    ]

    for status, expected in EXPECTED_STATUS_COUNTS.items():
        checks.append(
            (
                f"Status {status}",
                status_counts[status],
                expected,
            )
        )

    for category, expected in EXPECTED_CATEGORY_COUNTS.items():
        checks.append(
            (
                f"Category {category}",
                category_counts[category],
                expected,
            )
        )

    all_passed = True

    for label, actual, expected in checks:
        if actual == expected:
            print(f"PASS  {label}: {actual}")
        else:
            all_passed = False
            print(
                f"WARN  {label}: actual={actual}, expected={expected}"
            )

    if all_passed:
        print(
            "\nAll transformed counts match the TrackFlow CONTEXT."
        )
    else:
        print(
            "\nOne or more transformed counts do not match the "
            "TrackFlow CONTEXT."
        )


def seed(csv_path: Path, db_path: Path) -> int:
    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        return 1

    if not csv_path.is_file():
        print(f"Error: CSV path is not a file: {csv_path}")
        return 1

    total_rows = 0
    valid_transformed = 0
    inserted = 0
    duplicates = 0

    invalid_rows: list[dict] = []

    status_counts: Counter = Counter()
    category_counts: Counter = Counter()
    origin_counts: Counter = Counter()
    branch_counts: Counter = Counter()

    store = IncidentSeedStore(db_path)

    try:
        with csv_path.open(
            "r",
            newline="",
            encoding="utf-8-sig",
        ) as handle:
            reader = csv.DictReader(handle)

            if reader.fieldnames is None:
                print("Error: CSV has no header row.")
                return 1

            for row_number, row in enumerate(reader, start=2):
                total_rows += 1

                identifier = (
                    str(row.get("incident_id") or "").strip()
                    or f"row-{row_number}"
                )

                validation_issues = validate_analyzer_row(row)

                if validation_issues:
                    invalid_rows.append(
                        {
                            "row_number": row_number,
                            "identifier": identifier,
                            "issues": [
                                {
                                    "field": issue.field,
                                    "message": issue.message,
                                }
                                for issue in validation_issues
                            ],
                        }
                    )
                    continue

                try:
                    seed_incident = transform_analyzer_row(row)
                except SeedTransformError as exc:
                    invalid_rows.append(
                        {
                            "row_number": row_number,
                            "identifier": identifier,
                            "issues": [
                                {
                                    "field": exc.field,
                                    "message": exc.message,
                                }
                            ],
                        }
                    )
                    continue

                valid_transformed += 1

                status_counts[seed_incident.status] += 1
                category_counts[seed_incident.category] += 1
                origin_counts[seed_incident.origin] += 1
                branch_counts[seed_incident.branch] += 1

                incident = IncidentStored(
                    title=seed_incident.title,
                    description=seed_incident.description,
                    category=seed_incident.category,
                    status=seed_incident.status,
                    origin=seed_incident.origin,
                    branch=seed_incident.branch,
                    created_at=seed_incident.created_at,
                    updated_at=seed_incident.updated_at,
                )

                was_inserted = store.insert_seed_incident(
                    seed_incident.source_key,
                    incident,
                )

                if was_inserted:
                    inserted += 1
                else:
                    duplicates += 1

    except (OSError, csv.Error) as exc:
        print(f"Error while reading CSV: {exc}")
        return 1

    finally:
        store.close()

    print("\n" + "=" * 72)
    print("TRACKFLOW CENTRALIZED INCIDENT MANAGER — HISTORICAL SEED")
    print("=" * 72)
    print(f"{'CSV rows processed':40} {total_rows:>8}")
    print(f"{'Valid transformed rows':40} {valid_transformed:>8}")
    print(f"{'Invalid / discarded rows':40} {len(invalid_rows):>8}")
    print(f"{'Inserted into database':40} {inserted:>8}")
    print(f"{'Skipped as duplicates':40} {duplicates:>8}")

    print("\nTRANSFORMED STATUS COUNTS")
    print("-" * 72)
    for status in ["open", "resolved", "discarded"]:
        print(f"{status:40} {status_counts[status]:>8}")

    print("\nTRANSFORMED CATEGORY COUNTS")
    print("-" * 72)
    for category in [
        "lost_parcel",
        "carrier_issue",
        "delivery_failure",
        "returns_issue",
    ]:
        print(f"{category:40} {category_counts[category]:>8}")

    print("\nORIGIN COUNTS")
    print("-" * 72)
    print(f"{'customer':40} {origin_counts['customer']:>8}")

    print("\nBRANCH COUNTS")
    print("-" * 72)
    for branch in ["la_office", "zaragoza_office"]:
        print(f"{branch:40} {branch_counts[branch]:>8}")

    print_invalid_rows(invalid_rows)

    if total_rows == 100:
        verify_expected_transformed_counts(
            valid_transformed,
            status_counts,
            category_counts,
        )
    else:
        print(
            "\nCONTEXT VERIFICATION skipped: "
            f"reference CSV has 100 rows; this file has {total_rows}."
        )

    print(f"\nDatabase: {db_path}")
    return 0


def main() -> None:
    args = build_parser().parse_args()
    raise SystemExit(seed(args.csv_path, args.db))


if __name__ == "__main__":
    main()
