"""Pydantic schemas for API request/response validation."""

from apps.api.schemas.auth import (
    RefreshTokenRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
)
from apps.api.schemas.job import JobCreate, JobResponse, JobStatus
from apps.api.schemas.log_file import (
    LogFileCreate,
    LogFileResponse,
    PresignedUrlResponse,
    UploadConfirmRequest,
)
from apps.api.schemas.site import SiteCreate, SiteResponse, SiteUpdate
from apps.api.schemas.user import UserResponse

__all__ = [
    # Auth
    "UserRegister",
    "UserLogin",
    "TokenResponse",
    "RefreshTokenRequest",
    # User
    "UserResponse",
    # Site
    "SiteCreate",
    "SiteUpdate",
    "SiteResponse",
    # LogFile
    "LogFileCreate",
    "LogFileResponse",
    "PresignedUrlResponse",
    "UploadConfirmRequest",
    # Job
    "JobCreate",
    "JobResponse",
    "JobStatus",
]
