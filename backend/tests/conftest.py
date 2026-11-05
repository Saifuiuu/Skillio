import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401
from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app as fastapi_app


def _assert_test_db_isolated() -> None:
    if not settings.TEST_DATABASE_URL:
        pytest.exit(
            "TEST_DATABASE_URL is missing. Refusing to run tests against the dev database.",
            returncode=2,
        )
    if settings.TEST_DATABASE_URL.strip() == settings.DATABASE_URL.strip():
        pytest.exit(
            "TEST_DATABASE_URL equals DATABASE_URL. Refusing to run (isolation required).",
            returncode=2,
        )
    db_name = make_url(settings.TEST_DATABASE_URL).database or ""
    if not db_name.endswith("_test"):
        pytest.exit(
            f'TEST_DATABASE_URL database name must end with "_test" (got "{db_name}").',
            returncode=2,
        )


_assert_test_db_isolated()


@pytest.fixture(scope="session")
def test_engine():
    url = settings.test_sqlalchemy_url
    engine = create_engine(url, pool_pre_ping=True, poolclass=NullPool)
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(test_engine):
    Session = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    session = Session()
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()
