import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import auth.routes.auth as auth_routes
from auth.models import ChangePasswordRequest


def test_change_password_happy_path(monkeypatch, sample_user):
    calls = []

    def fake_change(user_id, current_password, new_password):
        calls.append((user_id, current_password, new_password))
        return True

    monkeypatch.setattr(auth_routes.password_reset_service, "change_password", fake_change)

    result = auth_routes.change_password(
        ChangePasswordRequest(current_password="old-pass", new_password="new-pass"),
        sample_user,
    )

    assert calls == [(sample_user.id, "old-pass", "new-pass")]
    assert result.detail.startswith("Password changed successfully")


def test_change_password_edge_minimum_new_password_length_is_accepted(monkeypatch, sample_user):
    monkeypatch.setattr(auth_routes.password_reset_service, "change_password", lambda *args: True)

    result = auth_routes.change_password(
        ChangePasswordRequest(current_password="x", new_password="12345678"),
        sample_user,
    )

    assert "successfully" in result.detail


def test_change_password_failure_wrong_current_password_returns_400(monkeypatch, sample_user):
    monkeypatch.setattr(auth_routes.password_reset_service, "change_password", lambda *args: False)

    with pytest.raises(HTTPException) as exc_info:
        auth_routes.change_password(
            ChangePasswordRequest(current_password="wrong", new_password="12345678"),
            sample_user,
        )

    assert exc_info.value.status_code == 400


def test_change_password_edge_empty_current_password_is_invalid():
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="", new_password="12345678")
