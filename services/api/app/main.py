from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.incidents import router as incidents_router


app = FastAPI(
    title="TrackFlow Incident Analysis API",
    version="1.0.0",
    description=(
        "Internal API for validating and analyzing TrackFlow after-sales "
        "incident CSV files."
    ),
)

# Local-development frontend origins.
# The frontend runs on port 3000 and FastAPI runs on port 8000.
# allow_origin_regex also covers GitHub Codespaces forwarded-port URLs,
# e.g. https://<codespace-name>-3000.app.github.dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.app\.github\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    incidents_router,
    prefix="/api/incidents",
    tags=["Incidents"],
)


@app.get("/health", tags=["System"])
def health() -> dict[str, str]:
    return {"status": "ok"}
