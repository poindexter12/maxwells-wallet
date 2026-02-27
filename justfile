# Maxwell's Wallet - Task Runner
# Run `just --list` to see all available recipes

set shell := ['bash', '-euo', 'pipefail', '-c']
set dotenv-load := false  # mise handles .env loading

# Shared variables
BACKEND_DIR := "backend"
FRONTEND_DIR := "frontend"

# Module imports
mod dev '.just/dev.just'
mod db '.just/db.just'
mod test '.just/test.just'
mod docker '.just/docker.just'
mod release '.just/release.just'
mod i18n '.just/i18n.just'
mod utils '.just/utils.just'

# First-time project setup (install deps, init and seed database)
setup: install
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    header "Maxwell's Wallet Setup"
    just db::init
    just db::seed
    style 2 "Setup complete! Run 'just dev::dev' to start development servers."

# Install all dependencies (backend + frontend)
install: install-backend install-frontend

# Install backend dependencies
install-backend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Installing backend dependencies..."
    cd backend
    spin "Creating virtual environment..." uv venv --clear
    spin "Syncing backend packages..." uv sync --all-extras
    style 2 "Backend dependencies installed."

# Install frontend dependencies
install-frontend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Installing frontend dependencies..."
    cd frontend
    spin "Installing npm packages..." npm install
    style 2 "Frontend dependencies installed."
