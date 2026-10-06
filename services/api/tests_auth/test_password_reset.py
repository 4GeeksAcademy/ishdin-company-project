from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256

from fastapi.testclient import TestClient
from jose import jwt

import auth.services.password_reset_service as password_reset_service
import auth.routes.auth as auth_routes
from app.main import app
from auth.security import (
    JWT_ALGORITHM,
    create_access_token,
    get_password_reset_secret,
    hash_password,
    verify_password,
)


client = TestClient(app)


def test_reset_token_is_hashed_stored_one_time_and_revokes_access(isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[1])
    access_token, _ = create_access_token(1)

    reset_token = password_reset_service.issue_password_reset_token(1)
    assert reset_token
    claims = jwt.decode(reset_token, get_password_reset_secret(), algorithms=[JWT_ALGORITHM])
    record = password_reset_service.password_reset_tokens_table.all()[0]
    assert record["jti_hash"] == sha256(claims["jti"].encode()).hexdigest()
    assert claims["jti"] not in record["jti_hash"]

    assert password_reset_service.reset_password(reset_token, "new-password")
    assert not password_reset_service.reset_password(reset_token, "reused-password")
    updated = users.get(doc_id=1)
    assert updated["token_version"] == 1
    assert verify_password("new-password", updated["hashed_password"])
    assert not verify_password("reused-password", updated["hashed_password"])

    response = client.get("/users", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 401
    login = client.post("/auth/login", data={"username": "user1@example.com", "password": "new-password"})
    assert login.status_code == 200
    assert client.get(
        "/users", headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    ).status_code == 200


def test_tampered_wrong_purpose_and_replayed_tokens_are_rejected(isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[1])
    token = password_reset_service.issue_password_reset_token(1)
    claims = jwt.decode(token, get_password_reset_secret(), algorithms=[JWT_ALGORITHM])
    claims["purpose"] = "access"
    wrong_purpose = jwt.encode(claims, get_password_reset_secret(), algorithm=JWT_ALGORITHM)
    tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
    assert not password_reset_service.reset_password(tampered, "new-password")
    assert not password_reset_service.reset_password(wrong_purpose, "new-password")
    assert verify_password("old-password", users.get(doc_id=1)["hashed_password"])
    assert password_reset_service.reset_password(token, "new-password")
    assert not password_reset_service.reset_password(token, "replayed-password")


def test_concurrent_reset_requests_can_consume_a_token_only_once(isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[1])
    token = password_reset_service.issue_password_reset_token(1)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(
            lambda password: password_reset_service.reset_password(token, password),
            ["first-new-password", "second-new-password"],
        ))
    assert sorted(results) == [False, True]
    stored = users.get(doc_id=1)["hashed_password"]
    assert sum(
        verify_password(password, stored)
        for password in ["first-new-password", "second-new-password"]
    ) == 1


