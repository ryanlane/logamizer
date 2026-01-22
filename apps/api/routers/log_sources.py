"""Log source routes for scheduled fetching."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.log_source import LogSource
from apps.api.models.site import Site
from apps.api.schemas.log_source import (
    LogSourceCreate,
    LogSourceListResponse,
    LogSourceResponse,
    LogSourceUpdate,
)

router = APIRouter(prefix="/sites/{site_id}/log-sources", tags=["log-sources"])


def redact_sensitive_fields(config: dict, source_type: str) -> dict:
    """Redact sensitive fields from connection config."""
    redacted = config.copy()

    if source_type in ["ssh", "sftp"]:
        if "password" in redacted:
            redacted["password"] = "***REDACTED***"
        if "private_key" in redacted:
            redacted["private_key"] = "***REDACTED***"
    elif source_type in ["s3", "gcs"]:
        if "access_key_id" in redacted:
            redacted["access_key_id"] = "***REDACTED***"
        if "secret_access_key" in redacted:
            redacted["secret_access_key"] = "***REDACTED***"

    return redacted


@router.get("", response_model=LogSourceListResponse)
async def list_log_sources(
    site_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> LogSourceListResponse:
    """List all log sources for a site."""
    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Get all log sources for this site
    result = await db.execute(
        select(LogSource)
        .where(LogSource.site_id == site_id)
        .options(selectinload(LogSource.site))
        .order_by(LogSource.created_at.desc())
    )
    log_sources = result.scalars().all()

    # Redact sensitive fields
    sources_with_redacted = []
    for source in log_sources:
        source_dict = {
            "id": source.id,
            "site_id": source.site_id,
            "name": source.name,
            "source_type": source.source_type,
            "status": source.status,
            "connection_config": redact_sensitive_fields(
                source.connection_config, source.source_type
            ),
            "schedule_type": source.schedule_type,
            "schedule_config": source.schedule_config,
            "last_fetch_at": source.last_fetch_at,
            "last_fetch_status": source.last_fetch_status,
            "last_fetch_error": source.last_fetch_error,
            "last_fetched_bytes": source.last_fetched_bytes,
            "created_at": source.created_at,
            "updated_at": source.updated_at,
        }
        sources_with_redacted.append(LogSourceResponse(**source_dict))

    return LogSourceListResponse(
        log_sources=sources_with_redacted,
        total=len(sources_with_redacted),
    )


@router.post("", response_model=LogSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_log_source(
    site_id: str,
    log_source_data: LogSourceCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> LogSourceResponse:
    """Create a new log source."""
    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Create log source
    log_source = LogSource(
        site_id=site_id,
        name=log_source_data.name,
        source_type=log_source_data.source_type,
        connection_config=log_source_data.connection_config,
        schedule_type=log_source_data.schedule_type,
        schedule_config=log_source_data.schedule_config,
        status="active",
    )

    db.add(log_source)
    await db.commit()
    await db.refresh(log_source)

    # Return with redacted sensitive fields
    return LogSourceResponse(
        id=log_source.id,
        site_id=log_source.site_id,
        name=log_source.name,
        source_type=log_source.source_type,
        status=log_source.status,
        connection_config=redact_sensitive_fields(
            log_source.connection_config, log_source.source_type
        ),
        schedule_type=log_source.schedule_type,
        schedule_config=log_source.schedule_config,
        last_fetch_at=log_source.last_fetch_at,
        last_fetch_status=log_source.last_fetch_status,
        last_fetch_error=log_source.last_fetch_error,
        last_fetched_bytes=log_source.last_fetched_bytes,
        created_at=log_source.created_at,
        updated_at=log_source.updated_at,
    )


@router.get("/{log_source_id}", response_model=LogSourceResponse)
async def get_log_source(
    site_id: str,
    log_source_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> LogSourceResponse:
    """Get a specific log source."""
    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Get log source
    result = await db.execute(
        select(LogSource).where(LogSource.id == log_source_id, LogSource.site_id == site_id)
    )
    log_source = result.scalar_one_or_none()

    if log_source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log source not found",
        )

    return LogSourceResponse(
        id=log_source.id,
        site_id=log_source.site_id,
        name=log_source.name,
        source_type=log_source.source_type,
        status=log_source.status,
        connection_config=redact_sensitive_fields(
            log_source.connection_config, log_source.source_type
        ),
        schedule_type=log_source.schedule_type,
        schedule_config=log_source.schedule_config,
        last_fetch_at=log_source.last_fetch_at,
        last_fetch_status=log_source.last_fetch_status,
        last_fetch_error=log_source.last_fetch_error,
        last_fetched_bytes=log_source.last_fetched_bytes,
        created_at=log_source.created_at,
        updated_at=log_source.updated_at,
    )


@router.put("/{log_source_id}", response_model=LogSourceResponse)
async def update_log_source(
    site_id: str,
    log_source_id: str,
    log_source_data: LogSourceUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> LogSourceResponse:
    """Update a log source."""
    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Get log source
    result = await db.execute(
        select(LogSource).where(LogSource.id == log_source_id, LogSource.site_id == site_id)
    )
    log_source = result.scalar_one_or_none()

    if log_source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log source not found",
        )

    # Update fields
    if log_source_data.name is not None:
        log_source.name = log_source_data.name
    if log_source_data.status is not None:
        log_source.status = log_source_data.status
    if log_source_data.connection_config is not None:
        log_source.connection_config = log_source_data.connection_config
    if log_source_data.schedule_type is not None:
        log_source.schedule_type = log_source_data.schedule_type
    if log_source_data.schedule_config is not None:
        log_source.schedule_config = log_source_data.schedule_config

    await db.commit()
    await db.refresh(log_source)

    return LogSourceResponse(
        id=log_source.id,
        site_id=log_source.site_id,
        name=log_source.name,
        source_type=log_source.source_type,
        status=log_source.status,
        connection_config=redact_sensitive_fields(
            log_source.connection_config, log_source.source_type
        ),
        schedule_type=log_source.schedule_type,
        schedule_config=log_source.schedule_config,
        last_fetch_at=log_source.last_fetch_at,
        last_fetch_status=log_source.last_fetch_status,
        last_fetch_error=log_source.last_fetch_error,
        last_fetched_bytes=log_source.last_fetched_bytes,
        created_at=log_source.created_at,
        updated_at=log_source.updated_at,
    )


@router.delete("/{log_source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log_source(
    site_id: str,
    log_source_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """Delete a log source."""
    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Get log source
    result = await db.execute(
        select(LogSource).where(LogSource.id == log_source_id, LogSource.site_id == site_id)
    )
    log_source = result.scalar_one_or_none()

    if log_source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log source not found",
        )

    await db.delete(log_source)
    await db.commit()


@router.post("/{log_source_id}/test", status_code=status.HTTP_200_OK)
async def test_log_source_connection(
    site_id: str,
    log_source_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> dict:
    """Test connection to a log source."""
    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Get log source
    result = await db.execute(
        select(LogSource).where(LogSource.id == log_source_id, LogSource.site_id == site_id)
    )
    log_source = result.scalar_one_or_none()

    if log_source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log source not found",
        )

    # Enqueue connection test task
    from apps.worker.tasks.fetch import test_log_source_connection as test_task

    task = test_task.delay(log_source_id)

    return {
        "message": "Connection test enqueued",
        "task_id": task.id,
    }


@router.post("/{log_source_id}/fetch-now", status_code=status.HTTP_202_ACCEPTED)
async def trigger_immediate_fetch(
    site_id: str,
    log_source_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> dict:
    """Trigger an immediate log fetch (bypass schedule)."""
    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Get log source
    result = await db.execute(
        select(LogSource).where(LogSource.id == log_source_id, LogSource.site_id == site_id)
    )
    log_source = result.scalar_one_or_none()

    if log_source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log source not found",
        )

    # Enqueue fetch task
    from apps.worker.tasks.fetch import fetch_logs_from_source

    task = fetch_logs_from_source.delay(log_source_id)

    return {
        "message": "Fetch task enqueued. Check the log source status for results.",
        "log_source_id": log_source_id,
        "task_id": task.id,
    }
