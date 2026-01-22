"""Explain routes."""

from collections import Counter
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from apps.api.config import get_settings
from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.aggregate import Aggregate
from apps.api.models.finding import Finding
from apps.api.models.log_file import LogFile
from apps.api.models.site import Site
from apps.api.schemas.explain import ExplainRequest, ExplainResponse
from apps.api.services.ollama import OllamaService
from packages.shared.enums import LogFileStatus

router = APIRouter(prefix="/sites/{site_id}", tags=["explain"])
settings = get_settings()

ANOMALY_TYPES = {"traffic_spike", "error_spike", "new_endpoint_burst"}


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


def _build_findings_summary(findings: list[Finding]) -> str:
    if not findings:
        return "- None"

    counts: Counter = Counter()
    severity_map: dict[str, str] = {}
    for finding in findings:
        counts[finding.finding_type] += 1
        severity_map.setdefault(finding.finding_type, finding.severity)

    lines = []
    for finding_type, count in counts.most_common():
        severity = severity_map.get(finding_type, "unknown")
        lines.append(f"- {finding_type} ({severity}) x{count}")
    return "\n".join(lines)


def _build_evidence_snippets(findings: list[Finding], limit: int = 10) -> list[str]:
    snippets: list[str] = []
    for finding in findings:
        if not finding.evidence:
            continue
        for item in finding.evidence:
            if len(snippets) >= limit:
                return snippets
            if isinstance(item, dict):
                if "raw" in item:
                    line = item.get("line")
                    raw = item.get("raw")
                    snippets.append(
                        f"line {line}: {raw}" if line is not None else str(raw)
                    )
                else:
                    snippets.append(str(item))
            else:
                snippets.append(str(item))
    return snippets


def _build_prompt(
    site: Site,
    start: datetime,
    end: datetime,
    total_requests: int,
    error_rate: float,
    unique_ips: int,
    findings_summary: str,
    evidence_snippets: list[str],
    user_prompt: str,
) -> str:
    evidence_block = "\n".join(
        [f"Evidence #{idx + 1}: {snippet}" for idx, snippet in enumerate(evidence_snippets)]
    ) or "Evidence #1: (none)"

    return (
        "You are a security analyst explaining log analysis findings.\n\n"
        f"SITE: {site.name} ({site.domain or 'unknown'})\n"
        f"TIME RANGE: {start.isoformat()} to {end.isoformat()}\n\n"
        "METRICS:\n"
        f"- Total requests: {total_requests}\n"
        f"- Error rate: {error_rate:.2f}%\n"
        f"- Unique IPs: {unique_ips}\n\n"
        "FINDINGS:\n"
        f"{findings_summary}\n\n"
        "EVIDENCE SAMPLES:\n"
        f"{evidence_block}\n\n"
        f"Task: {user_prompt}\n\n"
        "Rules:\n"
        "1. Only reference evidence provided above\n"
        "2. If data is insufficient, say so\n"
        "3. Provide actionable recommendations\n"
        "4. Use [Evidence #N] citations\n"
    )


@router.post("/explain", response_model=ExplainResponse)
async def explain_site(
    site_id: str,
    data: ExplainRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> ExplainResponse:
    """Explain security findings or anomalies using Ollama."""
    if not settings.ollama_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama is disabled",
        )

    site = await get_user_site(site_id, current_user.id, db)

    log_file_result = await db.execute(
        select(LogFile)
        .where(LogFile.site_id == site.id, LogFile.status == LogFileStatus.PROCESSED)
        .order_by(LogFile.created_at.desc())
        .limit(1)
    )
    log_file = log_file_result.scalar_one_or_none()

    if log_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No processed log files found",
        )

    agg_result = await db.execute(
        select(Aggregate)
        .where(Aggregate.site_id == site.id, Aggregate.log_file_id == log_file.id)
        .order_by(Aggregate.hour_bucket.asc())
    )
    aggregates = agg_result.scalars().all()

    if not aggregates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No aggregates found for this log file",
        )

    total_requests = sum(a.requests_count for a in aggregates)
    total_5xx = sum(a.status_5xx for a in aggregates)
    unique_ips = sum(a.unique_ips for a in aggregates)
    error_rate = (total_5xx / total_requests * 100) if total_requests else 0.0

    start_time = aggregates[0].hour_bucket
    end_time = aggregates[-1].hour_bucket

    findings_query = select(Finding).where(
        Finding.site_id == site.id,
        Finding.log_file_id == log_file.id,
    )
    findings_result = await db.execute(findings_query)
    findings = findings_result.scalars().all()

    if data.context == "findings":
        findings = [f for f in findings if f.finding_type not in ANOMALY_TYPES]
    elif data.context == "anomalies":
        findings = [f for f in findings if f.finding_type in ANOMALY_TYPES]

    findings_summary = _build_findings_summary(findings)
    evidence_snippets = _build_evidence_snippets(findings)

    prompt = _build_prompt(
        site=site,
        start=start_time,
        end=end_time,
        total_requests=total_requests,
        error_rate=error_rate,
        unique_ips=unique_ips,
        findings_summary=findings_summary,
        evidence_snippets=evidence_snippets,
        user_prompt=data.prompt,
    )

    ollama = OllamaService()

    try:
        response_text = await ollama.generate(prompt)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama request failed: {exc}",
        ) from exc

    return ExplainResponse(
        response=response_text.strip(),
        context=data.context,
        log_file_id=log_file.id,
    )
