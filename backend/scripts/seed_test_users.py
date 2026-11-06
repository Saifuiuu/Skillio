"""Idempotent demo users for manual admin/approval testing.

Run from backend/: python -m scripts.seed_test_users
Reset known accounts: python -m scripts.seed_test_users --reset
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import Role, User, UserStatus

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "Test@12345"
DEMO_DOMAIN = "skillio-demo.com"


@dataclass(frozen=True)
class DemoUserSpec:
    email: str
    role: Role
    status: UserStatus
    email_verified: bool
    approved: bool


DEMO_USERS: tuple[DemoUserSpec, ...] = (
    DemoUserSpec(
        email=f"candidate@{DEMO_DOMAIN}",
        role=Role.candidate,
        status=UserStatus.active,
        email_verified=True,
        approved=False,
    ),
    DemoUserSpec(
        email=f"employer.active@{DEMO_DOMAIN}",
        role=Role.employer,
        status=UserStatus.active,
        email_verified=True,
        approved=True,
    ),
    DemoUserSpec(
        email=f"employer.pending@{DEMO_DOMAIN}",
        role=Role.employer,
        status=UserStatus.pending_verification,
        email_verified=True,
        approved=False,
    ),
    DemoUserSpec(
        email=f"employer.unverified@{DEMO_DOMAIN}",
        role=Role.employer,
        status=UserStatus.pending_verification,
        email_verified=False,
        approved=False,
    ),
    DemoUserSpec(
        email=f"interviewer.pending@{DEMO_DOMAIN}",
        role=Role.interviewer,
        status=UserStatus.pending_verification,
        email_verified=True,
        approved=False,
    ),
)


def _refuse_production() -> None:
    env = (
        os.environ.get("ENVIRONMENT")
        or os.environ.get("APP_ENV")
        or getattr(settings, "ENVIRONMENT", None)
        or "development"
    )
    if str(env).strip().lower() in {"production", "prod"}:
        raise RuntimeError("Refusing to seed test users in production")


def _apply_spec(user: User, spec: DemoUserSpec, *, set_password: bool) -> None:
    user.role = spec.role
    user.status = spec.status
    user.email_verified = spec.email_verified
    user.auth_provider = "local"
    user.approved_at = datetime.now(UTC) if spec.approved else None
    if set_password:
        user.password_hash = hash_password(DEMO_PASSWORD)


def seed_test_users(db: Session, *, reset: bool = False) -> list[tuple[User, str]]:
    """Create or optionally reset the five demo users.

    Returns list of (user, action) where action is created|skipped|reset.
    Never creates or modifies admin accounts.
    """
    _refuse_production()
    results: list[tuple[User, str]] = []

    for spec in DEMO_USERS:
        existing = db.scalar(select(User).where(User.email == spec.email))
        if existing is None:
            user = User(
                email=spec.email,
                password_hash=hash_password(DEMO_PASSWORD),
                role=spec.role,
                status=spec.status,
                auth_provider="local",
                email_verified=spec.email_verified,
                approved_at=datetime.now(UTC) if spec.approved else None,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            results.append((user, "created"))
            continue

        if existing.role == Role.admin:
            raise RuntimeError(f"Refusing to modify admin account {spec.email}")

        if not reset:
            results.append((existing, "skipped"))
            continue

        _apply_spec(existing, spec, set_password=True)
        db.commit()
        db.refresh(existing)
        results.append((existing, "reset"))

    return results


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Seed Skillio demo test users")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset the five demo users to their canonical state",
    )
    args = parser.parse_args(argv)

    try:
        _refuse_production()
    except RuntimeError as exc:
        logger.error("%s", exc)
        return 1

    db = SessionLocal()
    try:
        results = seed_test_users(db, reset=args.reset)
    except RuntimeError as exc:
        logger.error("%s", exc)
        return 1
    finally:
        db.close()

    print()
    print(f"{'Email':<40} {'Role':<12} {'Status':<22} {'Password'}")
    print("-" * 90)
    for user, action in results:
        print(
            f"{user.email:<40} {user.role.value:<12} {user.status.value:<22} "
            f"{DEMO_PASSWORD}  ({action})"
        )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
