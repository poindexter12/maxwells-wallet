"""
Request timing middleware for metrics collection.

Wraps all HTTP requests to measure duration and record metrics.
"""

import time
from typing import TYPE_CHECKING, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.observability.metrics import (
    http_requests_active,
    record_request,
    get_metrics_enabled,
)

if TYPE_CHECKING:
    from fastapi import FastAPI
    from app.observability.config import ObservabilitySettings


# Paths to exclude from metrics (health checks, metrics endpoint itself)
EXCLUDED_PATHS = {"/health", "/metrics", "/docs", "/redoc", "/openapi.json"}


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP request metrics."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and record metrics.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/handler in chain

        Returns:
            HTTP response
        """
        # Skip metrics for excluded paths
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        # Skip if metrics disabled
        if not get_metrics_enabled():
            return await call_next(request)

        # Track active requests
        http_requests_active.inc()
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            duration = time.perf_counter() - start_time

            # Record metrics
            record_request(
                method=request.method,
                endpoint=request.url.path,
                status_code=response.status_code,
                duration=duration,
            )

            return response

        except Exception:
            duration = time.perf_counter() - start_time
            # Record error metrics
            record_request(
                method=request.method,
                endpoint=request.url.path,
                status_code=500,
                duration=duration,
            )
            raise

        finally:
            http_requests_active.dec()


def add_middleware(app: "FastAPI", settings: "ObservabilitySettings") -> None:
    """
    Add observability middleware to FastAPI app.

    Args:
        app: FastAPI application instance
        settings: ObservabilitySettings instance
    """
    if not settings.enabled or not settings.metrics_enabled:
        return

    app.add_middleware(MetricsMiddleware)
