import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_invalid_status_returns_422(auth_headers):
    payload = {
        "name": "Test Supplier",
        "country": "USA",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 5.25,
        "currency": "USD",
        "status": "pending",
    }

    response = client.post("/suppliers", json=payload, headers=auth_headers())

    assert response.status_code == 422


def test_zero_rate_returns_422(auth_headers):
    payload = {
        "name": "Test Supplier",
        "country": "USA",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 0,
        "currency": "USD",
        "status": "active",
    }

    response = client.post("/suppliers", json=payload, headers=auth_headers())

    assert response.status_code == 422


def test_country_currency_mismatch_returns_422(auth_headers):
    payload = {
        "name": "Test Supplier",
        "country": "Spain",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 5,
        "currency": "USD",
        "status": "active",
    }

    response = client.post("/suppliers", json=payload, headers=auth_headers())

    assert response.status_code == 422


def test_authenticated_crud_and_filters(auth_headers, supplier_payload, isolated_storage):
    headers = auth_headers()
    response = client.post(
        "/suppliers", json={**supplier_payload, "owner_id": 2}, headers=headers,
    )
    assert response.status_code == 201
    supplier_id = response.json()["id"]
    assert "owner_id" not in response.json()
    assert "owner_id" not in isolated_storage[1].get(doc_id=supplier_id)
    path = f"/suppliers/{supplier_id}"
    assert client.get(path, headers=headers).status_code == 200
    assert len(client.get("/suppliers", headers=headers).json()) == 1
    assert len(client.get(
        "/suppliers?country=USA&category=carrier_last_mile", headers=headers,
    ).json()) == 1
    assert client.get("/suppliers?country=Spain", headers=headers).json() == []
    rate = client.patch(path + "/rate", json={"rate_per_shipment": 9}, headers=headers)
    assert rate.status_code == 200
    assert rate.json()["rate_per_shipment"] == 9
    status_response = client.patch(path + "/status", json={"status": "suspended"}, headers=headers)
    assert status_response.status_code == 200
    assert status_response.json()["updated_at"] == rate.json()["updated_at"]
    assert client.delete(path, headers=headers).status_code == 200
    assert client.get(path, headers=headers).status_code == 404


@pytest.mark.parametrize("caller", [2, 3])
def test_all_authenticated_users_can_read_and_mutate(caller, auth_headers, supplier_payload):
    supplier_id = client.post(
        "/suppliers", json=supplier_payload, headers=auth_headers(),
    ).json()["id"]
    path = f"/suppliers/{supplier_id}"
    headers = auth_headers(caller)
    assert client.get("/suppliers", headers=headers).json()[0]["id"] == supplier_id
    assert client.get(path, headers=headers).status_code == 200
    rate = client.patch(path + "/rate", json={"rate_per_shipment": 8}, headers=headers)
    assert rate.status_code == 200
    assert rate.json()["rate_per_shipment"] == 8
    status_response = client.patch(path + "/status", json={"status": "suspended"}, headers=headers)
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "suspended"
    assert client.delete(path, headers=headers).status_code == 200
    assert client.get(path, headers=auth_headers()).status_code == 404


@pytest.mark.parametrize("stored_owner_id", [None, 99])
def test_existing_suppliers_are_shared_regardless_of_owner_metadata(
    stored_owner_id, auth_headers, supplier_payload, isolated_storage,
):
    table = isolated_storage[1]
    document = {**supplier_payload, "updated_at": "2026-10-05T00:00:00+00:00"}
    if stored_owner_id is not None:
        document["owner_id"] = stored_owner_id
    supplier_id = table.insert(document)
    table.insert({**document, "name": "Different category", "categories": ["carrier_international"]})
    table.insert({**document, "name": "Different country", "country": "Spain", "currency": "EUR"})
    headers = auth_headers()
    assert len(client.get("/suppliers", headers=headers).json()) == 3
    response = client.get("/suppliers?country=USA&category=carrier_last_mile", headers=headers)
    assert response.status_code == 200
    assert [supplier["id"] for supplier in response.json()] == [supplier_id]
    assert "owner_id" not in response.json()[0]
    path = f"/suppliers/{supplier_id}"
    assert client.get(path, headers=headers).status_code == 200
    assert client.patch(path + "/rate", json={"rate_per_shipment": 8}, headers=headers).status_code == 200
    assert client.patch(path + "/status", json={"status": "suspended"}, headers=headers).status_code == 200
    assert client.delete(path, headers=headers).status_code == 200
    assert client.get("/suppliers/999", headers=headers).status_code == 404
