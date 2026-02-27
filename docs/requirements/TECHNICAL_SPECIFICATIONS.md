# Technical Specifications

## Architecture

### Overall Architecture
- **Pattern**: Full-stack web application
- **Frontend**: Single-page application (SPA)
- **Backend**: REST API
- **Database**: Relational database
- **Deployment**: Local development (v0)

## Technology Stack

### Frontend
- **Framework**: Next.js 16
- **Language**: TypeScript
- **Routing**: App Router
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Virtual Scrolling**: TanStack Virtual
- **HTTP Client**: fetch API
- **Date Handling**: date-fns

### Backend
- **Framework**: FastAPI (Python)
- **Language**: Python 3.11+
- **Server**: Uvicorn (ASGI)
- **ORM**: SQLModel
- **Database**: SQLite (dev), PostgreSQL-ready (prod)
- **Migrations**: Alembic
- **Async**: Native async/await
- **Observability**: OpenTelemetry, Prometheus

### Development Tools
- **Frontend Package Manager**: npm
- **Backend Package Manager**: uv
- **Build System**: just (justfile)
- **Version Control**: Git
- **E2E Testing**: Playwright
- **CI/CD**: GitHub Actions

## Database Schema

### Tables

#### tags
```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    namespace VARCHAR NOT NULL,
    value VARCHAR NOT NULL,
    description VARCHAR,
    sort_order INTEGER NOT NULL DEFAULT 0,
    color VARCHAR,
    UNIQUE(namespace, value)
);
```

#### transaction_tags
```sql
CREATE TABLE transaction_tags (
    id INTEGER PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    created_at TIMESTAMP NOT NULL,
    UNIQUE(transaction_id, tag_id)
);
```

#### transactions
```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    date DATE NOT NULL,
    amount FLOAT NOT NULL,
    description VARCHAR NOT NULL,
    merchant VARCHAR,
    account_source VARCHAR NOT NULL,
    account_tag_id INTEGER REFERENCES tags(id),
    card_member VARCHAR,
    reconciliation_status VARCHAR NOT NULL,
    notes VARCHAR,
    reference_id VARCHAR,
    content_hash VARCHAR,
    import_session_id INTEGER REFERENCES import_sessions(id),

    INDEX idx_date (date),
    INDEX idx_merchant (merchant),
    INDEX idx_account_source (account_source),
    INDEX idx_account_tag_id (account_tag_id),
    INDEX idx_reconciliation_status (reconciliation_status),
    INDEX idx_reference_id (reference_id),
    INDEX idx_content_hash (content_hash)
);
```

#### import_formats
```sql
CREATE TABLE import_formats (
    id INTEGER PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    account_source VARCHAR UNIQUE NOT NULL,
    format_type VARCHAR NOT NULL,
    custom_mappings VARCHAR
);
```

### Enums

#### ReconciliationStatus
- `unreconciled` - Default for imported transactions
- `matched` - User has reconciled
- `manually_entered` - User created transaction
- `ignored` - Internal transfers, duplicates to ignore

#### ImportFormatType
- `bofa` - Bank of America format
- `amex` - American Express format
- `unknown` - Unrecognized format

## API Endpoints

### Transactions
- `GET /api/v1/transactions` - List transactions with filters
  - Query params: skip, limit, account_source, category, reconciliation_status, start_date, end_date, search, amount_min, amount_max, tag (multiple allowed, AND logic)
- `GET /api/v1/transactions/{id}` - Get single transaction
- `POST /api/v1/transactions` - Create transaction
- `PATCH /api/v1/transactions/{id}` - Update transaction
- `DELETE /api/v1/transactions/{id}` - Delete transaction
- `POST /api/v1/transactions/{id}/suggest-category` - Get category suggestions
- `POST /api/v1/transactions/bulk-update` - Bulk update transactions

