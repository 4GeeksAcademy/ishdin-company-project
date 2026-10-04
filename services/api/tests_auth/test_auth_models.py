from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from auth.models import UserCreate, UserRole
from auth.services.user_service import create_user

client = TestClient(app)


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


def test_oauth2_password_login_accepts_form_credentials():
    email = f"oauth-form-user-{uuid4().hex[:8]}@example.com"
    password = "StrongPassword123!"
    create_user(
        UserCreate(
            email=email,
            password=password,
            name="OAuth User",
        )
    )

    schema = app.openapi()
    form_content = schema["paths"]["/auth/login"]["post"]["requestBody"]["content"]
    assert "application/x-www-form-urlencoded" in form_content

    response = client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert "access_token" in body
