"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.config import get_settings
from apps.api.routers import (
    auth_router,
    explain_router,
    finding_actions_router,
    findings_router,
    jobs_router,
    log_sources_router,
    ollama_router,
    sites_router,
    uploads_router,
)
from apps.api.routers.aggregates import router as aggregates_router
from apps.api.routers.errors import router as errors_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    description="A lightweight log insight and security signal SaaS tool",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(sites_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(aggregates_router, prefix="/api")
app.include_router(findings_router, prefix="/api")
app.include_router(finding_actions_router, prefix="/api")
app.include_router(explain_router, prefix="/api")
app.include_router(ollama_router, prefix="/api")
app.include_router(log_sources_router, prefix="/api")
app.include_router(errors_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.app_name}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
    }
