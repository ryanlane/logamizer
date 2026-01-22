"""Finding action routes (explain, verify)."""

import json

import httpx
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from apps.api.config import get_settings
from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.finding import Finding
from apps.api.models.site import Site

router = APIRouter(prefix="/findings", tags=["findings"])
settings = get_settings()


@router.post("/{finding_id}/explain")
async def explain_finding(
    finding_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> dict:
    """Use Ollama to explain a security finding in detail."""
    # Get the finding
    result = await db.execute(select(Finding).where(Finding.id == finding_id))
    finding = result.scalar_one_or_none()

    if finding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found",
        )

    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == finding.site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Check if Ollama is enabled
    if not settings.ollama_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI explanation service is not available",
        )

    # Build the prompt for Ollama
    evidence_samples = ""
    if finding.evidence and len(finding.evidence) > 0:
        evidence_samples = "\n\nEvidence samples:\n"
        for i, ev in enumerate(finding.evidence[:3], 1):
            if ev.get("raw"):
                evidence_samples += f"{i}. {ev['raw']}\n"

    prompt = f"""You are a security analyst explaining a log analysis finding to a developer.

Finding: {finding.title}
Type: {finding.finding_type}
Severity: {finding.severity}

Description: {finding.description}
{evidence_samples}

Please explain:
1. What this security issue means in simple terms
2. Why it's a concern (what could an attacker do?)
3. How serious this is in practice
4. Specific steps to fix or mitigate it

Keep your explanation concise (3-4 paragraphs) and actionable. Focus on practical advice."""

    try:
        # Stream the response from Ollama
        async def generate_stream():
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/generate",
                    json={
                        "model": settings.ollama_model,
                        "prompt": prompt,
                        "stream": True,
                    },
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                if "response" in chunk:
                                    # Send each token as a server-sent event
                                    yield f"data: {json.dumps({'token': chunk['response']})}\n\n"
                                if chunk.get("done"):
                                    yield f"data: {json.dumps({'done': True})}\n\n"
                            except json.JSONDecodeError:
                                continue

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI service took too long to respond",
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service error: {str(e)}",
        )


@router.post("/{finding_id}/verify")
async def verify_finding(
    finding_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> dict:
    """Test if a security finding is actually exploitable on the live site."""
    # Get the finding
    result = await db.execute(select(Finding).where(Finding.id == finding_id))
    finding = result.scalar_one_or_none()

    if finding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found",
        )

    # Verify user owns the site
    site_result = await db.execute(
        select(Site).where(Site.id == finding.site_id, Site.user_id == current_user.id)
    )
    site = site_result.scalar_one_or_none()

    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or access denied",
        )

    # Check if site has a domain configured
    if not site.domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Site must have a domain configured for verification",
        )

    # Verification logic based on finding type
    finding_type = finding.finding_type

    probes: list[dict] = []
    current_url: str | None = None

    def build_candidate_urls(path: str) -> list[str]:
        return [f"https://{site.domain}{path}", f"http://{site.domain}{path}"]

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # Path traversal verification
            if finding_type == "path_traversal":
                for test_url in build_candidate_urls("/../../etc/passwd"):
                    try:
                        current_url = test_url
                        response = await client.get(test_url)
                        headers = dict(response.headers)
                        headers[":status"] = str(response.status_code)
                        probes.append(
                            {
                                "url": test_url,
                                "status_code": response.status_code,
                                "headers": headers,
                            }
                        )

                        if response.status_code == 200 and (
                            "root:" in response.text or "bin:" in response.text
                        ):
                            return {
                                "verified": True,
                                "details": f"Path traversal vulnerability confirmed. Server returned sensitive file contents (status {response.status_code}). This is a critical security issue.",
                                "probes": probes,
                            }
                    except httpx.HTTPError as e:
                        probes.append({"url": test_url, "error": str(e)})
                        continue

                last_status = (
                    probes[-1].get("status_code") if probes and "status_code" in probes[-1] else "unknown"
                )
                return {
                    "verified": False,
                    "details": f"Path traversal appears to be blocked. Server returned status {last_status}. The application or WAF is likely protecting against this attack.",
                    "probes": probes,
                }

            # Environment file access
            elif finding_type == "env_file_access":
                for test_url in build_candidate_urls("/.env"):
                    try:
                        current_url = test_url
                        response = await client.get(test_url)
                        headers = dict(response.headers)
                        headers[":status"] = str(response.status_code)
                        probes.append(
                            {
                                "url": test_url,
                                "status_code": response.status_code,
                                "headers": headers,
                            }
                        )

                        if response.status_code == 200 and len(response.text) > 0:
                            return {
                                "verified": True,
                                "details": f"Environment file is accessible (status {response.status_code}). This could expose sensitive credentials and configuration.",
                                "probes": probes,
                            }
                    except httpx.HTTPError as e:
                        probes.append({"url": test_url, "error": str(e)})
                        continue

                last_status = (
                    probes[-1].get("status_code") if probes and "status_code" in probes[-1] else "unknown"
                )
                return {
                    "verified": False,
                    "details": f"Environment file access is blocked (status {last_status}). The server is properly configured to deny access to .env files.",
                    "probes": probes,
                }

            # WordPress admin probe
            elif finding_type in ["wp_admin_probe", "phpmyadmin_probe", "cgi_bin_probe"]:
                # Extract path from finding type
                paths = {
                    "wp_admin_probe": "/wp-admin",
                    "phpmyadmin_probe": "/phpmyadmin",
                    "cgi_bin_probe": "/cgi-bin/",
                }
                test_path = paths.get(finding_type, "/")

                for test_url in build_candidate_urls(test_path):
                    try:
                        current_url = test_url
                        response = await client.get(test_url)
                        headers = dict(response.headers)
                        headers[":status"] = str(response.status_code)
                        probes.append(
                            {
                                "url": test_url,
                                "status_code": response.status_code,
                                "headers": headers,
                            }
                        )

                        if response.status_code in [200, 301, 302]:
                            return {
                                "verified": True,
                                "details": f"The endpoint exists and is accessible (status {response.status_code}). If this service is not intentionally exposed, it should be removed or protected.",
                                "probes": probes,
                            }
                    except httpx.HTTPError as e:
                        probes.append({"url": test_url, "error": str(e)})
                        continue

                last_status = (
                    probes[-1].get("status_code") if probes and "status_code" in probes[-1] else "unknown"
                )
                return {
                    "verified": False,
                    "details": f"The endpoint returns status {last_status}, indicating it's not accessible or doesn't exist.",
                    "probes": probes,
                }

            # For other finding types, provide a generic response
            else:
                return {
                    "verified": False,
                    "details": f"Automated verification is not yet supported for '{finding_type}' findings. This finding was detected in logs but requires manual investigation to confirm if the vulnerability still exists.",
                    "probes": probes,
                }

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Connection to site timed out",
        )
    except httpx.HTTPError as e:
        if current_url:
            probes.append({"url": current_url, "error": str(e)})
        return {
            "verified": False,
            "details": f"Could not connect to site for verification: {str(e)}. The site may be offline or blocking automated requests.",
            "probes": probes,
        }
