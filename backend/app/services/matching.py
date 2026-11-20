"""Pure matching engine service.

Computes rule-based candidate-to-job match scores, skill overlaps, and experience fit.
No database or HTTP calls belong in this module.
"""

from dataclasses import dataclass
from typing import Any

from app.core.config import settings

SKILL_ALIASES: dict[str, str] = {
    "js": "javascript",
    "ts": "typescript",
    "postgres": "postgresql",
    "reactjs": "react",
    "react.js": "react",
    "nodejs": "node",
    "node.js": "node",
    "nextjs": "next",
    "next.js": "next",
    "expressjs": "express",
    "express.js": "express",
    "mongo": "mongodb",
    "k8s": "kubernetes",
    "rest api": "rest",
    "restful apis": "rest",
    "rest apis": "rest",
    "restful api": "rest",
    "golang": "go",
    "c sharp": "c#",
}


def normalize_skill(s: str) -> str:
    """Normalize skill string: lowercase, strip, collapse whitespace, and map aliases."""
    if not s or not isinstance(s, str):
        return ""
    collapsed = " ".join(s.strip().lower().split())
    return SKILL_ALIASES.get(collapsed, collapsed)


def skill_overlap(
    candidate_skills: list[str] | set[str] | None,
    job_skills: list[str] | set[str] | None,
) -> tuple[float, list[str], list[str]]:
    """Compute skill overlap score and partition job skills into matched and missing.

    Matching is performed on normalized skills. Output retains job's original skill names.
    If the job requires no skills, overlap score is 1.0.
    """
    if not job_skills:
        return 1.0, [], []

    # Deduplicate job skills while preserving original names
    seen_norm: set[str] = set()
    unique_job_skills: list[tuple[str, str]] = []
    for js in job_skills:
        if not js or not isinstance(js, str) or not js.strip():
            continue
        norm = normalize_skill(js)
        if norm and norm not in seen_norm:
            seen_norm.add(norm)
            unique_job_skills.append((js, norm))

    if not unique_job_skills:
        return 1.0, [], []

    cand_set: set[str] = set()
    if candidate_skills:
        for cs in candidate_skills:
            if cs and isinstance(cs, str) and cs.strip():
                norm = normalize_skill(cs)
                if norm:
                    cand_set.add(norm)

    matched: list[str] = []
    missing: list[str] = []
    for orig, norm in unique_job_skills:
        if norm in cand_set:
            matched.append(orig)
        else:
            missing.append(orig)

    score = len(matched) / len(unique_job_skills)
    return score, matched, missing


def experience_fit(
    candidate_years: float | None,
    job_min: float,
    job_max: float,
    neutral_score: float | None = None,
) -> float:
    """Score candidate experience fit against job requirements in [0.0, 1.0].

    - candidate_years is None: neutral_score (default settings.MATCH_NEUTRAL_EXPERIENCE)
    - job_min <= candidate_years <= job_max: 1.0
    - candidate_years > job_max: 0.9 (slight overqualification penalty)
    - candidate_years < job_min: max(0, 1 - (job_min - candidate_years) / max(job_min, 1))
    """
    if neutral_score is None:
        neutral_score = settings.MATCH_NEUTRAL_EXPERIENCE

    if candidate_years is None:
        return float(neutral_score)

    c_years = float(candidate_years)
    j_min = float(job_min)
    j_max = float(job_max)

    if j_min <= c_years <= j_max:
        return 1.0
    if c_years > j_max:
        return 0.9

    diff = j_min - c_years
    denom = max(j_min, 1.0)
    fit = 1.0 - (diff / denom)
    return float(max(0.0, fit))


@dataclass
class MatchResult:
    score: int
    skill_overlap: float
    experience_fit: float
    matched_skills: list[str]
    missing_skills: list[str]
    experience_known: bool
    candidate_experience_years: float | None
    job_experience_min: int
    job_experience_max: int


def compute_match(
    parsed_data: dict | None,
    job: Any,
    w_skill: float | None = None,
    w_exp: float | None = None,
) -> MatchResult:
    """Calculate match metrics between a candidate's parsed resume and a job."""
    candidate_skills: list[str] = []
    candidate_years: float | None = None
    if parsed_data and isinstance(parsed_data, dict):
        raw_skills = parsed_data.get("skills")
        if isinstance(raw_skills, list):
            candidate_skills = [s for s in raw_skills if isinstance(s, str)]
        raw_years = parsed_data.get("total_experience_years")
        if raw_years is not None:
            try:
                candidate_years = float(raw_years)
            except (ValueError, TypeError):
                candidate_years = None

    experience_known = candidate_years is not None

    if isinstance(job, dict):
        job_skills = job.get("skills") or []
        job_min = job.get("experience_min_years", 0)
        job_max = job.get("experience_max_years", 0)
    else:
        job_skills = getattr(job, "skills", None) or []
        job_min = getattr(job, "experience_min_years", 0)
        job_max = getattr(job, "experience_max_years", 0)

    try:
        job_min_int = int(job_min)
    except (ValueError, TypeError):
        job_min_int = 0

    try:
        job_max_int = int(job_max)
    except (ValueError, TypeError):
        job_max_int = 0

    s_overlap, matched, missing = skill_overlap(candidate_skills, job_skills)
    exp_fit = experience_fit(
        candidate_years,
        job_min_int,
        job_max_int,
        neutral_score=settings.MATCH_NEUTRAL_EXPERIENCE,
    )

    # Weight normalization
    w_s = w_skill if w_skill is not None else settings.MATCH_WEIGHT_SKILLS
    w_e = w_exp if w_exp is not None else settings.MATCH_WEIGHT_EXPERIENCE
    total_w = w_s + w_e
    if total_w > 0:
        w_s_norm = w_s / total_w
        w_e_norm = w_e / total_w
    else:
        w_s_norm = 0.7
        w_e_norm = 0.3

    raw_score = 100.0 * (w_s_norm * s_overlap + w_e_norm * exp_fit)
    final_score = max(0, min(100, round(raw_score)))

    return MatchResult(
        score=final_score,
        skill_overlap=round(s_overlap, 4),
        experience_fit=round(exp_fit, 4),
        matched_skills=matched,
        missing_skills=missing,
        experience_known=experience_known,
        candidate_experience_years=candidate_years,
        job_experience_min=job_min_int,
        job_experience_max=job_max_int,
    )
