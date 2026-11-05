"""Regression tests for confirmed auth bugs (a)(b)(c) + forgot_password privacy."""

from unittest.mock import MagicMock, patch

from sqlalchemy import select

from app.core.security import (
    create_password_reset_token,
    create_refresh_token,
    hash_password,
)
from app.models.user import Role, User, UserStatus


def _register(client, email: str, password: str = "password1", role: str = "candidate"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": password, "role": role},
    )


def test_reset_token_is_single_use(client, db_session):
    """Bug (a): same reset token must not work twice."""
    assert _register(client, "reset-once@example.com").status_code == 201
    user = db_session.scalar(select(User).where(User.email == "reset-once@example.com"))
    assert user is not None
    token = create_password_reset_token(user.id, token_version=user.token_version)

    first = client.post(
        "/auth/reset-password",
        json={"token": token, "password": "newpass11"},
    )
    assert first.status_code == 204

    second = client.post(
        "/auth/reset-password",
        json={"token": token, "password": "newpass22"},
    )
    assert second.status_code == 400


def test_old_refresh_token_invalid_after_password_reset(client, db_session):
    """Bug (b): refresh cookie issued before reset must fail after reset."""
    email = "refresh-kill@example.com"
    password = "password1"
    assert _register(client, email, password).status_code == 201

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 204
    old_refresh = login.cookies.get("refresh_token")
    assert old_refresh

    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    db_session.refresh(user)
    reset_token = create_password_reset_token(user.id, token_version=user.token_version)

    reset = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "password": "brandnew1"},
    )
    assert reset.status_code == 204

    client.cookies.set("refresh_token", old_refresh)
    refreshed = client.post("/auth/refresh")
    assert refreshed.status_code == 401


def test_stale_refresh_cookie_rejected_by_auth_refresh_endpoint(client, db_session):
    """Stale refresh JWT must be rejected by real POST /auth/refresh (not a helper)."""
    email = "ver-bump@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None

    # Mint a refresh cookie-shaped JWT at current version, then bump DB version.
    stale = create_refresh_token(user.id, token_version=user.token_version)
    user.token_version = user.token_version + 1
    db_session.commit()

    client.cookies.clear()
    client.cookies.set("refresh_token", stale)
    response = client.post("/auth/refresh")
    assert response.status_code == 401
    assert response.cookies.get("access_token") in (None, "")


def test_google_link_invalidates_password_on_unverified_account(client, db_session):
    """Bug (c): Google linking an unverified password account must kill password login."""
    email = "pre-hijack@example.com"
    old_password = "password1"

    user = User(
        email=email,
        password_hash=hash_password(old_password),
        role=Role.candidate,
        status=UserStatus.active,
        auth_provider="local",
        email_verified=False,
        token_version=0,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    state = "oauth-state-test-value-32chars!!"
    client.cookies.set("oauth_state", state)

    mock_token = MagicMock()
    mock_token.raise_for_status = MagicMock()
    mock_token.json.return_value = {"access_token": "google-access"}

    mock_info = MagicMock()
    mock_info.raise_for_status = MagicMock()
    mock_info.json.return_value = {
        "sub": "google-sub-link-1",
        "email": email,
        "email_verified": True,
        "name": "Link User",
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
    assert "/dashboard" in resp.headers.get("location", "")

    db_session.refresh(user)
    assert user.password_hash is None
    assert user.auth_provider == "google"
    assert user.email_verified is True
    assert user.token_version == 1

    login = client.post(
        "/auth/login",
        json={"email": email, "password": old_password},
    )
    assert login.status_code in (400, 401)


def test_forgot_password_unknown_email_returns_204(client):
    resp = client.post(
        "/auth/forgot-password",
        json={"email": "nobody-exists@example.com"},
    )
    assert resp.status_code == 204
