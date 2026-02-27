#!/bin/bash
set -e

echo "Setting up Maxwell's Wallet development environment..."

# Trust mise config and install all tools
mise trust
mise install

# Run project setup (install deps, init and seed database)
just setup

echo ""
echo "Development environment ready!"
echo ""
echo "Available commands:"
echo "  just dev::dev       - Start both frontend and backend"
echo "  just dev::backend   - Start backend only"
echo "  just dev::frontend  - Start frontend only"
echo "  just test::all      - Run all tests"
echo "  just --list         - Show all available commands"
echo ""
echo "Ports:"
echo "  http://localhost:3000  - Frontend (Next.js)"
echo "  http://localhost:3001  - Backend (FastAPI)"
