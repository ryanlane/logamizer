"""Site schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from packages.shared.enums import LogFormat


class SiteCreate(BaseModel):
    """Site creation request."""

    name: str = Field(min_length=1, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    log_format: LogFormat = LogFormat.NGINX_COMBINED


class SiteUpdate(BaseModel):
    """Site update request."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    log_format: LogFormat | None = None


class SiteResponse(BaseModel):
    """Site response schema."""

    id: str
    name: str
    domain: str | None
    log_format: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SiteListResponse(BaseModel):
    """List of sites response."""

    sites: list[SiteResponse]
    total: int
