import argparse
import os
import random
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, func, select
from tinydb import Query

from auth.database import users_table
from inventory.database import engine
from inventory.models import SKU, StockEntry, StockExit
from packages.shared.incidents import (
    IncidentBranch,
    IncidentCategory,
    IncidentOrigin,
    IncidentStatus,
)
from services.api.incidents.models import IncidentStored
from services.api.incidents.repository import incident_repository


RANDOM_SEED = 42

DEFAULT_SKUS = 120
INBOUND_PER_SKU = 8
OUTBOUND_PER_SKU = 5
DEFAULT_INCIDENTS = 3000

SKU_PREFIX = "PERF-"
INCIDENT_PREFIX = "[PERF]"


CLIENTS = [
    "UrbanThread",
    "PureStep Footwear",
    "SoundWave Electronics",
    "GlowLab Cosmetics",
    "NovaStyle",
    "BrightTech",
    "Luma Beauty",
    "MetroWear",
]

PRODUCT_NAMES = {
    "fashion": [
        "Classic Sneaker",
        "Slim Fit Chino",
        "Performance Jacket",
        "Cotton Hoodie",
        "Running Shorts",
    ],
    "electronics": [
        "Wireless Earbuds",
        "USB-C Charger",
        "Smart Speaker",
        "Portable Battery",
        "Bluetooth Headphones",
    ],
    "cosmetics": [
        "Hydrating Serum",
        "Face Cleanser",
        "Night Cream",
        "Vitamin C Serum",
        "Daily Moisturizer",
    ],
}

INCIDENT_TITLES = [
    "Inventory quantity mismatch",
    "Carrier delivery delay",
    "Warehouse picking issue",
    "Customer delivery complaint",
    "Return processing problem",
    "System synchronization failure",
    "Parcel reported missing",
    "Carrier tracking issue",
]


def resolve_user_uuid() -> str:
    configured = os.getenv("PERF_SEED_USER_UUID")

    if configured:
        return configured

    for user in users_table.all():
        for key in ("id", "user_uuid", "uuid"):
            value = user.get(key)
            if value:
                return str(value)

    raise RuntimeError(
        "No TinyDB user was found. Register a user first or set "
        "PERF_SEED_USER_UUID in services/api/.env."
    )


def inventory_counts(session: Session) -> dict[str, int]:
    return {
        "skus": session.exec(
            select(func.count()).select_from(SKU)
        ).one(),
        "stock_entries": session.exec(
            select(func.count()).select_from(StockEntry)
        ).one(),
        "stock_exits": session.exec(
            select(func.count()).select_from(StockExit)
        ).one(),
    }


def performance_skus(session: Session) -> list[SKU]:
    return list(
        session.exec(
            select(SKU).where(SKU.sku.startswith(SKU_PREFIX))
        ).all()
    )


def reset_inventory_performance_data(session: Session) -> None:
    skus = performance_skus(session)

    if not skus:
        return

    sku_ids = [sku.id for sku in skus if sku.id is not None]

    entries = session.exec(
        select(StockEntry).where(StockEntry.sku_id.in_(sku_ids))
    ).all()

    exits = session.exec(
        select(StockExit).where(StockExit.sku_id.in_(sku_ids))
    ).all()

    for row in exits:
        session.delete(row)

    for row in entries:
        session.delete(row)

    for sku in skus:
        session.delete(sku)

    session.commit()


def reset_incident_performance_data() -> None:
    query = Query()

    incident_repository.table.remove(
        query.title.matches(r"^\[PERF\]")
    )


def seed_inventory(
    session: Session,
    *,
    sku_count: int,
    user_uuid: str,
) -> None:
    categories = ["fashion", "electronics", "cosmetics"]
    warehouses = ["LA", "ZGZ"]

    now = datetime.now(timezone.utc)

    skus: list[SKU] = []

    for index in range(1, sku_count + 1):
        category = categories[(index - 1) % len(categories)]
        warehouse = warehouses[(index - 1) % len(warehouses)]

        product_base = random.choice(PRODUCT_NAMES[category])
        client = random.choice(CLIENTS)

        sku = SKU(
            name=f"{product_base} Model {index:04d}",
            sku=f"{SKU_PREFIX}{warehouse}-{index:04d}",
            client_name=client,
            category=category,
            warehouse=warehouse,
        )

        skus.append(sku)

    session.add_all(skus)
    session.flush()

    entries: list[StockEntry] = []
    exits: list[StockExit] = []

    for sku in skus:
        assert sku.id is not None

        for movement_index in range(INBOUND_PER_SKU):
            created_at = now - timedelta(
                days=random.randint(1, 90),
                minutes=random.randint(0, 1440),
            )

            entries.append(
                StockEntry(
                    sku_id=sku.id,
                    quantity=random.randint(40, 150),
                    reference=(
                        f"PERF-IN-{sku.id:05d}-{movement_index:02d}"
                    ),
                    warehouse=sku.warehouse,
                    created_at=created_at,
                    user_uuid=user_uuid,
                )
            )

        for movement_index in range(OUTBOUND_PER_SKU):
            created_at = now - timedelta(
                days=random.randint(0, 60),
                minutes=random.randint(0, 1440),
            )

            exit_type = (
                "loss"
                if movement_index % 5 == 4
                else "dispatch"
            )

            tracking_number = None

            if exit_type == "dispatch":
                tracking_number = (
                    f"PERF{sku.id:05d}{movement_index:04d}"
                )

            exits.append(
                StockExit(
                    sku_id=sku.id,
                    quantity=random.randint(1, 20),
                    exit_type=exit_type,
                    tracking_number=tracking_number,
                    warehouse=sku.warehouse,
                    created_at=created_at,
                    user_uuid=user_uuid,
                )
            )

    session.add_all(entries)
    session.add_all(exits)
    session.commit()


