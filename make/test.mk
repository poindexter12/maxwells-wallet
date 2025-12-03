# =============================================================================
# Testing Targets
# =============================================================================

.PHONY: test-backend test-unit test-coverage test-reports test-tags test-import test-budgets
.PHONY: test-e2e-install test-e2e test-e2e-headed test-e2e-debug test-e2e-import test-e2e-full
.PHONY: test-all lint-frontend
.PHONY: lint lint-backend vulture dead-code typecheck quality security-audit

# -----------------------------------------------------------------------------
# Unit & Integration Tests
# -----------------------------------------------------------------------------

test-backend: ## Run backend tests
	@echo "$(BLUE)Running backend tests...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest --ignore=tests/e2e -v
	@echo "$(GREEN)✓ Tests complete$(NC)"

test-unit: test-backend ## Run unit/integration tests (alias)

test-coverage: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@cd $(BACKEND_DIR) && \
		unset VIRTUAL_ENV && \
		.venv/bin/python -m pytest --ignore=tests/e2e -v --cov=app --cov-report=term-missing --cov-report=html
	@echo "$(GREEN)✓ Coverage report generated in backend/htmlcov/$(NC)"

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

# -----------------------------------------------------------------------------
# End-to-End Tests (Playwright)
# -----------------------------------------------------------------------------

test-e2e-install: ## Install Playwright browsers for E2E tests
	@echo "$(BLUE)Installing Playwright browsers...$(NC)"
	@cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv pip install pytest-playwright playwright && \
		playwright install chromium
	@echo "$(GREEN)✓ Playwright browsers installed$(NC)"

test-e2e: ## Run E2E validation tests (requires 'make dev' running)
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

# -----------------------------------------------------------------------------
# Linting
# -----------------------------------------------------------------------------

lint-frontend: ## Lint frontend code
	@echo "$(BLUE)Linting frontend...$(NC)"
	@cd $(FRONTEND_DIR) && npm run lint
	@echo "$(GREEN)✓ Linting complete$(NC)"

# -----------------------------------------------------------------------------
# Code Quality (Backend)
# -----------------------------------------------------------------------------

lint-backend: ## Lint backend code with ruff
	@echo "$(BLUE)Linting backend with ruff...$(NC)"
	@cd $(BACKEND_DIR) && uv run ruff check .
	@echo "$(GREEN)✓ Linting complete$(NC)"

lint: lint-backend lint-frontend ## Lint all code

vulture: ## Find dead code with vulture
	@echo "$(BLUE)Scanning for dead code...$(NC)"
	@cd $(BACKEND_DIR) && uv run vulture app/ --min-confidence 80
	@echo "$(GREEN)✓ No dead code found$(NC)"

dead-code: vulture ## Alias for vulture

typecheck: ## Run type checking with mypy
	@echo "$(BLUE)Type checking with mypy...$(NC)"
	@cd $(BACKEND_DIR) && uv run mypy app --ignore-missing-imports
	@echo "$(GREEN)✓ Type checking complete$(NC)"

quality: lint-backend vulture typecheck ## Run all code quality checks
	@echo "$(GREEN)✓ All quality checks passed$(NC)"

security-audit: ## Scan dependencies for known vulnerabilities
	@echo "$(BLUE)Scanning for security vulnerabilities...$(NC)"
	@cd $(BACKEND_DIR) && uv run pip-audit
	@echo "$(GREEN)✓ No known vulnerabilities$(NC)"
