# =============================================================================
# Database Targets
# =============================================================================

.PHONY: db-init db-seed db-reset db-migrate db-upgrade

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
