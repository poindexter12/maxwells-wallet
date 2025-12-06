#!/bin/sh
# Maxwell's Wallet Backend Start Script
#
# Usage:
#   ./start.sh serve       - Run migrations and start server (default)
#   ./start.sh seed        - Run migrations and seed database
#   ./start.sh seed-clear  - Run migrations, clear data, and seed
#   ./start.sh migrate     - Run migrations only

set -e

COMMAND=${1:-serve}

echo "========================================"
echo "Maxwell's Wallet Backend"
echo "Command: $COMMAND"
echo "========================================"

# Always run migrations first
echo "Running database migrations..."
alembic upgrade head

case "$COMMAND" in
    serve)
        echo "Starting server..."
        exec uvicorn app.main:app --host 0.0.0.0 --port 3001
        ;;
    seed)
        echo "Seeding database..."
        python -m scripts.seed
        echo "Seeding complete."
        ;;
    seed-clear)
        echo "Clearing and seeding database..."
        python -m scripts.seed --clear
        echo "Seeding complete."
        ;;
    migrate)
        echo "Migrations complete."
        ;;
    seed-serve)
        echo "Seeding database..."
        python -m scripts.seed
        echo "Starting server..."
        exec uvicorn app.main:app --host 0.0.0.0 --port 3001
        ;;
    seed-clear-serve)
        echo "Clearing and seeding database..."
        python -m scripts.seed --clear
        echo "Starting server..."
        exec uvicorn app.main:app --host 0.0.0.0 --port 3001
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo "Available commands: serve, seed, seed-clear, migrate, seed-serve, seed-clear-serve"
        exit 1
        ;;
esac
