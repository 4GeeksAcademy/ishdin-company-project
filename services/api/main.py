from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.suppliers import router as suppliers_router
from seed import seed_suppliers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Guarantee that TrackFlow starts with the CONTEXT supplier directory.

    The seeder is idempotent, so restarting the API does not create duplicate
    suppliers.
    """
    inserted_count = seed_suppliers()

    print(
        "Supplier startup seed complete. "
        f"Inserted {inserted_count} new record(s)."
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


@app.get("/health", tags=["System"])
def health() -> dict[str, str]:
    return {"status": "ok"}
