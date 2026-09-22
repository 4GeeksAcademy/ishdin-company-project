import argparse
import csv
from collections import Counter
from pathlib import Path


# ------------------------------------------------------------
# TrackFlow validation rules
# ------------------------------------------------------------

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


# Expected values for the TrackFlow 100-row test file.
EXPECTED_RESULTS = {
    "total_records": 100,
    "valid_records": 95,
    "invalid_records": 5,
    "categories": {
        "LOST_PARCEL": 14,
        "DELAYED_DELIVERY": 38,
        "WRONG_ADDRESS": 19,
        "RETURN_REQUEST": 17,
        "DAMAGE": 7,
    },
    "statuses": {
        "OPEN": 29,
        "CLOSED": 52,
        "DISCARDED": 14,
    },
    "countries": {
        "US": 50,
        "ES": 45,
    },
    "average_satisfaction": 3.06,
    "satisfaction_distribution": {
        1: 6,
        2: 11,
        3: 15,
        4: 14,
        5: 6,
    },
    "invalid_reasons": {
        "invalid/missing tracking number": 1,
        "invalid/missing carrier or carrier-country mismatch": 1,
        "invalid/missing category": 1,
        "invalid/missing email": 1,
        "CLOSED without satisfaction score": 1,
    },
}


def clean(value):
    """Return a safe, stripped string for a CSV value."""
    if value is None:
        return ""
    return str(value).strip()


def validate_record(row):
    """
    Validate one CSV row.

    Returns:
        reasons: list of validation error messages
        score: parsed satisfaction score (int) or None
    """
    reasons = []

    country = clean(row.get("country")).upper()
    carrier = clean(row.get("carrier")).upper()
    tracking_number = clean(row.get("tracking_number"))
    category = clean(row.get("category")).upper()
    description = clean(row.get("description"))
    status = clean(row.get("status")).upper()
    customer_email = clean(row.get("customer_email"))
    score_text = clean(row.get("satisfaction_score"))

    # 1. Country validation
    if country not in VALID_COUNTRIES:
        reasons.append("invalid/missing country")

    # 2. Carrier validation
    if not carrier:
        reasons.append("invalid/missing carrier or carrier-country mismatch")
    elif country in VALID_COUNTRIES:
        allowed_carriers = VALID_CARRIERS_BY_COUNTRY[country]
        if carrier not in allowed_carriers:
            reasons.append("invalid/missing carrier or carrier-country mismatch")

    # 3. Tracking number validation
    if not tracking_number or len(tracking_number) < 8:
        reasons.append("invalid/missing tracking number")

    # 4. Category validation
    if category not in VALID_CATEGORIES:
        reasons.append("invalid/missing category")

    # 5. Description validation
    if not description or len(description) < 5:
        reasons.append("too-short/empty description")

    # 6. Status validation
    if status not in VALID_STATUSES:
        reasons.append("invalid/missing status")

    # 7. Email validation
    # Never print, log, or export the actual customer email.
    if not customer_email or "@" not in customer_email:
        reasons.append("invalid/missing email")

    # 8. Satisfaction score validation
    score = None

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


