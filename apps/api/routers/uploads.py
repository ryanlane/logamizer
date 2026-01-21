"""Upload management routes."""

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.job import Job
from apps.api.models.log_file import LogFile
from apps.api.models.site import Site
from apps.api.schemas.job import JobResponse
from apps.api.schemas.log_file import (
    LogFileCreate,
    LogFileListResponse,
    LogFileResponse,
    PresignedUrlResponse,
    UploadConfirmRequest,
)
from apps.api.services.storage import StorageService
from apps.worker.celery_app import celery_app
from packages.shared.constants import PRESIGNED_URL_EXPIRY
from packages.shared.enums import JobStatus, JobType, LogFileStatus

router = APIRouter(prefix="/sites/{site_id}", tags=["uploads"])


async def get_user_site(site_id: str, user_id: str, db) -> Site:
    """Get a site belonging to the current user."""
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == user_id)
    )
    site = result.scalar_one_or_none()
    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found",
        )
    return site


@router.post("/upload-url", response_model=PresignedUrlResponse)
async def get_upload_url(
    site_id: str,
    data: LogFileCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> PresignedUrlResponse:
    """Get a presigned URL for uploading a log file."""
    site = await get_user_site(site_id, current_user.id, db)

    # Generate storage key
    file_id = str(uuid4())
    storage_key = f"{current_user.id}/{site.id}/{file_id}/{data.filename}"

    # Create log file record
    log_file = LogFile(
        id=file_id,
        site_id=site.id,
        filename=data.filename,
        storage_key=storage_key,
        status=LogFileStatus.PENDING_UPLOAD,
    )
    db.add(log_file)
    await db.flush()

    # Generate presigned URL
    storage = StorageService()
    storage.ensure_bucket_exists()
    upload_url = storage.generate_presigned_upload_url(
        key=storage_key,
        content_type=data.content_type,
    )

    return PresignedUrlResponse(
        log_file_id=log_file.id,
        upload_url=upload_url,
        expires_in=PRESIGNED_URL_EXPIRY,
    )


@router.post("/uploads", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def confirm_upload(
    site_id: str,
    data: UploadConfirmRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> JobResponse:
    """Confirm upload completion and start processing job."""
    site = await get_user_site(site_id, current_user.id, db)

    # Get log file
    result = await db.execute(
        select(LogFile).where(
            LogFile.id == data.log_file_id,
            LogFile.site_id == site.id,
        )
    )
    log_file = result.scalar_one_or_none()

    if log_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log file not found",
        )

    if log_file.status != LogFileStatus.PENDING_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Log file is not pending upload (status: {log_file.status})",
        )

    # Verify file exists in storage
    storage = StorageService()
    if not storage.object_exists(log_file.storage_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File not found in storage. Please upload the file first.",
        )

    # Update log file
    log_file.status = LogFileStatus.UPLOADED
    log_file.uploaded_at = datetime.now(UTC)
    if data.size_bytes:
        log_file.size_bytes = data.size_bytes
    else:
        log_file.size_bytes = storage.get_object_size(log_file.storage_key)
    if data.hash_sha256:
        log_file.hash_sha256 = data.hash_sha256

    # Create parse job
    job = Job(
        log_file_id=log_file.id,
        job_type=JobType.PARSE,
        status=JobStatus.PENDING,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Enqueue Celery task
    task = celery_app.send_task(
        "apps.worker.tasks.parse.parse_log_file",
        args=[job.id],
    )
    job.celery_task_id = task.id
    await db.flush()

    return JobResponse.model_validate(job)


@router.get("/log-files", response_model=LogFileListResponse)
async def list_log_files(
    site_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> LogFileListResponse:
    """List all log files for a site."""
    site = await get_user_site(site_id, current_user.id, db)

    result = await db.execute(
        select(LogFile)
        .where(LogFile.site_id == site.id)
        .order_by(LogFile.created_at.desc())
    )
    log_files = result.scalars().all()

    return LogFileListResponse(
        log_files=[LogFileResponse.model_validate(lf) for lf in log_files],
        total=len(log_files),
    )


@router.get("/log-files/{log_file_id}", response_model=LogFileResponse)
async def get_log_file(
    site_id: str,
    log_file_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> LogFileResponse:
    """Get a specific log file."""
    site = await get_user_site(site_id, current_user.id, db)

    result = await db.execute(
        select(LogFile).where(
            LogFile.id == log_file_id,
            LogFile.site_id == site.id,
        )
    )
    log_file = result.scalar_one_or_none()

    if log_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log file not found",
        )

    return LogFileResponse.model_validate(log_file)
