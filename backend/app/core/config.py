from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ — works no matter which cwd uvicorn is started from
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    # Separate DB for pytest — never point this at the same DB as DATABASE_URL.
    TEST_DATABASE_URL: str = ""
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Must be False on localhost (HTTP). Set True behind HTTPS in production.
    COOKIE_SECURE: bool = False

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    PASSWORD_RESET_EXPIRE_MINUTES: int = 15
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@skillio.local"

    # Optional — used by scripts/seed_admin.py only (never hardcode credentials).
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # Rate limiting (in-memory; use Redis storage in multi-instance production).
    RATE_LIMIT_ENABLED: bool = True
    # Only trust X-Forwarded-For when behind a known reverse proxy.
    TRUST_PROXY_HEADERS: bool = False
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_REGISTER_PER_MINUTE: int = 5
    RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE: int = 3
    RATE_LIMIT_RESEND_VERIFICATION_PER_MINUTE: int = 3
    RATE_LIMIT_RESET_PASSWORD_PER_MINUTE: int = 5

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        # utf-8-sig strips a UTF-8 BOM if the editor re-adds one on save
        env_file_encoding="utf-8-sig",
        extra="ignore",
    )

    @staticmethod
    def _with_psycopg(url: str) -> str:
        return url.replace("postgresql://", "postgresql+psycopg://", 1)

    @property
    def sqlalchemy_url(self) -> str:
        # Neon "postgresql://" deta hai, SQLAlchemy ko driver ka naam chahiye
        return self._with_psycopg(self.DATABASE_URL)

    @property
    def test_sqlalchemy_url(self) -> str:
        if not self.TEST_DATABASE_URL:
            raise RuntimeError(
                "TEST_DATABASE_URL is not set. Tests refuse to use the dev database."
            )
        if self.TEST_DATABASE_URL.strip() == self.DATABASE_URL.strip():
            raise RuntimeError(
                "TEST_DATABASE_URL must differ from DATABASE_URL (isolation required)."
            )
        return self._with_psycopg(self.TEST_DATABASE_URL)

    @property
    def google_oauth_configured(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)


settings = Settings()