def analyze_csv(csv_path):
    """Read the CSV, validate every record, and calculate metrics."""
    category_counts = Counter()
    status_counts = Counter()
    country_counts = Counter()
    invalid_reason_counts = Counter()
    satisfaction_distribution = Counter()

    total_records = 0
    valid_records = 0
    invalid_records = 0

    closed_score_total = 0
    closed_score_count = 0

    with csv_path.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)

        if reader.fieldnames is None:
            raise ValueError("The CSV file does not contain a header row.")

        missing_columns = [
            column for column in REQUIRED_COLUMNS
            if column not in reader.fieldnames
        ]

        if missing_columns:
            raise ValueError(
                "Missing required CSV column(s): "
                + ", ".join(missing_columns)
            )

        for row in reader:
            total_records += 1

            reasons, score = validate_record(row)

            if reasons:
                invalid_records += 1

                # A record may have more than one validation problem.
                for reason in reasons:
                    invalid_reason_counts[reason] += 1

                # Invalid rows are NOT used in the metrics below.
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
                satisfaction_distribution[score] += 1

    if closed_score_count > 0:
        average_satisfaction = closed_score_total / closed_score_count
    else:
        average_satisfaction = 0.0

    return {
        "total_records": total_records,
        "valid_records": valid_records,
        "invalid_records": invalid_records,
        "category_counts": category_counts,
        "status_counts": status_counts,
        "country_counts": country_counts,
        "invalid_reason_counts": invalid_reason_counts,
        "average_satisfaction": average_satisfaction,
        "satisfaction_distribution": satisfaction_distribution,
    }


def print_summary(results):
    """Print the analysis in a clear, readable console format."""
    print()
    print("=" * 68)
    print("TRACKFLOW INCIDENT FILE ANALYSIS")
    print("=" * 68)

    print("\nRECORD SUMMARY")
    print("-" * 68)
    print(f"{'Total records processed':40} {results['total_records']:>10}")
    print(f"{'Valid records':40} {results['valid_records']:>10}")
    print(f"{'Invalid records':40} {results['invalid_records']:>10}")

    print("\nINVALID RECORD BREAKDOWN")
    print("-" * 68)

    if results["invalid_reason_counts"]:
        for reason, count in sorted(results["invalid_reason_counts"].items()):
            print(f"{reason:55} {count:>10}")
    else:
        print("No invalid records found.")

    print("\nINCIDENT CATEGORY BREAKDOWN (VALID RECORDS)")
    print("-" * 68)
    for category in [
        "LOST_PARCEL",
        "DELAYED_DELIVERY",
        "WRONG_ADDRESS",
        "RETURN_REQUEST",
        "DAMAGE",
    ]:
        print(f"{category:40} {results['category_counts'][category]:>10}")

    print("\nSTATUS BREAKDOWN (VALID RECORDS)")
    print("-" * 68)
    for status in ["OPEN", "CLOSED", "DISCARDED"]:
        print(f"{status:40} {results['status_counts'][status]:>10}")

    # Recommended TrackFlow metric.
    print("\nCOUNTRY BREAKDOWN (VALID RECORDS)")
    print("-" * 68)
    for country in ["US", "ES"]:
        print(f"{country:40} {results['country_counts'][country]:>10}")

    print("\nSATISFACTION")
    print("-" * 68)
    print(
        f"{'Average score for valid CLOSED cases':40} "
        f"{results['average_satisfaction']:>10.2f}"
    )

    print("=" * 68)


