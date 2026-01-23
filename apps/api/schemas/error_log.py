"""Pydantic schemas for error logs."""

from datetime import datetime

from pydantic import BaseModel


class ErrorOccurrenceResponse(BaseModel):
    """Error occurrence response schema."""

    id: str
    error_group_id: str
    log_file_id: str | None
    timestamp: datetime
    error_type: str
    error_message: str
    stack_trace: str | None
    file_path: str | None
    line_number: int | None
    function_name: str | None
    request_url: str | None
    request_method: str | None
    user_id: str | None
    ip_address: str | None
    user_agent: str | None
    context: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorGroupResponse(BaseModel):
    """Error group response schema."""

    id: str
    site_id: str
    fingerprint: str
    error_type: str
    error_message: str
    first_seen: datetime
    last_seen: datetime
    occurrence_count: int
    status: str
    resolved_at: datetime | None
    deployment_id: str | None
    metadata_json: dict | None
    sample_request_url: str | None = None
    sample_ip_address: str | None = None
    sample_request_urls: list[str] | None = None

    class Config:
        from_attributes = True


class ErrorGroupWithOccurrences(BaseModel):
    """Error group with recent occurrences."""

    id: str
    site_id: str
    fingerprint: str
    error_type: str
    error_message: str
    first_seen: datetime
    last_seen: datetime
    occurrence_count: int
    status: str
    resolved_at: datetime | None
    deployment_id: str | None
    metadata_json: dict | None
    sample_request_url: str | None = None
    sample_ip_address: str | None = None
    sample_request_urls: list[str] | None = None
    recent_occurrences: list[ErrorOccurrenceResponse]

    class Config:
        from_attributes = True


class ErrorGroupsListResponse(BaseModel):
    """List of error groups response."""

    error_groups: list[ErrorGroupResponse]
    total: int
    unresolved: int
    resolved: int
    ignored: int


class ErrorTypeCount(BaseModel):
    """Error type count."""

    error_type: str
    count: int


class ErrorTrendPoint(BaseModel):
    """Hourly error trend point."""

    hour: str
    count: int


class ErrorStatsResponse(BaseModel):
    """Error statistics response."""

    total_errors: int
    total_groups: int
    errors_24h: int
    errors_7d: int
    top_error_types: list[ErrorTypeCount]
    error_trend: list[ErrorTrendPoint]  # Hourly error counts


class ErrorGroupUpdateRequest(BaseModel):
    """Request to update error group status."""

    status: str  # unresolved, resolved, ignored
    deployment_id: str | None = None


class ErrorGroupExplainResponse(BaseModel):
    """Explain response for an error group."""

    explanation: str


class AnalyzeLogFileRequest(BaseModel):
    """Request to analyze errors in a log file."""

    log_file_id: str
    log_format: str = "auto"  # auto, python, javascript, java, http
