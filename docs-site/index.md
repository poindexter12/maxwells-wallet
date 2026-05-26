# Maxwell's Wallet

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

[![CI](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yaml/badge.svg)](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yaml)
[![Release](https://img.shields.io/github/v/release/poindexter12/maxwells-wallet?label=release)](https://github.com/poindexter12/maxwells-wallet/releases)

## What's New in 1.3.0

### AI Assistant
- **Natural-Language Assistant** - Ask about your finances and propose changes in plain language; reads run automatically while writes require explicit approval. See the [Assistant](features/assistant.md) guide.

### Foundations
- **Single-User Auth** - Password protection with JWT tokens and a first-run `/setup` flow. See [Authentication](getting-started/authentication.md).
- **SQLAlchemy 2.0** - ORM built on SQLAlchemy 2.0 + Pydantic for type safety and performance
- **Demo Mode** - Public demo instances with restricted operations and auto-reset
- **Backup System** - SQLite backup/restore with GFS retention and scheduled backups
- **10 Locales** - Full i18n support (managed via Crowdin) with locale-aware date and currency formatting

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

### AI Assistant & Security
- **AI Assistant**: Ask questions about your spending in plain language; writes require approval
- **Single-User Auth**: Password-protected access with JWT sessions and first-run setup

## Quick Start

```bash
# Using Docker (recommended)
docker compose up -d
# Open http://localhost:3000

# Using Just (development)
just setup
just dev::dev
```

## Links

- [GitHub Repository](https://github.com/poindexter12/maxwells-wallet)
- [API Documentation](/api/overview/)
- [Docker Image](https://github.com/poindexter12/maxwells-wallet/pkgs/container/maxwells-wallet)
