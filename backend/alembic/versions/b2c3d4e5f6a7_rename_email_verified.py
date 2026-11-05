"""rename is_email_verified to email_verified and backfill

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-05 22:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "is_email_verified",
        new_column_name="email_verified",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
    op.execute(
        sa.text(
            "UPDATE users SET email_verified = TRUE WHERE auth_provider = 'google'"
        )
    )
    op.execute(
        sa.text(
            "UPDATE users SET email_verified = FALSE WHERE auth_provider IS DISTINCT FROM 'google'"
        )
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "email_verified",
        new_column_name="is_email_verified",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
