from datetime import datetime, timezone

import pytest

from auth.models import ProfileResponse, UserResponse, UserRole, UserStored


@pytest.fixture
def sample_user() -> UserStored:
    return UserStored(
        id=1,
        email="user1@example.com",
        hashed_password="unused-test-hash",
        is_active=True,
        role=UserRole.USER,
        created_at=datetime.now(timezone.utc),
        token_version=0,
    )


@pytest.fixture
def admin_user() -> UserStored:
    return UserStored(
        id=3,
        email="user3@example.com",
        hashed_password="unused-test-hash",
        is_active=True,
        role=UserRole.ADMIN,
        created_at=datetime.now(timezone.utc),
        token_version=0,
    )


@pytest.fixture
def sample_profile() -> ProfileResponse:
    return ProfileResponse(
        id=1,
        user_id=1,
        name="Test User",
        phone="555-0100",
        address="1 Test Way",
    )


@pytest.fixture
def sample_user_response(sample_user: UserStored) -> UserResponse:
    return UserResponse(
        id=sample_user.id,
        email=sample_user.email,
        is_active=sample_user.is_active,
        role=sample_user.role,
        created_at=sample_user.created_at,
    )
