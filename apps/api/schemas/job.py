"""Job schemas."""

from datetime import datetime

from pydantic import BaseModel

from packages.shared.enums import JobStatus as JobStatusEnum
from packages.shared.enums import JobType


class JobCreate(BaseModel):
    """Job creation request."""

    job_type: JobType = JobType.PARSE


class JobStatus(BaseModel):
    """Job status response (minimal)."""

    id: str
    status: str
    progress: float

    model_config = {"from_attributes": True}


class JobResponse(BaseModel):
    """Job response schema."""

    id: str
    log_file_id: str
    job_type: str
    status: str
    progress: float
    result_summary: str | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    """List of jobs response."""

    jobs: list[JobResponse]
    total: int
