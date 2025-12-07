"""
Observability module for Maxwell's Wallet.

Provides OpenTelemetry tracing, Prometheus metrics, structured logging,
and alerting capabilities.
"""

from app.observability.config import ObservabilitySettings

__all__ = ["ObservabilitySettings", "setup_observability"]


def setup_observability(app, settings: ObservabilitySettings | None = None):
    """
    Initialize all observability components.

    Call this during app startup to set up:
    - Structured logging (structlog)
    - OpenTelemetry tracing (if enabled)
    - Prometheus metrics (if enabled)
    - Request timing middleware
    - Alerting system

    Args:
        app: FastAPI application instance
        settings: ObservabilitySettings instance (creates default if None)
    """
    if settings is None:
        settings = ObservabilitySettings()

    if not settings.enabled:
        return

    # Import here to avoid circular imports and allow disabling
    from app.observability.logging_config import setup_logging
    from app.observability.metrics import setup_metrics
    from app.observability.tracing import setup_tracing
    from app.observability.middleware import add_middleware
    from app.observability.alerting import setup_alerting
    from app.observability.router import router as observability_router

    # 1. Set up structured logging first
    setup_logging(settings)

    # 2. Set up metrics registry
    setup_metrics(settings)

    # 3. Set up OpenTelemetry tracing
    setup_tracing(app, settings)

    # 4. Set up alerting
    setup_alerting(settings)

    # 5. Add middleware for request timing
    add_middleware(app, settings)

    # 6. Register observability endpoints
    app.include_router(observability_router)
