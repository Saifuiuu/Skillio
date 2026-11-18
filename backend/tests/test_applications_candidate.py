"""Candidate-side applications: apply, /mine listing, withdraw."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.models.application import Application, ApplicationStatus
from app.models.job import Job, JobCategory, JobSource, JobStatus, JobType, WorkMode
from app.models.resume import ExtractionStatus, Resume, ResumeStatus
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


def _make_user(
    db_session,
    *,
    email: str,
    role: Role,
    full_name: str = "Test User",
    email_verified: bool = True,
    status: UserStatus = UserStatus.active,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("password1"),
        role=role,
        status=status,
        auth_provider="local",
        email_verified=email_verified,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_job(
    db_session,
    *,
    employer_id,
    title: str = "Backend Engineer",
    status: JobStatus = JobStatus.active,
    source: JobSource = JobSource.employer_posted,
) -> Job:
    job = Job(
        employer_id=employer_id,
        title=title,
        company_name="Skillio Labs",
        description="Build FastAPI services with PostgreSQL.",
        location="Karachi",
        job_type=JobType.full_time,
        work_mode=WorkMode.hybrid,
        category=JobCategory.backend,
        experience_min_years=1,
        experience_max_years=4,
        currency="PKR",
        skills=["python"],
        source=source,
        status=status,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def _make_resume(
    db_session,
    *,
    candidate_id,
    title: str = "Backend CV",
    status: ResumeStatus = ResumeStatus.active,
) -> Resume:
    resume = Resume(
        candidate_id=candidate_id,
        title=title,
        original_filename="backend.pdf",
        stored_filename="stored-backend.pdf",
        content_type="application/pdf",
        file_size_bytes=1024,
        extraction_status=ExtractionStatus.ok,
        status=status,
    )
    db_session.add(resume)
    db_session.commit()
    db_session.refresh(resume)
    return resume


def _make_application(
    db_session,
    *,
    job_id,
    candidate_id,
    resume_id,
    status: ApplicationStatus = ApplicationStatus.applied,
    created_at: datetime | None = None,
) -> Application:
    application = Application(
        job_id=job_id,
        candidate_id=candidate_id,
        resume_id=resume_id,
        status=status,
    )
    if created_at is not None:
        application.created_at = created_at
    db_session.add(application)
    db_session.commit()
    db_session.refresh(application)
    return application


def _apply(client, *, job_id, resume_id, cover_note: str | None = None):
    return client.post(
        "/applications",
        json={
            "job_id": str(job_id),
            "resume_id": str(resume_id),
            "cover_note": cover_note,
        },
    )


def _seed(db_session, *, email: str = "cand-app@example.com"):
    employer = _make_user(
        db_session, email="emp-app@example.com", role=Role.employer
    )
    candidate = _make_user(db_session, email=email, role=Role.candidate)
    job = _make_job(db_session, employer_id=employer.id)
    resume = _make_resume(db_session, candidate_id=candidate.id)
    return employer, candidate, job, resume


def test_apply_verified_candidate_201(client, db_session):
    email = "cand-apply@example.com"
    assert _register(client, email).status_code == 201
    candidate = db_session.scalar(select(User).where(User.email == email))
    assert candidate.full_name == "Test User"
    candidate.email_verified = True
    db_session.commit()
    assert _login(client, email).status_code == 204

    employer = _make_user(db_session, email="emp-apply@example.com", role=Role.employer)
    job = _make_job(db_session, employer_id=employer.id)
    resume = _make_resume(db_session, candidate_id=candidate.id, title="My CV")

    res = _apply(client, job_id=job.id, resume_id=resume.id, cover_note="  Hi there  ")
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "applied"
    assert body["job_id"] == str(job.id)
    assert body["job_title"] == "Backend Engineer"
    assert body["company_name"] == "Skillio Labs"
    assert body["location"] == "Karachi"
    assert body["job_type"] == "full_time"
    assert body["work_mode"] == "hybrid"
    assert body["job_status"] == "active"
    assert body["resume_id"] == str(resume.id)
    assert body["resume_title"] == "My CV"
    assert body["cover_note"] == "Hi there"
    assert "stored_filename" not in body
    assert "candidate_id" not in body
    assert "email" not in body


def test_apply_unverified_email_403(client, db_session):
    employer = _make_user(
        db_session, email="emp-unverified@example.com", role=Role.employer
    )
    candidate = _make_user(
        db_session,
        email="cand-unverified@example.com",
        role=Role.candidate,
        email_verified=False,
    )
    job = _make_job(db_session, employer_id=employer.id)
    resume = _make_resume(db_session, candidate_id=candidate.id)

    assert _login(client, candidate.email).status_code == 204
    res = _apply(client, job_id=job.id, resume_id=resume.id)
    assert res.status_code == 403
    assert "verify your email" in res.json()["detail"].lower()


def test_apply_rbac_401_and_403(client, db_session):
    *_, job, resume = _seed(db_session)

    client.cookies.clear()
    assert _apply(client, job_id=job.id, resume_id=resume.id).status_code == 401

    employer = _make_user(
        db_session, email="emp-rbac@example.com", role=Role.employer, email_verified=True
    )
    assert _login(client, employer.email).status_code == 204
    assert _apply(client, job_id=job.id, resume_id=resume.id).status_code == 403

    for role in (Role.admin, Role.interviewer):
        user = _make_user(
            db_session, email=f"{role.value}-rbac@example.com", role=role
        )
        assert _login(client, user.email).status_code == 204
        assert _apply(client, job_id=job.id, resume_id=resume.id).status_code == 403


def test_apply_resume_scoped_to_candidate_404(client, db_session):
    _, candidate, job, _ = _seed(db_session)
    other = _make_user(
        db_session, email="cand-other-resume@example.com", role=Role.candidate
    )
    foreign_resume = _make_resume(db_session, candidate_id=other.id)
    archived_resume = _make_resume(
        db_session,
        candidate_id=candidate.id,
        title="Old CV",
        status=ResumeStatus.archived,
    )

    assert _login(client, candidate.email).status_code == 204
    assert _apply(client, job_id=job.id, resume_id=foreign_resume.id).status_code == 404
    assert _apply(client, job_id=job.id, resume_id=archived_resume.id).status_code == 404
    missing = client.post(
        "/applications",
        json={"job_id": str(job.id), "resume_id": str(uuid.uuid4())},
    )
    assert missing.status_code == 404


def test_apply_inactive_or_missing_job_404(client, db_session):
    employer, candidate, _, resume = _seed(db_session)
    closed = _make_job(
        db_session, employer_id=employer.id, title="Closed", status=JobStatus.closed_filled
    )

    assert _login(client, candidate.email).status_code == 204
    assert _apply(client, job_id=closed.id, resume_id=resume.id).status_code == 404
    missing = client.post(
        "/applications",
        json={"job_id": str(uuid.uuid4()), "resume_id": str(resume.id)},
    )
    assert missing.status_code == 404


def test_apply_scraped_job_400(client, db_session):
    employer, candidate, _, resume = _seed(db_session)
    scraped = _make_job(
        db_session,
        employer_id=employer.id,
        title="Scraped Role",
        source=JobSource.scraped,
    )

    assert _login(client, candidate.email).status_code == 204
    res = _apply(client, job_id=scraped.id, resume_id=resume.id)
    assert res.status_code == 400
    assert "original website" in res.json()["detail"].lower()


def test_apply_duplicate_409_then_reapply_after_withdraw_201(client, db_session):
    _, candidate, job, resume = _seed(db_session)
    assert _login(client, candidate.email).status_code == 204

    first = _apply(client, job_id=job.id, resume_id=resume.id)
    assert first.status_code == 201

    dup = _apply(client, job_id=job.id, resume_id=resume.id)
    assert dup.status_code == 409
    assert "already applied" in dup.json()["detail"].lower()

    withdraw = client.post(
        f"/applications/{first.json()['id']}/withdraw", json={"reason": "changed mind"}
    )
    assert withdraw.status_code == 200
    assert withdraw.json()["status"] == "withdrawn"

    again = _apply(client, job_id=job.id, resume_id=resume.id)
    assert again.status_code == 201
    assert again.json()["status"] == "applied"


def test_withdraw_allowed_states_bumps_status_updated_at(client, db_session):
    _, candidate, job, resume = _seed(db_session)
    applied = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )
    applied.status_updated_at = datetime(2020, 1, 1, tzinfo=UTC)
    db_session.commit()

    shortlisted_job = _make_job(
        db_session, employer_id=job.employer_id, title="Shortlisted Role"
    )
    shortlisted = _make_application(
        db_session,
        job_id=shortlisted_job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        status=ApplicationStatus.shortlisted,
    )

    assert _login(client, candidate.email).status_code == 204

    res = client.post(
        f"/applications/{applied.id}/withdraw",
        json={"reason": "  accepted elsewhere  "},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "withdrawn"
    assert body["withdraw_reason"] == "accepted elsewhere"
    assert datetime.fromisoformat(body["status_updated_at"]) > datetime(
        2024, 1, 1, tzinfo=UTC
    )

    res2 = client.post(f"/applications/{shortlisted.id}/withdraw", json={})
    assert res2.status_code == 200
    assert res2.json()["status"] == "withdrawn"
    assert res2.json()["withdraw_reason"] is None


def test_withdraw_blocked_states_409(client, db_session):
    _, candidate, job, resume = _seed(db_session)
    assert _login(client, candidate.email).status_code == 204

    blocked_states = (
        ApplicationStatus.under_review,
        ApplicationStatus.interview,
        ApplicationStatus.rejected,
        ApplicationStatus.withdrawn,
    )
    for state in blocked_states:
        state_job = _make_job(
            db_session, employer_id=job.employer_id, title=f"Job {state.value}"
        )
        application = _make_application(
            db_session,
            job_id=state_job.id,
            candidate_id=candidate.id,
            resume_id=resume.id,
            status=state,
        )
        res = client.post(f"/applications/{application.id}/withdraw", json={})
        assert res.status_code == 409, state.value


def test_withdraw_non_owner_404_and_rbac(client, db_session):
    employer, candidate, job, resume = _seed(db_session)
    application = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )

    other = _make_user(
        db_session, email="cand-withdraw-other@example.com", role=Role.candidate
    )
    assert _login(client, other.email).status_code == 204
    assert (
        client.post(f"/applications/{application.id}/withdraw", json={}).status_code
        == 404
    )

    client.cookies.clear()
    assert (
        client.post(f"/applications/{application.id}/withdraw", json={}).status_code
        == 401
    )

    assert _login(client, employer.email).status_code == 204
    assert (
        client.post(f"/applications/{application.id}/withdraw", json={}).status_code
        == 403
    )

    assert _login(client, candidate.email).status_code == 204
    assert (
        client.post(f"/applications/{uuid.uuid4()}/withdraw", json={}).status_code
        == 404
    )


def test_mine_only_own_with_filter_and_pagination(client, db_session):
    employer = _make_user(db_session, email="emp-mine@example.com", role=Role.employer)
    candidate = _make_user(
        db_session, email="cand-mine@example.com", role=Role.candidate
    )
    other = _make_user(
        db_session, email="cand-mine-other@example.com", role=Role.candidate
    )
    resume = _make_resume(db_session, candidate_id=candidate.id, title="Mine CV")
    other_resume = _make_resume(db_session, candidate_id=other.id, title="Other CV")
    jobs = [
        _make_job(db_session, employer_id=employer.id, title=f"Job {i}")
        for i in range(3)
    ]

    base = datetime(2026, 1, 1, tzinfo=UTC)
    older = _make_application(
        db_session,
        job_id=jobs[0].id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        created_at=base,
    )
    middle = _make_application(
        db_session,
        job_id=jobs[1].id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        status=ApplicationStatus.withdrawn,
        created_at=base + timedelta(minutes=1),
    )
    newest = _make_application(
        db_session,
        job_id=jobs[2].id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        created_at=base + timedelta(minutes=2),
    )
    _make_application(
        db_session,
        job_id=jobs[0].id,
        candidate_id=other.id,
        resume_id=other_resume.id,
        created_at=base + timedelta(minutes=3),
    )

    assert _login(client, candidate.email).status_code == 204

    res = client.get("/applications/mine")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert [item["id"] for item in body["items"]] == [
        str(newest.id),
        str(middle.id),
        str(older.id),
    ]
    first = body["items"][0]
    assert first["job_title"] == "Job 2"
    assert first["company_name"] == "Skillio Labs"
    assert first["location"] == "Karachi"
    assert first["job_type"] == "full_time"
    assert first["work_mode"] == "hybrid"
    assert first["job_status"] == "active"
    assert first["resume_title"] == "Mine CV"
    assert "candidate_id" not in first
    assert "stored_filename" not in first

    filtered = client.get("/applications/mine", params={"status": "applied"})
    filtered_body = filtered.json()
    assert filtered_body["total"] == 2
    assert {item["id"] for item in filtered_body["items"]} == {
        str(older.id),
        str(newest.id),
    }

    withdrawn = client.get("/applications/mine", params={"status": "withdrawn"})
    assert withdrawn.json()["total"] == 1
    assert withdrawn.json()["items"][0]["id"] == str(middle.id)

    paged = client.get("/applications/mine", params={"page": 2, "page_size": 2})
    paged_body = paged.json()
    assert paged_body["total"] == 3
    assert paged_body["page"] == 2
    assert paged_body["page_size"] == 2
    assert [item["id"] for item in paged_body["items"]] == [str(older.id)]

    too_big = client.get("/applications/mine", params={"page_size": 51})
    assert too_big.status_code == 422


def test_apply_rate_limit_429(client, db_session, monkeypatch, enable_rate_limiting):
    monkeypatch.setattr(settings, "APPLY_RATE_LIMIT", "2/minute")
    limiter.reset()

    employer = _make_user(db_session, email="emp-rl-app@example.com", role=Role.employer)
    candidate = _make_user(
        db_session, email="cand-rl-app@example.com", role=Role.candidate
    )
    resume = _make_resume(db_session, candidate_id=candidate.id)
    jobs = [
        _make_job(db_session, employer_id=employer.id, title=f"RL Job {i}")
        for i in range(3)
    ]
    assert _login(client, candidate.email).status_code == 204

    for job in jobs[:2]:
        assert _apply(client, job_id=job.id, resume_id=resume.id).status_code == 201

    blocked = _apply(client, job_id=jobs[2].id, resume_id=resume.id)
    assert blocked.status_code == 429
    assert any(key.lower() == "retry-after" for key in blocked.headers)



