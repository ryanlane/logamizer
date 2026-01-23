"""Utility endpoints."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class PublicIPResponse(BaseModel):
    """Public IP response."""

    ip: str


@router.get("/public-ip", response_model=PublicIPResponse)
async def get_public_ip(request: Request) -> PublicIPResponse:
    """
    Get the client's public IP address.

    This endpoint returns the IP address of the client making the request.
    Useful for discovering the user's public IP for filtering purposes.
    """
    # Try to get the real IP from common proxy headers
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        ip = forwarded_for.split(",")[0].strip()
    else:
        # Fall back to the direct client IP
        ip = request.client.host if request.client else "unknown"

    return PublicIPResponse(ip=ip)
