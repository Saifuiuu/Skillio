"""Admin user management APIs behind require_admin."""

from sqlalchemy import select

from app.core.security import hash_password
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
        json={"email": email, "password": password, "role": role, "full_name": full_name},
    )


def _login(client, email: str, password: str = "password1"):
    return client.post("/auth/login", json={"email": email, "password": password})


def _make_admin(
    db_session, email: str = "admin@example.com", password: str = "password1"
):
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=Role.admin,
        status=UserStatus.active,
        auth_provider="local",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _assert_no_sensitive(body: dict) -> None:
    assert "password" not in body
    assert "password_hash" not in body
    assert "token_version" not in body


# --- authz ---


def test_list_users_unauthenticated_401(client):
    client.cookies.clear()
    assert client.get("/admin/users").status_code == 401


def test_list_users_non_admin_403(client):
    email = "cand-list@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    assert client.get("/admin/users").status_code == 403


def test_get_user_unauthenticated_401(client, db_session):
    admin = _make_admin(db_session)
    client.cookies.clear()
    assert client.get(f"/admin/users/{admin.id}").status_code == 401


def test_patch_status_non_admin_403(client, db_session):
    target = _make_admin(db_session, email="target-admin@example.com")
    email = "cand-patch@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    res = client.patch(
        f"/admin/users/{target.id}/status",
        json={"status": "suspended"},
    )
    assert res.status_code == 403


# --- list / filter / pagination ---


def test_list_users_pagination_and_filters(client, db_session):
    admin = _make_admin(db_session)
    assert _login(client, admin.email).status_code == 204

    assert _register(client, "c1@example.com", role="candidate").status_code == 201
    assert _register(client, "c2@example.com", role="candidate").status_code == 201
    assert _register(client, "e1@example.com", role="employer").status_code == 201

    page1 = client.get("/admin/users", params={"page": 1, "page_size": 2})
    assert page1.status_code == 200
    body = page1.json()
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert body["total"] >= 4
    assert len(body["items"]) == 2
    for item in body["items"]:
        _assert_no_sensitive(item)
        assert "approved_at" in item

    page2 = client.get("/admin/users", params={"page": 2, "page_size": 2})
    assert page2.status_code == 200
    assert len(page2.json()["items"]) >= 1
    ids_p1 = {u["id"] for u in body["items"]}
    ids_p2 = {u["id"] for u in page2.json()["items"]}
    assert ids_p1.isdisjoint(ids_p2)

    by_role = client.get("/admin/users", params={"role": "employer"})
    assert by_role.status_code == 200
    role_body = by_role.json()
    assert role_body["total"] >= 1
    assert all(u["role"] == "employer" for u in role_body["items"])

    by_status = client.get("/admin/users", params={"status": "pending_verification"})
    assert by_status.status_code == 200
    status_body = by_status.json()
    assert status_body["total"] >= 1
    assert all(u["status"] == "pending_verification" for u in status_body["items"])


def test_list_users_page_size_max_422(client, db_session):
    admin = _make_admin(db_session)
    assert _login(client, admin.email).status_code == 204
    res = client.get("/admin/users", params={"page_size": 101})
    assert res.status_code == 422


