import os
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


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int) -> tuple[str, int]:
    expire_minutes = get_access_token_expire_minutes()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=expire_minutes)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "user_id": user_id,
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

    return user_id
