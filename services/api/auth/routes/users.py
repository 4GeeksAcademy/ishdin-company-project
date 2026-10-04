from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_user
from auth.models import (
    UserCreate,
    UserRegistrationResponse,
    UserResponse,
    UserRole,
    UserStored,
    UserUpdate,
)
from auth.services.user_service import (
    create_user,
    delete_user,
    get_user_by_id,
    list_users,
    update_user,
)


router = APIRouter(prefix="/users", tags=["Users"])


def _safe_user_response(user: UserStored) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        role=user.role,
        created_at=user.created_at,
    )


def _require_self_or_admin(
    target_user_id: int,
    current_user: UserStored,
) -> None:
    if (
        current_user.id != target_user_id
        and current_user.role != UserRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this user.",
        )


@router.post(
    "",
    response_model=UserRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register_user(payload: UserCreate) -> UserRegistrationResponse:
    try:
        user, profile = create_user(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return UserRegistrationResponse(user=user, profile=profile)


@router.get(
    "",
    response_model=list[UserResponse],
    summary="List all users",
)
def get_users(
    current_user: UserStored = Depends(get_current_user),
) -> list[UserResponse]:
    return list_users()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get one user",
)
def get_user(
    user_id: int,
    current_user: UserStored = Depends(get_current_user),
) -> UserResponse:
    _require_self_or_admin(user_id, current_user)

    user = get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return _safe_user_response(user)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user credentials",
)
def put_user(
    user_id: int,
    payload: UserUpdate,
    current_user: UserStored = Depends(get_current_user),
) -> UserResponse:
    _require_self_or_admin(user_id, current_user)

    caller_is_admin = current_user.role == UserRole.ADMIN

    try:
        updated = update_user(
            user_id,
            payload,
            caller_is_admin=caller_is_admin,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return updated


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user and linked profile",
)
def remove_user(
    user_id: int,
    current_user: UserStored = Depends(get_current_user),
) -> None:
    _require_self_or_admin(user_id, current_user)

    if not delete_user(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
