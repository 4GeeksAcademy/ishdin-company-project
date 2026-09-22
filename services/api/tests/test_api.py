from fastapi.testclient import TestClient

from app.main import app
from app.services.result_store import clear_latest_result


client = TestClient(app)


HEADER = (
    "incident_id,date,country,customer_type,tracking_number,carrier,"
    "category,description,status,customer_email,satisfaction_score\n"
)


def setup_function() -> None:
    clear_latest_result()


def test_analyze_valid_csv() -> None:
    content = HEADER + (
        "TRF-000001,2024-01-08,ES,B2C,2YKCCPRHVLZO,LOCAL_ES,"
        "RETURN_REQUEST,Return requested within window,OPEN,"
        "person1@example.com,\n"
        "TRF-000002,2024-01-11,ES,B2C,IEQFB85P8637,MRW,"
        "DAMAGE,Outer box crushed and product damaged,CLOSED,"
        "person2@example.com,2\n"
    )

    response = client.post(
        "/api/incidents/analyze",
        files={"file": ("incidents-trackflow.csv", content, "text/csv")},
    )

    assert response.status_code == 200

    body = response.json()

    assert body["total_records"] == 2
    assert body["valid_records"] == 2
    assert body["invalid_records"] == 0
    assert body["category_breakdown"]["RETURN_REQUEST"] == 1
    assert body["category_breakdown"]["DAMAGE"] == 1
    assert body["status_breakdown"]["OPEN"] == 1
    assert body["status_breakdown"]["CLOSED"] == 1
    assert body["country_breakdown"]["ES"] == 2
    assert body["average_satisfaction"] == 2.0
    assert body["invalid_reasons"] == {}


def test_invalid_row_is_reported_and_excluded_from_metrics() -> None:
    content = HEADER + (
        "TRF-000003,2024-01-12,US,B2C,ABC,UPS,"
        "LOST_PARCEL,Parcel cannot be located,OPEN,"
        "not-an-email,\n"
    )

    response = client.post(
        "/api/incidents/analyze",
        files={"file": ("incidents-trackflow.csv", content, "text/csv")},
    )

    assert response.status_code == 200

    body = response.json()

    assert body["total_records"] == 1
    assert body["valid_records"] == 0
    assert body["invalid_records"] == 1
    assert body["category_breakdown"]["LOST_PARCEL"] == 0
    assert body["status_breakdown"]["OPEN"] == 0
    assert body["invalid_reasons"]["invalid/missing tracking number"] == 1
    assert body["invalid_reasons"]["invalid/missing email"] == 1


def test_rejects_empty_file() -> None:
    response = client.post(
        "/api/incidents/analyze",
        files={"file": ("incidents-trackflow.csv", b"", "text/csv")},
    )

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_rejects_wrong_extension() -> None:
    response = client.post(
        "/api/incidents/analyze",
        files={"file": ("incidents.txt", "hello", "text/plain")},
    )

    assert response.status_code == 400
    assert ".csv" in response.json()["detail"]


def test_rejects_missing_required_columns() -> None:
    content = "incident_id,status\nTRF-1,OPEN\n"

    response = client.post(
        "/api/incidents/analyze",
        files={"file": ("bad.csv", content, "text/csv")},
    )

    assert response.status_code == 400
    assert "missing required column" in response.json()["detail"].lower()


def test_export_requires_previous_analysis() -> None:
    response = client.get("/api/incidents/results/export")

    assert response.status_code == 404


def test_export_returns_latest_analysis_as_csv() -> None:
    content = HEADER + (
        "TRF-000002,2024-01-11,ES,B2C,IEQFB85P8637,MRW,"
        "DAMAGE,Outer box crushed and product damaged,CLOSED,"
        "person2@example.com,2\n"
    )

    analyze_response = client.post(
        "/api/incidents/analyze",
        files={"file": ("incidents-trackflow.csv", content, "text/csv")},
    )
    assert analyze_response.status_code == 200

    response = client.get("/api/incidents/results/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert 'filename="results.csv"' in response.headers["content-disposition"]

    text = response.text
    assert "metric,value" in text
    assert "total_records_processed,1" in text
    assert "category_DAMAGE,1" in text
    assert "average_closed_satisfaction,2.00" in text
    assert "person2@example.com" not in text
