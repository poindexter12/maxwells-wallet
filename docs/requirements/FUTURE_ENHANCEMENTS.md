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

### Backlog Item 3: Credit Card Account Support

**Priority**: Medium | **Complexity**: Medium | **Status**: Needs Clarification

#### Problem
The system doesn't distinguish account types or provide credit card-specific features:
- No explicit account registry (accounts inferred from transactions)
- Credit card payments appear as expenses, not transfers
- No statement period tracking
- No balance/available credit visibility

#### Requirements

**FR-CC-001: Account Registry**
- Create explicit account records (not just inferred from transactions)
- Account types: checking, savings, credit_card, cash
- Store: name, type, institution, last_four, credit_limit (for cards), statement_day

**FR-CC-002: Payment Matching & Transfers**
- New category type: "Transfer" (neither income nor expense)
- Detect credit card payments and mark as transfers
- Link payment (from checking) to credit card account
- Exclude transfers from spending analytics

**FR-CC-003: Credit Card Dashboard**
- Show each credit card with:
  - Current balance (sum of transactions since last payment)
  - Available credit (limit - balance)
  - Statement balance
  - Next due date

**FR-CC-004: Statement Periods (Optional)**
- Track statement close dates
- Group transactions by statement period
- Calculate statement balance

#### Technical Design

**New Model:** `Account`
```python
class AccountType(str, Enum):
    checking = "checking"
    savings = "savings"
    credit_card = "credit_card"
    cash = "cash"

class Account(BaseModel, table=True):
    name: str                          # "Chase Sapphire"
    type: AccountType
    institution: Optional[str]         # "Chase"
    account_identifier: str            # Matches import account_source
    last_four: Optional[str]
    credit_limit: Optional[float]
    statement_close_day: Optional[int]
    payment_due_day: Optional[int]
    is_active: bool = True
```

**Transaction Model Updates:**
- Add `is_transfer: bool = False`
- Add `linked_transaction_id: Optional[int]` for payment matching

**New Endpoints:**
```
GET/POST /api/v1/accounts
GET/PATCH/DELETE /api/v1/accounts/{id}
GET /api/v1/accounts/{id}/balance
POST /api/v1/transactions/mark-transfer
```

**Payment Detection Heuristics:**
- Description contains "PAYMENT", "AUTOPAY", "ONLINE PMT"
- Merchant matches credit card issuer name

#### Open Questions
1. Full account management vs. just better credit card handling?
2. Track actual balances or compute from transactions?
3. Priority: Account registry → Payment matching → Statement periods?

#### Acceptance Criteria
- [ ] Can create and manage account records
- [ ] Credit cards show balance and available credit
- [ ] Credit card payments marked as transfers
- [ ] Transfers excluded from spending reports

---

### Backlog Item 4: Transfer Detection

**Priority**: High | **Complexity**: Medium | **Status**: Ready

#### Problem
Credit card payments, bank-to-bank transfers, and other internal movements appear as expenses in spending reports. This inflates spending totals and distorts budget tracking.

#### Requirements

**FR-TXF-001: Transfer Flag**
- Add `is_transfer: bool` field to Transaction model
- Transfers excluded from spending calculations (budgets, reports, analytics)
- Transfers still visible in transaction list with visual indicator

**FR-TXF-002: Auto-Detection Rules**
- Detect likely transfers using patterns:
  - Description contains: "PAYMENT", "AUTOPAY", "TRANSFER", "PMT", "XFER"
  - Merchant matches credit card issuer (e.g., "AMEX AUTOPAY" from checking)
  - Amount matches a recent credit card balance
- Flag as "suggested transfer" for user confirmation

**FR-TXF-003: Manual Transfer Marking**
- Bulk action: "Mark as Transfer" on transaction list
- Single transaction toggle in edit modal
- Link paired transactions (payment from checking ↔ payment received on CC)

**FR-TXF-004: Transfer Analytics**
- Dashboard widget: "Internal Transfers This Month"
- Filter option: Show/hide transfers in transaction list

#### Technical Design

