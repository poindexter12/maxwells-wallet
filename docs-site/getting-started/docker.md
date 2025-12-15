# Docker Setup

Run Maxwell's Wallet using Docker for easy deployment.

## Quick Start

```bash
docker compose up -d
```

This starts both the frontend (port 3000) and backend (port 3001).

## Docker Compose

The default `docker-compose.yaml` configuration:

```yaml
services:
  app:
    image: ghcr.io/poindexter12/maxwells-wallet:latest
    ports:
      - "3000:3000"
      - "3001:3001"
    volumes:
      - wallet-data:/data

volumes:
  wallet-data:
```

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

## Building Locally

```bash
docker build -t maxwells-wallet .
docker run -d -p 3000:3000 -p 3001:3001 maxwells-wallet
```