def test_expired_token_is_rejected(monkeypatch, isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[1])
    token = password_reset_service.issue_password_reset_token(1)
    record = password_reset_service.password_reset_tokens_table.all()[0]
    password_reset_service.password_reset_tokens_table.update(
        {"expires_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()},
        doc_ids=[record.doc_id],
    )
    assert not password_reset_service.reset_password(token, "new-password")
    assert verify_password("old-password", users.get(doc_id=1)["hashed_password"])

    now = datetime.now(timezone.utc)
    signed_expired = jwt.encode(
        {
            "sub": "1",
            "purpose": "password_reset",
            "jti": "expired-token-jti",
            "iat": now - timedelta(minutes=20),
            "exp": now - timedelta(minutes=1),
        },
        get_password_reset_secret(),
        algorithm=JWT_ALGORITHM,
    )
    assert not password_reset_service.reset_password(signed_expired, "new-password")


def test_new_reset_request_invalidates_previous_token(isolated_storage):
    first = password_reset_service.issue_password_reset_token(1)
    password_reset_service.password_reset_tokens_table.update(
        {"created_at": (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()}
    )
    second = password_reset_service.issue_password_reset_token(1)
    assert first and second and first != second
    assert not password_reset_service.reset_password(first, "old-link-password")
    assert password_reset_service.reset_password(second, "new-password")


def test_change_password_requires_current_password_and_invalidates_old_token(isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("current-password")}, doc_ids=[1])
    assert password_reset_service.issue_password_reset_token(1)
    assert not password_reset_service.change_password(1, "wrong-password", "new-password")
    assert verify_password("current-password", users.get(doc_id=1)["hashed_password"])
    assert password_reset_service.change_password(1, "current-password", "new-password")
    assert verify_password("new-password", users.get(doc_id=1)["hashed_password"])
    assert users.get(doc_id=1)["token_version"] == 1
    assert password_reset_service.password_reset_tokens_table.all()[0]["used_at"] is not None


def test_forgot_password_always_returns_same_200_and_only_schedules_for_active_user(
    monkeypatch, isolated_storage,
):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[1])
    sent = []
    monkeypatch.setattr(auth_routes, "send_password_reset_email", lambda email, token: sent.append((email, token)))

    existing = client.post("/auth/forgot-password", json={"email": "user1@example.com"})
    missing = client.post("/auth/forgot-password", json={"email": "missing@example.com"})
    assert existing.status_code == missing.status_code == 200
    assert existing.json() == missing.json()
    assert len(sent) == 1
    assert sent[0][0] == "user1@example.com"
    repeated = client.post("/auth/forgot-password", json={"email": "user1@example.com"})
    assert repeated.status_code == 200
    assert repeated.json() == existing.json()
    assert len(sent) == 1

    users.update({"is_active": False}, doc_ids=[1])
    inactive = client.post("/auth/forgot-password", json={"email": "user1@example.com"})
    assert inactive.status_code == 200
    assert inactive.json() == existing.json()
    assert len(sent) == 1


def test_forgot_password_mail_failure_keeps_generic_200(monkeypatch, isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[1])

    def fail_delivery(email, token):
        raise RuntimeError("provider failure must not leak")

    monkeypatch.setattr(auth_routes, "send_password_reset_email", fail_delivery)
    existing = client.post("/auth/forgot-password", json={"email": "user1@example.com"})
    missing = client.post("/auth/forgot-password", json={"email": "missing@example.com"})
    assert existing.status_code == missing.status_code == 200
    assert existing.json() == missing.json()


def test_reset_endpoint_returns_400_for_invalid_and_reused_tokens(isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[1])
    bad_token = client.post(
        "/auth/reset-password", json={"token": "invalid", "new_password": "new-password"},
    )
    assert bad_token.status_code == 400

    token = password_reset_service.issue_password_reset_token(1)
    success = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "new-password"},
    )
    replay = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "again-password"},
    )
    assert success.status_code == 200
    assert replay.status_code == 400
    assert verify_password("new-password", users.get(doc_id=1)["hashed_password"])


def test_change_password_endpoint_requires_auth_and_current_password(isolated_storage):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("current-password")}, doc_ids=[1])
    anonymous = client.post("/auth/change-password", json={
        "current_password": "current-password", "new_password": "new-password",
    })
    assert anonymous.status_code == 401

    old_token, _ = create_access_token(1)
    headers = {"Authorization": f"Bearer {old_token}"}
    wrong = client.post("/auth/change-password", headers=headers, json={
        "current_password": "wrong-password", "new_password": "new-password",
    })
    assert wrong.status_code == 400
    assert verify_password("current-password", users.get(doc_id=1)["hashed_password"])

    changed = client.post("/auth/change-password", headers=headers, json={
        "current_password": "current-password", "new_password": "new-password",
    })
    assert changed.status_code == 200
    assert verify_password("new-password", users.get(doc_id=1)["hashed_password"])
    assert client.get("/users", headers=headers).status_code == 401


def test_user_password_update_route_cannot_bypass_current_password(isolated_storage, auth_headers):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("current-password")}, doc_ids=[1])
    response = client.put(
        "/users/1",
        headers=auth_headers(),
        json={"password": "bypass-password"},
    )
    assert response.status_code == 403
    assert verify_password("current-password", users.get(doc_id=1)["hashed_password"])


