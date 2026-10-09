from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from auth.dependencies import get_current_user
from auth.models import UserStored
from packages.shared.incidents import (
    IncidentBranch,
    IncidentCategory,
    IncidentOrigin,
    IncidentStatus,
)
from services.api.incidents.errors import IncidentAPIRoute
from services.api.incidents.models import (
    IncidentCreate,
    IncidentResponse,
    IncidentStatusUpdate,
    IncidentSummary,
)
from services.api.incidents.repository import (
    IncidentNotFoundError,
    InvalidStatusTransitionError,
    incident_repository,
)


router = APIRouter(
    prefix="/api/incidents",
    tags=["Incidents"],
    route_class=IncidentAPIRoute,
)


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register an incident",
)
def create_incident(
    payload: IncidentCreate,
    current_user: UserStored = Depends(get_current_user),
) -> IncidentResponse:
    """
    Create an incident from the browser form.

    FastAPI/Pydantic validation is converted by IncidentAPIRoute into the
    required friendly HTTP 400 field-error shape.
    """
    return incident_repository.create(payload)


@router.get(
    "",
    response_model=list[IncidentResponse],
    summary="List and filter incidents",
)
def list_incidents(
    incident_status: IncidentStatus | None = Query(
        default=None,
        alias="status",
    ),
    origin: IncidentOrigin | None = Query(default=None),
    branch: IncidentBranch | None = Query(default=None),
    category: IncidentCategory | None = Query(default=None),
    current_user: UserStored = Depends(get_current_user),
) -> list[IncidentResponse]:
    return incident_repository.list(
        status=(
            incident_status.value
            if incident_status is not None
            else None
        ),
        origin=origin.value if origin is not None else None,
        branch=branch.value if branch is not None else None,
        category=category.value if category is not None else None,
    )


@router.get(
    "/summary",
    response_model=IncidentSummary,
    summary="Get incident summary metrics",
)
def get_incident_summary(
    current_user: UserStored = Depends(get_current_user),
) -> IncidentSummary:
    """
    Empty databases return total=0 and zero counts for every TrackFlow value.
    """
    return incident_repository.summary()


@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Get one incident",
)
def get_incident(
    incident_id: UUID,
    current_user: UserStored = Depends(get_current_user),
) -> IncidentResponse:
    try:
        return incident_repository.get(incident_id)
    except IncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found.",
        ) from exc


@router.patch(
    "/{incident_id}/status",
    response_model=IncidentResponse,
    summary="Update incident lifecycle status",
)
def update_incident_status(
    incident_id: UUID,
    payload: IncidentStatusUpdate,
    current_user: UserStored = Depends(get_current_user),
):
    try:
        return incident_repository.update_status(
            incident_id,
            str(payload.status),
        )

    except IncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found.",
        ) from exc

    except InvalidStatusTransitionError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": "validation_error",
                "message": "The requested status change is not allowed.",
                "fields": {
                    "status": str(exc),
                },
            },
        )
