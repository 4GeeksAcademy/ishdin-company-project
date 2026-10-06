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
)


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

    user_id = users_table.insert(
        {
            "email": normalized_email,
            "hashed_password": hash_password(payload.password),
            "is_active": True,
            "role": UserRole.USER.value,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "token_version": 0,
        }
    )

    users_table.update(
        {"id": user_id},
        doc_ids=[user_id],
    )

    profile = create_profile(
        user_id,
        name=payload.name,
        phone=payload.phone,
        address=payload.address,
    )

    document = users_table.get(doc_id=user_id)
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


def delete_user(user_id: int) -> bool:
    if get_user_by_id(user_id) is None:
        return False

    delete_profile_for_user(user_id)
    users_table.remove(doc_ids=[user_id])
    return True
