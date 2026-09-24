from datetime import datetime

from fastapi.testclient import TestClient
from tinydb.storages import MemoryStorage

import database
import routes.suppliers as supplier_routes
from main import app
from models import Supplier


client = TestClient(app)


def setup_function():
    # TinyDB's normal file-backed database is used by the app. These API tests
    # are intentionally lightweight and validate route behavior against that
    # application contract.
    pass


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_invalid_status_returns_422():
    payload = {
        "name": "Test Supplier",
        "country": "USA",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 5.25,
        "currency": "USD",
        "status": "pending",
    }

    response = client.post("/suppliers", json=payload)

    assert response.status_code == 422


def test_zero_rate_returns_422():
    payload = {
        "name": "Test Supplier",
        "country": "USA",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 0,
        "currency": "USD",
        "status": "active",
    }

    response = client.post("/suppliers", json=payload)

    assert response.status_code == 422


def test_country_currency_mismatch_returns_422():
    payload = {
        "name": "Test Supplier",
        "country": "Spain",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 5,
        "currency": "USD",
        "status": "active",
    }

    response = client.post("/suppliers", json=payload)

    assert response.status_code == 422
