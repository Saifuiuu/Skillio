"""Application model: one live application per (job, candidate) + re-apply after withdraw."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.security import hash_password
from app.models.application import Application, ApplicationStatus
from app.models.job import Job, JobCategory, JobSource, JobStatus, JobType, WorkMode
from app.models.resume import ExtractionStatus, Resume, ResumeStatus
from app.models.user import Role, User, UserStatus


def _make_user(
    db_session, *, email: str, role: Role, full_name: str = "Test User"
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("password1"),
        role=role,
        status=UserStatus.active,
        auth_provider="local",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _make_job(db_session, *, employer_id) -> Job:
    job = Job(
        employer_id=employer_id,
        title="Backend Engineer",
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
        source=JobSource.employer_posted,
        status=JobStatus.active,
    )
    db_session.add(job)
    db_session.commit()
    return job


def _make_resume(db_session, *, candidate_id) -> Resume:
    resume = Resume(
        candidate_id=candidate_id,
        title="Backend CV",
        original_filename="backend.pdf",
        stored_filename="stored-backend.pdf",
        content_type="application/pdf",
        file_size_bytes=1024,
        extraction_status=ExtractionStatus.ok,
        status=ResumeStatus.active,
    )
    db_session.add(resume)
    db_session.commit()
    return resume


def _make_application(
    db_session,
    *,
    job_id,
    candidate_id,
    resume_id,
    status: ApplicationStatus = ApplicationStatus.applied,
) -> Application:
    application = Application(
        job_id=job_id,
        candidate_id=candidate_id,
        resume_id=resume_id,
        status=status,
    )
    db_session.add(application)
    return application


def _seed(db_session):
    employer = _make_user(
        db_session, email="emp-applications@example.com", role=Role.employer
    )
    candidate = _make_user(
        db_session,
        email="cand-applications@example.com",
        role=Role.candidate,
        full_name="Ali Ahmed",
    )
    job = _make_job(db_session, employer_id=employer.id)
    resume = _make_resume(db_session, candidate_id=candidate.id)
    return job, candidate, resume


def test_application_insert_persists(db_session):
    job, candidate, resume = _seed(db_session)

    application = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
    )
    db_session.commit()
    db_session.refresh(application)

    assert application.id is not None
    assert application.status is ApplicationStatus.applied
    assert application.cover_note is None
    assert application.withdraw_reason is None
    assert application.created_at is not None
    assert application.updated_at is not None
    assert application.status_updated_at is not None

    stored = db_session.scalar(select(Application).where(Application.id == application.id))
    assert stored is not None
    assert stored.job_id == job.id
    assert stored.candidate_id == candidate.id
    assert stored.resume_id == resume.id


def test_duplicate_active_application_integrity_error(db_session):
    job, candidate, resume = _seed(db_session)

    _make_application(
        db_session, job_id=job.id, candidate_id=candidate.id, resume_id=resume.id
    )
    db_session.commit()

    _make_application(
        db_session, job_id=job.id, candidate_id=candidate.id, resume_id=resume.id
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    total = db_session.scalars(select(Application)).all()
    assert len(total) == 1


def test_reapply_allowed_after_withdraw(db_session):
    job, candidate, resume = _seed(db_session)

    first = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        status=ApplicationStatus.withdrawn,
    )
    db_session.commit()

    # Withdrawn row no longer occupies the partial unique index slot.
    _make_application(
        db_session, job_id=job.id, candidate_id=candidate.id, resume_id=resume.id
    )
    db_session.commit()

    applications = db_session.scalars(
        select(Application).where(
            Application.job_id == job.id, Application.candidate_id == candidate.id
        )
    ).all()
    assert len(applications) == 2
    statuses = {app.status for app in applications}
    assert statuses == {ApplicationStatus.withdrawn, ApplicationStatus.applied}
    assert first.id in {app.id for app in applications}
