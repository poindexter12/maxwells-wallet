# Quick Start Guide

## Prerequisites

Install [mise](https://mise.jdx.dev/) (tool version manager):

```bash
curl https://mise.run | sh
```

mise auto-installs all dev tools (Node, Python, uv, just, gum) when you enter the project directory. No other manual tool installation required.

## Setup (First Time)

```bash
just setup
```

This will:
- Install all dependencies (backend + frontend)
- Initialize the database
- Load sample transactions from `/samples/`

## Start Development

```bash
# Start both backend and frontend servers
just dev::dev
```

Then open: **http://localhost:3000**

On first run, you'll be prompted to create a username and password.

The app will have sample data from your BOFA and AMEX CSVs already loaded.

## Stop Development

Press `Ctrl+C` to stop both servers.

## What's Running?

- **Frontend**: http://localhost:3000 (Next.js)
- **Backend API**: http://localhost:3001 (FastAPI)
- **API Docs**: http://localhost:3001/docs (Swagger UI)

## Common Tasks

```bash
# Start servers (both in parallel)
just dev::dev

# Start servers separately
just dev::backend       # Terminal 1
just dev::frontend      # Terminal 2

# Reset database with fresh sample data
just db::reset

# Check if services are running
just utils::status

# See all available commands
just
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
just utils::clean
just db::reset
just dev::dev
```

**Database is messed up?**
```bash
just db::reset          # Deletes DB and reloads sample data
```

**Need to reinstall everything?**
```bash
just utils::clean-all   # Nuclear option
just setup              # Start fresh
```

**Check what's running:**
```bash
just utils::status
```

## Next Steps

- Check `README.md` for full documentation
- Run bare `just` to see all available commands
