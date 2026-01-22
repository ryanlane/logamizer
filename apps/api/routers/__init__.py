"""API routers."""

from apps.api.routers.auth import router as auth_router
from apps.api.routers.explain import router as explain_router
from apps.api.routers.finding_actions import router as finding_actions_router
from apps.api.routers.findings import router as findings_router
from apps.api.routers.jobs import router as jobs_router
from apps.api.routers.ollama import router as ollama_router
from apps.api.routers.sites import router as sites_router
from apps.api.routers.uploads import router as uploads_router

__all__ = [
    "auth_router",
    "sites_router",
    "uploads_router",
    "jobs_router",
    "findings_router",
    "finding_actions_router",
    "explain_router",
    "ollama_router",
]