def verify_expected_results(results):
    """
    Verify the 100-row TrackFlow test file against the known CONTEXT values.

    Production files can contain a different number of rows, so verification
    is only performed when the input contains exactly 100 records.
    """
    print("\nCONTEXT VERIFICATION")
    print("-" * 68)

    if results["total_records"] != EXPECTED_RESULTS["total_records"]:
        print(
            "Skipped: the CONTEXT reference values are for the 100-record "
            f"test file, but this file contains {results['total_records']} records."
        )
        return None

    checks = []

    checks.append((
        "Total records",
        results["total_records"],
        EXPECTED_RESULTS["total_records"],
    ))
    checks.append((
        "Valid records",
        results["valid_records"],
        EXPECTED_RESULTS["valid_records"],
    ))
    checks.append((
        "Invalid records",
        results["invalid_records"],
        EXPECTED_RESULTS["invalid_records"],
    ))

    for category, expected in EXPECTED_RESULTS["categories"].items():
        checks.append((
            f"Category {category}",
            results["category_counts"][category],
            expected,
        ))

    for status, expected in EXPECTED_RESULTS["statuses"].items():
        checks.append((
            f"Status {status}",
            results["status_counts"][status],
            expected,
        ))

    for country, expected in EXPECTED_RESULTS["countries"].items():
        checks.append((
            f"Country {country}",
            results["country_counts"][country],
            expected,
        ))

    checks.append((
        "Average satisfaction",
        round(results["average_satisfaction"], 2),
        EXPECTED_RESULTS["average_satisfaction"],
    ))

    for score, expected in EXPECTED_RESULTS["satisfaction_distribution"].items():
        checks.append((
            f"Satisfaction score {score}",
            results["satisfaction_distribution"][score],
            expected,
        ))

    for reason, expected in EXPECTED_RESULTS["invalid_reasons"].items():
        checks.append((
            f"Invalid reason: {reason}",
            results["invalid_reason_counts"][reason],
            expected,
        ))

    all_passed = True

    for label, actual, expected in checks:
        if actual == expected:
            print(f"PASS  {label}")
        else:
            all_passed = False
            print(
                f"FAIL  {label} "
                f"(actual: {actual}, expected: {expected})"
            )

    # Catch unexpected validation problems not listed in the sample CONTEXT.
    expected_invalid_reasons = set(EXPECTED_RESULTS["invalid_reasons"])

    for reason, count in results["invalid_reason_counts"].items():
        if reason not in expected_invalid_reasons and count > 0:
            all_passed = False
            print(
                f"FAIL  Unexpected invalid reason: {reason} "
                f"(count: {count})"
            )

    if all_passed:
        print("\nRESULT: All values match the TrackFlow CONTEXT.")
    else:
        print("\nRESULT: One or more values do not match the TrackFlow CONTEXT.")

    return all_passed


def export_results(results, output_file="results.csv"):
    """Export one metric per row to results.csv."""
    rows = [
        ("total_records_processed", results["total_records"]),
        ("valid_records", results["valid_records"]),
        ("invalid_records", results["invalid_records"]),
    ]

    for category in [
        "LOST_PARCEL",
        "DELAYED_DELIVERY",
        "WRONG_ADDRESS",
        "RETURN_REQUEST",
        "DAMAGE",
    ]:
        rows.append((
            f"category_{category}",
            results["category_counts"][category],
        ))

    for status in ["OPEN", "CLOSED", "DISCARDED"]:
        rows.append((
            f"status_{status}",
            results["status_counts"][status],
        ))

    for country in ["US", "ES"]:
        rows.append((
            f"country_{country}",
            results["country_counts"][country],
        ))

    rows.append((
        "average_closed_satisfaction",
        f"{results['average_satisfaction']:.2f}",
    ))

    for reason, count in sorted(results["invalid_reason_counts"].items()):
        metric_name = (
            "invalid_reason_"
            + reason.lower()
            .replace(" ", "_")
            .replace("/", "_")
            .replace("-", "_")
        )
        rows.append((metric_name, count))

    with open(output_file, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["metric", "value"])
        writer.writerows(rows)

    print(f"\nResults exported successfully to {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Validate and analyze a TrackFlow incident CSV file."
    )

    parser.add_argument(
        "csv_path",
        help="Path to the incident CSV file, e.g. incidents-trackflow.csv",
    )

    args = parser.parse_args()
    csv_path = Path(args.csv_path)

    if not csv_path.exists():
        print(f"Error: file not found: {csv_path}")
        return

    if not csv_path.is_file():
        print(f"Error: the supplied path is not a file: {csv_path}")
        return

    try:
        results = analyze_csv(csv_path)
    except (OSError, ValueError) as error:
        print(f"Error: {error}")
        return

    print_summary(results)
    verify_expected_results(results)

    while True:
        choice = input("\nExport results to CSV? [y / n]: ").strip().lower()

        if choice == "y":
            export_results(results)
            break
        elif choice == "n":
            print("Results were not exported.")
            break
        else:
            print("Please enter y or n.")


if __name__ == "__main__":
    main()
