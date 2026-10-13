import logging
from pathlib import Path

from tinydb import TinyDB


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "suppliers.json"

try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = TinyDB(DB_PATH)
    suppliers_table = db.table("suppliers")
except (OSError, ValueError) as exc:
    logger.error(
        "Supplier database initialization failed (error_type=%s).",
        type(exc).__name__,
    )
    raise RuntimeError("Supplier database initialization failed.") from None
