# Maxwell's Wallet

[![CI](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml/badge.svg)](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/poindexter12/maxwells-wallet/graph/badge.svg)](https://codecov.io/gh/poindexter12/maxwells-wallet)
[![Release](https://img.shields.io/github/v/release/poindexter12/maxwells-wallet?label=release)](https://github.com/poindexter12/maxwells-wallet/releases)
[![Python](https://img.shields.io/badge/python-3.11+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ed?logo=docker&logoColor=white)](https://github.com/poindexter12/maxwells-wallet/pkgs/container/maxwells-wallet)

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

**[Documentation](https://docs.maxwellswallet.com)** · **[Requirements](docs/requirements/)**

## What's New in v0.6

- **Multi-Dashboard Support** - Create multiple dashboards with different layouts and filters
- **Advanced Visualizations** - Sankey diagrams, treemaps, and calendar heatmaps
- **Dashboard Year/Month Toggle** - Switch between monthly and yearly views
- **Widget Filtering** - Filter individual widgets by bucket, account, or merchant
- **Improved Duplicate Detection** - Cross-account duplicate warnings during import

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

## Quick Start

### Docker (Recommended)

```bash
docker compose up -d
# Open http://localhost:3000
```

Data persists in a Docker volume. For a custom location:

```bash
docker run -d -p 3000:3000 -p 8000:8000 -v /path/to/data:/data maxwells-wallet
```

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

## License

Private prototype - not for redistribution
