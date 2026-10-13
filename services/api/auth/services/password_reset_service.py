import logging
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


logger = logging.getLogger(__name__)
_RESET_REQUEST_COOLDOWN = timedelta(seconds=60)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp(value: datetime) -> str:
    return value.isoformat()


def _token_hash(jti: str) -> str:
    return sha256(jti.encode("utf-8")).hexdigest()


def _restore_token_states(previous_states: list[tuple[int, object]]) -> None:
    for doc_id, previous_used_at in previous_states:
        try:
            password_reset_tokens_table.update(
                {"used_at": previous_used_at},
                doc_ids=[doc_id],
            )
        except Exception as rollback_error:
            logger.error(
                "Password reset token rollback failed "
                "(doc_id=%s, error_type=%s).",
                doc_id,
                type(rollback_error).__name__,
            )


def _invalidate_tokens(
    user_id: int,
    *,
    except_hash: str | None = None,
) -> list[tuple[int, object]]:
    """Invalidate active tokens and roll back partial updates on failure."""
    query = Query()
    previous_states: list[tuple[int, object]] = []

    for record in password_reset_tokens_table.search(query.user_id == user_id):
        if record.get("used_at") is not None or record.get("jti_hash") == except_hash:
            continue

        previous_states.append((record.doc_id, record.get("used_at")))
        try:
            password_reset_tokens_table.update(
                {"used_at": _timestamp(_now())},
                doc_ids=[record.doc_id],
            )
        except Exception:
            _restore_token_states(previous_states)
            raise

    return previous_states


def invalidate_password_reset_tokens(user_id: int) -> None:
    with password_change_lock:
        _invalidate_tokens(user_id)


def _prune_expired_tokens(now: datetime) -> None:
    for record in password_reset_tokens_table.all():
        expires_at = record.get("expires_at")
        try:
            expired = datetime.fromisoformat(expires_at) <= now
        except (TypeError, ValueError):
            logger.warning(
                "Discarding password reset token with invalid expires_at "
                "(doc_id=%s).",
                record.doc_id,
            )
            expired = True

        created_at = record.get("created_at")
        try:
            cooldown_elapsed = (
                datetime.fromisoformat(created_at)
                <= now - _RESET_REQUEST_COOLDOWN
            )
        except (TypeError, ValueError):
            logger.warning(
                "Password reset token has invalid created_at "
                "(doc_id=%s).",
                record.doc_id,
            )
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
        hashed_jti = _token_hash(jti)

        new_doc_id = password_reset_tokens_table.insert(
            {
                "user_id": user_id,
                "jti_hash": hashed_jti,
                "created_at": _timestamp(now),
                "expires_at": _timestamp(expires_at),
                "used_at": None,
            }
        )

        try:
            _invalidate_tokens(user_id, except_hash=hashed_jti)
        except Exception:
            try:
                password_reset_tokens_table.remove(doc_ids=[new_doc_id])
            except Exception as rollback_error:
                logger.error(
                    "Could not remove a newly-created reset token after "
                    "invalidation failed (doc_id=%s, error_type=%s).",
                    new_doc_id,
                    type(rollback_error).__name__,
                )
            raise

        return token


def _update_password_and_revoke_tokens(user, new_password: str) -> None:
    """Update password/version and compensate if reset-token revocation fails."""
    hashed_password = hash_password(new_password)
    new_version = user.token_version + 1

    user_service.users_table.update(
        {
            "hashed_password": hashed_password,
            "token_version": new_version,
        },
        doc_ids=[user.id],
    )

    try:
        _invalidate_tokens(user.id)
    except Exception:
        try:
            user_service.users_table.update(
                {
                    "hashed_password": user.hashed_password,
                    "token_version": user.token_version,
                },
                doc_ids=[user.id],
            )
        except Exception as rollback_error:
            logger.critical(
                "Password update rollback failed "
                "(user_id=%s, error_type=%s).",
                user.id,
                type(rollback_error).__name__,
            )
        raise


def reset_password(token: str, new_password: str) -> bool:
    """Consume a reset token once and update the user's password/version."""
    try:
        user_id, jti = decode_password_reset_token(token)
    except JWTError:
        return False

    # Configuration RuntimeError is intentionally allowed to propagate so a
    # server misconfiguration is never reported as an invalid user token.
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
            logger.warning(
                "Password reset token has invalid persisted expiry "
                "(doc_id=%s).",
                record.doc_id,
            )
            return False

        if expires_at <= now:
            return False

        user = user_service.get_user_by_id(user_id)
        if user is None or not user.is_active:
            return False

        _update_password_and_revoke_tokens(user, new_password)
        return True


def change_password(user_id: int, current_password: str, new_password: str) -> bool:
    """Verify current credentials, update password, and revoke reset links."""
    with password_change_lock:
        user = user_service.get_user_by_id(user_id)
        if user is None or not verify_password(current_password, user.hashed_password):
            return False

        _update_password_and_revoke_tokens(user, new_password)
        return True