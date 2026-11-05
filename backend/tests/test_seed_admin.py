"""Seed script: create admin once; re-run is idempotent."""

from sqlalchemy import func, select

from app.core.security import verify_password
from app.models.user import Role, User, UserStatus
from scripts.seed_admin import seed_admin_user


def test_seed_admin_creates_user(db_session):
    user, created = seed_admin_user(
        db_session, "seed-admin@example.com", "seed-password1"
    )
    assert created is True
    assert user.email == "seed-admin@example.com"
    assert user.role == Role.admin
    assert user.status == UserStatus.active
    assert user.password_hash is not None
    assert verify_password("seed-password1", user.password_hash)


def test_seed_admin_idempotent_no_duplicate(db_session):
    email = "seed-once@example.com"
    first, created1 = seed_admin_user(db_session, email, "password1")
    second, created2 = seed_admin_user(db_session, email, "other-password1")

    assert created1 is True
    assert created2 is False
    assert first.id == second.id
    assert second.role == Role.admin
    assert second.status == UserStatus.active

    count = db_session.scalar(
        select(func.count()).select_from(User).where(User.email == email)
    )
    assert count == 1
    # Password is not overwritten on re-seed
    assert verify_password("password1", second.password_hash)


def test_seed_admin_promotes_existing_user(db_session):
    email = "promote@example.com"
    existing = User(
        email=email,
        password_hash="not-a-real-hash",
        role=Role.candidate,
        status=UserStatus.pending_verification,
        auth_provider="local",
    )
    db_session.add(existing)
    db_session.commit()

    user, created = seed_admin_user(db_session, email, "password1")
    assert created is False
    assert user.role == Role.admin
    assert user.status == UserStatus.active
