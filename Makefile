.PHONY: help setup install install-backend install-frontend db-init db-seed db-reset backend frontend dev clean anonymize anonymize-status anonymize-force test-backend test-unit test-reports test-tags test-import test-budgets test-e2e test-e2e-install test-e2e-headed test-e2e-debug test-e2e-import test-e2e-full test-all docker-build docker-up docker-down docker-logs docker-shell docker-clean docker-seed docker-migrate release release-patch release-minor release-major

# Default target
.DEFAULT_GOAL := help

# Color output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Directories
BACKEND_DIR := backend
FRONTEND_DIR := frontend

help: ## Show this help message
	@echo "$(BLUE)Maxwell's Wallet - Personal Finance Tracker$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

setup: ## First-time setup (install dependencies + seed database)
	@echo "$(BLUE)Setting up Maxwell's Wallet...$(NC)"
	@$(MAKE) install
	@$(MAKE) db-init
	@$(MAKE) db-seed
	@echo "$(GREEN)✓ Setup complete!$(NC)"
	@echo ""
	@echo "Run '$(YELLOW)make dev$(NC)' to start both backend and frontend"

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install backend dependencies
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	@cd $(BACKEND_DIR) && \
		uv venv && \
		uv sync --all-extras
	@echo "$(GREEN)✓ Backend dependencies installed$(NC)"

install-frontend: ## Install frontend dependencies
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && npm install
	@cd $(FRONTEND_DIR) && npm install baseline-browser-mapping@latest -D 2>/dev/null || true
	@echo "$(GREEN)✓ Frontend dependencies installed$(NC)"

db-init: ## Initialize database (create tables)
	@echo "$(BLUE)Initializing database...$(NC)"
	@cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv run python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"
	@echo "$(GREEN)✓ Database initialized$(NC)"

db-seed: ## Seed database with sample data and default categories
	@echo "$(BLUE)Seeding database...$(NC)"
	@cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv run python -m app.seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

db-reset: ## Reset database (delete and recreate)
	@echo "$(RED)Resetting database...$(NC)"
	@rm -f $(BACKEND_DIR)/wallet.db
	@$(MAKE) db-init
	@$(MAKE) db-seed
	@echo "$(GREEN)✓ Database reset complete$(NC)"

db-migrate: ## Create new database migration
	@echo "$(BLUE)Creating database migration...$(NC)"
	@read -p "Migration message: " msg; \
	cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv run alembic revision --autogenerate -m "$$msg"
	@echo "$(GREEN)✓ Migration created$(NC)"

db-upgrade: ## Apply database migrations
	@echo "$(BLUE)Applying database migrations...$(NC)"
	@cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv run alembic upgrade head
	@echo "$(GREEN)✓ Migrations applied$(NC)"

backend: ## Run backend server
	@echo "$(BLUE)Starting backend server...$(NC)"
	@cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Run frontend development server
	@echo "$(BLUE)Starting frontend server...$(NC)"
	@cd $(FRONTEND_DIR) && npm run dev

dev: ## Run both backend and frontend (in parallel)
	@echo "$(BLUE)Starting development servers...$(NC)"
	@$(MAKE) -j2 backend frontend

build-frontend: ## Build frontend for production
	@echo "$(BLUE)Building frontend...$(NC)"
	@cd $(FRONTEND_DIR) && npm run build
	@echo "$(GREEN)✓ Frontend built$(NC)"

test-backend: ## Run backend tests
	@echo "$(BLUE)Running backend tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest --ignore=tests/e2e -v
	@echo "$(GREEN)✓ Tests complete$(NC)"

test-unit: test-backend ## Run unit/integration tests (alias)

test-reports: ## Run report/analytics tests only
	@echo "$(BLUE)Running report tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/test_reports.py tests/test_new_analytics.py -v
	@echo "$(GREEN)✓ Report tests complete$(NC)"

test-tags: ## Run tag system tests only
	@echo "$(BLUE)Running tag system tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/test_tags.py tests/test_tag_rules.py -v
	@echo "$(GREEN)✓ Tag system tests complete$(NC)"

test-import: ## Run CSV import tests only
	@echo "$(BLUE)Running import tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/test_csv_import.py -v
	@echo "$(GREEN)✓ Import tests complete$(NC)"

test-budgets: ## Run budget tests only
	@echo "$(BLUE)Running budget tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/test_budgets.py -v
	@echo "$(GREEN)✓ Budget tests complete$(NC)"

# =============================================================================
# End-to-End Tests (Playwright)
# =============================================================================

test-e2e-install: ## Install Playwright browsers for E2E tests
	@echo "$(BLUE)Installing Playwright browsers...$(NC)"
	@cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv pip install pytest-playwright playwright && \
		playwright install chromium
	@echo "$(GREEN)✓ Playwright browsers installed$(NC)"

