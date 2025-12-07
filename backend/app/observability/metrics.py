"""
Prometheus metrics registry and metric definitions.

Exposes HTTP request metrics, database query metrics, and business metrics
for monitoring and dashboards.
"""

import time
from typing import TYPE_CHECKING

from prometheus_client import Counter, Gauge, Histogram, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

if TYPE_CHECKING:
    from app.observability.config import ObservabilitySettings

# Global registry - created on module load
registry = CollectorRegistry()

# Track app start time for uptime calculation
_start_time: float = time.time()

# HTTP Request Metrics
http_request_duration = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint", "status_code"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=registry,
)

http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
    registry=registry,
)

http_requests_active = Gauge(
    "http_requests_active",
    "Number of active HTTP requests",
    registry=registry,
)

http_request_errors = Counter(
    "http_request_errors_total",
    "Total HTTP request errors (4xx and 5xx)",
    ["method", "endpoint", "status_code"],
    registry=registry,
)

# Database Query Metrics
db_query_duration = Histogram(
    "db_query_duration_seconds",
    "Database query duration in seconds",
    ["operation"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
    registry=registry,
)

db_slow_queries_total = Counter(
    "db_slow_queries_total",
    "Total slow database queries (exceeding threshold)",
    registry=registry,
)

# Business Metrics
import_transactions_total = Counter(
    "import_transactions_total",
    "Total transactions imported",
    ["format_type", "status"],
    registry=registry,
)

# Settings reference (set during setup)
_settings: "ObservabilitySettings | None" = None


def setup_metrics(settings: "ObservabilitySettings") -> None:
    """
    Initialize metrics with settings.

    Args:
        settings: ObservabilitySettings instance
    """
    global _settings, _start_time
    _settings = settings
    _start_time = time.time()


def get_metrics_enabled() -> bool:
    """Check if metrics collection is enabled."""
    if _settings is None:
        return False
    return _settings.enabled and _settings.metrics_enabled


def get_uptime_seconds() -> float:
    """Get application uptime in seconds."""
    return time.time() - _start_time


def generate_metrics() -> bytes:
    """Generate Prometheus metrics output."""
    return generate_latest(registry)


def get_content_type() -> str:
    """Get Prometheus content type for HTTP response."""
    return CONTENT_TYPE_LATEST


def normalize_endpoint(path: str) -> str:
    """
    Normalize endpoint path to avoid cardinality explosion.

    Replaces numeric IDs with {id} placeholder.

    Examples:
        /api/v1/transactions/123 -> /api/v1/transactions/{id}
        /api/v1/tags/456/usage-count -> /api/v1/tags/{id}/usage-count
    """
    parts = path.split("/")
    normalized = []
    for part in parts:
        # Replace numeric IDs
        if part.isdigit():
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/".join(normalized)


def record_request(
    method: str,
    endpoint: str,
    status_code: int,
    duration: float,
) -> None:
    """
    Record HTTP request metrics.

    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: Normalized endpoint path
        status_code: HTTP response status code
        duration: Request duration in seconds
    """
    if not get_metrics_enabled():
        return

    normalized = normalize_endpoint(endpoint)
    labels = {"method": method, "endpoint": normalized, "status_code": str(status_code)}

    http_request_duration.labels(**labels).observe(duration)
    http_requests_total.labels(**labels).inc()

    if status_code >= 400:
        http_request_errors.labels(**labels).inc()


def record_db_query(operation: str, duration_seconds: float) -> None:
    """
    Record database query metrics.

    Args:
        operation: Query operation type (SELECT, INSERT, UPDATE, DELETE)
        duration_seconds: Query duration in seconds
    """
    if not get_metrics_enabled():
        return

    db_query_duration.labels(operation=operation).observe(duration_seconds)

    # Check for slow query
    if _settings and duration_seconds * 1000 > _settings.slow_query_threshold_ms:
        db_slow_queries_total.inc()


def record_import(format_type: str, status: str, count: int = 1) -> None:
    """
    Record transaction import metrics.

    Args:
        format_type: Import format (csv, qif, qfx, ofx)
        status: Import status (success, error)
        count: Number of transactions
    """
    if not get_metrics_enabled():
        return

    import_transactions_total.labels(format_type=format_type, status=status).inc(count)
