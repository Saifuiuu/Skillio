import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.application import ApplicationStatus
from app.models.job import JobStatus, JobType, WorkMode


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class ApplicationCreate(BaseModel):
    job_id: uuid.UUID
    resume_id: uuid.UUID
    cover_note: str | None = Field(default=None, max_length=1000)

    @field_validator("cover_note")
    @classmethod
    def strip_cover_note(cls, v: str | None) -> str | None:
        return _clean_optional_text(v)


class WithdrawRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=200)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, v: str | None) -> str | None:
        return _clean_optional_text(v)


class ApplicationStatusUpdate(str, enum.Enum):
    """Statuses an employer is allowed to set; applied/withdrawn are not allowed."""

    under_review = "under_review"
    shortlisted = "shortlisted"
    interview = "interview"
    selected = "selected"
    rejected = "rejected"


class StatusUpdate(BaseModel):
    status: ApplicationStatusUpdate


class ApplicationOut(BaseModel):
    """Candidate-facing view — flattened job summary, no storage/internal fields."""

    id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    company_name: str
    location: str
    job_type: JobType
    work_mode: WorkMode
    job_status: JobStatus
    resume_id: uuid.UUID
    resume_title: str
    status: ApplicationStatus
    cover_note: str | None = None
    withdraw_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    status_updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationEmployerOut(BaseModel):
    """Employer-facing view — includes candidate identity and the applied resume."""

    id: uuid.UUID
    job_id: uuid.UUID
    candidate_id: uuid.UUID
    candidate_full_name: str | None = None
    candidate_email: str
    resume_id: uuid.UUID
    resume_title: str
    status: ApplicationStatus
    cover_note: str | None = None
    withdraw_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    status_updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedApplicationsOut(BaseModel):
    items: list[ApplicationOut]
    total: int
    page: int
    page_size: int

