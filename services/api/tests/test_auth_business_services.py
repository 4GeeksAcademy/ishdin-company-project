from datetime import datetime, timedelta, timezone

import pytest

import auth.services.auth_service as auth_service
import auth.services.password_reset_service as password_reset_service
import auth.services.profile_service as profile_service
import auth.services.user_service as user_service
from auth.models import ProfileUpdate, UserCreate, UserRole, UserUpdate
from auth.security import decode_access_token_claims, hash_password, verify_password


def test_authenticate_user_happy_path(isolated_storage):
    users = isolated_storage[0]
    users.update({"hashed_password": hash_password("secret-pass")}, doc_ids=[1])

    user = auth_service.authenticate_user(" USER1@EXAMPLE.COM ", "secret-pass")

    assert user is not None
    assert user.id == 1


@pytest.mark.parametrize("case", ["missing", "inactive", "wrong-password"])
def test_authenticate_user_failure_modes(isolated_storage, case):
    users = isolated_storage[0]
    users.update({"hashed_password": hash_password("secret-pass")}, doc_ids=[1])
    email = "user1@example.com"
    password = "secret-pass"

    if case == "missing":
        email = "missing@example.com"
    elif case == "inactive":
        users.update({"is_active": False}, doc_ids=[1])
    else:
        password = "wrong-pass"

    assert auth_service.authenticate_user(email, password) is None


def test_login_user_happy_path_generates_decodable_token(isolated_storage):
    users = isolated_storage[0]
    users.update({"hashed_password": hash_password("secret-pass")}, doc_ids=[1])

    token_response = auth_service.login_user("user1@example.com", "secret-pass")

    assert token_response is not None
    assert decode_access_token_claims(token_response.access_token) == (1, 0)


def test_user_service_create_happy_path_normalizes_email_and_hashes_password(isolated_storage):
    user, profile = user_service.create_user(
        UserCreate(
            email="NEW.USER@Example.COM",
            password="password123",
            name="New User",
        )
    )

    stored = user_service.get_user_by_id(user.id)
    assert str(user.email) == "new.user@example.com"
    assert profile.user_id == user.id
    assert stored is not None
    assert stored.hashed_password != "password123"
    assert verify_password("password123", stored.hashed_password)


def test_user_service_edge_duplicate_email_is_rejected(isolated_storage):
    payload = UserCreate(email="duplicate@example.com", password="password123")
    user_service.create_user(payload)

    with pytest.raises(ValueError):
        user_service.create_user(payload)


def test_user_service_failure_role_change_requires_admin(isolated_storage):
    with pytest.raises(PermissionError):
        user_service.update_user(
            1,
            UserUpdate(role=UserRole.MANAGER),
            caller_is_admin=False,
        )


def test_user_service_password_update_increments_token_version(isolated_storage):
    users = isolated_storage[0]
    users.update({"hashed_password": hash_password("old-pass")}, doc_ids=[1])

    user_service.update_user(
        1,
        UserUpdate(password="new-pass"),
        caller_is_admin=True,
    )

    updated = user_service.get_user_by_id(1)
    assert updated is not None
    assert updated.token_version == 1
    assert verify_password("new-pass", updated.hashed_password)


def test_profile_service_happy_path_create_update_and_get(isolated_storage):
    created = profile_service.create_profile(1, name="Initial")
    updated = profile_service.update_profile_for_user(1, ProfileUpdate(phone="555-1212"))
    fetched = profile_service.get_profile_by_user_id(1)

    assert created.user_id == 1
    assert updated is not None and updated.phone == "555-1212"
    assert fetched == updated


def test_profile_service_edge_create_is_idempotent(isolated_storage):
    first = profile_service.create_profile(1, name="First")
    second = profile_service.create_profile(1, name="Second")

    assert second.id == first.id
    assert second.name == "First"


def test_profile_service_failure_update_missing_profile_returns_none(isolated_storage):
    assert profile_service.update_profile_for_user(999, ProfileUpdate(name="Nobody")) is None


def test_password_reset_happy_path_is_one_time_and_increments_version(isolated_storage):
    token = password_reset_service.issue_password_reset_token(1)
    assert token is not None

    assert password_reset_service.reset_password(token, "new-pass") is True
    updated = user_service.get_user_by_id(1)
    assert updated is not None
    assert updated.token_version == 1
    assert verify_password("new-pass", updated.hashed_password)
    assert password_reset_service.reset_password(token, "another-pass") is False


def test_password_reset_edge_cooldown_suppresses_duplicate_request(isolated_storage):
    first = password_reset_service.issue_password_reset_token(1)
    second = password_reset_service.issue_password_reset_token(1)

    assert first is not None
    assert second is None


def test_password_reset_failure_expired_persisted_token_is_rejected(isolated_storage, monkeypatch):
    jti = "expired-jti"
    monkeypatch.setattr(password_reset_service, "decode_password_reset_token", lambda token: (1, jti))
    password_reset_service.password_reset_tokens_table.insert(
        {
            "user_id": 1,
            "jti_hash": password_reset_service._token_hash(jti),
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
            "used_at": None,
        }
    )

    assert password_reset_service.reset_password("expired", "new-pass") is False


def test_change_password_happy_path_revokes_tokens_and_increments_version(isolated_storage):
    users = isolated_storage[0]
    users.update({"hashed_password": hash_password("old-pass")}, doc_ids=[1])
    reset_token = password_reset_service.issue_password_reset_token(1)
    assert reset_token is not None

    assert password_reset_service.change_password(1, "old-pass", "new-pass") is True
    updated = user_service.get_user_by_id(1)
    assert updated is not None
    assert updated.token_version == 1
    assert verify_password("new-pass", updated.hashed_password)
    assert password_reset_service.reset_password(reset_token, "other-pass") is False


def test_change_password_failure_wrong_current_password_does_not_mutate_user(isolated_storage):
    users = isolated_storage[0]
    old_hash = hash_password("old-pass")
    users.update({"hashed_password": old_hash}, doc_ids=[1])

    assert password_reset_service.change_password(1, "wrong-pass", "new-pass") is False
    updated = user_service.get_user_by_id(1)
    assert updated is not None
    assert updated.token_version == 0
    assert updated.hashed_password == old_hash
