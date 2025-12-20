"""
Structured logging configuration using structlog.

Provides JSON-formatted logs in production and human-readable console
output in development.
"""

import logging
import sys
from typing import TYPE_CHECKING, cast

import structlog
from structlog.types import Processor

if TYPE_CHECKING:
    from app.observability.config import ObservabilitySettings


def setup_logging(settings: "ObservabilitySettings") -> None:
    """
    Configure structlog for structured logging.

    Args:
        settings: ObservabilitySettings with log_level and log_format
    """
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level),
    )

    # Shared processors for all output formats
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.log_format == "json":
        # JSON output for production
        processors: list[Processor] = [
            *shared_processors,
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Console output for development
        processors = [
            *shared_processors,
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured structlog logger
    """
    return cast(structlog.stdlib.BoundLogger, structlog.get_logger(name))


def log_slow_query(
    query: str,
    duration_ms: float,
    table: str | None = None,
    operation: str | None = None,
) -> None:
    """
    Log a slow database query.

    Args:
        query: SQL query string (may be truncated)
        duration_ms: Query execution time in milliseconds
        table: Table name if available
        operation: Operation type (SELECT, INSERT, UPDATE, DELETE)
    """
    logger = get_logger("slow_query")
    logger.warning(
        "slow_query_detected",
        query=query[:500] if len(query) > 500 else query,  # Truncate long queries
        duration_ms=duration_ms,
        table=table,
        operation=operation,
    )
