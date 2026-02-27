# Testing recipes

# =============================================================================
# Unit & Integration Tests
# =============================================================================

# Run backend tests
backend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running backend tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest --ignore=tests/e2e --ignore=tests/performance -v
    style 2 "Tests complete."

# Run unit/integration tests (alias for backend)
unit:
    @just test::backend

# Run tests with coverage report
coverage:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running tests with coverage..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest --ignore=tests/e2e --ignore=tests/performance -v \
        --cov=app --cov-report=term-missing --cov-report=html
    style 2 "Coverage report generated in backend/htmlcov/"

# Run report/analytics tests only
reports:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running report tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/test_reports.py tests/test_new_analytics.py -v
    style 2 "Report tests complete."

# Run tag system tests only
tags:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running tag system tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/test_tags.py tests/test_tag_rules.py -v
    style 2 "Tag system tests complete."

# Run CSV import tests only
import:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running import tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/test_csv_import.py -v
    style 2 "Import tests complete."

# Run budget tests only
budgets:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running budget tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/test_budgets.py -v
    style 2 "Budget tests complete."

# =============================================================================
# End-to-End Tests (Playwright)
# =============================================================================

# Install Playwright browsers for E2E tests
e2e-install:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Installing Playwright browsers..."
    cd backend && . .venv/bin/activate
    spin "Installing pytest-playwright and playwright..." uv pip install pytest-playwright playwright
    spin "Installing Chromium browser..." playwright install chromium
    style 2 "Playwright browsers installed."

# Run E2E validation tests (requires dev servers running)
e2e:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running E2E validation tests..."
    style 11 "Checking if servers are running..."
    curl -s http://localhost:8000/api/v1/transactions >/dev/null 2>&1 || { style 1 "Backend not running. Start with: just dev::dev"; exit 1; }
    curl -s http://localhost:3000 >/dev/null 2>&1 || { style 1 "Frontend not running. Start with: just dev::dev"; exit 1; }
    style 2 "Servers detected, running tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/e2e -v --tb=short
    style 2 "E2E tests complete."

# Run E2E tests with visible browser
e2e-headed:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running E2E tests (headed mode)..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/e2e -v --headed --tb=short
    style 2 "E2E tests complete."

# Run E2E tests in debug mode (slow, with browser visible)
e2e-debug:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running E2E tests in debug mode..."
    cd backend && unset VIRTUAL_ENV && \
        PWDEBUG=1 .venv/bin/python -m pytest tests/e2e -v -s --headed
    style 2 "E2E debug session complete."

# Run only import workflow E2E tests
e2e-import:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running import workflow E2E tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/e2e/test_import_workflow.py -v
    style 2 "Import E2E tests complete."

# Run full workflow E2E tests (slow)
e2e-full:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running full workflow E2E tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/e2e/test_full_workflow.py -v --tb=short
    style 2 "Full workflow E2E tests complete."

# =============================================================================
# Chaos Tests
# =============================================================================

# Run chaos/monkey tests (requires dev servers running)
chaos:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running chaos tests..."
    style 11 "Checking if servers are running..."
    curl -s http://localhost:3001/health >/dev/null 2>&1 || { style 1 "Backend not running. Start with: just dev::dev"; exit 1; }
    curl -s http://localhost:3000 >/dev/null 2>&1 || { style 1 "Frontend not running. Start with: just dev::dev"; exit 1; }
    style 2 "Servers detected, running chaos tests..."
    cd frontend && SKIP_MIGRATIONS=1 npx playwright test chaos/ --reporter=line
    style 2 "Chaos tests complete."

# Run chaos tests with visible browser
chaos-headed:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running chaos tests (headed mode)..."
    cd frontend && SKIP_MIGRATIONS=1 npx playwright test chaos/ --headed --reporter=line
    style 2 "Chaos tests complete."

# =============================================================================
# Performance Tests
# =============================================================================

# Run performance tests (10k+ transactions, slow)
perf:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running performance tests..."
    style 11 "This will generate a large test dataset (~10k transactions)"
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/performance -v -m performance --tb=short
    style 2 "Performance tests complete."

# Run quick performance tests (skip slow benchmarks)
perf-quick:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running quick performance tests..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/performance -v -m "performance and not slow" --tb=short
    style 2 "Quick performance tests complete."

# Run performance tests with query logging
perf-verbose:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Running performance tests with query logging..."
    cd backend && unset VIRTUAL_ENV && \
        .venv/bin/python -m pytest tests/performance -v -m performance --tb=long -s
    style 2 "Performance tests complete."

# =============================================================================
# Linting
# =============================================================================

# Lint frontend code
lint-frontend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Linting frontend..."
    cd frontend && npm run lint
    style 2 "Frontend linting complete."

# Lint backend code with ruff
lint-backend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Linting backend with ruff..."
    cd backend && uv run ruff check .
    style 2 "Backend linting complete."

# Lint all code (backend + frontend)
lint: lint-backend lint-frontend

# =============================================================================
# Code Quality
# =============================================================================

# Find dead code with vulture
vulture:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Scanning for dead code..."
    cd backend && uv run vulture app/ --min-confidence 80
    style 2 "No dead code found."

# Alias for vulture
dead-code:
    @just test::vulture

# Run type checking with mypy
typecheck:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Type checking with mypy..."
    cd backend && uv run mypy app --ignore-missing-imports
    style 2 "Type checking complete."

# Run all code quality checks
quality: lint-backend vulture typecheck

# Scan dependencies for known vulnerabilities
security-audit:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    style 12 "Scanning for security vulnerabilities..."
    cd backend && uv run pip-audit
    style 2 "No known vulnerabilities."

# =============================================================================
# Aggregate
# =============================================================================

# Run all tests (unit + E2E)
all: backend e2e
