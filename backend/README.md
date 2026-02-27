# Maxwell's Wallet Backend

FastAPI backend with SQLModel, Alembic migrations, and uv for dependency management.

## Setup

### Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) installed
- (Optional) [direnv](https://direnv.net/) for automatic environment management

### Installation

1. **Create virtual environment with uv:**
   ```bash
   uv venv
   ```

2. **Activate the virtual environment:**
   ```bash
   source .venv/bin/activate  # On Unix/macOS
   # or
   .venv\Scripts\activate     # On Windows
   ```

3. **Install dependencies:**
   ```bash
   uv pip install -e .
   ```

4. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

### Using direnv (Recommended)

If you have direnv installed:

1. **Allow direnv:**
   ```bash
   direnv allow
   ```

This will automatically:
- Activate the virtual environment when you cd into the directory
- Load environment variables from `.env`
- Deactivate when you leave the directory

## Running

### Development Server

```bash
uv run uvicorn app.main:app --reload
```

Or from the repo root:
```bash
just dev::backend
```

The API will be available at `http://localhost:3001`

### Database Migrations

Create a new migration:
```bash
uv run alembic revision --autogenerate -m "description"
```

Run migrations:
```bash
uv run alembic upgrade head
```

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:3001/docs`
- ReDoc: `http://localhost:3001/redoc`
- Prometheus Metrics: `http://localhost:3001/metrics`

## Observability

The backend includes OpenTelemetry tracing and Prometheus metrics. Configure via environment variables:

```bash
OTEL_ENABLED=true              # Master toggle
OTEL_TRACING_ENABLED=true      # Request tracing
OTEL_METRICS_ENABLED=true      # Prometheus metrics
OTEL_SLOW_QUERY_THRESHOLD_MS=100  # Log slow queries
```

See [docs/OBSERVABILITY.md](../docs/OBSERVABILITY.md) for full configuration options.

## Testing

Run the test suite:
```bash
uv run pytest
```

Or from the repo root:
```bash
just test::backend
```
