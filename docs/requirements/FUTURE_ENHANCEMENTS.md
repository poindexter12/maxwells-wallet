# Future Enhancements

Ideas for future versions beyond v0.

## High Priority

### Multi-Bank Support
- Add parsers for more banks (Chase, Wells Fargo, Citi, etc.)
- Generic CSV mapper for custom formats
- Auto-detect more format types
- Bank-specific merchant cleaning rules

### Budget Tracking ✅ (Completed v0.3)
- ✅ Set monthly budgets per bucket, occasion, or account
- ✅ Track actual vs budget with status indicators
- ✅ Alert when approaching budget limit (80%/100% thresholds)
- Rollover unused budget (field exists, logic pending)
- Yearly budget planning (yearly period supported, yearly status endpoint pending)

### Recurring Transactions ✅ (Completed v0.3)
- ✅ Detect recurring patterns (subscriptions, bills)
- ✅ Mark transactions as recurring
- ✅ Predict future recurring transactions
- ✅ Alert on missing expected transactions

### Receipt Management
- Upload receipt images
- OCR to extract amount/merchant
- Link receipts to transactions
- Store in cloud storage

### Advanced Search
- Full-text search
- Save search filters as "views"
- Export search results
- Regex pattern matching

## Medium Priority

### Mobile App
- React Native or Progressive Web App
- Mobile-optimized UI
- Photo receipt capture
- Push notifications

### Improved Analytics
- ✅ ~~Compare time periods (this month vs last month)~~ - Implemented v0.2
- ✅ ~~Spending velocity (daily average)~~ - Implemented v0.2
- ✅ ~~Anomaly detection (unusual spending)~~ - Implemented v0.2
- Customizable date ranges
- Year-over-year comparison
- Forecast future spending based on trends
- Advanced statistical analysis (regression, predictions)

### Categories Improvements
- Subcategories (nested categories)
- Multiple categories per transaction (split transactions)
- ✅ ~~Category rules engine (basic)~~ - Implemented v0.3
- **Advanced Rules Engine Enhancements** (future):
  - Switch to python-business-rules for more powerful declarative rules
  - Fuzzy merchant matching with rapidfuzz (handles typos/variations)
  - Regex pattern support for complex matching
  - Time-based rules (weekday, time of day)
  - Composite conditions (nested AND/OR logic)
- Category budgets (see Budget Tracking - implemented v0.3)
- Category goals

### Bank Integration
- Plaid integration for automatic transaction sync
- Real-time balance updates
- Automatic daily imports
- Bank account linking

### Data Export/Import
- Export all data to CSV/JSON
- Import from other finance apps (Mint, YNAB, etc.)
- Backup/restore functionality
- Data portability

## Low Priority

### Tax Features
- Mark transactions as tax-deductible
- Generate tax reports
- Export for TurboTax/TaxAct
- 1099 income tracking
- Business expense tracking

### Investment Tracking
- Link to investment accounts
- Track portfolio performance
- Dividend/interest tracking
- Capital gains calculation

### Bill Management
- Track upcoming bills
- Bill payment reminders
- Mark bills as paid
- Recurring bill templates

### Advanced Visualizations
- Custom dashboard widgets
- Drag-and-drop dashboard builder
- More chart types (sankey, treemap, etc.)
- Data drill-down
- Interactive filters

### Automation & Rules
- Auto-categorization rules engine
- Custom workflows
- If-this-then-that rules
- Scheduled reports
- Email digests

### API & Integrations
- Public API for third-party apps
- Webhooks
- Zapier integration
- IFTTT integration
- Export to Google Sheets

### Advanced Features
- Split transactions
- Transfer detection (automatically mark internal transfers)
- Merchant aliases (map multiple merchant names to one)
- Custom fields per transaction
- Tags/labels
- Notes and attachments
- Transaction comments
- Audit log

## Technical Improvements

### Performance
- Database query optimization
- Caching layer (Redis)
- Database indexes review
- Pagination improvements
- Lazy loading

### Security
- Audit logging
- Data encryption at rest
- Rate limiting

### DevOps
- CI/CD pipeline
- Automated testing
- Docker containers
- Error tracking (Sentry)

### UX Improvements
- Keyboard shortcuts
- Dark mode
- Customizable themes
- Accessibility improvements (WCAG compliance)
- Onboarding tutorial
- Help documentation
- In-app chat support

### Developer Experience
- API documentation (Swagger/OpenAPI)
- Plugin system

## Ideas for Consideration

### AI/ML Features
- Smart categorization using ML
- Anomaly detection
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
- Savings goal tracker
- Net worth tracking
- Financial health score

### Smart Notifications
- Unusual spending alerts
- Budget warnings
- Bill due reminders
- Low balance alerts
- Duplicate transaction warnings

### Integrations
- Credit score tracking (Credit Karma API)
- Cryptocurrency tracking
- Venmo/PayPal integration
- Amazon purchase import
- Subscription tracking (Truebill-like)

## Version Roadmap

### v0.1 ✅ (Completed)
- Basic transaction import (BOFA, AMEX)
- Manual categorization
- Simple reporting
- Reconciliation workflow

