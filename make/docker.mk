# =============================================================================
# Docker Targets
# =============================================================================

.PHONY: docker docker-build docker-build-force docker-up docker-down docker-logs
.PHONY: docker-shell docker-clean docker-seed docker-migrate
.PHONY: docker-with-pseudo docker-build-pseudo

docker: docker-build docker-up ## Build and start Docker container

docker-with-pseudo: docker-build-pseudo docker-up ## Build and start Docker with pseudo locale for i18n QA

docker-build-pseudo: ## Build Docker image with pseudo locale enabled
	@echo "$(BLUE)Building Docker image with pseudo locale...$(NC)"
	ENABLE_PSEUDO=true docker compose build
	@echo "$(GREEN)✓ Docker image built with pseudo locale$(NC)"

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

docker-seed: ## Seed database in Docker with sample data
	@echo "$(BLUE)Seeding database...$(NC)"
	docker compose run --rm maxwells-wallet seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

docker-migrate: ## Run database migrations in Docker
	@echo "$(BLUE)Running migrations...$(NC)"
	docker compose run --rm maxwells-wallet migrate
	@echo "$(GREEN)✓ Migrations complete$(NC)"
