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
  -p 3000:3000 -p 3001:3001 \
  -v /path/to/your/data:/data \
  ghcr.io/poindexter12/maxwells-wallet
```

The app serves the frontend on port `3000` and the backend API on port `3001`.

## Using Just (Development)

```bash
# First-time setup
just setup

# Start development servers
just dev::dev

# Open http://localhost:3000
```

## First Steps

1. **Create account**: On first launch, you'll be redirected to `/setup` to create your username and password (see [Authentication](authentication.md))
2. **Import transactions**: Go to the Import page and upload a CSV, QIF, or QFX file
3. **Categorize**: Assign bucket tags to organize your spending
4. **Set budgets**: Create spending limits on the Budgets page
5. **Review insights**: Check the Dashboard for anomalies and trends

## Demo Mode

Try Maxwell's Wallet without committing your own data. Demo mode seeds sample
transactions, blocks destructive actions, and resets on a schedule.

```bash
# Build from source and start in demo mode
just docker::with-demo
```

The first time you start a demo instance, create an account at `/setup` like any
other install, then seed the demo data. With the published image:

```bash
docker compose -f docker-compose.demo.yaml up -d
docker compose -f docker-compose.demo.yaml run --rm maxwells-wallet demo-setup
```

## Supported Import Formats

| Format | Source |
|--------|--------|
| CSV | Bank of America, American Express, Venmo, Inspira HSA |
| QIF | Quicken, Microsoft Money |
| QFX/OFX | Quicken Financial Exchange |

The format is auto-detected, but you can override if needed.
