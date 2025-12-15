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

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///data/wallet.db` | Database connection string |
| `DEMO_MODE` | `false` | Enable demo mode restrictions |

## Building from Source

```bash
docker compose -f docker-compose.dev.yaml build
docker compose -f docker-compose.dev.yaml up -d
```
