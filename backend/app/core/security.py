import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


class TokenError(Exception):
    """Token expired our invalid"""


#function to hash password

def hash_password(password: str) -> str:
    # gensalt() it create new salt every time 
    #bcyrpt works on byte so first convert to bytes
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    # to save in db again convet from bytes to string
    return hashed.decode("utf-8")


#function to verify password
def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


#  function for jwt creation 

def _create_token(subject: str, token_type: str, expires_delta: timedelta,
                  extra_claims: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,            # subject = token for which user
        "type": token_type,        # access or refresh
        "iat": now,                # issued at
        "exp": now + expires_delta,  # expiry
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

# function to create access token 
def create_access_token(user_id: uuid.UUID, role: str) -> str:
    return _create_token(
        subject=str(user_id),
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims={"role": role},
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    return _create_token(
        subject=str(user_id),
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_password_reset_token(user_id: uuid.UUID) -> str:
    return _create_token(
        subject=str(user_id),
        token_type="password_reset",
        expires_delta=timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
    )


#Theis function verify jwt token and handle any exception and in last return the payload 
def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],  # list dena lazmi hai, neeche dekhein
            options={"require": ["exp", "sub", "type"]},
            )
    except jwt.ExpiredSignatureError:
        raise TokenError("Token expired")
    except jwt.InvalidTokenError:
        raise TokenError("Invalid token")

    if payload.get("type") != expected_type:
        raise TokenError("Wrong token type")
    return payload