### Tags
- `GET /api/v1/tags` - List all tags (filterable by namespace query param)
- `GET /api/v1/tags/buckets` - List bucket tags only (convenience endpoint)
- `GET /api/v1/tags/buckets/stats` - Get bucket statistics (transaction count, total amount per bucket)
- `GET /api/v1/tags/accounts/stats` - Get account statistics (transaction count, total amount per account via account_source)
- `GET /api/v1/tags/occasions/stats` - Get occasion statistics (transaction count, total amount per occasion)
- `GET /api/v1/tags/{id}` - Get single tag
- `GET /api/v1/tags/by-name/{namespace}/{value}` - Get tag by namespace and value
- `POST /api/v1/tags` - Create tag
- `PATCH /api/v1/tags/{id}` - Update tag (value, description, sort_order, color)
- `DELETE /api/v1/tags/{id}` - Delete tag (fails if in use)
- `POST /api/v1/tags/reorder` - Bulk update sort_order for multiple tags (for drag-and-drop)
- `GET /api/v1/tags/{id}/usage-count` - Get transaction count using this tag
- `GET /api/v1/transactions/{id}/tags` - Get tags for a transaction
- `POST /api/v1/transactions/{id}/tags` - Add tag to transaction
- `DELETE /api/v1/transactions/{id}/tags/{tag}` - Remove tag from transaction

### Tag Rules
- `GET /api/v1/tag-rules` - List all tag rules
- `GET /api/v1/tag-rules/{id}` - Get single rule
- `POST /api/v1/tag-rules` - Create rule
- `PATCH /api/v1/tag-rules/{id}` - Update rule
- `DELETE /api/v1/tag-rules/{id}` - Delete rule
- `POST /api/v1/tag-rules/apply` - Apply all rules to untagged transactions
- `POST /api/v1/tag-rules/{id}/test` - Test rule against transactions

### Import
- `POST /api/v1/import/preview` - Preview CSV import
  - Body: multipart/form-data with file
  - Returns: parsed transactions, format type, count
- `POST /api/v1/import/confirm` - Confirm and save import
  - Body: multipart/form-data with file, format_type, account_source, save_format
  - Returns: imported count, duplicates count
- `GET /api/v1/import/formats` - List saved import formats
- `DELETE /api/v1/import/formats/{id}` - Delete saved format

### Reports (Basic)
- `GET /api/v1/reports/monthly-summary` - Monthly summary
  - Query params: year, month
  - Returns: income, expenses, net, bucket_breakdown, top_merchants
- `GET /api/v1/reports/trends` - Spending trends
  - Query params: start_date, end_date, group_by (month|category|account)
  - Returns: time-series data grouped by specified dimension
- `GET /api/v1/reports/top-merchants` - Top merchants
  - Query params: limit, period (current_month|last_month|last_3_months|all_time)
  - Returns: merchants sorted by spending amount
- `GET /api/v1/reports/account-summary` - Summary by account
  - Returns: income, expenses, net per account

### Admin
- `GET /api/v1/admin/stats` - Database statistics (transaction count, account breakdown, session counts)
- `GET /api/v1/admin/import-sessions` - List all import sessions
- `GET /api/v1/admin/import-sessions/{id}` - Get import session with transactions
- `DELETE /api/v1/admin/import-sessions/{id}` - Roll back import (delete transactions, mark session rolled_back)
  - Query param: confirm=DELETE required
- `DELETE /api/v1/admin/transactions/purge-all` - Delete ALL transactions and import sessions
  - Query param: confirm=PURGE_ALL required

### Observability
- `GET /metrics` - Prometheus metrics endpoint
- `GET /api/v1/observability/health` - Detailed health check
- `GET /api/v1/observability/stats` - Dashboard stats (latency percentiles, error rates)

### Pagination
- `GET /api/v1/transactions/paginated` - Cursor-based pagination
  - Query params: cursor, limit, all standard filters
  - Returns: items, next_cursor, has_more

### Reports (Advanced Analytics) - v0.2
- `GET /api/v1/reports/month-over-month` - Month-over-month comparison
  - Query params: current_year, current_month
  - Returns: current/previous month data, changes ($ and %), category changes, insights
  - Purpose: Identify spending trends and savings opportunities

- `GET /api/v1/reports/spending-velocity` - Daily burn rate projection
  - Query params: year, month
  - Returns: daily_rates, projected_monthly, pace, days_elapsed, insights
  - Purpose: Know early if on track to overspend

- `GET /api/v1/reports/anomalies` - Anomaly detection
  - Query params: year, month, threshold (default: 2.0)
  - Returns: large_transactions, new_merchants, unusual_buckets, summary
  - Purpose: Catch unexpected charges and budget leaks
  - Algorithm: Statistical analysis using 6-month baseline, z-scores

## Data Models

