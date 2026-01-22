"""Finding schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class FindingResponse(BaseModel):
    """Security finding response schema."""

    id: str
    site_id: str
    log_file_id: str | None
    finding_type: str
    severity: str
    title: str
    description: str
    evidence: list[dict] | None
    suggested_action: str | None
    metadata: dict | None = Field(default=None, alias="metadata_json")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class FindingListResponse(BaseModel):
    """List of findings response."""

    findings: list[FindingResponse]
    total: int
