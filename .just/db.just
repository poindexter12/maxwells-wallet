# Database recipes
set working-directory := '..'

# Initialize database (create tables)
init:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Initializing database..."
    cd backend && spin "Creating database tables..." \
        uv run python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"
    style 2 "Database initialized."

# Seed database with sample data and default categories
seed:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Seeding database..."
    cd backend && spin "Inserting seed data..." \
        uv run python -m scripts.seed
    style 2 "Database seeded."

# Reset database (delete and recreate) — DESTRUCTIVE
reset:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 1 "WARNING: This will delete all data in the database."
    if confirm "Reset database? This will delete all data." false; then
        rm -f backend/wallet.db
        just db::init
        just db::seed
        style 2 "Database reset complete."
    else
        style 12 "Database reset cancelled."
    fi

# Create a new database migration
migrate MESSAGE="":
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    MESSAGE="{{ MESSAGE }}"
    if [ -z "$MESSAGE" ]; then
        if is_tty; then
            MESSAGE=$(gum input --placeholder "Migration message")
            if [ -z "$MESSAGE" ]; then
                style 1 "No migration message provided. Aborting."
                exit 1
            fi
        else
            style 1 "ERROR: MESSAGE parameter required in non-interactive mode."
            style 1 "Usage: just db::migrate 'add users table'"
            exit 1
        fi
    fi
    style 12 "Creating migration: $MESSAGE"
    cd backend && uv run alembic revision --autogenerate -m "$MESSAGE"
    style 2 "Migration created."

# Apply database migrations
upgrade:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Applying database migrations..."
    cd backend && spin "Running alembic upgrade head..." \
        uv run alembic upgrade head
    style 2 "Migrations applied."

# Set up demo mode (seed data + create demo backup)
demo-setup:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Setting up demo mode..."
    cd backend && uv run python -m scripts.setup_demo
    echo ""
    style 2 "Demo setup complete."
    style 3 "Start with: DEMO_MODE=true just dev::dev"
