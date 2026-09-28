from tinydb import Query

from auth.database import profiles_table
from auth.models import ProfileResponse, ProfileUpdate


def _to_profile_response(document) -> ProfileResponse:
    return ProfileResponse(**dict(document))


def create_profile(
    user_id: int,
    *,
    name: str | None = None,
    phone: str | None = None,
    address: str | None = None,
) -> ProfileResponse:
    existing = get_profile_by_user_id(user_id)

    if existing is not None:
        return existing

    profile_id = profiles_table.insert(
        {
            "user_id": user_id,
            "name": name,
            "phone": phone,
            "address": address,
        }
    )

    profiles_table.update(
        {"id": profile_id},
        doc_ids=[profile_id],
    )

    document = profiles_table.get(doc_id=profile_id)
    return _to_profile_response(document)


def get_profile_by_user_id(user_id: int) -> ProfileResponse | None:
    query = Query()
    document = profiles_table.get(query.user_id == user_id)

    if document is None:
        return None

    return _to_profile_response(document)


def update_profile_for_user(
    user_id: int,
    payload: ProfileUpdate,
) -> ProfileResponse | None:
    query = Query()
    document = profiles_table.get(query.user_id == user_id)

    if document is None:
        return None

    changes = payload.model_dump(exclude_none=True)

    if changes:
        profiles_table.update(changes, query.user_id == user_id)

    updated = profiles_table.get(query.user_id == user_id)
    return _to_profile_response(updated)


def delete_profile_for_user(user_id: int) -> int:
    query = Query()
    removed_ids = profiles_table.remove(query.user_id == user_id)
    return len(removed_ids)
