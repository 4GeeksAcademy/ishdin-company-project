import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.incidents import router as incidents_router
from auth.routes.auth import router as auth_router
from auth.routes.profiles import router as profiles_router
from auth.routes.users import router as users_router
from inventory.database import init_supabase_schema, seed_inventory_data
from inventory.routers.inventory import router as inventory_router
from services.api.incidents.routes import router as incident_manager_router
from routes.suppliers import router as suppliers_router
from seed import seed_suppliers


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Guarantee that TrackFlow starts with the CONTEXT supplier directory.

    The seeder is idempotent, so restarting the API does not create duplicate
    suppliers. Startup is aborted with a controlled error when supplier data
    cannot be initialized safely.
    """
    try:
        inserted_count = seed_suppliers()
    except (OSError, ValueError, RuntimeError) as exc:
        logger.error(
            "Supplier startup seed failed (error_type=%s).",
            type(exc).__name__,
        )
        raise RuntimeError(
            "TrackFlow could not initialize supplier data."
        ) from None

    try:
        init_supabase_schema()
        seed_inventory_data()
    except (OSError, RuntimeError, ValueError) as exc:
        logger.error(
            "Inventory startup initialization failed (error_type=%s).",
            type(exc).__name__,
        )
        raise RuntimeError(
            "TrackFlow could not initialize inventory data."
        ) from None

    logger.info(
        "Supplier startup seed complete. Inserted %s new record(s).",
        inserted_count,
    )

    yield


app = FastAPI(
    title="TrackFlow Supplier Management API",
    version="1.0.0",
    description=(
        "Internal supplier directory API using FastAPI, TinyDB, and Pydantic."
    ),
    lifespan=lifespan,
)

# Local development + GitHub Codespaces frontend access.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*-3000\.app\.github\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suppliers_router)
app.include_router(incidents_router, prefix="/api/incidents")
app.include_router(incident_manager_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(profiles_router)
app.include_router(inventory_router)


@app.get("/health", tags=["System"])
def health() -> dict[str, str]:
    return {"status": "ok"}
