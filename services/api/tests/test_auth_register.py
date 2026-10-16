import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import auth.routes.users as user_routes
from auth.models import ProfileResponse, UserCreate


def test_register_happy_path(monkeypatch, sample_user_response, sample_profile):
    monkeypatch.setattr(user_routes, "create_user", lambda payload: (sample_user_response, sample_profile))

    result = user_routes.register_user(
        UserCreate(email="new@example.com", password="password123", name="New User")
    )

    assert result.user.email == sample_user_response.email
    assert result.profile == sample_profile


def test_register_edge_optional_profile_fields_may_be_omitted(monkeypatch, sample_user_response):
    profile = ProfileResponse(id=1, user_id=1, name=None, phone=None, address=None)
    monkeypatch.setattr(user_routes, "create_user", lambda payload: (sample_user_response, profile))

    result = user_routes.register_user(
        UserCreate(email="new@example.com", password="password123")
    )

    assert result.profile.name is None


def test_register_edge_empty_or_short_password_is_rejected():
    for password in ("", "       ", "1234567"):
        with pytest.raises(ValidationError):
            UserCreate(email="new@example.com", password=password)


def test_register_failure_duplicate_user_returns_409(monkeypatch):
    def duplicate(_payload):
        raise ValueError("duplicate")

    monkeypatch.setattr(user_routes, "create_user", duplicate)

    with pytest.raises(HTTPException) as exc_info:
        user_routes.register_user(UserCreate(email="existing@example.com", password="password123"))

    assert exc_info.value.status_code == 409
    assert "already exists" in exc_info.value.detail
