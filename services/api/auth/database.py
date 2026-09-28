from pathlib import Path

from tinydb import TinyDB


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
AUTH_DB_PATH = DATA_DIR / "auth.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)

auth_db = TinyDB(AUTH_DB_PATH)
users_table = auth_db.table("users")
profiles_table = auth_db.table("profiles")
