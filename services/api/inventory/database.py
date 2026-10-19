import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import make_url
from sqlmodel import Session, SQLModel, create_engine, select

from auth.database import users_table

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR.parent / ".env")

# -----------------------------------------------------------------------------
# TinyDB: users/authentication only
# -----------------------------------------------------------------------------
# The inventory API shares the existing authentication store. Do not create a
# second TinyDB file: auth.database owns the canonical users table and path.

# -----------------------------------------------------------------------------
# Supabase PostgreSQL: inventory/business data only
# -----------------------------------------------------------------------------
SUPABASE_DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")
if not SUPABASE_DATABASE_URL:
    raise RuntimeError(
        "SUPABASE_DATABASE_URL is missing. Add the Supabase PostgreSQL connection "
        "string to your .env file."
    )

database_url = make_url(SUPABASE_DATABASE_URL)
# The backend dependency set provides psycopg2-binary. SQLAlchemy 2 defaults
# `postgresql://` to psycopg (v3), which is not installed by this project.
if database_url.drivername in {"postgres", "postgresql"}:
    database_url = database_url.set(drivername="postgresql+psycopg2")

connect_args: dict[str, str] = {}
if database_url.drivername.startswith("postgresql"):
    connect_args["sslmode"] = os.getenv("DB_SSLMODE", "require")

engine = create_engine(
    database_url,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_pre_ping=True,
    connect_args=connect_args,
)


def get_db() -> Generator[Session, None, None]:
    """Yield one SQLModel session per request. Never use a global Session."""
    with Session(engine) as session:
        yield session


def init_supabase_schema() -> None:
    """Create SQL tables/constraints in Supabase if they do not already exist."""
    # Import models before create_all so they are registered in metadata.
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def _resolve_seed_user_uuid() -> str:
    """
    Resolve a real TinyDB user UUID for traceable seed orders.

    Priority:
    1) SEED_USER_UUID from .env
    2) first existing TinyDB user containing id/user_uuid/uuid
    """
    configured = os.getenv("SEED_USER_UUID")
    if configured:
        return configured

    users = users_table.all()
    for user in users:
        for key in ("id", "user_uuid", "uuid"):
            value = user.get(key)
            if value:
                return str(value)

    raise RuntimeError(
        "SEED_DATA=true but no TinyDB user UUID is available. Register a user first "
        "or set SEED_USER_UUID in .env to an existing TinyDB user's UUID."
    )


def seed_inventory_data() -> None:
    """Seed the minimum TrackFlow CONTEXT data for local/demo environments."""
    if os.getenv("SEED_DATA", "false").lower() != "true":
        return

    from .models import SKU, StockEntry, StockExit

    with Session(engine) as session:
        # Idempotent: do not duplicate seed data when inventory already exists.
        if session.exec(select(SKU)).first() is not None:
            return

        user_uuid = _resolve_seed_user_uuid()

        skus = [
            SKU(
                name="Classic White Sneaker - Size 42",
                sku="CLT-SNK-W-42",
                client_name="PureStep Footwear",
                category="fashion",
                warehouse="LA",
            ),
            SKU(
                name="Classic White Sneaker - Size 42",
                sku="CLT-SNK-W-42-Z",
                client_name="PureStep Footwear",
                category="fashion",
                warehouse="ZGZ",
            ),
            SKU(
                name="Wireless Earbuds Pro",
                sku="TEC-EAR-001",
                client_name="SoundWave Electronics",
                category="electronics",
                warehouse="LA",
            ),
            SKU(
                name="Hydrating Face Serum 30ml",
                sku="CSM-SRM-030",
                client_name="GlowLab Cosmetics",
                category="cosmetics",
                warehouse="ZGZ",
            ),
            SKU(
                name="Slim Fit Chino - Navy 32/32",
                sku="CLT-CHN-N-32",
                client_name="UrbanThread",
                category="fashion",
                warehouse="LA",
            ),
            SKU(
                name="USB-C Fast Charger 65W",
                sku="TEC-CHG-065",
                client_name="SoundWave Electronics",
                category="electronics",
                warehouse="ZGZ",
            ),
        ]

        session.add_all(skus)
        session.flush()  # obtain auto-generated IDs without ending the transaction

        by_code = {sku.sku: sku for sku in skus}

        entries = [
            StockEntry(
                sku_id=by_code["CLT-SNK-W-42"].id,
                quantity=50,
                reference="PO-2024-0098",
                warehouse="LA",
                user_uuid=user_uuid,
            ),
            StockEntry(
                sku_id=by_code["CLT-SNK-W-42"].id,
                quantity=25,
                reference="GR-LA-0234",
                warehouse="LA",
                user_uuid=user_uuid,
            ),
            StockEntry(
                sku_id=by_code["TEC-EAR-001"].id,
                quantity=20,
                reference="PO-2024-0100",
                warehouse="LA",
                user_uuid=user_uuid,
            ),
            StockEntry(
                sku_id=by_code["CSM-SRM-030"].id,
                quantity=40,
                reference="PO-2024-0102",
                warehouse="ZGZ",
                user_uuid=user_uuid,
            ),
            StockEntry(
                sku_id=by_code["TEC-CHG-065"].id,
                quantity=30,
                reference="GR-ZGZ-0110",
                warehouse="ZGZ",
                user_uuid=user_uuid,
            ),
        ]

        exits = [
            StockExit(
                sku_id=by_code["CLT-SNK-W-42"].id,
                quantity=10,
                exit_type="dispatch",
                tracking_number="1Z999AA10123456784",
                warehouse="LA",
                user_uuid=user_uuid,
            ),
            StockExit(
                sku_id=by_code["CLT-SNK-W-42"].id,
                quantity=2,
                exit_type="loss",
                tracking_number=None,
                warehouse="LA",
                user_uuid=user_uuid,
            ),
            StockExit(
                sku_id=by_code["CSM-SRM-030"].id,
                quantity=5,
                exit_type="dispatch",
                tracking_number="ESZGZ000123456789",
                warehouse="ZGZ",
                user_uuid=user_uuid,
            ),
        ]

        session.add_all(entries + exits)
        session.commit()
