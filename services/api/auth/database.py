import logging
from pathlib import Path

from tinydb import TinyDB


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
AUTH_DB_PATH = DATA_DIR / "auth.json"

try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    auth_db = TinyDB(AUTH_DB_PATH)
    users_table = auth_db.table("users")
    profiles_table = auth_db.table("profiles")
    password_reset_tokens_table = auth_db.table("password_reset_tokens")
except (OSError, ValueError) as exc:
    logger.error(
        "Authentication database initialization failed (error_type=%s).",
        type(exc).__name__,
    )
    raise RuntimeError("Authentication database initialization failed.") from None
