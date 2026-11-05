"""create jobs table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-06 02:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

job_type = postgresql.ENUM(
    "full_time",
    "part_time",
    "contract",
    "internship",
    name="job_type",
    create_type=False,
)
work_mode = postgresql.ENUM(
    "onsite", "remote", "hybrid", name="work_mode", create_type=False
)
job_category = postgresql.ENUM(
    "frontend",
    "backend",
    "fullstack",
    "mobile",
    "data_science",
    "devops",
    "qa",
    "security",
    "other",
    name="job_category",
    create_type=False,
)
job_source = postgresql.ENUM(
    "employer_posted",
    "admin_added",
    "scraped",
    name="job_source",
    create_type=False,
)
job_status = postgresql.ENUM(
    "active", "closed_filled", "inactive", name="job_status", create_type=False
)


def upgrade() -> None:
    job_type.create(op.get_bind(), checkfirst=True)
    work_mode.create(op.get_bind(), checkfirst=True)
    job_category.create(op.get_bind(), checkfirst=True)
    job_source.create(op.get_bind(), checkfirst=True)
    job_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("employer_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=False),
        sa.Column("job_type", job_type, nullable=False),
        sa.Column("work_mode", work_mode, nullable=False),
        sa.Column("category", job_category, nullable=False),
        sa.Column("experience_min_years", sa.Integer(), nullable=False),
        sa.Column("experience_max_years", sa.Integer(), nullable=False),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("skills", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("source", job_source, nullable=False),
        sa.Column("status", job_status, nullable=False),
        sa.Column("apply_url", sa.String(length=500), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["employer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jobs_employer_id", "jobs", ["employer_id"])
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_category", "jobs", ["category"])
    op.create_index("ix_jobs_job_type", "jobs", ["job_type"])
    op.create_index("ix_jobs_work_mode", "jobs", ["work_mode"])
    op.create_index("ix_jobs_location", "jobs", ["location"])
    op.create_index("ix_jobs_company_name", "jobs", ["company_name"])
    op.create_index("ix_jobs_created_at", "jobs", ["created_at"])
    op.create_index(
        "ix_jobs_skills",
        "jobs",
        ["skills"],
        postgresql_using="gin",
    )
    op.execute(
        "CREATE INDEX ix_jobs_title_description_fts ON jobs "
        "USING gin (to_tsvector('english', title || ' ' || description))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_jobs_title_description_fts")
    op.drop_index("ix_jobs_skills", table_name="jobs")
    op.drop_index("ix_jobs_created_at", table_name="jobs")
    op.drop_index("ix_jobs_company_name", table_name="jobs")
    op.drop_index("ix_jobs_location", table_name="jobs")
    op.drop_index("ix_jobs_work_mode", table_name="jobs")
    op.drop_index("ix_jobs_job_type", table_name="jobs")
    op.drop_index("ix_jobs_category", table_name="jobs")
    op.drop_index("ix_jobs_status", table_name="jobs")
    op.drop_index("ix_jobs_employer_id", table_name="jobs")
    op.drop_table("jobs")
    job_status.drop(op.get_bind(), checkfirst=True)
    job_source.drop(op.get_bind(), checkfirst=True)
    job_category.drop(op.get_bind(), checkfirst=True)
    work_mode.drop(op.get_bind(), checkfirst=True)
    job_type.drop(op.get_bind(), checkfirst=True)
