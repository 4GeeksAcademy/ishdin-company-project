from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from auth.dependencies import get_current_user
from auth.models import (
    AuthMeResponse,
    ProfileResponse,
    TokenResponse,
    UserStored,
)
from auth.services.auth_service import login_user
from auth.services.profile_service import get_profile_by_user_id


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive a JWT access token",
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> TokenResponse:
    token = login_user(form_data.username, form_data.password)

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token


@router.get(
    "/me",
    response_model=AuthMeResponse,
    summary="Return the authenticated user and linked profile",
)
def auth_me(
    current_user: UserStored = Depends(get_current_user),
) -> AuthMeResponse:
    profile = get_profile_by_user_id(current_user.id)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        )

    return AuthMeResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        profile=profile,
    )
