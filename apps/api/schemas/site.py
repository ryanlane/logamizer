"""Site schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from packages.shared.enums import LogFormat


class SiteCreate(BaseModel):
    """Site creation request."""

    name: str = Field(min_length=1, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    log_format: LogFormat = LogFormat.NGINX_COMBINED
    anomaly_baseline_days: int = Field(default=7, ge=1, le=30)
    anomaly_min_baseline_hours: int = Field(default=24, ge=1, le=168)
    anomaly_z_threshold: float = Field(default=3.0, ge=0.5, le=10.0)
    anomaly_new_path_min_count: int = Field(default=20, ge=1, le=10000)


class SiteUpdate(BaseModel):
    """Site update request."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    log_format: LogFormat | None = None
    anomaly_baseline_days: int | None = Field(default=None, ge=1, le=30)
    anomaly_min_baseline_hours: int | None = Field(default=None, ge=1, le=168)
    anomaly_z_threshold: float | None = Field(default=None, ge=0.5, le=10.0)
    anomaly_new_path_min_count: int | None = Field(default=None, ge=1, le=10000)


class SiteResponse(BaseModel):
    """Site response schema."""

    id: str
    name: str
    domain: str | None
    log_format: str
    anomaly_baseline_days: int
    anomaly_min_baseline_hours: int
    anomaly_z_threshold: float
    anomaly_new_path_min_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SiteListResponse(BaseModel):
    """List of sites response."""

    sites: list[SiteResponse]
    total: int
