# Finances - Personal Finance Tracker

Personal finance tracker with CSV import, smart categorization, and spending trend analysis.

Built with:
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python (async)
- **Database**: SQLite (dev) with SQLModel ORM
- **Charts**: Recharts

## Features

- **CSV Import**: Import transactions from Bank of America and American Express
  - Auto-detects format
  - Deduplicates transactions
  - Saves format preferences
- **Smart Categorization**: Auto-categorizes transactions using keyword matching and learning from past categorizations
- **Dashboard**: Monthly spending analysis with charts and trends
- **Reconciliation**: Bulk reconcile unreconciled transactions
- **Transaction Management**: Search, filter, and categorize transactions

## Quick Start

### Using Makefile (Recommended)

```bash
# First-time setup (installs dependencies + seeds database)
make setup

# Start development servers (backend + frontend)
make dev

# Open http://localhost:3000
```

**Common Makefile commands:**
```bash
make help          # Show all available commands
make setup         # First-time setup
make dev           # Start both servers
make backend       # Start backend only
make frontend      # Start frontend only
make db-reset      # Reset database
make db-seed       # Seed sample data
make clean         # Clean build artifacts
make status        # Check if services are running
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
finances/
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
├── samples/                # Sample CSV files
│   ├── bofa.csv
│   └── amex.csv
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

### Reports
- `GET /api/v1/reports/monthly-summary` - Monthly spending summary
- `GET /api/v1/reports/trends` - Spending trends over time
- `GET /api/v1/reports/top-merchants` - Top merchants by spending
- `GET /api/v1/reports/account-summary` - Summary by account

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

## Sample Data

The `/samples/` directory contains real CSV files from Bank of America and American Express. These are automatically imported when running the seeding script.

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
rm finances.db
uv run python -m app.seed
```

## License

Private prototype - not for redistribution
