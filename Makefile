.PHONY: help setup install install-backend install-frontend db-init db-seed db-reset backend frontend dev clean

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
	@echo "$(BLUE)Finances - Personal Finance Tracker$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

setup: ## First-time setup (install dependencies + seed database)
	@echo "$(BLUE)Setting up Finances app...$(NC)"
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
		. .venv/bin/activate && \
		uv pip install -e .
	@echo "$(GREEN)✓ Backend dependencies installed$(NC)"

install-frontend: ## Install frontend dependencies
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && npm install
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
	@rm -f $(BACKEND_DIR)/finances.db
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
		. .venv/bin/activate && \
		uv run pytest
	@echo "$(GREEN)✓ Tests complete$(NC)"

lint-frontend: ## Lint frontend code
	@echo "$(BLUE)Linting frontend...$(NC)"
	@cd $(FRONTEND_DIR) && npm run lint
	@echo "$(GREEN)✓ Linting complete$(NC)"

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
	@rm -f $(BACKEND_DIR)/finances.db
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
	@echo "$(BLUE)Finances - Personal Finance Tracker$(NC)"
	@echo ""
	@echo "Project: finances"
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
