"""Error analysis API endpoints."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.config import get_settings
from apps.api.database import get_db
from apps.api.dependencies import get_current_user
from apps.api.models.error_log import ErrorGroup, ErrorOccurrence
from apps.api.models.site import Site
from apps.api.models.user import User
from apps.api.schemas.error_log import (
    AnalyzeLogFileRequest,
    ErrorGroupResponse,
    ErrorGroupExplainResponse,
    ErrorGroupsListResponse,
    ErrorGroupUpdateRequest,
    ErrorGroupWithOccurrences,
    ErrorOccurrenceResponse,
    ErrorStatsResponse,
)
from apps.api.services.ollama import OllamaService
from apps.worker.tasks.error_analysis import analyze_errors_in_log_file

router = APIRouter(prefix="/api/sites/{site_id}/errors", tags=["errors"])
settings = get_settings()


async def verify_site_access(
    site_id: str,
    current_user: User,
    db: AsyncSession,
) -> Site:
    """Verify user has access to the site."""
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.get("/groups", response_model=ErrorGroupsListResponse)
async def list_error_groups(
    site_id: str,
    status: str | None = Query(None, description="Filter by status (unresolved/resolved/ignored)"),
    error_type: str | None = Query(None, description="Filter by error type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List error groups for a site."""
    site = await verify_site_access(site_id, current_user, db)

    # Build base query
    query = select(ErrorGroup).where(ErrorGroup.site_id == site.id)

    if status:
        query = query.where(ErrorGroup.status == status)
    if error_type:
        query = query.where(ErrorGroup.error_type == error_type)

    query = query.order_by(desc(ErrorGroup.last_seen))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results with sample request metadata
    sample_request_url = (
        select(ErrorOccurrence.request_url)
        .where(ErrorOccurrence.error_group_id == ErrorGroup.id)
        .order_by(desc(ErrorOccurrence.timestamp))
        .limit(1)
        .scalar_subquery()
    )
    sample_ip_address = (
        select(ErrorOccurrence.ip_address)
        .where(ErrorOccurrence.error_group_id == ErrorGroup.id)
        .order_by(desc(ErrorOccurrence.timestamp))
        .limit(1)
        .scalar_subquery()
    )

    list_query = (
        query.add_columns(
            sample_request_url.label("sample_request_url"),
            sample_ip_address.label("sample_ip_address"),
        )
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(list_query)
    error_group_rows = result.all()

    group_ids = [group.id for group, _, _ in error_group_rows]
    sample_urls_map: dict[str, list[str]] = {}
    if group_ids:
        sample_rows = await db.execute(
            select(
                ErrorOccurrence.error_group_id,
                ErrorOccurrence.request_url,
                func.count().label("count"),
            )
            .where(
                ErrorOccurrence.error_group_id.in_(group_ids),
                ErrorOccurrence.request_url.is_not(None),
            )
            .group_by(ErrorOccurrence.error_group_id, ErrorOccurrence.request_url)
            .order_by(ErrorOccurrence.error_group_id, desc("count"))
        )
        for group_id, request_url, _ in sample_rows.all():
            if not request_url:
                continue
            bucket = sample_urls_map.setdefault(group_id, [])
            if len(bucket) < 3:
                bucket.append(request_url)

    # Get counts by status
    status_counts = await db.execute(
        select(
            ErrorGroup.status,
            func.count(ErrorGroup.id),
        )
        .where(ErrorGroup.site_id == site.id)
        .group_by(ErrorGroup.status)
    )
    counts_dict = {row[0]: row[1] for row in status_counts.all()}

    error_groups = []
    for group, request_url, ip_address in error_group_rows:
        payload = ErrorGroupResponse.model_validate(group).model_dump()
        payload["sample_request_url"] = request_url
        payload["sample_ip_address"] = ip_address
        payload["sample_request_urls"] = sample_urls_map.get(group.id)
        error_groups.append(ErrorGroupResponse(**payload))

    return ErrorGroupsListResponse(
        error_groups=error_groups,
        total=total,
        unresolved=counts_dict.get("unresolved", 0),
        resolved=counts_dict.get("resolved", 0),
        ignored=counts_dict.get("ignored", 0),
    )


@router.get("/groups/{group_id}", response_model=ErrorGroupWithOccurrences)
async def get_error_group(
    site_id: str,
    group_id: str,
    limit: int = Query(10, ge=1, le=100, description="Number of recent occurrences to include"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get error group details with recent occurrences."""
    site = await verify_site_access(site_id, current_user, db)

    # Get error group
    result = await db.execute(
        select(ErrorGroup).where(
            ErrorGroup.id == group_id,
            ErrorGroup.site_id == site.id,
        )
    )
    error_group = result.scalar_one_or_none()
    if not error_group:
        raise HTTPException(status_code=404, detail="Error group not found")

    # Get recent occurrences
    occurrences_result = await db.execute(
        select(ErrorOccurrence)
        .where(ErrorOccurrence.error_group_id == group_id)
        .order_by(desc(ErrorOccurrence.timestamp))
        .limit(limit)
    )
    recent_occurrences = occurrences_result.scalars().all()

    sample_request_url = recent_occurrences[0].request_url if recent_occurrences else None
    sample_ip_address = recent_occurrences[0].ip_address if recent_occurrences else None
    sample_request_urls = [
        occ.request_url for occ in recent_occurrences if occ.request_url
    ][:3]

    payload = ErrorGroupResponse.model_validate(error_group).model_dump()
    payload["sample_request_url"] = sample_request_url
    payload["sample_ip_address"] = sample_ip_address
    payload["sample_request_urls"] = sample_request_urls or None

    return ErrorGroupWithOccurrences(
        **payload,
        recent_occurrences=[
            ErrorOccurrenceResponse.model_validate(occ) for occ in recent_occurrences
        ],
    )


@router.put("/groups/{group_id}", response_model=ErrorGroupResponse)
async def update_error_group(
    site_id: str,
    group_id: str,
    update_request: ErrorGroupUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update error group status."""
    site = await verify_site_access(site_id, current_user, db)

    # Get error group
    result = await db.execute(
        select(ErrorGroup).where(
            ErrorGroup.id == group_id,
            ErrorGroup.site_id == site.id,
        )
    )
    error_group = result.scalar_one_or_none()
    if not error_group:
        raise HTTPException(status_code=404, detail="Error group not found")

    # Update status
    error_group.status = update_request.status

    if update_request.status == "resolved":
        error_group.resolved_at = datetime.utcnow()
    elif update_request.status == "unresolved":
        error_group.resolved_at = None

    if update_request.deployment_id:
        error_group.deployment_id = update_request.deployment_id

    await db.commit()
    await db.refresh(error_group)

    return ErrorGroupResponse.model_validate(error_group)


@router.post("/groups/{group_id}/explain", response_model=ErrorGroupExplainResponse)
async def explain_error_group(
    site_id: str,
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Explain an error group using Ollama."""
    if not settings.ollama_enabled:
        raise HTTPException(status_code=503, detail="Ollama is disabled")

    site = await verify_site_access(site_id, current_user, db)

    result = await db.execute(
        select(ErrorGroup).where(
            ErrorGroup.id == group_id,
            ErrorGroup.site_id == site.id,
        )
    )
    error_group = result.scalar_one_or_none()
    if not error_group:
        raise HTTPException(status_code=404, detail="Error group not found")

    occurrences_result = await db.execute(
        select(ErrorOccurrence)
        .where(ErrorOccurrence.error_group_id == group_id)
        .order_by(desc(ErrorOccurrence.timestamp))
        .limit(10)
    )
    recent_occurrences = occurrences_result.scalars().all()

    occurrence_lines = []
    for occ in recent_occurrences:
        parts = [
            f"time={occ.timestamp.isoformat()}",
            f"ip={occ.ip_address or 'n/a'}",
            f"url={occ.request_url or 'n/a'}",
            f"message={occ.error_message}",
        ]
        occurrence_lines.append(" | ".join(parts))

    prompt = (
        "You are a security analyst helping a developer understand an error group.\n\n"
        f"Error type: {error_group.error_type}\n"
        f"Error message: {error_group.error_message}\n"
        f"Occurrences: {error_group.occurrence_count}\n"
        f"First seen: {error_group.first_seen}\n"
        f"Last seen: {error_group.last_seen}\n\n"
        "Recent occurrences:\n"
        + "\n".join(occurrence_lines)
        + "\n\n"
        "Please explain what this indicates, potential impact, and suggested remediation steps."
    )

    ollama = OllamaService()
    try:
        response_text = await ollama.generate(prompt)
    except Exception as exc:  # pragma: no cover - external service
        raise HTTPException(status_code=503, detail=f"Ollama request failed: {exc}")

    return ErrorGroupExplainResponse(explanation=response_text)


@router.get("/stats", response_model=ErrorStatsResponse)
async def get_error_stats(
    site_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get error statistics for a site."""
    site = await verify_site_access(site_id, current_user, db)

    # Get total error groups
    total_groups_result = await db.execute(
        select(func.count()).select_from(ErrorGroup).where(ErrorGroup.site_id == site.id)
    )
    total_groups = total_groups_result.scalar() or 0

    # Get total error occurrences
    total_errors_result = await db.execute(
        select(func.sum(ErrorGroup.occurrence_count)).where(ErrorGroup.site_id == site.id)
    )
    total_errors = total_errors_result.scalar() or 0

    # Get errors in last 24 hours
    cutoff_24h = datetime.utcnow() - timedelta(hours=24)
    errors_24h_result = await db.execute(
        select(func.count())
        .select_from(ErrorOccurrence)
        .join(ErrorGroup)
        .where(
            ErrorGroup.site_id == site.id,
            ErrorOccurrence.timestamp >= cutoff_24h,
        )
    )
    errors_24h = errors_24h_result.scalar() or 0

    # Get errors in last 7 days
    cutoff_7d = datetime.utcnow() - timedelta(days=7)
    errors_7d_result = await db.execute(
        select(func.count())
        .select_from(ErrorOccurrence)
        .join(ErrorGroup)
        .where(
            ErrorGroup.site_id == site.id,
            ErrorOccurrence.timestamp >= cutoff_7d,
        )
    )
    errors_7d = errors_7d_result.scalar() or 0

    # Get top error types
    top_types_result = await db.execute(
        select(
            ErrorGroup.error_type,
            func.sum(ErrorGroup.occurrence_count).label("count"),
        )
        .where(ErrorGroup.site_id == site.id)
        .group_by(ErrorGroup.error_type)
        .order_by(desc("count"))
        .limit(10)
    )
    top_error_types = [
        {"error_type": row[0], "count": int(row[1])} for row in top_types_result.all()
    ]

    # Get hourly trend for last 24 hours
    trend_result = await db.execute(
        select(
            func.date_trunc("hour", ErrorOccurrence.timestamp).label("hour"),
            func.count().label("count"),
        )
        .select_from(ErrorOccurrence)
        .join(ErrorGroup)
        .where(
            ErrorGroup.site_id == site.id,
            ErrorOccurrence.timestamp >= cutoff_24h,
        )
        .group_by("hour")
        .order_by("hour")
    )
    error_trend = [
        {"hour": row[0].isoformat(), "count": int(row[1])} for row in trend_result.all()
    ]

    return ErrorStatsResponse(
        total_errors=int(total_errors),
        total_groups=int(total_groups),
        errors_24h=int(errors_24h),
        errors_7d=int(errors_7d),
        top_error_types=top_error_types,
        error_trend=error_trend,
    )


@router.post("/analyze")
async def trigger_error_analysis(
    site_id: str,
    request: AnalyzeLogFileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger error analysis for a log file."""
    site = await verify_site_access(site_id, current_user, db)

    # Verify log file belongs to site
    from apps.api.models.log_file import LogFile

    result = await db.execute(
        select(LogFile).where(
            LogFile.id == request.log_file_id,
            LogFile.site_id == site.id,
        )
    )
    log_file = result.scalar_one_or_none()
    if not log_file:
        raise HTTPException(status_code=404, detail="Log file not found")

    # Trigger async task
    task = analyze_errors_in_log_file.delay(request.log_file_id, request.log_format)

    return {
        "success": True,
        "message": "Error analysis started",
        "task_id": task.id,
    }
