from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class _EmailModel(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 255:
            raise ValueError("Email is too long")
        return v


def _validate_password(v: str) -> str:
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return v


class RegisterRequest(_EmailModel):
    password: str = Field(min_length=8, max_length=128)
    role: Literal["candidate", "employer", "interviewer"]

    @field_validator("password")
    @classmethod
    def fits_bcrypt_limit(cls, v: str) -> str:
        return _validate_password(v)


class LoginRequest(_EmailModel):
    password: str


class ForgotPasswordRequest(_EmailModel):
    pass


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def fits_bcrypt_limit(cls, v: str) -> str:
        return _validate_password(v)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
