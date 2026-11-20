"""API tests for the matching engine endpoints and employer applicant ranking."""

import uuid
from datetime import UTC, datetime, timedelta

from app.core.security import hash_password
from app.models.application import Application, ApplicationStatus
from app.models.job import Job, JobCategory, JobSource, JobStatus, JobType, WorkMode
from app.models.resume import ExtractionStatus, ParseStatus, Resume, ResumeStatus
from app.models.user import Role, User, UserStatus


def _login(client, email: str, password: str = "password1"):
    return client.post("/auth/login", json={"email": email, "password": password})


def _make_user(
    db_session,
    *,
    email: str,
    role: Role,
    full_name: str = "Test User",
    status: UserStatus = UserStatus.active,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("password1"),
        role=role,
        status=status,
        auth_provider="local",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_job(
    db_session,
    *,
    employer_id: uuid.UUID,
    title: str = "Backend Engineer",
    skills: list[str] | None = None,
    min_years: int = 1,
    max_years: int = 4,
    status: JobStatus = JobStatus.active,
    created_at: datetime | None = None,
) -> Job:
    job = Job(
        employer_id=employer_id,
        title=title,
        company_name="Skillio Labs",
        description="Build backend services.",
        location="Karachi",
        job_type=JobType.full_time,
        work_mode=WorkMode.hybrid,
        category=JobCategory.backend,
        experience_min_years=min_years,
        experience_max_years=max_years,
        currency="PKR",
        skills=skills if skills is not None else ["python", "fastapi"],
        source=JobSource.employer_posted,
        status=status,
    )
    if created_at is not None:
        job.created_at = created_at
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def _make_resume(
    db_session,
    *,
    candidate_id: uuid.UUID,
    title: str = "Backend CV",
    parsed_data: dict | None = None,
    parse_status: ParseStatus = ParseStatus.ok,
    status: ResumeStatus = ResumeStatus.active,
) -> Resume:
    resume = Resume(
        candidate_id=candidate_id,
        title=title,
        original_filename="cv.pdf",
        stored_filename="stored_cv.pdf",
        content_type="application/pdf",
        file_size_bytes=1024,
        extraction_status=ExtractionStatus.ok,
        status=status,
        parsed_data=parsed_data,
        parse_status=parse_status,
    )
    db_session.add(resume)
    db_session.commit()
    db_session.refresh(resume)
    return resume


def _make_application(
    db_session,
    *,
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    resume_id: uuid.UUID,
    status: ApplicationStatus = ApplicationStatus.applied,
    created_at: datetime | None = None,
) -> Application:
    application = Application(
        job_id=job_id,
        candidate_id=candidate_id,
        resume_id=resume_id,
        status=status,
    )
    if created_at is not None:
        application.created_at = created_at
    db_session.add(application)
    db_session.commit()
    db_session.refresh(application)
    return application


# -----------------------------------------------------------------------------
# 1. GET /matching/jobs/{job_id} Tests
# -----------------------------------------------------------------------------


def test_matching_job_auth_and_roles(client, db_session):
    """Anonymous -> 401; Employer/Admin -> 403; Inactive Candidate -> 403."""
    employer = _make_user(db_session, email="emp1@test.com", role=Role.employer)
    admin = _make_user(db_session, email="admin1@test.com", role=Role.admin)
    inactive_cand = _make_user(
        db_session,
        email="inactive@test.com",
        role=Role.candidate,
        status=UserStatus.suspended,
    )
    job = _make_job(db_session, employer_id=employer.id)
    fake_cv_id = uuid.uuid4()

    # Anonymous -> 401
    client.cookies.clear()
    res = client.get(f"/matching/jobs/{job.id}?resume_id={fake_cv_id}")
    assert res.status_code == 401

    # Employer -> 403
    _login(client, employer.email)
    res = client.get(f"/matching/jobs/{job.id}?resume_id={fake_cv_id}")
    assert res.status_code == 403

    # Admin -> 403
    _login(client, admin.email)
    res = client.get(f"/matching/jobs/{job.id}?resume_id={fake_cv_id}")
    assert res.status_code == 403

    # Inactive candidate -> 403
    _login(client, inactive_cand.email)
    res = client.get(f"/matching/jobs/{job.id}?resume_id={fake_cv_id}")
    assert res.status_code == 403


def test_matching_job_validation_and_errors(client, db_session):
    """Unparsed CV -> 409; Archived/other CV -> 404; Inactive/missing job -> 404."""
    employer = _make_user(db_session, email="emp2@test.com", role=Role.employer)
    cand1 = _make_user(db_session, email="cand1@test.com", role=Role.candidate)
    cand2 = _make_user(db_session, email="cand2@test.com", role=Role.candidate)

    job = _make_job(db_session, employer_id=employer.id)
    inactive_job = _make_job(
        db_session, employer_id=employer.id, status=JobStatus.inactive
    )

    unparsed_cv = _make_resume(
        db_session,
        candidate_id=cand1.id,
        parse_status=ParseStatus.not_parsed,
    )
    archived_cv = _make_resume(
        db_session,
        candidate_id=cand1.id,
        status=ResumeStatus.archived,
        parse_status=ParseStatus.ok,
    )
    cand2_cv = _make_resume(
        db_session,
        candidate_id=cand2.id,
        parse_status=ParseStatus.ok,
    )
    parsed_cv = _make_resume(
        db_session,
        candidate_id=cand1.id,
        parse_status=ParseStatus.ok,
        parsed_data={"skills": ["python"], "total_experience_years": 2.0},
    )

    _login(client, cand1.email)

    # Unparsed CV -> 409 "Analyze your CV first"
    res = client.get(f"/matching/jobs/{job.id}?resume_id={unparsed_cv.id}")
    assert res.status_code == 409
    assert "Analyze your CV first" in res.json()["detail"]

    # Archived CV -> 404
    res = client.get(f"/matching/jobs/{job.id}?resume_id={archived_cv.id}")
    assert res.status_code == 404

    # Other candidate's CV -> 404
    res = client.get(f"/matching/jobs/{job.id}?resume_id={cand2_cv.id}")
    assert res.status_code == 404

    # Missing CV -> 404
    res = client.get(f"/matching/jobs/{job.id}?resume_id={uuid.uuid4()}")
    assert res.status_code == 404

    # Inactive job -> 404
    res = client.get(f"/matching/jobs/{inactive_job.id}?resume_id={parsed_cv.id}")
    assert res.status_code == 404

    # Missing job -> 404
    res = client.get(f"/matching/jobs/{uuid.uuid4()}?resume_id={parsed_cv.id}")
    assert res.status_code == 404


def test_matching_job_success(client, db_session):
    """Candidate checks match against an active job using their parsed CV."""
    employer = _make_user(db_session, email="emp3@test.com", role=Role.employer)
    cand = _make_user(db_session, email="cand3@test.com", role=Role.candidate)
    job = _make_job(
        db_session,
        employer_id=employer.id,
        skills=["Python", "FastAPI", "Docker"],
        min_years=2,
        max_years=4,
    )
    cv = _make_resume(
        db_session,
        candidate_id=cand.id,
        parse_status=ParseStatus.ok,
        parsed_data={
            "skills": ["python", "fastapi"],
            "total_experience_years": 3.0,
        },
    )

    _login(client, cand.email)
    res = client.get(f"/matching/jobs/{job.id}?resume_id={cv.id}")
    assert res.status_code == 200, res.text
    data = res.json()

    # 2 of 3 skills matched = 0.6667 * 0.7 = 0.4667
    # experience 3 years in [2, 4] = 1.0 * 0.3 = 0.3000
    # total = 0.7667 * 100 = 77
    assert data["score"] == 77
    assert data["matched_skills"] == ["Python", "FastAPI"]
    assert data["missing_skills"] == ["Docker"]
    assert data["experience_known"] is True
    assert data["candidate_experience_years"] == 3.0
    assert data["job_experience_min"] == 2
    assert data["job_experience_max"] == 4


# -----------------------------------------------------------------------------
# 2. GET /matching/recommendations Tests
# -----------------------------------------------------------------------------


def test_recommendations_auth_and_validation(client, db_session):
    """Anonymous -> 401; Employer -> 403; Unparsed CV -> 409."""
    employer = _make_user(db_session, email="emp4@test.com", role=Role.employer)
    cand = _make_user(db_session, email="cand4@test.com", role=Role.candidate)
    unparsed_cv = _make_resume(
        db_session, candidate_id=cand.id, parse_status=ParseStatus.not_parsed
    )

    client.cookies.clear()
    assert client.get(f"/matching/recommendations?resume_id={unparsed_cv.id}").status_code == 401

    _login(client, employer.email)
    assert client.get(f"/matching/recommendations?resume_id={unparsed_cv.id}").status_code == 403

    _login(client, cand.email)
    res = client.get(f"/matching/recommendations?resume_id={unparsed_cv.id}")
    assert res.status_code == 409


def test_recommendations_sorting_and_pagination(client, db_session):
    """Recommendations ranked by score DESC, tie-break created_at DESC, min_score, and pagination."""
    employer = _make_user(db_session, email="emp5@test.com", role=Role.employer)
    cand = _make_user(db_session, email="cand5@test.com", role=Role.candidate)

    cv = _make_resume(
        db_session,
        candidate_id=cand.id,
        parse_status=ParseStatus.ok,
        parsed_data={"skills": ["python", "fastapi"], "total_experience_years": 3.0},
    )

    now = datetime(2026, 6, 1, 12, 0, 0, tzinfo=UTC)

    # Job High: 100% skills + 100% exp => score 100
    j_high = _make_job(
        db_session,
        employer_id=employer.id,
        title="High Match Job",
        skills=["python", "fastapi"],
        min_years=1,
        max_years=4,
        created_at=now,
    )

    # Job Mid Older: 50% skills + 100% exp => score 65, created at now + 1 min
    j_mid_older = _make_job(
        db_session,
        employer_id=employer.id,
        title="Mid Match Older",
        skills=["python", "rust"],
        min_years=1,
        max_years=4,
        created_at=now + timedelta(minutes=1),
    )

    # Job Mid Newer: 50% skills + 100% exp => score 65, created at now + 2 mins
    j_mid_newer = _make_job(
        db_session,
        employer_id=employer.id,
        title="Mid Match Newer",
        skills=["python", "go"],
        min_years=1,
        max_years=4,
        created_at=now + timedelta(minutes=2),
    )

    # Job Low: 0% skills + below exp => score low
    j_low = _make_job(
        db_session,
        employer_id=employer.id,
        title="Low Match Job",
        skills=["c++", "unreal"],
        min_years=8,
        max_years=10,
        created_at=now + timedelta(minutes=3),
    )

    _login(client, cand.email)

    # 1. Basic recommendations check: order should be j_high, j_mid_newer, j_mid_older, j_low
    res = client.get(f"/matching/recommendations?resume_id={cv.id}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 4
    items = body["items"]

    assert items[0]["id"] == str(j_high.id)
    assert items[0]["match"]["score"] == 100

    # Mid newer before older because score is tied and newer has larger created_at
    assert items[1]["id"] == str(j_mid_newer.id)
    assert items[2]["id"] == str(j_mid_older.id)
    assert items[1]["match"]["score"] == items[2]["match"]["score"] == 65

    assert items[3]["id"] == str(j_low.id)

    # 2. Filter with min_score=60
    res_filtered = client.get(
        f"/matching/recommendations?resume_id={cv.id}&min_score=60"
    )
    assert res_filtered.status_code == 200
    filtered_body = res_filtered.json()
    assert filtered_body["total"] == 3
    assert [x["id"] for x in filtered_body["items"]] == [
        str(j_high.id),
        str(j_mid_newer.id),
        str(j_mid_older.id),
    ]

    # 3. Pagination: page 1 of size 2
    res_p1 = client.get(
        f"/matching/recommendations?resume_id={cv.id}&page=1&page_size=2"
    )
    assert res_p1.status_code == 200
    p1 = res_p1.json()
    assert p1["total"] == 4
    assert len(p1["items"]) == 2
    assert p1["items"][0]["id"] == str(j_high.id)
    assert p1["items"][1]["id"] == str(j_mid_newer.id)

    # page 2 of size 2
    res_p2 = client.get(
        f"/matching/recommendations?resume_id={cv.id}&page=2&page_size=2"
    )
    assert res_p2.status_code == 200
    p2 = res_p2.json()
    assert len(p2["items"]) == 2
    assert p2["items"][0]["id"] == str(j_mid_older.id)
    assert p2["items"][1]["id"] == str(j_low.id)


# -----------------------------------------------------------------------------
# 3. Employer Applicant Ranking & Scoping Tests
# -----------------------------------------------------------------------------


def test_employer_applicant_ranking_newest_default(client, db_session):
    """Default sort='newest' preserves application created_at DESC order with match fields."""
    employer = _make_user(db_session, email="emp6@test.com", role=Role.employer)
    cand1 = _make_user(db_session, email="c1@test.com", role=Role.candidate)
    cand2 = _make_user(db_session, email="c2@test.com", role=Role.candidate)

    job = _make_job(
        db_session,
        employer_id=employer.id,
        skills=["python", "fastapi"],
    )

    cv_parsed = _make_resume(
        db_session,
        candidate_id=cand1.id,
        parse_status=ParseStatus.ok,
        parsed_data={"skills": ["python", "fastapi"], "total_experience_years": 2.0},
    )
    cv_unparsed = _make_resume(
        db_session,
        candidate_id=cand2.id,
        parse_status=ParseStatus.not_parsed,
    )

    start = datetime(2026, 1, 1, 10, 0, 0, tzinfo=UTC)
    app1 = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand1.id,
        resume_id=cv_parsed.id,
        created_at=start,
    )
    app2 = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand2.id,
        resume_id=cv_unparsed.id,
        created_at=start + timedelta(hours=1),
    )

    _login(client, employer.email)
    res = client.get(f"/jobs/{job.id}/applications")
    assert res.status_code == 200
    items = res.json()["items"]

    # Newest first: app2 then app1
    assert items[0]["id"] == str(app2.id)
    assert items[0]["match_score"] is None
    assert items[0]["match_skills_missing"] is None

    assert items[1]["id"] == str(app1.id)
    assert items[1]["match_score"] == 100
    assert items[1]["match_skills_missing"] == []


