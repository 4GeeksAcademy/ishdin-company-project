import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import auth.routes.auth as auth_routes
from auth.models import TokenResponse


def test_login_happy_path_returns_token(monkeypatch):
    expected = TokenResponse(access_token="signed.jwt", expires_in_minutes=30)
    monkeypatch.setattr(auth_routes, "login_user", lambda email, password: expected)

    result = asyncio.run(
        auth_routes.login(SimpleNamespace(username="user@example.com", password="correct-password"))
    )

    assert result == expected


def test_login_edge_empty_password_is_rejected(monkeypatch):
    calls = []

    def fake_login(email, password):
        calls.append((email, password))
        return None

    monkeypatch.setattr(auth_routes, "login_user", fake_login)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(auth_routes.login(SimpleNamespace(username="user@example.com", password="")))

    assert calls == [("user@example.com", "")]
    assert exc_info.value.status_code == 401


def test_login_failure_invalid_credentials_returns_401(monkeypatch):
    monkeypatch.setattr(auth_routes, "login_user", lambda email, password: None)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(auth_routes.login(SimpleNamespace(username="missing@example.com", password="wrong")))

    assert exc_info.value.status_code == 401
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}
