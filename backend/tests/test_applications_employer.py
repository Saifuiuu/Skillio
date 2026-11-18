"""Employer-side application listing, review, details, and resume access."""

import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from app.core.config import settings
from app.core.security import hash_password
from app.core.storage import save_bytes
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
    full_name: str = "Test Candidate",
    status: UserStatus = UserStatus.active,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("password1"),
        role=role,
        status=status,
        auth_provider="local",
        email_verified=True,
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
) -> Job:
    job = Job(
        employer_id=employer_id,
        title=title,
        company_name="Skillio Labs",
        description="Build backend services.",
        location="Karachi",
        job_type=JobType.full_time,
        work_mode=WorkMode.hybrid,
        category=JobCategory.backend,
        experience_min_years=1,
        experience_max_years=4,
        currency="PKR",
        skills=["python"],
        source=JobSource.employer_posted,
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
    original_filename: str = "backend.pdf",
    stored_filename: str = "stored-backend.pdf",
) -> Resume:
    resume = Resume(
        candidate_id=candidate_id,
        title=title,
        original_filename=original_filename,
        stored_filename=stored_filename,
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


def test_job_applicants_owner_filters_pagination_and_roles(client, db_session):
    employer = _make_user(db_session, email="owner-apps@example.com", role=Role.employer)
    other_employer = _make_user(
        db_session, email="other-employer-apps@example.com", role=Role.employer
    )
    candidate = _make_user(
        db_session,
        email="candidate-apps@example.com",
        role=Role.candidate,
        full_name="Candidate One",
    )
    other_candidate = _make_user(
        db_session,
        email="candidate-two-apps@example.com",
        role=Role.candidate,
        full_name="Candidate Two",
    )
    resume = _make_resume(db_session, candidate_id=candidate.id, title="CV One")
    other_resume = _make_resume(
        db_session, candidate_id=other_candidate.id, title="CV Two"
    )
    job = _make_job(db_session, employer_id=employer.id)
    other_job = _make_job(db_session, employer_id=other_employer.id)

    start = datetime(2026, 1, 1, tzinfo=UTC)
    first = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        created_at=start,
    )
    second = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=other_candidate.id,
        resume_id=other_resume.id,
        status=ApplicationStatus.shortlisted,
        created_at=start + timedelta(minutes=1),
    )
    _make_application(
        db_session,
        job_id=other_job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )

    client.cookies.clear()
    assert client.get(f"/jobs/{job.id}/applications").status_code == 401

    assert _login(client, employer.email).status_code == 204
    result = client.get(f"/jobs/{job.id}/applications")
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["total"] == 2
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert [item["id"] for item in body["items"]] == [
        str(second.id),
        str(first.id),
    ]
    applicant = body["items"][0]
    assert applicant["candidate_full_name"] == "Candidate Two"
    assert applicant["candidate_email"] == other_candidate.email
    assert applicant["resume_title"] == "CV Two"
    assert applicant["cover_note"] is None
    assert applicant["status_updated_at"]
    assert "password_hash" not in applicant
    assert "token_version" not in applicant
    assert "stored_filename" not in applicant
    assert "original_filename" not in applicant

    filtered = client.get(
        f"/jobs/{job.id}/applications", params={"status": "shortlisted"}
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["id"] == str(second.id)

    paged = client.get(
        f"/jobs/{job.id}/applications", params={"page": 2, "page_size": 1}
    )
    assert paged.status_code == 200
    assert paged.json()["total"] == 2
    assert paged.json()["items"][0]["id"] == str(first.id)
    assert (
        client.get(f"/jobs/{job.id}/applications", params={"page_size": 51}).status_code
        == 422
    )
    assert client.get(f"/jobs/{uuid.uuid4()}/applications").status_code == 404
    assert client.get(f"/jobs/{other_job.id}/applications").status_code == 404

    for role in (Role.candidate, Role.admin):
        forbidden = _make_user(
            db_session,
            email=f"{role.value}-apps-list@example.com",
            role=role,
        )
        assert _login(client, forbidden.email).status_code == 204
        assert client.get(f"/jobs/{job.id}/applications").status_code == 403


def test_status_update_allowed_invalid_terminal_and_closed_job(client, db_session):
    employer = _make_user(db_session, email="status-owner@example.com", role=Role.employer)
    other_employer = _make_user(
        db_session, email="status-other@example.com", role=Role.employer
    )
    candidate = _make_user(
        db_session, email="status-candidate@example.com", role=Role.candidate
    )
    resume = _make_resume(db_session, candidate_id=candidate.id)
    job = _make_job(db_session, employer_id=employer.id)
    application = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )
    old_time = datetime(2020, 1, 1, tzinfo=UTC)
    application.status_updated_at = old_time
    db_session.commit()

    assert _login(client, employer.email).status_code == 204
    for new_status in ("under_review", "shortlisted", "interview", "selected"):
        result = client.patch(
            f"/applications/{application.id}/status",
            json={"status": new_status},
        )
        assert result.status_code == 200, result.text
        assert result.json()["status"] == new_status
        assert datetime.fromisoformat(result.json()["status_updated_at"]) > old_time
        assert "password_hash" not in result.json()
        assert "stored_filename" not in result.json()

    for invalid_status in ("applied", "withdrawn"):
        invalid = client.patch(
            f"/applications/{application.id}/status",
            json={"status": invalid_status},
        )
        assert invalid.status_code == 422

    assert (
        client.patch(
            f"/applications/{application.id}/status",
            json={"status": "rejected"},
        ).status_code
        == 409
    )

    rejected_job = _make_job(db_session, employer_id=employer.id, title="Rejected")
    rejected = _make_application(
        db_session,
        job_id=rejected_job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )
    rejected_response = client.patch(
        f"/applications/{rejected.id}/status",
        json={"status": "rejected"},
    )
    assert rejected_response.status_code == 200
    assert rejected_response.json()["status"] == "rejected"
    withdrawn_job = _make_job(db_session, employer_id=employer.id, title="Withdrawn")
    withdrawn = _make_application(
        db_session,
        job_id=withdrawn_job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        status=ApplicationStatus.withdrawn,
    )
    for terminal in (rejected, withdrawn):
        assert client.patch(
            f"/applications/{terminal.id}/status",
            json={"status": "under_review"},
        ).status_code == 409

    closed_job = _make_job(
        db_session,
        employer_id=employer.id,
        title="Closed job",
        status=JobStatus.closed_filled,
    )
    closed_application = _make_application(
        db_session,
        job_id=closed_job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )
    assert client.patch(
        f"/applications/{closed_application.id}/status",
        json={"status": "under_review"},
    ).status_code == 200

    assert _login(client, other_employer.email).status_code == 204
    assert client.patch(
        f"/applications/{closed_application.id}/status",
        json={"status": "shortlisted"},
    ).status_code == 404
    assert _login(client, candidate.email).status_code == 204
    assert client.patch(
        f"/applications/{closed_application.id}/status",
        json={"status": "shortlisted"},
    ).status_code == 403


