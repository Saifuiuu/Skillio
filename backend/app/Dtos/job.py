import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.job import JobCategory, JobSource, JobStatus, JobType, WorkMode


def _normalize_skills(skills: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in skills:
        skill = raw.strip().lower()
        if not skill or skill in seen:
            continue
        seen.add(skill)
        cleaned.append(skill)
    if len(cleaned) > 20:
        raise ValueError("At most 20 skills are allowed")
    return cleaned


class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    location: str = Field(min_length=1, max_length=200)
    job_type: JobType
    work_mode: WorkMode
    category: JobCategory
    experience_min_years: int = Field(ge=0, le=50)
    experience_max_years: int = Field(ge=0, le=50)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    currency: str = Field(default="PKR", min_length=1, max_length=10)
    skills: list[str] = Field(default_factory=list, max_length=20)
    apply_url: str | None = Field(default=None, max_length=500)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, v: list[str]) -> list[str]:
        return _normalize_skills(v)

    @field_validator("title", "company_name", "location", "currency")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def check_ranges(self) -> "JobCreate":
        if self.experience_min_years > self.experience_max_years:
            raise ValueError("experience_min_years must be <= experience_max_years")
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError("salary_min must be <= salary_max")
        return self


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    company_name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    location: str | None = Field(default=None, min_length=1, max_length=200)
    job_type: JobType | None = None
    work_mode: WorkMode | None = None
    category: JobCategory | None = None
    experience_min_years: int | None = Field(default=None, ge=0, le=50)
    experience_max_years: int | None = Field(default=None, ge=0, le=50)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=1, max_length=10)
    skills: list[str] | None = Field(default=None, max_length=20)
    apply_url: str | None = Field(default=None, max_length=500)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        return _normalize_skills(v)

    @field_validator("title", "company_name", "location", "currency")
    @classmethod
    def strip_optional(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else None


class JobOut(BaseModel):
    id: uuid.UUID
    employer_id: uuid.UUID
    title: str
    company_name: str
    description: str
    location: str
    job_type: JobType
    work_mode: WorkMode
    category: JobCategory
    experience_min_years: int
    experience_max_years: int
    salary_min: int | None
    salary_max: int | None
    currency: str
    skills: list[str]
    source: JobSource
    status: JobStatus
    apply_url: str | None
    last_seen_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedJobsOut(BaseModel):
    items: list[JobOut]
    total: int
    page: int
    page_size: int
