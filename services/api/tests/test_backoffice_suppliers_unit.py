"""API-042 unit tests for the TrackFlow supplier backoffice endpoints.

These tests call the route functions directly and replace TinyDB with an
in-memory table. They verify business decisions rather than HTTP transport or
serialization behavior.
"""

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

import routes.suppliers as supplier_routes
from auth.models import UserRole, UserStored
from models import (
    SupplierCategory,
    SupplierCountry,
    SupplierCreate,
    SupplierRateUpdate,
    SupplierStatusUpdate,
)


@pytest.fixture
def current_user() -> UserStored:
    return UserStored(
        id=101,
        email="backoffice.user@example.com",
        hashed_password="unused-test-hash",
        is_active=True,
        role=UserRole.USER,
        created_at=datetime.now(timezone.utc),
        token_version=0,
    )


@pytest.fixture
def supplier_table(monkeypatch):
    database = TinyDB(storage=MemoryStorage)
    table = database.table("suppliers")
    monkeypatch.setattr(supplier_routes, "suppliers_table", table)
    yield table
    database.close()


def supplier_payload(**overrides) -> SupplierCreate:
    data = {
        "name": "TrackFlow Carrier",
        "country": "USA",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 7.5,
        "currency": "USD",
        "status": "active",
        "service_zone": "West Coast",
        "contact_email": "ops@example.com",
        "notes": "Primary unit-test supplier",
    }
    data.update(overrides)
    return SupplierCreate(**data)


def insert_supplier(table, **overrides) -> int:
    document = {
        "name": "TrackFlow Carrier",
        "country": "USA",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 7.5,
        "currency": "USD",
        "status": "active",
        "service_zone": "West Coast",
        "contact_email": "ops@example.com",
        "notes": None,
        "updated_at": "2026-10-01T12:00:00+00:00",
    }
    document.update(overrides)
    return table.insert(document)


# ---------------------------------------------------------------------------
# POST /suppliers
# ---------------------------------------------------------------------------

def test_create_supplier_happy_path_persists_and_returns_supplier(
    supplier_table,
    current_user,
):
    result = supplier_routes.create_supplier(
        supplier_payload(),
        current_user=current_user,
    )

    assert result.id == 1
    assert result.name == "TrackFlow Carrier"
    assert result.rate_per_shipment == 7.5
    assert supplier_table.get(doc_id=1)["name"] == "TrackFlow Carrier"


def test_create_supplier_edge_case_allows_optional_fields_to_be_omitted(
    supplier_table,
    current_user,
):
    payload = supplier_payload(
        service_zone=None,
        contact_email=None,
        notes=None,
    )

    result = supplier_routes.create_supplier(payload, current_user=current_user)

    assert result.service_zone is None
    assert result.contact_email is None
    assert result.notes is None


def test_create_supplier_failure_mode_maps_storage_error_to_503(
    supplier_table,
    current_user,
    monkeypatch,
):
    def fail_insert(_document):
        raise OSError("disk unavailable")

    monkeypatch.setattr(supplier_table, "insert", fail_insert)

    with pytest.raises(HTTPException) as exc_info:
        supplier_routes.create_supplier(
            supplier_payload(),
            current_user=current_user,
        )

    assert exc_info.value.status_code == 503
    assert "temporarily unavailable" in exc_info.value.detail.lower()
    assert "disk unavailable" not in exc_info.value.detail


# ---------------------------------------------------------------------------
# GET /suppliers
# ---------------------------------------------------------------------------

def test_list_suppliers_happy_path_filters_by_country_and_category(
    supplier_table,
    current_user,
):
    matching_id = insert_supplier(supplier_table)
    insert_supplier(
        supplier_table,
        name="Spanish Carrier",
        country="Spain",
        currency="EUR",
    )
    insert_supplier(
        supplier_table,
        name="Packaging Vendor",
        categories=["packaging_materials"],
    )

    results = supplier_routes.list_suppliers(
        country=SupplierCountry.USA,
        category=SupplierCategory.CARRIER_LAST_MILE,
        current_user=current_user,
    )

    assert [item.id for item in results] == [matching_id]
    assert results[0].name == "TrackFlow Carrier"


def test_list_suppliers_edge_case_no_matching_filter_returns_empty_list(
    supplier_table,
    current_user,
):
    insert_supplier(supplier_table)

    results = supplier_routes.list_suppliers(
        country=SupplierCountry.SPAIN,
        category=None,
        current_user=current_user,
    )

    assert results == []


def test_list_suppliers_failure_mode_maps_storage_error_to_503(
    supplier_table,
    current_user,
    monkeypatch,
):
    def fail_all():
        raise ValueError("corrupt supplier store")

    monkeypatch.setattr(supplier_table, "all", fail_all)

    with pytest.raises(HTTPException) as exc_info:
        supplier_routes.list_suppliers(
            country=None,
            category=None,
            current_user=current_user,
        )

    assert exc_info.value.status_code == 503
    assert "corrupt supplier store" not in exc_info.value.detail


# ---------------------------------------------------------------------------
# GET /suppliers/{supplier_id}
# ---------------------------------------------------------------------------

