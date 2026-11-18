"""create applications table

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-19 10:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: str | Sequence[str] | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

application_status = postgresql.ENUM(
    "applied",
    "under_review",
    "shortlisted",
    "interview",
    "selected",
    "rejected",
    "withdrawn",
    name="application_status",
    create_type=False,
)


def upgrade() -> None:
    application_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "applications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("candidate_id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("status", application_status, nullable=False),
        sa.Column("cover_note", sa.Text(), nullable=True),
        sa.Column("withdraw_reason", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "status_updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["candidate_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_applications_job_id", "applications", ["job_id"])
    op.create_index("ix_applications_candidate_id", "applications", ["candidate_id"])
    op.create_index("ix_applications_status", "applications", ["status"])
    op.create_index("ix_applications_created_at", "applications", ["created_at"])
    op.create_index(
        "uq_applications_job_candidate_active",
        "applications",
        ["job_id", "candidate_id"],
        unique=True,
        postgresql_where=sa.text("status != 'withdrawn'"),
    )


def downgrade() -> None:
    op.drop_index("uq_applications_job_candidate_active", table_name="applications")
    op.drop_index("ix_applications_created_at", table_name="applications")
    op.drop_index("ix_applications_status", table_name="applications")
    op.drop_index("ix_applications_candidate_id", table_name="applications")
    op.drop_index("ix_applications_job_id", table_name="applications")
    op.drop_table("applications")
    application_status.drop(op.get_bind(), checkfirst=True)
