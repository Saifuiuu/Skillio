import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.job import JobCategory, JobType, WorkMode


class MatchOut(BaseModel):
    score: int
    skill_overlap: float
    experience_fit: float
    matched_skills: list[str]
    missing_skills: list[str]
    experience_known: bool
    candidate_experience_years: float | None
    job_experience_min: int
    job_experience_max: int

    model_config = ConfigDict(from_attributes=True)


class JobMatchOut(BaseModel):
    id: uuid.UUID
    title: str
    company_name: str
    location: str
    job_type: JobType
    work_mode: WorkMode
    category: JobCategory
    salary_min: int | None
    salary_max: int | None
    currency: str
    created_at: datetime
    match: MatchOut

    model_config = ConfigDict(from_attributes=True)


class PaginatedJobMatchesOut(BaseModel):
    items: list[JobMatchOut]
    total: int
    page: int
    page_size: int
