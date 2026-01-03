# Maxwell's Wallet

[![CI](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yaml/badge.svg)](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/poindexter12/maxwells-wallet/graph/badge.svg)](https://codecov.io/gh/poindexter12/maxwells-wallet)
[![Release](https://img.shields.io/github/v/release/poindexter12/maxwells-wallet?label=release)](https://github.com/poindexter12/maxwells-wallet/releases)
[![Python](https://img.shields.io/badge/python-3.11+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ed?logo=docker&logoColor=white)](https://github.com/poindexter12/maxwells-wallet/pkgs/container/maxwells-wallet)
[![Crowdin](https://badges.crowdin.net/maxwells-wallet/localized.svg)](https://crowdin.com/project/maxwells-wallet)

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

**[Documentation](https://docs.maxwellswallet.com)** · **[Requirements](docs/requirements/)**

## What's New in v0.11

### SQLAlchemy 2.0 Migration
- **ORM Upgrade** - Migrated from SQLModel to SQLAlchemy 2.0 + Pydantic for improved type safety and performance

### Performance & Stability
- **Transactions Page** - Debouncing and request cancellation prevent UI lag during rapid filtering
- **Chaos Tests** - Viewport-based demon mode interactions for reliable stress testing
- **Docker Builds** - Skip devDependencies to avoid flaky downloads

See [CHANGELOG.md](CHANGELOG.md) for full release history.

## Features

### Import & Data Management
- **Multi-Format Import**: Bank of America, American Express, Venmo, Inspira HSA, Quicken QIF/QFX/OFX
- **Batch Import**: Upload multiple files with cross-file duplicate detection
- **Smart Categorization**: Auto-categorize using keyword matching and learning from past choices
- **Merchant Aliases**: Normalize messy bank merchant names to clean, consistent names
- **Transfer Detection**: Auto-identify internal transfers (CC payments, bank transfers)

### Budgeting & Analysis
- **Budget Tracking**: Set monthly/yearly limits for buckets, occasions, or accounts
- **Recurring Detection**: Identify subscriptions with upcoming payment predictions
- **Anomaly Detection**: Flag unusual purchases, new merchants, and budget leaks
- **Month-over-Month**: Track spending changes with category-level breakdown
- **Daily Burn Rate**: Know early if you're on track to overspend

### Search & Filtering
- **Quick Filters**: One-click buttons for This Month, Last Month, Large, Unreconciled
- **Saved Filters**: Save and reuse complex filter combinations
- **CSV Export**: Export filtered transactions for external analysis
- **Dynamic Thresholds**: "Large" is personalized based on your spending patterns

### Account Management
- **Multi-Account Support**: Checking, savings, and credit card accounts
- **Credit Card Tracking**: Due dates, credit limits, available credit, utilization %
- **Category Rules**: Automate categorization with pattern-based rules

### Security
- **Single-User Authentication**: Password-protected access
- **JWT Tokens**: Secure session management with configurable expiry
- **Password Management**: Change in UI or reset via CLI

## Authentication

On first launch, you'll be prompted to create an account. After setup, all access requires authentication.

### First-Run Setup
1. Navigate to the app - you'll be redirected to `/setup`
2. Create your username and password
3. You're automatically logged in

### Password Reset (CLI)

If you forget your password, use the CLI to reset it:

```bash
# Running container
docker compose exec app reset-password <username> <new_password>

# Or start a new container
docker compose run --rm app reset-password <username> <new_password>
```

### Configuration

Set `SECRET_KEY` in production for JWT signing (defaults to dev key):

```bash
docker run -d -p 3000:3000 -p 3001:3001 \
  -e SECRET_KEY="your-secure-random-string" \
  -v /path/to/data:/data \
  ghcr.io/poindexter12/maxwells-wallet
```

## Installation

### Docker (Recommended)

```bash
# Quick start - pulls latest published image
docker compose up -d
# Open http://localhost:3000
```

Data persists in a Docker volume. For custom configurations, see below.

#### Compose Files

| Compose File | Description | Image Source |
|-------------|-------------|--------------|
| `docker-compose.yaml` | Quick start for end users | Pulls from registry |
| `docker-compose.dev.yaml` | Development/CI builds | Builds from source |
| `docker-compose.demo.yaml` | Demo mode with resets | Pulls from registry |

```bash
# Demo mode (sample data, periodic resets)
make docker-with-demo
# Login: maxwell / wallet

# Build from source (development)
docker compose -f docker-compose.dev.yaml build
docker compose -f docker-compose.dev.yaml up -d
```

#### Custom Data Location

```bash
docker run -d -p 3000:3000 -p 3001:3001 \
  -v /path/to/your/data:/data \
  ghcr.io/poindexter12/maxwells-wallet
```

See [Installation Guide](docs/installation.md) for complete Docker configuration options.

### Development

#### VS Code Devcontainer (Recommended)

Open this repository in VS Code and click "Reopen in Container" when prompted. This provides a fully configured development environment with all dependencies pre-installed.

[![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/poindexter12/maxwells-wallet)

#### Local Setup

```bash
make setup    # First-time setup
make dev      # Start servers
# Open http://localhost:3000
```

```bash
make help     # Show all commands
```

## Usage

1. **Import** - Upload CSV/QIF/QFX files from your bank
2. **Reconcile** - Review and categorize transactions
3. **Dashboard** - View spending summaries, charts, and trends

## Documentation

Full documentation is available at **[docs.maxwellswallet.com](https://docs.maxwellswallet.com)**:

- [Getting Started](https://docs.maxwellswallet.com/getting-started/quickstart/)
- [Features Guide](https://docs.maxwellswallet.com/features/import/)
- [API Reference](https://docs.maxwellswallet.com/api/overview/)
- [Developer Guide](https://docs.maxwellswallet.com/developer/architecture/)

## Roadmap

See [GitHub Discussions - Ideas](https://github.com/poindexter12/maxwells-wallet/discussions/categories/ideas) for planned features. Vote and comment on the features you want!

## License

[MIT License](LICENSE) - see LICENSE file for details.
