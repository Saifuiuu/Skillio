"""Unit tests for scripts.seed_test_users (test DB only)."""

from sqlalchemy import select

from app.models.user import Role, User, UserStatus
from scripts.seed_test_users import DEMO_PASSWORD, DEMO_USERS, seed_test_users


def test_seed_test_users_idempotent_and_reset(db_session):
    first = seed_test_users(db_session, reset=False)
    assert len(first) == 5
    assert all(action == "created" for _, action in first)

    emails = {spec.email for spec in DEMO_USERS}
    users = db_session.scalars(select(User).where(User.email.in_(emails))).all()
    assert len(users) == 5

    by_email = {u.email: u for u in users}
    for spec in DEMO_USERS:
        user = by_email[spec.email]
        assert user.role == spec.role
        assert user.status == spec.status
        assert user.email_verified is spec.email_verified
        assert user.full_name == spec.full_name
        if spec.approved:
            assert user.approved_at is not None
        else:
            assert user.approved_at is None

    second = seed_test_users(db_session, reset=False)
    assert len(second) == 5
    assert all(action == "skipped" for _, action in second)
    assert (
        db_session.scalar(
            select(User).where(User.email == DEMO_USERS[0].email)
        )
        is not None
    )
    count = len(db_session.scalars(select(User).where(User.email.in_(emails))).all())
    assert count == 5

    # Mutate one account, then --reset restores canonical state + password.
    pending = by_email["employer.pending@skillio-demo.com"]
    pending.status = UserStatus.suspended
    pending.approved_at = None
    pending.email_verified = False
    db_session.commit()

    reset = seed_test_users(db_session, reset=True)
    assert len(reset) == 5
    assert all(action == "reset" for _, action in reset)

    db_session.refresh(pending)
    assert pending.status == UserStatus.pending_verification
    assert pending.email_verified is True
    assert pending.approved_at is None
    assert pending.role == Role.employer
    assert pending.password_hash is not None
    assert DEMO_PASSWORD  # password constant used by seed


def test_seed_test_users_main_no_detached_instance_error(db_session, test_engine, capsys, monkeypatch):
    from sqlalchemy.orm import sessionmaker

    import scripts.seed_test_users as seed_script

    TestSession = sessionmaker(bind=test_engine)
    monkeypatch.setattr(seed_script, "SessionLocal", TestSession)

    code = seed_script.main([])
    assert code == 0
    captured = capsys.readouterr()
    assert "Email" in captured.out
    assert "Name" in captured.out
    assert "Test Candidate" in captured.out
    assert "Test Employer Active" in captured.out
