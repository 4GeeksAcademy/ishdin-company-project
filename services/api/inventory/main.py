from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import init_supabase_schema, seed_inventory_data
from .routers.inventory import router as inventory_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # SQLModel tables + database-level FK/check constraints are created in Supabase.
    init_supabase_schema()
    seed_inventory_data()
    yield


app = FastAPI(
    title="TrackFlow Inventory API",
    version="1.0.0",
    lifespan=lifespan,
)

# Keep your existing /auth, /users, /profiles routers registered here as well.
app.include_router(inventory_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
