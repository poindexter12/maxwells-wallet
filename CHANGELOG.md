# Changelog

All notable changes to Maxwell's Wallet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-12-02

### Added
- add advanced search with saved filters and CSV export (#21)
- add credit card account summary with due dates and limits (#20)
- add Quicken QIF and QFX/OFX import support (#19)

### Changed
- Refactor: Split Makefile into modular components (#18)
## [Unreleased]

### Added
- **Credit card account support** - Track credit cards with due dates, credit limits, and available credit (#20)
- **Quicken QIF/QFX import** - Import from Quicken, Microsoft Money, and other OFX-compatible software (#19)
- Credit card summary widget showing balances, due dates, and utilization
- **Advanced search** - Filter transactions by text, date ranges, amounts, and tags (#21)
- **Saved filters** - Save and reuse complex filter combinations
- **CSV export** - Export filtered transactions to CSV
- **Quick filter buttons** - One-click filters for common queries (This Month, Last Month, Large, Unreconciled)
- **Dynamic large transaction threshold** - "Large" is calculated per-user based on spending history (2σ above average)
- **Clickable anomaly links** - Dashboard anomaly counts link directly to filtered transactions

### Changed
- Refactored Makefile into modular components under `make/` directory (#18)

## [0.4.4] - 2025-12-01

### Added
- add automated release workflow

### Fixed
- make release shows usage without error
## [0.4.3] - 2025-12-01

### Fixed
- Release workflow now builds single AIO image instead of separate frontend/backend

## [0.4.2] - 2025-12-01

### Fixed
- Fixed frontend Docker build by adding missing public directory

## [0.4.1] - 2025-12-01

### Added
- Docker images now published to GitHub Container Registry on release

## [0.4.0] - 2025-12-01

### Added
- **Multi-file batch import** - Upload multiple CSV files at once with cross-file duplicate detection (#7)
- **Transaction hashing** - Content-based SHA256 hashing for reliable deduplication
- **Multi-namespace budgets** - Set budgets for buckets, occasions, and accounts (#10)
- **Transfer detection** - Auto-detect and mark internal transfers (CC payments, bank transfers) with UI controls (#11, #16)
- **Merchant aliases** - Map merchant name variations to canonical names (#12)
- **Venmo import** - Parse Venmo transaction CSV exports (#14)
- **Inspira HSA import** - Parse Inspira HSA transaction exports (#14)
- **Dashboard month selector** - Navigate to view historical months (#16)
- **Docker support** - Containerized deployment with docker-compose (#13)
- **Extensible CSV parser** - Strategy pattern for easy addition of new formats (#15)

### Fixed
- Account tags now correctly appear in transaction dropdowns (#17)

## [0.3.0] - 2025-11-28

### Added
- Budget tracking with monthly/yearly limits and status monitoring
- Recurring transaction detection using statistical pattern analysis
- Category rules engine for pattern-based auto-categorization

## [0.2.0] - 2025-11-27

### Added
- Advanced analytics (month-over-month comparison, spending velocity)
- Anomaly detection for unusual spending patterns
- Enhanced dashboard with insights

## [0.1.0] - 2025-11-25

### Added
- Basic transaction import (Bank of America, American Express CSV)
- Manual categorization with bucket tags
- Simple reporting and spending summaries
- Reconciliation workflow for verifying imports
