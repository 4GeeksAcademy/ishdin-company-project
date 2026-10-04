from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_user
from auth.models import ProfileResponse, ProfileUpdate, UserStored
from auth.services.profile_service import (
    get_profile_by_user_id,
    update_profile_for_user,
)


router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get(
    "/me",
    response_model=ProfileResponse,
    summary="Get my profile",
)
def get_my_profile(
    current_user: UserStored = Depends(get_current_user),
) -> ProfileResponse:
    profile = get_profile_by_user_id(current_user.id)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        )

    return profile


@router.put(
    "/me",
    response_model=ProfileResponse,
    summary="Update my profile",
)
def update_my_profile(
    payload: ProfileUpdate,
    current_user: UserStored = Depends(get_current_user),
) -> ProfileResponse:
    profile = update_profile_for_user(current_user.id, payload)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        )

    return profile