### Transaction (SQLModel)
```python
class Transaction(BaseModel, table=True):
    date: date_type
    amount: float  # positive=income, negative=expense
    description: str
    merchant: Optional[str]
    account_source: str
    account_tag_id: Optional[int]  # FK to account Tag
    card_member: Optional[str]
    reconciliation_status: ReconciliationStatus
    notes: Optional[str]
    reference_id: Optional[str]
    content_hash: Optional[str]  # SHA256 for deduplication
    import_session_id: Optional[int]
    # Relationships:
    # - account_tag: single FK to account Tag (for account budgets)
    # - tags: M2M via TransactionTag (for buckets, occasions, etc.)
```

### Tag (SQLModel)
```python
class Tag(BaseModel, table=True):
    namespace: str  # e.g., "bucket", "expense", "occasion"
    value: str      # e.g., "groceries", "vacation"
    description: Optional[str]
    sort_order: int = 0  # For custom ordering (drag-and-drop)
    color: Optional[str]  # Hex color for UI display
    # Unique constraint on (namespace, value)
```

### TransactionTag (SQLModel)
```python
class TransactionTag(BaseModel, table=True):
    transaction_id: int  # FK to Transaction
    tag_id: int          # FK to Tag
    # Unique constraint on (transaction_id, tag_id)
```

### ImportFormat (SQLModel)
```python
class ImportFormat(BaseModel, table=True):
    account_source: str  # unique
    format_type: ImportFormatType
    custom_mappings: Optional[str]
```

## CSV Parsing Logic

### BOFA Format Detection
- Look for summary rows at top
- Find row starting with "Date,Description,Amount,Running Bal."
- Parse from that row forward

### BOFA Parsing Rules
- Skip summary header rows
- Skip rows with "balance" in date field
- Extract merchant from description using patterns:
  - First word before "DES:" or ID numbers
  - Merchant name from common patterns
- Amount is signed (negative = expense)
- Generate reference_id from date + amount

### AMEX Format Detection
- Look for columns: "Card Member", "Account #"

### AMEX Parsing Rules
- Standard CSV with headers
- Skip "AUTOPAY PAYMENT" rows
- Extract merchant from Description (first part before location)
- Flip amount sign (AMEX positive = charge, we use negative = expense)
- Use Reference column as reference_id
- Map Category field to simplified categories

### Bucket Mapping (AMEX → Simplified)
- "Restaurant", "Bar & Café" → bucket:dining
- "Merchandise", "Retail" → bucket:shopping
- "Entertainment" → bucket:entertainment
- "Health Care" → bucket:healthcare
- "Education" → bucket:education
- "Government", "Toll" → bucket:transportation
- "Computer", "Internet" → bucket:subscriptions
- "Telecom", "Communications" → bucket:utilities

## Tag Inference Algorithm

### Priority Order
1. **Tag Rules**: Apply matching TagRule by priority
2. **User History**: Check if merchant has been tagged before
3. **AMEX Category**: Use mapped AMEX category if available
4. **Keyword Matching**: Match merchant/description against keyword rules
5. **Default**: No bucket tag applied

### Keyword Rules
Defined in `backend/app/tag_inference.py`:
- Keywords per bucket stored in dictionary
- Normalize text (lowercase, remove punctuation)
- Check if any keyword appears in merchant or description
- Weight matches (exact merchant match > description match)
- Return top 3 suggestions with confidence scores

## Frontend Routes

### Main Navigation
- `/` - Dashboard (monthly summary + charts)
- `/transactions` - Transaction list with search/filter, inline bucket editing, tag management, "Import CSV" button
  - Supports URL params: bucket, occasion, account, search, status, amount_min, amount_max, start_date, end_date
  - Clickable cards from summary pages link here with pre-applied filters
- `/buckets` - Summary dashboard showing all buckets with transaction counts and totals (links to admin for editing)
- `/occasions` - Summary dashboard for special events with spending totals (links to admin for editing)
- `/accounts` - Summary dashboard showing accounts with transaction counts (links to admin for editing)
- `/budgets` - Budget management for buckets, occasions, and accounts with progress tracking
- `/rules` - Tag rules for auto-tagging
- `/admin` - Admin panel (see below)

### Secondary Routes (not in main nav)
- `/import` - CSV import interface (accessed from Transactions page)
- `/reconcile` - Reconciliation interface for unreconciled transactions
- `/recurring` - Recurring transaction patterns
- `/tags` - Advanced tag management with namespace/value organization

