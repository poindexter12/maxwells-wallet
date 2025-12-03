# Future Enhancements

Ideas for future versions beyond v0.

## High Priority

### Advanced Visualizations
- ✅ ~~Custom dashboard widgets~~ - Implemented v0.5 (PR #25)
- ✅ ~~Configurable widget visibility/order~~ - Implemented v0.5 (PR #25)
- ✅ ~~More chart types (sankey, treemap, heatmaps)~~ - Implemented v0.6 (PR #26)
- Data drill-down (click chart to filter transactions)
- Interactive filters on charts
- Dashboard year/month view toggle (default: month, with year summary)
- Widget tag filtering (filter widget data by selected tags)

### Observability & Monitoring
- OpenTelemetry integration for distributed tracing
- Metrics export (Prometheus format for Grafana)
- Developer dashboard with system health
- Request timing and slow query detection
- Error rate monitoring
- Optional Grafana stack integration

### Performance Optimization
- Database query optimization
- Caching layer (Redis for reports/aggregations)
- Database indexes review and optimization
- Pagination improvements (cursor-based)
- Lazy loading for large datasets
- Query analysis and N+1 detection

### Scheduled Reports & Automation
- Scheduled email reports (daily/weekly/monthly summaries)
- Email digests with spending alerts
- Webhook notifications for budget thresholds
- Custom report templates
- PDF report generation

## Medium Priority

### Improved Analytics
- ✅ ~~Compare time periods (this month vs last month)~~ - Implemented v0.2
- ✅ ~~Spending velocity (daily average)~~ - Implemented v0.2
- ✅ ~~Anomaly detection (unusual spending)~~ - Implemented v0.2
- Customizable date ranges for all reports
- Year-over-year comparison
- Forecast future spending based on trends
- Advanced statistical analysis (regression, predictions)

### Categories Improvements
- ✅ ~~Split transactions~~ - Implemented v0.5 (PR #25)
- ✅ ~~Category rules engine (basic)~~ - Implemented v0.3
- Subcategories (nested categories)
- **Advanced Rules Engine Enhancements**:
  - Fuzzy merchant matching with rapidfuzz (handles typos/variations)
  - Time-based rules (weekday, time of day)
  - Composite conditions (nested AND/OR logic)
- Category goals

### Data Export/Import
- Export all data to CSV/JSON
- Import from other finance apps (Mint, YNAB, etc.)
- Backup/restore functionality
- Data portability

### Budget Tracking Enhancements
- ✅ ~~Set monthly budgets per bucket, occasion, or account~~ - Implemented v0.3
- ✅ ~~Track actual vs budget with status indicators~~ - Implemented v0.3
- ✅ ~~Alert when approaching budget limit (80%/100% thresholds)~~ - Implemented v0.3
- Rollover unused budget (field exists, logic pending)
- Yearly budget planning view

### UX Improvements
- Keyboard shortcuts
- Dark mode improvements
- Customizable themes
- Accessibility improvements (WCAG compliance)
- Onboarding tutorial
- In-app help documentation

## Low Priority

### Mobile App
- React Native or Progressive Web App
- Mobile-optimized UI
- Push notifications

### Bank Integration
- Plaid integration for automatic transaction sync
- Real-time balance updates
- Automatic daily imports

### API & Integrations
- Public API for third-party apps
- Webhooks for external systems
- Export to Google Sheets

### Investment Tracking
- Link to investment accounts
- Track portfolio performance
- Dividend/interest tracking

## Future Considerations

These features are interesting but not currently prioritized:

### Multi-Bank Support
- Add parsers for more banks (Chase, Wells Fargo, Citi, etc.)
- Generic CSV mapper for custom formats
- Bank-specific merchant cleaning rules

### Receipt Management
- Upload receipt images
- OCR to extract amount/merchant
- Link receipts to transactions
- Cloud storage integration

### Tax Features
- Mark transactions as tax-deductible
- Generate tax reports
- Export for TurboTax/TaxAct
- Business expense tracking

### Bill Management
- Track upcoming bills
- Bill payment reminders
- Mark bills as paid
- Recurring bill templates

### AI/ML Features
- Smart categorization using ML
- Spending predictions
- Financial advice suggestions
- Natural language queries ("show me coffee spending last month")

### Gamification
- Savings goals with progress bars
- Achievements/badges
- Spending challenges

### Financial Planning
- Retirement planning calculator
- Debt payoff calculator
- Net worth tracking
- Financial health score

---

## Completed Features

### v0.1 ✅ (Completed)
- Basic transaction import (BOFA, AMEX)
- Manual categorization
- Simple reporting
- Reconciliation workflow

### v0.2 ✅ (Completed - 2025-11-27)
- Advanced analytics (month-over-month, spending velocity, anomaly detection)
- Enhanced dashboard with insights
- Comprehensive test suite

### v0.3 ✅ (Completed - 2025-11-28)
- Budget tracking (monthly/yearly limits, status monitoring)
- Recurring transaction detection (statistical pattern detection)
- Category rules engine (pattern-based auto-categorization)

### v0.4 ✅ (Completed - 2025-12-01)
- Multi-File Import - Batch upload multiple CSVs at once
- Transaction Hashing - Content-based deduplication
- Multi-Namespace Budgets - Budgets for buckets, occasions, and accounts
- Transfer Detection - Auto-detect CC payments, internal transfers
- Merchant Aliases - Map variations to canonical names
- Additional Account Types - Venmo, HSA import formats
- Extensible CSV Parser - Strategy pattern for easy new format addition
- Dashboard Month Selector - Navigate historical months
- Docker Support - Containerized deployment

### v0.5 ✅ (Completed - 2025-12-02)
- Quicken Import - QIF/QFX/OFX file import support
- Credit Card Account Support - Due dates, credit limits, account summary
- Advanced Search - Notes search, regex support, saved filters, CSV export
- Split Transactions - Allocate transactions across multiple buckets
- Customizable Dashboard - Show/hide and reorder widgets
- Nightly Code Quality - Vulture, ruff, mypy, pip-audit automation

### v0.6 (In Progress)
- ✅ Advanced visualizations (sankey, treemap, heatmaps) - PR #26
- ✅ Dashboard year/month view toggle - PR #27
- ✅ Widget tag filtering - PR #28
- Scheduled reports & email digests

### v0.7 (Planned)
- Observability & OpenTelemetry integration
- Performance optimization
