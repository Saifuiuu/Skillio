"""Unit tests for app.core.security."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    TokenError,
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password():
    raw = "password1"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("wrongpass", hashed) is False


def test_decode_token_rejects_missing_exp():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "iat": now,
            # no exp
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(TokenError):
        decode_token(token, expected_type="access")


def test_decode_token_rejects_missing_sub():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(TokenError):
        decode_token(token, expected_type="access")


def test_decode_token_rejects_missing_type():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(TokenError):
        decode_token(token, expected_type="access")


def test_decode_token_rejects_wrong_type():
    token = create_access_token(uuid.uuid4(), "candidate", token_version=0)
    with pytest.raises(TokenError, match="Wrong token type"):
        decode_token(token, expected_type="refresh")


def test_decode_token_rejects_expired():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(TokenError, match="expired"):
        decode_token(token, expected_type="access")
