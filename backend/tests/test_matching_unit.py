"""Unit tests for the matching engine service (no DB or HTTP)."""

import pytest

from app.services.matching import (
    compute_match,
    experience_fit,
    normalize_skill,
    skill_overlap,
)


def test_normalize_skill_aliases():
    """Verify alias mapping and whitespace/casing normalization."""
    # Check all key aliases from requirement
    assert normalize_skill("js") == "javascript"
    assert normalize_skill("JS") == "javascript"
    assert normalize_skill("  ts  ") == "typescript"
    assert normalize_skill("Postgres") == "postgresql"
    assert normalize_skill("reactjs") == "react"
    assert normalize_skill("React.JS") == "react"
    assert normalize_skill("NodeJS") == "node"
    assert normalize_skill("node.js") == "node"
    assert normalize_skill("NextJS") == "next"
    assert normalize_skill("next.js") == "next"
    assert normalize_skill("expressjs") == "express"
    assert normalize_skill("express.js") == "express"
    assert normalize_skill("mongo") == "mongodb"
    assert normalize_skill("k8s") == "kubernetes"
    assert normalize_skill("rest api") == "rest"
    assert normalize_skill("restful apis") == "rest"
    assert normalize_skill("rest apis") == "rest"
    assert normalize_skill("Golang") == "go"
    assert normalize_skill("C Sharp") == "c#"

    # Normalization without alias
    assert normalize_skill("  Python   3  ") == "python 3"
    assert normalize_skill("Docker") == "docker"
    assert normalize_skill("") == ""


def test_skill_overlap_cases():
    """Verify full, partial, none, empty required, duplicates, alias, case/space."""
    # 1. Full overlap
    score, matched, missing = skill_overlap(
        ["Python", "FastAPI", "Postgres"],
        ["python", "fastapi", "postgresql"],
    )
    assert score == 1.0
    assert len(matched) == 3
    assert len(missing) == 0

    # 2. Partial overlap
    score, matched, missing = skill_overlap(
        ["Python"],
        ["Python", "Go", "Docker"],
    )
    assert score == pytest.approx(1 / 3)
    assert matched == ["Python"]
    assert missing == ["Go", "Docker"]

    # 3. None overlap
    score, matched, missing = skill_overlap(
        ["Java", "Spring"],
        ["Python", "FastAPI"],
    )
    assert score == 0.0
    assert matched == []
    assert missing == ["Python", "FastAPI"]

    # 4. Empty required skills -> score 1.0, empty lists
    score, matched, missing = skill_overlap(["Python"], [])
    assert score == 1.0
    assert matched == []
    assert missing == []

    score, matched, missing = skill_overlap(None, None)
    assert score == 1.0
    assert matched == []
    assert missing == []

    # 5. Duplicates in candidate and job
    score, matched, missing = skill_overlap(
        ["python", "PYTHON", "Python"],
        ["Python", "python"],
    )
    assert score == 1.0
    assert len(matched) == 1
    assert len(missing) == 0

    # 6. Alias and case/space in job and candidate
    score, matched, missing = skill_overlap(
        ["  JS  ", "k8s"],
        ["JavaScript", "Kubernetes"],
    )
    assert score == 1.0
    assert matched == ["JavaScript", "Kubernetes"]
    assert missing == []

    # Output uses job's original skill names
    score, matched, missing = skill_overlap(
        ["golang"],
        ["Go", "Rust"],
    )
    assert score == 0.5
    assert matched == ["Go"]
    assert missing == ["Rust"]


def test_experience_fit_cases():
    """Verify None, inside, above, below, min=0, and exact boundaries."""
    # 1. None -> neutral score (0.5 by default)
    assert experience_fit(None, 2, 5) == 0.5
    assert experience_fit(None, 2, 5, neutral_score=0.4) == 0.4

    # 2. Inside range -> 1.0
    assert experience_fit(3, 2, 5) == 1.0
    assert experience_fit(2.5, 2, 5) == 1.0

    # Boundaries: min and max
    assert experience_fit(2, 2, 5) == 1.0
    assert experience_fit(5, 2, 5) == 1.0

    # 3. Above max -> 0.9
    assert experience_fit(6, 2, 5) == 0.9
    assert experience_fit(10, 0, 2) == 0.9

    # 4. Below min -> max(0, 1 - (min - years) / max(min, 1))
    # job min=2, max=5, candidate=1 -> 1 - (2-1)/2 = 0.5
    assert experience_fit(1, 2, 5) == 0.5
    # job min=4, max=6, candidate=1 -> 1 - (4-1)/4 = 0.25
    assert experience_fit(1, 4, 6) == 0.25
    # candidate=0, min=4 -> 1 - 4/4 = 0.0
    assert experience_fit(0, 4, 6) == 0.0
    # candidate=0, min=2 -> 1 - 2/2 = 0.0
    assert experience_fit(0, 2, 4) == 0.0
    # extremely negative or under -> clamped to 0.0
    assert experience_fit(-1, 2, 4) == 0.0

    # 5. min=0 boundary
    # candidate=0, min=0, max=2 -> within range -> 1.0
    assert experience_fit(0, 0, 2) == 1.0


