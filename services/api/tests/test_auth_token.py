from datetime import datetime, timedelta, timezone

import pytest
from jose import JWTError, jwt

from auth.security import (
    JWT_ALGORITHM,
    create_access_token,
    create_password_reset_token,
    decode_access_token_claims,
    decode_password_reset_token,
    get_jwt_secret,
    get_password_reset_secret,
    hash_password,
    verify_password,
)


def test_access_token_happy_path_round_trip():
    token, expires_in = create_access_token(7, token_version=3)

    user_id, token_version = decode_access_token_claims(token)

    assert user_id == 7
    assert token_version == 3
    assert expires_in == 30


def test_access_token_edge_zero_or_negative_subject_is_rejected():
    token = jwt.encode(
        {"sub": "0", "token_version": 0, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(JWTError):
        decode_access_token_claims(token)


def test_access_token_failure_expired_token_is_rejected():
    token = jwt.encode(
        {"sub": "1", "token_version": 0, "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(JWTError):
        decode_access_token_claims(token)


def test_access_token_failure_wrong_signature_is_rejected():
    token = jwt.encode(
        {"sub": "1", "token_version": 0, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "wrong-secret",
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(JWTError):
        decode_access_token_claims(token)


@pytest.mark.parametrize(
    "claims",
    [
        {"token_version": 0},
        {"sub": "abc", "token_version": 0},
        {"sub": "1", "token_version": -1},
        {"sub": "1", "token_version": True},
    ],
)
def test_access_token_failure_invalid_claims_are_rejected(claims):
    claims = {
        **claims,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    token = jwt.encode(claims, get_jwt_secret(), algorithm=JWT_ALGORITHM)

    with pytest.raises(JWTError):
        decode_access_token_claims(token)


def test_password_reset_token_happy_path_round_trip():
    token, jti, expires_at = create_password_reset_token(5)

    user_id, decoded_jti = decode_password_reset_token(token)

    assert user_id == 5
    assert decoded_jti == jti
    assert expires_at > datetime.now(timezone.utc)


def test_password_reset_token_edge_wrong_purpose_is_rejected():
    token = jwt.encode(
        {
            "sub": "5",
            "purpose": "access",
            "jti": "abc",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        get_password_reset_secret(),
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(JWTError):
        decode_password_reset_token(token)


def test_password_reset_token_failure_expired_is_rejected():
    token = jwt.encode(
        {
            "sub": "5",
            "purpose": "password_reset",
            "jti": "abc",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        get_password_reset_secret(),
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(JWTError):
        decode_password_reset_token(token)


def test_password_hash_happy_path_and_wrong_password():
    hashed = hash_password("correct-password")

    assert hashed != "correct-password"
    assert verify_password("correct-password", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_password_hash_failure_corrupted_hash_returns_false():
    assert verify_password("anything", "not-a-valid-bcrypt-hash") is False