def test_get_user_ok(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "get-me@example.com").status_code == 201
    assert _login(client, admin.email).status_code == 204

    listed = client.get("/admin/users", params={"role": "candidate"})
    target_id = listed.json()["items"][0]["id"]
    res = client.get(f"/admin/users/{target_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == target_id
    assert "approved_at" in body
    _assert_no_sensitive(body)


def test_get_user_404(client, db_session):
    admin = _make_admin(db_session)
    assert _login(client, admin.email).status_code == 204
    res = client.get("/admin/users/00000000-0000-0000-0000-000000000001")
    assert res.status_code == 404


# --- approve endpoint ---


def test_approve_pending_employer(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "employer@example.com", role="employer").status_code == 201
    assert _login(client, admin.email).status_code == 204

    pending = client.get(
        "/admin/users", params={"status": "pending_verification"}
    ).json()["items"][0]
    assert pending["status"] == "pending_verification"
    assert pending["approved_at"] is None

    res = client.post(f"/admin/users/{pending['id']}/approve")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "active"
    assert body["approved_at"] is not None
    _assert_no_sensitive(body)


def test_approve_pending_interviewer(client, db_session):
    admin = _make_admin(db_session)
    assert (
        _register(client, "interviewer@example.com", role="interviewer").status_code
        == 201
    )
    assert _login(client, admin.email).status_code == 204

    pending = client.get(
        "/admin/users",
        params={"status": "pending_verification", "role": "interviewer"},
    ).json()["items"][0]

    res = client.post(f"/admin/users/{pending['id']}/approve")
    assert res.status_code == 200
    assert res.json()["status"] == "active"
    assert res.json()["approved_at"] is not None


def test_approve_candidate_409(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "cand-approve@example.com").status_code == 201
    assert _login(client, admin.email).status_code == 204
    users = client.get("/admin/users", params={"role": "candidate"}).json()["items"]
    target = next(u for u in users if u["email"] == "cand-approve@example.com")

    res = client.post(f"/admin/users/{target['id']}/approve")
    assert res.status_code == 409


def test_approve_already_active_409(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "emp-active@example.com", role="employer").status_code == 201
    user = db_session.scalar(
        select(User).where(User.email == "emp-active@example.com")
    )
    assert user is not None
    user.status = UserStatus.active
    user.approved_at = user.created_at
    db_session.commit()

    assert _login(client, admin.email).status_code == 204
    res = client.post(f"/admin/users/{user.id}/approve")
    assert res.status_code == 409


def test_approve_non_admin_403(client, db_session):
    assert _register(client, "emp-na@example.com", role="employer").status_code == 201
    user = db_session.scalar(select(User).where(User.email == "emp-na@example.com"))
    assert user is not None

    email = "cand-na@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    res = client.post(f"/admin/users/{user.id}/approve")
    assert res.status_code == 403


def test_approve_rejected_employer(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "emp-rej@example.com", role="employer").status_code == 201
    user = db_session.scalar(select(User).where(User.email == "emp-rej@example.com"))
    assert user is not None
    user.status = UserStatus.suspended
    user.approved_at = None
    db_session.commit()

    assert _login(client, admin.email).status_code == 204
    res = client.post(f"/admin/users/{user.id}/approve")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "active"
    assert body["approved_at"] is not None


# --- status patch guards ---


def test_patch_pending_to_active_409(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "emp-patch@example.com", role="employer").status_code == 201
    assert _login(client, admin.email).status_code == 204

    pending = client.get(
        "/admin/users", params={"status": "pending_verification"}
    ).json()["items"][0]
    res = client.patch(
        f"/admin/users/{pending['id']}/status",
        json={"status": "active"},
    )
    assert res.status_code == 409
    assert "verifications" in res.json()["detail"].lower()


def test_patch_never_approved_suspended_to_active_409(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "emp-na2@example.com", role="employer").status_code == 201
    user = db_session.scalar(select(User).where(User.email == "emp-na2@example.com"))
    assert user is not None
    user.status = UserStatus.suspended
    user.approved_at = None
    db_session.commit()

    assert _login(client, admin.email).status_code == 204
    res = client.patch(
        f"/admin/users/{user.id}/status",
        json={"status": "active"},
    )
    assert res.status_code == 409


def test_approved_employer_suspend_then_activate(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "emp-ok@example.com", role="employer").status_code == 201
    assert _login(client, admin.email).status_code == 204

    pending = client.get(
        "/admin/users",
        params={"status": "pending_verification", "role": "employer"},
    ).json()["items"]
    target = next(u for u in pending if u["email"] == "emp-ok@example.com")
    assert client.post(f"/admin/users/{target['id']}/approve").status_code == 200

    assert (
        client.patch(
            f"/admin/users/{target['id']}/status",
            json={"status": "suspended"},
        ).status_code
        == 200
    )
    res = client.patch(
        f"/admin/users/{target['id']}/status",
        json={"status": "active"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "active"
    assert res.json()["approved_at"] is not None


def test_admin_cannot_suspend_self(client, db_session):
    admin = _make_admin(db_session)
    assert _login(client, admin.email).status_code == 204
    res = client.patch(
        f"/admin/users/{admin.id}/status",
        json={"status": "suspended"},
    )
    assert res.status_code == 400
    assert "own account" in res.json()["detail"].lower()


def test_suspend_user_then_login_forbidden(client, db_session):
    admin = _make_admin(db_session)
    email = "to-suspend@example.com"
    assert _register(client, email).status_code == 201

    assert _login(client, admin.email).status_code == 204
    users = client.get("/admin/users", params={"role": "candidate"}).json()["items"]
    target = next(u for u in users if u["email"] == email)

    res = client.patch(
        f"/admin/users/{target['id']}/status",
        json={"status": "suspended"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "suspended"

    client.cookies.clear()
    login = _login(client, email)
    assert login.status_code == 403


def test_suspend_invalidates_existing_access_token(client, db_session):
    admin = _make_admin(db_session)
    email = "suspend-token@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    assert client.get("/auth/me").status_code == 200
    stale_access = client.cookies.get("access_token")
    assert stale_access

    assert _login(client, admin.email).status_code == 204
    users = client.get("/admin/users", params={"role": "candidate"}).json()["items"]
    target = next(u for u in users if u["email"] == email)
    assert (
        client.patch(
            f"/admin/users/{target['id']}/status",
            json={"status": "suspended"},
        ).status_code
        == 200
    )

    client.cookies.clear()
    client.cookies.set("access_token", stale_access)
    assert client.get("/auth/me").status_code == 401


def test_reactivate_keeps_old_token_invalid_new_login_works(client, db_session):
    admin = _make_admin(db_session)
    email = "reactivate-token@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    stale_access = client.cookies.get("access_token")
    assert stale_access

    assert _login(client, admin.email).status_code == 204
    users = client.get("/admin/users", params={"role": "candidate"}).json()["items"]
    target_id = next(u["id"] for u in users if u["email"] == email)

    assert (
        client.patch(
            f"/admin/users/{target_id}/status",
            json={"status": "suspended"},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/admin/users/{target_id}/status",
            json={"status": "active"},
        ).status_code
        == 200
    )

    client.cookies.clear()
    client.cookies.set("access_token", stale_access)
    assert client.get("/auth/me").status_code == 401

    assert _login(client, email).status_code == 204
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_re_suspend_does_not_bump_token_version(client, db_session):
    admin = _make_admin(db_session)
    email = "already-suspended@example.com"
    assert _register(client, email).status_code == 201
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    user.status = UserStatus.suspended
    user.token_version = 3
    db_session.commit()

    assert _login(client, admin.email).status_code == 204
    res = client.patch(
        f"/admin/users/{user.id}/status",
        json={"status": "suspended"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "suspended"

    db_session.refresh(user)
    assert user.status == UserStatus.suspended
    assert user.token_version == 3
