"""Aggregate schemas."""

from datetime import datetime

from pydantic import BaseModel


class TopItem(BaseModel):
    """Top item with count."""

    path: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    status: int | None = None
    count: int


class AggregateResponse(BaseModel):
    """Hourly aggregate response schema."""

    id: str
    site_id: str
    log_file_id: str | None
    hour_bucket: datetime
    requests_count: int
    status_2xx: int
    status_3xx: int
    status_4xx: int
    status_5xx: int
    unique_ips: int
    unique_paths: int
    total_bytes: int
    top_paths: list[dict] | None
    top_ips: list[dict] | None
    top_user_agents: list[dict] | None
    top_status_codes: list[dict] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AggregateListResponse(BaseModel):
    """List of aggregates response."""

    aggregates: list[AggregateResponse]
    total: int


class SiteSummary(BaseModel):
    """Site-wide summary statistics."""

    total_requests: int
    total_bytes: int
    unique_ips: int
    unique_paths: int
    status_2xx: int
    status_3xx: int
    status_4xx: int
    status_5xx: int
    first_seen: datetime | None
    last_seen: datetime | None
    top_paths: list[dict]
    top_ips: list[dict]


class DashboardResponse(BaseModel):
    """Dashboard data for a site."""

    summary: SiteSummary
    hourly_data: list[AggregateResponse]
    recent_uploads: list[dict]
