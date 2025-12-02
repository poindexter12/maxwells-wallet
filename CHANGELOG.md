# Changelog

All notable changes to Maxwell's Wallet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