### v0.2 ✅ (Completed - 2025-11-27)
- ✅ Advanced analytics (month-over-month, spending velocity, anomaly detection)
- ✅ Enhanced dashboard with insights
- ✅ Comprehensive test suite (24/26 tests passing)

### v0.3 ✅ (Completed - 2025-11-28)
- ✅ Budget tracking (monthly/yearly limits, status monitoring)
- ✅ Recurring transaction detection (statistical pattern detection)
- ✅ Category rules engine (pattern-based auto-categorization)

### v0.4 ✅ (Completed - 2025-12-01)

1. ✅ **Multi-File Import** - Batch upload multiple CSVs at once (PR #7)
2. ✅ **Transaction Hashing** - Content-based deduplication for reliable import
3. ✅ **Multi-Namespace Budgets** - Budgets for buckets, occasions, and accounts (PR #10)
4. ✅ **Transfer Detection** - Auto-detect CC payments, internal transfers (PR #11, #16)
5. ✅ **Merchant Aliases** - Map variations to canonical names (PR #12)
6. ✅ **Additional Account Types** - Venmo, HSA import formats (PR #14)
7. ✅ **Extensible CSV Parser** - Strategy pattern for easy new format addition (PR #15)
8. ✅ **Dashboard Month Selector** - Navigate historical months (PR #16)
9. ✅ **Docker Support** - Containerized deployment (PR #13)

### v0.5+ (Future Ideas)
- Bank integration (Plaid) for automatic sync
- Receipt management (OCR, image upload)
- Mobile app / PWA
- Investment tracking
- Tax features

---

## Active Backlog (v0.4)

Detailed specifications for upcoming features.

---

### ~~Backlog Item 1: Multi-File Import~~ ✅ COMPLETED (PR #7)

Implemented with cross-file duplicate detection via content hashing.

---

### ~~Backlog Item 4: Transaction Hashing~~ ✅ COMPLETED

Content-based SHA256 hashing implemented. All transactions get `content_hash` on import.

---

### ~~Backlog Item 2: Quicken File Import (QIF/QFX)~~ ✅ COMPLETED

**Priority**: Medium | **Complexity**: Medium-High | **Status**: ✅ Completed (2025-12-01)

Implemented as part of the extensible parser framework:
- `backend/app/parsers/formats/qif.py` - QIF parser
- `backend/app/parsers/formats/qfx.py` - QFX/OFX parser
- 47 unit tests in `backend/tests/test_quicken_import.py`

#### Acceptance Criteria
- [x] Can import .qif files with transactions appearing correctly
- [x] Can import .qfx/.ofx files with FITID-based deduplication
- [x] Auto-detects format from file content
- [x] Preserves Quicken categories when present
- [x] Multi-account QIF files handled correctly

#### References
- [QIF Format (W3C)](https://www.w3.org/2000/10/swap/pim/qif-doc/QIF-doc.htm)
- [QIF Wikipedia](https://en.wikipedia.org/wiki/Quicken_Interchange_Format)
- [QFX/OFX Wikipedia](https://en.wikipedia.org/wiki/QFX_(file_format))

---

### ~~Backlog Item 3: Credit Card Account Support~~ ✅ COMPLETED (Lightweight)

**Priority**: Medium | **Complexity**: Medium | **Status**: ✅ Completed (2025-12-01)

Implemented a lightweight version using existing Tag system instead of new Account model:

**Implementation:**
- Extended `Tag` model with `due_day` and `credit_limit` fields for account tags
- New `GET /api/v1/accounts/summary` - lists all accounts with balances, due dates, available credit
- New `GET /api/v1/accounts/{account_source}` - get specific account details
- New `PATCH /api/v1/accounts/{account_source}` - update due_day, credit_limit, description
- Balance computed from transactions (excluding transfers via `is_transfer=True`)
- Next due date automatically calculated from due_day

**Files:**
- `backend/app/routers/accounts.py` - Account endpoints
- `backend/tests/test_accounts.py` - 17 tests
- Migration: `36cfdc725bac_add_due_day_and_credit_limit_to_tags.py`

**Not Implemented (deferred):**
- Full Account model with account types (checking, savings, credit_card)
- Statement period tracking
- Auto-detection of credit card payments

Transfer detection was already implemented in v0.4 (PR #11, #16) and handles payment matching.

---

### ~~Backlog Item 4: Transfer Detection~~ ✅ COMPLETED

**Priority**: High | **Complexity**: Medium | **Status**: ✅ Completed in v0.4 (PR #11, #16)

Transfer detection, linking, and exclusion from reports was implemented in v0.4.

---

### ~~Backlog Item 5: Merchant Aliases~~ ✅ COMPLETED

**Priority**: Medium | **Complexity**: Low-Medium | **Status**: ✅ Completed in v0.4 (PR #12)

Merchant alias system implemented with pattern matching (exact, prefix, contains, regex).

---

### ~~Backlog Item 6: Additional Account Types~~ ✅ PARTIALLY COMPLETED

**Priority**: High | **Complexity**: Medium | **Status**: ✅ Venmo, HSA completed in v0.4 (PR #14)

Venmo and Inspira HSA parsers implemented. Investment account parsing deferred.
