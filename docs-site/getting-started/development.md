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

# Install dependencies (uv sync creates the .venv for you)
uv sync --all-extras

# Create tables, then seed sample data
uv run python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"
uv run python -m scripts.seed

# Start server (backend listens on port 3001)
uv run uvicorn app.main:app --reload --port 3001
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

Prefer the `just` recipes, which handle paths and environment setup:

```bash
just db::migrate MESSAGE="description"  # Create a new migration
just db::upgrade                        # Apply migrations
```

Equivalent manual commands:

```bash
cd backend
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```