def test_admin_password_update_revokes_access_and_reset_tokens(isolated_storage, auth_headers):
    users, _ = isolated_storage
    users.update({"hashed_password": hash_password("old-password")}, doc_ids=[2])
    reset_token = password_reset_service.issue_password_reset_token(2)
    response = client.put(
        "/users/2",
        headers=auth_headers(3),
        json={"password": "admin-reset-password"},
    )
    assert response.status_code == 200
    assert not password_reset_service.reset_password(reset_token, "stale-reset-password")
    assert users.get(doc_id=2)["token_version"] == 1


def test_resend_email_is_mobile_readable_and_uses_configured_origin(monkeypatch):
    import auth.services.email_service as email_service

    monkeypatch.setenv("RESEND_API_KEY", "test-resend-key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "TrackFlow <noreply@example.com>")
    monkeypatch.setenv("BACKOFFICE_BASE_URL", "https://backoffice.example.com/")
    sent = []
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda message: sent.append(message))
    email_service.send_password_reset_email("person@example.com", "signed.token-value")

    assert len(sent) == 1
    assert sent[0]["to"] == ["person@example.com"]
    assert "name=\"viewport\"" in sent[0]["html"]
    assert "https://backoffice.example.com/reset-password?token=signed.token-value" in sent[0]["text"]


def test_resend_email_failure_logs_error_type_without_exception_details(monkeypatch, caplog):
    import auth.services.email_service as email_service

    monkeypatch.setenv("RESEND_API_KEY", "test-resend-key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "TrackFlow <noreply@example.com>")
    monkeypatch.setenv("BACKOFFICE_BASE_URL", "https://backoffice.example.com")

    def fail_send(_message):
        raise RuntimeError("sensitive provider response")

    monkeypatch.setattr(email_service.resend.Emails, "send", fail_send)
    email_service.send_password_reset_email("person@example.com", "signed.token-value")

    assert "error_type=RuntimeError" in caplog.text
    assert "sensitive provider response" not in caplog.text


def test_resend_validation_error_logs_redacted_provider_reason(monkeypatch, caplog):
    import resend
    import auth.services.email_service as email_service

    monkeypatch.setenv("RESEND_API_KEY", "test-resend-key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    monkeypatch.setenv("BACKOFFICE_BASE_URL", "https://backoffice.example.com")

    def reject_send(_message):
        raise resend.exceptions.ValidationError(
            "Only test-account@example.com is allowed. "
            "Reset link: https://backoffice.example.com/reset-password?token=secret",
            "validation_error",
            422,
        )

    monkeypatch.setattr(email_service.resend.Emails, "send", reject_send)
    email_service.send_password_reset_email("test-account@example.com", "signed.token-value")

    assert "provider_error_type=validation_error" in caplog.text
    assert "status=422" in caplog.text
    assert "Only [redacted email] is allowed" in caplog.text
    assert "test-account@example.com" not in caplog.text
    assert "secret" not in caplog.text


def test_resend_email_rejects_invalid_sender_before_provider_call(monkeypatch, caplog):
    import auth.services.email_service as email_service

    monkeypatch.setenv("RESEND_API_KEY", "test-resend-key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "TrackFlow <noreply>")
    provider_calls = []
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda message: provider_calls.append(message))

    email_service.send_password_reset_email("person@example.com", "signed.token-value")

    assert provider_calls == []
    assert "RESEND_FROM_EMAIL is invalid" in caplog.text


def test_reset_expiry_is_limited_to_15_through_60_minutes(monkeypatch):
    from auth.security import get_password_reset_expire_minutes

    for value in ["15", "30", "60"]:
        monkeypatch.setenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", value)
        assert get_password_reset_expire_minutes() == int(value)
    for value in ["14", "61", "invalid"]:
        monkeypatch.setenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", value)
        try:
            get_password_reset_expire_minutes()
            assert False, f"Expected invalid expiry: {value}"
        except RuntimeError:
            pass