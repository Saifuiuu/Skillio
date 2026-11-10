"""Auth endpoint coverage: register, login, me, refresh, logout, require_role."""

from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.models.user import Role, User, UserStatus


def _register(client, email: str, password: str = "password1", role: str = "candidate", full_name: str = "Test User"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": password, "role": role, "full_name": full_name},
    )


def _login(client, email: str, password: str = "password1"):
    return client.post("/auth/login", json={"email": email, "password": password})


# --- register ---


def test_register_success_201(client):
    res = _register(client, "new@example.com")
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "new@example.com"
    assert body["role"] == "candidate"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_email_409(client):
    assert _register(client, "dup@example.com").status_code == 201
    res = _register(client, "dup@example.com")
    assert res.status_code == 409


def test_register_admin_role_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "a@example.com", "password": "password1", "role": "admin", "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_password_too_short_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "s@example.com", "password": "short", "role": "candidate", "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_password_over_72_bytes_422(client):
    # 73 ascii chars => 73 bytes
    res = client.post(
        "/auth/register",
        json={
            "email": "long@example.com",
            "password": "x" * 73,
            "role": "candidate",
            "full_name": "Test User",
        },
    )
    assert res.status_code == 422


def test_register_invalid_email_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "not-an-email", "password": "password1", "role": "candidate", "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_candidate_active_employer_interviewer_pending(client, db_session):
    assert _register(client, "c@example.com", role="candidate").status_code == 201
    assert _register(client, "e@example.com", role="employer").status_code == 201
    assert _register(client, "i@example.com", role="interviewer").status_code == 201

    c = db_session.scalar(select(User).where(User.email == "c@example.com"))
    e = db_session.scalar(select(User).where(User.email == "e@example.com"))
    i = db_session.scalar(select(User).where(User.email == "i@example.com"))
    assert c is not None and c.status == UserStatus.active
    assert e is not None and e.status == UserStatus.pending_verification
    assert i is not None and i.status == UserStatus.pending_verification


def test_register_stores_hashed_password_not_plain(client, db_session):
    password = "password1"
    assert _register(client, "hash@example.com", password=password).status_code == 201
    user = db_session.scalar(select(User).where(User.email == "hash@example.com"))
    assert user is not None
    assert user.password_hash is not None
    assert user.password_hash != password
    assert user.password_hash.startswith("$2")


# --- login ---


def test_login_success_204_sets_httponly_lax_cookies(client):
    email = "login-ok@example.com"
    assert _register(client, email).status_code == 201
    res = _login(client, email)
    assert res.status_code == 204

    access = res.cookies.get("access_token")
    refresh = res.cookies.get("refresh_token")
    assert access
    assert refresh

    # Starlette TestClient exposes set-cookie headers
    set_cookies = res.headers.get_list("set-cookie")
    joined = "\n".join(set_cookies).lower()
    assert "access_token=" in joined
    assert "refresh_token=" in joined
    assert "httponly" in joined
    assert "samesite=lax" in joined


def test_login_wrong_password_401(client):
    email = "wrong-pass@example.com"
    assert _register(client, email).status_code == 201
    res = _login(client, email, password="nope!!!!")
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_login_unknown_email_401_same_message(client):
    res = _login(client, "missing@example.com", password="password1")
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_login_suspended_403(client, db_session):
    email = "suspended@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    user.status = UserStatus.suspended
    db_session.commit()

    res = _login(client, email)
    assert res.status_code == 403


# --- me ---


def test_me_with_valid_cookie_200(client):
    email = "me-ok@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    res = client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == email


def test_me_no_cookie_401(client):
    client.cookies.clear()
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_me_tampered_token_401(client):
    email = "me-tamp@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    bad = (client.cookies.get("access_token") or "") + "x"
    client.cookies.set("access_token", bad)
    assert client.get("/auth/me").status_code == 401


def test_me_refresh_token_as_access_401(client, db_session):
    email = "me-rtype@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    refresh = create_refresh_token(user.id, token_version=user.token_version)
    client.cookies.clear()
    client.cookies.set("access_token", refresh)
    assert client.get("/auth/me").status_code == 401


def test_me_expired_access_token_401(client, db_session):
    email = "me-exp@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None

    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "type": "access",
        "role": user.role.value,
        "ver": user.token_version,
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
    }
    expired = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    client.cookies.clear()
    client.cookies.set("access_token", expired)
    assert client.get("/auth/me").status_code == 401


# --- refresh ---


