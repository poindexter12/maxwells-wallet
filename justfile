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
    # `uv sync` creates the .venv itself. A separate `uv venv` step errors on
    # re-runs once .venv exists (newer uv refuses without --clear), and under the
    # gum spinner that failure is hidden — which looks like a hang.
    #
    # CI installs straight from uv.lock (--frozen): no re-resolution, and the
    # lockfile is never rewritten by a CI run. Locally we keep the resolving
    # form so a pyproject.toml edit still updates the lock.
    if [ -n "${CI:-}" ]; then
      spin "Syncing backend packages (frozen)..." uv sync --all-extras --frozen
    else
      spin "Syncing backend packages..." uv sync --all-extras
    fi
    style 2 "Backend dependencies installed."

# Install frontend dependencies
install-frontend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Installing frontend dependencies..."
    cd frontend
    # One recipe, two jobs: locally `npm install` is right because it updates
    # package-lock.json when package.json changes. In CI that resolve step is
    # pure cost and the lock must be authoritative, so CI gets `npm ci`.
    if [ -n "${CI:-}" ]; then
      spin "Installing npm packages (ci)..." npm ci
    else
      spin "Installing npm packages..." npm install
    fi
    style 2 "Frontend dependencies installed."
