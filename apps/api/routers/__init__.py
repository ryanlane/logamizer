"""API routers."""

from apps.api.routers.auth import router as auth_router
from apps.api.routers.jobs import router as jobs_router
from apps.api.routers.sites import router as sites_router
from apps.api.routers.uploads import router as uploads_router

__all__ = [
    "auth_router",
    "sites_router",
    "uploads_router",
    "jobs_router",
]
