import logging
from pathlib import Path

from tinydb import Query, TinyDB

from services.api.incidents.models import IncidentStored


logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "incidents.json"
)


class IncidentSeedStoreError(RuntimeError):
    """Raised when the historical incident seed store cannot be used safely."""


class IncidentSeedStore:
    """
    TinyDB adapter used by the historical seeder.

    The source CSV incident_id is NOT stored on the incident itself. It is kept
    in a separate seed-key table solely for idempotency, matching the CONTEXT.
    """

    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)

        try:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self.db = TinyDB(self.db_path)
            self.incidents = self.db.table("incidents")
            self.seed_keys = self.db.table("incident_seed_keys")
        except (OSError, ValueError) as exc:
            logger.error(
                "Incident seed store initialization failed (error_type=%s).",
                type(exc).__name__,
            )
            raise IncidentSeedStoreError(
                "Incident seed storage could not be initialized."
            ) from None

    def close(self) -> None:
        self.db.close()

    def has_seed_key(self, source_key: str) -> bool:
        query = Query()
        try:
            return self.seed_keys.contains(query.source_key == source_key)
        except (OSError, ValueError) as exc:
            logger.error(
                "Incident seed lookup failed (error_type=%s).",
                type(exc).__name__,
            )
            raise IncidentSeedStoreError(
                "Incident seed storage could not be read."
            ) from None

    def insert_seed_incident(
        self,
        source_key: str,
        incident: IncidentStored,
    ) -> bool:
        if self.has_seed_key(source_key):
            return False

        try:
            self.incidents.insert(incident.model_dump(mode="json"))
            self.seed_keys.insert(
                {
                    "source_key": source_key,
                    "incident_id": str(incident.id),
                }
            )
        except (OSError, ValueError) as exc:
            logger.error(
                "Incident seed write failed (error_type=%s).",
                type(exc).__name__,
            )
            raise IncidentSeedStoreError(
                "Incident seed data could not be saved."
            ) from None

        return True

    def all_incidents(self) -> list[dict]:
        try:
            return [dict(item) for item in self.incidents.all()]
        except (OSError, ValueError) as exc:
            logger.error(
                "Incident seed read failed (error_type=%s).",
                type(exc).__name__,
            )
            raise IncidentSeedStoreError(
                "Incident seed storage could not be read."
            ) from None
