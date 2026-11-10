"""Jobs Tier-1: employer CRUD + public search/filters."""

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
        json={
            "email": email,
            "password": password,
            "role": role,
            "full_name": full_name,
        },
    )


def _login(client, email: str, password: str = "password1"):
    return client.post("/auth/login", json={"email": email, "password": password})


def _make_employer(
    db_session,
    *,
    email: str = "employer@example.com",
    password: str = "password1",
    email_verified: bool = True,
    status: UserStatus = UserStatus.active,
):
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=Role.employer,
        status=status,
        auth_provider="local",
        email_verified=email_verified,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _job_payload(**overrides):
    base = {
        "title": "Backend Engineer",
        "company_name": "Skillio Labs",
        "description": "Build FastAPI services with PostgreSQL and Redis.",
        "location": "Karachi",
        "job_type": "full_time",
        "work_mode": "hybrid",
        "category": "backend",
        "experience_min_years": 1,
        "experience_max_years": 4,
        "salary_min": 100000,
        "salary_max": 200000,
        "currency": "PKR",
        "skills": ["Python", " FastAPI ", "python", "PostgreSQL"],
    }
    base.update(overrides)
    return base


def test_create_job_verified_active_employer_201(client, db_session):
    employer = _make_employer(db_session)
    assert _login(client, employer.email).status_code == 204
    res = client.post("/jobs", json=_job_payload())
    assert res.status_code == 201
    body = res.json()
    assert body["employer_id"] == str(employer.id)
    assert body["source"] == "employer_posted"
    assert body["status"] == "active"
    assert body["skills"] == ["python", "fastapi", "postgresql"]
    assert "password" not in body
    assert "password_hash" not in body
    assert "email" not in body


def test_create_job_authz(client, db_session):
    client.cookies.clear()
    assert client.post("/jobs", json=_job_payload()).status_code == 401

    assert _register(client, "cand@example.com", role="candidate").status_code == 201
    assert _login(client, "cand@example.com").status_code == 204
    assert client.post("/jobs", json=_job_payload()).status_code == 403

    unverified = _make_employer(
        db_session, email="unverified@example.com", email_verified=False
    )
    assert _login(client, unverified.email).status_code == 204
    res = client.post("/jobs", json=_job_payload())
    assert res.status_code == 403
    assert "email" in res.json()["detail"].lower()

    pending = _make_employer(
        db_session,
        email="pending@example.com",
        status=UserStatus.pending_verification,
    )
    assert _login(client, pending.email).status_code == 204
    res = client.post("/jobs", json=_job_payload())
    assert res.status_code == 403
    assert "approved" in res.json()["detail"].lower()


def test_public_list_only_active_and_filters(client, db_session):
    employer = _make_employer(db_session)
    assert _login(client, employer.email).status_code == 204

    a = client.post(
        "/jobs",
        json=_job_payload(
            title="React Frontend Developer",
            description="React and TypeScript UI work",
            category="frontend",
            job_type="full_time",
            work_mode="remote",
            location="Lahore",
            company_name="Frontend Co",
            skills=["react", "typescript"],
            experience_min_years=0,
            experience_max_years=2,
            salary_min=80000,
            salary_max=150000,
        ),
    )
    assert a.status_code == 201
    b = client.post(
        "/jobs",
        json=_job_payload(
            title="DevOps Engineer",
            description="Kubernetes and CI pipelines",
            category="devops",
            job_type="contract",
            work_mode="onsite",
            location="Islamabad",
            company_name="Cloud Ops",
            skills=["kubernetes", "docker"],
            experience_min_years=3,
            experience_max_years=6,
            salary_min=200000,
            salary_max=350000,
        ),
    )
    assert b.status_code == 201
    closed_id = b.json()["id"]
    assert client.post(f"/jobs/{closed_id}/close").status_code == 200

    client.cookies.clear()
    listed = client.get("/jobs")
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 1
    assert all(item["status"] == "active" for item in body["items"])
    assert body["items"][0]["title"] == "React Frontend Developer"

    by_q = client.get("/jobs", params={"q": "React TypeScript"})
    assert by_q.status_code == 200
    assert by_q.json()["total"] >= 1

    assert client.get("/jobs", params={"category": "frontend"}).json()["total"] == 1
    assert client.get("/jobs", params={"job_type": "full_time"}).json()["total"] == 1
    assert client.get("/jobs", params={"work_mode": "remote"}).json()["total"] == 1
    assert client.get("/jobs", params={"location": "Lahore"}).json()["total"] == 1
    assert client.get("/jobs", params={"company": "Frontend"}).json()["total"] == 1
    assert (
        client.get("/jobs", params={"skills": "react,typescript"}).json()["total"] == 1
    )
    assert client.get("/jobs", params={"skills": "kubernetes"}).json()["total"] == 0
    assert client.get("/jobs", params={"experience": 1}).json()["total"] == 1
    assert client.get("/jobs", params={"experience": 5}).json()["total"] == 0
    assert client.get("/jobs", params={"salary_min": 100000}).json()["total"] == 1
    assert client.get("/jobs", params={"salary_min": 400000}).json()["total"] == 0


