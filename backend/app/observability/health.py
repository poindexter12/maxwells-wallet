"""
Health check logic and metrics aggregation.

Provides health status checks and metric calculations for the dashboard.
"""

from typing import Literal
from pydantic import BaseModel

from app.observability.metrics import (
    http_requests_active,
    registry,
)


class DatabaseHealth(BaseModel):
    """Database connectivity status."""

    status: Literal["up", "down"]
    latency_ms: float | None = None
    error: str | None = None


class HealthStatus(BaseModel):
    """Overall health status."""

    status: Literal["healthy", "degraded", "unhealthy"]
    database: DatabaseHealth
    version: str = "0.9.0-beta4"


async def check_database() -> DatabaseHealth:
    """
    Check database connectivity.

    Returns:
        DatabaseHealth with status and latency
    """
    import time
    from sqlalchemy import text

    try:
        from app.database import async_session

        start = time.perf_counter()
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        latency_ms = (time.perf_counter() - start) * 1000

        return DatabaseHealth(status="up", latency_ms=round(latency_ms, 2))

    except Exception as e:
        return DatabaseHealth(status="down", error=str(e))


async def get_health_status() -> HealthStatus:
    """
    Get overall health status.

    Returns:
        HealthStatus with component checks
    """
    db_health = await check_database()

    # Determine overall status
    if db_health.status == "down":
        status: Literal["healthy", "degraded", "unhealthy"] = "unhealthy"
    elif db_health.latency_ms and db_health.latency_ms > 100:
        status = "degraded"
    else:
        status = "healthy"

    return HealthStatus(
        status=status,
        database=db_health,
    )


def calculate_latency_percentiles() -> dict[str, float]:
    """
    Calculate request latency percentiles from histogram.

    Note: This is an approximation based on histogram buckets.
    For production, consider using a proper time-series database.

    Returns:
        Dict with p50, p95, p99 in milliseconds
    """
    # Get histogram data
    try:
        # Sum all observations across labels
        total_count = 0
        bucket_counts: dict[float, int] = {}

        for metric in registry.collect():
            if metric.name == "http_request_duration_seconds":
                for sample in metric.samples:
                    if sample.name.endswith("_bucket"):
                        le = sample.labels.get("le", "+Inf")
                        if le != "+Inf":
                            bucket = float(le)
                            bucket_counts[bucket] = bucket_counts.get(bucket, 0) + int(
                                sample.value
                            )
                    elif sample.name.endswith("_count"):
                        total_count += int(sample.value)

        if total_count == 0:
            return {"p50": 0, "p95": 0, "p99": 0}

        # Calculate approximate percentiles from buckets
        sorted_buckets = sorted(bucket_counts.keys())
        cumulative = 0
        percentiles = {"p50": 0.0, "p95": 0.0, "p99": 0.0}
        targets = {"p50": 0.5, "p95": 0.95, "p99": 0.99}

        for bucket in sorted_buckets:
            cumulative = bucket_counts[bucket]
            ratio = cumulative / total_count if total_count > 0 else 0

            for name, target in targets.items():
                if ratio >= target and percentiles[name] == 0:
                    percentiles[name] = bucket * 1000  # Convert to ms

        return percentiles

    except Exception:
        return {"p50": 0, "p95": 0, "p99": 0}


def calculate_error_rates() -> dict[str, float]:
    """
    Calculate error rates from counters.

    Note: Without time-windowed metrics, this returns overall rates.
    For production, use Prometheus queries or a metrics store.

    Returns:
        Dict with last_hour and last_24h error rates as percentages
    """
    try:
        total_requests = 0
        total_errors = 0

        for metric in registry.collect():
            if metric.name == "http_requests_total":
                for sample in metric.samples:
                    if sample.name == "http_requests_total_total":
                        total_requests += int(sample.value)
            elif metric.name == "http_request_errors_total":
                for sample in metric.samples:
                    if sample.name == "http_request_errors_total_total":
                        total_errors += int(sample.value)

        if total_requests == 0:
            rate = 0.0
        else:
            rate = (total_errors / total_requests) * 100

        # Without time windows, return same rate for both
        # In production, query Prometheus with rate() function
        return {"last_hour": round(rate, 2), "last_24h": round(rate, 2)}

    except Exception:
        return {"last_hour": 0, "last_24h": 0}


def get_active_request_count() -> int:
    """Get current number of active requests."""
    try:
        return int(http_requests_active._value.get())
    except Exception:
        return 0


def get_total_request_count() -> int:
    """Get total request count."""
    try:
        total = 0
        for metric in registry.collect():
            if metric.name == "http_requests_total":
                for sample in metric.samples:
                    if sample.name == "http_requests_total_total":
                        total += int(sample.value)
        return total
    except Exception:
        return 0
