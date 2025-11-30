# Changelog

All notable changes to Maxwell's Wallet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-30

### Added

#### Transfer Detection
- Pattern-based detection of internal transfers (autopay, ACH, PayPal, wire transfers)
- Mark/unmark transactions as transfers to exclude from spending calculations
- Link transfer pairs bidirectionally between accounts
- Transfer statistics (count, total, linked pairs)

#### Merchant Aliases
- Normalize messy bank merchant names (e.g., "AMZN*ABC123" → "Amazon")
- Three match types: exact, contains, regex
- Priority-based alias resolution when multiple patterns match
- Preview/dry-run mode before applying changes
- Automatic application during CSV import
- Match count and last-matched tracking

#### Navigation Reorganization
- New **Organize** page consolidating:
  - Buckets (spending categories)
  - Occasions (special events)
  - Accounts (bank accounts)
- New **Tools** page consolidating:
  - Transfers (detection and marking)
  - Rules (auto-categorization)
  - Merchants (alias management)
- Streamlined 6-item navigation: Dashboard, Transactions, Budgets, Organize, Tools, Admin

#### In-App Help
- Added PageHelp component to Organize page
- Added PageHelp component to Tools page

### Changed
- Removed standalone Buckets, Occasions, and Accounts pages (now in Organize)
- Removed standalone Transfers and Rules pages (now in Tools)
- Moved Merchant aliases from Admin to Tools (better fit with pattern-based features)

### Fixed
- Merchant alias apply now uses explicit SQL UPDATE statements for reliable persistence
- Fixed async SQLAlchemy object tracking issue that prevented alias changes from saving

### Technical
- Added comprehensive test suite for merchant aliases (20 tests)
- Added comprehensive test suite for transfer detection (15 tests)
- All existing tests continue to pass

---

## Previous Versions

### v0.3 - Smart Budgeting & Automation
- Budget tracking with multi-namespace support
- Tag rules engine for auto-categorization
- Recurring transaction detection

### v0.2 - Advanced Analytics
- Month-over-month comparison
- Daily burn rate and projections
- Anomaly detection

### v0.1 (Initial) - Core Features
- CSV import (Bank of America, American Express)
- Smart categorization
- Dashboard with charts
- Transaction management
- Reconciliation workflow
