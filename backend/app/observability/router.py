"""
Observability API endpoints.

Provides Prometheus metrics endpoint and health/stats APIs for the dashboard.
"""

from typing import Literal
from pydantic import BaseModel
from fastapi import APIRouter
from starlette.responses import Response

from app.observability.metrics import (
    generate_metrics,
    get_content_type,
    get_uptime_seconds,
    db_slow_queries_total,
)
from app.observability.health import get_health_status, HealthStatus

router = APIRouter(tags=["observability"])


class LatencyPercentiles(BaseModel):
    """Request latency percentiles in milliseconds."""

    p50: float
    p95: float
    p99: float


class ErrorRates(BaseModel):
    """Error rates as percentages."""

    last_hour: float
    last_24h: float


class HealthStats(BaseModel):
    """Health statistics for the dashboard."""

    status: Literal["healthy", "degraded", "unhealthy"]
    request_latency: LatencyPercentiles
    error_rate: ErrorRates
    active_requests: int
    uptime_seconds: float
    slow_query_count: int
    total_requests: int


@router.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> Response:
    """
    Prometheus metrics endpoint.

    Returns metrics in Prometheus text format for scraping.
    """
    return Response(
        content=generate_metrics(),
        media_type=get_content_type(),
    )


@router.get("/api/v1/observability/health", response_model=HealthStatus)
async def health_check() -> HealthStatus:
    """
    Detailed health check with component status.

    Returns:
        Health status with database connectivity check
    """
    return await get_health_status()


@router.get("/api/v1/observability/stats", response_model=HealthStats)
async def observability_stats() -> HealthStats:
    """
    Aggregated stats for the developer dashboard.

    Returns latency percentiles, error rates, and slow query counts
    derived from Prometheus metrics.
    """
    from app.observability.health import (
        calculate_latency_percentiles,
        calculate_error_rates,
        get_active_request_count,
        get_total_request_count,
    )

    latency = calculate_latency_percentiles()
    error_rates = calculate_error_rates()
    health = await get_health_status()

    return HealthStats(
        status=health.status,
        request_latency=LatencyPercentiles(
            p50=latency.get("p50", 0),
            p95=latency.get("p95", 0),
            p99=latency.get("p99", 0),
        ),
        error_rate=ErrorRates(
            last_hour=error_rates.get("last_hour", 0),
            last_24h=error_rates.get("last_24h", 0),
        ),
        active_requests=get_active_request_count(),
        uptime_seconds=get_uptime_seconds(),
        slow_query_count=int(db_slow_queries_total._value.get()),
        total_requests=get_total_request_count(),
    )
