#!/bin/bash
set -e

echo "🚀 Setting up Maxwell's Wallet development environment..."

# Verify uv is available (installed in Dockerfile via COPY --from)
if ! command -v uv &> /dev/null; then
    echo "❌ uv not found — expected to be installed in the container image"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
make install

# Initialize database directly from models (not migrations)
# This works for fresh databases; existing users should run `make db-upgrade`
echo "📦 Initializing database..."
cd backend && uv run python -m scripts.init_db
cd ..

# Seed with sample data
echo "📦 Seeding database..."
make db-seed

echo ""
echo "✅ Development environment ready!"
echo ""
echo "Available commands:"
echo "  make dev          - Start both frontend and backend"
echo "  make backend      - Start backend only"
echo "  make frontend     - Start frontend only"
echo "  make test-all     - Run all tests"
echo "  make help         - Show all available commands"
echo ""
echo "Ports:"
echo "  http://localhost:3000  - Frontend (Next.js)"
echo "  http://localhost:3001  - Backend (FastAPI)"
