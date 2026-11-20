import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.config import settings
from app.core.database import get_db
from app.Dtos.matching import JobMatchOut, MatchOut, PaginatedJobMatchesOut
from app.models.job import Job, JobStatus
from app.models.resume import ParseStatus, Resume, ResumeStatus
from app.models.user import User, UserStatus
from app.services.matching import MatchResult, compute_match

router = APIRouter(prefix="/matching", tags=["matching"])

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


def _get_active_parsed_resume(
    db: Session, resume_id: uuid.UUID, candidate: User
) -> Resume:
    resume = db.get(Resume, resume_id)
    if (
        resume is None
        or resume.candidate_id != candidate.id
        or resume.status != ResumeStatus.active
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    if resume.parse_status != ParseStatus.ok:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Analyze your CV first",
        )
    return resume


@router.get("/jobs/{job_id}", response_model=MatchOut)
def get_job_match(
    job_id: uuid.UUID,
    resume_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    """Compute on-the-fly match between candidate's active parsed CV and an active job."""
    resume = _get_active_parsed_resume(db, resume_id, candidate)
    job = db.get(Job, job_id)
    if job is None or job.status != JobStatus.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    match_result = compute_match(resume.parsed_data, job)
    return MatchOut.model_validate(match_result)


@router.get("/recommendations", response_model=PaginatedJobMatchesOut)
def get_recommendations(
    resume_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    min_score: int | None = Query(None, ge=0, le=100),
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    """Scan newest active jobs, rank by match score descending, and paginate."""
    resume = _get_active_parsed_resume(db, resume_id, candidate)

    jobs = db.scalars(
        select(Job)
        .where(Job.status == JobStatus.active)
        .order_by(Job.created_at.desc())
        .limit(settings.MATCH_MAX_JOBS_SCANNED)
    ).all()

    scored: list[tuple[Job, MatchResult]] = []
    for job in jobs:
        res = compute_match(resume.parsed_data, job)
        if min_score is not None and res.score < min_score:
            continue
        scored.append((job, res))

    # Sort score DESC, tie-break job.created_at DESC
    scored.sort(key=lambda x: (x[1].score, x[0].created_at), reverse=True)

    total = len(scored)
    start = (page - 1) * page_size
    end = start + page_size
    page_slice = scored[start:end]

    items = [
        JobMatchOut(
            id=j.id,
            title=j.title,
            company_name=j.company_name,
            location=j.location,
            job_type=j.job_type,
            work_mode=j.work_mode,
            category=j.category,
            salary_min=j.salary_min,
            salary_max=j.salary_max,
            currency=j.currency,
            created_at=j.created_at,
            match=MatchOut.model_validate(m),
        )
        for j, m in page_slice
    ]

    return PaginatedJobMatchesOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
