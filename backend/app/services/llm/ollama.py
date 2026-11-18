from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.services.llm.base import LLMClient, LLMOutputError, LLMUnavailableError

logger = logging.getLogger(__name__)


class OllamaClient(LLMClient):
    """Local Ollama client utilizing /api/chat with structured JSON schema output."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "qwen2.5:7b",
        timeout_seconds: float = 120.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    @property
    def name(self) -> str:
        return f"ollama:{self.model}"

    def generate_json(
        self,
        system: str,
        prompt: str,
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "format": schema,
            "options": {
                "temperature": 0.0,
            },
        }

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(url, json=payload)
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise LLMUnavailableError(
                f"Failed to connect to Ollama at {self.base_url}: {exc}"
            ) from exc
        except Exception as exc:
            raise LLMUnavailableError(
                f"Unexpected error communicating with Ollama: {exc}"
            ) from exc

        if response.status_code >= 500 or response.status_code == 404:
            raise LLMUnavailableError(
                f"Ollama returned HTTP {response.status_code}: {response.text[:200]}"
            )
        if response.is_error:
            raise LLMUnavailableError(
                f"Ollama returned error {response.status_code}: {response.text[:200]}"
            )

        try:
            data = response.json()
        except Exception as exc:
            raise LLMOutputError(
                f"Ollama response was not valid JSON: {exc}"
            ) from exc

        content = data.get("message", {}).get("content")
        if not content or not isinstance(content, str):
            raise LLMOutputError("Ollama response missing message content string")

        try:
            result = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMOutputError(
                f"Ollama content could not be parsed as JSON: {exc}"
            ) from exc

        if not isinstance(result, dict):
            raise LLMOutputError(
                f"Ollama content parsed as {type(result).__name__}, expected dict"
            )

        return result
