import pytest
from fastapi import HTTPException
from jose import JWTError

import auth.dependencies as dependencies


def test_get_current_user_happy_path(monkeypatch, sample_user):
    monkeypatch.setattr(dependencies, "decode_access_token_claims", lambda token: (sample_user.id, sample_user.token_version))
    monkeypatch.setattr(dependencies, "get_user_by_id", lambda user_id: sample_user)

    result = dependencies.get_current_user("valid-token")

    assert result == sample_user


def test_get_current_user_edge_stale_token_version_is_rejected(monkeypatch, sample_user):
    monkeypatch.setattr(dependencies, "decode_access_token_claims", lambda token: (sample_user.id, sample_user.token_version + 1))
    monkeypatch.setattr(dependencies, "get_user_by_id", lambda user_id: sample_user)

    with pytest.raises(HTTPException) as exc_info:
        dependencies.get_current_user("stale-token")

    assert exc_info.value.status_code == 401


@pytest.mark.parametrize("mode", ["malformed", "missing", "inactive"])
def test_get_current_user_failure_modes(monkeypatch, sample_user, mode):
    if mode == "malformed":
        def bad_decode(_token):
            raise JWTError("bad token")
        monkeypatch.setattr(dependencies, "decode_access_token_claims", bad_decode)
    else:
        monkeypatch.setattr(dependencies, "decode_access_token_claims", lambda token: (sample_user.id, sample_user.token_version))
        if mode == "missing":
            monkeypatch.setattr(dependencies, "get_user_by_id", lambda user_id: None)
        else:
            inactive = sample_user.model_copy(update={"is_active": False})
            monkeypatch.setattr(dependencies, "get_user_by_id", lambda user_id: inactive)

    with pytest.raises(HTTPException) as exc_info:
        dependencies.get_current_user("token")

    assert exc_info.value.status_code == 401
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


def test_get_current_user_server_configuration_error_is_not_misreported_as_401(monkeypatch):
    def config_failure(_token):
        raise RuntimeError("JWT secret missing")

    monkeypatch.setattr(dependencies, "decode_access_token_claims", config_failure)

    with pytest.raises(RuntimeError, match="JWT secret missing"):
        dependencies.get_current_user("token")
