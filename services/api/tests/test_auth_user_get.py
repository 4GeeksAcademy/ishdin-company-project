import pytest
from fastapi import HTTPException

import auth.routes.users as user_routes


def test_get_user_happy_path_user_can_read_self(monkeypatch, sample_user, sample_user_response):
    monkeypatch.setattr(user_routes, "get_user_by_id", lambda user_id: sample_user)

    result = user_routes.get_user(sample_user.id, sample_user)

    assert result.id == sample_user_response.id
    assert result.email == sample_user_response.email


def test_get_user_edge_admin_can_read_another_user(monkeypatch, sample_user, admin_user):
    monkeypatch.setattr(user_routes, "get_user_by_id", lambda user_id: sample_user)

    result = user_routes.get_user(sample_user.id, admin_user)

    assert result.id == sample_user.id


def test_get_user_failure_non_admin_cannot_read_another_user(sample_user):
    with pytest.raises(HTTPException) as exc_info:
        user_routes.get_user(2, sample_user)

    assert exc_info.value.status_code == 403


def test_get_user_failure_missing_user_returns_404(monkeypatch, sample_user):
    monkeypatch.setattr(user_routes, "get_user_by_id", lambda user_id: None)

    with pytest.raises(HTTPException) as exc_info:
        user_routes.get_user(sample_user.id, sample_user)

    assert exc_info.value.status_code == 404
