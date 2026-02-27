# Installation Guide

This guide covers all methods of installing and running Maxwell's Wallet.

## Quick Start (Docker)

The fastest way to get started:

```bash
# Pull and run with Docker
docker run -d -p 3000:3000 -p 3001:3001 \
  -v wallet-data:/data \
  --name maxwells-wallet \
  ghcr.io/poindexter12/maxwells-wallet:latest

# Open http://localhost:3000
```

Data is stored in a Docker volume. To use a specific directory:

```bash
docker run -d -p 3000:3000 -p 3001:3001 \
  -v /path/to/your/data:/data \
  --name maxwells-wallet \
  ghcr.io/poindexter12/maxwells-wallet:latest
```

---

## Docker Compose Deployment

Docker Compose provides flexible deployment options.

### Option 1: Quick Start (Recommended)

Pull and run the latest published image:

```bash
docker compose up -d
```

This uses `docker-compose.yaml` which:
- Pulls `ghcr.io/poindexter12/maxwells-wallet:latest`
- Runs frontend (port 3000) and backend (port 3001) in one container
- Persists data in a Docker volume
- Auto-runs migrations on startup

### Option 2: Build from Source

For development or customization:

```bash
docker compose -f docker-compose.dev.yaml build
docker compose -f docker-compose.dev.yaml up -d
```

This uses `docker-compose.dev.yaml` which:
- Builds the image from local source code
- Supports build args like `ENABLE_PSEUDO=true` for QA testing
- Includes observability settings

### Option 3: Demo Mode

Run a public demo instance with sample data and periodic resets:

```bash
# Start in demo mode (pulls from registry)
docker compose -f docker-compose.demo.yaml up -d

# First-time setup (seeds demo data and creates demo backup)
docker compose -f docker-compose.demo.yaml run --rm maxwells-wallet demo-setup
```

This uses `docker-compose.demo.yaml` which:
- Pulls the latest published image
- Enables demo mode (restricts destructive operations)
- Displays a "Demo Mode" banner in the UI
- Automatically resets data to the demo snapshot hourly

### Customizing the Deployment

Create a `docker-compose.override.yaml` for local customizations:

```yaml
# docker-compose.override.yaml
services:
  maxwells-wallet:
    volumes:
      # Use a specific host directory for data
      - /srv/wallet-data:/data
      # Mount CSV files for import
      - /home/user/bank-exports:/import:ro
    environment:
      # Enable observability features
      - OTEL_ENABLED=true
      - OTEL_ALERT_WEBHOOK_URL=https://hooks.slack.com/...
```

---

## Environment Variables

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:////data/wallet.db` | Database connection string |
| `BACKEND_URL` | `http://localhost:3001` | Backend API URL (used by frontend) |

### Authentication (v0.10+)

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `change-me-in-production` | JWT signing key (**set in production!**) |
| `TOKEN_EXPIRE_HOURS` | `24` | JWT token expiry in hours |

**Important**: Always set `SECRET_KEY` to a secure random string in production:

```bash
docker run -d -p 3000:3000 -p 3001:3001 \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -v wallet-data:/data \
  ghcr.io/poindexter12/maxwells-wallet:latest
```

### Demo Mode (v0.10+)

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_MODE` | `false` | Enable demo mode (restricts destructive actions) |
| `DEMO_RESET_INTERVAL_HOURS` | `1` | Hours between demo data resets |

To run a demo instance:

```bash
DEMO_MODE=true docker compose up -d
docker compose run --rm maxwells-wallet demo-setup
```

### Observability (v0.8+)

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry metrics/tracing |
| `OTEL_METRICS_ENABLED` | `true` | Enable metrics collection |
| `OTEL_TRACING_ENABLED` | `true` | Enable distributed tracing |
| `OTEL_LOG_FORMAT` | `text` | Log format: `text` or `json` |
| `OTEL_SLOW_QUERY_THRESHOLD_MS` | `100` | Log queries slower than this |
| `OTEL_ALERT_WEBHOOK_URL` | - | Webhook URL for threshold alerts |

### Backup Configuration (v0.10+)

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `/data/backups` | Directory for backup files |
| `BACKUP_RETENTION` | `10` | Number of backups to keep (0=unlimited) |
| `BACKUP_RETENTION_DAYS` | `0` | Delete backups older than N days (0=disabled) |

### Build-Time Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PSEUDO` | `false` | Include pseudo-locale (l33t speak) for QA testing |

To include pseudo-locale:

```bash
ENABLE_PSEUDO=true docker compose build
```

---

## Docker Commands

The all-in-one image supports several commands:

```bash
# Start the application (default)
docker compose up -d

# Run database migrations only
docker compose run --rm maxwells-wallet migrate

# Seed with sample data
docker compose run --rm maxwells-wallet seed

# Set up demo mode (seed + create demo backup)
docker compose run --rm maxwells-wallet demo-setup

# Reset a user's password (if locked out)
docker compose run --rm maxwells-wallet reset-password <username> <new_password>

# Run backend only (no frontend)
docker compose run --rm maxwells-wallet backend-only

# Open a shell in the container
docker compose run -it --rm maxwells-wallet shell

# Show help
docker compose run --rm maxwells-wallet help
```

