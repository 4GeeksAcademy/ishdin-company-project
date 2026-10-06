from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from auth.models import UserStored
from auth.security import decode_access_token_claims
from auth.services.user_service import get_user_by_id


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> UserStored:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        user_id, token_version = decode_access_token_claims(token)
    except (JWTError, RuntimeError):
        raise credentials_exception

    user = get_user_by_id(user_id)

    if user is None or not user.is_active or user.token_version != token_version:
        raise credentials_exception

    return user
