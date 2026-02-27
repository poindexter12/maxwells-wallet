# Development Setup

Set up Maxwell's Wallet for local development.

## Prerequisites

Install [mise](https://mise.jdx.dev/) (tool version manager):
```bash
curl https://mise.run | sh
```

mise auto-installs all dev tools (Node, Python, uv, just, gum) when you enter the project directory.

## Using Just (Recommended)

```bash
# Install dependencies and seed database
just setup

# Start both servers
just dev::dev
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
npm install

# Start dev server
npm run dev
```

## Useful Recipes

```bash
just                    # Show all available recipes
just test::backend      # Run backend tests
just db::reset          # Reset database
just db::seed           # Seed sample data
just utils::status      # Check if servers running
```

## Database Migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```
