# Docker Setup

Run Maxwell's Wallet using Docker for easy deployment.

## Quick Start

```bash
docker compose up -d
```

This pulls the latest published image and starts both the frontend (port 3000) and backend (port 3001).

## Docker Compose Files

| File | Description | Image Source |
|------|-------------|--------------|
| `docker-compose.yaml` | Quick start | Pulls from registry |
| `docker-compose.dev.yaml` | Development/CI | Builds from source |
| `docker-compose.demo.yaml` | Demo mode | Pulls from registry |

## Custom Data Location

To store data in a specific host directory:

```bash
docker run -d \
  -p 3000:3000 -p 3001:3001 \
  -v /path/to/your/data:/data \
  ghcr.io/poindexter12/maxwells-wallet
```

## Environment Variables

All settings can be supplied via the environment (e.g. in your compose file or
an `.env` file). The most common ones:

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:////data/wallet.db` | Database connection string (async SQLite by default) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `change-me-in-production-...` | JWT signing key. **Set a long random value in production.** |
| `TOKEN_EXPIRE_HOURS` | `168` (1 week) | How long a login session token stays valid |

See [Authentication](authentication.md) for the first-run setup and password reset.

### AI Assistant

The assistant is configured entirely through the environment — nothing is
persisted to the database, and keys are never returned to the browser. Provide a
key for whichever provider you want; the provider auto-detects from the key
present, or set `ASSISTANT_PROVIDER` to choose explicitly.

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | _(empty)_ | Enables the assistant using Anthropic models |
| `OPENAI_API_KEY` | _(empty)_ | Enables the assistant using OpenAI models |
| `ASSISTANT_PROVIDER` | _(auto-detect)_ | `anthropic` or `openai` to force a provider |
| `ASSISTANT_MODEL` | _(provider default)_ | Optional model override |

If no key is set, the assistant UI simply reports that it is not configured. See
the [Assistant](../features/assistant.md) guide for details.

### Demo Mode

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_MODE` | `false` | Block destructive operations and show a demo banner |
| `DEMO_RESET_INTERVAL_HOURS` | `1` | Hours between demo data resets |

### Backups

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `./data/backups` | Directory for backup files |
| `BACKUP_RETENTION` | `10` | Number of backups to keep (0 = unlimited) |
| `BACKUP_RETENTION_DAYS` | `0` | Delete backups older than N days (0 = disabled) |
| `AUTO_BACKUP_ENABLED` | `false` | Enable scheduled automatic backups |
| `AUTO_BACKUP_INTERVAL_HOURS` | `24` | Hours between automatic backups |

### Observability

OpenTelemetry tracing/metrics are configured via `OTEL_*` variables — see
[Observability](../developer/observability.md) for the full list.

### CORS

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed origins |

## Container Commands

The all-in-one image accepts subcommands in addition to the default start:

```bash
docker compose run --rm maxwells-wallet migrate                       # Run migrations
docker compose run --rm maxwells-wallet seed                          # Seed sample data
docker compose run --rm maxwells-wallet demo-setup                    # Seed + create demo backup
docker compose run --rm maxwells-wallet reset-password <user> <pass>  # Reset a password
```

## Building from Source

```bash
docker compose -f docker-compose.dev.yaml build
docker compose -f docker-compose.dev.yaml up -d
```

Or with the `just` recipes:

```bash
just docker::build
just docker::up
```
