# Maxwell's Wallet

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

[![CI](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml/badge.svg)](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/poindexter12/maxwells-wallet?label=release)](https://github.com/poindexter12/maxwells-wallet/releases)

## Features

### Import & Data Management
- **Multi-Format Import**: Bank of America, American Express, Venmo, Inspira HSA, Quicken QIF/QFX/OFX
- **Batch Import**: Upload multiple files with cross-file duplicate detection
- **Smart Categorization**: Auto-categorize using keyword matching and learning
- **Merchant Aliases**: Normalize messy bank merchant names
- **Transfer Detection**: Auto-identify internal transfers

### Budgeting & Analysis
- **Budget Tracking**: Set monthly/yearly limits with alerts at 80%/100%
- **Recurring Detection**: Identify subscriptions with predictions
- **Anomaly Detection**: Flag unusual purchases and budget leaks
- **Month-over-Month**: Track spending changes by category
- **Daily Burn Rate**: Know early if you're on track to overspend

### Search & Filtering
- **Quick Filters**: One-click for This Month, Last Month, Large, Unreconciled
- **Saved Filters**: Save and reuse complex filter combinations
- **CSV Export**: Export filtered transactions
- **Dynamic Thresholds**: "Large" personalized to your spending

## Quick Start

```bash
# Using Docker (recommended)
docker compose up -d
# Open http://localhost:3000

# Using Make (development)
make setup
make dev
```

## Links

- [GitHub Repository](https://github.com/poindexter12/maxwells-wallet)
- [API Documentation](/api/overview/)
- [Docker Hub](https://github.com/poindexter12/maxwells-wallet/pkgs/container/maxwells-wallet)
