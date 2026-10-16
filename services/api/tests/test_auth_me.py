import pytest
from fastapi import HTTPException

import auth.routes.auth as auth_routes
from auth.models import ProfileResponse


def test_auth_me_happy_path_returns_user_and_profile(monkeypatch, sample_user, sample_profile):
    monkeypatch.setattr(auth_routes, "get_profile_by_user_id", lambda user_id: sample_profile)

    result = auth_routes.auth_me(sample_user)

    assert result.id == sample_user.id
    assert result.email == sample_user.email
    assert result.profile == sample_profile


def test_auth_me_edge_profile_optional_fields_can_be_empty(monkeypatch, sample_user):
    profile = ProfileResponse(id=9, user_id=sample_user.id, name=None, phone=None, address=None)
    monkeypatch.setattr(auth_routes, "get_profile_by_user_id", lambda user_id: profile)

    result = auth_routes.auth_me(sample_user)

    assert result.profile.name is None
    assert result.profile.phone is None


def test_auth_me_failure_missing_profile_returns_404(monkeypatch, sample_user):
    monkeypatch.setattr(auth_routes, "get_profile_by_user_id", lambda user_id: None)

    with pytest.raises(HTTPException) as exc_info:
        auth_routes.auth_me(sample_user)

    assert exc_info.value.status_code == 404
