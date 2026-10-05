from datetime import datetime, timezone

import pytest
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

import auth.services.profile_service as profile_service
import auth.services.user_service as user_service
import routes.suppliers as supplier_routes
from app.services.result_store import clear_latest_result
from auth.security import create_access_token


@pytest.fixture(autouse=True)
def isolated_storage(monkeypatch):
    database = TinyDB(storage=MemoryStorage)
    users = database.table("users")
    suppliers = database.table("suppliers")
    monkeypatch.setattr(user_service, "users_table", users)
    monkeypatch.setattr(profile_service, "profiles_table", database.table("profiles"))
    monkeypatch.setattr(supplier_routes, "suppliers_table", suppliers)
    monkeypatch.setenv("JWT_SECRET_KEY", "test-only-secret-not-for-production")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    for user_id, role in [(1, "user"), (2, "user"), (3, "admin")]:
        users.insert({
            "id": user_id,
            "email": f"user{user_id}@example.com",
            "hashed_password": "unused-test-hash",
            "is_active": True,
            "role": role,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    clear_latest_result()
    yield users, suppliers
    clear_latest_result()
    database.close()


@pytest.fixture
def auth_headers():
    def for_user(user_id=1):
        token, _ = create_access_token(user_id)
        return {"Authorization": f"Bearer {token}"}
    return for_user


@pytest.fixture
def supplier_payload():
    return {
        "name": "Test Supplier",
        "country": "USA",
        "categories": ["carrier_last_mile"],
        "rate_per_shipment": 5.25,
        "currency": "USD",
        "status": "active",
    }