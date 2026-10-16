import logging

import auth.routes.auth as auth_routes
from auth.models import ForgotPasswordRequest


class RecordingBackgroundTasks:
    def __init__(self):
        self.calls = []

    def add_task(self, func, *args, **kwargs):
        self.calls.append((func, args, kwargs))


def test_forgot_password_happy_path_schedules_processing():
    background = RecordingBackgroundTasks()

    result = auth_routes.forgot_password(
        ForgotPasswordRequest(email="user@example.com"),
        background,
    )

    assert result.detail == "If that address is registered, you'll receive a link shortly."
    assert background.calls == [
        (auth_routes._process_password_reset_request, ("user@example.com",), {})
    ]


def test_forgot_password_edge_unknown_email_does_not_reveal_account(monkeypatch):
    monkeypatch.setattr(auth_routes, "get_user_by_email", lambda email: None)
    issued = []
    sent = []
    monkeypatch.setattr(auth_routes.password_reset_service, "issue_password_reset_token", lambda user_id: issued.append(user_id))
    monkeypatch.setattr(auth_routes, "send_password_reset_email", lambda email, token: sent.append((email, token)))

    auth_routes._process_password_reset_request("unknown@example.com")

    assert issued == []
    assert sent == []


def test_forgot_password_failure_background_error_is_contained(monkeypatch, sample_user, caplog):
    monkeypatch.setattr(auth_routes, "get_user_by_email", lambda email: sample_user)

    def fail(_user_id):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(auth_routes.password_reset_service, "issue_password_reset_token", fail)

    with caplog.at_level(logging.ERROR):
        auth_routes._process_password_reset_request(str(sample_user.email))

    assert "Password reset request could not be processed" in caplog.text
    assert "provider unavailable" not in caplog.text
