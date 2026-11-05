import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class JobType(str, enum.Enum):
    full_time = "full_time"
    part_time = "part_time"
    contract = "contract"
    internship = "internship"


class WorkMode(str, enum.Enum):
    onsite = "onsite"
    remote = "remote"
    hybrid = "hybrid"


class JobCategory(str, enum.Enum):
    frontend = "frontend"
    backend = "backend"
    fullstack = "fullstack"
    mobile = "mobile"
    data_science = "data_science"
    devops = "devops"
    qa = "qa"
    security = "security"
    other = "other"


class JobSource(str, enum.Enum):
    employer_posted = "employer_posted"
    admin_added = "admin_added"
    scraped = "scraped"


class JobStatus(str, enum.Enum):
    active = "active"
    closed_filled = "closed_filled"
    inactive = "inactive"


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("ix_jobs_status", "status"),
        Index("ix_jobs_category", "category"),
        Index("ix_jobs_job_type", "job_type"),
        Index("ix_jobs_work_mode", "work_mode"),
        Index("ix_jobs_location", "location"),
        Index("ix_jobs_company_name", "company_name"),
        Index("ix_jobs_created_at", "created_at"),
        Index("ix_jobs_skills", "skills", postgresql_using="gin"),
        Index(
            "ix_jobs_title_description_fts",
            text("to_tsvector('english', title || ' ' || description)"),
            postgresql_using="gin",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    employer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)

    job_type: Mapped[JobType] = mapped_column(
        Enum(JobType, name="job_type"), nullable=False
    )
    work_mode: Mapped[WorkMode] = mapped_column(
        Enum(WorkMode, name="work_mode"), nullable=False
    )
    category: Mapped[JobCategory] = mapped_column(
        Enum(JobCategory, name="job_category"), nullable=False
    )

    experience_min_years: Mapped[int] = mapped_column(Integer, nullable=False)
    experience_max_years: Mapped[int] = mapped_column(Integer, nullable=False)

    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="PKR")

    skills: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    source: Mapped[JobSource] = mapped_column(
        Enum(JobSource, name="job_source"),
        nullable=False,
        default=JobSource.employer_posted,
    )
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status"),
        nullable=False,
        default=JobStatus.active,
    )

    apply_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
