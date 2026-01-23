"""Aggregate data routes."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.aggregate import Aggregate
from apps.api.models.log_file import LogFile
from apps.api.models.site import Site
from apps.api.schemas.aggregate import (
    AggregateListResponse,
    AggregateResponse,
    DashboardResponse,
    SiteSummary,
)
from apps.api.schemas.log_file import LogFileResponse

router = APIRouter(prefix="/sites/{site_id}", tags=["aggregates"])


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


@router.get("/aggregates", response_model=AggregateListResponse)
async def list_aggregates(
    site_id: str,
    current_user: CurrentUser,
    db: DbSession,
    log_file_id: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    limit: int = Query(default=100, le=1000),
) -> AggregateListResponse:
    """List aggregates for a site, optionally filtered by log file or time range."""
    site = await get_user_site(site_id, current_user.id, db)

    query = select(Aggregate).where(Aggregate.site_id == site.id)

    if log_file_id:
        query = query.where(Aggregate.log_file_id == log_file_id)
    if start_time:
        query = query.where(Aggregate.hour_bucket >= start_time)
    if end_time:
        query = query.where(Aggregate.hour_bucket <= end_time)

    query = query.order_by(Aggregate.hour_bucket.desc()).limit(limit)

    result = await db.execute(query)
    aggregates = result.scalars().all()

    return AggregateListResponse(
        aggregates=[AggregateResponse.model_validate(a) for a in aggregates],
        total=len(aggregates),
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    site_id: str,
    current_user: CurrentUser,
    db: DbSession,
    start_date: str | None = Query(default=None, description="ISO format datetime"),
    end_date: str | None = Query(default=None, description="ISO format datetime"),
    days: int = Query(default=7, le=90),
) -> DashboardResponse:
    """Get dashboard data for a site."""
    site = await get_user_site(site_id, current_user.id, db)

    # Calculate time range
    if start_date and end_date:
        start_time = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_time = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    elif start_date:
        start_time = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_time = datetime.now(timezone.utc)
    elif end_date:
        end_time = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        start_time = end_time - timedelta(days=days)
    else:
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=days)

    # Get aggregates for the time range
    agg_query = (
        select(Aggregate)
        .where(
            Aggregate.site_id == site.id,
            Aggregate.hour_bucket >= start_time,
        )
        .order_by(Aggregate.hour_bucket.asc())
    )
    agg_result = await db.execute(agg_query)
    aggregates = agg_result.scalars().all()

    # Calculate summary
    total_requests = sum(a.requests_count for a in aggregates)
    total_bytes = sum(a.total_bytes for a in aggregates)
    status_2xx = sum(a.status_2xx for a in aggregates)
    status_3xx = sum(a.status_3xx for a in aggregates)
    status_4xx = sum(a.status_4xx for a in aggregates)
    status_5xx = sum(a.status_5xx for a in aggregates)

    # Get unique IPs and paths (approximate from top lists)
    # Apply IP filtering based on site settings
    filtered_ips_set = set(site.filtered_ips) if site.filtered_ips else set()
    all_ips = set()
    all_paths = set()
    path_counts: dict[str, int] = {}
    ip_counts: dict[str, int] = {}

    for agg in aggregates:
        if agg.top_ips:
            for item in agg.top_ips:
                ip = item.get("ip")
                count = item.get("count", 0)
                if ip and ip not in filtered_ips_set:
                    all_ips.add(ip)
                    ip_counts[ip] = ip_counts.get(ip, 0) + count
        if agg.top_paths:
            for item in agg.top_paths:
                path = item.get("path")
                count = item.get("count", 0)
                if path:
                    all_paths.add(path)
                    path_counts[path] = path_counts.get(path, 0) + count

    # Get top 10 overall
    top_paths = sorted(
        [{"path": p, "count": c} for p, c in path_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]
    top_ips = sorted(
        [{"ip": ip, "count": c} for ip, c in ip_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # Get time range
    first_seen = aggregates[0].hour_bucket if aggregates else None
    last_seen = aggregates[-1].hour_bucket if aggregates else None

    summary = SiteSummary(
        total_requests=total_requests,
        total_bytes=total_bytes,
        unique_ips=len(all_ips),
        unique_paths=len(all_paths),
        status_2xx=status_2xx,
        status_3xx=status_3xx,
        status_4xx=status_4xx,
        status_5xx=status_5xx,
        first_seen=first_seen,
        last_seen=last_seen,
        top_paths=top_paths,
        top_ips=top_ips,
    )

    # Get recent uploads
    uploads_query = (
        select(LogFile)
        .where(LogFile.site_id == site.id)
        .order_by(LogFile.created_at.desc())
        .limit(5)
    )
    uploads_result = await db.execute(uploads_query)
    recent_uploads = [
        {
            "id": lf.id,
            "filename": lf.filename,
            "status": lf.status,
            "size_bytes": lf.size_bytes,
            "created_at": lf.created_at.isoformat() if lf.created_at else None,
        }
        for lf in uploads_result.scalars().all()
    ]

    return DashboardResponse(
        summary=summary,
        hourly_data=[AggregateResponse.model_validate(a) for a in aggregates],
        recent_uploads=recent_uploads,
    )
