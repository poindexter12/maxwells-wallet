# Maxwell's Wallet

[![CI](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml/badge.svg)](https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/poindexter12/maxwells-wallet?label=release)](https://github.com/poindexter12/maxwells-wallet/releases)
[![Python](https://img.shields.io/badge/python-3.11+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ed?logo=docker&logoColor=white)](https://github.com/poindexter12/maxwells-wallet/pkgs/container/maxwells-wallet)

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

Built with:
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python (async)
- **Database**: SQLite (dev) with SQLModel ORM
- **Charts**: Recharts

📋 **[Full Requirements & Specifications →](docs/requirements/)**

## What's New

- **Quicken QIF/QFX/OFX Import** - Import from Quicken, Microsoft Money, and other financial software
- **Credit Card Accounts** - Track due dates, credit limits, and utilization
- **Advanced Search** - Quick filters, saved filters, CSV export
- **Dynamic Thresholds** - "Large" transactions calculated from your spending history (2σ above average)
- **Clickable Insights** - Dashboard anomaly counts link directly to filtered transactions

See [CHANGELOG.md](CHANGELOG.md) for full release history.

## Features

### Import & Data Management
- **Multi-Format Import**: Bank of America, American Express, Venmo, Inspira HSA, Quicken QIF/QFX/OFX
- **Batch Import**: Upload multiple files with cross-file duplicate detection
- **Smart Categorization**: Auto-categorize using keyword matching and learning from past choices
- **Merchant Aliases**: Normalize messy bank merchant names to clean, consistent names
- **Transfer Detection**: Auto-identify internal transfers (CC payments, bank transfers)

### Budgeting & Analysis
- **Budget Tracking**: Set monthly/yearly limits for buckets, occasions, or accounts
- **Recurring Detection**: Identify subscriptions with upcoming payment predictions
- **Anomaly Detection**: Flag unusual purchases, new merchants, and budget leaks
- **Month-over-Month**: Track spending changes with category-level breakdown
- **Daily Burn Rate**: Know early if you're on track to overspend

### Search & Filtering
- **Quick Filters**: One-click buttons for This Month, Last Month, Large, Unreconciled
- **Saved Filters**: Save and reuse complex filter combinations
- **CSV Export**: Export filtered transactions for external analysis
- **Dynamic Thresholds**: "Large" is personalized based on your spending patterns

### Account Management
- **Multi-Account Support**: Checking, savings, and credit card accounts
- **Credit Card Tracking**: Due dates, credit limits, available credit, utilization %
- **Category Rules**: Automate categorization with pattern-based rules

### Navigation
- **Dashboard** - Monthly summary, charts, trends, anomalies
- **Transactions** - Browse, filter, search, bulk edit
- **Budgets** - Spending limits with progress tracking
- **Organize** - Buckets, Occasions, and Accounts
- **Tools** - Transfers, Rules, and Merchant aliases
- **Admin** - Import history, data management

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

### Reports (Advanced Analytics)
- `GET /api/v1/reports/month-over-month` - Compare current vs previous month
- `GET /api/v1/reports/spending-velocity` - Daily burn rate and projections
- `GET /api/v1/reports/anomalies` - Detect unusual transactions (includes dynamic threshold)

### Filters & Export
- `GET /api/v1/filters` - List saved filters
- `POST /api/v1/filters` - Create saved filter
- `GET /api/v1/filters/{id}/apply` - Apply saved filter
- `GET /api/v1/transactions/export` - Export filtered transactions to CSV

### Account Management
- `GET /api/v1/accounts` - List accounts with credit card details
- `PATCH /api/v1/accounts/{id}` - Update account (credit limit, due date, etc.)

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
