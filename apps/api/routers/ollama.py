"""Ollama management routes."""

import json

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from starlette.responses import StreamingResponse

from apps.api.config import get_settings
from apps.api.dependencies import CurrentUser

router = APIRouter(prefix="/ollama", tags=["ollama"])
settings = get_settings()


class OllamaModel(BaseModel):
    name: str
    size: str
    modified: str


class ModelsListResponse(BaseModel):
    models: list[OllamaModel]


class ModelConfig(BaseModel):
    model: str


class PullModelRequest(BaseModel):
    model: str


@router.get("/models", response_model=ModelsListResponse)
async def list_models(current_user: CurrentUser) -> ModelsListResponse:
    """List available Ollama models."""
    if not settings.ollama_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is not enabled",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
            response.raise_for_status()
            data = response.json()

            models = []
            for model in data.get("models", []):
                # Convert bytes to human-readable format
                size_bytes = model.get("size", 0)
                if size_bytes < 1024:
                    size_str = f"{size_bytes} B"
                elif size_bytes < 1024 * 1024:
                    size_str = f"{size_bytes / 1024:.1f} KB"
                elif size_bytes < 1024 * 1024 * 1024:
                    size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
                else:
                    size_str = f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

                models.append(
                    OllamaModel(
                        name=model.get("name", ""),
                        size=size_str,
                        modified=model.get("modified_at", ""),
                    )
                )

            return ModelsListResponse(models=models)
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to Ollama: {str(e)}",
        )


@router.get("/config", response_model=ModelConfig)
async def get_config(current_user: CurrentUser) -> ModelConfig:
    """Get current Ollama model configuration."""
    return ModelConfig(model=settings.ollama_model)


@router.put("/config", response_model=ModelConfig)
async def update_config(
    config: ModelConfig, current_user: CurrentUser
) -> ModelConfig:
    """Update Ollama model configuration.

    Note: This only affects the current session. To persist changes,
    update the OLLAMA_MODEL environment variable.
    """
    # In a production app, you'd want to persist this to a database
    # For now, we'll just update the in-memory settings
    settings.ollama_model = config.model
    return ModelConfig(model=settings.ollama_model)


@router.post("/pull")
async def pull_model(request: PullModelRequest, current_user: CurrentUser) -> dict:
    """Pull a new model from Ollama library.

    This is an async operation - the model will be downloaded in the background.
    Poll the /models endpoint to check when it's available.
    """
    if not settings.ollama_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is not enabled",
        )

    try:
        # Trigger the pull - this will return immediately while model downloads
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/pull",
                json={"name": request.model, "stream": False},
                timeout=300.0,  # 5 minutes for initial response
            )
            response.raise_for_status()

            return {"status": "pulling", "model": request.model}
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to pull model: {str(e)}",
        )


@router.post("/pull/stream")
async def pull_model_stream(
    request: PullModelRequest, current_user: CurrentUser
) -> StreamingResponse:
    """Stream model pull progress from Ollama."""
    if not settings.ollama_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is not enabled",
        )

    async def stream():
        timeout = httpx.Timeout(10.0, read=None)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/pull",
                    json={"name": request.model, "stream": True},
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            yield line + "\n"
            except httpx.HTTPError as exc:
                yield json.dumps({"error": f"Failed to pull model: {exc}"}) + "\n"

    return StreamingResponse(stream(), media_type="text/plain")
