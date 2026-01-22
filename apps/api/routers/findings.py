"""Finding routes."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.finding import Finding
from apps.api.models.site import Site
from apps.api.schemas.finding import FindingListResponse, FindingResponse

router = APIRouter(prefix="/sites/{site_id}", tags=["findings"])


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


@router.get("/findings", response_model=FindingListResponse)
async def list_findings(
    site_id: str,
    current_user: CurrentUser,
    db: DbSession,
    log_file_id: str | None = None,
    finding_type: str | None = None,
    severity: str | None = None,
    start_date: str | None = Query(default=None, description="ISO format datetime"),
    end_date: str | None = Query(default=None, description="ISO format datetime"),
    limit: int = Query(default=100, le=1000),
) -> FindingListResponse:
    """List findings for a site."""
    site = await get_user_site(site_id, current_user.id, db)

    query = select(Finding).where(Finding.site_id == site.id)
    if log_file_id:
        query = query.where(Finding.log_file_id == log_file_id)
    if finding_type:
        query = query.where(Finding.finding_type == finding_type)
    if severity:
        query = query.where(Finding.severity == severity)
    if start_date:
        start_time = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        query = query.where(Finding.created_at >= start_time)
    if end_date:
        end_time = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        query = query.where(Finding.created_at <= end_time)

    query = query.order_by(Finding.created_at.desc()).limit(limit)

    result = await db.execute(query)
    findings = result.scalars().all()

    return FindingListResponse(
        findings=[FindingResponse.model_validate(f) for f in findings],
        total=len(findings),
    )


@router.get("/findings/{finding_id}", response_model=FindingResponse)
async def get_finding(
    site_id: str,
    finding_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> FindingResponse:
    """Get a single finding by ID."""
    site = await get_user_site(site_id, current_user.id, db)

    result = await db.execute(
        select(Finding).where(
            Finding.site_id == site.id,
            Finding.id == finding_id,
        )
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found",
        )

    return FindingResponse.model_validate(finding)
