import logging
from datetime import datetime, timezone

from tinydb import Query

from auth.database import users_table
from auth.models import (
    UserCreate,
    UserResponse,
    UserRole,
    UserStored,
    UserUpdate,
)
from auth.security import hash_password
from auth.services.profile_service import (
    create_profile,
    delete_profile_for_user,
    get_profile_by_user_id,
)


logger = logging.getLogger(__name__)


def _to_user_stored(document) -> UserStored:
    return UserStored(**dict(document))


def _to_user_response(document) -> UserResponse:
    stored = _to_user_stored(document)

    return UserResponse(
        id=stored.id,
        email=stored.email,
        is_active=stored.is_active,
        role=stored.role,
        created_at=stored.created_at,
    )


def _rollback_created_user(user_id: int) -> None:
    """Best-effort cleanup for a user creation that failed after insertion."""
    try:
        delete_profile_for_user(user_id)
    except Exception as rollback_error:
        logger.error(
            "User creation rollback could not remove profile "
            "(user_id=%s, error_type=%s).",
            user_id,
            type(rollback_error).__name__,
        )

    try:
        users_table.remove(doc_ids=[user_id])
    except Exception as rollback_error:
        logger.error(
            "User creation rollback could not remove user "
            "(user_id=%s, error_type=%s).",
            user_id,
            type(rollback_error).__name__,
        )


def get_user_by_id(user_id: int) -> UserStored | None:
    document = users_table.get(doc_id=user_id)

    if document is None:
        return None

    return _to_user_stored(document)


def get_user_by_email(email: str) -> UserStored | None:
    query = Query()
    normalized_email = email.strip().lower()
    document = users_table.get(query.email == normalized_email)

    if document is None:
        return None

    return _to_user_stored(document)


def create_user(payload: UserCreate):
    normalized_email = str(payload.email).strip().lower()

    if get_user_by_email(normalized_email) is not None:
        raise ValueError("A user with this email already exists.")

    # Hash before the first database write so a hashing/configuration failure
    # cannot leave a partially-created user record behind.
    hashed_password = hash_password(payload.password)

    user_id = users_table.insert(
        {
            "email": normalized_email,
            "hashed_password": hashed_password,
            "is_active": True,
            "role": UserRole.USER.value,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "token_version": 0,
        }
    )

    try:
        users_table.update(
            {"id": user_id},
            doc_ids=[user_id],
        )
    except Exception:
        _rollback_created_user(user_id)
        raise

    try:
        profile = create_profile(
            user_id,
            name=payload.name,
            phone=payload.phone,
            address=payload.address,
        )
    except Exception:
        _rollback_created_user(user_id)
        raise

    try:
        document = users_table.get(doc_id=user_id)
    except Exception:
        _rollback_created_user(user_id)
        raise

    if document is None:
        _rollback_created_user(user_id)
        raise RuntimeError("User could not be verified after creation.")

    return _to_user_response(document), profile


def list_users() -> list[UserResponse]:
    return [_to_user_response(document) for document in users_table.all()]


def update_user(
    user_id: int,
    payload: UserUpdate,
    *,
    caller_is_admin: bool,
) -> UserResponse | None:
    existing = get_user_by_id(user_id)

    if existing is None:
        return None

    changes: dict = {}

    if payload.email is not None:
        normalized_email = str(payload.email).strip().lower()
        duplicate = get_user_by_email(normalized_email)

        if duplicate is not None and duplicate.id != user_id:
            raise ValueError("A user with this email already exists.")

        changes["email"] = normalized_email

    if payload.password is not None:
        changes["hashed_password"] = hash_password(payload.password)
        changes["token_version"] = existing.token_version + 1

    if payload.role is not None:
        if not caller_is_admin:
            raise PermissionError("Only an admin may change a user's role.")

        changes["role"] = payload.role.value

    if changes:
        users_table.update(changes, doc_ids=[user_id])

    updated = users_table.get(doc_id=user_id)
    return _to_user_response(updated)


def _restore_profile_after_failed_delete(user_id: int, profile) -> None:
    if profile is None:
        return

    try:
        create_profile(
            user_id,
            name=profile.name,
            phone=profile.phone,
            address=profile.address,
        )
    except (OSError, RuntimeError, ValueError) as rollback_error:
        logger.critical(
            "User deletion rollback could not restore profile "
            "(user_id=%s, error_type=%s).",
            user_id,
            type(rollback_error).__name__,
        )


def delete_user(user_id: int) -> bool:
    if get_user_by_id(user_id) is None:
        return False

    profile = get_profile_by_user_id(user_id)
    delete_profile_for_user(user_id)

    try:
        removed_ids = users_table.remove(doc_ids=[user_id])
    except (OSError, ValueError):
        _restore_profile_after_failed_delete(user_id, profile)
        raise

    if not removed_ids:
        _restore_profile_after_failed_delete(user_id, profile)
        raise RuntimeError("User could not be deleted safely.")

    return True
