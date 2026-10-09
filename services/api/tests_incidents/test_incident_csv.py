from packages.shared.incident_csv import (
    transform_analyzer_row,
    validate_analyzer_row,
)


def valid_row():
    return {
        "incident_id": "TRF-000001",
        "date": "2024-01-08",
        "country": "ES",
        "customer_type": "B2C",
        "tracking_number": "2YKCCPRHVLZ0",
        "carrier": "LOCAL_ES",
        "category": "RETURN_REQUEST",
        "description": "Return requested within 14-day window, awaiting approval",
        "status": "OPEN",
        "customer_email": "person@example.com",
        "satisfaction_score": "",
    }


def test_valid_row_has_no_issues():
    assert validate_analyzer_row(valid_row()) == []


def test_transform_matches_trackflow_context():
    transformed = transform_analyzer_row(valid_row())

    assert transformed.source_key == "incident_id:TRF-000001"
    assert transformed.status == "open"
    assert transformed.category == "returns_issue"
    assert transformed.origin == "customer"
    assert transformed.branch == "zaragoza_office"
    assert transformed.created_at.hour == 0
    assert transformed.updated_at == transformed.created_at


def test_bad_tracking_number_is_rejected():
    row = valid_row()
    row["tracking_number"] = "SHORT"

    issues = validate_analyzer_row(row)

    assert any(issue.field == "tracking_number" for issue in issues)


def test_closed_without_score_is_rejected():
    row = valid_row()
    row["status"] = "CLOSED"
    row["satisfaction_score"] = ""

    issues = validate_analyzer_row(row)

    assert any(issue.field == "satisfaction_score" for issue in issues)