test-e2e: ## Run E2E validation tests (requires 'make dev' running in another terminal)
	@echo "$(BLUE)Running E2E validation tests...$(NC)"
	@echo "$(YELLOW)Checking if servers are running...$(NC)"
	@curl -s http://localhost:8000/api/v1/transactions >/dev/null 2>&1 || { echo "$(RED)Backend not running. Start with: make dev$(NC)"; exit 1; }
	@curl -s http://localhost:3000 >/dev/null 2>&1 || { echo "$(RED)Frontend not running. Start with: make dev$(NC)"; exit 1; }
	@echo "$(GREEN)Servers detected, running tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/e2e -v --tb=short
	@echo "$(GREEN)✓ E2E tests complete$(NC)"

test-e2e-headed: ## Run E2E tests with visible browser
	@echo "$(BLUE)Running E2E tests (headed mode)...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/e2e -v --headed --tb=short
	@echo "$(GREEN)✓ E2E tests complete$(NC)"

test-e2e-debug: ## Run E2E tests in debug mode (slow, with browser visible)
	@echo "$(BLUE)Running E2E tests in debug mode...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		PWDEBUG=1 .venv/bin/python -m pytest tests/e2e -v -s --headed
	@echo "$(GREEN)✓ E2E debug session complete$(NC)"

test-e2e-import: ## Run only import workflow E2E tests
	@echo "$(BLUE)Running import workflow E2E tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/e2e/test_import_workflow.py -v
	@echo "$(GREEN)✓ Import E2E tests complete$(NC)"

test-e2e-full: ## Run full workflow E2E tests (slow)
	@echo "$(BLUE)Running full workflow E2E tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest tests/e2e/test_full_workflow.py -v --tb=short
	@echo "$(GREEN)✓ Full workflow E2E tests complete$(NC)"

test-all: test-backend test-e2e ## Run all tests (unit + E2E)

lint-frontend: ## Lint frontend code
	@echo "$(BLUE)Linting frontend...$(NC)"
	@cd $(FRONTEND_DIR) && npm run lint
	@echo "$(GREEN)✓ Linting complete$(NC)"

# =============================================================================
# Test Data Anonymization
# =============================================================================

anonymize: ## Anonymize CSV files in data/raw/ -> data/anonymized/
	@echo "$(BLUE)Anonymizing test data...$(NC)"
	@cd $(BACKEND_DIR) && . .venv/bin/activate && python ../scripts/anonymize_import.py
	@echo "$(GREEN)✓ Anonymization complete$(NC)"

anonymize-status: ## Show status of anonymized test data
	@cd $(BACKEND_DIR) && . .venv/bin/activate && python ../scripts/anonymize_import.py --status

anonymize-force: ## Force re-anonymize all test data files
	@echo "$(BLUE)Force re-anonymizing all test data...$(NC)"
	@cd $(BACKEND_DIR) && . .venv/bin/activate && python ../scripts/anonymize_import.py --force
	@echo "$(GREEN)✓ Anonymization complete$(NC)"

clean: ## Clean build artifacts and caches
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf $(BACKEND_DIR)/__pycache__
	@rm -rf $(BACKEND_DIR)/.pytest_cache
	@rm -rf $(BACKEND_DIR)/app/__pycache__
	@rm -rf $(BACKEND_DIR)/app/routers/__pycache__
	@rm -rf $(FRONTEND_DIR)/.next
	@rm -rf $(FRONTEND_DIR)/out
	@rm -rf $(FRONTEND_DIR)/node_modules/.cache
	@echo "$(GREEN)✓ Cleaned$(NC)"

clean-all: clean ## Clean everything including dependencies and database
	@echo "$(RED)Cleaning all dependencies and database...$(NC)"
	@rm -rf $(BACKEND_DIR)/.venv
	@rm -rf $(FRONTEND_DIR)/node_modules
	@rm -f $(BACKEND_DIR)/wallet.db
	@echo "$(GREEN)✓ All cleaned$(NC)"

status: ## Check status of services
	@echo "$(BLUE)Service Status:$(NC)"
	@echo ""
	@echo "Backend:"
	@curl -s http://localhost:8000/health 2>/dev/null && echo "$(GREEN)  ✓ Running at http://localhost:8000$(NC)" || echo "$(RED)  ✗ Not running$(NC)"
	@echo ""
	@echo "Frontend:"
	@curl -s http://localhost:3000 >/dev/null 2>&1 && echo "$(GREEN)  ✓ Running at http://localhost:3000$(NC)" || echo "$(RED)  ✗ Not running$(NC)"
	@echo ""

info: ## Show project information
	@echo "$(BLUE)Maxwell's Wallet - Personal Finance Tracker$(NC)"
	@echo ""
	@echo "Project: maxwells-wallet"
	@echo "Backend:  FastAPI + Python + SQLModel"
	@echo "Frontend: Next.js + TypeScript + Tailwind CSS"
	@echo ""
	@echo "$(GREEN)Features:$(NC)"
	@echo "  • CSV import (BOFA, AMEX)"
	@echo "  • Smart categorization"
	@echo "  • Monthly spending analysis"
	@echo "  • Transaction reconciliation"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  1. make setup      # First-time setup"
	@echo "  2. make dev        # Start development servers"
	@echo "  3. Open http://localhost:3000"
	@echo ""

