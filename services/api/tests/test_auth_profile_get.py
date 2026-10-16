import pytest
from fastapi import HTTPException

import auth.routes.profiles as profile_routes
from auth.models import ProfileResponse


def test_get_profile_happy_path(monkeypatch, sample_user, sample_profile):
    monkeypatch.setattr(profile_routes, "get_profile_by_user_id", lambda user_id: sample_profile)

    assert profile_routes.get_my_profile(sample_user) == sample_profile


def test_get_profile_edge_optional_fields_can_be_none(monkeypatch, sample_user):
    profile = ProfileResponse(id=1, user_id=sample_user.id, name=None, phone=None, address=None)
    monkeypatch.setattr(profile_routes, "get_profile_by_user_id", lambda user_id: profile)

    result = profile_routes.get_my_profile(sample_user)

    assert result.address is None


def test_get_profile_failure_missing_profile_returns_404(monkeypatch, sample_user):
    monkeypatch.setattr(profile_routes, "get_profile_by_user_id", lambda user_id: None)

    with pytest.raises(HTTPException) as exc_info:
        profile_routes.get_my_profile(sample_user)

    assert exc_info.value.status_code == 404
