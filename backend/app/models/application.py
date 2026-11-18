import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    under_review = "under_review"
    shortlisted = "shortlisted"
    interview = "interview"
    selected = "selected"
    rejected = "rejected"
    withdrawn = "withdrawn"


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        # One live application per (job, candidate); withdrawn rows free the slot,
        # so a candidate can apply again to the same job after withdrawing.
        Index(
            "uq_applications_job_candidate_active",
            "job_id",
            "candidate_id",
            unique=True,
            postgresql_where=text("status != 'withdrawn'"),
        ),
        Index("ix_applications_status", "status"),
        Index("ix_applications_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Resume row is never hard-deleted (archived instead); RESTRICT keeps history intact.
    resume_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("resumes.id", ondelete="RESTRICT"), nullable=False
    )

    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status"),
        nullable=False,
        default=ApplicationStatus.applied,
    )

    cover_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    withdraw_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    # Set on every status transition so the candidate/employer timeline stays accurate.
    status_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
