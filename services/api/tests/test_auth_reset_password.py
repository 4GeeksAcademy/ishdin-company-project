import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import auth.routes.auth as auth_routes
from auth.models import ResetPasswordRequest


def test_reset_password_happy_path(monkeypatch):
    monkeypatch.setattr(auth_routes.password_reset_service, "reset_password", lambda token, password: True)

    result = auth_routes.reset_password(
        ResetPasswordRequest(token="valid-token", new_password="new-pass")
    )

    assert result.detail == "Password reset successfully. Please sign in again."


def test_reset_password_edge_rejects_empty_token_before_business_call():
    with pytest.raises(ValidationError):
        ResetPasswordRequest(token="", new_password="new-pass")


def test_reset_password_failure_invalid_or_expired_token_returns_400(monkeypatch):
    monkeypatch.setattr(auth_routes.password_reset_service, "reset_password", lambda token, password: False)

    with pytest.raises(HTTPException) as exc_info:
        auth_routes.reset_password(
            ResetPasswordRequest(token="expired-token", new_password="new-pass")
        )

    assert exc_info.value.status_code == 400
    assert "invalid, expired, or already used" in exc_info.value.detail