### Admin Panel Tabs
- Overview: Stats, account breakdown, danger zone (purge all)
- Imports: Import session history and rollback
- All Tags: View all tags with namespace:value format
- Buckets: Bucket tag management (colors, descriptions, ordering)
- Accounts: Account tag management (display names, colors)
- Occasions: Occasion tag management (colors, descriptions)
- Expense Types: Expense type tag management

## Theme System

### Available Themes
- **Ledger**: Editorial finance theme with serif headings, cream backgrounds, warm gold accents
- **Dark**: Clean dark mode with high contrast, easy on the eyes
- **Cyberpunk**: Neon glows, hot pink/cyan accents, pure black background with grid pattern
- **Soft**: Warm minimalism with organic feel, rounded corners, subtle grain texture

### Theme CSS Variables
All themes define consistent CSS variables:
- `--color-bg`, `--color-bg-elevated`, `--color-bg-hover`: Background colors
- `--color-text`, `--color-text-muted`: Text colors
- `--color-border`, `--color-border-strong`: Border colors
- `--color-positive`, `--color-negative`: Money/status colors (green/red)
- `--color-accent`, `--color-primary`: Interactive element colors
- `--font-display`, `--font-body`, `--font-mono`: Typography
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`: Elevation shadows
- `--radius-sm`, `--radius-md`, `--radius-lg`: Border radius

### Theme-Aware Utility Classes
- `.text-theme`, `.text-theme-muted`: Text colors that adapt to theme
- `.bg-theme`, `.bg-theme-elevated`: Background colors
- `.border-theme`: Border color
- `.text-positive`, `.text-negative`: Money colors
- `.card`: Themed card component with background, border, shadow
- `.progress-bar`: Themed progress bar background

### Implementation
- Theme stored in localStorage, applied via `data-theme` attribute on `<html>`
- Theme switcher in navigation header
- Components use theme-aware classes instead of hardcoded Tailwind colors

## API Proxy Configuration

Next.js proxies `/api/*` to backend:
```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:3001/api/:path*',
    },
  ]
}
```

## Environment Configuration

### Backend (.env)
```
DATABASE_URL=sqlite+aiosqlite:///./wallet.db
```

### Frontend
No environment variables needed for v0 (API proxy handles routing)

## Development Workflow

### Setup
```bash
just setup          # Install deps + init DB + seed sample data
```

### Development
```bash
just dev::dev       # Run backend + frontend in parallel
```

### Database
```bash
just db::reset      # Reset DB with fresh sample data
just db::migrate MESSAGE="description"  # Create migration
just db::upgrade    # Apply migrations
```

## Performance Considerations

### Database
- Indexes on frequently queried fields (date, merchant, category, account, status)
- Composite index on (date DESC, id DESC) for cursor pagination
- Covering indexes for common filter combinations
- Async database operations
- Cursor-based pagination for O(1) deep scrolling

### Frontend
- Virtual scrolling with TanStack Virtual (handles 50k+ rows)
- Dynamic row height measurement for expanded/collapsed rows
- Cursor-based infinite scroll (replaces offset pagination)
- Client-side caching of category list
- Debounced search input
- Lazy loading of charts
- Responsive design for mobile

## Security Considerations (Future)

V0 is local-only with no authentication, but for production:
- [ ] Add user authentication
- [ ] Row-level security for multi-tenant
- [ ] HTTPS only
- [ ] CSRF protection
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (already handled by ORM)
- [ ] File upload size limits
- [ ] Rate limiting on API

## Scalability Considerations (Future)

V0 uses SQLite, but designed for easy migration:
- SQLModel abstracts database
- Change DATABASE_URL to switch to PostgreSQL
- Alembic migrations work with both
- Async architecture supports high concurrency

## Testing Strategy

- [x] Backend unit tests (pytest) - 90%+ coverage
- [x] Backend integration tests
- [x] Frontend component tests (Vitest + React Testing Library)
- [x] E2E tests (Playwright)
- [x] CSV parser tests with sample files
- [x] Performance stress tests (50k+ transactions)

## Deployment (Future)

V0 is local development only, but architecture supports:
- Frontend: Vercel, Netlify
- Backend: Railway, Fly.io, AWS
- Database: PostgreSQL on Supabase, Neon, etc.
