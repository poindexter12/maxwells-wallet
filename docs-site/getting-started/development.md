# Development Setup

Set up Maxwell's Wallet for local development.

## Prerequisites

- Python 3.11+
- Node.js 18+
- [uv](https://github.com/astral-sh/uv) - Fast Python package manager

## Using Make (Recommended)

```bash
# Install dependencies and seed database
make setup

# Start both servers
make dev
```

## Manual Setup

### Backend

```bash
cd backend

# Create virtual environment
uv venv
source .venv/bin/activate

# Install dependencies
uv pip install -e .

# Seed database
uv run python -m app.seed

# Start server
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
pnpm install  # or npm install

# Start dev server
pnpm dev
```

## Useful Commands

```bash
make help           # Show all commands
make test-backend   # Run backend tests
make db-reset       # Reset database
make db-seed        # Seed sample data
make status         # Check if servers running
```

## Database Migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```
