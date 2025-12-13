"""
Application configuration for demo mode and backup settings.

All settings can be configured via environment variables.
"""

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


settings = AppSettings()
