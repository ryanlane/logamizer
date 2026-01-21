"""LogFile schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class LogFileCreate(BaseModel):
    """Log file creation request (for presigned URL)."""

    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="text/plain")


class PresignedUrlResponse(BaseModel):
    """Presigned upload URL response."""

    log_file_id: str
    upload_url: str
    expires_in: int


class UploadConfirmRequest(BaseModel):
    """Confirm upload completion request."""

    log_file_id: str
    size_bytes: int | None = None
    hash_sha256: str | None = None


class LogFileResponse(BaseModel):
    """Log file response schema."""

    id: str
    site_id: str
    filename: str
    size_bytes: int | None
    status: str
    created_at: datetime
    uploaded_at: datetime | None

    model_config = {"from_attributes": True}


class LogFileListResponse(BaseModel):
    """List of log files response."""

    log_files: list[LogFileResponse]
    total: int
