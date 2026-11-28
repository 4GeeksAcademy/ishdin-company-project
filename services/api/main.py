import logging
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api.incidents import router as incidents_router
from auth.routes.auth import router as auth_router
from auth.routes.profiles import router as profiles_router
from auth.routes.users import router as users_router
from inventory.database import init_supabase_schema, seed_inventory_data
from inventory.routers.inventory import router as inventory_router
from models import HealthResponse
from services.api.incidents.routes import router as incident_manager_router
from routes.suppliers import router as suppliers_router
from services.api.telemetry.router import router as telemetry_router
from seed import seed_suppliers


logger = logging.getLogger(__name__)
timing_logger = logging.getLogger("api.timing")
timing_logger.setLevel(logging.INFO)

if not timing_logger.handlers:
    timing_handler = logging.StreamHandler()
    timing_handler.setFormatter(
        logging.Formatter("%(levelname)s:%(name)s:%(message)s")
    )
    timing_logger.addHandler(timing_handler)

timing_logger.propagate = False


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
    except (OSError, RuntimeError, ValueError, SQLAlchemyError) as exc:
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

@app.middleware("http")
async def timing_middleware(
    request: Request,
    call_next,
):
    """
    Add request correlation and record request duration.

    The same request ID can connect:
    frontend request -> backend log -> telemetry.
    """

    start = time.perf_counter()

    request_id = (
        request.headers.get("X-Request-ID")
        or str(uuid4())
    )

    # Make the ID available to route handlers.
    request.state.request_id = request_id

    response = await call_next(request)

    duration_ms = (
        time.perf_counter() - start
    ) * 1000

    # Return the same ID to the frontend.
    response.headers[
        "X-Request-ID"
    ] = request_id

    timing_logger.info(
        "%s %s → %s | %.1fms | request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )

    return response
    """Log the duration of every HTTP request for performance profiling."""
    start = time.perf_counter()

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start) * 1000

    timing_logger.info(
        "%s %s → %s | %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )

    return response

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
    expose_headers=["X-Request-ID"],
)

app.include_router(suppliers_router)
app.include_router(incidents_router, prefix="/api/incidents")
app.include_router(incident_manager_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(profiles_router)
app.include_router(inventory_router)
app.include_router(telemetry_router)

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
)
def health() -> HealthResponse:
    return HealthResponse(status="ok")
