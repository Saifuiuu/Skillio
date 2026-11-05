"""In-memory rate limiting (slowapi). Multi-instance production should use Redis."""

from __future__ import annotations

import time

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.core.config import settings


def get_client_ip(request: Request) -> str:
    """Client IP for rate keys. X-Forwarded-For only when TRUST_PROXY_HEADERS is on."""
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


# headers_enabled=False: success responses may be None/Pydantic models (204/201);
# Retry-After is attached only on 429 via rate_limit_exceeded_handler.
limiter = Limiter(
    key_func=get_client_ip,
    headers_enabled=False,
    storage_uri="memory://",
    enabled=settings.RATE_LIMIT_ENABLED,
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    retry_after = "60"
    view_limit = getattr(request.state, "view_rate_limit", None)
    if view_limit is not None:
        try:
            window_stats = request.app.state.limiter.limiter.get_window_stats(
                view_limit[0], *view_limit[1]
            )
            retry_after = str(max(1, int(window_stats[0] - time.time())))
        except (TypeError, ValueError, AttributeError, KeyError, IndexError):
            retry_after = "60"

    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
        headers={"Retry-After": retry_after},
    )


def login_limit() -> str:
    return f"{settings.RATE_LIMIT_LOGIN_PER_MINUTE}/minute"


def register_limit() -> str:
    return f"{settings.RATE_LIMIT_REGISTER_PER_MINUTE}/minute"


def forgot_password_limit() -> str:
    return f"{settings.RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE}/minute"


def resend_verification_limit() -> str:
    return f"{settings.RATE_LIMIT_RESEND_VERIFICATION_PER_MINUTE}/minute"


def reset_password_limit() -> str:
    return f"{settings.RATE_LIMIT_RESET_PASSWORD_PER_MINUTE}/minute"
