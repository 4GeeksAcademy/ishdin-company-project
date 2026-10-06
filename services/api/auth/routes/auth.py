import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from auth.dependencies import get_current_user
from auth.models import (
    AuthMeResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    MessageResponse,
    ProfileResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserStored,
)
from auth.services import password_reset_service
from auth.services.auth_service import login_user
from auth.services.email_service import send_password_reset_email
from auth.services.profile_service import get_profile_by_user_id
from auth.services.user_service import get_user_by_email


router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


def _process_password_reset_request(email: str) -> None:
    try:
        user = get_user_by_email(email)
        if user is not None and user.is_active:
            token = password_reset_service.issue_password_reset_token(user.id)
            if token:
                send_password_reset_email(str(user.email), token)
    except Exception:
        logger.warning("Password reset request could not be processed.")


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


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request a password reset link",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
) -> MessageResponse:
    background_tasks.add_task(_process_password_reset_request, str(payload.email))
    return MessageResponse(
        detail="If that address is registered, you'll receive a link shortly."
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Set a new password using a one-time reset token",
)
def reset_password(payload: ResetPasswordRequest) -> MessageResponse:
    if not password_reset_service.reset_password(payload.token, payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The reset token is invalid, expired, or already used.",
        )
    return MessageResponse(detail="Password reset successfully. Please sign in again.")


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change the authenticated user's password",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: UserStored = Depends(get_current_user),
) -> MessageResponse:
    if not password_reset_service.change_password(
        current_user.id,
        payload.current_password,
        payload.new_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The current password is incorrect.",
        )
    return MessageResponse(detail="Password changed successfully. Please sign in again.")


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
