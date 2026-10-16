"""API-042 unit tests for the TrackFlow incident-management endpoints.

The route functions are exercised directly. A real IncidentRepository backed by
a temporary TinyDB file supplies the business logic, so the tests cover both the
endpoint decisions and the repository behavior without testing HTTP plumbing.
"""

import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

import services.api.incidents.routes as incident_routes
from auth.models import UserRole, UserStored
from packages.shared.incidents import (
    IncidentBranch,
    IncidentCategory,
    IncidentOrigin,
    IncidentStatus,
)
from services.api.incidents.models import IncidentCreate, IncidentStatusUpdate
from services.api.incidents.repository import IncidentRepository


@pytest.fixture
def current_user() -> UserStored:
    return UserStored(
        id=201,
        email="incident.user@example.com",
        hashed_password="unused-test-hash",
        is_active=True,
        role=UserRole.USER,
        created_at=datetime.now(timezone.utc),
        token_version=0,
    )


@pytest.fixture
def incident_repository(tmp_path, monkeypatch):
    repository = IncidentRepository(tmp_path / "api042-incidents.json")
    monkeypatch.setattr(incident_routes, "incident_repository", repository)
    yield repository
    repository.close()


def incident_payload(**overrides) -> IncidentCreate:
    data = {
        "title": "Missing parcel",
        "description": "The parcel was not delivered to the customer.",
        "category": IncidentCategory.LOST_PARCEL,
        "status": IncidentStatus.OPEN,
        "origin": IncidentOrigin.CUSTOMER,
        "branch": IncidentBranch.LA_OFFICE,
    }
    data.update(overrides)
    return IncidentCreate(**data)


# ---------------------------------------------------------------------------
# POST /api/incidents
# ---------------------------------------------------------------------------

def test_create_incident_happy_path_persists_incident(
    incident_repository,
    current_user,
):
    result = incident_routes.create_incident(
        incident_payload(),
        current_user=current_user,
    )

    stored = incident_repository.get(result.id)
    assert stored.id == result.id
    assert stored.title == "Missing parcel"
    assert stored.status == "open"


def test_create_incident_edge_case_normalizes_surrounding_whitespace(
    incident_repository,
    current_user,
):
    payload = incident_payload(
        title="  Damaged parcel  ",
        description="  Box arrived crushed.  ",
    )

    result = incident_routes.create_incident(payload, current_user=current_user)

    assert result.title == "Damaged parcel"
    assert result.description == "Box arrived crushed."


def test_create_incident_failure_mode_repository_error_is_not_hidden(
    incident_repository,
    current_user,
    monkeypatch,
):
    def fail_create(_payload):
        raise OSError("incident storage unavailable")

    monkeypatch.setattr(incident_repository, "create", fail_create)

    with pytest.raises(OSError, match="incident storage unavailable"):
        incident_routes.create_incident(
            incident_payload(),
            current_user=current_user,
        )


# ---------------------------------------------------------------------------
# GET /api/incidents
# ---------------------------------------------------------------------------

def test_list_incidents_happy_path_applies_all_filters(
    incident_repository,
    current_user,
):
    matching = incident_repository.create(incident_payload())
    incident_repository.create(
        incident_payload(
            title="Warehouse mismatch",
            category=IncidentCategory.INVENTORY_DISCREPANCY,
            origin=IncidentOrigin.INTERNAL,
            branch=IncidentBranch.ZARAGOZA_WAREHOUSE,
        )
    )

    results = incident_routes.list_incidents(
        incident_status=IncidentStatus.OPEN,
        origin=IncidentOrigin.CUSTOMER,
        branch=IncidentBranch.LA_OFFICE,
        category=IncidentCategory.LOST_PARCEL,
        current_user=current_user,
    )

    assert [item.id for item in results] == [matching.id]


def test_list_incidents_edge_case_no_matching_filter_returns_empty_list(
    incident_repository,
    current_user,
):
    incident_repository.create(incident_payload())

    results = incident_routes.list_incidents(
        incident_status=IncidentStatus.RESOLVED,
        origin=None,
        branch=None,
        category=None,
        current_user=current_user,
    )

    assert results == []


