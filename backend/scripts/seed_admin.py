"""Idempotent admin bootstrap from ADMIN_EMAIL / ADMIN_PASSWORD.

Run from backend/: python -m scripts.seed_admin
"""

from __future__ import annotations

import logging
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import Role, User, UserStatus

logger = logging.getLogger(__name__)


def seed_admin_user(db: Session, email: str, password: str) -> tuple[User, bool]:
    """Ensure an admin exists for *email*.

    Returns (user, created). Never logs password or hash.
    """
    normalized = email.strip().lower()
    existing = db.scalar(select(User).where(User.email == normalized))
    if existing is None:
        user = User(
            email=normalized,
            password_hash=hash_password(password),
            role=Role.admin,
            status=UserStatus.active,
            auth_provider="local",
            is_email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user, True

    existing.role = Role.admin
    existing.status = UserStatus.active
    db.commit()
    db.refresh(existing)
    return existing, False


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    email = (settings.ADMIN_EMAIL or "").strip()
    password = settings.ADMIN_PASSWORD or ""
    if not email or not password:
        logger.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment")
        return 1

    db = SessionLocal()
    try:
        user, created = seed_admin_user(db, email, password)
        if created:
            logger.info("Admin user created id=%s email=%s", user.id, user.email)
        else:
            logger.info(
                "Admin user already present id=%s email=%s; role/status ensured",
                user.id,
                user.email,
            )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
