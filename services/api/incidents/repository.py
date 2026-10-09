from collections import Counter
from pathlib import Path
from uuid import UUID

from tinydb import Query, TinyDB

from packages.shared.incidents import (
    IncidentBranch,
    IncidentCategory,
    IncidentOrigin,
    IncidentStatus,
    is_valid_status_transition,
)
from services.api.incidents.models import (
    IncidentCreate,
    IncidentResponse,
    IncidentStored,
    IncidentSummary,
    utc_now,
)


DEFAULT_DB_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "incidents.json"
)


class IncidentNotFoundError(LookupError):
    pass


class InvalidStatusTransitionError(ValueError):
    def __init__(self, current_status: str, new_status: str):
        self.current_status = current_status
        self.new_status = new_status
        super().__init__(
            f"Status cannot change from '{current_status}' "
            f"to '{new_status}'."
        )


class IncidentRepository:
    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.db = TinyDB(self.db_path)
        self.table = self.db.table("incidents")

    def close(self) -> None:
        self.db.close()

    def _to_response(self, document: dict) -> IncidentResponse:
        return IncidentResponse.model_validate(dict(document))

    def create(self, payload: IncidentCreate) -> IncidentResponse:
        now = utc_now()

        incident = IncidentStored(
            **payload.model_dump(),
            created_at=now,
            updated_at=now,
        )

        self.table.insert(
            incident.model_dump(mode="json")
        )

        return IncidentResponse.model_validate(
            incident.model_dump()
        )

    def list(
        self,
        *,
        status: str | None = None,
        origin: str | None = None,
        branch: str | None = None,
        category: str | None = None,
    ) -> list[IncidentResponse]:
        documents = self.table.all()

        if status is not None:
            documents = [
                item for item in documents
                if item.get("status") == status
            ]

        if origin is not None:
            documents = [
                item for item in documents
                if item.get("origin") == origin
            ]

        if branch is not None:
            documents = [
                item for item in documents
                if item.get("branch") == branch
            ]

        if category is not None:
            documents = [
                item for item in documents
                if item.get("category") == category
            ]

        return [
            self._to_response(document)
            for document in documents
        ]

    def get(self, incident_id: UUID | str) -> IncidentResponse:
        query = Query()
        id_text = str(incident_id)

        document = self.table.get(query.id == id_text)

        if document is None:
            raise IncidentNotFoundError(
                f"Incident '{id_text}' was not found."
            )

        return self._to_response(document)

    def update_status(
        self,
        incident_id: UUID | str,
        new_status: str,
    ) -> IncidentResponse:
        existing = self.get(incident_id)

        current = IncidentStatus(existing.status)
        requested = IncidentStatus(new_status)

        if not is_valid_status_transition(current, requested):
            raise InvalidStatusTransitionError(
                current.value,
                requested.value,
            )

        query = Query()
        id_text = str(incident_id)

        self.table.update(
            {
                "status": requested.value,
                "updated_at": utc_now().isoformat(),
            },
            query.id == id_text,
        )

        return self.get(id_text)

    def summary(self) -> IncidentSummary:
        documents = self.table.all()

        status_counts = Counter(
            item.get("status") for item in documents
        )
        category_counts = Counter(
            item.get("category") for item in documents
        )
        origin_counts = Counter(
            item.get("origin") for item in documents
        )
        branch_counts = Counter(
            item.get("branch") for item in documents
        )

        return IncidentSummary(
            total=len(documents),
            by_status={
                value.value: status_counts[value.value]
                for value in IncidentStatus
            },
            by_category={
                value.value: category_counts[value.value]
                for value in IncidentCategory
            },
            by_origin={
                value.value: origin_counts[value.value]
                for value in IncidentOrigin
            },
            by_branch={
                value.value: branch_counts[value.value]
                for value in IncidentBranch
            },
        )


incident_repository = IncidentRepository()
