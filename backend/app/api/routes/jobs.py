import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user_optional,
    require_active_verified_employer,
    require_employer,
)
from app.core.database import get_db
from app.Dtos.job import JobCreate, JobOut, JobUpdate, PaginatedJobsOut
from app.models.job import Job, JobCategory, JobSource, JobStatus, JobType, WorkMode
from app.models.user import User

router = APIRouter(prefix="/jobs", tags=["jobs"])

_MAX_PAGE_SIZE = 50


def _apply_job_update(job: Job, data: JobUpdate) -> None:
    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(job, key, value)

    exp_min = job.experience_min_years
    exp_max = job.experience_max_years
    if exp_min > exp_max:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "experience_min_years must be <= experience_max_years",
        )
    if (
        job.salary_min is not None
        and job.salary_max is not None
        and job.salary_min > job.salary_max
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "salary_min must be <= salary_max",
        )


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    employer: User = Depends(require_active_verified_employer),
):
    job = Job(
        employer_id=employer.id,
        title=data.title,
        company_name=data.company_name,
        description=data.description,
        location=data.location,
        job_type=data.job_type,
        work_mode=data.work_mode,
        category=data.category,
        experience_min_years=data.experience_min_years,
        experience_max_years=data.experience_max_years,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        currency=data.currency,
        skills=data.skills,
        source=JobSource.employer_posted,
        status=JobStatus.active,
        apply_url=data.apply_url,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/mine", response_model=PaginatedJobsOut)
def list_my_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=_MAX_PAGE_SIZE),
    db: Session = Depends(get_db),
    employer: User = Depends(require_employer),
):
    filters = [Job.employer_id == employer.id]
    total = db.scalar(select(func.count()).select_from(Job).where(*filters)) or 0
    items = db.scalars(
        select(Job)
        .where(*filters)
        .order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return PaginatedJobsOut(
        items=list(items), total=total, page=page, page_size=page_size
    )


@router.get("", response_model=PaginatedJobsOut)
def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=_MAX_PAGE_SIZE),
    q: str | None = Query(None),
    location: str | None = Query(None),
    job_type: JobType | None = Query(None),
    work_mode: WorkMode | None = Query(None),
    category: JobCategory | None = Query(None),
    company: str | None = Query(None),
    skills: str | None = Query(None, description="Comma-separated; job must include all"),
    experience: int | None = Query(None, ge=0, le=50),
    salary_min: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    filters = [Job.status == JobStatus.active]

    if q:
        query = q.strip()
        if query:
            tsvector = func.to_tsvector(
                "english", func.concat(Job.title, " ", Job.description)
            )
            filters.append(tsvector.op("@@")(func.plainto_tsquery("english", query)))

    if location:
        filters.append(Job.location.ilike(f"%{location.strip()}%"))
    if job_type is not None:
        filters.append(Job.job_type == job_type)
    if work_mode is not None:
        filters.append(Job.work_mode == work_mode)
    if category is not None:
        filters.append(Job.category == category)
    if company:
        filters.append(Job.company_name.ilike(f"%{company.strip()}%"))
    if skills:
        wanted = [s.strip().lower() for s in skills.split(",") if s.strip()]
        if wanted:
            filters.append(Job.skills.contains(cast(wanted, ARRAY(String))))
    if experience is not None:
        filters.append(Job.experience_min_years <= experience)
        filters.append(Job.experience_max_years >= experience)
    if salary_min is not None:
        filters.append(
            or_(
                Job.salary_max >= salary_min,
                (Job.salary_max.is_(None)) & (Job.salary_min >= salary_min),
            )
        )

    total = db.scalar(select(func.count()).select_from(Job).where(*filters)) or 0
    items = db.scalars(
        select(Job)
        .where(*filters)
        .order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return PaginatedJobsOut(
        items=list(items), total=total, page=page, page_size=page_size
    )


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    is_owner = current_user is not None and job.employer_id == current_user.id
    if job.status == JobStatus.active or is_owner:
        return job
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")


@router.patch("/{job_id}", response_model=JobOut)
def update_job(
    job_id: uuid.UUID,
    data: JobUpdate,
    db: Session = Depends(get_db),
    employer: User = Depends(require_employer),
):
    job = db.get(Job, job_id)
    if job is None or job.employer_id != employer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.status != JobStatus.active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Only active jobs can be edited",
        )

    _apply_job_update(job, data)
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/close", response_model=JobOut)
def close_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    employer: User = Depends(require_employer),
):
    job = db.get(Job, job_id)
    if job is None or job.employer_id != employer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    if job.status != JobStatus.closed_filled:
        job.status = JobStatus.closed_filled
        db.commit()
        db.refresh(job)
    return job