def test_employer_applicant_ranking_by_match(client, db_session):
    """sort=match orders by match_score DESC, None at bottom, tie-break created_at ASC."""
    employer = _make_user(db_session, email="emp7@test.com", role=Role.employer)
    cand_high = _make_user(db_session, email="chigh@test.com", role=Role.candidate)
    cand_mid_early = _make_user(db_session, email="cearly@test.com", role=Role.candidate)
    cand_mid_late = _make_user(db_session, email="clate@test.com", role=Role.candidate)
    cand_none_early = _make_user(db_session, email="cnearly@test.com", role=Role.candidate)
    cand_none_late = _make_user(db_session, email="cnlate@test.com", role=Role.candidate)

    job = _make_job(
        db_session,
        employer_id=employer.id,
        skills=["python", "fastapi"],
        min_years=2,
        max_years=5,
    )

    # 1. High match (score ~100)
    cv_high = _make_resume(
        db_session,
        candidate_id=cand_high.id,
        parse_status=ParseStatus.ok,
        parsed_data={"skills": ["python", "fastapi"], "total_experience_years": 3.0},
    )
    # 2. Mid match (score ~50)
    cv_mid_early = _make_resume(
        db_session,
        candidate_id=cand_mid_early.id,
        parse_status=ParseStatus.ok,
        parsed_data={"skills": ["python"], "total_experience_years": 1.0},
    )
    cv_mid_late = _make_resume(
        db_session,
        candidate_id=cand_mid_late.id,
        parse_status=ParseStatus.ok,
        parsed_data={"skills": ["python"], "total_experience_years": 1.0},
    )
    # 3. Unparsed (score None)
    cv_none1 = _make_resume(
        db_session,
        candidate_id=cand_none_early.id,
        parse_status=ParseStatus.not_parsed,
    )
    cv_none2 = _make_resume(
        db_session,
        candidate_id=cand_none_late.id,
        parse_status=ParseStatus.failed,
    )

    t0 = datetime(2026, 2, 1, 10, 0, 0, tzinfo=UTC)

    # Create applications in shuffled created_at order
    app_high = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand_high.id,
        resume_id=cv_high.id,
        created_at=t0 + timedelta(hours=3),
    )
    app_mid_early = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand_mid_early.id,
        resume_id=cv_mid_early.id,
        created_at=t0 + timedelta(hours=1),
    )
    app_mid_late = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand_mid_late.id,
        resume_id=cv_mid_late.id,
        created_at=t0 + timedelta(hours=4),
    )
    app_none_early = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand_none_early.id,
        resume_id=cv_none1.id,
        created_at=t0,
    )
    app_none_late = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand_none_late.id,
        resume_id=cv_none2.id,
        created_at=t0 + timedelta(hours=5),
    )

    _login(client, employer.email)
    res = client.get(f"/jobs/{job.id}/applications?sort=match")
    assert res.status_code == 200, res.text
    items = res.json()["items"]

    # Expected order:
    # 1. app_high (score 100)
    # 2. app_mid_early (score 50, created earlier at t0+1h)
    # 3. app_mid_late (score 50, created later at t0+4h)
    # 4. app_none_early (score None, created earlier at t0)
    # 5. app_none_late (score None, created later at t0+5h)
    assert items[0]["id"] == str(app_high.id)
    assert items[0]["match_score"] == 100

    assert items[1]["id"] == str(app_mid_early.id)
    assert items[1]["match_score"] == 50

    assert items[2]["id"] == str(app_mid_late.id)
    assert items[2]["match_score"] == 50

    assert items[3]["id"] == str(app_none_early.id)
    assert items[3]["match_score"] is None

    assert items[4]["id"] == str(app_none_late.id)
    assert items[4]["match_score"] is None