def test_application_detail_owner_scoping(client, db_session):
    employer = _make_user(db_session, email="detail-owner@example.com", role=Role.employer)
    other_employer = _make_user(
        db_session, email="detail-other-employer@example.com", role=Role.employer
    )
    candidate = _make_user(
        db_session,
        email="detail-candidate@example.com",
        role=Role.candidate,
        full_name="Detail Candidate",
    )
    other_candidate = _make_user(
        db_session, email="detail-other-candidate@example.com", role=Role.candidate
    )
    admin = _make_user(db_session, email="detail-admin@example.com", role=Role.admin)
    interviewer = _make_user(
        db_session, email="detail-interviewer@example.com", role=Role.interviewer
    )
    resume = _make_resume(db_session, candidate_id=candidate.id, title="Detail CV")
    job = _make_job(db_session, employer_id=employer.id)
    application = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )

    assert _login(client, candidate.email).status_code == 204
    candidate_result = client.get(f"/applications/{application.id}")
    assert candidate_result.status_code == 200
    assert candidate_result.json()["job_title"] == job.title
    assert "candidate_email" not in candidate_result.json()

    assert _login(client, employer.email).status_code == 204
    employer_result = client.get(f"/applications/{application.id}")
    assert employer_result.status_code == 200
    assert employer_result.json()["candidate_full_name"] == "Detail Candidate"
    assert employer_result.json()["candidate_email"] == candidate.email
    assert "password_hash" not in employer_result.json()
    assert "stored_filename" not in employer_result.json()

    for user in (other_candidate, other_employer, admin, interviewer):
        assert _login(client, user.email).status_code == 204
        assert client.get(f"/applications/{application.id}").status_code == 404

    assert client.get(f"/applications/{uuid.uuid4()}").status_code == 404
    client.cookies.clear()
    assert client.get(f"/applications/{application.id}").status_code == 401


def test_application_resume_download_owner_archive_and_filename(
    client, db_session, tmp_path, monkeypatch
):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    employer = _make_user(db_session, email="download-owner@example.com", role=Role.employer)
    other_employer = _make_user(
        db_session, email="download-other-employer@example.com", role=Role.employer
    )
    candidate = _make_user(
        db_session, email="download-candidate@example.com", role=Role.candidate
    )
    other_candidate = _make_user(
        db_session, email="download-other-candidate@example.com", role=Role.candidate
    )
    data = b"%PDF-1.4\noriginal resume bytes"
    resume = _make_resume(
        db_session,
        candidate_id=candidate.id,
        title="Archived CV",
        status=ResumeStatus.archived,
        original_filename='résumé "final".pdf',
        stored_filename="archived-resume.pdf",
    )
    save_bytes(resume.stored_filename, data)
    job = _make_job(db_session, employer_id=employer.id)
    application = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )

    for user in (candidate, employer):
        assert _login(client, user.email).status_code == 204
        response = client.get(f"/applications/{application.id}/resume")
        assert response.status_code == 200, response.text
        assert response.content == data
        disposition = response.headers["content-disposition"]
        assert "attachment" in disposition.lower()
        assert quote(resume.original_filename, safe="") in disposition

    for user in (other_employer, other_candidate):
        assert _login(client, user.email).status_code == 204
        assert client.get(f"/applications/{application.id}/resume").status_code == 404

    client.cookies.clear()
    assert client.get(f"/applications/{application.id}/resume").status_code == 401
