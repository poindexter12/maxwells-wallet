# Future Enhancements

Ideas for future versions beyond v0.

## High Priority

### Multi-Bank Support
- Add parsers for more banks (Chase, Wells Fargo, Citi, etc.)
- Generic CSV mapper for custom formats
- Auto-detect more format types
- Bank-specific merchant cleaning rules

### Budget Tracking
- Set monthly budgets per category
- Track actual vs budget
- Alert when approaching budget limit
- Rollover unused budget
- Yearly budget planning

### Recurring Transactions
- Detect recurring patterns (subscriptions, bills)
- Mark transactions as recurring
- Predict future recurring transactions
- Alert on missing expected transactions

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

### v0.4 (Planned - Active Backlog)

See detailed specs below in **Active Backlog** section.

1. **Multi-File Import** - Batch upload multiple CSVs at once
2. **Quicken File Import** - Support QIF/QFX formats
3. **Credit Card Account Support** - Account registry, payment matching, transfers
4. **Transaction Hashing** - Content-based deduplication for reliable import

### v0.5+ (Future Ideas)
- Bank integration (Plaid) for automatic sync
- Receipt management (OCR, image upload)
- Mobile app / PWA
- Investment tracking
- Tax features

---

## Active Backlog (v0.4)

Detailed specifications for the next three features. Implement in order.

---

### Backlog Item 1: Multi-File Import

**Priority**: High | **Complexity**: Medium | **Status**: Ready

#### Problem
Users must import one CSV at a time. Tedious when downloading statements from multiple accounts or date ranges.

#### Requirements

**FR-MFI-001: Batch File Upload**
- Accept multiple files in single upload (up to 20 files, 10MB total)
- Support mixed formats in same batch (e.g., 3 BOFA + 2 AMEX files)
- Validate all files before processing any

**FR-MFI-002: Per-File Preview**
- Show preview for each file: detected format, transaction count, date range, account source
- Allow user to exclude specific files before import
- Allow per-file account source override

**FR-MFI-003: Batch Import Execution**
- Process files sequentially to handle cross-file duplicates
- Aggregate results: total imported, duplicates (per-file and cross-file), errors
- Continue on non-critical errors, report at end

**FR-MFI-004: Progress Tracking**
- Progress indicator during batch import
- Per-file status: pending, processing, complete, error

#### Technical Design

**Backend Endpoints:**
```
POST /api/v1/import/batch/preview
  - Accepts: multipart/form-data with multiple files
  - Returns: Array of preview results per file

POST /api/v1/import/batch/confirm
  - Accepts: { files: [{ file_id, account_source, include: bool }] }
  - Returns: Aggregate import results
```

**Implementation Notes:**
- Store uploaded files temporarily with UUIDs during preview phase
- Cross-file deduplication: maintain seen transactions set across files
- Process in date order (oldest file first) for consistent duplicate detection

**Frontend Changes:**
- Multi-file dropzone component
- File list with individual previews and checkboxes
- Batch progress modal

#### Acceptance Criteria
- [ ] Can upload 5+ CSV files simultaneously
- [ ] Each file shows individual preview with format detection
- [ ] Can exclude specific files before confirming
- [ ] Cross-file duplicates detected and reported
- [ ] Clear aggregate summary after import completes

---

### Backlog Item 2: Quicken File Import (QIF/QFX)

**Priority**: Medium | **Complexity**: Medium-High | **Status**: Ready

#### Problem
Many banks offer Quicken export formats (QIF, QFX) alongside CSV. These formats are more standardized and often contain richer data (categories, check numbers, memo fields).

#### Requirements

**FR-QIF-001: QIF File Parsing**
- Parse QIF (Quicken Interchange Format) text files
- Support transaction types: Bank, CCard, Cash
- Extract: Date, Amount, Payee, Memo, Category, Check Number, Cleared status
- Handle multiple accounts in single QIF file (separated by `!Account` headers)

**FR-QIF-002: QFX/OFX File Parsing**
- Parse QFX/OFX (XML-based Open Financial Exchange) files
- Extract: FITID (transaction ID), date, amount, name, memo
- Use FITID as reference_id for superior deduplication
- Extract account info from `<BANKACCTFROM>` or `<CCACCTFROM>` tags

**FR-QIF-003: Format Auto-Detection**
- Detect by file extension (.qif, .qfx, .ofx) and content inspection
- QIF: Look for `!Type:` header lines
- QFX/OFX: Look for `<OFX>` or `<?OFX` tags

**FR-QIF-004: Field Mapping**
- Quicken Payee → merchant
- Quicken Memo → description
- Quicken Category → category (if present)
- QFX FITID → reference_id
- Check numbers → notes field

