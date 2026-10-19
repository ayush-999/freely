"""Application settings, loaded from backend/.env via pydantic-settings."""

from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration. Every value can be overridden via .env."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Application
    app_name: str = "Freely API"
    app_env: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    host: str = "0.0.0.0"
    port: int = 8000

    # Security
    secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Database — Microsoft SQL Server
    # Leave db_user empty to connect via Windows Authentication (trusted connection).
    db_server: str = "localhost"
    db_port: int = 1433
    db_name: str = "freely"
    db_user: str = "sa"
    db_password: str = ""
    db_driver: str = "ODBC Driver 18 for SQL Server"
    db_encrypt: str = "yes"
    db_trust_server_certificate: str = "yes"

    # CORS (comma-separated)
    cors_origins: str = "http://localhost:5173"

    # Object storage
    storage_provider: str = "local"
    storage_local_dir: str = "storage"

    # External AI service
    ai_service_url: str = ""
    ai_service_timeout_seconds: int = 30

    # Notification providers
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    sms_provider_url: str = ""
    push_provider_url: str = ""

    @property
    def database_url(self) -> str:
        """SQLAlchemy URL for SQL Server via pyodbc.

        Empty db_user → Windows Authentication (Trusted_Connection);
        otherwise SQL Server login with db_user/db_password.
        """
        query = (
            f"driver={quote_plus(self.db_driver)}"
            f"&Encrypt={self.db_encrypt}"
            f"&TrustServerCertificate={self.db_trust_server_certificate}"
        )
        if self.db_user:
            return (
                f"mssql+pyodbc://{quote_plus(self.db_user)}:{quote_plus(self.db_password)}"
                f"@{self.db_server}:{self.db_port}/{self.db_name}?{query}"
            )
        return (
            f"mssql+pyodbc://{self.db_server}:{self.db_port}/{self.db_name}"
            f"?{query}&Trusted_Connection=yes"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton (reads .env once)."""
    return Settings()
