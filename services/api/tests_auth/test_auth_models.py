from pydantic import ValidationError

from auth.models import UserCreate, UserRole


def test_registration_has_no_role_input_field():
    data = UserCreate(
        email="person@example.com",
        password="StrongPassword123!",
        name="Person",
    )
    assert not hasattr(data, "role")


def test_exact_roles():
    assert UserRole.ADMIN.value == "admin"
    assert UserRole.MANAGER.value == "manager"
    assert UserRole.USER.value == "user"


def test_short_password_rejected():
    try:
        UserCreate(
            email="person@example.com",
            password="short",
        )
        assert False, "Expected ValidationError"
    except ValidationError:
        pass
