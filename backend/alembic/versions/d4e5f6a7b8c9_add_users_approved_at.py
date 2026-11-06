"""add users.approved_at

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-06 04:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | Sequence[str] | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Existing active employers/interviewers are treated as already approved.
    op.execute(
        """
        UPDATE users
        SET approved_at = NOW()
        WHERE role IN ('employer', 'interviewer')
          AND status = 'active'
          AND approved_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("users", "approved_at")