def test_list_incidents_failure_mode_repository_error_propagates(
    incident_repository,
    current_user,
    monkeypatch,
):
    def fail_list(**_kwargs):
        raise OSError("list failed")

    monkeypatch.setattr(incident_repository, "list", fail_list)

    with pytest.raises(OSError, match="list failed"):
        incident_routes.list_incidents(
            incident_status=None,
            origin=None,
            branch=None,
            category=None,
            current_user=current_user,
        )


# ---------------------------------------------------------------------------
# GET /api/incidents/summary
# ---------------------------------------------------------------------------

def test_incident_summary_happy_path_counts_domain_values(
    incident_repository,
    current_user,
):
    incident_repository.create(incident_payload())
    incident_repository.create(
        incident_payload(
            title="Carrier outage",
            category=IncidentCategory.CARRIER_ISSUE,
            status=IncidentStatus.IN_PROGRESS,
            origin=IncidentOrigin.BRANCH,
            branch=IncidentBranch.ZARAGOZA_OFFICE,
        )
    )

    summary = incident_routes.get_incident_summary(current_user=current_user)

    assert summary.total == 2
    assert summary.by_status["open"] == 1
    assert summary.by_status["in_progress"] == 1
    assert summary.by_category["lost_parcel"] == 1
    assert summary.by_category["carrier_issue"] == 1


def test_incident_summary_edge_case_empty_database_returns_zeroed_metrics(
    incident_repository,
    current_user,
):
    summary = incident_routes.get_incident_summary(current_user=current_user)

    assert summary.total == 0
    assert all(count == 0 for count in summary.by_status.values())
    assert all(count == 0 for count in summary.by_category.values())
    assert all(count == 0 for count in summary.by_origin.values())
    assert all(count == 0 for count in summary.by_branch.values())


def test_incident_summary_failure_mode_repository_error_propagates(
    incident_repository,
    current_user,
    monkeypatch,
):
    def fail_summary():
        raise OSError("summary failed")

    monkeypatch.setattr(incident_repository, "summary", fail_summary)

    with pytest.raises(OSError, match="summary failed"):
        incident_routes.get_incident_summary(current_user=current_user)


# ---------------------------------------------------------------------------
# GET /api/incidents/{incident_id}
# ---------------------------------------------------------------------------

def test_get_incident_happy_path_returns_incident(
    incident_repository,
    current_user,
):
    created = incident_repository.create(incident_payload())

    result = incident_routes.get_incident(created.id, current_user=current_user)

    assert result.id == created.id
    assert result.title == created.title


def test_get_incident_edge_case_accepts_uuid_object_without_mutation(
    incident_repository,
    current_user,
):
    created = incident_repository.create(incident_payload())

    result = incident_routes.get_incident(created.id, current_user=current_user)

    assert result.id == created.id
    assert type(result.id) is type(created.id)


def test_get_incident_failure_mode_missing_incident_maps_to_404(
    incident_repository,
    current_user,
):
    with pytest.raises(HTTPException) as exc_info:
        incident_routes.get_incident(uuid4(), current_user=current_user)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Incident not found."


# ---------------------------------------------------------------------------
# PATCH /api/incidents/{incident_id}/status
# ---------------------------------------------------------------------------

def test_update_incident_status_happy_path_allows_valid_transition(
    incident_repository,
    current_user,
):
    created = incident_repository.create(incident_payload())

    result = incident_routes.update_incident_status(
        created.id,
        IncidentStatusUpdate(status=IncidentStatus.IN_PROGRESS),
        current_user=current_user,
    )

    assert result.status == "in_progress"
    assert incident_repository.get(created.id).status == "in_progress"


def test_update_incident_status_edge_case_invalid_transition_returns_safe_400(
    incident_repository,
    current_user,
):
    created = incident_repository.create(incident_payload())

    response = incident_routes.update_incident_status(
        created.id,
        IncidentStatusUpdate(status=IncidentStatus.RESOLVED),
        current_user=current_user,
    )
    body = json.loads(response.body)

    assert response.status_code == 400
    assert body["error"] == "validation_error"
    assert body["fields"]["status"] == "This status transition is not allowed."


def test_update_incident_status_failure_mode_missing_incident_maps_to_404(
    incident_repository,
    current_user,
):
    with pytest.raises(HTTPException) as exc_info:
        incident_routes.update_incident_status(
            uuid4(),
            IncidentStatusUpdate(status=IncidentStatus.IN_PROGRESS),
            current_user=current_user,
        )

    assert exc_info.value.status_code == 404
