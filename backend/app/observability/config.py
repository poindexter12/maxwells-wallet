"""
Configuration for observability features.

All settings can be configured via environment variables with the OTEL_ prefix.
"""

from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class ObservabilitySettings(BaseSettings):
    """Configuration for observability features."""

    model_config = SettingsConfigDict(
        env_prefix="OTEL_",
        case_sensitive=False,
    )

    # Master toggle - disables all observability when False
    enabled: bool = True

    # Tracing configuration
    tracing_enabled: bool = True
    trace_sample_rate: float = 1.0  # 1.0 = 100%, 0.1 = 10%

    # Metrics configuration
    metrics_enabled: bool = True
    metrics_prefix: str = "maxwells_wallet"

    # Slow query detection
    slow_query_threshold_ms: int = 100

    # Alerting thresholds
    alert_error_rate_threshold: float = 0.05  # 5% error rate triggers alert
    alert_latency_p99_threshold_ms: int = 5000  # 5 second p99 triggers alert
    alert_webhook_url: str | None = None
    alert_cooldown_seconds: int = 300  # 5 minute cooldown between alerts

    # Logging configuration
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["json", "console"] = "json"

    # Service identification
    service_name: str = "maxwells-wallet"
    service_version: str = "0.9.0-beta4"
