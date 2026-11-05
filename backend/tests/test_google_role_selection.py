"""Google OAuth: new users pick a role via google_signup cookie + /auth/google/complete."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import jwt
from sqlalchemy import func, select

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import create_access_token, create_google_signup_token
from app.models.user import Role, User, UserStatus


def _mock_google_client(*, email: str, sub: str = "google-sub-1", name: str = "Test User"):
    mock_token = MagicMock()
    mock_token.raise_for_status = MagicMock()
    mock_token.json.return_value = {"access_token": "google-access"}

    mock_info = MagicMock()
    mock_info.raise_for_status = MagicMock()
    mock_info.json.return_value = {
        "sub": sub,
        "email": email,
        "email_verified": True,
        "name": name,
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = False
    mock_client.post.return_value = mock_token
    mock_client.get.return_value = mock_info
    return mock_client


def _callback_new_google_user(client, email: str, *, sub: str = "google-sub-1"):
    state = "oauth-state-role-select-32chars!!"
    client.cookies.set("oauth_state", state)
    with patch(
        "app.api.routes.auth.httpx.Client",
        return_value=_mock_google_client(email=email, sub=sub),
    ):
        return client.get(
            "/auth/google/callback",
            params={"code": "fake-code", "state": state},
            follow_redirects=False,
        )


def test_new_google_user_callback_defers_create(client, db_session):
    email = "new-google@example.com"
    resp = _callback_new_google_user(client, email)
    assert resp.status_code in (302, 307)
    assert resp.headers.get("location", "").endswith("/select-role")
    assert "token=" not in resp.headers.get("location", "")
    assert "email=" not in resp.headers.get("location", "").lower()

    signup = resp.cookies.get("google_signup")
    assert signup
    assert db_session.scalar(select(User).where(User.email == email)) is None


def test_complete_candidate_creates_active_session(client, db_session):
    email = "google-candidate@example.com"
    resp = _callback_new_google_user(client, email, sub="sub-cand")
    client.cookies.set("google_signup", resp.cookies.get("google_signup"))

    complete = client.post("/auth/google/complete", json={"role": "candidate"})
    assert complete.status_code == 201
    body = complete.json()
    assert body["email"] == email
    assert body["role"] == "candidate"
    assert body["status"] == "active"
    assert body["email_verified"] is True
    assert complete.cookies.get("access_token")
    assert complete.cookies.get("refresh_token")
    set_cookies = "\n".join(complete.headers.get_list("set-cookie")).lower()
    assert "google_signup=" in set_cookies
    assert "max-age=0" in set_cookies or "google_signup=;" in set_cookies.replace(
        " ", ""
    )

    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    assert user.password_hash is None
    assert user.auth_provider == "google"
    assert client.get("/auth/me").status_code == 200


def test_complete_employer_and_interviewer_pending(client, db_session):
    for role, email, sub in (
        ("employer", "google-employer@example.com", "sub-emp"),
        ("interviewer", "google-interviewer@example.com", "sub-int"),
    ):
        client.cookies.clear()
        resp = _callback_new_google_user(client, email, sub=sub)
        client.cookies.set("google_signup", resp.cookies.get("google_signup"))
        complete = client.post("/auth/google/complete", json={"role": role})
        assert complete.status_code == 201
        assert complete.json()["status"] == "pending_verification"
        assert complete.json()["role"] == role
        user = db_session.scalar(select(User).where(User.email == email))
        assert user is not None
        assert user.status == UserStatus.pending_verification
        # Login flow still issues session for pending users
        assert complete.cookies.get("access_token")


def test_complete_admin_role_422(client):
    resp = _callback_new_google_user(client, "google-admin@example.com", sub="sub-adm")
    client.cookies.set("google_signup", resp.cookies.get("google_signup"))
    assert client.post("/auth/google/complete", json={"role": "admin"}).status_code == 422
    assert (
        client.post("/auth/google/complete", json={"role": "superuser"}).status_code
        == 422
    )


def test_complete_missing_expired_tampered_token_no_user(client, db_session):
    email = "bad-token@example.com"
    client.cookies.clear()
    assert client.post("/auth/google/complete", json={"role": "candidate"}).status_code == 400
    assert db_session.scalar(select(User).where(User.email == email)) is None

    now = datetime.now(UTC)
    expired = jwt.encode(
        {
            "sub": "sub-expired",
            "type": "google_signup",
            "email": email,
            "name": "X",
            "email_verified": True,
            "iat": now - timedelta(minutes=30),
            "exp": now - timedelta(minutes=5),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    client.cookies.set("google_signup", expired)
    assert client.post("/auth/google/complete", json={"role": "candidate"}).status_code == 400
    assert db_session.scalar(select(User).where(User.email == email)) is None

    client.cookies.set("google_signup", "not-a-valid-jwt-token!!")
    assert client.post("/auth/google/complete", json={"role": "candidate"}).status_code == 400


def test_complete_replay_does_not_duplicate(client, db_session):
    email = "google-replay@example.com"
    resp = _callback_new_google_user(client, email, sub="sub-replay")
    token = resp.cookies.get("google_signup")
    client.cookies.set("google_signup", token)

    first = client.post("/auth/google/complete", json={"role": "candidate"})
    assert first.status_code == 201

    client.cookies.set("google_signup", token)
    second = client.post("/auth/google/complete", json={"role": "employer"})
    assert second.status_code == 409

    count = db_session.scalar(
        select(func.count()).select_from(User).where(User.email == email)
    )
    assert count == 1
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    assert user.role == Role.candidate


def test_existing_google_user_login_unchanged(client, db_session):
    email = "existing-google@example.com"
    user = User(
        email=email,
        password_hash=None,
        role=Role.candidate,
        status=UserStatus.active,
        auth_provider="google",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    resp = _callback_new_google_user(client, email, sub="sub-existing")
    assert resp.status_code in (302, 307)
    assert "/dashboard" in resp.headers.get("location", "")
    assert resp.cookies.get("access_token")
    assert resp.cookies.get("google_signup") in (None, "")


def test_google_complete_rate_limit_429(client, enable_rate_limiting):
    limit = settings.RATE_LIMIT_GOOGLE_COMPLETE_PER_MINUTE
    token = create_google_signup_token(
        google_sub="sub-rl",
        email="rl-google@example.com",
        name="RL",
        email_verified=True,
    )
    # Exhaust with missing/invalid-path that still hits the limiter (no cookie → 400)
    for _ in range(limit):
        client.cookies.clear()
        assert (
            client.post("/auth/google/complete", json={"role": "candidate"}).status_code
            == 400
        )

    client.cookies.clear()
    client.cookies.set("google_signup", token)
    blocked = client.post("/auth/google/complete", json={"role": "candidate"})
    assert blocked.status_code == 429
    assert any(k.lower() == "retry-after" for k in blocked.headers)
    limiter.reset()


def test_create_google_signup_token_wrong_type_rejected(client):
    # Access token must not work as google_signup
    bad = create_access_token(uuid.uuid4(), "candidate", token_version=0)
    client.cookies.set("google_signup", bad)
    assert client.post("/auth/google/complete", json={"role": "candidate"}).status_code == 400
