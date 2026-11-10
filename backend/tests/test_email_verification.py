"""Email verification: register mail, verify, resend, Google, /me, employer status."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import jwt
from sqlalchemy import select

from app.core.config import settings
from app.core.security import (
    create_email_verification_token,
    create_password_reset_token,
)
from app.models.user import Role, User, UserStatus


def _register(
    client,
    email: str,
    password: str = "password1",
    role: str = "candidate",
    full_name: str = "Test User",
):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "role": role,
            "full_name": full_name,
        },
    )


def _login(client, email: str, password: str = "password1"):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_register_queues_verification_email(client):
    with patch("app.api.routes.auth._safe_send_email") as mock_send:
        res = _register(client, "verify-mail@example.com")
        assert res.status_code == 201
        assert res.json()["email_verified"] is False
        assert mock_send.call_count == 1
        kwargs = mock_send.call_args.kwargs
        assert kwargs["to"] == "verify-mail@example.com"
        assert "Verify" in kwargs["subject"]
        assert "/verify-email?token=" in kwargs["body"]
        assert settings.FRONTEND_URL.rstrip("/") in kwargs["body"]


def test_verify_email_success_and_idempotent(client, db_session):
    email = "verify-ok@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    assert user.email_verified is False

    token = create_email_verification_token(user.id, user.email)
    first = client.post("/auth/verify-email", json={"token": token})
    assert first.status_code == 204

    db_session.refresh(user)
    assert user.email_verified is True

    second = client.post("/auth/verify-email", json={"token": token})
    assert second.status_code == 204
    db_session.refresh(user)
    assert user.email_verified is True


def test_verify_email_invalid_expired_wrong_type_400(client, db_session):
    email = "verify-bad@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None

    assert (
        client.post("/auth/verify-email", json={"token": "not-a-valid-jwt"}).status_code
        == 400
    )

    reset = create_password_reset_token(user.id, token_version=user.token_version)
    assert client.post("/auth/verify-email", json={"token": reset}).status_code == 400

    now = datetime.now(UTC)
    expired = jwt.encode(
        {
            "sub": str(user.id),
            "type": "verify_email",
            "email": user.email,
            "iat": now - timedelta(hours=48),
            "exp": now - timedelta(hours=24),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    assert client.post("/auth/verify-email", json={"token": expired}).status_code == 400


def test_resend_always_204_skips_verified(client, db_session):
    unknown = client.post(
        "/auth/resend-verification",
        json={"email": "missing@example.com"},
    )
    assert unknown.status_code == 204

    email = "resend-me@example.com"
    assert _register(client, email).status_code == 201

    with patch("app.api.routes.auth._safe_send_email") as mock_send:
        res = client.post("/auth/resend-verification", json={"email": email})
        assert res.status_code == 204
        assert mock_send.call_count == 1

    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    user.email_verified = True
    db_session.commit()

    with patch("app.api.routes.auth._safe_send_email") as mock_send:
        res = client.post("/auth/resend-verification", json={"email": email})
        assert res.status_code == 204
        assert mock_send.call_count == 0


def test_google_user_email_verified_true(client, db_session):
    from unittest.mock import MagicMock

    email = "google-verify@example.com"
    state = "oauth-state-verify-email-32chars!"
    client.cookies.set("oauth_state", state)

    mock_token = MagicMock()
    mock_token.raise_for_status = MagicMock()
    mock_token.json.return_value = {"access_token": "google-access"}

    mock_info = MagicMock()
    mock_info.raise_for_status = MagicMock()
    mock_info.json.return_value = {
        "sub": "google-sub-verify-1",
        "email": email,
        "email_verified": True,
        "name": "Verify User",
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = False
    mock_client.post.return_value = mock_token
    mock_client.get.return_value = mock_info

    with patch("app.api.routes.auth.httpx.Client", return_value=mock_client):
        resp = client.get(
            "/auth/google/callback",
            params={"code": "fake-code", "state": state},
            follow_redirects=False,
        )

    assert resp.status_code in (302, 307)
    assert "/select-role" in resp.headers.get("location", "")
    assert resp.cookies.get("google_signup")
    assert db_session.scalar(select(User).where(User.email == email)) is None

    client.cookies.set("google_signup", resp.cookies.get("google_signup"))
    complete = client.post("/auth/google/complete", json={"role": "candidate"})
    assert complete.status_code == 201
    assert complete.json()["email_verified"] is True
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    assert user.email_verified is True
    assert user.auth_provider == "google"


def test_me_includes_email_verified(client):
    email = "me-verified-field@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    res = client.get("/auth/me")
    assert res.status_code == 200
    body = res.json()
    assert "email_verified" in body
    assert body["email_verified"] is False
    assert "password_hash" not in body
    assert "token_version" not in body


def test_employer_stays_pending_after_email_verify(client, db_session):
    email = "employer-pending@example.com"
    assert _register(client, email, role="employer").status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    assert user.role == Role.employer
    assert user.status == UserStatus.pending_verification
    assert user.email_verified is False

    token = create_email_verification_token(user.id, user.email)
    assert client.post("/auth/verify-email", json={"token": token}).status_code == 204

    db_session.refresh(user)
    assert user.email_verified is True
    assert user.status == UserStatus.pending_verification
