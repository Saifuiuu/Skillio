import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.core.rate_limit import apply_limit, limiter
from app.Dtos.application import (
    ApplicationCreate,
    ApplicationOut,
    PaginatedApplicationsOut,
    WithdrawRequest,
)
from app.models.application import Application, ApplicationStatus
from app.models.job import Job, JobSource, JobStatus
from app.models.resume import Resume, ResumeStatus
from app.models.user import User, UserStatus

router = APIRouter(prefix="/applications", tags=["applications"])

_MAX_PAGE_SIZE = 50

_WITHDRAWABLE = frozenset({ApplicationStatus.applied, ApplicationStatus.shortlisted})

require_candidate = require_role("candidate")


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

