import pytest
from fastapi import HTTPException

import auth.routes.profiles as profile_routes
from auth.models import ProfileUpdate


def test_update_profile_happy_path(monkeypatch, sample_user, sample_profile):
    monkeypatch.setattr(profile_routes, "update_profile_for_user", lambda user_id, payload: sample_profile)

    result = profile_routes.update_my_profile(ProfileUpdate(name="Updated"), sample_user)

    assert result == sample_profile


def test_update_profile_edge_partial_update_is_allowed(monkeypatch, sample_user, sample_profile):
    captured = []

    def fake_update(user_id, payload):
        captured.append(payload.model_dump(exclude_none=True))
        return sample_profile

    monkeypatch.setattr(profile_routes, "update_profile_for_user", fake_update)

    profile_routes.update_my_profile(ProfileUpdate(phone="555-9999"), sample_user)

    assert captured == [{"phone": "555-9999"}]


def test_update_profile_failure_missing_profile_returns_404(monkeypatch, sample_user):
    monkeypatch.setattr(profile_routes, "update_profile_for_user", lambda user_id, payload: None)

    with pytest.raises(HTTPException) as exc_info:
        profile_routes.update_my_profile(ProfileUpdate(name="Updated"), sample_user)

    assert exc_info.value.status_code == 404