def test_compute_match_weights_and_rounding():
    """Verify score formula, weights normalization, and rounding."""
    job = {
        "skills": ["Python", "FastAPI"],
        "experience_min_years": 2,
        "experience_max_years": 5,
    }
    parsed_data = {
        "skills": ["python", "fastapi"],
        "total_experience_years": 3.0,
    }

    # Perfect match: 1.0 skills (0.7) + 1.0 exp (0.3) = 100
    res = compute_match(parsed_data, job)
    assert res.score == 100
    assert res.skill_overlap == 1.0
    assert res.experience_fit == 1.0
    assert res.matched_skills == ["Python", "FastAPI"]
    assert res.missing_skills == []
    assert res.experience_known is True
    assert res.candidate_experience_years == 3.0

    # Partial match
    parsed_data_partial = {
        "skills": ["python"],
        "total_experience_years": 1.0,  # exp fit: 1 - 1/2 = 0.5
    }
    # skills = 0.5 * 0.7 = 0.35, exp = 0.5 * 0.3 = 0.15 => 0.50 -> 50
    res_part = compute_match(parsed_data_partial, job)
    assert res_part.score == 50
    assert res_part.skill_overlap == 0.5
    assert res_part.experience_fit == 0.5
    assert res_part.matched_skills == ["Python"]
    assert res_part.missing_skills == ["FastAPI"]

    # Rounding check
    # 1/3 skills overlap = 0.3333... exp fit = 1.0
    # raw = 100 * (0.7 * (1/3) + 0.3 * 1.0) = 100 * (0.233333 + 0.3) = 53.333... -> 53
    job_3skills = {
        "skills": ["Python", "Docker", "AWS"],
        "experience_min_years": 1,
        "experience_max_years": 3,
    }
    parsed_1skill = {
        "skills": ["python"],
        "total_experience_years": 2.0,
    }
    res_round = compute_match(parsed_1skill, job_3skills)
    assert res_round.score == 53
    assert res_round.skill_overlap == 0.3333
    assert res_round.experience_fit == 1.0


def test_compute_match_weights_normalization():
    """Verify that un-normalized weights (e.g. 70 and 30) normalize to 1."""
    job = {
        "skills": ["Python"],
        "experience_min_years": 1,
        "experience_max_years": 3,
    }
    parsed = {
        "skills": ["python"],
        "total_experience_years": 2.0,
    }

    # Pass weights sum != 1 (e.g. 7 and 3)
    res = compute_match(parsed, job, w_skill=7.0, w_exp=3.0)
    assert res.score == 100

    # Skills-only weight
    res_skills_only = compute_match(
        {"skills": ["python"], "total_experience_years": None},
        job,
        w_skill=1.0,
        w_exp=0.0,
    )
    assert res_skills_only.score == 100

    # Experience-only weight
    res_exp_only = compute_match(
        {"skills": [], "total_experience_years": 2.0},
        job,
        w_skill=0.0,
        w_exp=1.0,
    )
    assert res_exp_only.score == 100


def test_compute_match_unparsed_or_none():
    """Verify graceful handling when parsed_data is None or empty."""
    job = {
        "skills": ["Python"],
        "experience_min_years": 2,
        "experience_max_years": 4,
    }
    res_none = compute_match(None, job)
    # skills = 0.0 * 0.7 = 0.0, exp = 0.5 * 0.3 = 0.15 -> 15
    assert res_none.score == 15
    assert res_none.skill_overlap == 0.0
    assert res_none.experience_fit == 0.5
    assert res_none.experience_known is False
    assert res_none.candidate_experience_years is None
    assert res_none.missing_skills == ["Python"]
    assert res_none.matched_skills == []
