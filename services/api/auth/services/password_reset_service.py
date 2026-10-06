from datetime import datetime, timedelta, timezone
from hashlib import sha256

from jose import JWTError
from tinydb import Query

import auth.services.user_service as user_service
from auth.database import password_reset_tokens_table
from auth.security import (
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from auth.services.password_lock import password_change_lock


_RESET_REQUEST_COOLDOWN = timedelta(seconds=60)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp(value: datetime) -> str:
    return value.isoformat()


def _token_hash(jti: str) -> str:
    return sha256(jti.encode("utf-8")).hexdigest()


def _invalidate_tokens(user_id: int, *, except_hash: str | None = None) -> None:
    query = Query()
    for record in password_reset_tokens_table.search(query.user_id == user_id):
        if record.get("used_at") is not None or record.get("jti_hash") == except_hash:
            continue
        password_reset_tokens_table.update(
            {"used_at": _timestamp(_now())},
            doc_ids=[record.doc_id],
        )


def invalidate_password_reset_tokens(user_id: int) -> None:
    with password_change_lock:
        _invalidate_tokens(user_id)


def _prune_expired_tokens(now: datetime) -> None:
    for record in password_reset_tokens_table.all():
        expires_at = record.get("expires_at")
        try:
            expired = datetime.fromisoformat(expires_at) <= now
        except (TypeError, ValueError):
            expired = True
        created_at = record.get("created_at")
        try:
            cooldown_elapsed = datetime.fromisoformat(created_at) <= now - _RESET_REQUEST_COOLDOWN
        except (TypeError, ValueError):
            cooldown_elapsed = True
        if expired or (record.get("used_at") is not None and cooldown_elapsed):
            password_reset_tokens_table.remove(doc_ids=[record.doc_id])


def issue_password_reset_token(user_id: int) -> str | None:
    """Create a signed token and persist only its one-time-use JTI hash."""
    now = _now()
    query = Query()
    with password_change_lock:
        _prune_expired_tokens(now)
        recent = password_reset_tokens_table.search(
            (query.user_id == user_id)
            & (query.created_at >= _timestamp(now - _RESET_REQUEST_COOLDOWN))
        )
        if recent:
            return None

        token, jti, expires_at = create_password_reset_token(user_id)
        _invalidate_tokens(user_id)
        password_reset_tokens_table.insert(
            {
                "user_id": user_id,
                "jti_hash": _token_hash(jti),
                "created_at": _timestamp(now),
                "expires_at": _timestamp(expires_at),
                "used_at": None,
            }
        )
        return token


def reset_password(token: str, new_password: str) -> bool:
    """Consume a reset token once and update the user's password/version."""
    try:
        user_id, jti = decode_password_reset_token(token)
    except (JWTError, RuntimeError):
        return False

    hashed_jti = _token_hash(jti)
    now = _now()
    query = Query()

    with password_change_lock:
        record = password_reset_tokens_table.get(query.jti_hash == hashed_jti)
        if (
            record is None
            or record.get("user_id") != user_id
            or record.get("used_at") is not None
        ):
            return False
        try:
            expires_at = datetime.fromisoformat(record["expires_at"])
        except (KeyError, TypeError, ValueError):
            return False
        if expires_at <= now:
            return False

        user = user_service.get_user_by_id(user_id)
        if user is None or not user.is_active:
            return False

        hashed_password = hash_password(new_password)
        _invalidate_tokens(user_id)
        user_service.users_table.update(
            {
                "hashed_password": hashed_password,
                "token_version": user.token_version + 1,
            },
            doc_ids=[user_id],
        )
        return True


def change_password(user_id: int, current_password: str, new_password: str) -> bool:
    """Verify current credentials, update password, and revoke reset links."""
    with password_change_lock:
        user = user_service.get_user_by_id(user_id)
        if user is None or not verify_password(current_password, user.hashed_password):
            return False

        hashed_password = hash_password(new_password)
        _invalidate_tokens(user_id)
        user_service.users_table.update(
            {
                "hashed_password": hashed_password,
                "token_version": user.token_version + 1,
            },
            doc_ids=[user_id],
        )
        return True