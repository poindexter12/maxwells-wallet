# Observability

Maxwell's Wallet includes production-ready observability powered by OpenTelemetry and Prometheus.

## Overview

The observability stack provides:

- **Tracing** - Request flow tracking with span hierarchies
- **Metrics** - Prometheus-compatible metrics endpoint
- **Health Dashboard** - Real-time system health in Admin UI
- **Alerting** - Webhook notifications for anomalies

## Configuration

All features are controlled via environment variables in `.env`:

```bash
# Master toggle (default: true)
OTEL_ENABLED=true

# Individual feature toggles
OTEL_TRACING_ENABLED=true
OTEL_METRICS_ENABLED=true

# Logging
OTEL_LOG_LEVEL=INFO
OTEL_LOG_FORMAT=console  # or "json" for structured logs

# Slow query detection threshold in milliseconds
OTEL_SLOW_QUERY_THRESHOLD_MS=100

# Alert webhook (optional)
OTEL_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Metrics Endpoint

Prometheus metrics are exposed at `/metrics`:

```bash
curl http://localhost:8000/metrics
```

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | Request latency by method, endpoint, status |
| `http_requests_total` | Counter | Total requests by method, endpoint, status |
| `http_requests_active` | Gauge | Currently active requests |
| `db_query_duration_seconds` | Histogram | Database query timing by operation |

### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'maxwells-wallet'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: /metrics
```

## OpenTelemetry Tracing

Automatic instrumentation covers:

- All FastAPI HTTP requests
- SQLAlchemy database queries
- Custom business logic via `@traced()` decorator

### Trace Attributes

Traces include:

- Request method, path, status code
- SQL queries with sanitized parameters
- Custom span attributes for business context

## Health Dashboard

Access the health dashboard in the Admin UI:

1. Navigate to `/admin`
2. Click the **Health** tab
3. View real-time metrics:
   - **Status** - healthy / degraded / unhealthy
   - **Latency** - p50, p95, p99 percentiles
   - **Error Rate** - Last hour and 24-hour rates
   - **Active Requests** - Current in-flight requests

The dashboard auto-refreshes every 10 seconds.

## Alerting

Configure webhook alerts for threshold breaches:

| Condition | Default Threshold |
|-----------|-------------------|
| Error rate | > 5% |
| P99 latency | > 5000ms |

### Webhook Payload

```json
{
  "alert_type": "error_rate_high",
  "threshold": 0.05,
  "current_value": 0.08,
  "timestamp": "2024-01-15T10:30:00Z",
  "message": "Error rate 8% exceeds threshold 5%"
}
```

### Slack Integration

1. Create a Slack incoming webhook
2. Set `OTEL_ALERT_WEBHOOK_URL` to the webhook URL
3. Alerts will post to your configured channel

## Disabling Observability

For development or testing:

```bash
# Disable all observability
OTEL_ENABLED=false

# Or disable specific features
OTEL_TRACING_ENABLED=false
OTEL_METRICS_ENABLED=false
```

## Performance Impact

Observability adds minimal overhead:

| Feature | Overhead |
|---------|----------|
| Metrics collection | ~1-2ms per request |
| Tracing | ~2-3ms per request |
| Health aggregation | Background task, no request impact |

For high-throughput scenarios, consider disabling tracing and keeping only metrics.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Application                     │
├─────────────────────────────────────────────────────────────┤
│  Middleware Layer                                            │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Metrics         │  │ Tracing         │                   │
│  │ Middleware      │  │ Middleware      │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                             │
│           ▼                    ▼                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Prometheus      │  │ OpenTelemetry   │                   │
│  │ Registry        │  │ Tracer          │                   │
│  └────────┬────────┘  └─────────────────┘                   │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │ /metrics        │◄────── Prometheus Scrape               │
│  │ endpoint        │                                        │
│  └─────────────────┘                                        │
├─────────────────────────────────────────────────────────────┤
│  Health Aggregation                                          │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Stats Collector │──│ Alert Manager   │──► Webhook        │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```
