import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.resume import ExtractionStatus, ParseStatus, ResumeStatus


class ResumeOut(BaseModel):
    """List/create/patch/archive response — no extracted_text."""

    id: uuid.UUID
    title: str
    original_filename: str
    content_type: str
    file_size_bytes: int
    extraction_status: ExtractionStatus
    status: ResumeStatus
    parse_status: ParseStatus = ParseStatus.not_parsed
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ResumeDetailOut(ResumeOut):
    """Detail GET includes extracted_text and parsed CV information."""

    extracted_text: str | None = None
    parsed_data: dict | None = None
    parsed_by: str | None = None
    parsed_at: datetime | None = None
    parse_error: str | None = None


class ResumeTitleUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
