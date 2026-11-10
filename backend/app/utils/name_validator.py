"""Shared full_name validation for auth endpoints."""

from __future__ import annotations

import re
import unicodedata


def validate_full_name(value: str | None) -> str:
    """Validate and sanitise a full_name.

    Rules:
    - Required / non-empty
    - Strip outer whitespace, collapse internal whitespace to single spaces
    - Length 2–80 (after cleaning)
    - No control characters (Cc/Cf Unicode categories) or newlines
    - No HTML angle brackets (< >)
    - Only Unicode letters, spaces, and the punctuation . ' -
    - Must contain at least one Unicode letter

    Returns the cleaned string on success; raises ValueError on failure.
    """
    if not value or not value.strip():
        raise ValueError("Full name is required")

    # Reject control characters / format chars (newlines, tabs etc.) BEFORE stripping/splitting
    if any(unicodedata.category(c) in ("Cc", "Cf") for c in value) or any(c in "\r\n\t" for c in value):
        raise ValueError("Name contains invalid characters")

    # Collapse internal whitespace
    cleaned = " ".join(value.split())

    # Reject HTML angle brackets
    if "<" in cleaned or ">" in cleaned:
        raise ValueError("Name contains invalid characters")

    # Length check (after cleaning)
    if len(cleaned) < 2 or len(cleaned) > 80:
        raise ValueError("Name must be between 2 and 80 characters")

    # Only Unicode letters, spaces, and . ' -
    if not re.match(r"^[\w\s.\'\-]+$", cleaned, re.UNICODE):
        raise ValueError("Name contains invalid characters")

    # Must have at least one actual letter (reject pure-digit or pure-symbol strings)
    if not any(unicodedata.category(c).startswith("L") for c in cleaned):
        raise ValueError("Name must contain at least one letter")

    return cleaned
