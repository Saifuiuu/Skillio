import logging
import smtplib
from email.message import EmailMessage
from html import escape

from app.core.config import settings

logger = logging.getLogger(__name__)


def _bulletproof_button(*, href: str, label: str) -> str:
    """Table-based CTA that survives common email clients."""
    safe_href = escape(href, quote=True)
    safe_label = escape(label)
    return f"""
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" bgcolor="#1E3A5F" style="border-radius:4px;">
      <a href="{safe_href}"
         target="_blank"
         style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;
                border-radius:4px;background-color:#1E3A5F;">
        {safe_label}
      </a>
    </td>
  </tr>
</table>
""".strip()


def build_password_reset_email(*, reset_url: str, expire_minutes: int) -> tuple[str, str, str]:
    subject = "Reset your Skillio password"
    text = (
        "We received a request to reset your Skillio password.\n\n"
        f"Open this link to choose a new password (expires in {expire_minutes} minutes):\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    button = _bulletproof_button(href=reset_url, label="Reset password")
    html = f"""\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAFAF9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;padding:32px;
                      font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <tr><td style="font-size:22px;font-weight:bold;color:#1E3A5F;">Skillio</td></tr>
          <tr><td style="padding-top:20px;font-size:16px;line-height:1.5;">
            We received a request to reset your Skillio password.
          </td></tr>
          <tr><td style="padding-top:8px;font-size:14px;line-height:1.5;color:#475569;">
            This link expires in {expire_minutes} minutes.
          </td></tr>
          <tr><td>{button}</td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#64748b;word-break:break-all;">
            If the button does not work, copy and paste this URL into your browser:<br/>
            {escape(reset_url)}
          </td></tr>
          <tr><td style="padding-top:24px;font-size:12px;color:#64748b;">
            If you did not request this, you can ignore this email.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return subject, text, html


def build_email_verification_email(
    *, verify_url: str, expire_hours: int
) -> tuple[str, str, str]:
    subject = "Verify your Skillio email"
    text = (
        "Welcome to Skillio.\n\n"
        f"Open this link to verify your email (expires in {expire_hours} hours):\n\n"
        f"{verify_url}\n\n"
        "If you did not create an account, you can ignore this email.\n"
    )
    button = _bulletproof_button(href=verify_url, label="Verify email")
    html = f"""\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAFAF9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;padding:32px;
                      font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <tr><td style="font-size:22px;font-weight:bold;color:#1E3A5F;">Skillio</td></tr>
          <tr><td style="padding-top:20px;font-size:16px;line-height:1.5;">
            Welcome to Skillio. Please verify your email address.
          </td></tr>
          <tr><td style="padding-top:8px;font-size:14px;line-height:1.5;color:#475569;">
            This link expires in {expire_hours} hours.
          </td></tr>
          <tr><td>{button}</td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#64748b;word-break:break-all;">
            If the button does not work, copy and paste this URL into your browser:<br/>
            {escape(verify_url)}
          </td></tr>
          <tr><td style="padding-top:24px;font-size:12px;color:#64748b;">
            If you did not create an account, you can ignore this email.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return subject, text, html


def build_google_only_reset_email() -> tuple[str, str, str]:
    subject = "Skillio password reset"
    text = (
        "You requested a password reset, but this Skillio account signs in with Google.\n"
        "Use “Sign in with Google” on the login page instead.\n"
    )
    html = """\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAFAF9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;padding:32px;
                      font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <tr><td style="font-size:22px;font-weight:bold;color:#1E3A5F;">Skillio</td></tr>
          <tr><td style="padding-top:20px;font-size:16px;line-height:1.5;">
            You requested a password reset, but this Skillio account signs in with Google.
          </td></tr>
          <tr><td style="padding-top:12px;font-size:14px;line-height:1.5;color:#475569;">
            Use <strong>Sign in with Google</strong> on the login page instead.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return subject, text, html


def send_email(*, to: str, subject: str, body: str, html: str | None = None) -> None:
    """Send multipart email via SMTP when configured; otherwise log for local dev."""
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP not configured — email for %s:\n%s\n%s\n%s",
            to,
            subject,
            body,
            html or "",
        )
        print(f"\n=== EMAIL (dev fallback) → {to} ===\n{subject}\n{body}\n=== END EMAIL ===\n")
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
        smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)