.PHONY: check-deps
check-deps: ## Check if required dependencies are installed
	@echo "$(BLUE)Checking dependencies...$(NC)"
	@command -v python3 >/dev/null 2>&1 || { echo "$(RED)✗ Python 3 not found$(NC)"; exit 1; }
	@command -v uv >/dev/null 2>&1 || { echo "$(RED)✗ uv not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh$(NC)"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "$(RED)✗ Node.js not found$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)✗ npm not found. Install Node.js from nodejs.org$(NC)"; exit 1; }
	@echo "$(GREEN)✓ All dependencies found$(NC)"

# =============================================================================
# Docker targets
# =============================================================================

.PHONY: docker-build docker-build-force docker-up docker-down docker-logs docker-shell

docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker compose build
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-build-force: ## Build Docker image (no cache)
	@echo "$(BLUE)Building Docker image (no cache)...$(NC)"
	docker compose build --no-cache
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-up: ## Start Docker container
	@echo "$(BLUE)Starting Docker container...$(NC)"
	docker compose up -d
	@echo "$(GREEN)✓ Container started$(NC)"
	@echo ""
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8000"

docker-down: ## Stop Docker container
	@echo "$(BLUE)Stopping Docker container...$(NC)"
	docker compose down
	@echo "$(GREEN)✓ Container stopped$(NC)"

docker-logs: ## View Docker logs
	docker compose logs -f

docker-shell: ## Open shell in Docker container
	docker compose exec maxwells-wallet /bin/bash

docker-clean: ## Remove Docker containers and volumes
	@echo "$(RED)Removing Docker containers and volumes...$(NC)"
	docker compose down -v
	@echo "$(GREEN)✓ Cleaned$(NC)"

docker-seed: ## Seed database with sample data
	@echo "$(BLUE)Seeding database...$(NC)"
	docker compose run --rm maxwells-wallet seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

docker-migrate: ## Run database migrations
	@echo "$(BLUE)Running migrations...$(NC)"
	docker compose run --rm maxwells-wallet migrate
	@echo "$(GREEN)✓ Migrations complete$(NC)"

# =============================================================================
# Release targets
# =============================================================================

# Get current version from backend/pyproject.toml
CURRENT_VERSION := $(shell grep -E '^version = ' $(BACKEND_DIR)/pyproject.toml | sed 's/version = "\(.*\)"/\1/')

release: ## Create a release (usage: make release VERSION=x.y.z)
ifndef VERSION
	@echo "$(RED)Error: VERSION is required$(NC)"
	@echo "Usage: make release VERSION=x.y.z"
	@echo "   or: make release-patch  ($(CURRENT_VERSION) -> next patch)"
	@echo "   or: make release-minor  ($(CURRENT_VERSION) -> next minor)"
	@echo "   or: make release-major  ($(CURRENT_VERSION) -> next major)"
	@exit 1
endif
	@echo "$(BLUE)Creating release v$(VERSION)...$(NC)"
	@# Update backend version
	@sed -i '' 's/^version = ".*"/version = "$(VERSION)"/' $(BACKEND_DIR)/pyproject.toml
	@# Update frontend version
	@sed -i '' 's/"version": ".*"/"version": "$(VERSION)"/' $(FRONTEND_DIR)/package.json
	@# Generate changelog entry
	@./scripts/generate-changelog.sh $(VERSION)
	@# Commit and tag
	@git add -A
	@git commit -m "chore: release v$(VERSION)"
	@git tag v$(VERSION)
	@# Push to trigger GitHub Actions
	@echo "$(BLUE)Pushing to GitHub...$(NC)"
	@git push origin main --tags
	@echo ""
	@echo "$(GREEN)✓ Release v$(VERSION) created!$(NC)"
	@echo ""
	@echo "GitHub Actions will now:"
	@echo "  1. Create GitHub Release with changelog"
	@echo "  2. Build Docker image"
	@echo "  3. Push to ghcr.io/poindexter12/maxwells-wallet:$(VERSION)"
	@echo ""
	@echo "Monitor progress: $(YELLOW)gh run watch$(NC)"

release-patch: ## Create a patch release (x.y.Z+1)
	@NEW_VERSION=$$(echo $(CURRENT_VERSION) | awk -F. '{print $$1"."$$2"."$$3+1}'); \
	$(MAKE) release VERSION=$$NEW_VERSION

release-minor: ## Create a minor release (x.Y+1.0)
	@NEW_VERSION=$$(echo $(CURRENT_VERSION) | awk -F. '{print $$1"."$$2+1".0"}'); \
	$(MAKE) release VERSION=$$NEW_VERSION

release-major: ## Create a major release (X+1.0.0)
	@NEW_VERSION=$$(echo $(CURRENT_VERSION) | awk -F. '{print $$1+1".0.0"}'); \
	$(MAKE) release VERSION=$$NEW_VERSION
