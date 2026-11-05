"""Admin user management APIs behind require_admin."""

from app.core.security import hash_password
from app.models.user import Role, User, UserStatus


def _register(client, email: str, password: str = "password1", role: str = "candidate"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": password, "role": role},
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
        is_email_verified=True,
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
    _assert_no_sensitive(body)


def test_get_user_404(client, db_session):
    admin = _make_admin(db_session)
    assert _login(client, admin.email).status_code == 204
    res = client.get("/admin/users/00000000-0000-0000-0000-000000000001")
    assert res.status_code == 404


# --- approve / suspend ---


def test_approve_pending_verification(client, db_session):
    admin = _make_admin(db_session)
    assert _register(client, "employer@example.com", role="employer").status_code == 201
    assert _login(client, admin.email).status_code == 204

    pending = client.get(
        "/admin/users", params={"status": "pending_verification"}
    ).json()["items"][0]
    assert pending["status"] == "pending_verification"

    res = client.patch(
        f"/admin/users/{pending['id']}/status",
        json={"status": "active"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "active"
    _assert_no_sensitive(res.json())


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

    # Resolve target id while admin is logged in
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