def seed_incidents(count: int) -> None:
    categories = list(IncidentCategory)
    statuses = list(IncidentStatus)
    origins = list(IncidentOrigin)
    branches = list(IncidentBranch)

    now = datetime.now(timezone.utc)

    documents = []

    for index in range(1, count + 1):
        created_at = now - timedelta(
            days=random.randint(0, 180),
            minutes=random.randint(0, 1440),
        )

        incident = IncidentStored(
            title=(
                f"{INCIDENT_PREFIX} "
                f"{random.choice(INCIDENT_TITLES)} #{index:05d}"
            ),
            description=(
                "Performance profiling incident generated for "
                "TrackFlow caching analysis."
            ),
            category=random.choice(categories),
            status=random.choice(statuses),
            origin=random.choice(origins),
            branch=random.choice(branches),
            created_at=created_at,
            updated_at=created_at,
        )

        documents.append(
            incident.model_dump(mode="json")
        )

    incident_repository.table.insert_multiple(documents)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate realistic TrackFlow data for caching "
            "performance profiling."
        )
    )

    parser.add_argument(
        "--skus",
        type=int,
        default=DEFAULT_SKUS,
    )

    parser.add_argument(
        "--incidents",
        type=int,
        default=DEFAULT_INCIDENTS,
    )

    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete previous PERF data before reseeding.",
    )

    args = parser.parse_args()

    if args.skus <= 0 or args.incidents <= 0:
        raise ValueError(
            "--skus and --incidents must be greater than zero."
        )

    random.seed(RANDOM_SEED)

    user_uuid = resolve_user_uuid()

    with Session(engine) as session:
        before_inventory = inventory_counts(session)
        before_incidents = len(incident_repository.table)

        existing_skus = performance_skus(session)

        query = Query()
        existing_incidents = incident_repository.table.search(
            query.title.matches(r"^\[PERF\]")
        )

        if (existing_skus or existing_incidents) and not args.reset:
            raise RuntimeError(
                "Performance seed data already exists. "
                "Run again with --reset to replace it."
            )

        if args.reset:
            print("Removing existing performance seed data...")

            reset_inventory_performance_data(session)
            reset_incident_performance_data()

        print("Generating inventory performance data...")

        seed_inventory(
            session,
            sku_count=args.skus,
            user_uuid=user_uuid,
        )

        print("Generating incident performance data...")

        seed_incidents(args.incidents)

        after_inventory = inventory_counts(session)
        after_incidents = len(incident_repository.table)

    print()
    print("TrackFlow performance seed completed.")
    print()
    print("Before:")
    print(f"  SKUs:          {before_inventory['skus']}")
    print(
        f"  Stock entries: {before_inventory['stock_entries']}"
    )
    print(
        f"  Stock exits:   {before_inventory['stock_exits']}"
    )
    print(f"  Incidents:     {before_incidents}")

    print()
    print("After:")
    print(f"  SKUs:          {after_inventory['skus']}")
    print(
        f"  Stock entries: {after_inventory['stock_entries']}"
    )
    print(
        f"  Stock exits:   {after_inventory['stock_exits']}"
    )
    print(f"  Incidents:     {after_incidents}")

    print()
    print("Performance data added:")
    print(f"  SKUs:          {args.skus}")
    print(
        f"  Stock entries: "
        f"{args.skus * INBOUND_PER_SKU}"
    )
    print(
        f"  Stock exits:   "
        f"{args.skus * OUTBOUND_PER_SKU}"
    )
    print(f"  Incidents:     {args.incidents}")


if __name__ == "__main__":
    main()