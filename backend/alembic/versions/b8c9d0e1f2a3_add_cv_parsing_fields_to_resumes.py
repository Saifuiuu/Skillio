"""add cv parsing fields to resumes

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-11-19 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: str | Sequence[str] | None = "a7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

resume_parse_status = postgresql.ENUM(
    "not_parsed",
    "parsing",
    "ok",
    "failed",
    name="resume_parse_status",
    create_type=False,
)


def upgrade() -> None:
    resume_parse_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "resumes",
        sa.Column(
            "parsed_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "resumes",
        sa.Column(
            "parse_status",
            resume_parse_status,
            server_default="not_parsed",
            nullable=False,
        ),
    )
    op.add_column(
        "resumes",
        sa.Column("parsed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "resumes",
        sa.Column("parsed_by", sa.String(length=80), nullable=True),
    )
    op.add_column(
        "resumes",
        sa.Column("parse_error", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("resumes", "parse_error")
    op.drop_column("resumes", "parsed_by")
    op.drop_column("resumes", "parsed_at")
    op.drop_column("resumes", "parse_status")
    op.drop_column("resumes", "parsed_data")
    resume_parse_status.drop(op.get_bind(), checkfirst=True)
