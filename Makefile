# =============================================================================
# Maxwell's Wallet - Makefile
# =============================================================================
#
# This is the main entry point for all make commands. Commands are organized
# into separate files under make/ for better maintainability:
#
#   make/dev.mk      - Development servers (backend, frontend, dev)
#   make/db.mk       - Database operations (init, seed, migrate)
#   make/test.mk     - Testing (unit, e2e, lint)
#   make/docker.mk   - Docker operations (build, up, down)
#   make/release.mk  - Release automation (release, release-patch)
#   make/i18n.mk     - Internationalization (upload, download, pseudo)
#   make/utils.mk    - Utilities (clean, status, info)
#
# Run 'make help' to see all available commands.
# =============================================================================

.DEFAULT_GOAL := help

# -----------------------------------------------------------------------------
# Shared Variables
# -----------------------------------------------------------------------------

# Color output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Directories
BACKEND_DIR := backend
FRONTEND_DIR := frontend

# Export for use in included files
export BLUE GREEN YELLOW RED NC BACKEND_DIR FRONTEND_DIR

# -----------------------------------------------------------------------------
# Core Targets
# -----------------------------------------------------------------------------

.PHONY: help setup install install-backend install-frontend

help: ## Show this help message
	@echo "$(BLUE)Maxwell's Wallet - Personal Finance Tracker$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@grep -hE '^[a-zA-Z0-9_-]+:.*## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Documentation:$(NC) See docs/MAKEFILE.md for detailed usage"
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

# -----------------------------------------------------------------------------
# Include Modular Makefiles
# -----------------------------------------------------------------------------

include make/dev.mk
include make/db.mk
include make/test.mk
include make/docker.mk
include make/release.mk
include make/i18n.mk
include make/utils.mk
