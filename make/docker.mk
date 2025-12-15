# =============================================================================
# Docker Targets
# =============================================================================

# Development targets use docker-compose.dev.yaml (builds from source)
# End users should use docker-compose.yaml (pulls from registry)

COMPOSE_DEV := docker compose -f docker-compose.dev.yaml
COMPOSE_DEMO := docker compose -f docker-compose.demo.yaml

.PHONY: docker docker-build docker-build-force docker-up docker-down docker-logs
.PHONY: docker-shell docker-clean docker-seed docker-migrate
.PHONY: docker-with-pseudo docker-build-pseudo
.PHONY: docker-with-demo docker-demo-up docker-demo-seed

docker: docker-build docker-up ## Build and start Docker container (dev)

docker-with-pseudo: docker-build-pseudo docker-up ## Build and start Docker with pseudo locale for i18n QA

docker-with-demo: docker-demo-up docker-demo-seed ## Start Docker in demo mode with sample data

docker-build-pseudo: ## Build Docker image with pseudo locale enabled (no cache)
	@echo "$(BLUE)Building Docker image with pseudo locale (no cache)...$(NC)"
	ENABLE_PSEUDO=true $(COMPOSE_DEV) build --no-cache
	@echo "$(GREEN)✓ Docker image built with pseudo locale$(NC)"

docker-build: ## Build Docker image from source
	@echo "$(BLUE)Building Docker image...$(NC)"
	$(COMPOSE_DEV) build
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-build-force: ## Build Docker image (no cache)
	@echo "$(BLUE)Building Docker image (no cache)...$(NC)"
	$(COMPOSE_DEV) build --no-cache
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-up: ## Start Docker container
	@echo "$(BLUE)Starting Docker container...$(NC)"
	$(COMPOSE_DEV) up -d
	@echo "$(GREEN)✓ Container started$(NC)"
	@echo ""
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:3001"

docker-down: ## Stop Docker container
	@echo "$(BLUE)Stopping Docker container...$(NC)"
	$(COMPOSE_DEV) down
	@echo "$(GREEN)✓ Container stopped$(NC)"

docker-logs: ## View Docker logs
	$(COMPOSE_DEV) logs -f

docker-shell: ## Open shell in Docker container
	$(COMPOSE_DEV) exec maxwells-wallet /bin/bash

docker-clean: ## Remove Docker containers and volumes
	@echo "$(RED)Removing Docker containers and volumes...$(NC)"
	$(COMPOSE_DEV) down -v
	@echo "$(GREEN)✓ Cleaned$(NC)"

docker-seed: ## Seed database in Docker with sample data
	@echo "$(BLUE)Seeding database...$(NC)"
	$(COMPOSE_DEV) run --rm maxwells-wallet seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

docker-migrate: ## Run database migrations in Docker
	@echo "$(BLUE)Running migrations...$(NC)"
	$(COMPOSE_DEV) run --rm maxwells-wallet migrate
	@echo "$(GREEN)✓ Migrations complete$(NC)"

docker-demo-up: ## Start Docker container in demo mode (pulls from registry)
	@echo "$(BLUE)Starting Docker container in demo mode...$(NC)"
	$(COMPOSE_DEMO) up -d
	@echo "$(GREEN)✓ Container started in demo mode$(NC)"
	@echo ""
	@echo "$(YELLOW)Demo mode enabled - data resets hourly$(NC)"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:3001"

docker-demo-seed: ## Seed demo data and create demo backup
	@echo "$(BLUE)Setting up demo data...$(NC)"
	$(COMPOSE_DEMO) run --rm maxwells-wallet demo-setup
	@echo "$(GREEN)✓ Demo data seeded$(NC)"
