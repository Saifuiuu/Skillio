from __future__ import annotations

import logging

from app.core.config import settings
from app.services.llm.base import (
    LLMClient,
    LLMError,
    LLMOutputError,
    LLMUnavailableError,
)
from app.services.llm.fallback import generate_with_fallback
from app.services.llm.ollama import OllamaClient

logger = logging.getLogger(__name__)


def get_llm_chain() -> list[LLMClient]:
    """Parse settings.LLM_PROVIDER_CHAIN and instantiate available providers in order.

    Unimplemented or missing-credential providers (such as Gemini/Groq) are logged
    with a warning and skipped without crashing.
    """
    raw_chain = settings.LLM_PROVIDER_CHAIN or ""
    provider_names = [p.strip().lower() for p in raw_chain.split(",") if p.strip()]

    chain: list[LLMClient] = []

    for name in provider_names:
        if name == "ollama":
            chain.append(
                OllamaClient(
                    base_url=settings.OLLAMA_BASE_URL,
                    model=settings.OLLAMA_MODEL,
                    timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
                )
            )
        elif name == "gemini":
            if not settings.GEMINI_API_KEY:
                logger.warning(
                    "LLM provider 'gemini' skipped: missing GEMINI_API_KEY."
                )
            else:
                logger.warning(
                    "LLM provider 'gemini' skipped: client implementation not yet added."
                )
        elif name == "groq":
            if not settings.GROQ_API_KEY:
                logger.warning(
                    "LLM provider 'groq' skipped: missing GROQ_API_KEY."
                )
            else:
                logger.warning(
                    "LLM provider 'groq' skipped: client implementation not yet added."
                )
        else:
            logger.warning("Unrecognized LLM provider '%s' in chain; skipping.", name)

    if not chain:
        raise LLMUnavailableError(
            f"No valid LLM providers available in chain: '{settings.LLM_PROVIDER_CHAIN}'"
        )

    return chain


__all__ = [
    "LLMClient",
    "LLMError",
    "LLMOutputError",
    "LLMUnavailableError",
    "OllamaClient",
    "generate_with_fallback",
    "get_llm_chain",
]
