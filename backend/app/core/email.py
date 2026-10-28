import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, body: str) -> None:
    """Send email via SMTP when configured; otherwise log the body for local dev."""
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP not configured — password reset email for %s:\n%s\n%s",
            to,
            subject,
            body,
        )
        print(f"\n=== EMAIL (dev fallback) → {to} ===\n{subject}\n{body}\n=== END EMAIL ===\n")
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
        smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)
