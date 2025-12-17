# =============================================================================
# SWAG Demo Deployment
# =============================================================================
#
# Runs Maxwell's Wallet behind SWAG reverse proxy in demo mode.
# Data resets every hour. Optionally exposes via Cloudflare tunnel.
#
# Quick start:
#   make up          - Start local demo at http://localhost:8888
#   make cloudflare  - Start with Cloudflare tunnel (prompts for token)
#   make down        - Stop everything
#
# Prerequisites:
#   - Docker with Compose v2
#   - Cloudflare account (for tunnel, optional)
#
# Files:
#   docker-compose.yaml      - Main stack (SWAG + app)
#   docker-compose.dind.yaml - Docker-in-Docker for testing
#   swag/nginx.conf          - Reverse proxy config
#   .env                     - Cloudflare token (create from .env.example)
#
# =============================================================================

.DEFAULT_GOAL := help

BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

.PHONY: help up down logs cloudflare tunnel-setup clean test

help: ## Show this help
	@echo "$(BLUE)SWAG Demo Deployment$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "Examples:"
	@echo "  make up              Start local demo"
	@echo "  make cloudflare      Start with Cloudflare tunnel"

up: ## Start SWAG + app in demo mode (http://localhost:8888)
	@echo "$(BLUE)Starting SWAG demo...$(NC)"
	docker compose up -d --build
	@echo "$(GREEN)✓ Started$(NC)"
	@echo ""
	@echo "Access at: http://localhost:8888"
	@echo "$(YELLOW)Demo mode - data resets hourly$(NC)"

down: ## Stop all services
	@echo "$(BLUE)Stopping...$(NC)"
	docker compose --profile cloudflare down
	@echo "$(GREEN)✓ Stopped$(NC)"

logs: ## View container logs
	docker compose logs -f

cloudflare: tunnel-setup ## Start with Cloudflare tunnel (prompts for token if needed)
	@echo "$(BLUE)Starting with Cloudflare tunnel...$(NC)"
	docker compose --profile cloudflare up -d --build
	@echo "$(GREEN)✓ Started with Cloudflare tunnel$(NC)"
	@echo ""
	@echo "Local: http://localhost:8888"
	@echo "External: Via your Cloudflare tunnel hostname"

tunnel-setup: ## Configure Cloudflare tunnel token interactively
	@if [ -f ".env" ] && grep -q "CLOUDFLARE_TUNNEL_TOKEN=." ".env"; then \
		echo "$(GREEN)✓ Tunnel token already configured$(NC)"; \
		read -p "Reconfigure? [y/N] " confirm; \
		if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
			exit 0; \
		fi; \
	fi; \
	echo ""; \
	echo "$(BLUE)Cloudflare Tunnel Setup$(NC)"; \
	echo ""; \
	echo "1. Go to: https://one.dash.cloudflare.com/"; \
	echo "2. Navigate to: Networks → Tunnels → Create"; \
	echo "3. Configure public hostname to point to: http://swag:80"; \
	echo "4. Copy the tunnel token"; \
	echo ""; \
	read -p "Paste your Cloudflare Tunnel Token: " token; \
	if [ -z "$$token" ]; then \
		echo "$(RED)✗ No token provided$(NC)"; \
		exit 1; \
	fi; \
	echo "CLOUDFLARE_TUNNEL_TOKEN=$$token" > .env; \
	echo "$(GREEN)✓ Token saved to .env$(NC)"

clean: ## Remove containers, volumes, and .env
	@echo "$(RED)Removing containers and volumes...$(NC)"
	docker compose --profile cloudflare down -v
	rm -f .env
	@echo "$(GREEN)✓ Cleaned$(NC)"

test: ## Run configuration tests
	@echo "$(BLUE)Running tests...$(NC)"
	cd ../.. && cd backend && uv run python -m pytest ../deploy/swag-test/test_config.py -v
	@echo "$(GREEN)✓ Tests passed$(NC)"
