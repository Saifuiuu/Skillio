from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ — works no matter which cwd uvicorn is started from
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
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

    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@skillio.local"

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        # utf-8-sig strips a UTF-8 BOM if the editor re-adds one on save
        env_file_encoding="utf-8-sig",
        extra="ignore",
    )

    @property
    def sqlalchemy_url(self) -> str:
        # Neon "postgresql://" deta hai, SQLAlchemy ko driver ka naam chahiye
        return self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

    @property
    def google_oauth_configured(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)


settings = Settings()
