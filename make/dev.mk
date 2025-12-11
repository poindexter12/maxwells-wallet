# =============================================================================
# Development Targets
# =============================================================================

.PHONY: backend frontend dev build-frontend

backend: ## Run backend server (runs migrations first)
	@echo "$(BLUE)Running database migrations...$(NC)"
	@cd $(BACKEND_DIR) && uv run alembic upgrade head
	@echo "$(BLUE)Starting backend server...$(NC)"
	@cd $(BACKEND_DIR) && \
		. .venv/bin/activate && \
		uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Run frontend development server
	@if [ "$$ENABLE_PSEUDO" = "true" ]; then \
		echo "$(BLUE)ENABLE_PSEUDO=true: Regenerating pseudo-locale...$(NC)"; \
		cd $(FRONTEND_DIR) && node scripts/generate-pseudo-locale.js; \
	fi
	@echo "$(BLUE)Starting frontend server...$(NC)"
	@cd $(FRONTEND_DIR) && npm run dev

dev: ## Run both backend and frontend (in parallel)
	@echo "$(BLUE)Starting development servers...$(NC)"
	@$(MAKE) -j2 backend frontend

build-frontend: ## Build frontend for production
	@echo "$(BLUE)Building frontend...$(NC)"
	@cd $(FRONTEND_DIR) && npm run build
	@echo "$(GREEN)✓ Frontend built$(NC)"
