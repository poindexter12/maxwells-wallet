# Quick Start Guide

## Prerequisites

Install these first if you don't have them:

```bash
# Check if you have them
python3 --version  # Need 3.11+
node --version     # Need 18+
npm --version      # Comes with Node.js
uv --version       # If not: curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Setup (First Time)

```bash
# Option 1: Using Makefile (recommended)
make setup

# Option 2: Using shell script
./setup.sh
```

This will:
- Install all dependencies (backend + frontend)
- Initialize the database
- Load sample transactions from `/samples/`

## Start Development

```bash
# Start both backend and frontend servers
make dev
```

Then open: **http://localhost:3000**

The app will have sample data from your BOFA and AMEX CSVs already loaded.

## Stop Development

Press `Ctrl+C` to stop both servers.

## What's Running?

- **Backend API**: http://localhost:8000 (FastAPI)
- **Frontend**: http://localhost:3000 (Next.js)
- **API Docs**: http://localhost:8000/docs (Swagger UI)

## Common Tasks

```bash
# Start servers (both in parallel)
make dev

# Start servers separately
make backend        # Terminal 1
make frontend       # Terminal 2

# Reset database with fresh sample data
make db-reset

# Check if services are running
make status

# See all available commands
make help
```

## Explore the App

1. **Dashboard** (/) - View monthly summary, charts, trends
2. **Transactions** (/transactions) - Browse all transactions, filter, search, bulk edit
3. **Budgets** (/budgets) - Set spending limits and track progress
4. **Organize** (/organize) - Manage buckets, occasions, and accounts
5. **Tools** (/tools) - Transfer detection, rules engine, merchant aliases
6. **Admin** (/admin) - System configuration and data management
7. **Import** (/import) - Upload new CSV files
8. **Reconcile** (/reconcile) - Categorize and reconcile unprocessed transactions

## Importing Your Own Data

1. Go to Import page
2. Upload your BOFA or AMEX CSV file
3. The format will be auto-detected
4. Preview the transactions
5. Confirm to import

The app will:
- Extract merchant names from descriptions
- Auto-categorize based on keywords
- Skip duplicates
- Mark everything as "unreconciled"

Then go to Reconcile to review and categorize.

## Troubleshooting

**Services won't start?**
```bash
make clean
make db-reset
make dev
```

**Database is messed up?**
```bash
make db-reset      # Deletes DB and reloads sample data
```

**Need to reinstall everything?**
```bash
make clean-all     # Nuclear option
make setup         # Start fresh
```

**Check what's running:**
```bash
make status
```

## Next Steps

- Check `README.md` for full documentation
- Check `MAKEFILE_GUIDE.md` for all Makefile commands
