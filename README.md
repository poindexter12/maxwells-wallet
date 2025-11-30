# Maxwell's Wallet

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

Built with:
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python (async)
- **Database**: SQLite (dev) with SQLModel ORM
- **Charts**: Recharts

📋 **[Full Requirements & Specifications →](docs/requirements/)**

## Features

### Core Features (v0.1)
- **CSV Import**: Import transactions from Bank of America and American Express
  - Auto-detects format
  - Deduplicates transactions
  - Saves format preferences
  - **Batch Import**: Import multiple files at once with cross-file duplicate detection
- **Smart Categorization**: Auto-categorizes transactions using keyword matching and learning from past categorizations
- **Dashboard**: Monthly spending analysis with charts and trends
- **Reconciliation**: Bulk reconcile unreconciled transactions
- **Transaction Management**: Search, filter, and categorize transactions

### Advanced Analytics (v0.2)
- **Month-over-Month Comparison**: Track spending changes with % increases/decreases per category
- **Daily Burn Rate**: See if you're on track to overspend with projected monthly totals
- **Anomaly Detection**: Automatically flag unusual purchases, new merchants, and budget leaks
- **Enhanced Dashboard**: Real-time insights with color-coded indicators

### Smart Budgeting & Automation (v0.3)
- **Budget Tracking**: Set spending limits for buckets, occasions, or accounts
  - Monthly and yearly budgets for any tag type
  - Progress indicators: on-track, warning, exceeded
  - Automatic alerts at 80% and 100% thresholds
- **Category Rules Engine**: Automate transaction categorization with pattern-based rules
  - Match by merchant, description, amount, or account
  - Priority-based rule execution
  - Test rules before applying
  - Bulk categorization
- **Recurring Transaction Detection**: Identify subscriptions and recurring bills automatically
  - Statistical pattern detection (weekly, monthly, quarterly, yearly)
  - Confidence scoring
  - Upcoming payment predictions
  - Missing payment alerts

### Transfer Detection & Merchant Normalization (v0.1) - NEW!
- **Transfer Detection**: Automatically identify internal transfers between accounts
  - Pattern matching for autopay, ACH, PayPal, wire transfers
  - Mark transactions as transfers to exclude from spending calculations
  - Link transfer pairs bidirectionally
- **Merchant Aliases**: Normalize messy bank merchant names into clean, consistent names
  - Exact, contains, and regex matching
  - Priority-based alias resolution
  - Preview changes before applying
  - Applied automatically during import

### Streamlined Navigation
- **Dashboard** - Monthly summary, charts, trends
- **Transactions** - Browse, filter, search, bulk edit
- **Budgets** - Spending limits with progress tracking
- **Organize** - Buckets, Occasions, and Accounts in one place
- **Tools** - Transfers, Rules, and Merchant aliases
- **Admin** - System configuration and data management

## Quick Start

### Using Docker (Recommended)

```bash
# Build and run with Docker Compose
docker compose up -d

# Open http://localhost:3000
```

Your data is persisted in a Docker volume. To use a custom location:
```bash
# Mount a specific host directory
docker run -d \
  -p 3000:3000 -p 8000:8000 \
  -v /path/to/your/data:/data \
  maxwells-wallet
```

### Using Makefile (Development)

```bash
# First-time setup (installs dependencies + seeds database)
make setup

# Start development servers (backend + frontend)
make dev

# Open http://localhost:3000
```

**Common Makefile commands:**
```bash
make help             # Show all available commands
make setup            # First-time setup
make dev              # Start both servers
make backend          # Start backend only
make frontend         # Start frontend only
make db-reset         # Reset database
make db-seed          # Seed sample data
make test-backend     # Run backend tests
make anonymize        # Anonymize test data (see below)
make anonymize-status # Check anonymization status
make clean            # Clean build artifacts
make status           # Check if services are running
```

### Using setup.sh (Alternative)

```bash
./setup.sh         # Run setup script
make dev           # Start servers
```