def test_refresh_valid_cookie_204_new_access(client):
    email = "ref-ok@example.com"
    assert _register(client, email).status_code == 201
    login = _login(client, email)
    assert login.status_code == 204
    assert login.cookies.get("access_token")

    res = client.post("/auth/refresh")
    assert res.status_code == 204
    # Fresh Set-Cookie for access_token (JWT bytes may match if minted in same second)
    set_cookies = "\n".join(res.headers.get_list("set-cookie")).lower()
    assert "access_token=" in set_cookies
    assert res.cookies.get("access_token")
    assert client.get("/auth/me").status_code == 200


def test_refresh_no_cookie_401(client):
    client.cookies.clear()
    assert client.post("/auth/refresh").status_code == 401


def test_refresh_access_token_used_as_refresh_401(client, db_session):
    email = "ref-wrongtype@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    access = create_access_token(user.id, user.role.value, token_version=user.token_version)
    client.cookies.clear()
    client.cookies.set("refresh_token", access)
    assert client.post("/auth/refresh").status_code == 401


def test_refresh_suspended_user_401(client, db_session):
    email = "ref-sus@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    user.status = UserStatus.suspended
    db_session.commit()

    assert client.post("/auth/refresh").status_code == 401


# --- logout ---


def test_logout_clears_cookies_then_me_401(client):
    email = "logout@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    assert client.get("/auth/me").status_code == 200

    out = client.post("/auth/logout")
    assert out.status_code == 204

    # Clear client-side jar as browser would after delete_cookie Max-Age=0
    client.cookies.clear()
    assert client.get("/auth/me").status_code == 401


# --- require_role / admin ping ---


def test_admin_ping_allowed_role_200(client, db_session):
    email = "admin@example.com"
    user = User(
        email=email,
        password_hash=hash_password("password1"),
        role=Role.admin,
        status=UserStatus.active,
        auth_provider="local",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    assert _login(client, email).status_code == 204
    res = client.get("/admin/ping")
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert res.json()["role"] == "admin"


def test_admin_ping_wrong_role_403(client):
    email = "cand-admin@example.com"
    assert _register(client, email, role="candidate").status_code == 201
    assert _login(client, email).status_code == 204
    res = client.get("/admin/ping")
    assert res.status_code == 403


def test_admin_ping_no_cookie_401(client):
    client.cookies.clear()
    assert client.get("/admin/ping").status_code == 401


# --- full_name validation ---


def test_register_missing_full_name_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "nofullname@example.com", "password": "password1", "role": "candidate"},
    )
    assert res.status_code == 422


def test_register_empty_full_name_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "empty@example.com", "password": "password1", "role": "candidate", "full_name": ""},
    )
    assert res.status_code == 422


def test_register_one_char_name_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "one@example.com", "password": "password1", "role": "candidate", "full_name": "A"},
    )
    assert res.status_code == 422


def test_register_newline_in_name_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "nl@example.com", "password": "password1", "role": "candidate", "full_name": "Bad\nName"},
    )
    assert res.status_code == 422


def test_register_html_in_name_422(client):
    res = client.post(
        "/auth/register",
        json={"email": "html@example.com", "password": "password1", "role": "candidate", "full_name": "<script>"},
    )
    assert res.status_code == 422


def test_register_valid_name_saved(client, db_session):
    res = _register(client, "named@example.com", full_name="Ali Ahmed")
    assert res.status_code == 201
    assert res.json()["full_name"] == "Ali Ahmed"
    user = db_session.scalar(select(User).where(User.email == "named@example.com"))
    assert user is not None
    assert user.full_name == "Ali Ahmed"


def test_register_unicode_name_accepted(client):
    res = client.post(
        "/auth/register",
        json={"email": "urdu@example.com", "password": "password1", "role": "candidate", "full_name": "علی احمد"},
    )
    assert res.status_code == 201
    assert res.json()["full_name"] == "علی احمد"


def test_register_name_whitespace_collapsed(client, db_session):
    res = client.post(
        "/auth/register",
        json={"email": "ws@example.com", "password": "password1", "role": "candidate", "full_name": "  John   Doe  "},
    )
    assert res.status_code == 201
    user = db_session.scalar(select(User).where(User.email == "ws@example.com"))
    assert user is not None
    assert user.full_name == "John Doe"


# --- PATCH /auth/me ---


def test_patch_me_updates_full_name(client, db_session):
    email = "patch-me@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    res = client.patch("/auth/me", json={"full_name": "Updated Name"})
    assert res.status_code == 200
    assert res.json()["full_name"] == "Updated Name"


def test_patch_me_invalid_name_422(client):
    email = "patch-invalid@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    res = client.patch("/auth/me", json={"full_name": "<bad>"})
    assert res.status_code == 422


def test_patch_me_unauthenticated_401(client):
    client.cookies.clear()
    res = client.patch("/auth/me", json={"full_name": "Some Name"})
    assert res.status_code == 401
