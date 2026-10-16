import pytest

import auth.routes.users as user_routes


def test_list_users_happy_path(monkeypatch, sample_user, sample_user_response):
    monkeypatch.setattr(user_routes, "list_users", lambda: [sample_user_response])

    result = user_routes.get_users(sample_user)

    assert result == [sample_user_response]


def test_list_users_edge_empty_directory(monkeypatch, sample_user):
    monkeypatch.setattr(user_routes, "list_users", lambda: [])

    assert user_routes.get_users(sample_user) == []


def test_list_users_failure_storage_error_is_not_silently_converted(monkeypatch, sample_user):
    def fail():
        raise OSError("database unavailable")

    monkeypatch.setattr(user_routes, "list_users", fail)

    with pytest.raises(OSError):
        user_routes.get_users(sample_user)
