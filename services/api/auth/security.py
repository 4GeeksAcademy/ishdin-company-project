import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.hash import bcrypt


load_dotenv()

JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY")

    if not secret:
        raise RuntimeError(
            "JWT_SECRET_KEY is not configured. "
            "Create services/api/.env from .env.example."
        )

    return secret


def get_access_token_expire_minutes() -> int:
    raw_value = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

    try:
        minutes = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(
            "ACCESS_TOKEN_EXPIRE_MINUTES must be an integer."
        ) from exc

    if minutes <= 0:
        raise RuntimeError(
            "ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero."
        )

    return minutes


def get_password_reset_secret() -> str:
    secret = os.getenv("PASSWORD_RESET_SECRET_KEY")
    if not secret or len(secret) < 32:
        raise RuntimeError("PASSWORD_RESET_SECRET_KEY must contain at least 32 characters.")
    return secret


def get_password_reset_expire_minutes() -> int:
    raw_value = os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "30")
    try:
        minutes = int(raw_value)
    except ValueError as exc:
        raise RuntimeError("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES must be an integer.") from exc
    if not 15 <= minutes <= 60:
        raise RuntimeError("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES must be between 15 and 60.")
    return minutes


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, token_version: int = 0) -> tuple[str, int]:
    expire_minutes = get_access_token_expire_minutes()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=expire_minutes)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "user_id": user_id,
        "token_version": token_version,
        "iat": now,
        "exp": expires_at,
    }

    token = jwt.encode(
        payload,
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )

    return token, expire_minutes


def decode_access_token(token: str) -> int:
    user_id, _ = decode_access_token_claims(token)
    return user_id


def decode_access_token_claims(token: str) -> tuple[int, int]:
    payload = jwt.decode(
        token,
        get_jwt_secret(),
        algorithms=[JWT_ALGORITHM],
    )

    subject = payload.get("sub")

    if subject is None:
        raise JWTError("Token is missing subject.")

    try:
        user_id = int(subject)
    except (TypeError, ValueError) as exc:
        raise JWTError("Token subject is invalid.") from exc

    if user_id <= 0:
        raise JWTError("Token subject is invalid.")

    token_version = payload.get("token_version", 0)
    if not isinstance(token_version, int) or isinstance(token_version, bool) or token_version < 0:
        raise JWTError("Token version is invalid.")

    return user_id, token_version


def create_password_reset_token(user_id: int) -> tuple[str, str, datetime]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=get_password_reset_expire_minutes())
    jti = secrets.token_urlsafe(32)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "purpose": "password_reset",
            "jti": jti,
            "iat": now,
            "exp": expires_at,
        },
        get_password_reset_secret(),
        algorithm=JWT_ALGORITHM,
    )
    return token, jti, expires_at


def decode_password_reset_token(token: str) -> tuple[int, str]:
    payload = jwt.decode(
        token,
        get_password_reset_secret(),
        algorithms=[JWT_ALGORITHM],
    )
    if payload.get("purpose") != "password_reset":
        raise JWTError("Token is not a password reset token.")
    subject = payload.get("sub")
    jti = payload.get("jti")
    try:
        user_id = int(subject)
    except (TypeError, ValueError) as exc:
        raise JWTError("Token subject is invalid.") from exc
    if user_id <= 0 or not isinstance(jti, str) or not jti:
        raise JWTError("Password reset token claims are invalid.")
    return user_id, jti
