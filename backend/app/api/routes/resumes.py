import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter, resume_upload_limit
from app.core.storage import delete_file, resume_path, save_bytes
from app.Dtos.resume import ResumeDetailOut, ResumeOut, ResumeTitleUpdate
from app.models.resume import Resume, ResumeStatus
from app.models.user import User, UserStatus
from app.services.resume_text import extract_resume_text

router = APIRouter(prefix="/resumes", tags=["resumes"])

_PDF_MAGIC = b"%PDF-"
_ZIP_MAGIC = b"PK"
_ALLOWED_EXT = {
    ".pdf": "application/pdf",
    ".docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ),
}

require_candidate = require_role("candidate")


def require_active_candidate(
    current_user: User = Depends(require_candidate),
) -> User:
    if current_user.status != UserStatus.active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Candidate account must be active",
        )
    return current_user


def _max_bytes() -> int:
    return int(settings.MAX_RESUME_SIZE_MB) * 1024 * 1024


def _owner_resume_or_404(
    db: Session, resume_id: uuid.UUID, candidate: User
) -> Resume:
    resume = db.get(Resume, resume_id)
    if resume is None or resume.candidate_id != candidate.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return resume


def _validate_upload(filename: str | None, data: bytes) -> tuple[str, str]:
    if not filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Filename is required")
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXT:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Only PDF and DOCX files are allowed",
        )
    content_type = _ALLOWED_EXT[ext]
    if ext == ".pdf" and not data.startswith(_PDF_MAGIC):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "File content does not match a PDF",
        )
    if ext == ".docx" and not data.startswith(_ZIP_MAGIC):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "File content does not match a DOCX",
        )
    if len(data) > _max_bytes():
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"File exceeds {settings.MAX_RESUME_SIZE_MB} MB limit",
        )
    if len(data) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is empty")
    return ext, content_type


@router.post("", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(resume_upload_limit)
async def upload_resume(
    request: Request,
    title: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    cleaned_title = (title or "").strip()
    if not cleaned_title or len(cleaned_title) > 100:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "title is required and must be at most 100 characters",
        )

    active_count = db.scalar(
        select(func.count())
        .select_from(Resume)
        .where(
            Resume.candidate_id == candidate.id,
            Resume.status == ResumeStatus.active,
        )
    ) or 0
    if active_count >= settings.MAX_ACTIVE_RESUMES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You already have {settings.MAX_ACTIVE_RESUMES} active CVs. "
            "Archive one before uploading another.",
        )

    data = await file.read()
    ext, content_type = _validate_upload(file.filename, data)
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    original_filename = Path(file.filename or f"resume{ext}").name

    extracted_text, extraction_status = extract_resume_text(data, content_type)

    save_bytes(stored_filename, data)
    resume = Resume(
        candidate_id=candidate.id,
        title=cleaned_title,
        original_filename=original_filename,
        stored_filename=stored_filename,
        content_type=content_type,
        file_size_bytes=len(data),
        extracted_text=extracted_text,
        extraction_status=extraction_status,
        status=ResumeStatus.active,
    )
    db.add(resume)
    try:
        db.commit()
    except Exception:
        delete_file(stored_filename)
        raise
    db.refresh(resume)
    return resume


@router.get("", response_model=list[ResumeOut])
def list_resumes(
    status_filter: ResumeStatus = Query(ResumeStatus.active, alias="status"),
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    items = db.scalars(
        select(Resume)
        .where(
            Resume.candidate_id == candidate.id,
            Resume.status == status_filter,
        )
        .order_by(Resume.created_at.desc())
    ).all()
    return list(items)


@router.get("/{resume_id}", response_model=ResumeDetailOut)
def get_resume(
    resume_id: uuid.UUID,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    return _owner_resume_or_404(db, resume_id, candidate)


@router.get("/{resume_id}/file")
def download_resume_file(
    resume_id: uuid.UUID,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    resume = _owner_resume_or_404(db, resume_id, candidate)
    path = resume_path(resume.stored_filename)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume file missing")

    ascii_name = resume.original_filename.encode("ascii", "ignore").decode() or "resume"
    ascii_name = ascii_name.replace('"', "")
    encoded = quote(resume.original_filename)
    headers = {
        "Content-Disposition": (
            f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded}'
        )
    }
    return FileResponse(
        path,
        media_type=resume.content_type,
        headers=headers,
    )


@router.patch("/{resume_id}", response_model=ResumeOut)
def update_resume_title(
    resume_id: uuid.UUID,
    data: ResumeTitleUpdate,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    resume = _owner_resume_or_404(db, resume_id, candidate)
    if resume.status != ResumeStatus.active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Only active resumes can be edited",
        )
    resume.title = data.title.strip()
    db.commit()
    db.refresh(resume)
    return resume


@router.post("/{resume_id}/archive", response_model=ResumeOut)
def archive_resume(
    resume_id: uuid.UUID,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_active_candidate),
):
    resume = _owner_resume_or_404(db, resume_id, candidate)
    if resume.status != ResumeStatus.archived:
        resume.status = ResumeStatus.archived
        resume.archived_at = datetime.now(UTC)
        db.commit()
        db.refresh(resume)
    return resume