def test_owner_patch_close_and_non_owner_404(client, db_session):
    owner = _make_employer(db_session, email="owner@example.com")
    other = _make_employer(db_session, email="other@example.com")
    assert _login(client, owner.email).status_code == 204
    created = client.post("/jobs", json=_job_payload())
    assert created.status_code == 201
    job_id = created.json()["id"]

    patched = client.patch(
        f"/jobs/{job_id}",
        json={"title": "Senior Backend Engineer", "skills": ["Python", "SQL"]},
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Senior Backend Engineer"
    assert patched.json()["skills"] == ["python", "sql"]

    assert _login(client, other.email).status_code == 204
    assert client.patch(f"/jobs/{job_id}", json={"title": "Hacked"}).status_code == 404
    assert client.post(f"/jobs/{job_id}/close").status_code == 404

    assert _login(client, owner.email).status_code == 204
    first_close = client.post(f"/jobs/{job_id}/close")
    assert first_close.status_code == 200
    assert first_close.json()["status"] == "closed_filled"
    second_close = client.post(f"/jobs/{job_id}/close")
    assert second_close.status_code == 200
    assert second_close.json()["status"] == "closed_filled"

    # Closed job not editable
    assert (
        client.patch(f"/jobs/{job_id}", json={"title": "Nope"}).status_code == 400
    )

    # Owner can still fetch closed job; public cannot
    assert client.get(f"/jobs/{job_id}").status_code == 200
    client.cookies.clear()
    assert client.get(f"/jobs/{job_id}").status_code == 404


def test_validation_errors_422(client, db_session):
    employer = _make_employer(db_session)
    assert _login(client, employer.email).status_code == 204

    bad_exp = client.post(
        "/jobs",
        json=_job_payload(experience_min_years=5, experience_max_years=2),
    )
    assert bad_exp.status_code == 422

    bad_sal = client.post(
        "/jobs",
        json=_job_payload(salary_min=300000, salary_max=100000),
    )
    assert bad_sal.status_code == 422

    too_many = client.post(
        "/jobs",
        json=_job_payload(skills=[f"skill{i}" for i in range(21)]),
    )
    assert too_many.status_code == 422


def test_mine_and_pagination(client, db_session):
    employer = _make_employer(db_session)
    assert _login(client, employer.email).status_code == 204
    for i in range(3):
        assert (
            client.post(
                "/jobs",
                json=_job_payload(title=f"Job {i}", skills=[f"skill{i}"]),
            ).status_code
            == 201
        )

    mine = client.get("/jobs/mine", params={"page": 1, "page_size": 2})
    assert mine.status_code == 200
    body = mine.json()
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["items"]) == 2

    page2 = client.get("/jobs/mine", params={"page": 2, "page_size": 2})
    assert page2.status_code == 200
    assert len(page2.json()["items"]) == 1

    client.cookies.clear()
    public = client.get("/jobs", params={"page": 1, "page_size": 2})
    assert public.status_code == 200
    assert public.json()["total"] == 3
    assert len(public.json()["items"]) == 2

    assert client.get("/jobs", params={"page_size": 51}).status_code == 422
