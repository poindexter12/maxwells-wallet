"""
Application configuration for demo mode and backup settings.

All settings can be configured via environment variables.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Configuration for demo mode and backup features."""

    model_config = SettingsConfigDict(
        env_prefix="",
        case_sensitive=False,
    )

    # Demo mode - restricts destructive operations
    demo_mode: bool = False
    demo_reset_interval_hours: int = 1  # How often to reset demo data (only when demo_mode=True)

    # Backup settings
    backup_dir: str = "./data/backups"
    backup_retention: int = 10  # Keep N most recent backups (0 = unlimited)
    backup_retention_days: int = 0  # Delete backups older than N days (0 = disabled)

    # Scheduled backup settings
    auto_backup_enabled: bool = False  # Enable automatic backups
    auto_backup_interval_hours: int = 24  # How often to run automatic backups

    # Authentication settings
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    token_expire_hours: int = 24 * 7  # 1 week default

    # CORS settings - comma-separated list of allowed origins
    cors_origins: str = "http://localhost:3000"

    # AI assistant: optional API keys via environment. These are used as a
    # fallback when no key is stored in app_settings, so a key never has to
    # touch the database if the operator prefers env-only provisioning.
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS environment variable into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = AppSettings()