def test_employer_scoping_and_candidate_privacy(client, db_session):
    """Employer only sees match for own job. Candidate endpoints never show match score."""
    employer = _make_user(db_session, email="emp8@test.com", role=Role.employer)
    other_employer = _make_user(db_session, email="other_emp@test.com", role=Role.employer)
    cand = _make_user(db_session, email="cand8@test.com", role=Role.candidate)

    job = _make_job(db_session, employer_id=employer.id)
    cv = _make_resume(
        db_session,
        candidate_id=cand.id,
        parse_status=ParseStatus.ok,
        parsed_data={"skills": ["python"], "total_experience_years": 2.0},
    )
    app = _make_application(
        db_session,
        job_id=job.id,
        candidate_id=cand.id,
        resume_id=cv.id,
    )

    # 1. Other employer cannot access applicants of this job -> 404
    _login(client, other_employer.email)
    res = client.get(f"/jobs/{job.id}/applications")
    assert res.status_code == 404

    # 2. Candidate accessing /applications/mine
    _login(client, cand.email)
    res_mine = client.get("/applications/mine")
    assert res_mine.status_code == 200
    mine_item = res_mine.json()["items"][0]
    assert "match_score" not in mine_item
    assert "match_skills_missing" not in mine_item

    # 3. Candidate accessing /applications/{id}
    res_single = client.get(f"/applications/{app.id}")
    assert res_single.status_code == 200
    single_item = res_single.json()
    assert "match_score" not in single_item
    assert "match_skills_missing" not in single_item