**Model Changes:**
```python
class Transaction(BaseModel, table=True):
    # ... existing fields ...
    is_transfer: bool = Field(default=False, index=True)
    linked_transaction_id: Optional[int] = Field(default=None, foreign_key="transactions.id")
```

**Detection Patterns:**
```python
TRANSFER_PATTERNS = [
    r"(?i)payment.*thank",
    r"(?i)autopay",
    r"(?i)online\s*(pmt|payment)",
    r"(?i)transfer\s*(from|to)",
    r"(?i)xfer",
    r"(?i)ach.*payment",
]
```

**New Endpoints:**
```
POST /api/v1/transactions/mark-transfer
  - Body: { transaction_ids: [int], is_transfer: bool }
POST /api/v1/transactions/{id}/link
  - Body: { linked_transaction_id: int }
GET /api/v1/transactions/transfer-suggestions
  - Returns: Transactions that look like transfers but aren't marked
```

#### Acceptance Criteria
- [ ] Transactions can be marked as transfers
- [ ] Transfers excluded from budget calculations
- [ ] Transfers excluded from spending reports
- [ ] Auto-detection suggests likely transfers on import
- [ ] Paired transactions can be linked

---

### Backlog Item 5: Merchant Aliases

**Priority**: Medium | **Complexity**: Low-Medium | **Status**: Ready

#### Problem
Same merchant appears with different names across transactions:
- "AMZN MKTP US", "AMAZON.COM", "Amazon Prime" → all Amazon
- "STARBUCKS #12345", "STARBUCKS STORE" → both Starbucks
- "SQ *COFFEE SHOP", "SQUARE *COFFEE SHOP" → same local shop

This makes reports fragmented and harder to understand.

#### Requirements

**FR-MA-001: Merchant Alias Table**
- Create aliases mapping raw merchant strings to canonical names
- Apply aliases to `merchant` field during import
- Preserve original in `description` field

**FR-MA-002: Alias Management UI**
- List all unique merchants with transaction counts
- "Create Alias" action: select multiple merchants → combine under one name
- Edit/delete existing aliases

**FR-MA-003: Auto-Alias Suggestions**
- Detect similar merchant names using fuzzy matching
- Suggest: "These 3 merchants look similar. Combine them?"
- Learn from user's alias patterns

**FR-MA-004: Retroactive Application**
- Apply new aliases to existing transactions
- Option to preview changes before applying

#### Technical Design

**New Model:**
```python
class MerchantAlias(BaseModel, table=True):
    __tablename__ = "merchant_aliases"

    pattern: str = Field(index=True)        # Raw merchant string to match
    canonical_name: str = Field(index=True) # Clean display name
    match_type: str = "exact"               # "exact", "contains", "regex"
    priority: int = 0                       # Higher = applied first
```

**New Endpoints:**
```
GET /api/v1/merchants
  - Returns: Unique merchants with counts, grouped by canonical name
GET /api/v1/merchant-aliases
POST /api/v1/merchant-aliases
  - Body: { patterns: [str], canonical_name: str, match_type: str }
DELETE /api/v1/merchant-aliases/{id}
POST /api/v1/merchant-aliases/apply
  - Apply aliases to all existing transactions
GET /api/v1/merchant-aliases/suggestions
  - Returns: Groups of similar-looking merchants
```

