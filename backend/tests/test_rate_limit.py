"""Auth endpoint rate limits (opt-in via enable_rate_limiting)."""

from unittest.mock import patch

from app.core.config import settings
from app.core.rate_limit import limiter


def _has_retry_after(response) -> bool:
    return any(k.lower() == "retry-after" for k in response.headers)


def test_forgot_password_limit_then_429(client, enable_rate_limiting):
    limit = settings.RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE
    for _ in range(limit):
        res = client.post(
            "/auth/forgot-password",
            json={"email": "anyone@example.com"},
        )
        assert res.status_code == 204

    blocked = client.post(
        "/auth/forgot-password",
        json={"email": "anyone@example.com"},
    )
    assert blocked.status_code == 429
    assert _has_retry_after(blocked)
    body = blocked.json()
    assert "detail" in body
    detail = str(body["detail"]).lower()
    assert "exist" not in detail
    assert "registered" not in detail
    assert "not found" not in detail


def test_resend_verification_limit_then_429_no_enumeration(
    client, enable_rate_limiting
):
    limit = settings.RATE_LIMIT_RESEND_VERIFICATION_PER_MINUTE
    for _ in range(limit):
        res = client.post(
            "/auth/resend-verification",
            json={"email": "missing@example.com"},
        )
        assert res.status_code == 204

    blocked = client.post(
        "/auth/resend-verification",
        json={"email": "missing@example.com"},
    )
    assert blocked.status_code == 429
    assert _has_retry_after(blocked)
    detail = str(blocked.json().get("detail", "")).lower()
    assert "exist" not in detail
    assert "verified" not in detail


def test_login_limit_then_429(client, enable_rate_limiting):
    limit = settings.RATE_LIMIT_LOGIN_PER_MINUTE
    for _ in range(limit):
        res = client.post(
            "/auth/login",
            json={"email": "nouser@example.com", "password": "password1"},
        )
        assert res.status_code == 401

    blocked = client.post(
        "/auth/login",
        json={"email": "nouser@example.com", "password": "password1"},
    )
    assert blocked.status_code == 429
    assert _has_retry_after(blocked)


def test_register_limit_then_429(client, enable_rate_limiting):
    limit = settings.RATE_LIMIT_REGISTER_PER_MINUTE
    for i in range(limit):
        res = client.post(
            "/auth/register",
            json={
                "email": f"rl-reg-{i}@example.com",
                "password": "password1",
                "role": "candidate",
            },
        )
        assert res.status_code == 201

    blocked = client.post(
        "/auth/register",
        json={
            "email": "rl-reg-overflow@example.com",
            "password": "password1",
            "role": "candidate",
        },
    )
    assert blocked.status_code == 429
    assert _has_retry_after(blocked)


def test_reset_password_limit_then_429(client, enable_rate_limiting):
    limit = settings.RATE_LIMIT_RESET_PASSWORD_PER_MINUTE
    for _ in range(limit):
        res = client.post(
            "/auth/reset-password",
            json={"token": "not-a-valid-jwt-token", "password": "password1"},
        )
        assert res.status_code == 400

    blocked = client.post(
        "/auth/reset-password",
        json={"token": "not-a-valid-jwt-token", "password": "password1"},
    )
    assert blocked.status_code == 429
    assert _has_retry_after(blocked)


def test_rate_limit_disabled_allows_over_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    limiter.enabled = False
    limiter.reset()

    over = settings.RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE + 3
    for _ in range(over):
        res = client.post(
            "/auth/forgot-password",
            json={"email": "nolimit@example.com"},
        )
        assert res.status_code == 204


def test_trusted_proxy_uses_x_forwarded_for(client, enable_rate_limiting, monkeypatch):
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", True)
    limiter.reset()

    limit = settings.RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE
    headers_a = {"X-Forwarded-For": "203.0.113.10"}
    headers_b = {"X-Forwarded-For": "203.0.113.11"}

    for _ in range(limit):
        assert (
            client.post(
                "/auth/forgot-password",
                json={"email": "a@example.com"},
                headers=headers_a,
            ).status_code
            == 204
        )

    assert (
        client.post(
            "/auth/forgot-password",
            json={"email": "a@example.com"},
            headers=headers_a,
        ).status_code
        == 429
    )
    # Different forwarded IP still allowed
    assert (
        client.post(
            "/auth/forgot-password",
            json={"email": "b@example.com"},
            headers=headers_b,
        ).status_code
        == 204
    )


def test_untrusted_proxy_ignores_x_forwarded_for(
    client, enable_rate_limiting, monkeypatch
):
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", False)
    limiter.reset()

    limit = settings.RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE
    # Spoofed headers should share one bucket (TestClient IP).
    for i in range(limit):
        assert (
            client.post(
                "/auth/forgot-password",
                json={"email": f"spoof-{i}@example.com"},
                headers={"X-Forwarded-For": f"198.51.100.{i}"},
            ).status_code
            == 204
        )

    assert (
        client.post(
            "/auth/forgot-password",
            json={"email": "spoof-overflow@example.com"},
            headers={"X-Forwarded-For": "198.51.100.99"},
        ).status_code
        == 429
    )


def test_forgot_password_still_204_under_limit_with_email_side_effects(
    client, enable_rate_limiting
):
    """Under the limit, unknown emails still get 204 (no enumeration)."""
    with patch("app.api.routes.auth._safe_send_email") as mock_send:
        res = client.post(
            "/auth/forgot-password",
            json={"email": "never-registered@example.com"},
        )
        assert res.status_code == 204
        assert mock_send.call_count == 0
