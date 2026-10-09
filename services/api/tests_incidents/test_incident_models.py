from pydantic import ValidationError

from packages.shared.incidents import (
    IncidentStatus,
    is_valid_status_transition,
)
from services.api.incidents.models import IncidentCreate, IncidentStored


def test_valid_incident_model():
    incident = IncidentStored(
        title="Parcel not delivered",
        description="Customer reports that the parcel did not arrive.",
        category="lost_parcel",
        origin="customer",
        branch="la_office",
    )

    assert incident.id is not None
    assert incident.created_at is not None
    assert incident.updated_at is not None
    assert incident.status == "open"


def test_blank_title_is_rejected():
    try:
        IncidentCreate(
            title="   ",
            description="A detailed description.",
            category="other",
            origin="internal",
            branch="central",
        )
        assert False, "Expected ValidationError"
    except ValidationError:
        pass


def test_invalid_category_is_rejected():
    try:
        IncidentCreate(
            title="Bad category",
            description="A detailed description.",
            category="not_a_real_category",
            origin="internal",
            branch="central",
        )
        assert False, "Expected ValidationError"
    except ValidationError:
        pass


def test_exact_status_transitions():
    assert is_valid_status_transition(
        IncidentStatus.OPEN,
        IncidentStatus.IN_PROGRESS,
    )
    assert not is_valid_status_transition(
        IncidentStatus.RESOLVED,
        IncidentStatus.OPEN,
    )
