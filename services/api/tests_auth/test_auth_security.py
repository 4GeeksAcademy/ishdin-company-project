from auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from jose import jwt


def test_password_is_hashed_and_verified():
    password = "StrongPassword123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_round_trip(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "test-only-secret")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

    token, _ = create_access_token(42)

    assert decode_access_token(token) == 42


def test_access_token_without_version_claim_defaults_to_legacy_version(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "test-only-secret")
    token = jwt.encode({"sub": "42"}, "test-only-secret", algorithm="HS256")
    assert decode_access_token(token) == 42
