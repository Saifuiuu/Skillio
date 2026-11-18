from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class LLMError(Exception):
    """Base exception for all LLM client failures."""


class LLMUnavailableError(LLMError):
    """Connection error, timeout, 5xx status, or unreachable LLM service."""


class LLMOutputError(LLMError):
    """LLM returned non-JSON, invalid JSON, or unparseable output."""


class LLMClient(ABC):
    """Abstract interface for LLM provider clients."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier (e.g. 'ollama:qwen2.5:7b')."""
        ...

    @abstractmethod
    def generate_json(
        self,
        system: str,
        prompt: str,
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate structured JSON adhering to the provided JSON schema.

        Args:
            system: System prompt defining behavior and instructions.
            prompt: User prompt containing content to process.
            schema: JSON schema dict defining expected output structure.

        Returns:
            Parsed dictionary matching the requested schema.

        Raises:
            LLMUnavailableError: On connection/network/timeout errors or 5xx responses.
            LLMOutputError: On malformed or non-JSON output.
        """
        ...
