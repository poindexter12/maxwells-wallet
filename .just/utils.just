# Utility recipes
set working-directory := '..'

# =============================================================================
# Cleaning
# =============================================================================

# Clean build artifacts and caches
clean:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Cleaning build artifacts..."
    rm -rf backend/__pycache__
    rm -rf backend/.pytest_cache
    rm -rf backend/app/__pycache__
    rm -rf backend/app/routers/__pycache__
    rm -rf frontend/.next
    rm -rf frontend/out
    rm -rf frontend/node_modules/.cache
    style 2 "Cleaned."

# Clean everything including dependencies and database (DESTRUCTIVE)
clean-all: clean
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 1 "WARNING: This will remove all dependencies and the database."
    if confirm "Remove all dependencies and database?" false; then
        rm -rf backend/.venv
        rm -rf frontend/node_modules
        rm -f backend/wallet.db
        style 2 "All cleaned."
    else
        style 12 "Clean-all cancelled."
    fi

# =============================================================================
# Status & Info
# =============================================================================

# Check status of services
status:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Service Status:"
    echo ""
    echo "Backend:"
    if curl -s http://localhost:8000/health 2>/dev/null; then
        style 2 "  Running at http://localhost:8000"
    else
        style 1 "  Not running"
    fi
    echo ""
    echo "Frontend:"
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        style 2 "  Running at http://localhost:3000"
    else
        style 1 "  Not running"
    fi
    echo ""

# Show project information
info:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    header "Maxwell's Wallet - Personal Finance Tracker"
    echo ""
    echo "Project: maxwells-wallet"
    echo "Backend:  FastAPI + Python + SQLModel"
    echo "Frontend: Next.js + TypeScript + Tailwind CSS"
    echo ""
    style 2 "Features:"
    echo "  - CSV import (BOFA, AMEX, Venmo, Inspira HSA)"
    echo "  - Smart categorization with rules"
    echo "  - Monthly spending analysis"
    echo "  - Budget tracking"
    echo "  - Transfer detection"
    echo "  - Merchant aliases"
    echo ""
    style 11 "Quick Start:"
    echo "  1. just setup       # First-time setup"
    echo "  2. just dev::dev    # Start development servers"
    echo "  3. Open http://localhost:3000"
    echo ""

# =============================================================================
# Dependency Checking
# =============================================================================

# Check if required dependencies are installed
check-deps:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Checking dependencies..."
    MISSING=0
    if command -v python3 >/dev/null 2>&1; then
        style 2 "python3 found"
    else
        style 1 "python3 not found"
        MISSING=1
    fi
    if command -v uv >/dev/null 2>&1; then
        style 2 "uv found"
    else
        style 1 "uv not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
        MISSING=1
    fi
    if command -v node >/dev/null 2>&1; then
        style 2 "node found"
    else
        style 1 "node not found"
        MISSING=1
    fi
    if command -v npm >/dev/null 2>&1; then
        style 2 "npm found"
    else
        style 1 "npm not found. Install Node.js from nodejs.org"
        MISSING=1
    fi
    if [ $MISSING -ne 0 ]; then
        exit 1
    fi
    just utils::check-node
    style 2 "All dependencies found."

# Check Node.js version matches .nvmrc (installs if needed via nvm)
check-node:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    if [ -f .nvmrc ]; then
        REQUIRED=$(cat .nvmrc)
        CURRENT=$(node -v 2>/dev/null | sed 's/v//')
        CURRENT_MAJOR=$(echo "$CURRENT" | cut -d. -f1)
        if [ "$CURRENT_MAJOR" != "$REQUIRED" ]; then
            style 11 "Node.js version mismatch: have v$CURRENT, need v$REQUIRED"
            if command -v nvm >/dev/null 2>&1 || [ -s "$HOME/.nvm/nvm.sh" ]; then
                style 12 "Installing Node $REQUIRED via nvm..."
                . "$HOME/.nvm/nvm.sh" && nvm install "$REQUIRED" && nvm use "$REQUIRED"
                style 2 "Node $REQUIRED installed. Run 'nvm use' or restart your shell."
            else
                style 1 "Please install Node $REQUIRED or run 'nvm use' if you have nvm"
                exit 1
            fi
        else
            style 2 "Node.js v$CURRENT (matches .nvmrc)"
        fi
    fi

# =============================================================================
# Test Data Anonymization (delegates to data/Makefile)
# =============================================================================

# Setup data anonymization environment (venv + deps)
data-setup:
    make -C data setup

# Show status of anonymized test data
data-status:
    make -C data status

# Anonymize CSV files in data/raw/ -> data/anonymized/
data-anonymize:
    make -C data anonymize

# Force re-anonymize all test data files
data-force:
    make -C data force

# Remove data anonymization venv
data-clean:
    make -C data clean
