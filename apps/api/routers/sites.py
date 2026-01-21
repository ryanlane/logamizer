"""Site management routes."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.site import Site
from apps.api.schemas.site import SiteCreate, SiteListResponse, SiteResponse, SiteUpdate

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("", response_model=SiteListResponse)
async def list_sites(current_user: CurrentUser, db: DbSession) -> SiteListResponse:
    """List all sites for the current user."""
    result = await db.execute(
        select(Site)
        .where(Site.user_id == current_user.id)
        .order_by(Site.created_at.desc())
    )
    sites = result.scalars().all()

    count_result = await db.execute(
        select(func.count()).select_from(Site).where(Site.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    return SiteListResponse(
        sites=[SiteResponse.model_validate(site) for site in sites],
        total=total,
    )


@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    data: SiteCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> SiteResponse:
    """Create a new site."""
    site = Site(
        user_id=current_user.id,
        name=data.name,
        domain=data.domain,
        log_format=data.log_format,
    )
    db.add(site)
    await db.flush()
    await db.refresh(site)

    return SiteResponse.model_validate(site)


@router.get("/{site_id}", response_model=SiteResponse)
async def get_site(
    site_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> SiteResponse:
    """Get a specific site by ID."""
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found",
        )

    return SiteResponse.model_validate(site)


@router.put("/{site_id}", response_model=SiteResponse)
async def update_site(
    site_id: str,
    data: SiteUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> SiteResponse:
    """Update a site."""
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found",
        )

    if data.name is not None:
        site.name = data.name
    if data.domain is not None:
        site.domain = data.domain
    if data.log_format is not None:
        site.log_format = data.log_format

    await db.flush()
    await db.refresh(site)

    return SiteResponse.model_validate(site)


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    site_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """Delete a site."""
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == current_user.id)
    )
    site = result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found",
        )

    await db.delete(site)
