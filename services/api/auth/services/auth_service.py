from auth.models import TokenResponse
from auth.security import create_access_token, verify_password
from auth.services.user_service import get_user_by_email


def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)

    if user is None or not user.is_active:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


def login_user(email: str, password: str) -> TokenResponse | None:
    user = authenticate_user(email, password)

    if user is None:
        return None

    token, expire_minutes = create_access_token(user.id, user.token_version)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=expire_minutes,
    )
