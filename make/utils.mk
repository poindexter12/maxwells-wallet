# =============================================================================
# Utility Targets
# =============================================================================

.PHONY: clean clean-all status info check-deps check-node
.PHONY: data-setup data-anonymize data-status data-force data-clean

# -----------------------------------------------------------------------------
# Cleaning
# -----------------------------------------------------------------------------

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

# -----------------------------------------------------------------------------
# Status & Info
# -----------------------------------------------------------------------------

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
	@echo "  • CSV import (BOFA, AMEX, Venmo, Inspira HSA)"
	@echo "  • Smart categorization with rules"
	@echo "  • Monthly spending analysis"
	@echo "  • Budget tracking"
	@echo "  • Transfer detection"
	@echo "  • Merchant aliases"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  1. make setup      # First-time setup"
	@echo "  2. make dev        # Start development servers"
	@echo "  3. Open http://localhost:3000"
	@echo ""

check-deps: ## Check if required dependencies are installed
	@echo "$(BLUE)Checking dependencies...$(NC)"
	@command -v python3 >/dev/null 2>&1 || { echo "$(RED)✗ Python 3 not found$(NC)"; exit 1; }
	@command -v uv >/dev/null 2>&1 || { echo "$(RED)✗ uv not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh$(NC)"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "$(RED)✗ Node.js not found$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)✗ npm not found. Install Node.js from nodejs.org$(NC)"; exit 1; }
	@$(MAKE) check-node
	@echo "$(GREEN)✓ All dependencies found$(NC)"

check-node: ## Check Node.js version matches .nvmrc (installs if needed via nvm)
	@if [ -f .nvmrc ]; then \
		REQUIRED=$$(cat .nvmrc); \
		CURRENT=$$(node -v 2>/dev/null | sed 's/v//'); \
		CURRENT_MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
		if [ "$$CURRENT_MAJOR" != "$$REQUIRED" ]; then \
			echo "$(YELLOW)Node.js version mismatch: have v$$CURRENT, need v$$REQUIRED$(NC)"; \
			if command -v nvm >/dev/null 2>&1 || [ -s "$$HOME/.nvm/nvm.sh" ]; then \
				echo "$(BLUE)Installing Node $$REQUIRED via nvm...$(NC)"; \
				. "$$HOME/.nvm/nvm.sh" && nvm install $$REQUIRED && nvm use $$REQUIRED; \
				echo "$(GREEN)✓ Node $$REQUIRED installed. Run 'nvm use' or restart your shell.$(NC)"; \
			else \
				echo "$(RED)Please install Node $$REQUIRED or run 'nvm use' if you have nvm$(NC)"; \
				exit 1; \
			fi; \
		else \
			echo "$(GREEN)✓ Node.js v$$CURRENT (matches .nvmrc)$(NC)"; \
		fi; \
	fi

# -----------------------------------------------------------------------------
# Test Data Anonymization (delegates to data/Makefile)
# -----------------------------------------------------------------------------

data-setup: ## Setup data anonymization environment (venv + deps)
	@$(MAKE) -C data setup

data-status: ## Show status of anonymized test data
	@$(MAKE) -C data status

data-anonymize: ## Anonymize CSV files in data/raw/ -> data/anonymized/
	@$(MAKE) -C data anonymize

data-force: ## Force re-anonymize all test data files
	@$(MAKE) -C data force

data-clean: ## Remove data anonymization venv
	@$(MAKE) -C data clean