def test_get_supplier_happy_path_returns_requested_supplier(
    supplier_table,
    current_user,
):
    supplier_id = insert_supplier(supplier_table, name="Requested Supplier")

    result = supplier_routes.get_supplier(supplier_id, current_user=current_user)

    assert result.id == supplier_id
    assert result.name == "Requested Supplier"


def test_get_supplier_edge_case_returns_optional_null_fields(
    supplier_table,
    current_user,
):
    supplier_id = insert_supplier(
        supplier_table,
        service_zone=None,
        contact_email=None,
        notes=None,
    )

    result = supplier_routes.get_supplier(supplier_id, current_user=current_user)

    assert result.service_zone is None
    assert result.contact_email is None
    assert result.notes is None


def test_get_supplier_failure_mode_missing_supplier_returns_404(
    supplier_table,
    current_user,
):
    with pytest.raises(HTTPException) as exc_info:
        supplier_routes.get_supplier(999, current_user=current_user)

    assert exc_info.value.status_code == 404
    assert "999" in exc_info.value.detail


# ---------------------------------------------------------------------------
# PATCH /suppliers/{supplier_id}/rate
# ---------------------------------------------------------------------------

def test_update_supplier_rate_happy_path_changes_rate_and_timestamp(
    supplier_table,
    current_user,
):
    supplier_id = insert_supplier(supplier_table)
    before_timestamp = supplier_table.get(doc_id=supplier_id)["updated_at"]

    result = supplier_routes.update_supplier_rate(
        supplier_id,
        SupplierRateUpdate(rate_per_shipment=9.25),
        current_user=current_user,
    )

    assert result.rate_per_shipment == 9.25
    assert result.updated_at.isoformat() != before_timestamp


def test_update_supplier_rate_edge_case_accepts_small_positive_rate(
    supplier_table,
    current_user,
):
    supplier_id = insert_supplier(supplier_table)

    result = supplier_routes.update_supplier_rate(
        supplier_id,
        SupplierRateUpdate(rate_per_shipment=0.01),
        current_user=current_user,
    )

    assert result.rate_per_shipment == 0.01


def test_update_supplier_rate_failure_mode_storage_write_returns_503(
    supplier_table,
    current_user,
    monkeypatch,
):
    supplier_id = insert_supplier(supplier_table)

    def fail_update(*_args, **_kwargs):
        raise OSError("write failed")

    monkeypatch.setattr(supplier_table, "update", fail_update)

    with pytest.raises(HTTPException) as exc_info:
        supplier_routes.update_supplier_rate(
            supplier_id,
            SupplierRateUpdate(rate_per_shipment=8.0),
            current_user=current_user,
        )

    assert exc_info.value.status_code == 503
    assert "write failed" not in exc_info.value.detail


# ---------------------------------------------------------------------------
# PATCH /suppliers/{supplier_id}/status
# ---------------------------------------------------------------------------

def test_update_supplier_status_happy_path_suspends_supplier(
    supplier_table,
    current_user,
):
    supplier_id = insert_supplier(supplier_table)

    result = supplier_routes.update_supplier_status(
        supplier_id,
        SupplierStatusUpdate(status="suspended"),
        current_user=current_user,
    )

    assert result.status == "suspended"


def test_update_supplier_status_edge_case_preserves_rate_update_timestamp(
    supplier_table,
    current_user,
):
    original_timestamp = "2026-10-01T12:00:00+00:00"
    supplier_id = insert_supplier(
        supplier_table,
        updated_at=original_timestamp,
    )

    result = supplier_routes.update_supplier_status(
        supplier_id,
        SupplierStatusUpdate(status="suspended"),
        current_user=current_user,
    )

    assert result.updated_at.isoformat() == original_timestamp


def test_update_supplier_status_failure_mode_missing_supplier_returns_404(
    supplier_table,
    current_user,
):
    with pytest.raises(HTTPException) as exc_info:
        supplier_routes.update_supplier_status(
            404,
            SupplierStatusUpdate(status="suspended"),
            current_user=current_user,
        )

    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /suppliers/{supplier_id}
# ---------------------------------------------------------------------------

def test_delete_supplier_happy_path_removes_supplier(
    supplier_table,
    current_user,
):
    supplier_id = insert_supplier(supplier_table)

    result = supplier_routes.delete_supplier(
        supplier_id,
        current_user=current_user,
    )

    assert result.id == supplier_id
    assert result.message == "Supplier deleted successfully."
    assert supplier_table.get(doc_id=supplier_id) is None


def test_delete_supplier_edge_case_returns_deleted_id_for_caller_tracking(
    supplier_table,
    current_user,
):
    supplier_id = insert_supplier(supplier_table, name="Delete Me")

    result = supplier_routes.delete_supplier(
        supplier_id,
        current_user=current_user,
    )

    assert result.id == supplier_id


def test_delete_supplier_failure_mode_maps_storage_error_to_503(
    supplier_table,
    current_user,
    monkeypatch,
):
    supplier_id = insert_supplier(supplier_table)

    def fail_remove(*_args, **_kwargs):
        raise OSError("delete failed")

    monkeypatch.setattr(supplier_table, "remove", fail_remove)

    with pytest.raises(HTTPException) as exc_info:
        supplier_routes.delete_supplier(
            supplier_id,
            current_user=current_user,
        )

    assert exc_info.value.status_code == 503
    assert "delete failed" not in exc_info.value.detail