---

## Data Persistence

### Volume Locations

By default, data is stored in a Docker volume named `wallet-data`. The volume contains:

```
/data/
├── wallet.db           # SQLite database
├── backups/           # Backup files (if enabled)
│   ├── manifest.json
│   └── wallet_*.db.gz
└── logs/              # Application logs (if configured)
```

### Using a Host Directory

To use a specific directory on your host:

```yaml
# docker-compose.override.yaml
services:
  maxwells-wallet:
    volumes:
      - /srv/maxwells-wallet/data:/data
```

Or with the driver_opts approach:

```yaml
volumes:
  wallet-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /srv/maxwells-wallet/data
```

### Backup Strategy

The application includes built-in backup functionality:

1. **Manual Backups**: Via Admin > Backups in the UI
2. **Scheduled Backups**: Configure interval in Admin > Settings
3. **Pre-Import Backups**: Automatic backup before batch imports

For external backups, the SQLite database can be safely copied while the application is running (SQLite uses WAL mode).

---

## Development Setup

For local development without Docker:

### Prerequisites

Install [mise](https://mise.jdx.dev/) (tool version manager):
```bash
curl https://mise.run | sh
```

mise auto-installs all dev tools (Node, Python, uv, just, gum) when you enter the project directory.

### Setup

```bash
git clone https://github.com/poindexter12/maxwells-wallet.git
cd maxwells-wallet

# Install dependencies and initialize database
just setup

# Start development servers (frontend + backend)
just dev::dev

# Open http://localhost:3000
```

### Available Recipes

```bash
just              # Show all available recipes

# Development
just dev::dev           # Run both servers
just dev::backend       # Run backend only
just dev::frontend      # Run frontend only

# Testing
just test::all          # Run all tests
just test::backend      # Run backend tests only
just test::e2e          # Run E2E tests

# Database
just db::migrate MESSAGE="description"  # Create new migration
just db::upgrade        # Apply migrations
just db::reset          # Reset database

# Build
just dev::build-frontend  # Build frontend for production
just docker::build        # Build Docker image
```

### Development Environment

The repository includes:

- `.mise.toml` - Tool versions (Node, Python, uv, just, gum)
- `justfile` + `.just/` - All task runner recipes

---

## Production Deployment

### Recommended Architecture

For production deployments:

```
┌─────────────────────────────────────────────────┐
│                   Reverse Proxy                  │
│               (nginx / Caddy / Traefik)          │
│                    port 443                      │
└─────────────────────┬───────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│   Frontend    │           │   Backend     │
│  (Next.js)    │───────────│  (FastAPI)    │
│   port 3000   │           │   port 3001   │
└───────────────┘           └───────┬───────┘
                                    │
                            ┌───────▼───────┐
                            │   SQLite DB   │
                            │   /data/      │
                            └───────────────┘
```

### Reverse Proxy Example (Caddy)

```
# Caddyfile
wallet.example.com {
    reverse_proxy localhost:3000
}

wallet-api.example.com {
    reverse_proxy localhost:3001
}
```

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 443 ssl;
    server_name wallet.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Health Checks

The application exposes health endpoints:

- Backend: `GET http://localhost:3001/health`
- Frontend: `GET http://localhost:3000`

The Docker image includes built-in health checks that verify both services.

### Systemd Service (Non-Docker)

If running without Docker:

```ini
# /etc/systemd/system/maxwells-wallet.service
[Unit]
Description=Maxwell's Wallet
After=network.target

[Service]
Type=simple
User=wallet
WorkingDirectory=/opt/maxwells-wallet
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Upgrading

### Docker Upgrades

```bash
# Pull latest image
docker compose pull

# Restart with new version
docker compose up -d

# Migrations run automatically on startup
```

### Checking Version

The current version is displayed:
- In the UI footer
- Via API: `GET /api/v1/settings` returns `app_version`
- In logs at startup

### Breaking Changes

Check `CHANGELOG.md` for breaking changes between versions. Major version bumps (e.g., v0.9 → v1.0) may require manual migration steps.

---

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker compose logs -f
```

Common issues:
- Port already in use: Change ports in `docker-compose.override.yaml`
- Permission denied on volume: Ensure the data directory is writable

### Database Issues

Reset the database:
```bash
# Stop container
docker compose down

# Remove database (WARNING: deletes all data)
docker volume rm maxwells-wallet_wallet-data

# Restart
docker compose up -d
```

### Health Check Failing

```bash
# Check individual service health
curl http://localhost:3001/health
curl http://localhost:3000

# Check container health status
docker inspect maxwells-wallet --format='{{.State.Health.Status}}'
```

### Viewing Logs

```bash
# All logs
docker compose logs -f

# Backend only
docker compose logs -f maxwells-wallet 2>&1 | grep backend

# Last 100 lines
docker compose logs --tail 100
```
