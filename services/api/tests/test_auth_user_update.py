import pytest
from fastapi import HTTPException

import auth.routes.users as user_routes
from auth.models import UserRole, UserUpdate


def test_update_user_happy_path_updates_email(monkeypatch, sample_user, sample_user_response):
    calls = []

    def fake_update(user_id, payload, *, caller_is_admin):
        calls.append((user_id, payload.email, caller_is_admin))
        return sample_user_response

    monkeypatch.setattr(user_routes, "update_user", fake_update)

    result = user_routes.put_user(
        sample_user.id,
        UserUpdate(email="changed@example.com"),
        sample_user,
    )

    assert result == sample_user_response
    assert calls == [(sample_user.id, "changed@example.com", False)]


def test_update_user_edge_admin_password_change_revokes_reset_tokens(monkeypatch, sample_user, admin_user, sample_user_response):
    invalidated = []
    monkeypatch.setattr(user_routes, "update_user", lambda *args, **kwargs: sample_user_response)
    monkeypatch.setattr(user_routes, "invalidate_password_reset_tokens", lambda user_id: invalidated.append(user_id))

    result = user_routes.put_user(
        sample_user.id,
        UserUpdate(password="new-pass"),
        admin_user,
    )

    assert result == sample_user_response
    assert invalidated == [sample_user.id]


def test_update_user_failure_non_admin_direct_password_change_is_forbidden(sample_user):
    with pytest.raises(HTTPException) as exc_info:
        user_routes.put_user(
            sample_user.id,
            UserUpdate(password="new-pass"),
            sample_user,
        )

    assert exc_info.value.status_code == 403


def test_update_user_failure_duplicate_email_returns_409(monkeypatch, sample_user):
    def duplicate(*args, **kwargs):
        raise ValueError("duplicate")

    monkeypatch.setattr(user_routes, "update_user", duplicate)

    with pytest.raises(HTTPException) as exc_info:
        user_routes.put_user(sample_user.id, UserUpdate(email="taken@example.com"), sample_user)

    assert exc_info.value.status_code == 409


def test_update_user_failure_role_change_without_admin_permission_returns_403(monkeypatch, sample_user):
    def forbidden(*args, **kwargs):
        raise PermissionError("role")

    monkeypatch.setattr(user_routes, "update_user", forbidden)

    with pytest.raises(HTTPException) as exc_info:
        user_routes.put_user(sample_user.id, UserUpdate(role=UserRole.MANAGER), sample_user)

    assert exc_info.value.status_code == 403
