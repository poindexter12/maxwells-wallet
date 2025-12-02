# Quick Start

Get Maxwell's Wallet running in minutes.

## Using Docker (Recommended)

```bash
# Build and run
docker compose up -d

# Open http://localhost:3000
```

Your data is persisted in a Docker volume. To use a custom location:

```bash
docker run -d \
  -p 3000:3000 -p 8000:8000 \
  -v /path/to/your/data:/data \
  ghcr.io/poindexter12/maxwells-wallet
```

## Using Make (Development)

```bash
# First-time setup
make setup

# Start development servers
make dev

# Open http://localhost:3000
```

## First Steps

1. **Import transactions**: Go to the Import page and upload a CSV, QIF, or QFX file
2. **Categorize**: Assign bucket tags to organize your spending
3. **Set budgets**: Create spending limits on the Budgets page
4. **Review insights**: Check the Dashboard for anomalies and trends

## Supported Import Formats

| Format | Source |
|--------|--------|
| CSV | Bank of America, American Express, Venmo, Inspira HSA |
| QIF | Quicken, Microsoft Money |
| QFX/OFX | Quicken Financial Exchange |

The format is auto-detected, but you can override if needed.
