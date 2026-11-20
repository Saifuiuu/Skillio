import uuid
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.core.rate_limit import apply_limit, limiter
from app.core.storage import resume_path
from app.Dtos.application import (
    ApplicationCreate,
    ApplicationEmployerOut,
    ApplicationOut,
    PaginatedApplicationsOut,
    StatusUpdate,
    WithdrawRequest,
)
from app.models.application import Application, ApplicationStatus
from app.models.job import Job, JobSource, JobStatus
from app.models.resume import ParseStatus, Resume, ResumeStatus
from app.models.user import User, UserStatus
from app.services.matching import compute_match

router = APIRouter(prefix="/applications", tags=["applications"])

_MAX_PAGE_SIZE = 50

_WITHDRAWABLE = frozenset({ApplicationStatus.applied, ApplicationStatus.shortlisted})

require_candidate = require_role("candidate")
require_employer = require_role("employer")


def require_active_candidate(
    current_user: User = Depends(require_candidate),
) -> User:
    if current_user.status != UserStatus.active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Candidate account must be active",
        )
    return current_user


def _application_out(
    application: Application, job: Job, resume_title: str
) -> ApplicationOut:
    return ApplicationOut(
        id=application.id,
        job_id=job.id,
        job_title=job.title,
        company_name=job.company_name,
        location=job.location,
        job_type=job.job_type,
        work_mode=job.work_mode,
        job_status=job.status,
        resume_id=application.resume_id,
        resume_title=resume_title,
        status=application.status,
        cover_note=application.cover_note,
        withdraw_reason=application.withdraw_reason,
        created_at=application.created_at,
        updated_at=application.updated_at,
        status_updated_at=application.status_updated_at,
    )


def _employer_application_out(
    application: Application,
    candidate: User,
    resume: Resume,
    job: Job | None = None,
) -> ApplicationEmployerOut:
    match_score = None
    match_skills_missing = None
    if job is not None and resume.parse_status == ParseStatus.ok and resume.parsed_data:
        m = compute_match(resume.parsed_data, job)
        match_score = m.score
        match_skills_missing = m.missing_skills

    return ApplicationEmployerOut(
        id=application.id,
        job_id=application.job_id,
        candidate_id=candidate.id,
        candidate_full_name=candidate.full_name,
        candidate_email=candidate.email,
        resume_id=application.resume_id,
        resume_title=resume.title,
        status=application.status,
        cover_note=application.cover_note,
        withdraw_reason=application.withdraw_reason,
        created_at=application.created_at,
        updated_at=application.updated_at,
        status_updated_at=application.status_updated_at,
        match_score=match_score,
        match_skills_missing=match_skills_missing,
    )


def _application_detail_row(db: Session, application_id: uuid.UUID):
    return db.execute(
        select(Application, Job, Resume, User)
        .join(Job, Job.id == Application.job_id)
        .join(Resume, Resume.id == Application.resume_id)
        .join(User, User.id == Application.candidate_id)
        .where(Application.id == application_id)
    ).first()


def _can_view_application(
    application: Application,
    job: Job,
    current_user: User,
) -> bool:
    if current_user.role.value == "candidate":
        return application.candidate_id == current_user.id
    return (
        current_user.role.value == "employer"
        and current_user.status == UserStatus.active
        and job.employer_id == current_user.id
    )


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(apply_limit)
async def apply_to_job(
    request: Request,
    data: ApplicationCreate,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    if not candidate.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Verify your email before applying",
        )

    job = db.get(Job, data.job_id)
    if job is None or job.status != JobStatus.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.source == JobSource.scraped:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Apply on the original website",
        )

    resume = db.get(Resume, data.resume_id)
    if (
        resume is None
        or resume.candidate_id != candidate.id
        or resume.status != ResumeStatus.active
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")

    existing = db.scalar(
        select(Application.id).where(
            Application.job_id == job.id,
            Application.candidate_id == candidate.id,
            Application.status != ApplicationStatus.withdrawn,
        )
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You have already applied to this job",
        )

    application = Application(
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id,
        status=ApplicationStatus.applied,
        cover_note=data.cover_note,
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        # Two concurrent requests slipped past the pre-check; the partial unique
        # index is authoritative.
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You have already applied to this job",
        ) from None
    db.refresh(application)
    return _application_out(application, job, resume.title)


@router.patch(
    "/{application_id}/status",
    response_model=ApplicationEmployerOut,
)
def update_application_status(
    application_id: uuid.UUID,
    data: StatusUpdate,
    db: Session = Depends(get_db),
    employer: User = Depends(require_employer),
):
    if employer.status != UserStatus.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Employer account must be active")

    row = _application_detail_row(db, application_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    application, job, resume, candidate = row
    if job.employer_id != employer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    target_status = ApplicationStatus(data.status.value)
    terminal_statuses = {
        ApplicationStatus.selected,
        ApplicationStatus.rejected,
        ApplicationStatus.withdrawn,
    }
    if (
        application.status in terminal_statuses
        and application.status != target_status
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Terminal application statuses cannot be changed",
        )

    if application.status != target_status:
        application.status = target_status
        application.status_updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(application)
    return _employer_application_out(application, candidate, resume, job)


@router.get("/{application_id}/resume")
def download_application_resume(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _application_detail_row(db, application_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    application, job, resume, _candidate = row
    if not _can_view_application(application, job, current_user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    path = resume_path(resume.stored_filename)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume file missing")

    filename = Path(resume.original_filename).name
    ascii_name = "".join(
        char
        for char in filename.encode("ascii", "ignore").decode()
        if char.isprintable() and char not in {'"', "\\"}
    ) or "resume"
    encoded = quote(filename, safe="")
    headers = {
        "Content-Disposition": (
            f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded}'
        )
    }
    return FileResponse(path, media_type=resume.content_type, headers=headers)


@router.get("/mine", response_model=PaginatedApplicationsOut)
def list_my_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=_MAX_PAGE_SIZE),
    status_filter: ApplicationStatus | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    filters = [Application.candidate_id == candidate.id]
    if status_filter is not None:
        filters.append(Application.status == status_filter)

    total = (
        db.scalar(select(func.count()).select_from(Application).where(*filters)) or 0
    )
    rows = db.execute(
        select(Application, Job, Resume.title)
        .join(Job, Job.id == Application.job_id)
        .join(Resume, Resume.id == Application.resume_id)
        .where(*filters)
        .order_by(Application.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        _application_out(application, job, resume_title)
        for application, job, resume_title in rows
    ]
    return PaginatedApplicationsOut(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get(
    "/{application_id}",
    response_model=ApplicationOut | ApplicationEmployerOut,
)
def get_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _application_detail_row(db, application_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    application, job, resume, candidate = row
    if not _can_view_application(application, job, current_user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    if current_user.role.value == "candidate":
        return _application_out(application, job, resume.title)
    return _employer_application_out(application, candidate, resume, job)


@router.post("/{application_id}/withdraw", response_model=ApplicationOut)
def withdraw_application(
    application_id: uuid.UUID,
    data: WithdrawRequest,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    row = db.execute(
        select(Application, Job, Resume.title)
        .join(Job, Job.id == Application.job_id)
        .join(Resume, Resume.id == Application.resume_id)
        .where(
            Application.id == application_id,
            Application.candidate_id == candidate.id,
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    application, job, resume_title = row
    if application.status not in _WITHDRAWABLE:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This application can no longer be withdrawn",
        )

    application.status = ApplicationStatus.withdrawn
    application.withdraw_reason = data.reason
    # status_updated_at is plain SQL state; bump it explicitly on the transition.
    application.status_updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(application)
    return _application_out(application, job, resume_title)
