from pathlib import Path

import pytest

from packages.shared.incidents import (
    IncidentStatus,
)
from services.api.incidents.models import IncidentCreate
from services.api.incidents.repository import (
    IncidentNotFoundError,
    IncidentRepository,
    InvalidStatusTransitionError,
)


@pytest.fixture
def repo(tmp_path: Path):
    repository = IncidentRepository(
        tmp_path / "incidents-test.json"
    )
    yield repository
    repository.close()


def test_empty_database(repo):
    assert repo.list() == []

    summary = repo.summary()

    assert summary.total == 0
    assert summary.by_status["open"] == 0
    assert summary.by_category["lost_parcel"] == 0
    assert summary.by_origin["customer"] == 0
    assert summary.by_branch["central"] == 0


def test_create_and_get_incident(repo):
    created = repo.create(
        IncidentCreate(
            title="Lost parcel",
            description="Customer reports that parcel is missing.",
            category="lost_parcel",
            status="open",
            origin="customer",
            branch="la_office",
        )
    )

    fetched = repo.get(created.id)

    assert fetched.id == created.id
    assert fetched.title == "Lost parcel"
    assert fetched.created_at == fetched.updated_at


def test_filters(repo):
    repo.create(
        IncidentCreate(
            title="Lost parcel",
            description="Customer reports parcel is missing.",
            category="lost_parcel",
            origin="customer",
            branch="la_office",
        )
    )

    repo.create(
        IncidentCreate(
            title="Warehouse scanner failed",
            description="Scanner stopped responding.",
            category="system_failure",
            origin="branch",
            branch="zaragoza_warehouse",
        )
    )

    assert len(repo.list(origin="customer")) == 1
    assert len(repo.list(branch="zaragoza_warehouse")) == 1
    assert len(repo.list(category="lost_parcel")) == 1


def test_valid_status_transition_updates_timestamp(repo):
    created = repo.create(
        IncidentCreate(
            title="Carrier issue",
            description="Carrier failed to collect shipment.",
            category="carrier_issue",
            origin="branch",
            branch="la_warehouse",
        )
    )

    updated = repo.update_status(
        created.id,
        IncidentStatus.IN_PROGRESS.value,
    )

    assert updated.status == "in_progress"
    assert updated.updated_at >= created.updated_at


def test_invalid_status_transition(repo):
    created = repo.create(
        IncidentCreate(
            title="Already resolved",
            description="This incident is already complete.",
            category="other",
            status="resolved",
            origin="internal",
            branch="central",
        )
    )

    with pytest.raises(InvalidStatusTransitionError):
        repo.update_status(created.id, "open")


def test_missing_incident(repo):
    with pytest.raises(IncidentNotFoundError):
        repo.get("00000000-0000-0000-0000-000000000000")
