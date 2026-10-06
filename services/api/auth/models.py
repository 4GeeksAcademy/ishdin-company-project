from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(..., min_length=8)
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class UserStored(BaseModel):
    id: int = Field(..., gt=0)
    email: EmailStr
    hashed_password: str
    is_active: bool = True
    role: UserRole = UserRole.USER
    created_at: datetime
    token_version: int = Field(default=0, ge=0)


class UserResponse(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: int
    email: EmailStr
    is_active: bool
    role: UserRole
    created_at: datetime


class UserUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[UserRole] = None


class ProfileStored(BaseModel):
    id: int = Field(..., gt=0)
    user_id: int = Field(..., gt=0)
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class ProfileResponse(ProfileStored):
    pass


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class MessageResponse(BaseModel):
    detail: str


class AuthMeResponse(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    profile: ProfileResponse


class UserRegistrationResponse(BaseModel):
    user: UserResponse
    profile: ProfileResponse
