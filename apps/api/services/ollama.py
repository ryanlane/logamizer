"""Ollama integration service."""

from __future__ import annotations

import httpx

from apps.api.config import get_settings

settings = get_settings()


class OllamaService:
    """Service wrapper for Ollama."""

    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_model

    async def generate(self, prompt: str) -> str:
        """Generate a response from Ollama."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{self.base_url}/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()

        return data.get("response", "")
