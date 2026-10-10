from pathlib import Path

from tinydb import Query, TinyDB

from services.api.incidents.models import IncidentStored


DEFAULT_DB_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "incidents.json"
)


class IncidentSeedStore:
    """
    TinyDB adapter used by the historical seeder.

    The source CSV incident_id is NOT stored on the incident itself. It is kept
    in a separate seed-key table solely for idempotency, matching the CONTEXT.
    """

    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.db = TinyDB(self.db_path)
        self.incidents = self.db.table("incidents")
        self.seed_keys = self.db.table("incident_seed_keys")

    def close(self) -> None:
        self.db.close()

    def has_seed_key(self, source_key: str) -> bool:
        query = Query()
        return self.seed_keys.contains(query.source_key == source_key)

    def insert_seed_incident(
        self,
        source_key: str,
        incident: IncidentStored,
    ) -> bool:
        if self.has_seed_key(source_key):
            return False

        self.incidents.insert(incident.model_dump(mode="json"))

        self.seed_keys.insert(
            {
                "source_key": source_key,
                "incident_id": str(incident.id),
            }
        )

        return True

    def all_incidents(self) -> list[dict]:
        return [dict(item) for item in self.incidents.all()]
