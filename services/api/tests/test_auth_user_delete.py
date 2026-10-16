import pytest
from fastapi import HTTPException

import auth.routes.users as user_routes


def test_delete_user_happy_path_user_can_delete_self(monkeypatch, sample_user):
    deleted = []
    monkeypatch.setattr(user_routes, "delete_user", lambda user_id: deleted.append(user_id) or True)

    result = user_routes.remove_user(sample_user.id, sample_user)

    assert result is None
    assert deleted == [sample_user.id]


def test_delete_user_edge_admin_can_delete_another_user(monkeypatch, sample_user, admin_user):
    deleted = []
    monkeypatch.setattr(user_routes, "delete_user", lambda user_id: deleted.append(user_id) or True)

    user_routes.remove_user(sample_user.id, admin_user)

    assert deleted == [sample_user.id]


def test_delete_user_failure_non_admin_cannot_delete_another_user(sample_user):
    with pytest.raises(HTTPException) as exc_info:
        user_routes.remove_user(2, sample_user)

    assert exc_info.value.status_code == 403


def test_delete_user_failure_missing_user_returns_404(monkeypatch, sample_user):
    monkeypatch.setattr(user_routes, "delete_user", lambda user_id: False)

    with pytest.raises(HTTPException) as exc_info:
        user_routes.remove_user(sample_user.id, sample_user)

    assert exc_info.value.status_code == 404
