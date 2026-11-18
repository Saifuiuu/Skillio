from __future__ import annotations

import logging
from typing import Any

from app.services.llm.base import LLMClient, LLMOutputError, LLMUnavailableError

logger = logging.getLogger(__name__)


def generate_with_fallback(
    chain: list[LLMClient],
    system: str,
    prompt: str,
    schema: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    """Execute JSON generation across an ordered fallback chain of LLM providers.

    Strategy:
      - Try provider.
      - On LLMOutputError: retry once on the same provider; if retry fails, log and fallback to next.
      - On LLMUnavailableError: log and fallback immediately to next provider.
      - If all fail: raise LLMUnavailableError.

    Returns:
      (result_dict, provider_name)
    """
    if not chain:
        raise LLMUnavailableError("No LLM providers available in fallback chain")

    last_error: Exception | None = None

    for provider in chain:
        # First attempt
        try:
            result = provider.generate_json(system, prompt, schema)
            return result, provider.name
        except LLMOutputError as exc:
            logger.warning(
                "Provider '%s' returned invalid output (%s). Retrying once...",
                provider.name,
                exc,
            )
            # 1 retry on the SAME provider
            try:
                result = provider.generate_json(system, prompt, schema)
                return result, provider.name
            except (LLMOutputError, LLMUnavailableError) as retry_exc:
                logger.warning(
                    "Provider '%s' failed on retry (%s: %s). Falling back to next provider.",
                    provider.name,
                    type(retry_exc).__name__,
                    retry_exc,
                )
                last_error = retry_exc
                continue
        except LLMUnavailableError as exc:
            logger.warning(
                "Provider '%s' unavailable (%s). Falling back to next provider.",
                provider.name,
                exc,
            )
            last_error = exc
            continue

    raise LLMUnavailableError(
        f"All LLM providers in fallback chain failed. Last error: {last_error}"
    )
