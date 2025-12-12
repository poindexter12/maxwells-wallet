# Changelog

All notable changes to Maxwell's Wallet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0-beta4] - 2025-12-11

### Added
- **Complete Translations** - All 7 locales fully translated
  - German (de-DE), Dutch (nl-NL), Spanish (es-ES), French (fr-FR)
  - Italian (it-IT), Portuguese (pt-PT), British English (en-GB)
- **Crowdin Integration** - Professional translation management
  - `make translate-upload` and `make translate-download` commands
  - Crowdin CLI configured for automated sync
- **Dependabot** - Automated dependency updates with grouped PRs
- **MIT License** - Project now open source under MIT license

### Changed
- **Auto Database Migrations** - Migrations run automatically on `make backend` startup
- **BCP 47 Locale Codes** - Standardized locale naming (e.g., `en-GB` not `en-gb`)
- **AI Config Consolidation** - Unified under `.claude/` directory

### Fixed
- **Docker Build** - Added @swc/helpers to resolve peer dependency issues

## [0.9.0-beta3] - 2025-12-11

### Changed
- **Locale-Aware Formatting** - Currency and date formatting now respects user's locale
  - New `useFormat` hook provides locale-aware formatters
  - Compact currency format for charts (e.g., "$1.2K")
  - Short weekday/month names from locale
- **Widget Titles Removed** - Widget display names now come from i18n translations
  - `title` field removed from widget model
  - Simplifies widget management and ensures consistent translations
  - Database migration drops `title` column

### Fixed
- **Pseudo-locale Generator** - Handles placeholder-only strings correctly
- **E2E Tests** - Import page test more robust for i18n

## [0.9.0-beta] - 2025-12-10

### Added

#### Internationalization (i18n)
- **Multi-language Support** - Complete i18n infrastructure with next-intl
  - Language switcher in settings (Auto/English/l33t speak)
  - All UI strings externalized to message files
  - l33t speak translation for testing/fun
- **Structured Error Codes** - API errors now include machine-readable codes
  - `error_code` field for frontend translation lookup
  - `context` field for dynamic interpolation (e.g., `{count}` placeholders)
  - All 40+ error types documented with unique codes
- **Translation Coverage Test** - Automated test ensures all locales have complete translations
- **Widget Translations** - All dashboard widgets (charts, velocity, anomalies, etc.) fully i18n-enabled

### Changed
- **Node.js Version** - Pinned to LTS v22 via `.nvmrc`
  - `make check-node` target auto-installs via nvm if needed
  - Fixes deprecation warnings from Node 25

### Fixed
- **Dashboard Widget Performance** - Removed lazy widget creation from GET endpoints
  - Widgets now initialized at dashboard creation time only
  - Eliminates INSERT queries during read operations

## [0.8.0] - 2025-12-09

### Added

#### Observability
- **OpenTelemetry Tracing** - Automatic span creation for all FastAPI requests
  - SQLAlchemy query tracing with SQL comments
  - Custom `@traced()` decorator for business logic spans
- **Prometheus Metrics** - `/metrics` endpoint in Prometheus format
  - Request latency histograms (p50, p95, p99)
  - Error rate counters and active request gauges
  - Database query timing
- **Health Dashboard** - New "Health" tab in Admin UI
  - Real-time latency percentiles and error rates
  - System status indicator (healthy/degraded/unhealthy)
  - Auto-refresh every 10 seconds
- **Alerting** - Configurable webhook notifications for error rate and latency thresholds

#### Performance
- **Virtual Scrolling** - TanStack Virtual for efficient rendering of 50k+ transactions
- **Cursor Pagination** - O(1) performance regardless of scroll depth
- **Composite Indexes** - Optimized database indexes for common query patterns
- **Performance Testing** - Stress test infrastructure with 50k transaction dataset

#### Testing & Quality
- **Chaos/Monkey Testing** - Automated random interaction testing for UI stability
  - Seeded random actions for reproducible tests
  - CHAOS_EXCLUDED_IDS to protect destructive buttons
- **ESLint 9 Flat Config** - Updated to Next.js 16 ESLint configuration
- **CI Improvements** - Linting and performance tests on all PRs

### Configuration
New environment variables (all optional, observability enabled by default):
- `OTEL_ENABLED` - Master toggle for observability
- `OTEL_TRACING_ENABLED` - OpenTelemetry tracing
- `OTEL_METRICS_ENABLED` - Prometheus metrics
- `OTEL_LOG_FORMAT` - json or console
- `OTEL_SLOW_QUERY_THRESHOLD_MS` - Slow query logging threshold
- `OTEL_ALERT_WEBHOOK_URL` - Webhook URL for alerts

## [0.7.0] - 2025-12-05

### Added
- **CSV Auto-Detection** - Automatically detect CSV format when importing transactions
- **E2E Testing** - Full end-to-end test suite with Playwright
- **Seed Script** - Database seeding for E2E testing

### Changed
- **Frontend Refactoring** - Major component extraction for maintainability
  - Dashboard widgets extracted into separate components
  - Tools page split into 4 panel components
  - Transactions page components extracted
- **Developer Experience** - Centralized AI config in `.waypoint/` with multi-editor support
- Migrated roadmap to GitHub Discussions

## [0.6.1] - 2025-12-03

### Changed
- Release 0.6.1

## [0.6.0] - 2025-12-03

### Added
- add dual-hash deduplication for cross-account detection (#48)
- add widget bucket tag filtering (#28)
- dashboard year/month view toggle (#27)
- add advanced visualization widgets (Sankey, Treemap, Heatmap) (#26)
- add split transactions and customizable dashboard (#25)

### Changed
- test: add comprehensive router tests, configure codecov (#24)
## [0.6.0] - 2025-12-03

### Added
- **Multi-Dashboard Support** - Create multiple named dashboards with different layouts and filters
  - Dashboard sidebar for quick switching between dashboards
  - Clone, delete, and set default dashboard
  - Per-dashboard date defaults (month/year view mode)
  - Dashboard-level filters (bucket/account/merchant)
- **Advanced Visualizations** - New chart types for deeper spending insights (#26)
  - Sankey diagram showing money flow from income to spending categories
  - Treemap for hierarchical spending breakdown
  - Calendar heatmap showing daily spending patterns
- **Dashboard Year/Month Toggle** - Switch between monthly and yearly view modes (#27)
- **Widget Tag Filtering** - Filter individual widgets by bucket, account, or merchant (#28)
- **Dual-Hash Deduplication** - Improved duplicate detection across accounts
  - Cross-account duplicate warnings during import
  - Detects same transaction imported to different accounts
- **Required Account Selection** - Import now requires account selection for reliable deduplication
  - Dropdown of existing accounts with option to create new
  - Clear validation and warning messages

### Changed
- Dashboard widgets now belong to specific dashboards (migration preserves existing widgets)
- Import page UX improved with account dropdown and validation

## [0.5.0] - 2025-12-02

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
- **Split Transactions** - Allocate transactions across multiple buckets
- **Customizable Dashboard** - Show/hide and reorder widgets

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
