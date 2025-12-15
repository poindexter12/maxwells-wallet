# Maxwell's Wallet

[![CI](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml/badge.svg)](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/poindexter12/maxwells-wallet/graph/badge.svg)](https://codecov.io/gh/poindexter12/maxwells-wallet)
[![Release](https://img.shields.io/github/v/release/poindexter12/maxwells-wallet?label=release)](https://github.com/poindexter12/maxwells-wallet/releases)
[![Python](https://img.shields.io/badge/python-3.11+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ed?logo=docker&logoColor=white)](https://github.com/poindexter12/maxwells-wallet/pkgs/container/maxwells-wallet)
[![Crowdin](https://badges.crowdin.net/maxwells-wallet/localized.svg)](https://crowdin.com/project/maxwells-wallet)

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

**[Documentation](https://docs.maxwellswallet.com)** · **[Requirements](docs/requirements/)**

## What's New in v0.9

### Internationalization (i18n)
- **Multi-language Support** - Complete i18n infrastructure with next-intl
- **9 Locales** - English (US/UK), Spanish, French, Italian, Portuguese, German, Dutch, pseudo (l33t speak for QA)
- **Full Translations** - All locales professionally translated (beta4)
- **Crowdin Integration** - Translation management with CLI commands
- **Structured Error Codes** - API errors include machine-readable codes for frontend translation
- **Widget Translations** - All dashboard widgets fully translated

### Developer Experience
- **Node.js 22 LTS** - Pinned via `.nvmrc` with auto-install support
- **TypeScript Improvements** - Stricter types, removed `any` usage in widget components
- **Translation Testing** - Automated tests ensure translation completeness
- **Dependabot** - Automated dependency updates (beta4)
- **Auto Migrations** - Database migrations run on startup (beta4)

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
docker compose -f docker-compose.demo.yaml up -d
docker compose -f docker-compose.demo.yaml run --rm maxwells-wallet demo-setup

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

Private prototype - not for redistribution