## Manual Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ (includes npm)
- uv (install: `curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create virtual environment and install dependencies:
   ```bash
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv pip install -e .
   ```

3. Seed the database with sample data:
   ```bash
   uv run python -m app.seed
   ```

4. Start the backend server:
   ```bash
   cd backend
   uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at http://localhost:8000

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at http://localhost:3000

## Usage

### Importing Transactions

1. Navigate to the **Import** page
2. Upload a CSV file (sample files in `/samples/`)
3. Optionally specify account source (required for BOFA files)
4. Preview the import
5. Confirm to import transactions into the database

### Reconciling Transactions

1. Navigate to the **Reconcile** page
2. Review unreconciled transactions
3. Assign categories as needed
4. Select transactions and mark as reconciled or ignored

### Viewing Dashboard

The dashboard shows:
- Current month income, expenses, and net
- Spending by category (pie chart)
- Top merchants
- 6-month spending trend (line chart)

## Project Structure

```
maxwells-wallet/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── models.py       # SQLModel database models
│   │   ├── database.py     # Database configuration
│   │   ├── csv_parser.py   # CSV parsing logic (BOFA/AMEX)
│   │   ├── category_inference.py  # Category inference service
│   │   ├── seed.py         # Database seeding script
│   │   └── routers/        # API route handlers
│   │       ├── transactions.py
│   │       ├── categories.py
│   │       ├── import_router.py
│   │       └── reports.py
│   ├── alembic/            # Database migrations
│   └── pyproject.toml      # Python dependencies
├── frontend/               # Next.js frontend
│   ├── src/
│   │   └── app/
│   │       ├── layout.tsx  # App layout with navigation
│   │       ├── page.tsx    # Dashboard page
│   │       ├── transactions/  # Transactions page
│   │       ├── import/     # Import page
│   │       └── reconcile/  # Reconciliation page
│   ├── package.json        # Node dependencies
│   └── next.config.js      # Next.js config (API proxy)
├── samples/                # Sample CSV files (seeding)
│   ├── bofa.csv
│   └── amex.csv
├── data/                   # Test data directory
│   ├── raw/                # Real financial CSVs (gitignored)
│   └── anonymized/         # Scrubbed test data (safe to commit)
├── scripts/                # Utility scripts
│   └── anonymize_import.py # Data anonymization tool
└── forge.config.yaml       # Project configuration
```

## API Endpoints

### Transactions
- `GET /api/v1/transactions` - List transactions with filtering
- `GET /api/v1/transactions/{id}` - Get single transaction
- `POST /api/v1/transactions` - Create transaction
- `PATCH /api/v1/transactions/{id}` - Update transaction
- `DELETE /api/v1/transactions/{id}` - Delete transaction
- `POST /api/v1/transactions/{id}/suggest-category` - Get category suggestions
- `POST /api/v1/transactions/bulk-update` - Bulk update transactions

### Categories
- `GET /api/v1/categories` - List all categories
- `POST /api/v1/categories` - Create category
- `PATCH /api/v1/categories/{id}` - Update category
- `DELETE /api/v1/categories/{id}` - Delete category

### Import
- `POST /api/v1/import/preview` - Preview CSV import
- `POST /api/v1/import/confirm` - Confirm and import CSV
- `GET /api/v1/import/formats` - List saved import formats

### Reports (Basic)
- `GET /api/v1/reports/monthly-summary` - Monthly spending summary
- `GET /api/v1/reports/trends` - Spending trends over time
- `GET /api/v1/reports/top-merchants` - Top merchants by spending
- `GET /api/v1/reports/account-summary` - Summary by account

### Reports (Advanced Analytics) - NEW!
- `GET /api/v1/reports/month-over-month` - Compare current vs previous month
- `GET /api/v1/reports/spending-velocity` - Daily burn rate and projections
- `GET /api/v1/reports/anomalies` - Detect unusual transactions

## Default Categories

- Income
- Groceries
- Dining & Coffee
- Shopping
- Utilities
- Transportation
- Entertainment
- Healthcare
- Education
- Housing
- Subscriptions
- Other

You can add/delete categories via the Categories API.

## Test Data

### Quick Samples

The `/samples/` directory contains sample CSV files for database seeding. These are imported when running `make db-seed`.

### Anonymizing Real Data

To test with realistic data without exposing sensitive information, use the anonymization tool:

```bash
# 1. Put your real bank CSVs in data/raw/ (gitignored)
cp ~/Downloads/amex_statement.csv data/raw/
cp ~/Downloads/bofa_checking.csv data/raw/

# 2. Check what needs processing
make anonymize-status

# 3. Anonymize all new/changed files
make anonymize

# 4. Find scrubbed files in data/anonymized/
ls data/anonymized/
```

**How it works:**
- Merchants are consistently tokenized: "AMAZON" → "Acme Store" (same fake name everywhere)
- Account numbers, card member names, and reference IDs are replaced
- Amounts and dates are preserved for realistic testing
- A manifest tracks file hashes so unchanged files are skipped on re-runs

**Commands:**
```bash
make anonymize         # Process new/changed files
make anonymize-status  # Show pending/processed files
make anonymize-force   # Reprocess all files
```

The anonymized files in `data/anonymized/` are safe to commit and share.

## Development

### Database Migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

### Reset Database

```bash
cd backend
rm wallet.db
uv run python -m app.seed
```

## License

Private prototype - not for redistribution
