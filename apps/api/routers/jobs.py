"""Job management routes."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.job import Job
from apps.api.models.log_file import LogFile
from apps.api.models.site import Site
from apps.api.schemas.job import JobListResponse, JobResponse, JobStatus

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> JobResponse:
    """Get a specific job by ID."""
    result = await db.execute(
        select(Job)
        .options(joinedload(Job.log_file).joinedload(LogFile.site))
        .where(Job.id == job_id)
    )
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify ownership
    if job.log_file.site.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    return JobResponse.model_validate(job)


@router.get("/{job_id}/status", response_model=JobStatus)
async def get_job_status(
    job_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> JobStatus:
    """Get minimal job status (for polling)."""
    result = await db.execute(
        select(Job)
        .options(joinedload(Job.log_file).joinedload(LogFile.site))
        .where(Job.id == job_id)
    )
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify ownership
    if job.log_file.site.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    return JobStatus.model_validate(job)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    current_user: CurrentUser,
    db: DbSession,
    site_id: str | None = None,
    log_file_id: str | None = None,
) -> JobListResponse:
    """List jobs for the current user, optionally filtered by site or log file."""
    query = (
        select(Job)
        .join(LogFile)
        .join(Site)
        .where(Site.user_id == current_user.id)
        .order_by(Job.created_at.desc())
    )

    if site_id:
        query = query.where(Site.id == site_id)
    if log_file_id:
        query = query.where(LogFile.id == log_file_id)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return JobListResponse(
        jobs=[JobResponse.model_validate(job) for job in jobs],
        total=len(jobs),
    )
