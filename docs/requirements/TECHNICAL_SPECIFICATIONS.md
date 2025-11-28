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
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Routing**: App Router
- **Styling**: Tailwind CSS
- **Charts**: Recharts
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

### Development Tools
- **Frontend Package Manager**: npm
- **Backend Package Manager**: uv
- **Build System**: Makefile
- **Version Control**: Git

## Database Schema

### Tables

#### categories
```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR
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
    card_member VARCHAR,
    category VARCHAR,
    reconciliation_status VARCHAR NOT NULL,
    notes VARCHAR,
    reference_id VARCHAR,

    INDEX idx_date (date),
    INDEX idx_merchant (merchant),
    INDEX idx_account_source (account_source),
    INDEX idx_category (category),
    INDEX idx_reconciliation_status (reconciliation_status),
    INDEX idx_reference_id (reference_id)
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
  - Query params: skip, limit, account_source, category, reconciliation_status, start_date, end_date, search
- `GET /api/v1/transactions/{id}` - Get single transaction
- `POST /api/v1/transactions` - Create transaction
- `PATCH /api/v1/transactions/{id}` - Update transaction
- `DELETE /api/v1/transactions/{id}` - Delete transaction
- `POST /api/v1/transactions/{id}/suggest-category` - Get category suggestions
- `POST /api/v1/transactions/bulk-update` - Bulk update transactions

### Categories
- `GET /api/v1/categories` - List all categories
- `GET /api/v1/categories/{id}` - Get single category
- `POST /api/v1/categories` - Create category
- `PATCH /api/v1/categories/{id}` - Update category
- `DELETE /api/v1/categories/{id}` - Delete category

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
  - Returns: income, expenses, net, category_breakdown, top_merchants
- `GET /api/v1/reports/trends` - Spending trends
  - Query params: start_date, end_date, group_by (month|category|account)
  - Returns: time-series data grouped by specified dimension
- `GET /api/v1/reports/top-merchants` - Top merchants
  - Query params: limit, period (current_month|last_month|last_3_months|all_time)
  - Returns: merchants sorted by spending amount
- `GET /api/v1/reports/account-summary` - Summary by account
  - Returns: income, expenses, net per account

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
  - Returns: large_transactions, new_merchants, unusual_categories, summary
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
    card_member: Optional[str]
    category: Optional[str]
    reconciliation_status: ReconciliationStatus
    notes: Optional[str]
    reference_id: Optional[str]
```

### Category (SQLModel)
```python
class Category(BaseModel, table=True):
    name: str  # unique
    description: Optional[str]
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

### Category Mapping (AMEX → Simplified)
- "Restaurant", "Bar & Café" → Dining & Coffee
- "Merchandise", "Retail" → Shopping
- "Entertainment" → Entertainment
- "Health Care" → Healthcare
- "Education" → Education
- "Government", "Toll" → Transportation
- "Computer", "Internet" → Subscriptions
- "Telecom", "Communications" → Utilities

## Category Inference Algorithm

### Priority Order
1. **User History**: Check if merchant has been categorized before
2. **AMEX Category**: Use mapped AMEX category if available
3. **Keyword Matching**: Match merchant/description against keyword rules
4. **Default**: "Other"

### Keyword Rules
Defined in `backend/app/category_inference.py`:
- Keywords per category stored in dictionary
- Normalize text (lowercase, remove punctuation)
- Check if any keyword appears in merchant or description
- Weight matches (exact merchant match > description match)
- Return top 3 with confidence scores

## Frontend Routes

- `/` - Dashboard (monthly summary + charts)
- `/transactions` - Transaction list with search/filter
- `/import` - CSV import interface
- `/reconcile` - Reconciliation interface for unreconciled transactions

## API Proxy Configuration

Next.js proxies `/api/*` to backend:
```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:8000/api/:path*',
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
make setup    # Install deps + init DB + seed sample data
```

### Development
```bash
make dev      # Run backend + frontend in parallel
```

### Database
```bash
make db-reset      # Reset DB with fresh sample data
make db-migrate    # Create migration
make db-upgrade    # Apply migrations
```

## Performance Considerations

### Database
- Indexes on frequently queried fields (date, merchant, category, account, status)
- Pagination on transaction list (100 per page)
- Async database operations

### Frontend
- Client-side caching of category list
- Debounced search input
- Lazy loading of charts
- Responsive design for mobile (future)

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

## Testing Strategy (Future)

- [ ] Backend unit tests (pytest)
- [ ] Backend integration tests
- [ ] Frontend component tests
- [ ] E2E tests
- [ ] CSV parser tests with sample files

## Deployment (Future)

V0 is local development only, but architecture supports:
- Frontend: Vercel, Netlify
- Backend: Railway, Fly.io, AWS
- Database: PostgreSQL on Supabase, Neon, etc.
