"""Explain schemas."""

from typing import Literal

from pydantic import BaseModel, Field


class ExplainRequest(BaseModel):
    """Explain request schema."""

    prompt: str = Field(min_length=1, max_length=2000)
    context: Literal["findings", "anomalies", "overview"] = "overview"


class ExplainResponse(BaseModel):
    """Explain response schema."""

    response: str
    context: str
    log_file_id: str | None
