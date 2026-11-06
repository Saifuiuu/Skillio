"""Extract plain text from PDF/DOCX resume uploads."""

from __future__ import annotations

from io import BytesIO

from app.models.resume import ExtractionStatus

_MAX_CHARS = 100_000


def _truncate(text: str) -> str:
    text = text.strip()
    if len(text) > _MAX_CHARS:
        return text[:_MAX_CHARS]
    return text


def extract_resume_text(
    data: bytes, content_type: str
) -> tuple[str | None, ExtractionStatus]:
    try:
        if content_type == "application/pdf":
            raw = _extract_pdf(data)
        elif (
            content_type
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ):
            raw = _extract_docx(data)
        else:
            return None, ExtractionStatus.failed
    except Exception:  # noqa: BLE001 — any parse/IO failure maps to failed
        return None, ExtractionStatus.failed

    text = _truncate(raw or "")
    if not text:
        return None, ExtractionStatus.empty
    return text, ExtractionStatus.ok


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def _extract_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)
