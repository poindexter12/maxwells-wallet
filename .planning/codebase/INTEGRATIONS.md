# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**None detected.** Maxwell's Wallet does not integrate with third-party payment, banking, or financial APIs. All data is user-provided via file import or manual entry.

## Data Storage

**Databases:**
- SQLite (development environment)
  - Location: `./wallet.db` (default) or custom via `DATABASE_URL`
  - Client: SQLAlchemy 2.0 async ORM
  - Connection: `sqlite+aiosqlite:///./wallet.db`

- PostgreSQL 14+ (production environment)
  - Client: SQLAlchemy 2.0 async ORM
  - Connection: Configured via `DATABASE_URL` environment variable
  - No hard dependency in code; schema supports both via Alembic migrations

**File Storage:**
- Local filesystem only
- Backup directory: `./data/backups` (configurable via `backup_dir`)
- Database backups: Snapshot copies of SQLite/Postgres database files
- No cloud storage integration

**Caching:**
- Frontend: SWR 2.3.8 (in-memory HTTP cache)
- Backend: Python dictionary-based caching for computed reports (no Redis/Memcached)

## Authentication & Identity

**Auth Provider:**
- Custom (single-user JWT-based)
  - Implementation approach: `backend/app/utils/auth.py`
  - Password hashing: bcrypt 4.0.0 (direct, no passlib)
  - Token type: JWT with HS256 algorithm
  - Token lifetime: Configurable via `token_expire_hours` (default: 7 days)
  - Setup: `/api/v1/auth/setup` endpoint creates first user
  - Login: `/api/v1/auth/login` endpoint issues JWT tokens

## Monitoring & Observability

**Error Tracking:**
- None built-in. OpenTelemetry tracing infrastructure supports integration with third-party APMs (Jaeger, Datadog, etc.) but not configured by default.

**Logs:**
- Backend: Structured logging via structlog 24.1.0
  - Format: JSON (configurable via `OTEL_LOG_FORMAT`)
  - Level: Configurable via `OTEL_LOG_LEVEL` (default: INFO)
  - Output: stdout (for container/systemd capture)

**Tracing:**
- OpenTelemetry (optional, disabled by default)
  - Framework: opentelemetry-sdk 1.24.0
  - Exporter: OTLP (opentelemetry-exporter-otlp 1.24.0)
  - Instrumentation:
    - FastAPI: opentelemetry-instrumentation-fastapi 0.45b0
    - SQLAlchemy: opentelemetry-instrumentation-sqlalchemy 0.45b0
  - Master toggle: `OTEL_ENABLED` (default: true)
  - Sample rate: `OTEL_TRACE_SAMPLE_RATE` (default: 1.0 = 100%)
  - Configuration: `backend/app/observability/config.py`

**Metrics:**
- Prometheus (optional, disabled by default)
  - Framework: prometheus-client 0.19.0
  - Endpoint: `GET /metrics` (FastAPI route)
  - Metrics:
    - Request counters (by method, path, status)
    - Request latency histogram
    - Database query counters and durations
    - Custom metrics for domain logic (e.g., transaction imports, report generation)
  - Metric prefix: `maxwells_wallet` (configurable via `OTEL_METRICS_PREFIX`)
  - Configuration: `backend/app/observability/metrics.py`

**Health Checks:**
- Endpoint: `GET /health` - Simple health check
- Endpoint: `GET /` - Version and documentation links
- Health monitoring: `backend/app/observability/health.py`

## CI/CD & Deployment

**Hosting:**
- No built-in PaaS integration. Can deploy to:
  - Docker (Dockerfile expected, not present in repo)
  - Traditional VMs (manual setup)
  - Kubernetes (via containerization)
  - Vercel (Next.js frontend)
  - Heroku, Railway, Render (with buildpack or Dockerfile)

**CI Pipeline:**
- GitHub Actions (inferred from `playwright.config.ts` CI detection)
  - E2E tests run with `process.env.CI` check
  - Test workers: Single worker in CI (parallel: false for stability)
  - Test retries: 2 retries in CI
  - Reporting: GitHub reporter for Playwright

**Version Management:**
- Frontend: `frontend/package.json` version field
- Backend: `backend/pyproject.toml` version field
- Manual versioning (no automated release tool configured)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - Database connection string (default: SQLite)
- `BACKEND_URL` - Backend API URL for frontend (default: `http://localhost:3001`)
- `SECRET_KEY` - JWT signing key (default: dummy key, MUST change in production)

**Optional env vars:**
- `DEMO_MODE` - Enable read-only demo mode (blocks deletes/modifications)
- `DEMO_RESET_INTERVAL_HOURS` - Demo data reset frequency
- `SKIP_MIGRATIONS` - Skip Alembic migrations on startup
- `SQL_ECHO` - Enable SQLAlchemy query logging
- `OTEL_ENABLED` - Enable OpenTelemetry observability
- `OTEL_TRACING_ENABLED` - Enable distributed tracing
- `OTEL_TRACE_SAMPLE_RATE` - Trace sampling rate (0.0-1.0)
- `OTEL_METRICS_ENABLED` - Enable Prometheus metrics
- `OTEL_LOG_LEVEL` - Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `OTEL_LOG_FORMAT` - Log format (json, console)
- `OTEL_ALERT_WEBHOOK_URL` - Webhook for observability alerts
- `AUTO_BACKUP_ENABLED` - Enable automatic database backups
- `AUTO_BACKUP_INTERVAL_HOURS` - Backup frequency
- `BACKUP_RETENTION` - Number of backups to keep
- `BACKUP_RETENTION_DAYS` - Age limit for backup deletion
- `TOKEN_EXPIRE_HOURS` - JWT token lifetime
- `ENABLE_PSEUDO` - Enable pseudo-locale for i18n testing

**Secrets location:**
- Development: `.env` file (local, not committed)
- Production: Environment variables (set by deployment platform)
- Reference: `.env.example` - Template for required vars

## Webhooks & Callbacks

**Incoming:**
- None. No webhooks or callbacks from external services.

**Outgoing:**
- Optional alerting webhooks: `OTEL_ALERT_WEBHOOK_URL` (alerting system)
  - Purpose: Observability alerts (high error rate, latency threshold breaches)
  - Trigger: Configured in `backend/app/observability/config.py`

## Import Formats & Parsers

**Supported import formats (local file upload only):**
- CSV (custom, Bank of America checking, Bank of America credit card, American Express, Venmo, Inspira HSA)
- QIF (Quicken Interchange Format)
- QFX (Quicken Financial Exchange / OFX variant)

**Location:** `backend/app/parsers/` - Format-specific parsers for bank statement imports

## Database Backup Integration

**Local backup system (no cloud storage):**
- Backup engine: Python file copy
- Storage: `./data/backups/` directory (local filesystem)
- Configuration:
  - `BACKUP_DIR` - Backup directory path
  - `BACKUP_RETENTION` - Keep N most recent backups
  - `BACKUP_RETENTION_DAYS` - Delete backups older than N days
  - `AUTO_BACKUP_ENABLED` - Enable automatic backups
  - `AUTO_BACKUP_INTERVAL_HOURS` - Backup frequency
- Implementation: `backend/app/services/backup.py`

## Scheduling & Background Jobs

**Scheduler:**
- APScheduler 3.10.0 - Background job scheduler
- Jobs:
  - Demo mode reset (hourly, when `DEMO_MODE=true`)
  - Automatic database backups (configurable interval)
- Implementation: `backend/app/services/scheduler.py`

---

*Integration audit: 2026-02-23*
