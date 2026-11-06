"""Local file storage under UPLOAD_DIR. Filenames must be server-generated only."""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings


def _upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR)
    if not root.is_absolute():
        # Resolve relative to backend/ package root (…/backend)
        root = Path(__file__).resolve().parents[2] / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def resumes_dir() -> Path:
    path = _upload_root() / "resumes"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_stored_name(stored_filename: str) -> str:
    name = Path(stored_filename).name
    if name != stored_filename or name in {"", ".", ".."}:
        raise ValueError("Invalid stored filename")
    return name


def resume_path(stored_filename: str) -> Path:
    return resumes_dir() / _safe_stored_name(stored_filename)


def save_bytes(stored_filename: str, data: bytes) -> Path:
    dest = resume_path(stored_filename)
    dest.write_bytes(data)
    return dest


def delete_file(stored_filename: str) -> None:
    path = resume_path(stored_filename)
    if path.is_file():
        path.unlink()
