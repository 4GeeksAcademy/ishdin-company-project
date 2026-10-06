import html
import logging
import os
import re
from email.utils import parseaddr
from urllib.parse import urlencode, urlsplit, urlunsplit

from email_validator import EmailNotValidError, validate_email
import resend

from auth.security import get_password_reset_expire_minutes


logger = logging.getLogger(__name__)

_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+")


def _password_reset_link(token: str) -> str:
    base_url = os.getenv("BACKOFFICE_BASE_URL", "").strip().rstrip("/")
    parsed = urlsplit(base_url)
    local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
    if (
        not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or (parsed.scheme != "https" and not local_http)
    ):
        raise RuntimeError("BACKOFFICE_BASE_URL must be a trusted HTTPS origin.")

    path = f"{parsed.path.rstrip('/')}/reset-password"
    return urlunsplit((parsed.scheme, parsed.netloc, path, urlencode({"token": token}), ""))


def send_password_reset_email(recipient: str, token: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM_EMAIL", "").strip()
    if not api_key or not sender:
        logger.warning("Password reset email was not sent because Resend is not configured.")
        return

    _, sender_address = parseaddr(sender)
    try:
        validate_email(sender_address, check_deliverability=False)
    except EmailNotValidError:
        logger.warning("Password reset email was not sent because RESEND_FROM_EMAIL is invalid.")
        return

    try:
        reset_link = _password_reset_link(token)
        safe_link = html.escape(reset_link, quote=True)
        expiry_minutes = get_password_reset_expire_minutes()
        resend.api_key = api_key
        resend.Emails.send({
            "from": sender,
            "to": [recipient],
            "subject": "Reset your TrackFlow password",
            "html": (
                '<!doctype html><html><head><meta name="viewport" '
                'content="width=device-width, initial-scale=1.0"></head>'
                '<body style="margin:0;background:#f4f2eb;font-family:Arial,sans-serif;color:#172522">'
                '<main style="max-width:560px;margin:24px auto;padding:24px;background:#fffefa;'
                'border:1px solid #ded8cc;border-radius:12px">'
                '<p style="font-size:12px;font-weight:700;letter-spacing:1px;color:#3e7468">'
                'TRACKFLOW BACKOFFICE</p><h1 style="font-size:22px">Reset your password</h1>'
                '<p style="font-size:16px;line-height:1.6">We received a request to reset your password. '
                f'This link expires in {expiry_minutes} minutes and can only be used once.</p>'
                f'<p style="margin:28px 0"><a href="{safe_link}" style="display:inline-block;'
                'padding:13px 20px;background:#3e7468;color:#fff;text-decoration:none;'
                'border-radius:8px;font-weight:700">Choose a new password</a></p>'
                '<p style="font-size:14px;line-height:1.6;color:#52605c">If you did not request this, '
                'you can ignore this email. Your password will not change.</p></main></body></html>'
            ),
            "text": (
                "Reset your TrackFlow password\n\n"
                f"Use this one-time link within {expiry_minutes} minutes to choose a new password:\n"
                f"{reset_link}\n\nIf you did not request this, ignore this email."
            ),
        })
    except Exception as exc:
        if isinstance(exc, resend.exceptions.ResendError):
            reason = _EMAIL_PATTERN.sub("[redacted email]", exc.message)
            reason = _URL_PATTERN.sub("[redacted URL]", reason)[:300]
            logger.warning(
                "Password reset email rejected by Resend "
                "(provider_error_type=%s, status=%s, reason=%s).",
                exc.error_type,
                exc.code,
                reason,
            )
            return
        logger.warning(
            "Password reset email delivery failed (error_type=%s).",
            type(exc).__name__,
        )