**Fuzzy Matching:**
- Use `rapidfuzz` library for similarity scoring
- Threshold: 85% similarity to suggest grouping
- Normalize: lowercase, strip whitespace, remove common suffixes (#1234, LLC, INC)

#### Acceptance Criteria
- [ ] Can create aliases mapping multiple patterns to one name
- [ ] Aliases applied during import
- [ ] Can retroactively apply to existing transactions
- [ ] Similar merchants suggested for grouping
- [ ] Reports show canonical names, not raw strings

---

### Backlog Item 6: Additional Account Types

**Priority**: High | **Complexity**: Medium | **Status**: Ready

#### Problem
Currently only supports Bank of America and American Express CSV formats. Users need to import from:
- **Venmo** - P2P payments, different CSV structure
- **HSA** - Health Savings Account transactions
- **Investment accounts** - Brokerage transactions (liquid/cash only, not holdings)

#### Requirements

**FR-AAT-001: Venmo CSV Parser**
- Parse Venmo statement CSV format
- Fields: Date, Type (Payment/Charge/Transfer), From/To, Amount, Note
- Handle Venmo-specific patterns:
  - Payments between users (extract friend name)
  - Transfers to/from bank (mark as transfer)
  - Venmo fees

**FR-AAT-002: HSA CSV Parser**
- Parse common HSA provider formats (HealthEquity, Fidelity, etc.)
- Fields: Date, Description, Amount, Category (medical, investment, fee)
- Tag with `bucket:healthcare` by default
- Track contributions vs. distributions

**FR-AAT-003: Investment Account Parser**
- Parse brokerage CSV exports (Fidelity, Schwab, Vanguard)
- **Liquid transactions only**: deposits, withdrawals, dividends, interest
- Exclude: buy/sell trades, transfers between investment accounts
- Fields: Date, Type, Amount, Description

**FR-AAT-004: Account Type Registry**
- Extend existing account tag system with type metadata
- Types: `checking`, `savings`, `credit_card`, `venmo`, `hsa`, `investment`
- Type-specific display and filtering options

**FR-AAT-005: Format Auto-Detection**
- Detect format from CSV headers and content
- Add to existing detection logic in `csv_parser.py`

#### Technical Design

**New Parser Modules:**
```
backend/app/parsers/
├── __init__.py
├── base.py          # Abstract parser interface
├── bofa.py          # Existing BOFA logic
├── amex.py          # Existing AMEX logic
├── venmo.py         # NEW
├── hsa.py           # NEW
└── investment.py    # NEW
```

**Venmo Format Example:**
```csv
,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip),Amount (fee),Funding Source,Destination
,2024-01-15 14:30:00,Payment,Complete,Dinner split,Friend Name,,- $25.00,$0.00,$0.00,Venmo balance,
```

**HSA Format Example (HealthEquity):**
```csv
Date,Transaction,Amount,Type
01/15/2024,PHARMACY PURCHASE,-$45.00,Medical
01/01/2024,EMPLOYER CONTRIBUTION,$200.00,Contribution
```

**Investment Format Example (Fidelity):**
```csv
Run Date,Action,Symbol,Description,Quantity,Price,Amount
01/15/2024,DIVIDEND,,QUALIFIED DIVIDEND,,$50.00
01/10/2024,ELECTRONIC FUNDS TRANSFER,,CASH CONTRIBUTION,,$500.00
```

**Import Format Enum Updates:**
```python
class ImportFormatType(str, Enum):
    bofa_bank = "bofa_bank"
    bofa_cc = "bofa_cc"
    amex_cc = "amex_cc"
    venmo = "venmo"           # NEW
    hsa_healthequity = "hsa_healthequity"  # NEW
    hsa_fidelity = "hsa_fidelity"          # NEW
    investment_fidelity = "investment_fidelity"  # NEW
    investment_schwab = "investment_schwab"      # NEW
    unknown = "unknown"
```

**Account Type Metadata:**
```python
# Add to Tag model or separate AccountType enum
ACCOUNT_TYPES = {
    "checking": {"icon": "🏦", "color": "#3b82f6"},
    "savings": {"icon": "🐷", "color": "#22c55e"},
    "credit_card": {"icon": "💳", "color": "#ef4444"},
    "venmo": {"icon": "📱", "color": "#008cff"},
    "hsa": {"icon": "🏥", "color": "#10b981"},
    "investment": {"icon": "📈", "color": "#8b5cf6"},
}
```

#### Open Questions
1. Which specific HSA providers to support first? (HealthEquity most common)
2. Which investment brokerages? (Fidelity, Schwab, Vanguard cover most users)
3. Should Venmo transfers auto-detect linked bank accounts?

#### Acceptance Criteria
- [ ] Can import Venmo transaction CSV
- [ ] Can import HSA transactions with healthcare bucket
- [ ] Can import investment account liquid transactions
- [ ] Investment buys/sells are excluded (only cash flow)
- [ ] Account types shown with appropriate icons/colors
- [ ] Format auto-detected from CSV structure