#### Technical Design

**New Parser Module:** `backend/app/quicken_parser.py`
```python
def parse_qif(content: str) -> list[dict]
def parse_qfx(content: str) -> list[dict]
def detect_quicken_format(content: str, filename: str) -> str | None
```

**QIF Format Example:**
```
!Type:Bank
D12/15/2024
T-150.00
PAMAZON.COM
MORDER #123-456
LOnline Shopping
^
```
Fields: `D`=Date, `T`=Amount, `P`=Payee, `M`=Memo, `L`=Category, `^`=End record

**QFX/OFX Format Example:**
```xml
<STMTTRN>
  <TRNTYPE>DEBIT</TRNTYPE>
  <DTPOSTED>20241215</DTPOSTED>
  <TRNAMT>-150.00</TRNAMT>
  <FITID>2024121500001</FITID>
  <NAME>AMAZON.COM</NAME>
</STMTTRN>
```

**Model Changes:**
- Add to `ImportFormatType` enum: `qif`, `qfx`

#### Acceptance Criteria
- [ ] Can import .qif files with transactions appearing correctly
- [ ] Can import .qfx/.ofx files with FITID-based deduplication
- [ ] Auto-detects format from file content
- [ ] Preserves Quicken categories when present
- [ ] Multi-account QIF files handled correctly

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

### Backlog Item 4: Transaction Hashing (Deduplication)

**Priority**: High | **Complexity**: Low-Medium | **Status**: Ready

#### Problem
Current deduplication uses `date + amount + reference_id` matching, which is fragile:
- BOFA generates weak reference IDs (`bofa_{date}_{amount}`)
- Re-importing same file can create duplicates if reference_id changes
- No way to detect "same transaction, different source file"

#### Solution
Hash the immutable content of each transaction and store it. On import, compute hash first and skip if exists.

#### Requirements

**FR-TXH-001: Transaction Content Hash**
- Compute SHA256 hash from: `date + amount + description + account_source`
- Store hash in new `content_hash` field on Transaction model
- Hash computed at import time, immutable after creation

**FR-TXH-002: Import Deduplication**
- Before creating transaction, check if `content_hash` exists in DB
- If exists: skip and count as duplicate
- If not: create transaction with computed hash
- Works across files, accounts, and import sessions

**FR-TXH-003: Duplicate Detection API**
- `GET /api/v1/transactions/duplicates` - Find potential duplicates
- Useful for manual review of edge cases (same hash, different files)

**FR-TXH-004: Migration**
- Backfill `content_hash` for existing transactions
- Handle legacy transactions without hash gracefully

#### Technical Design

**Hash Function:**
```python
import hashlib

def compute_transaction_hash(date: date, amount: float, description: str, account_source: str) -> str:
    """Compute deterministic hash for transaction deduplication."""
    # Normalize inputs
    content = f"{date.isoformat()}|{amount:.2f}|{description.strip().upper()}|{account_source.strip().upper()}"
    return hashlib.sha256(content.encode()).hexdigest()
```

**Model Change:**
```python
class Transaction(BaseModel, table=True):
    # ... existing fields ...
    content_hash: Optional[str] = Field(default=None, index=True, unique=True)
```

**Import Flow Change:**
```python
# In confirm_import()
for txn_data in transactions:
    content_hash = compute_transaction_hash(
        txn_data['date'],
        txn_data['amount'],
        txn_data['description'],
        txn_data['account_source']
    )

    # Check for existing
    existing = await session.execute(
        select(Transaction).where(Transaction.content_hash == content_hash)
    )
    if existing.scalar_one_or_none():
        duplicates += 1
        continue

    # Create with hash
    txn_data['content_hash'] = content_hash
    # ... create transaction ...
```

**Migration Script:**
```python
# Backfill existing transactions
for txn in all_transactions:
    if not txn.content_hash:
        txn.content_hash = compute_transaction_hash(
            txn.date, txn.amount, txn.description, txn.account_source
        )
```

#### Relation to Anonymization Script
The anonymization manifest tracks *file-level* hashes for a different purpose:
- **File hash**: "Has this source file changed?" → Skip unchanged files (performance)
- **Transaction hash**: "Has this transaction been imported?" → Prevent duplicates (data integrity)

These are complementary. The anonymization script could optionally compute transaction hashes for the output manifest, enabling cross-reference between raw and anonymized data, but this is not required.

#### Acceptance Criteria
- [ ] All new transactions get `content_hash` on import
- [ ] Duplicate imports are detected and skipped
- [ ] Existing transactions are backfilled with hashes
- [ ] Deduplication works across different import sessions
- [ ] Hash collision handling (log warning, allow manual review)
