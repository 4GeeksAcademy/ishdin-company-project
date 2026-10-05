from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.services.result_store import clear_latest_result, get_latest_result, save_latest_result
from auth.security import JWT_ALGORITHM, get_jwt_secret, hash_password
from main import app as supplier_app


client = TestClient(app)


@pytest.fixture(autouse=True)
def authenticate_existing_client(auth_headers):
    client.headers.update(auth_headers())
    yield
    client.headers.pop("Authorization", None)


HEADER = (
    "incident_id,date,country,customer_type,tracking_number,carrier,"
    "category,description,status,customer_email,satisfaction_score\n"
)
VALID_CSV = HEADER + (
    "TRF-000002,2024-01-11,ES,B2C,IEQFB85P8637,MRW,"
    "DAMAGE,Outer box crushed and product damaged,CLOSED,"
    "person2@example.com,2\n"
)


def test_auth_routes_are_listed_in_openapi() -> None:
    paths = app.openapi()["paths"]

    assert {"post", "get"} <= paths["/users"].keys()
    assert {"get", "put"} <= paths["/profiles/me"].keys()
    assert "post" in paths["/auth/login"]


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


@pytest.mark.parametrize("caller", [2, 3])
def test_export_is_owner_only(caller, auth_headers):
    files = {"file": ("incidents.csv", VALID_CSV, "text/csv")}
    assert client.post("/api/incidents/analyze", files=files).status_code == 200
    assert client.get(
        "/api/incidents/results/export", headers=auth_headers(caller),
    ).status_code == 403
    assert client.get("/api/incidents/results/export").status_code == 200


def test_latest_analysis_replaces_owner_and_failed_requests_preserve_cache(auth_headers):
    files = {"file": ("incidents.csv", VALID_CSV, "text/csv")}
    assert client.post("/api/incidents/analyze", files=files).status_code == 200
    before = get_latest_result()
    assert client.post(
        "/api/incidents/analyze", files=files, headers={"Authorization": "Bearer invalid"},
    ).status_code == 401
    assert client.post(
        "/api/incidents/analyze", headers=auth_headers(2),
        files={"file": ("empty.csv", b"", "text/csv")},
    ).status_code == 400
    assert get_latest_result() == before
    assert client.post("/api/incidents/analyze", files=files, headers=auth_headers(2)).status_code == 200
    assert client.get("/api/incidents/results/export").status_code == 403
    assert client.get("/api/incidents/results/export", headers=auth_headers(2)).status_code == 200


def test_owned_cache_copies_and_clears_results():
    assert client.post(
        "/api/incidents/analyze", files={"file": ("incidents.csv", VALID_CSV, "text/csv")},
    ).status_code == 200
    owner_id, result = get_latest_result()
    result.total_records = 42
    assert get_latest_result()[1].total_records == 1
    save_latest_result(result, owner_id)
    result.total_records = 99
    assert get_latest_result()[1].total_records == 42
    clear_latest_result()
    assert get_latest_result() is None


PROTECTED_OPERATIONS = [
    ("POST", "/suppliers"),
    ("GET", "/suppliers"),
    ("GET", "/suppliers/1"),
    ("PATCH", "/suppliers/1/rate"),
    ("PATCH", "/suppliers/1/status"),
    ("DELETE", "/suppliers/1"),
    ("POST", "/api/incidents/analyze"),
    ("GET", "/api/incidents/results/export"),
]


@pytest.mark.parametrize("application", [app, supplier_app])
@pytest.mark.parametrize("method,path", PROTECTED_OPERATIONS)
@pytest.mark.parametrize("credential", ["absent", "malformed", "expired", "wrong_signature", "inactive", "deleted"])
def test_protected_operations_require_valid_user(
    application, method, path, credential, auth_headers, supplier_payload, isolated_storage,
):
    headers = {}
    if credential == "malformed":
        headers = {"Authorization": "Bearer invalid"}
    elif credential in {"expired", "wrong_signature"}:
        expires = datetime.now(timezone.utc) + timedelta(minutes=-1 if credential == "expired" else 30)
        token = jwt.encode(
            {"sub": "1", "exp": expires},
            "wrong-test-secret" if credential == "wrong_signature" else get_jwt_secret(),
            algorithm=JWT_ALGORITHM,
        )
        headers = {"Authorization": f"Bearer {token}"}
    elif credential in {"inactive", "deleted"}:
        headers = auth_headers()
        users = isolated_storage[0]
        if credential == "inactive":
            users.update({"is_active": False}, doc_ids=[1])
        else:
            users.remove(doc_ids=[1])
    kwargs = {"headers": headers}
    if path == "/suppliers" and method == "POST":
        kwargs["json"] = supplier_payload
    elif path.endswith("/rate"):
        kwargs["json"] = {"rate_per_shipment": 8}
    elif path.endswith("/status"):
        kwargs["json"] = {"status": "suspended"}
    elif path.endswith("/analyze"):
        kwargs["files"] = {"file": ("incidents.csv", VALID_CSV, "text/csv")}
    response = TestClient(application).request(method, path, **kwargs)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("application", [app, supplier_app])
def test_openapi_declares_security(application):
    paths = application.openapi()["paths"]
    for method, path in PROTECTED_OPERATIONS:
        documented_path = path.replace("/suppliers/1", "/suppliers/{supplier_id}")
        assert paths[documented_path][method.lower()]["security"] == [{"OAuth2PasswordBearer": []}]
    assert "security" not in paths["/auth/login"]["post"]
    assert "security" not in paths["/health"]["get"]


def test_successful_login_token_authenticates_both_domains(isolated_storage, supplier_payload):
    isolated_storage[0].update({"hashed_password": hash_password("test-password")}, doc_ids=[1])
    anonymous = TestClient(app)
    login = anonymous.post("/auth/login", data={"username": "user1@example.com", "password": "test-password"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert anonymous.post("/suppliers", json=supplier_payload, headers=headers).status_code == 201
    assert anonymous.get("/suppliers", headers=headers).status_code == 200
    assert anonymous.post(
        "/api/incidents/analyze", headers=headers,
        files={"file": ("incidents.csv", VALID_CSV, "text/csv")},
    ).status_code == 200
    assert anonymous.get("/api/incidents/results/export", headers=headers).status_code == 200
